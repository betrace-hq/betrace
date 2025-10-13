# PRD-015i: Compliance Dashboard Mutation Testing

**Parent PRD:** PRD-015f (Compliance Evidence Dashboard)
**Priority:** P1
**Status:** Backlog
**Estimated Effort:** 2 days

## Context

QA expert review identified that while test coverage is high (93.73% instruction, 85.18% branch), mutation testing has not been performed. High coverage can be misleading if tests don't actually verify correctness.

## Problem Statement

**Current State:**
- 96 tests passing with 93.73% coverage
- Unknown mutation test score
- Tests may execute code without verifying behavior
- Unclear if tests catch logic errors

**Risk:**
- False confidence in test suite quality
- Bugs may slip through despite passing tests
- Refactoring could break functionality silently

## Requirements

### Functional Requirements

1. **Mutation Testing Setup**
   - Integrate Stryker mutation testing framework
   - Configure for TypeScript + React
   - Run mutation tests in CI pipeline

2. **Mutation Score Threshold**
   - Target: 80%+ mutation score
   - Block PRs below threshold
   - Report mutation survivors for investigation

3. **Incremental Mutation Testing**
   - Run only on changed files (fast feedback)
   - Full mutation run nightly
   - Track mutation score trends over time

### Non-Functional Requirements

- Mutation tests complete within 10 minutes
- Clear reports identifying weak tests
- Integration with existing test infrastructure

## Implementation

### 1. Install Stryker

**File:** `/Users/sscoble/Projects/fluo/bff/package.json`

```json
{
  "devDependencies": {
    "@stryker-mutator/core": "^8.0.0",
    "@stryker-mutator/typescript-checker": "^8.0.0",
    "@stryker-mutator/vitest-runner": "^8.0.0"
  },
  "scripts": {
    "test:mutation": "stryker run",
    "test:mutation:incremental": "stryker run --incremental"
  }
}
```

### 2. Stryker Configuration

**File:** `/Users/sscoble/Projects/fluo/bff/stryker.conf.json`

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "packageManager": "npm",
  "reporters": ["html", "clear-text", "progress", "dashboard"],
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "mutate": [
    "src/lib/**/*.ts",
    "src/lib/**/*.tsx",
    "src/routes/compliance/**/*.tsx",
    "!src/**/*.test.ts",
    "!src/**/*.test.tsx"
  ],
  "thresholds": {
    "high": 80,
    "low": 70,
    "break": 60
  },
  "incremental": true,
  "incrementalFile": ".stryker-tmp/incremental.json",
  "ignorePatterns": [
    "node_modules",
    "dist",
    "coverage",
    ".stryker-tmp"
  ],
  "vitest": {
    "configFile": "vitest.config.ts"
  }
}
```

### 3. Example Mutation Report

**Expected Output:**
```
Mutation score: 82.5% (target: 80%)

✅ Killed: 165 mutants
❌ Survived: 35 mutants
⏱️ Timeout: 2 mutants
🎯 NoCoverage: 8 mutants

Survived Mutants (investigate these):

1. src/lib/utils/validation.ts:42:5
   - Mutator: ConditionalExpression
   - Original: if (date > maxDate)
   - Mutated:  if (date >= maxDate)
   - Survived: Test didn't catch boundary condition

2. src/lib/hooks/useDebounce.ts:15:3
   - Mutator: ArithmeticOperator
   - Original: delay - 1
   - Mutated:  delay + 1
   - Survived: Test uses exact delay value
```

### 4. Fix Weak Tests

Based on mutation survivors, improve tests:

**Example Fix for Validation Boundary:**

```typescript
// BEFORE: Test didn't catch boundary bug
describe('validateDateRange', () => {
  it('should reject date > max', () => {
    expect(() => validateDateRange('2025-12-31', '2026-01-01')).toThrow();
  });
});

// AFTER: Test catches boundary condition
describe('validateDateRange', () => {
  it('should reject date > max (91 days)', () => {
    const start = '2025-01-01';
    const end = '2025-04-02'; // 91 days (exceeds 90 day limit)
    expect(() => validateDateRange(start, end)).toThrow('exceeds maximum');
  });

  it('should accept date = max (90 days)', () => {
    const start = '2025-01-01';
    const end = '2025-04-01'; // Exactly 90 days (should pass)
    expect(() => validateDateRange(start, end)).not.toThrow();
  });

  it('should accept date < max (89 days)', () => {
    const start = '2025-01-01';
    const end = '2025-03-31'; // 89 days (should pass)
    expect(() => validateDateRange(start, end)).not.toThrow();
  });
});
```

### 5. CI Integration

**File:** `.github/workflows/test.yml`

```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage

  mutation-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Needed for incremental mode
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:mutation:incremental
      - name: Upload mutation report
        uses: actions/upload-artifact@v4
        with:
          name: mutation-report
          path: reports/mutation/html
      - name: Check mutation threshold
        run: |
          SCORE=$(jq '.mutationScore' reports/mutation/mutation.json)
          if (( $(echo "$SCORE < 80" | bc -l) )); then
            echo "Mutation score $SCORE below threshold 80%"
            exit 1
          fi
```

## Testing Requirements

### Initial Mutation Test Run

1. Run mutation tests on compliance module
2. Document baseline mutation score
3. Identify top 10 mutation survivors
4. Create tickets to improve weak tests

### Continuous Monitoring

1. Track mutation score trend over time
2. Alert on score degradation
3. Require mutation score maintenance in PRs

## Success Criteria

- [ ] Stryker integrated and running in CI
- [ ] Baseline mutation score documented
- [ ] Mutation score ≥ 80% target
- [ ] Weak tests identified and improved
- [ ] CI blocks PRs below threshold
- [ ] Mutation reports accessible to team

## Out of Scope

- Mutation testing for non-compliance modules (separate effort)
- Performance optimization of mutation tests
- Custom mutators beyond Stryker defaults

## Dependencies

- Vitest test runner (already installed)
- CI/CD pipeline access
- Team agreement on mutation score threshold

## Timeline

**Week 1:**
- Day 1: Install and configure Stryker
- Day 2: Run initial mutation tests, analyze results
- Day 3: Fix top 10 mutation survivors
- Day 4: Integrate into CI pipeline
- Day 5: Documentation and team training

## Acceptance Criteria

1. Mutation testing runs successfully in CI
2. Mutation score meets 80% threshold
3. Reports clearly show mutation survivors
4. Team understands how to interpret results
5. Process documented for future PRs
6. No false positives blocking valid code

## Expected Outcomes

**Before Mutation Testing:**
- 93.73% code coverage
- Unknown test quality
- Hidden weak tests

**After Mutation Testing:**
- 93.73% code coverage (unchanged)
- 80%+ mutation score (proves test quality)
- Confidence in refactoring safety
- Fewer bugs in production
