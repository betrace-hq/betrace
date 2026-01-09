import { defineConfig, devices } from '@playwright/test';

// In CI, services are started by the workflow - don't use webServer
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    baseURL: 'http://localhost:3001',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Only use webServer in local development (flox not available in CI)
  ...(isCI ? {} : {
    webServer: [
      {
        command: 'flox services status backend || flox services start backend',
        port: 12011,
        timeout: 120 * 1000,
        reuseExistingServer: true,
      },
      {
        command: 'flox services status grafana || flox services start grafana',
        port: 12015,
        timeout: 120 * 1000,
        reuseExistingServer: true,
      },
    ],
  }),
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
});
