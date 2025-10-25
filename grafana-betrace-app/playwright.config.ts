import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Grafana integration tests
 *
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  // Run tests in files in parallel
  fullyParallel: false, // Run sequentially to avoid Grafana state issues

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: 1, // Single worker to avoid Grafana race conditions

  // Reporter to use
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL for Grafana
    baseURL: process.env.BETRACE_PORT_GRAFANA
      ? `http://localhost:${process.env.BETRACE_PORT_GRAFANA}`
      : 'http://localhost:12015',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Timeout for each action (e.g., click, fill)
    actionTimeout: 10000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Grafana-specific viewport
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  // Run your local dev server before starting the tests
  // Commented out since we use Flox services
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:12015',
  //   reuseExistingServer: !process.env.CI,
  // },
});
