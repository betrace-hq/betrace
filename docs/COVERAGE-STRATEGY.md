# BeTrace Generative Coverage Strategy

**Status:** ✅ Implemented and Working

## Executive Summary

Implemented a **zero-manual-effort coverage system** that automatically tracks:
- ✅ **Use Case Coverage** - Business scenarios tested
- ✅ **Feature Coverage** - UI/API features exercised
- ✅ **LoC Coverage** - Lines of code executed
- ✅ **API Route Coverage** - Backend endpoints called

**Key Innovation:** Coverage is **generative** - metrics are automatically extracted from test execution without manual tracking.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     PLAYWRIGHT TEST                          │
│                                                              │
│  test('...', async ({                                        │
│    coveragePage,     ← Enhanced page with auto-tracking     │
│    trackUseCase,     ← Optional: annotate use cases         │
│    trackFeature,     ← Optional: annotate features          │
│    request,          ← Standard Playwright request           │
│  }) => {                                                     │
│    trackUseCase('UC-001', 'List Rules', '...');             │
│    trackFeature('rules-api', 'Rules API', 'Backend');       │
│                                                              │
│    await request.get('/v1/rules');  ← AUTO-TRACKED          │
│  });                                                         │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│              COVERAGE FIXTURES (Automatic)                   │
│                                                              │
│  ✓ Page.on('request') → Track all API calls                 │
│  ✓ Page.coverage.startJSCoverage() → Track LoC              │
│  ✓ TestInfo → Track test file context                       │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│          GLOBAL COVERAGE COLLECTOR (Singleton)               │
│                                                              │
│  • useCases: Map<string, UseCaseCoverage>                    │
│  • features: Map<string, FeatureCoverage>                    │
│  • apiRoutes: Map<string, ApiRouteCoverage>                  │
│  • locCoverage: Array<JSCoverageEntry>                       │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼ (after all tests complete)
┌──────────────────────────────────────────────────────────────┐
│           GLOBAL TEARDOWN (Automatic)                        │
│                                                              │
│  • Generate JSON report (machine-readable)                   │
│  • Generate HTML report (interactive UI)                     │
│  • Generate Markdown report (PR comments)                    │
│  • Calculate summary metrics                                 │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                  COVERAGE REPORTS                            │
│                                                              │
│  coverage-reports/                                           │
│    ├── coverage-latest.json  ← Programmatic access          │
│    ├── coverage-latest.html  ← Visual dashboard             │
│    └── coverage-latest.md    ← CI/PR comments               │
└──────────────────────────────────────────────────────────────┘
```

## What Gets Tracked (Automatically)

### 1. API Route Coverage

**How:** Playwright request interceptor captures all HTTP requests

**Example:**
```typescript
// Test makes this call:
await request.get('http://localhost:12011/v1/rules');

// Automatically tracked:
{
  "GET /v1/rules": {
    "method": "GET",
    "path": "/v1/rules",
    "statusCodes": [200],
    "requestCount": 3,
    "testedBy": ["backend-api.spec.ts", "e2e-rules.spec.ts"]
  }
}
```

### 2. Lines of Code Coverage

**How:** Chrome DevTools Protocol JS coverage API

**Example:**
```typescript
// When page loads plugin code:
await page.goto('/a/betrace-app/rules');

// Automatically tracked:
{
  "src/pages/RulesPage.tsx": {
    "lines": 250,
    "linesCovered": 175,
    "percentageCovered": 70.0
  }
}
```

### 3. Use Case Coverage

**How:** Test annotations via `trackUseCase()` fixture

**Example:**
```typescript
test('list rules', async ({ trackUseCase }) => {
  trackUseCase('UC-RULES-001', 'List Rules', 'User can view all rules');
  // ...
});

// Tracked as:
{
  "UC-RULES-001": {
    "id": "UC-RULES-001",
    "name": "List Rules",
    "description": "User can view all rules",
    "testedBy": ["backend-api.spec.ts"],
    "covered": true
  }
}
```

### 4. Feature Coverage

**How:** Test annotations via `trackFeature()` fixture

**Example:**
```typescript
test('rules api', async ({ trackFeature, trackInteraction }) => {
  trackFeature('rules-api', 'Rules REST API', 'Backend');
  trackInteraction('rules-api', 'list');
  trackInteraction('rules-api', 'create');
  // ...
});

// Tracked as:
{
  "rules-api": {
    "id": "rules-api",
    "name": "Rules REST API",
    "component": "Backend",
    "interactions": ["list", "create"],
    "testedBy": ["backend-api.spec.ts"],
    "covered": true
  }
}
```

## Usage Example

```typescript
import { test, expect } from './lib/coverage-fixtures';

const BACKEND_URL = process.env.BETRACE_PORT_BACKEND
  ? `http://localhost:${process.env.BETRACE_PORT_BACKEND}`
  : 'http://localhost:12011';

test.describe('Backend API', () => {
  test('health check', async ({ request, trackFeature }) => {
    // Annotate feature (optional but recommended)
    trackFeature('backend-health', 'Health Check API', 'Backend');

    // Make API call - automatically tracked!
    const response = await request.get(`${BACKEND_URL}/health`);
    expect(response.status()).toBeLessThan(500);

    // Coverage collected:
    // ✓ API Route: GET /health
    // ✓ Feature: backend-health
    // ✓ Test file: backend-api.spec.ts
  });

  test('list rules', async ({ request, trackUseCase, trackFeature }) => {
    // Annotate use case and feature
    trackUseCase('UC-001', 'List Rules', 'User retrieves all rules');
    trackFeature('rules-list-api', 'Rules List Endpoint', 'Backend');

    // API call automatically tracked
    const response = await request.get(`${BACKEND_URL}/v1/rules`);
    const data = await response.json();

    expect(data).toHaveProperty('rules');

    // Coverage collected:
    // ✓ Use Case: UC-001 (List Rules)
    // ✓ Feature: rules-list-api
    // ✓ API Route: GET /v1/rules (status 200)
    // ✓ Request count: 1
  });
});
```

## Generated Reports

### JSON Report Structure

```json
{
  "timestamp": "2025-11-12T00:41:50.000Z",
  "summary": {
    "useCasesCovered": 5,
    "useCasesTotal": 10,
    "useCasesCoveragePercent": 50.0,
    "featuresCovered": 12,
    "featuresTotal": 20,
    "featuresCoveragePercent": 60.0,
    "apiRoutesCovered": 8,
    "apiRoutesTotal": 15,
    "apiRoutesCoveragePercent": 53.3,
    "locCoveragePercent": 45.2
  },
  "useCases": { /* ... */ },
  "features": { /* ... */ },
  "apiRoutes": { /* ... */ },
  "loc": { /* ... */ }
}
```

### HTML Report

Interactive dashboard with:
- Summary metrics (4 tiles with color-coded progress bars)
- Use Cases table (sortable, filterable)
- Features table (with interactions)
- API Routes table (method, path, status codes, request count)
- LoC Coverage table (file-by-file breakdown)

### Markdown Report

CI-friendly format for PR comments:

```markdown
# BeTrace Coverage Report

## Summary

| Metric | Coverage | Covered/Total |
|--------|----------|---------------|
| Use Cases | 50.0% | 5/10 |
| Features | 60.0% | 12/20 |
| API Routes | 53.3% | 8/15 |
| LoC | 45.2% | 2260/5000 |

## Use Cases
[table of covered/uncovered use cases]

## Features
[table of covered/uncovered features]

## API Routes
[table of tested routes with status codes]
```

## Integration Points

### 1. Test Execution

```bash
# Local development
npm test

# Nix orchestration (with service management)
nix run .#test-backend-api

# CI/CD
npm run test:ci
```

### 2. Report Generation

Automatic via `globalTeardown` in `playwright.config.ts`:

```typescript
export default defineConfig({
  globalTeardown: require.resolve('./tests/lib/coverage-teardown'),
  // ...
});
```

### 3. CI Integration

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test

- name: Upload coverage
  uses: actions/upload-artifact@v3
  with:
    name: coverage-reports
    path: coverage-reports/

- name: Comment PR
  run: |
    cat coverage-reports/coverage-latest.md >> $GITHUB_STEP_SUMMARY
```

## Coverage Metrics Definitions

### Use Case Coverage

**Definition:** Business scenarios that have test coverage

**Calculation:**
```
covered use cases / total use cases * 100
```

**Target:** 80%+ (ensures core business value is tested)

### Feature Coverage

**Definition:** Technical features that have test coverage

**Calculation:**
```
covered features / total features * 100
```

**Target:** 70%+ (ensures technical capabilities are tested)

### API Route Coverage

**Definition:** Backend endpoints that have been called during tests

**Calculation:**
```
routes with requests / total routes * 100
```

**Target:** 90%+ (ensures all endpoints are exercised)

### LoC Coverage

**Definition:** Lines of JavaScript code executed during tests

**Calculation:**
```
executed lines / total lines * 100
```

**Target:** 60%+ for critical paths, 40%+ overall

## Benefits

### 1. Zero Manual Effort

✅ **No manual tracking** - All coverage automatically collected
✅ **No coverage database** - Data generated fresh each run
✅ **No configuration files** - Works out of the box

### 2. Comprehensive Metrics

✅ **Business coverage** - Use cases show value delivered
✅ **Technical coverage** - Features show capabilities tested
✅ **API coverage** - Routes show backend completeness
✅ **Code coverage** - LoC shows execution paths

### 3. CI/CD Ready

✅ **JSON for automation** - Machine-readable metrics
✅ **HTML for humans** - Visual dashboard
✅ **Markdown for PRs** - Inline comments

### 4. Progressive Enhancement

✅ **Works without annotations** - API and LoC tracked automatically
✅ **Better with annotations** - Use cases and features add context
✅ **Flexible granularity** - Choose what to track

## Implementation Status

| Component | Status | Files |
|-----------|--------|-------|
| **Coverage Collector** | ✅ Complete | `tests/lib/coverage-collector.ts` |
| **Coverage Fixtures** | ✅ Complete | `tests/lib/coverage-fixtures.ts` |
| **Coverage Reporter** | ✅ Complete | `tests/lib/coverage-reporter.ts` |
| **Global Teardown** | ✅ Complete | `tests/lib/coverage-teardown.ts` |
| **Playwright Config** | ✅ Integrated | `playwright.config.ts` |
| **Example Tests** | ✅ Complete | `tests/coverage-example.spec.ts` |
| **Documentation** | ✅ Complete | `tests/COVERAGE.md` |

## Next Steps

### 1. Add Coverage to Existing Tests

Update existing test files to use coverage fixtures:

```typescript
// Before
import { test, expect } from '@playwright/test';

// After
import { test, expect } from './lib/coverage-fixtures';
```

### 2. Add Use Case Annotations

Annotate business scenarios:

```typescript
test('create rule', async ({ trackUseCase, ... }) => {
  trackUseCase('UC-RULES-002', 'Create Rule', 'User creates validation rule');
  // ...
});
```

### 3. Add Feature Annotations

Annotate technical features:

```typescript
test('monaco editor', async ({ trackFeature, ... }) => {
  trackFeature('monaco-dsl', 'Monaco DSL Editor', 'RuleEditor');
  // ...
});
```

### 4. Set Coverage Gates

Add CI checks for minimum coverage:

```bash
#!/bin/bash
COVERAGE=$(jq '.summary.useCasesCoveragePercent' coverage-reports/coverage-latest.json)
if (( $(echo "$COVERAGE < 80" | bc -l) )); then
  echo "Use case coverage $COVERAGE% < 80%"
  exit 1
fi
```

## Files Created

```
grafana-betrace-app/
├── tests/
│   ├── lib/
│   │   ├── coverage-collector.ts       ← Core collector
│   │   ├── coverage-fixtures.ts        ← Playwright fixtures
│   │   ├── coverage-reporter.ts        ← Report generators
│   │   └── coverage-teardown.ts        ← Global teardown
│   ├── coverage-example.spec.ts        ← Usage example
│   ├── COVERAGE.md                     ← User documentation
│   └── backend-api.spec.ts             ← Updated to use coverage
├── playwright.config.ts                ← Updated with teardown
└── coverage-reports/                   ← Generated reports
    ├── coverage-latest.json
    ├── coverage-latest.html
    └── coverage-latest.md
```

## Conclusion

The generative coverage system provides **comprehensive, zero-effort coverage tracking** for BeTrace tests. It automatically captures API routes, LoC, and optionally tracks use cases and features through simple annotations.

**Key Value:**
- 📊 **Visibility** - Know what's tested
- 🎯 **Precision** - Track business value and technical coverage
- 🚀 **Automation** - No manual tracking required
- 📈 **CI Integration** - Ready for automated gates

**Status:** ✅ **Production Ready**
