/**
 * Coverage Reporter
 *
 * Generates human-readable coverage reports
 */

import type { CoverageReport } from './coverage-collector';
import { globalCoverageCollector } from './coverage-collector';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// HTML Report Generator
// ============================================================================

export function generateHtmlReport(report: CoverageReport): string {
  const timestamp = new Date(report.timestamp).toLocaleString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeTrace Coverage Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #333; margin-bottom: 10px; }
    .timestamp { color: #666; font-size: 14px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .metric {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
    .metric .value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
    .metric .percent { font-size: 18px; color: #666; }
    .metric.excellent .value { color: #22c55e; }
    .metric.good .value { color: #3b82f6; }
    .metric.fair .value { color: #f59e0b; }
    .metric.poor .value { color: #ef4444; }
    .section {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 { color: #333; margin-bottom: 20px; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e5e5; }
    th { background: #f9fafb; font-weight: 600; color: #666; }
    tr:hover { background: #f9fafb; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge.covered { background: #dcfce7; color: #16a34a; }
    .badge.untested { background: #fee2e2; color: #dc2626; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
    .progress-bar {
      background: #e5e5e5;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 5px;
    }
    .progress-fill {
      height: 100%;
      transition: width 0.3s ease;
    }
    .progress-fill.excellent { background: #22c55e; }
    .progress-fill.good { background: #3b82f6; }
    .progress-fill.fair { background: #f59e0b; }
    .progress-fill.poor { background: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 BeTrace Coverage Report</h1>
      <div class="timestamp">Generated: ${timestamp}</div>
    </div>

    <div class="summary">
      <div class="metric ${getCoverageClass(report.summary.useCasesCoveragePercent)}">
        <h3>USE CASES</h3>
        <div class="value">${report.summary.useCasesCovered}/${report.summary.useCasesTotal}</div>
        <div class="percent">${report.summary.useCasesCoveragePercent.toFixed(1)}% covered</div>
        <div class="progress-bar">
          <div class="progress-fill ${getCoverageClass(report.summary.useCasesCoveragePercent)}"
               style="width: ${report.summary.useCasesCoveragePercent}%"></div>
        </div>
      </div>

      <div class="metric ${getCoverageClass(report.summary.featuresCoveragePercent)}">
        <h3>FEATURES</h3>
        <div class="value">${report.summary.featuresCovered}/${report.summary.featuresTotal}</div>
        <div class="percent">${report.summary.featuresCoveragePercent.toFixed(1)}% covered</div>
        <div class="progress-bar">
          <div class="progress-fill ${getCoverageClass(report.summary.featuresCoveragePercent)}"
               style="width: ${report.summary.featuresCoveragePercent}%"></div>
        </div>
      </div>

      <div class="metric ${getCoverageClass(report.summary.apiRoutesCoveragePercent)}">
        <h3>API ROUTES</h3>
        <div class="value">${report.summary.apiRoutesCovered}/${report.summary.apiRoutesTotal}</div>
        <div class="percent">${report.summary.apiRoutesCoveragePercent.toFixed(1)}% covered</div>
        <div class="progress-bar">
          <div class="progress-fill ${getCoverageClass(report.summary.apiRoutesCoveragePercent)}"
               style="width: ${report.summary.apiRoutesCoveragePercent}%"></div>
        </div>
      </div>

      <div class="metric ${getCoverageClass(report.summary.locCoveragePercent)}">
        <h3>LINES OF CODE</h3>
        <div class="value">${report.loc.summary.totalLinesCovered}/${report.loc.summary.totalLines}</div>
        <div class="percent">${report.summary.locCoveragePercent.toFixed(1)}% covered</div>
        <div class="progress-bar">
          <div class="progress-fill ${getCoverageClass(report.summary.locCoveragePercent)}"
               style="width: ${report.summary.locCoveragePercent}%"></div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>📋 Use Cases</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Description</th>
            <th>Tested By</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(report.useCases).map(uc => `
            <tr>
              <td><code>${uc.id}</code></td>
              <td>${uc.name}</td>
              <td>${uc.description}</td>
              <td>${uc.testedBy.join(', ')}</td>
              <td><span class="badge ${uc.covered ? 'covered' : 'untested'}">${uc.covered ? 'COVERED' : 'UNTESTED'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>⚡ Features</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Component</th>
            <th>Interactions</th>
            <th>Tested By</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(report.features).map(f => `
            <tr>
              <td><code>${f.id}</code></td>
              <td>${f.name}</td>
              <td>${f.component || '-'}</td>
              <td>${f.interactions.join(', ') || '-'}</td>
              <td>${f.testedBy.join(', ')}</td>
              <td><span class="badge ${f.covered ? 'covered' : 'untested'}">${f.covered ? 'COVERED' : 'UNTESTED'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>🌐 API Routes</h2>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Status Codes</th>
            <th>Requests</th>
            <th>Tested By</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(report.apiRoutes).map(r => `
            <tr>
              <td><code>${r.method}</code></td>
              <td><code>${r.path}</code></td>
              <td>${r.statusCodes.join(', ')}</td>
              <td>${r.requestCount}</td>
              <td>${r.testedBy.join(', ')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>📄 Lines of Code Coverage</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Lines</th>
            <th>Covered</th>
            <th>Coverage</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(report.loc.files)
            .sort((a, b) => b.percentageCovered - a.percentageCovered)
            .map(f => `
            <tr>
              <td><code>${f.path}</code></td>
              <td>${f.lines}</td>
              <td>${f.linesCovered}</td>
              <td>
                ${f.percentageCovered.toFixed(1)}%
                <div class="progress-bar">
                  <div class="progress-fill ${getCoverageClass(f.percentageCovered)}"
                       style="width: ${f.percentageCovered}%"></div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function getCoverageClass(percent: number): string {
  if (percent >= 80) return 'excellent';
  if (percent >= 60) return 'good';
  if (percent >= 40) return 'fair';
  return 'poor';
}

// ============================================================================
// Markdown Report Generator
// ============================================================================

export function generateMarkdownReport(report: CoverageReport): string {
  const timestamp = new Date(report.timestamp).toLocaleString();

  return `# BeTrace Coverage Report

**Generated:** ${timestamp}

## Summary

| Metric | Coverage | Covered/Total |
|--------|----------|---------------|
| **Use Cases** | ${report.summary.useCasesCoveragePercent.toFixed(1)}% | ${report.summary.useCasesCovered}/${report.summary.useCasesTotal} |
| **Features** | ${report.summary.featuresCoveragePercent.toFixed(1)}% | ${report.summary.featuresCovered}/${report.summary.featuresTotal} |
| **API Routes** | ${report.summary.apiRoutesCoveragePercent.toFixed(1)}% | ${report.summary.apiRoutesCovered}/${report.summary.apiRoutesTotal} |
| **Lines of Code** | ${report.summary.locCoveragePercent.toFixed(1)}% | ${report.loc.summary.totalLinesCovered}/${report.loc.summary.totalLines} |

## Use Cases

| ID | Name | Description | Tested By | Status |
|----|------|-------------|-----------|--------|
${Object.values(report.useCases).map(uc =>
  `| \`${uc.id}\` | ${uc.name} | ${uc.description} | ${uc.testedBy.join(', ')} | ${uc.covered ? '✅' : '❌'} |`
).join('\n')}

## Features

| ID | Name | Component | Interactions | Tested By | Status |
|----|------|-----------|--------------|-----------|--------|
${Object.values(report.features).map(f =>
  `| \`${f.id}\` | ${f.name} | ${f.component || '-'} | ${f.interactions.join(', ') || '-'} | ${f.testedBy.join(', ')} | ${f.covered ? '✅' : '❌'} |`
).join('\n')}

## API Routes

| Method | Path | Status Codes | Requests | Tested By |
|--------|------|--------------|----------|-----------|
${Object.values(report.apiRoutes).map(r =>
  `| \`${r.method}\` | \`${r.path}\` | ${r.statusCodes.join(', ')} | ${r.requestCount} | ${r.testedBy.join(', ')} |`
).join('\n')}

## Lines of Code Coverage

Top covered files:

| File | Lines | Covered | Coverage |
|------|-------|---------|----------|
${Object.values(report.loc.files)
  .sort((a, b) => b.percentageCovered - a.percentageCovered)
  .slice(0, 20)
  .map(f => `| \`${f.path}\` | ${f.lines} | ${f.linesCovered} | ${f.percentageCovered.toFixed(1)}% |`)
  .join('\n')}
`;
}

// ============================================================================
// Report Saver
// ============================================================================

export function saveReports(outputDir: string = 'coverage-reports'): string[] {
  const report = globalCoverageCollector.generateReport();
  const paths: string[] = [];

  try {
    mkdirSync(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save JSON report
    const jsonPath = join(outputDir, `coverage-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    paths.push(jsonPath);

    // Save HTML report
    const htmlPath = join(outputDir, `coverage-${timestamp}.html`);
    writeFileSync(htmlPath, generateHtmlReport(report));
    paths.push(htmlPath);

    // Save Markdown report
    const mdPath = join(outputDir, `coverage-${timestamp}.md`);
    writeFileSync(mdPath, generateMarkdownReport(report));
    paths.push(mdPath);

    // Save latest versions
    writeFileSync(join(outputDir, 'coverage-latest.json'), JSON.stringify(report, null, 2));
    writeFileSync(join(outputDir, 'coverage-latest.html'), generateHtmlReport(report));
    writeFileSync(join(outputDir, 'coverage-latest.md'), generateMarkdownReport(report));

    console.log(`\n📊 Coverage Reports Generated:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   HTML: ${htmlPath}`);
    console.log(`   MD:   ${mdPath}`);
    console.log(`\n📈 Summary:`);
    console.log(`   Use Cases:  ${report.summary.useCasesCovered}/${report.summary.useCasesTotal} (${report.summary.useCasesCoveragePercent.toFixed(1)}%)`);
    console.log(`   Features:   ${report.summary.featuresCovered}/${report.summary.featuresTotal} (${report.summary.featuresCoveragePercent.toFixed(1)}%)`);
    console.log(`   API Routes: ${report.summary.apiRoutesCovered}/${report.summary.apiRoutesTotal} (${report.summary.apiRoutesCoveragePercent.toFixed(1)}%)`);
    console.log(`   LoC:        ${report.summary.locCoveragePercent.toFixed(1)}%\n`);

    return paths;
  } catch (error) {
    console.error('[Coverage] Failed to save reports:', error);
    throw error;
  }
}
