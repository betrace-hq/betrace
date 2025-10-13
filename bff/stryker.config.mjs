// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  _comment: "PRD-010c: Mutation testing for DSL parser security hardening",
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "vitest",

  // Target security-critical modules (testing sanitize.ts first)
  mutate: [
    "src/lib/validation/sanitize.ts",
  ],

  // Coverage thresholds (PRD-010c: >70% mutation score)
  thresholds: {
    high: 80,
    low: 70,
    break: 60,
  },

  // Performance settings
  timeoutMS: 60000,
  timeoutFactor: 2,
  concurrency: 4,

  // Exclude string literal mutations (error messages)
  mutator: {
    excludedMutations: ["StringLiteral"],
  },

  // HTML report
  htmlReporter: {
    fileName: "reports/mutation/mutation-report.html",
  },

  clearTextReporter: {
    allowColor: true,
    logTests: false,
    maxTestsToLog: 3,
  },

  // Vitest configuration with explicit test pattern
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
  },

  // Disable coverage analysis to avoid test discovery issues
  coverageAnalysis: "off",

  // Ignore patterns
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "result",
    ".stryker-tmp/**",
  ],
};

export default config;
