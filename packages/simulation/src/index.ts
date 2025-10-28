/**
 * @betrace/simulation - Deterministic simulation testing framework
 *
 * Enables reproducible frontend testing with controlled time, storage, and network.
 * Inspired by FoundationDB's simulation testing and TigerBeetle's VOPR.
 *
 * @example Basic Usage
 * ```ts
 * import { Simulator } from '@betrace/simulation';
 *
 * const sim = new Simulator(12345);
 *
 * // Mock HTTP responses
 * sim.http.mockResponse('GET', '/api/data', {
 *   status: 200,
 *   body: { message: 'Hello' }
 * });
 *
 * // Advance time deterministically
 * sim.clock.advance(1000);
 *
 * // Verify behavior
 * expect(sim.http.requestCount).toBe(1);
 * ```
 *
 * @example With Fault Injection
 * ```ts
 * import { Simulator, FaultProfiles } from '@betrace/simulation';
 *
 * const sim = new Simulator(12345);
 * sim.setFaultProfile(FaultProfiles.Aggressive());
 *
 * // Test error handling
 * sim.storage.quotaExceeded = true;
 * expect(() => sim.storage.setItem('key', 'value')).toThrow();
 * ```
 *
 * @example Invariant Checking
 * ```ts
 * sim.addInvariant('data-persists', (sim) => {
 *   sim.storage.setItem('test', 'value');
 *   sim.crashAndRestart();
 *   return sim.storage.getItem('test') === 'value';
 * });
 *
 * await sim.checkInvariants(); // Throws if invariant fails
 * ```
 */

export { VirtualClock, type VirtualTimer } from './clock.js';
export { DeterministicRandom } from './random.js';
export {
  MockStorage,
  MockIndexedDB,
  MockDatabase,
  MockObjectStore,
  MockTransaction,
  MockDBRequest,
} from './storage.js';
export { MockHTTP, type MockResponse, type RecordedRequest } from './http.js';
export {
  Simulator,
  FaultProfiles,
  type FaultProfile,
  type Invariant,
  type InvariantResult,
  type SimulationStats,
} from './simulator.js';
