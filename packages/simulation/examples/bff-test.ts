/**
 * Example: BFF (Backend-for-Frontend) simulation test
 *
 * Shows how to test React Query hooks, form state, and complex user interactions
 * with deterministic timing.
 */

import { Simulator } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('Simulation Example - BFF React App', () => {
  it('should manage query cache with stale-while-revalidate', async () => {
    const sim = new Simulator(44444);

    // Mock backend API
    let requestCount = 0;
    sim.http.mockResponse('GET', '/api/rules', {
      status: 200,
      body: () => ({
        rules: [{ id: String(++requestCount), name: `Rule ${requestCount}` }],
      }),
    });

    // Simulate React Query behavior
    const queryCache = {
      data: null as any,
      isStale: false,
      lastFetched: 0,
      staleTime: 30000, // 30 seconds
    };

    const fetchRules = async () => {
      const response = await sim.http.fetch('/api/rules');
      const data = await response.json();

      queryCache.data = data;
      queryCache.lastFetched = sim.clock.now().getTime();
      queryCache.isStale = false;

      // Store in cache
      sim.storage.setItem('query-cache:/api/rules', JSON.stringify(queryCache));

      return data;
    };

    const useRules = async () => {
      // Check cache freshness
      const cacheAge = sim.clock.now().getTime() - queryCache.lastFetched;

      if (!queryCache.data || cacheAge > queryCache.staleTime) {
        return await fetchRules();
      }

      // Return cached data but revalidate in background
      if (cacheAge > queryCache.staleTime / 2) {
        setTimeout(fetchRules, 0); // Background revalidation
      }

      return queryCache.data;
    };

    // First fetch
    const result1 = await useRules();
    expect(result1.rules[0].id).toBe('1');
    expect(sim.http.requestCount).toBe(1);

    // Immediate second fetch (uses cache)
    const result2 = await useRules();
    expect(result2.rules[0].id).toBe('1'); // Same data
    expect(sim.http.requestCount).toBe(1); // No new request

    // Advance 20 seconds (past half stale time, triggers background refresh)
    sim.clock.advance(20000);
    await useRules();
    await new Promise(resolve => setTimeout(resolve, 0)); // Let background fetch complete

    expect(sim.http.requestCount).toBe(2); // Background revalidation

    // Advance another 15 seconds (total 35s, past stale time)
    sim.clock.advance(15000);
    const result3 = await useRules();
    expect(result3.rules[0].id).toBe('3'); // Fresh data
    expect(sim.http.requestCount).toBe(3);
  });

  it('should handle optimistic updates with rollback on error', async () => {
    const sim = new Simulator(22222);

    let serverRules = [
      { id: '1', name: 'Rule 1', enabled: true },
      { id: '2', name: 'Rule 2', enabled: false },
    ];

    // Mock rule update endpoint
    sim.http.mockSequence('PATCH', '/api/rules/2', [
      { status: 200, body: { ...serverRules[1], enabled: true } },
      { status: 500, body: { error: 'Server error' } },
    ]);

    // Local state
    let localRules = [...serverRules];

    const toggleRule = async (ruleId: string) => {
      const rule = localRules.find(r => r.id === ruleId)!;
      const previousState = { ...rule };

      // Optimistic update
      rule.enabled = !rule.enabled;
      sim.storage.setItem('rules', JSON.stringify(localRules));

      try {
        // Send to server
        const response = await sim.http.fetch(`/api/rules/${ruleId}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: rule.enabled }),
        });

        if (!response.ok) throw new Error('Update failed');

        return await response.json();
      } catch (error) {
        // Rollback on error
        Object.assign(rule, previousState);
        sim.storage.setItem('rules', JSON.stringify(localRules));
        throw error;
      }
    };

    // First toggle (succeeds)
    await toggleRule('2');
    expect(localRules[1].enabled).toBe(true);
    expect(sim.storage.getItem('rules')).toContain('"enabled":true');

    // Second toggle (fails, should rollback)
    await expect(toggleRule('2')).rejects.toThrow();
    expect(localRules[1].enabled).toBe(true); // Rolled back to previous state
  });

  it('should debounce search input with deterministic timing', async () => {
    const sim = new Simulator(88888);

    let searchResults: string[] = [];
    let searchRequests = 0;

    sim.http.mockResponse('GET', '/api/search', {
      status: 200,
      body: (url: string) => {
        const query = new URL(url, 'http://localhost').searchParams.get('q');
        searchRequests++;
        return { results: [`Result for: ${query}`] };
      },
    });

    let debounceTimer: any = null;

    const handleSearchInput = (query: string) => {
      // Clear existing debounce timer
      if (debounceTimer) {
        sim.clock.clearTimeout(debounceTimer);
      }

      // Set new debounce timer (300ms)
      debounceTimer = sim.clock.setTimeout(async () => {
        const response = await sim.http.fetch(`/api/search?q=${query}`);
        const data = await response.json();
        searchResults = data.results;
      }, 300);
    };

    // User types "auth" quickly
    handleSearchInput('a');
    sim.clock.advance(50);

    handleSearchInput('au');
    sim.clock.advance(50);

    handleSearchInput('aut');
    sim.clock.advance(50);

    handleSearchInput('auth');
    sim.clock.advance(50);

    // Only 200ms passed, should not fire yet
    expect(searchRequests).toBe(0);

    // Advance remaining 100ms (total 300ms)
    sim.clock.advance(100);
    await new Promise(resolve => setTimeout(resolve, 0));

    // Now should have searched
    expect(searchRequests).toBe(1);
    expect(searchResults[0]).toContain('auth');
  });

  it('should handle concurrent form submissions with locking', async () => {
    const sim = new Simulator(66666);

    let serverSubmissions = 0;

    sim.http.mockResponse('POST', '/api/rules', {
      status: 200,
      delay: 500, // Slow server response
      body: () => ({ id: String(++serverSubmissions) }),
    });

    let isSubmitting = false;

    const submitForm = async (formData: any) => {
      // Prevent concurrent submissions
      if (isSubmitting) {
        throw new Error('Already submitting');
      }

      isSubmitting = true;
      sim.storage.setItem('form-submitting', 'true');

      try {
        const response = await sim.http.fetch('/api/rules', {
          method: 'POST',
          body: JSON.stringify(formData),
        });

        return await response.json();
      } finally {
        isSubmitting = false;
        sim.storage.removeItem('form-submitting');
      }
    };

    // Start first submission
    const submission1 = submitForm({ name: 'Rule 1' });

    // Try to submit again immediately (should fail)
    await expect(submitForm({ name: 'Rule 2' })).rejects.toThrow('Already submitting');

    // Advance time to complete first submission
    sim.clock.advance(500);
    await submission1;

    // Now second submission should succeed
    const submission2 = await submitForm({ name: 'Rule 2' });
    expect(serverSubmissions).toBe(1); // Only one succeeded
  });
});
