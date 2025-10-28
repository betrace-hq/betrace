/**
 * Example: Basic simulation test with deterministic time and HTTP mocking
 *
 * This example shows how to test a simple data-fetching component
 * with controlled time and network responses.
 */

import { Simulator } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('Simulation Example - Data Fetching', () => {
  it('should fetch and cache data with deterministic timing', async () => {
    // Create simulator with known seed for reproducibility
    const sim = new Simulator(12345);

    // Mock the API response
    sim.http.mockResponse('GET', '/api/rules', {
      status: 200,
      body: {
        rules: [
          { id: '1', name: 'Rule 1', expression: 'span.duration > 1000' },
          { id: '2', name: 'Rule 2', expression: 'span.error == true' },
        ],
      },
    });

    // Simulate application behavior
    const fetchData = async () => {
      const response = await sim.http.fetch('/api/rules');
      const data = await response.json();

      // Cache in localStorage
      sim.storage.setItem('rules-cache', JSON.stringify(data));
      sim.storage.setItem('cache-timestamp', String(sim.clock.now().getTime()));

      return data;
    };

    // Execute
    const data = await fetchData();

    // Verify results
    expect(data.rules).toHaveLength(2);
    expect(sim.http.requestCount).toBe(1);
    expect(sim.storage.writeCount).toBe(2);

    // Verify cache contents
    const cached = JSON.parse(sim.storage.getItem('rules-cache')!);
    expect(cached).toEqual(data);

    // Advance time 5 minutes
    sim.clock.advance(5 * 60 * 1000);

    // Cache should still be valid
    const cacheTime = Number(sim.storage.getItem('cache-timestamp'));
    const age = sim.clock.now().getTime() - cacheTime;
    expect(age).toBe(5 * 60 * 1000); // Exactly 5 minutes
  });

  it('should handle network errors gracefully', async () => {
    const sim = new Simulator(67890);

    // Inject network error
    sim.http.networkError = true;

    const fetchWithRetry = async (maxRetries = 3) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await sim.http.fetch('/api/rules');
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          // Exponential backoff
          sim.clock.advance(Math.pow(2, i) * 1000);
        }
      }
    };

    // Should fail after 3 retries
    await expect(fetchWithRetry()).rejects.toThrow('Network error');

    // Verify retry attempts
    expect(sim.http.requestCount).toBe(3);

    // Verify total time waited: 1s + 2s + 4s = 7s between attempts
    expect(sim.clock.now().getTime() - new Date('2025-01-01').getTime()).toBe(7000);
  });

  it('should recover from storage quota exceeded', () => {
    const sim = new Simulator(11111);

    // Fill storage to near quota
    sim.storage.setQuota(1000); // 1KB quota
    sim.storage.setItem('data', 'x'.repeat(900));

    // Try to add more data
    expect(() => {
      sim.storage.setItem('more-data', 'x'.repeat(200));
    }).toThrow('QuotaExceededError');

    // Cleanup old data
    sim.storage.removeItem('data');

    // Now should succeed
    expect(() => {
      sim.storage.setItem('more-data', 'x'.repeat(200));
    }).not.toThrow();

    expect(sim.storage.usedBytes).toBeLessThan(1000);
  });
});
