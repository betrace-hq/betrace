/**
 * Example: Grafana Plugin simulation test
 *
 * Shows how to test Grafana plugin behavior with simulated datasource queries,
 * panel refreshes, and dashboard interactions.
 */

import { Simulator } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('Simulation Example - Grafana Plugin', () => {
  it('should query datasource and update panel on interval', async () => {
    const sim = new Simulator(99999);

    // Mock Grafana datasource API
    sim.http.mockSequence('POST', '/api/ds/query', [
      {
        status: 200,
        body: {
          results: { A: { frames: [{ fields: [{ values: [1, 2, 3] }] }] } },
        },
      },
      {
        status: 200,
        body: {
          results: { A: { frames: [{ fields: [{ values: [4, 5, 6] }] }] } },
        },
      },
    ]);

    let panelData: number[] = [];

    // Simulate panel query function
    const queryPanel = async () => {
      const response = await sim.http.fetch('/api/ds/query', {
        method: 'POST',
        body: JSON.stringify({
          queries: [{ refId: 'A', query: 'violations{rule_id="test"}' }],
        }),
      });

      const data = await response.json();
      panelData = data.results.A.frames[0].fields[0].values;

      // Store in panel state (localStorage)
      sim.storage.setItem('panel-data', JSON.stringify(panelData));
    };

    // Query immediately
    await queryPanel();
    expect(panelData).toEqual([1, 2, 3]);

    // Set up auto-refresh (5 second interval)
    const intervalId = sim.clock.setInterval(queryPanel, 5000);

    // Advance 5 seconds - should trigger refresh
    sim.clock.advance(5000);
    await new Promise(resolve => setTimeout(resolve, 0)); // Let interval fire

    expect(panelData).toEqual([4, 5, 6]);
    expect(sim.http.requestCount).toBe(2);

    // Cleanup
    sim.clock.clearInterval(intervalId);
  });

  it('should handle panel crash and state recovery', async () => {
    const sim = new Simulator(55555);

    // Set up panel state
    const panelState = {
      title: 'BeTrace Violations',
      datasource: 'betrace',
      query: 'violations{rule_id="auth-required"}',
      refreshInterval: 5000,
    };

    sim.storage.setItem('panel-config', JSON.stringify(panelState));
    sim.storage.setItem('last-query-result', JSON.stringify({ count: 42 }));

    // Simulate crash
    sim.crashAndRestart();

    // Verify persistent state survived
    const recoveredConfig = JSON.parse(sim.storage.getItem('panel-config')!);
    expect(recoveredConfig).toEqual(panelState);

    const recoveredResult = JSON.parse(sim.storage.getItem('last-query-result')!);
    expect(recoveredResult.count).toBe(42);

    // Verify volatile state was cleared
    expect(sim.http.requestCount).toBe(0);
    expect(sim.clock.pendingTimers()).toBe(0);
  });

  it('should handle datasource timeout with fallback', async () => {
    const sim = new Simulator(77777);

    // Mock slow datasource (10s timeout)
    sim.http.mockResponse('POST', '/api/ds/query', {
      status: 200,
      body: { results: {} },
      delay: 10000, // 10 second delay
    });

    const queryWithTimeout = async (timeoutMs: number) => {
      const timeoutPromise = new Promise((_, reject) => {
        sim.clock.setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
      });

      const queryPromise = sim.http.fetch('/api/ds/query', {
        method: 'POST',
        body: JSON.stringify({ queries: [] }),
      });

      return Promise.race([queryPromise, timeoutPromise]);
    };

    // Query with 5s timeout (should fail before response)
    const queryStart = sim.clock.now().getTime();

    const queryAttempt = queryWithTimeout(5000);
    sim.clock.advance(5000); // Trigger timeout

    await expect(queryAttempt).rejects.toThrow('Query timeout');

    // Verify timeout was exactly 5 seconds
    const elapsed = sim.clock.now().getTime() - queryStart;
    expect(elapsed).toBe(5000);

    // Fallback: use cached data
    sim.storage.setItem('last-successful-query', JSON.stringify({ cached: true }));
    const fallback = JSON.parse(sim.storage.getItem('last-successful-query')!);
    expect(fallback.cached).toBe(true);
  });

  it('should batch multiple panel queries efficiently', async () => {
    const sim = new Simulator(33333);

    let requestBodies: any[] = [];

    // Mock batch query endpoint
    sim.http.mockResponse('POST', '/api/ds/query', {
      status: 200,
      body: (url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        requestBodies.push(body);

        return {
          results: body.queries.reduce((acc: any, q: any) => {
            acc[q.refId] = { frames: [{ fields: [] }] };
            return acc;
          }, {}),
        };
      },
    });

    // Simulate 3 panels querying simultaneously
    const queries = [
      { refId: 'A', query: 'violations{rule_id="auth"}' },
      { refId: 'B', query: 'violations{rule_id="rate-limit"}' },
      { refId: 'C', query: 'violations{rule_id="pii"}' },
    ];

    // Batch queries
    const response = await sim.http.fetch('/api/ds/query', {
      method: 'POST',
      body: JSON.stringify({ queries }),
    });

    const data = await response.json();

    // Verify single request with all queries
    expect(sim.http.requestCount).toBe(1);
    expect(requestBodies[0].queries).toHaveLength(3);
    expect(data.results).toHaveProperty('A');
    expect(data.results).toHaveProperty('B');
    expect(data.results).toHaveProperty('C');
  });
});
