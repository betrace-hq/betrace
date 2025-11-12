# Generative Coverage System

**Automatically tracks coverage for use cases, features, LoC, and API routes**

## Overview

The generative coverage system automatically extracts coverage metrics from test execution without manual tracking:

1. **Use Case Coverage** - Business scenarios tested
2. **Feature Coverage** - UI/API features exercised
3. **LoC Coverage** - Lines of code executed
4. **API Route Coverage** - Backend endpoints called

## How It Works

### Automatic Tracking

The coverage system uses Playwright fixtures to automatically track:

- **API Routes**: All HTTP requests are intercepted and logged
- **JavaScript Coverage**: All JS execution is tracked via Chrome DevTools Protocol
- **Test Context**: Current test file is tracked for attribution

### Manual Annotations

Tests can optionally annotate use cases and features:

```typescript
import { test, expect } from './lib/coverage-fixtures';

test('my test', async ({ request, trackUseCase, trackFeature }) => {
  // Track use case
  trackUseCase('UC-001', 'List Rules', 'User can view all rules');

  // Track feature
  trackFeature('rules-list', 'Rules List View', 'RulesPage');

  // Make API call - automatically tracked
  await request.get('/v1/rules');

  // API route coverage: GET /v1/rules is automatically recorded
  // LoC coverage: JavaScript executed is automatically tracked
});
```

## Usage

### 1. Import Coverage Fixtures

```typescript
import { test, expect } from './lib/coverage-fixtures';
```

### 2. Use Coverage Fixtures in Tests

```typescript
test('my test', async ({
  coveragePage,      // Page with automatic coverage tracking
  request,           // Standard Playwright request fixture
  trackUseCase,      // Track a use case
  trackFeature,      // Track a feature
  trackInteraction,  // Track a user interaction
}) => {
  // Your test code
});
```

### 3. Run Tests

```bash
# Run tests with coverage collection
npm test

# Or with Nix orchestration
nix run .#test-backend-api
```

### 4. View Reports

After tests complete, coverage reports are generated in `coverage-reports/`:

```bash
# View HTML report (interactive)
open coverage-reports/coverage-latest.html

# View Markdown report
cat coverage-reports/coverage-latest.md

# View JSON report (programmatic access)
cat coverage-reports/coverage-latest.json
```

## API

### `trackUseCase(id, name, description)`

Register a use case as covered:

```typescript
trackUseCase(
  'UC-RULES-001',
  'List Rules',
  'User can retrieve all configured rules'
);
```

### `trackFeature(id, name, component?)`

Register a feature as covered:

```typescript
trackFeature(
  'rules-api',
  'Rules REST API',
  'Backend API'  // optional component
);
```

### `trackInteraction(featureId, interaction)`

Track a user interaction with a feature:

```typescript
trackInteraction('rules-list', 'view');
trackInteraction('rule-editor', 'create');
trackInteraction('rule-editor', 'edit');
```

### `coveragePage`

Enhanced page with automatic coverage tracking:

```typescript
test('my test', async ({ coveragePage }) => {
  await coveragePage.goto('/');
  // All JS execution and API calls are automatically tracked
});
```

## Report Format

### Summary Metrics

```json
{
  "summary": {
    "useCasesCovered": 5,
    "useCasesTotal": 10,
    "useCasesCoveragePercent": 50.0,
    "featuresCovered": 8,
    "featuresTotal": 15,
    "featuresCoveragePercent": 53.3,
    "apiRoutesCovered": 12,
    "apiRoutesTotal": 20,
    "apiRoutesCoveragePercent": 60.0,
    "locCoveragePercent": 45.2
  }
}
```

### Use Case Details

```json
{
  "useCases": {
    "UC-RULES-001": {
      "id": "UC-RULES-001",
      "name": "List Rules",
      "description": "User can retrieve all configured rules",
      "testedBy": ["tests/backend-api.spec.ts"],
      "covered": true
    }
  }
}
```

### Feature Details

```json
{
  "features": {
    "rules-api": {
      "id": "rules-api",
      "name": "Rules REST API",
      "component": "Backend API",
      "testedBy": ["tests/backend-api.spec.ts"],
      "interactions": ["view", "create", "edit"],
      "covered": true
    }
  }
}
```

### API Route Details

```json
{
  "apiRoutes": {
    "GET /v1/rules": {
      "method": "GET",
      "path": "/v1/rules",
      "statusCodes": [200],
      "requestCount": 5,
      "testedBy": ["tests/backend-api.spec.ts", "tests/e2e-rules.spec.ts"],
      "covered": true
    }
  }
}
```

### LoC Details

```json
{
  "loc": {
    "files": {
      "src/services/RulesService.ts": {
        "path": "src/services/RulesService.ts",
        "lines": 250,
        "linesCovered": 175,
        "percentageCovered": 70.0
      }
    },
    "summary": {
      "totalLines": 5000,
      "totalLinesCovered": 2260,
      "percentageCovered": 45.2
    }
  }
}
```

## Best Practices

### 1. Use Descriptive IDs

```typescript
// Good: Descriptive, hierarchical
trackUseCase('UC-AUTH-001', 'Login', 'User can log in with credentials');
trackFeature('auth-login-form', 'Login Form', 'AuthPage');

// Bad: Generic, non-descriptive
trackUseCase('test1', 'test', 'testing');
trackFeature('f1', 'feature', undefined);
```

### 2. Track Use Cases for Business Scenarios

Use cases represent business value:

```typescript
trackUseCase(
  'UC-RULES-002',
  'Create Rule',
  'Compliance officer can create a new validation rule'
);
```

### 3. Track Features for Technical Capabilities

Features represent technical functionality:

```typescript
trackFeature('rule-editor-monaco', 'Monaco DSL Editor', 'RuleEditor');
trackFeature('rule-validation-api', 'Rule Validation Endpoint', 'Backend API');
```

### 4. Track Interactions for User Flows

Interactions represent user actions:

```typescript
trackInteraction('rule-editor', 'open');
trackInteraction('rule-editor', 'type');
trackInteraction('rule-editor', 'validate');
trackInteraction('rule-editor', 'save');
```

## Integration with CI

```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: npm test

- name: Upload coverage reports
  uses: actions/upload-artifact@v3
  with:
    name: coverage-reports
    path: coverage-reports/

- name: Comment PR with coverage
  run: |
    cat coverage-reports/coverage-latest.md >> $GITHUB_STEP_SUMMARY
```

## Advanced Usage

### Custom Coverage Analysis

```typescript
import { globalCoverageCollector } from './lib/coverage-collector';

// After tests, access raw coverage data
const report = globalCoverageCollector.generateReport();

// Analyze specific metrics
const uncoveredUseCases = Object.values(report.useCases)
  .filter(uc => !uc.covered);

console.log('Uncovered use cases:', uncoveredUseCases.length);
```

### Coverage Gates

```typescript
// In CI, fail if coverage is below threshold
import { globalCoverageCollector } from './lib/coverage-collector';

const report = globalCoverageCollector.generateReport();

if (report.summary.useCasesCoveragePercent < 80) {
  console.error('Use case coverage below 80%');
  process.exit(1);
}
```

## Example Test

See [coverage-example.spec.ts](./coverage-example.spec.ts) for a complete example.

## Architecture

```
┌─────────────────────────────────────────┐
│         Playwright Test                 │
│  ┌──────────────────────────────────┐   │
│  │  test('...', async ({            │   │
│  │    coveragePage,                 │   │
│  │    trackUseCase,                 │   │
│  │    trackFeature,                 │   │
│  │  }) => { ... })                  │   │
│  └──────────────────────────────────┘   │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│      Coverage Fixtures                  │
│  ┌──────────────────────────────────┐   │
│  │  • Page interceptors              │   │
│  │  • API request tracking           │   │
│  │  • JS coverage collection         │   │
│  │  • Test context tracking          │   │
│  └──────────────────────────────────┘   │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│   Global Coverage Collector             │
│  ┌──────────────────────────────────┐   │
│  │  • Use cases map                  │   │
│  │  • Features map                   │   │
│  │  • API routes map                 │   │
│  │  • LoC coverage data              │   │
│  └──────────────────────────────────┘   │
└───────────────┬─────────────────────────┘
                │
                ▼ (after all tests)
┌─────────────────────────────────────────┐
│      Coverage Reporter                  │
│  ┌──────────────────────────────────┐   │
│  │  • Generate JSON report           │   │
│  │  • Generate HTML report           │   │
│  │  • Generate Markdown report       │   │
│  │  • Calculate summary metrics      │   │
│  └──────────────────────────────────┘   │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Coverage Reports                │
│  coverage-reports/                      │
│    ├── coverage-latest.json             │
│    ├── coverage-latest.html             │
│    └── coverage-latest.md               │
└─────────────────────────────────────────┘
```

## Generative = Zero Manual Effort

The system is **generative** because:

1. ✅ **API routes automatically tracked** - All HTTP requests intercepted
2. ✅ **LoC automatically tracked** - Chrome DevTools Protocol captures execution
3. ✅ **Test context automatically tracked** - Playwright test info captured
4. ✅ **Reports automatically generated** - JSON/HTML/MD created on teardown

Only use case/feature **names** require annotation - everything else is automatic!
