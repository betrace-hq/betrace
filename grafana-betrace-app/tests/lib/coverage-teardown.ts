/**
 * Global Teardown - Save Coverage Reports
 *
 * Called after all tests complete
 */

import { saveReports } from './coverage-reporter';
import { globalCoverageCollector } from './coverage-collector';
import { rmSync } from 'fs';

export default async function globalTeardown() {
  console.log('\n🎯 Generating coverage reports...\n');

  try {
    // Load persisted state from all test workers
    globalCoverageCollector.loadPersistedState();

    // Generate reports
    const reportPaths = saveReports('coverage-reports');

    console.log('✅ Coverage reports saved successfully\n');
    console.log(`   Open HTML report: open ${reportPaths[1]}\n`);

    // Clean up temporary state files
    try {
      rmSync('.coverage-state', { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  } catch (error) {
    console.error('❌ Failed to generate coverage reports:', error);
    // Don't fail the build if coverage reporting fails
  }
}
