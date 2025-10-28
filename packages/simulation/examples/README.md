# DST Examples

These examples demonstrate **Deterministic Simulation Testing (DST)** - what it enables that traditional async tests cannot do.

## Run the Examples

```bash
npm test
```

## What DST Enables

**Traditional tests hide timing:**
```typescript
// Traditional - timing is invisible
test('fetches data', async () => {
  const data = await fetchData(); // How long? Unknown!
  expect(data).toBeTruthy();
});
```

**DST exposes timing:**
```typescript
// DST - exact control
test('cache expires after 5s', () => {
  fetchData(); // Cached
  sim.clock.advance(4900); // Still valid
  fetchData(); // From cache! 
  sim.clock.advance(200); // Now expired!
  fetchData(); // Fresh fetch!
});
```

## DST Superpowers

### 1. Exact Time Control
```typescript
sim.clock.advance(5000); // Jump 5 seconds instantly
```

### 2. Reproducible I/O Timing
```typescript
sim.http.mockSequence([
  { delay: 100 }, // Slow
  { delay: 50 },  // Fast - completes first!
]);
```

### 3. Force Edge Cases
```typescript
sim.storage.setQuota(100); // Exact quota limit
```

### 4. Simulate User Timing
```typescript
search('a');
sim.clock.advance(50);
search('au'); // 50ms later
```

### 5. Control Races
```typescript
fetchWithTimeout(2000);
sim.clock.advance(2000); // Fire timeout first!
```

## Examples

- `basic.test.ts` - Cache TTL, setTimeout(0), quota, backoff, debounce, timeouts

## Why It Matters

**Traditional:** Can't control time, I/O instant, races untestable, edge cases missed  
**DST:** `sim.clock.advance(ms)`, `delay: 100`, deterministic races, `setQuota(100)`

> "If your test always passes, you're not testing interesting timing."

## Learn More

- [Simulation API](../README.md)
- [FoundationDB DST](https://apple.github.io/foundationdb/testing.html)
