/**
 * Playwright Capability Plugin
 *
 * Integrates test preprocessor with Playwright test runner.
 * Validates capabilities before test execution using global setup/teardown.
 *
 * ## Usage
 *
 * In playwright.config.ts:
 * ```typescript
 * import { defineConfig } from '@playwright/test';
 * import { createCapabilityPlugin } from './tests/lib/playwright-capability-plugin';
 *
 * export default defineConfig({
 *   globalSetup: require.resolve('./tests/lib/global-setup'),
 *   projects: [
 *     {
 *       name: 'grafana-tests',
 *       testMatch: /.*grafana.*\.spec\.ts/,
 *       use: {
 *         // Project-level capabilities
 *         capabilities: ['grafana', 'backend'],
 *       },
 *     },
 *   ],
 * });
 * ```
 */

import { test as base, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import {
  TestPreprocessor,
  BETRACE_CAPABILITIES,
  parseTestRequirements,
  TestRequirements,
  PreprocessorConfig,
  CapabilityStatus,
} from './test-preprocessor.js';
import { CapabilityOrchestrator } from './capability-orchestrator.js';

// ============================================================================
// Playwright Test Fixtures with Capability Support
// ============================================================================

type CapabilityFixtures = {
  // Project-level capabilities (set in playwright.config.ts)
  projectCapabilities: string[];
  // Test-level capabilities (from @requires annotations)
  testCapabilities: string[];
  // Preprocessor instance
  preprocessor: TestPreprocessor;
};

export const test = base.extend<CapabilityFixtures>({
  // Project capabilities from config
  projectCapabilities: [[], { option: true }],

  // Test capabilities parsed from test file
  testCapabilities: async ({}, use, testInfo) => {
    const testFilePath = testInfo.file;
    const testContent = await fs.readFile(testFilePath, 'utf-8');
    const requirements = parseTestRequirements(testContent);
    await use(requirements.capabilities);
  },

  // Preprocessor instance
  preprocessor: async ({}, use) => {
    const config: PreprocessorConfig = {
      capabilities: BETRACE_CAPABILITIES,
      failFast: true,
      parallel: true,
    };
    const preprocessor = new TestPreprocessor(config);
    await use(preprocessor);
  },
});

export { expect };

// ============================================================================
// Global Setup - Validate Capabilities Before Any Tests Run
// ============================================================================

async function globalSetup() {
  // Skip global setup if running via Nix orchestration (services already started)
  if (process.env.SKIP_GLOBAL_SETUP === '1') {
    console.log('\n⏩ Skipping global setup (services managed by Nix orchestration)\n');
    return;
  }

  console.log('\n🔍 BeTrace Test Preprocessor - Auto-Starting Capabilities\n');

  const orchestrator = new CapabilityOrchestrator();

  // Get all capability names
  const allCapabilities = Object.keys(BETRACE_CAPABILITIES);

  // Ensure all capabilities are available (auto-start if needed)
  const result = await orchestrator.ensureCapabilities(allCapabilities, {
    autoStart: true,
    startAll: true,
    verbose: true,
  });

  const totalCapabilities = allCapabilities.length;
  const availableCount = result.alreadyRunning.length + result.started.length;

  console.log('\n📊 Final Status:');
  console.log(`   ✅ Available: ${availableCount}/${totalCapabilities}`);
  console.log(`   🚀 Started: ${result.started.length}`);
  console.log(`   ⚡ Already Running: ${result.alreadyRunning.length}`);
  console.log(`   ❌ Failed: ${result.failed.length}`);

  // Write capability status to file
  const statusFile = path.join(__dirname, '../.capability-status.json');
  await fs.writeFile(
    statusFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        started: result.started,
        alreadyRunning: result.alreadyRunning,
        failed: result.failed,
        availableCount,
        totalCapabilities,
      },
      null,
      2
    )
  );

  console.log(`\n💾 Status written to: ${statusFile}\n`);

  // Fail global setup if any capabilities couldn't be started
  if (result.failed.length > 0) {
    throw new Error(
      `Failed to start ${result.failed.length} required capabilities:\n` +
        result.failed.map((f) => `  - ${f.service}: ${f.error}`).join('\n')
    );
  }
}

// ============================================================================
// Test-Level Capability Validation Hook
// ============================================================================

/**
 * Validate capabilities before test runs
 * Add this to test.beforeEach in test files that need specific capabilities
 */
export async function validateTestCapabilities(
  preprocessor: TestPreprocessor,
  projectCapabilities: string[],
  testCapabilities: string[]
) {
  const allCapabilities = [...new Set([...projectCapabilities, ...testCapabilities])];

  if (allCapabilities.length === 0) {
    // No capabilities required
    return { ready: true, failures: [] };
  }

  const requirements: TestRequirements = { capabilities: allCapabilities };
  const validation = await preprocessor.validateRequirements(requirements);

  if (!validation.ready) {
    // Log detailed error
    console.error('\n❌ Test Prerequisites Not Met:');
    validation.failures.forEach((f) => {
      console.error(`   - ${f.capability}: ${f.error}`);
    });
    console.error('');

    throw new Error(
      'Required capabilities not available:\n' +
        validation.failures.map((f) => `  - ${f.capability}: ${f.error}`).join('\n') +
        '\n\nPlease ensure all required services are running before executing tests.'
    );
  }

  return validation;
}

// ============================================================================
// CLI Helper - Check Capability Status
// ============================================================================

/**
 * Standalone script to check capability status
 * Run: npx ts-node tests/lib/playwright-capability-plugin.ts
 */
export async function checkCapabilities() {
  await globalSetup();
}

// Export as default for Playwright globalSetup
export default globalSetup;

// Allow running as standalone script
if (require.main === module) {
  checkCapabilities().catch((error) => {
    console.error('Error checking capabilities:', error);
    process.exit(1);
  });
}
