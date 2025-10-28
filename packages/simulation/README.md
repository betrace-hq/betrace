# @betrace/simulation

**Deterministic simulation testing framework for TypeScript/JavaScript frontends**

Inspired by [FoundationDB's simulation testing](https://apple.github.io/foundationdb/testing.html) and [TigerBeetle's VOPR](https://tigerbeetle.com/blog/2025-02-13-a-descent-into-the-vortex/), this library enables reproducible frontend testing with controlled time, storage, and network behavior.

## Why Simulation Testing?

Traditional frontend tests have limitations:
- ⏰ **Real time** - Can't fast-forward through delays/timeouts
- 🎲 **Non-deterministic** - Flaky tests due to race conditions
- 🌐 **Network dependent** - Slow, unreliable, hard to test edge cases
- 💾 **Limited fault injection** - Hard to test quota exceeded, corruption, etc.

Simulation testing solves these by:
- ✅ **Virtual time** - Advance time instantly (1 hour in 1ms)
- ✅ **100% reproducible** - Same seed = same test result every time
- ✅ **Fault injection** - Test every error condition easily
- ✅ **Zero external dependencies** - All mocked, runs anywhere

## Installation

```bash
npm install @betrace/simulation
# or
pnpm add @betrace/simulation
```

## Quick Start

```typescript
import { Simulator } from '@betrace/simulation';

// Create simulator with seed for reproducibility
const sim = new Simulator(12345);

// Mock HTTP responses
sim.http.mockResponse('GET', '/api/data', {
  status: 200,
  body: { message: 'Hello world' }
});

// Fetch data
const response = await sim.http.fetch('/api/data');
const data = await response.json();

// Advance time instantly
sim.clock.advance(5000); // Jump 5 seconds ahead

// Verify results
expect(sim.http.requestCount).toBe(1);
expect(data.message).toBe('Hello world');
```

## Core Components

### VirtualClock

Deterministic time control - no more `await sleep()` in tests!

```typescript
const clock = new VirtualClock(new Date('2025-01-01'));

// Schedule callbacks
const timer = clock.setTimeout(() => console.log('fired!'), 1000);
const interval = clock.setInterval(() => console.log('tick'), 500);

// Advance time instantly (no actual waiting)
clock.advance(2000); // Fires: tick, tick, fired!, tick

// Clean up
clock.clearTimeout(timer);
clock.clearInterval(interval);
```

### DeterministicRandom

Seedable randomness for reproducible tests:

```typescript
const rng = new DeterministicRandom(12345);

rng.int(100);           // Random int [0, 100)
rng.float();            // Random float [0.0, 1.0)
rng.bool();             // Random boolean
rng.chance(0.7);        // True 70% of the time
rng.choice(['a', 'b']); // Pick random element
rng.uuid();             // Deterministic UUID
```

### MockStorage

In-memory localStorage/sessionStorage with fault injection:

```typescript
const storage = new MockStorage();

// Normal operations
storage.setItem('key', 'value');
storage.getItem('key'); // 'value'

// Fault injection
storage.quotaExceeded = true;
storage.setItem('fail', 'value'); // Throws QuotaExceededError

storage.readError = true;
storage.getItem('fail'); // Throws storage error

// Statistics
console.log(storage.readCount, storage.writeCount);
console.log(storage.usedBytes, 'bytes used');
```

### MockHTTP

Deterministic HTTP client with fault injection:

```typescript
const http = new MockHTTP();

// Mock responses
http.mockResponse('GET', '/api/users', {
  status: 200,
  body: { users: [] },
  delay: 100 // Optional delay
});

// Mock sequences (different responses per call)
http.mockSequence('GET', '/api/status', [
  { status: 200, body: { status: 'ok' } },
  { status: 500, body: { error: 'Server error' } },
]);

// Fault injection
http.networkError = true;
await http.fetch('/api/users'); // Throws network error

http.slowResponseMs = 5000;
await http.fetch('/api/slow'); // Takes 5 seconds (in virtual time)

// Verify requests
const requests = http.getRequestsTo('POST', '/api/data');
expect(requests).toHaveLength(1);
```

### Simulator

Orchestrates all components with single seed:

```typescript
const sim = new Simulator(12345);

// All components available
sim.clock.advance(1000);
sim.storage.setItem('key', 'value');
sim.http.fetch('/api/endpoint');

// Fault profiles
import { FaultProfiles } from '@betrace/simulation';

sim.setFaultProfile(FaultProfiles.Aggressive());
// Now all operations may randomly fail!

// Crash recovery testing
sim.crashAndRestart();
// Storage persists, HTTP requests cleared, timers reset
```

## Testing Patterns

### React Query with Stale-While-Revalidate

```typescript
const sim = new Simulator(12345);

sim.http.mockResponse('GET', '/api/data', {
  status: 200,
  body: { data: 'fresh' }
});

// Fetch and cache
const data1 = await fetchData();
expect(data1).toBe('fresh');

// Use cached (no request)
const data2 = await fetchData();
expect(sim.http.requestCount).toBe(1); // Still 1

// Advance past stale time
sim.clock.advance(60000); // 1 minute

// Now refetches
const data3 = await fetchData();
expect(sim.http.requestCount).toBe(2);
```

### Optimistic Updates with Rollback

```typescript
const sim = new Simulator(12345);

// Optimistic update
const originalState = { ...item };
item.name = 'New Name';

try {
  await sim.http.fetch('/api/update', {
    method: 'PATCH',
    body: JSON.stringify(item)
  });
} catch (error) {
  // Rollback on failure
  Object.assign(item, originalState);
}
```

### Debounced Search

```typescript
const sim = new Simulator(12345);

let timer: any;
const handleSearch = (query: string) => {
  if (timer) sim.clock.clearTimeout(timer);

  timer = sim.clock.setTimeout(async () => {
    const results = await fetchSearchResults(query);
    updateUI(results);
  }, 300);
};

// User types quickly
handleSearch('a');
sim.clock.advance(50);
handleSearch('ab');
sim.clock.advance(50);
handleSearch('abc');

// Not triggered yet (only 100ms passed)
expect(fetchCount).toBe(0);

// Advance remaining time
sim.clock.advance(200);

// Now triggered once
expect(fetchCount).toBe(1);
```

### Invariant Checking

```typescript
const sim = new Simulator(12345);

// Register invariants
sim.addInvariant('data-persists-crash', (sim) => {
  sim.storage.setItem('important', 'data');
  sim.crashAndRestart();
  return sim.storage.getItem('important') === 'data';
});

sim.addInvariant('no-concurrent-submissions', (sim) => {
  const isSubmitting = sim.storage.getItem('submitting');
  return isSubmitting !== 'true';
});

// Check all invariants
await sim.checkInvariants(); // Throws if any fail
```

## Fault Profiles

Pre-configured fault injection scenarios:

```typescript
import { Simulator, FaultProfiles } from '@betrace/simulation';

const sim = new Simulator(12345);

// No faults - ideal conditions
sim.setFaultProfile(FaultProfiles.None());

// Occasional failures (2% error rate)
sim.setFaultProfile(FaultProfiles.Conservative());

// Frequent failures (15% error rate)
sim.setFaultProfile(FaultProfiles.Aggressive());

// Extreme failures (25%+ error rate)
sim.setFaultProfile(FaultProfiles.Chaos());
```

Custom fault profiles:

```typescript
sim.setFaultProfile({
  storageQuotaExceeded: 0.10,  // 10% chance
  httpNetworkError: 0.05,       // 5% chance
  slowHTTP: 1000,               // 1 second delay
});
```

## Examples

See [examples/](./examples/) directory for complete examples:

- [basic-test.ts](./examples/basic-test.ts) - Basic simulation patterns
- [bff-test.ts](./examples/bff-test.ts) - React Query, forms, debouncing
- [grafana-plugin-test.ts](./examples/grafana-plugin-test.ts) - Panel queries, datasources

## Comparison with Backend Simulation

| Feature | Backend (Go) | Frontend (TypeScript) |
|---------|-------------|----------------------|
| Virtual Time | ✅ VirtualClock | ✅ VirtualClock |
| Deterministic Random | ✅ DeterministicRand | ✅ DeterministicRandom |
| Storage Mocking | ✅ MockFileSystem | ✅ MockStorage + MockIndexedDB |
| Network Mocking | ✅ (via interfaces) | ✅ MockHTTP (fetch API) |
| Fault Injection | ✅ FaultInjector | ✅ FaultProfiles |
| Crash Recovery | ✅ CrashAndRestart | ✅ crashAndRestart() |
| Invariant Checking | ✅ 8 invariants | ✅ Extensible invariants |
| Speedup | ~2,354x | ~1,000x (browser limits) |

## Usage in BeTrace

### BFF (React + Tanstack)

```typescript
// bff/src/test/simulation.test.ts
import { Simulator } from '@betrace/simulation';

test('rule creation with optimistic updates', async () => {
  const sim = new Simulator(12345);

  // Mock backend
  sim.http.mockResponse('POST', '/api/rules', {
    status: 201,
    body: { id: 'rule-1', name: 'Test Rule' }
  });

  // Test rule creation workflow
  await createRule({ name: 'Test Rule' }, sim);

  expect(sim.http.requestCount).toBe(1);
});
```

### Grafana Plugin

```typescript
// grafana-betrace-app/src/test/datasource.test.ts
import { Simulator } from '@betrace/simulation';

test('datasource query with timeout', async () => {
  const sim = new Simulator(67890);

  // Mock Grafana datasource API
  sim.http.mockResponse('POST', '/api/ds/query', {
    status: 200,
    delay: 10000, // 10 second delay
    body: { results: {} }
  });

  // Query with 5s timeout
  const promise = queryDatasource();
  sim.clock.advance(5000);

  await expect(promise).rejects.toThrow('timeout');
});
```

## API Reference

### Simulator

- `constructor(seed: number, startTime?: Date)`
- `advance(ms: number): void` - Advance virtual time
- `setFaultProfile(profile: FaultProfile): void` - Configure fault injection
- `addInvariant(name: string, check: (sim) => boolean): void` - Add invariant
- `checkInvariants(): Promise<InvariantResult[]>` - Verify all invariants
- `crashAndRestart(): void` - Simulate crash (clears volatile state)
- `getStats(): SimulationStats` - Get statistics
- `reset(): void` - Clear all state

### VirtualClock

- `now(): Date` - Current simulated time
- `advance(ms: number): number[]` - Advance time, returns fired timer IDs
- `setTimeout(callback, ms): VirtualTimer` - Schedule callback
- `setInterval(callback, ms): number` - Repeat callback
- `clearTimeout(timer): void` - Cancel timeout
- `clearInterval(id): void` - Cancel interval
- `pendingTimers(): number` - Count of pending timers
- `reset(): void` - Clear all timers

### DeterministicRandom

- `int(max: number): number` - Random int [0, max)
- `float(): number` - Random float [0.0, 1.0)
- `bool(): boolean` - Random boolean
- `chance(probability: number): boolean` - True with probability
- `choice<T>(arr: T[]): T` - Pick random element
- `shuffle<T>(arr: T[]): T[]` - Shuffle array in place
- `range(min: number, max: number): number` - Random int [min, max)
- `string(length: number): string` - Random string
- `uuid(): string` - Deterministic UUID
- `date(start: Date, end: Date): Date` - Random date

### MockStorage

- `getItem(key: string): string | null`
- `setItem(key: string, value: string): void`
- `removeItem(key: string): void`
- `clear(): void`
- `key(index: number): string | null`
- `length: number` - Item count
- `usedBytes: number` - Storage size
- `setQuota(bytes: number): void` - Set quota limit
- `snapshot(): Map` - Save state
- `restore(snapshot: Map): void` - Load state

Fault injection flags:
- `quotaExceeded: boolean`
- `readError: boolean`
- `writeError: boolean`
- `slowOperationMs: number`

### MockHTTP

- `fetch(url: string, init?: RequestInit): Promise<Response>` - Fetch API
- `mockResponse(method, url, response): void` - Mock single response
- `mockSequence(method, url, responses[]): void` - Mock sequence
- `getRequests(): RecordedRequest[]` - All requests
- `getRequestsTo(method, url): RecordedRequest[]` - Filtered requests
- `clearRequests(): void` - Clear history
- `reset(): void` - Clear all state

Fault injection flags:
- `networkError: boolean`
- `timeoutError: boolean`
- `slowResponseMs: number`
- `errorProbability: number` (0.0 to 1.0)

## References

- [FoundationDB Simulation Testing](https://apple.github.io/foundationdb/testing.html)
- [TigerBeetle VOPR](https://tigerbeetle.com/blog/2025-02-13-a-descent-into-the-vortex/)
- [Deterministic Simulation Testing (Phil Eaton)](https://notes.eatonphil.com/2024-08-20-deterministic-simulation-testing.html)
- [WarpStream DST](https://www.warpstream.com/blog/deterministic-simulation-testing-for-our-entire-saas)

## License

UNLICENSED - BeTrace internal use only
