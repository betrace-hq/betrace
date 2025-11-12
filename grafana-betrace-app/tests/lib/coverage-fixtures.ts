/**
 * Coverage Fixtures for Playwright
 *
 * Automatically tracks coverage during test execution:
 * - Intercepts API requests
 * - Collects JavaScript coverage
 * - Registers use cases and features from test metadata
 */

import { test as base, expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';
import { globalCoverageCollector } from './coverage-collector';

// ============================================================================
// Test Metadata Types
// ============================================================================

export interface TestMetadata {
  useCase?: {
    id: string;
    name: string;
    description: string;
  };
  feature?: {
    id: string;
    name: string;
    component?: string;
  };
}

// ============================================================================
// Coverage Fixtures
// ============================================================================

type CoverageFixtures = {
  coveragePage: Page;
  request: APIRequestContext;
  trackUseCase: (id: string, name: string, description: string) => void;
  trackFeature: (id: string, name: string, component?: string) => void;
  trackInteraction: (featureId: string, interaction: string) => void;
  _persistCoverage: void;  // Auto fixture that runs after each test
};

export const test = base.extend<CoverageFixtures>({
  /**
   * Enhanced page with automatic coverage tracking
   */
  coveragePage: async ({ page }, use, testInfo) => {
    const testFile = testInfo.file.replace(process.cwd() + '/', '');

    globalCoverageCollector.setCurrentTestFile(testFile);

    // Start JavaScript coverage
    await page.coverage.startJSCoverage({
      resetOnNavigation: false,
      reportAnonymousScripts: true,
    });

    // Intercept all requests to track API coverage
    page.on('request', async (request) => {
      const url = request.url();

      // Only track backend API requests
      if (url.includes('/v1/') || url.includes('/api/') || url.includes('/health') || url.includes('/metrics')) {
        try {
          const response = await request.response();
          const method = request.method();
          const status = response?.status() || 0;

          globalCoverageCollector.trackApiRoute(method, url, status, testFile);
        } catch (error) {
          // Request might not have completed
        }
      }
    });

    // Use the page
    await use(page);

    // Collect coverage after test
    await globalCoverageCollector.collectLocCoverage(page);
  },

  /**
   * Track a use case
   */
  trackUseCase: async ({}, use, testInfo) => {
    const testFile = testInfo.file.replace(process.cwd() + '/', '');

    await use((id: string, name: string, description: string) => {
      globalCoverageCollector.registerUseCase(id, name, description, testFile);
    });
  },

  /**
   * Track a feature
   */
  trackFeature: async ({}, use, testInfo) => {
    const testFile = testInfo.file.replace(process.cwd() + '/', '');

    await use((id: string, name: string, component?: string) => {
      globalCoverageCollector.registerFeature(id, name, component, testFile);
    });
  },

  /**
   * Track a user interaction
   */
  trackInteraction: async ({}, use, testInfo) => {
    const testFile = testInfo.file.replace(process.cwd() + '/', '');

    await use((featureId: string, interaction: string) => {
      globalCoverageCollector.registerFeature(
        featureId,
        featureId, // Will use existing feature name
        undefined,
        testFile,
        interaction
      );
    });
  },

  /**
   * Enhanced request context with automatic API route tracking
   */
  request: async ({ request: baseRequest }, use, testInfo) => {
    const testFile = testInfo.file.replace(process.cwd() + '/', '');

    // Create a proxy that intercepts all request methods
    const trackedRequest = new Proxy(baseRequest, {
      get(target, prop) {
        const original = target[prop as keyof APIRequestContext];

        // Intercept HTTP methods
        if (typeof original === 'function' && ['get', 'post', 'put', 'patch', 'delete', 'head'].includes(prop as string)) {
          return async function(this: any, url: string, options?: any) {
            const method = (prop as string).toUpperCase();

            try {
              // Make the actual request
              const response = await original.call(target, url, options);

              // Track the API route
              globalCoverageCollector.trackApiRoute(method, url, response.status(), testFile);

              return response;
            } catch (error) {
              // Still track failed requests (if we can determine status)
              throw error;
            }
          };
        }

        return original;
      }
    });

    await use(trackedRequest as APIRequestContext);
  },

  /**
   * Auto fixture that persists coverage after each test
   */
  _persistCoverage: [async ({}, use) => {
    await use();
    // After test completes, persist state for cross-process sharing
    globalCoverageCollector.persistState();
  }, { auto: true }],
});

// ============================================================================
// Test Decorators
// ============================================================================

/**
 * Annotate a test with use case metadata
 */
export function useCaseTest(
  useCase: { id: string; name: string; description: string },
  testFn: Parameters<typeof test>[1],
  testBody: Parameters<typeof test>[2]
) {
  test(testFn, async ({ coveragePage, trackUseCase, ...fixtures }) => {
    trackUseCase(useCase.id, useCase.name, useCase.description);
    await testBody({ page: coveragePage, coveragePage, trackUseCase, ...fixtures } as any);
  });
}

/**
 * Annotate a test with feature metadata
 */
export function featureTest(
  feature: { id: string; name: string; component?: string },
  testFn: Parameters<typeof test>[1],
  testBody: Parameters<typeof test>[2]
) {
  test(testFn, async ({ coveragePage, trackFeature, ...fixtures }) => {
    trackFeature(feature.id, feature.name, feature.component);
    await testBody({ page: coveragePage, coveragePage, trackFeature, ...fixtures } as any);
  });
}

export { expect };
