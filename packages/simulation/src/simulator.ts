import { VirtualClock } from './clock.js';
import { DeterministicRandom } from './random.js';
import { MockStorage } from './storage.js';
import { MockHTTP } from './http.js';

/**
 * Simulator provides a deterministic test harness for frontend applications
 *
 * Orchestrates all mock components (clock, storage, HTTP) with a single seed value
 * for perfect reproducibility. Same seed = same execution = same result.
 *
 * @example
 * ```ts
 * const sim = new Simulator(12345);
 *
 * // Mock HTTP responses
 * sim.http.mockResponse('GET', '/api/rules', {
 *   status: 200,
 *   body: { rules: [] }
 * });
 *
 * // Run test with deterministic time
 * sim.clock.advance(1000); // Advance 1 second instantly
 *
 * // Verify results
 * expect(sim.http.requestCount).toBe(1);
 * expect(sim.storage.readCount).toBe(5);
 * ```
 */
export class Simulator {
  public readonly seed: number;
  public readonly rng: DeterministicRandom;
  public readonly clock: VirtualClock;
  public readonly storage: MockStorage;
  public readonly http: MockHTTP;

  private invariants: Invariant[] = [];
  private faults: FaultProfile = {
    storageQuotaExceeded: 0.0,
    storageReadError: 0.0,
    storageWriteError: 0.0,
    httpNetworkError: 0.0,
    httpTimeout: 0.0,
    slowStorage: 0,
    slowHTTP: 0,
  };

  constructor(seed: number, startTime?: Date) {
    this.seed = seed;
    this.rng = new DeterministicRandom(seed);
    this.clock = new VirtualClock(startTime);
    this.storage = new MockStorage();
    this.http = new MockHTTP(this.rng);
  }

  /**
   * Advances simulated time and checks for fault injection
   */
  advance(ms: number): void {
    this.clock.advance(ms);
    this.maybeInjectFaults();
  }

  /**
   * Sets fault injection probabilities
   */
  setFaultProfile(profile: Partial<FaultProfile>): void {
    this.faults = { ...this.faults, ...profile };
  }

  /**
   * Registers an invariant to be checked
   */
  addInvariant(name: string, check: (sim: Simulator) => boolean | Promise<boolean>): void {
    this.invariants.push({ name, check });
  }

  /**
   * Checks all registered invariants
   * @throws Error if any invariant fails
   */
  async checkInvariants(): Promise<InvariantResult[]> {
    const results: InvariantResult[] = [];

    for (const invariant of this.invariants) {
      const startTime = Date.now();
      let passed = false;
      let error: Error | undefined;

      try {
        passed = await invariant.check(this);
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
      }

      results.push({
        name: invariant.name,
        passed,
        error,
        durationMs: Date.now() - startTime,
      });

      if (!passed) {
        const msg = error
          ? `Invariant '${invariant.name}' failed: ${error.message}`
          : `Invariant '${invariant.name}' failed`;
        throw new Error(msg);
      }
    }

    return results;
  }

  /**
   * Simulates a crash and restart (clears volatile state, keeps persistent state)
   */
  crashAndRestart(): void {
    // Save persistent state (storage)
    const storageSnapshot = this.storage.snapshot();

    // Clear all volatile state
    this.http.clearRequests();
    this.http.reset();
    this.clock.reset();

    // Restore persistent state
    this.storage.restore(storageSnapshot);
    this.storage.reset(); // Reset fault flags but keep data
  }

  /**
   * Returns a summary of simulation statistics
   */
  getStats(): SimulationStats {
    return {
      seed: this.seed,
      currentTime: this.clock.now(),
      storageUsedBytes: this.storage.usedBytes,
      storageReadCount: this.storage.readCount,
      storageWriteCount: this.storage.writeCount,
      httpRequestCount: this.http.requestCount,
      pendingTimers: this.clock.pendingTimers(),
    };
  }

  /**
   * Resets all mocks and clears state
   */
  reset(): void {
    this.clock.reset();
    this.storage.clear();
    this.storage.reset();
    this.http.reset();
    this.invariants = [];
  }

  private maybeInjectFaults(): void {
    // Storage faults
    if (this.rng.chance(this.faults.storageQuotaExceeded)) {
      this.storage.quotaExceeded = true;
    }
    if (this.rng.chance(this.faults.storageReadError)) {
      this.storage.readError = true;
    }
    if (this.rng.chance(this.faults.storageWriteError)) {
      this.storage.writeError = true;
    }
    if (this.faults.slowStorage > 0) {
      this.storage.slowOperationMs = this.faults.slowStorage;
    }

    // HTTP faults
    if (this.rng.chance(this.faults.httpNetworkError)) {
      this.http.networkError = true;
    }
    if (this.rng.chance(this.faults.httpTimeout)) {
      this.http.timeoutError = true;
    }
    if (this.faults.slowHTTP > 0) {
      this.http.slowResponseMs = this.faults.slowHTTP;
    }
  }
}

export interface FaultProfile {
  storageQuotaExceeded: number;
  storageReadError: number;
  storageWriteError: number;
  httpNetworkError: number;
  httpTimeout: number;
  slowStorage: number; // milliseconds
  slowHTTP: number; // milliseconds
}

export interface Invariant {
  name: string;
  check: (sim: Simulator) => boolean | Promise<boolean>;
}

export interface InvariantResult {
  name: string;
  passed: boolean;
  error?: Error;
  durationMs: number;
}

export interface SimulationStats {
  seed: number;
  currentTime: Date;
  storageUsedBytes: number;
  storageReadCount: number;
  storageWriteCount: number;
  httpRequestCount: number;
  pendingTimers: number;
}

/**
 * Predefined fault profiles for common testing scenarios
 */
export const FaultProfiles = {
  /**
   * No faults - ideal conditions
   */
  None: (): FaultProfile => ({
    storageQuotaExceeded: 0.0,
    storageReadError: 0.0,
    storageWriteError: 0.0,
    httpNetworkError: 0.0,
    httpTimeout: 0.0,
    slowStorage: 0,
    slowHTTP: 0,
  }),

  /**
   * Conservative fault injection - occasional failures
   */
  Conservative: (): FaultProfile => ({
    storageQuotaExceeded: 0.01,
    storageReadError: 0.005,
    storageWriteError: 0.01,
    httpNetworkError: 0.02,
    httpTimeout: 0.01,
    slowStorage: 0,
    slowHTTP: 100,
  }),

  /**
   * Aggressive fault injection - frequent failures
   */
  Aggressive: (): FaultProfile => ({
    storageQuotaExceeded: 0.10,
    storageReadError: 0.05,
    storageWriteError: 0.10,
    httpNetworkError: 0.15,
    httpTimeout: 0.10,
    slowStorage: 50,
    slowHTTP: 500,
  }),

  /**
   * Chaos mode - extreme failure rates
   */
  Chaos: (): FaultProfile => ({
    storageQuotaExceeded: 0.25,
    storageReadError: 0.20,
    storageWriteError: 0.25,
    httpNetworkError: 0.30,
    httpTimeout: 0.25,
    slowStorage: 200,
    slowHTTP: 2000,
  }),
};
