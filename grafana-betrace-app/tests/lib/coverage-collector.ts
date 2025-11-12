/**
 * Generative Coverage Collector
 *
 * Automatically generates coverage statistics for:
 * - Use Cases: Business scenarios tested
 * - Features: UI/API features exercised
 * - Lines of Code: Code execution coverage
 * - API Routes: Backend endpoints called
 *
 * Usage: Integrated automatically via Playwright fixtures
 */

import type { Page, Request } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface UseCaseCoverage {
  id: string;
  name: string;
  description: string;
  testedBy: string[];  // Test file paths
  covered: boolean;
}

export interface FeatureCoverage {
  id: string;
  name: string;
  component?: string;
  testedBy: string[];
  interactions: string[];  // User interactions performed
  covered: boolean;
}

export interface ApiRouteCoverage {
  method: string;
  path: string;
  statusCodes: number[];
  requestCount: number;
  testedBy: string[];
  covered: boolean;
}

export interface LocCoverage {
  files: Record<string, {
    path: string;
    lines: number;
    linesCovered: number;
    functions: number;
    functionsCovered: number;
    branches: number;
    branchesCovered: number;
    percentageCovered: number;
  }>;
  summary: {
    totalLines: number;
    totalLinesCovered: number;
    totalFunctions: number;
    totalFunctionsCovered: number;
    totalBranches: number;
    totalBranchesCovered: number;
    percentageCovered: number;
  };
}

export interface CoverageReport {
  timestamp: string;
  useCases: Record<string, UseCaseCoverage>;
  features: Record<string, FeatureCoverage>;
  apiRoutes: Record<string, ApiRouteCoverage>;
  loc: LocCoverage;
  summary: {
    useCasesCovered: number;
    useCasesTotal: number;
    useCasesCoveragePercent: number;
    featuresCovered: number;
    featuresTotal: number;
    featuresCoveragePercent: number;
    apiRoutesCovered: number;
    apiRoutesTotal: number;
    apiRoutesCoveragePercent: number;
    locCoveragePercent: number;
  };
}

// ============================================================================
// Coverage Collector
// ============================================================================

export class CoverageCollector {
  private useCases: Map<string, UseCaseCoverage> = new Map();
  private features: Map<string, FeatureCoverage> = new Map();
  private apiRoutes: Map<string, ApiRouteCoverage> = new Map();
  private locCoverage: any[] = [];
  private currentTestFile?: string;

  /**
   * Register a use case (called via test annotations)
   */
  registerUseCase(id: string, name: string, description: string, testFile: string) {
    const existing = this.useCases.get(id);
    if (existing) {
      if (!existing.testedBy.includes(testFile)) {
        existing.testedBy.push(testFile);
      }
      existing.covered = true;
    } else {
      this.useCases.set(id, {
        id,
        name,
        description,
        testedBy: [testFile],
        covered: true,
      });
    }
  }

  /**
   * Register a feature (called via test annotations or interactions)
   */
  registerFeature(id: string, name: string, component: string | undefined, testFile: string, interaction?: string) {
    const existing = this.features.get(id);
    if (existing) {
      if (!existing.testedBy.includes(testFile)) {
        existing.testedBy.push(testFile);
      }
      if (interaction && !existing.interactions.includes(interaction)) {
        existing.interactions.push(interaction);
      }
      existing.covered = true;
    } else {
      this.features.set(id, {
        id,
        name,
        component,
        testedBy: [testFile],
        interactions: interaction ? [interaction] : [],
        covered: true,
      });
    }
  }

  /**
   * Track API route call
   */
  trackApiRoute(method: string, url: string, statusCode: number, testFile: string) {
    // Extract path from URL (remove query params and host)
    const urlObj = new URL(url, 'http://localhost');
    const path = urlObj.pathname;
    const key = `${method.toUpperCase()} ${path}`;

    const existing = this.apiRoutes.get(key);
    if (existing) {
      existing.requestCount++;
      if (!existing.statusCodes.includes(statusCode)) {
        existing.statusCodes.push(statusCode);
      }
      if (!existing.testedBy.includes(testFile)) {
        existing.testedBy.push(testFile);
      }
    } else {
      this.apiRoutes.set(key, {
        method: method.toUpperCase(),
        path,
        statusCodes: [statusCode],
        requestCount: 1,
        testedBy: [testFile],
        covered: true,
      });
    }
  }

  /**
   * Set current test file context
   */
  setCurrentTestFile(testFile: string) {
    this.currentTestFile = testFile;
  }

  /**
   * Collect JavaScript coverage from page
   */
  async collectLocCoverage(page: Page) {
    try {
      const coverage = await page.coverage.stopJSCoverage();
      this.locCoverage.push(...coverage);
    } catch (error) {
      console.warn('[Coverage] Failed to collect LoC coverage:', error);
    }
  }

  /**
   * Process LoC coverage into summary
   */
  private processLocCoverage(): LocCoverage {
    const files: LocCoverage['files'] = {};
    const summary = {
      totalLines: 0,
      totalLinesCovered: 0,
      totalFunctions: 0,
      totalFunctionsCovered: 0,
      totalBranches: 0,
      totalBranchesCovered: 0,
      percentageCovered: 0,
    };

    for (const entry of this.locCoverage) {
      // Skip non-plugin files (node_modules, Grafana core, etc.)
      if (!entry.url.includes('betrace-app') || entry.url.includes('node_modules')) {
        continue;
      }

      const path = entry.url.replace(/^.*betrace-app\//, '');

      // Calculate coverage ranges
      let totalBytes = entry.text.length;
      let coveredBytes = 0;

      for (const range of entry.ranges) {
        coveredBytes += range.end - range.start;
      }

      const percentage = totalBytes > 0 ? (coveredBytes / totalBytes) * 100 : 0;

      files[path] = {
        path,
        lines: entry.text.split('\n').length,
        linesCovered: Math.round((entry.text.split('\n').length * percentage) / 100),
        functions: 0, // Requires additional parsing
        functionsCovered: 0,
        branches: 0,
        branchesCovered: 0,
        percentageCovered: percentage,
      };

      summary.totalLines += files[path].lines;
      summary.totalLinesCovered += files[path].linesCovered;
    }

    summary.percentageCovered = summary.totalLines > 0
      ? (summary.totalLinesCovered / summary.totalLines) * 100
      : 0;

    return { files, summary };
  }

  /**
   * Generate final coverage report
   */
  generateReport(): CoverageReport {
    const locCoverage = this.processLocCoverage();

    const useCasesArray = Array.from(this.useCases.values());
    const featuresArray = Array.from(this.features.values());
    const apiRoutesArray = Array.from(this.apiRoutes.values());

    const summary = {
      useCasesCovered: useCasesArray.filter(uc => uc.covered).length,
      useCasesTotal: useCasesArray.length,
      useCasesCoveragePercent: useCasesArray.length > 0
        ? (useCasesArray.filter(uc => uc.covered).length / useCasesArray.length) * 100
        : 0,
      featuresCovered: featuresArray.filter(f => f.covered).length,
      featuresTotal: featuresArray.length,
      featuresCoveragePercent: featuresArray.length > 0
        ? (featuresArray.filter(f => f.covered).length / featuresArray.length) * 100
        : 0,
      apiRoutesCovered: apiRoutesArray.filter(r => r.covered).length,
      apiRoutesTotal: apiRoutesArray.length,
      apiRoutesCoveragePercent: apiRoutesArray.length > 0
        ? (apiRoutesArray.filter(r => r.covered).length / apiRoutesArray.length) * 100
        : 0,
      locCoveragePercent: locCoverage.summary.percentageCovered,
    };

    return {
      timestamp: new Date().toISOString(),
      useCases: Object.fromEntries(this.useCases),
      features: Object.fromEntries(this.features),
      apiRoutes: Object.fromEntries(this.apiRoutes),
      loc: locCoverage,
      summary,
    };
  }

  /**
   * Save report to disk
   */
  saveReport(outputDir: string = 'coverage-reports') {
    const report = this.generateReport();

    try {
      mkdirSync(outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = join(outputDir, `coverage-${timestamp}.json`);

      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      // Also save as latest
      const latestPath = join(outputDir, 'coverage-latest.json');
      writeFileSync(latestPath, JSON.stringify(report, null, 2));

      console.log(`\n📊 Coverage Report Generated`);
      console.log(`   Location: ${reportPath}`);
      console.log(`   Summary:`);
      console.log(`     Use Cases:  ${report.summary.useCasesCovered}/${report.summary.useCasesTotal} (${report.summary.useCasesCoveragePercent.toFixed(1)}%)`);
      console.log(`     Features:   ${report.summary.featuresCovered}/${report.summary.featuresTotal} (${report.summary.featuresCoveragePercent.toFixed(1)}%)`);
      console.log(`     API Routes: ${report.summary.apiRoutesCovered}/${report.summary.apiRoutesTotal} (${report.summary.apiRoutesCoveragePercent.toFixed(1)}%)`);
      console.log(`     LoC:        ${report.summary.locCoveragePercent.toFixed(1)}%`);
      console.log('');

      return reportPath;
    } catch (error) {
      console.error('[Coverage] Failed to save report:', error);
      throw error;
    }
  }

  /**
   * Persist intermediate coverage data to disk (for cross-process sharing)
   */
  persistState(outputDir: string = '.coverage-state') {
    try {
      mkdirSync(outputDir, { recursive: true });

      const state = {
        useCases: Array.from(this.useCases.entries()),
        features: Array.from(this.features.entries()),
        apiRoutes: Array.from(this.apiRoutes.entries()),
        locCoverage: this.locCoverage,
      };

      const statePath = join(outputDir, `state-${process.pid}.json`);
      writeFileSync(statePath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('[Coverage] Failed to persist state:', error);
    }
  }

  /**
   * Load and merge persisted state from all workers
   */
  loadPersistedState(outputDir: string = '.coverage-state') {
    try {
      const { readdirSync, existsSync, readFileSync } = require('fs');

      if (!existsSync(outputDir)) {
        return;
      }

      const files = readdirSync(outputDir).filter((f: string) => f.startsWith('state-') && f.endsWith('.json'));

      for (const file of files) {
        const filePath = join(outputDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const state = JSON.parse(content);

        // Merge use cases
        for (const [id, uc] of state.useCases) {
          const existing = this.useCases.get(id);
          if (existing) {
            existing.testedBy = [...new Set([...existing.testedBy, ...uc.testedBy])];
          } else {
            this.useCases.set(id, uc);
          }
        }

        // Merge features
        for (const [id, f] of state.features) {
          const existing = this.features.get(id);
          if (existing) {
            existing.testedBy = [...new Set([...existing.testedBy, ...f.testedBy])];
            existing.interactions = [...new Set([...existing.interactions, ...f.interactions])];
          } else {
            this.features.set(id, f);
          }
        }

        // Merge API routes
        for (const [key, r] of state.apiRoutes) {
          const existing = this.apiRoutes.get(key);
          if (existing) {
            existing.requestCount += r.requestCount;
            existing.statusCodes = [...new Set([...existing.statusCodes, ...r.statusCodes])];
            existing.testedBy = [...new Set([...existing.testedBy, ...r.testedBy])];
          } else {
            this.apiRoutes.set(key, r);
          }
        }

        // Merge LoC coverage
        this.locCoverage.push(...state.locCoverage);
      }

      console.log(`[Coverage] Loaded state from ${files.length} worker(s)`);
    } catch (error) {
      console.error('[Coverage] Failed to load persisted state:', error);
    }
  }
}

// ============================================================================
// Global Collector Instance
// ============================================================================

export const globalCoverageCollector = new CoverageCollector();
