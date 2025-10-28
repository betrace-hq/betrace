/**
 * Example: DST's power through deterministic timing control
 *
 * These tests PASS to demonstrate what DST enables:
 * - Exact control over time progression
 * - Reproducible I/O timing
 * - Deterministic edge case testing
 */

import { Simulator } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('DST Power - What Traditional Tests Can\'t Do', () => {
  it('DST: controls exact timing to test cache TTL', async () => {
    // DST Power: Advance time by exact milliseconds
    // Traditional test: Can't control Date.now(), uses real time
    const sim = new Simulator(12345);

    const cache = new Map<string, { data: any; expires: number }>();
    const CACHE_TTL = 5000; // 5 seconds

    sim.http.mockResponse('GET', '/api/data', {
      status: 200,
      body: { value: 42 },
    });

    const fetchWithCache = async () => {
      const cached = cache.get('data');
      const now = sim.clock.now().getTime();

      if (cached && now < cached.expires) {
        return { ...cached.data, fromCache: true };
      }

      const response = await sim.http.fetch('/api/data');
      const data = await response.json();

      cache.set('data', {
        data,
        expires: now + CACHE_TTL,
      });

      return data;
    };

    // First fetch - populates cache
    const result1 = await fetchWithCache();
    expect(result1.value).toBe(42);
    expect(result1.fromCache).toBeUndefined();
    expect(sim.http.requestCount).toBe(1);

    // DST: Advance 4.9 seconds - cache still valid
    sim.clock.advance(4900);
    const result2 = await fetchWithCache();
    expect(result2.fromCache).toBe(true);
    expect(sim.http.requestCount).toBe(1); // No new request!

    // DST: Advance 200ms more (total 5.1s) - cache expired!
    sim.clock.advance(200);
    const result3 = await fetchWithCache();
    expect(result3.fromCache).toBeUndefined();
    expect(sim.http.requestCount).toBe(2); // Fresh fetch!
  });

  it('DST: proves setTimeout(0) executes after current execution', async () => {
    // DST Power: Shows exact order of timer vs synchronous code
    // Traditional test: Assumptions about "next tick" never verified
    const sim = new Simulator(67890);

    const events: string[] = [];

    sim.clock.setTimeout(() => events.push('timer'), 0);
    events.push('sync');

    // DST: Must explicitly advance clock to fire timers
    expect(events).toEqual(['sync']); // Timer hasn't fired yet!

    sim.clock.advance(0); // Fire pending timers

    expect(events).toEqual(['sync', 'timer']); // Now it fired
  });

  it('DST: forces localStorage quota exceeded at exact limit', () => {
    // DST Power: Set exact quota to trigger edge case
    // Traditional test: Never tests quota limits in CI
    const sim = new Simulator(11111);

    sim.storage.setQuota(100); // Exactly 100 bytes

    // Write 80 bytes (key "data1" = 5 bytes, value = 75 bytes)
    sim.storage.setItem('data1', 'x'.repeat(75));
    expect(sim.storage.usedBytes).toBe(80);

    // Try to write 21 more bytes (key "data2" = 5, value = 16 would exceed)
    expect(() => {
      sim.storage.setItem('data2', 'x'.repeat(16));
    }).toThrow('QuotaExceededError');

    // Write exactly 15 bytes (key "data2" = 5, value = 10 = total 95)
    sim.storage.setItem('data2', 'x'.repeat(10));
    expect(sim.storage.usedBytes).toBe(95);
  });

  it('DST: simulates exponential backoff timing precisely', async () => {
    // DST Power: Advance by exact backoff intervals
    // Traditional test: Mocks instant responses, never tests timing
    const sim = new Simulator(22222);

    let attempt = 0;
    sim.http.mockSequence('GET', '/api/data', [
      { status: 500, body: { error: 'fail' } },
      { status: 500, body: { error: 'fail' } },
      { status: 200, body: { ok: true } },
    ]);

    const backoffEvents: number[] = [];
    let backoff = 100;

    for (let i = 0; i < 5; i++) {
      const response = await sim.http.fetch('/api/data');

      if (response.ok) {
        break; // Success on 3rd attempt
      }

      backoffEvents.push(backoff);
      sim.clock.advance(backoff);
      backoff *= 2;
    }

    // DST: Verify exact backoff sequence: 100ms, 200ms (failed twice)
    expect(backoffEvents).toEqual([100, 200]);

    // DST: Verify total time advanced through backoffs
    expect(backoffEvents.reduce((a, b) => a + b, 0)).toBe(300);
  });

  it('DST: tests debounce timing with exact user input patterns', async () => {
    // DST Power: Simulate exact timing of user keystrokes
    // Traditional test: Fires events instantly, never tests debounce window
    const sim = new Simulator(33333);

    const searches: string[] = [];
    let debounceTimer: any;
    const DEBOUNCE_MS = 300;

    const search = (query: string) => {
      if (debounceTimer) sim.clock.clearTimeout(debounceTimer);

      debounceTimer = sim.clock.setTimeout(() => {
        searches.push(query);
      }, DEBOUNCE_MS);
    };

    // User types "auth" with 50ms between keystrokes
    search('a');
    sim.clock.advance(50);
    search('au');
    sim.clock.advance(50);
    search('aut');
    sim.clock.advance(50);
    search('auth');
    // Last keystroke at 150ms, timer set for 450ms (150 + 300)

    // DST: Only 150ms passed since start, debounce hasn't fired
    expect(searches).toEqual([]);

    // DST: Advance 300ms from last keystroke (total 450ms from start)
    const firedTimers = sim.clock.advance(300);

    // DST: Timer fires synchronously during advance()
    expect(firedTimers.length).toBeGreaterThan(0); // Timer fired
    expect(searches).toEqual(['auth']); // Only searched final input

    // DST: Verify debounce prevented 3 unnecessary searches
    expect(searches.length).toBe(1);
  });

  it('DST: reproduces network timeout vs slow response race', async () => {
    // DST Power: Control exact timing of timeout vs response
    // Traditional test: Mocks always succeed/fail instantly
    const sim = new Simulator(44444);

    sim.http.mockResponse('GET', '/api/slow', {
      status: 200,
      body: { data: 'finally!' },
      delay: 3000, // Takes 3 seconds
    });

    const events: string[] = [];

    const fetchWithTimeout = async (timeoutMs: number) => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        sim.clock.setTimeout(() => {
          events.push('timeout');
          reject(new Error('Timeout'));
        }, timeoutMs);
      });

      const fetchPromise = sim.http.fetch('/api/slow').then(() => {
        events.push('response');
        return { ok: true };
      });

      return Promise.race([fetchPromise, timeoutPromise]);
    };

    // Test: Timeout fires BEFORE response (2s timeout, 3s response)
    const attempt = fetchWithTimeout(2000);
    sim.clock.advance(2000); // Fire timeout
    await expect(attempt).rejects.toThrow('Timeout');
    expect(events).toEqual(['timeout']);

    // DST Power: Exact control over which completes first!
  });
});
