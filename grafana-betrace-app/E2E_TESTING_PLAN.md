# BeTrace Grafana Plugin - E2E Testing Plan

## Overview

End-to-end testing strategy for BeTrace Grafana plugin using Playwright. Tests verify complete user workflows from plugin installation to feature usage.

**Goal**: Ensure plugin works correctly across Grafana versions 9.x, 10.x, 11.x

---

## Test Infrastructure

### Technology Stack
- **Framework**: Playwright
- **Language**: TypeScript
- **Target**: Grafana App Plugin (betrace-app)
- **Backend**: Mock backend service (or real backend for integration tests)

### Test Environments

1. **Grafana 9.x**: Minimum supported version
2. **Grafana 10.x**: Current stable
3. **Grafana 11.x**: Latest version

---

## Test Scenarios

### Category 1: Plugin Installation & Configuration ✅

#### Test 1.1: Plugin Loads Successfully
**Priority**: P0 (blocker)

**Steps**:
1. Start Grafana with plugin installed
2. Navigate to Administration → Plugins
3. Search for "BeTrace"
4. Verify plugin appears with correct metadata
5. Verify plugin status is "Installed"

**Expected**:
- Plugin appears in plugin list
- Name: "BeTrace"
- Type: "App"
- Status: "Installed" or "Enabled"

**Assertions**:
```typescript
await expect(page.getByText('BeTrace')).toBeVisible();
await expect(page.getByText('Installed')).toBeVisible();
```

---

#### Test 1.2: Plugin Enables Without Errors
**Priority**: P0 (blocker)

**Steps**:
1. Navigate to BeTrace plugin page
2. Click "Enable" button (if not enabled)
3. Wait for confirmation
4. Check Grafana logs for errors

**Expected**:
- Plugin enables successfully
- "Enable" button changes to "Disable"
- No errors in console/logs

**Assertions**:
```typescript
await page.getByRole('button', { name: 'Enable' }).click();
await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible();
```

---

#### Test 1.3: Plugin Configuration Page Loads
**Priority**: P0 (blocker)

**Steps**:
1. Navigate to BeTrace plugin configuration
2. Verify all configuration fields present
3. Enter backend URL
4. Save configuration
5. Verify settings persisted

**Expected**:
- Configuration page loads
- Fields: Backend URL, API Key (optional)
- Save button functional
- Settings persist after reload

**Assertions**:
```typescript
await page.fill('[name="backendUrl"]', 'http://localhost:12011');
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByText('Settings saved')).toBeVisible();
```

---

### Category 2: Rules Management 🔴

#### Test 2.1: Rules Page Loads
**Priority**: P0 (blocker)

**Steps**:
1. Click BeTrace in sidebar
2. Navigate to Rules page
3. Verify rules list loads

**Expected**:
- Rules page displays
- Table headers: Name, Expression, Status, Actions
- "Create Rule" button visible

**Assertions**:
```typescript
await page.goto('http://localhost:3000/a/betrace-app/rules');
await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
await expect(page.getByRole('button', { name: 'Create Rule' })).toBeVisible();
```

---

#### Test 2.2: Create Rule - Happy Path
**Priority**: P0 (blocker)

**Steps**:
1. Click "Create Rule" button
2. Fill in form:
   - Name: "Test Rule"
   - Description: "E2E test rule"
   - Expression: `span.duration > 1000000000`
   - Severity: HIGH
   - Enabled: true
3. Click "Create"
4. Verify rule appears in list

**Expected**:
- Form opens
- All fields functional
- Monaco editor loads for expression
- Rule created successfully
- Rule appears in list with correct data

**Assertions**:
```typescript
await page.getByRole('button', { name: 'Create Rule' }).click();
await page.fill('[name="name"]', 'Test Rule');
await page.fill('[name="description"]', 'E2E test rule');

// Monaco editor
await page.locator('.monaco-editor').click();
await page.keyboard.type('span.duration > 1000000000');

await page.selectOption('[name="severity"]', 'HIGH');
await page.getByRole('button', { name: 'Create' }).click();

await expect(page.getByText('Test Rule')).toBeVisible();
```

---

#### Test 2.3: Create Rule - Validation Errors
**Priority**: P1 (important)

**Steps**:
1. Click "Create Rule"
2. Leave name empty
3. Click "Create"
4. Verify error message

**Expected**:
- Form shows validation error
- Error: "Name is required"
- Form does not submit

**Assertions**:
```typescript
await page.getByRole('button', { name: 'Create Rule' }).click();
await page.getByRole('button', { name: 'Create' }).click();
await expect(page.getByText('Name is required')).toBeVisible();
```

---

#### Test 2.4: Create Rule - Invalid DSL Expression
**Priority**: P1 (important)

**Steps**:
1. Click "Create Rule"
2. Fill name: "Invalid Rule"
3. Enter invalid expression: `span.duration >`
4. Click "Create"
5. Verify error message

**Expected**:
- Backend returns validation error
- Error message shows: "Invalid expression syntax"
- Rule not created

**Assertions**:
```typescript
await page.getByRole('button', { name: 'Create Rule' }).click();
await page.fill('[name="name"]', 'Invalid Rule');
await page.locator('.monaco-editor').click();
await page.keyboard.type('span.duration >');
await page.getByRole('button', { name: 'Create' }).click();
await expect(page.getByText(/syntax error/i)).toBeVisible();
```

---

#### Test 2.5: Edit Rule
**Priority**: P1 (important)

**Steps**:
1. Create test rule
2. Click "Edit" button for rule
3. Change name to "Updated Rule"
4. Change expression
5. Click "Save"
6. Verify changes persisted

**Expected**:
- Edit form opens with current data
- Fields are editable
- Changes save successfully
- Updated data appears in list

**Assertions**:
```typescript
await page.getByRole('button', { name: 'Edit' }).first().click();
await page.fill('[name="name"]', 'Updated Rule');
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByText('Updated Rule')).toBeVisible();
```

---

#### Test 2.6: Delete Rule
**Priority**: P1 (important)

**Steps**:
1. Create test rule
2. Click "Delete" button
3. Confirm deletion in modal
4. Verify rule removed from list

**Expected**:
- Confirmation modal appears
- Modal text: "Are you sure you want to delete this rule?"
- After confirmation, rule disappears
- Success message shown

**Assertions**:
```typescript
const ruleName = 'Rule to Delete';
await page.getByRole('button', { name: 'Delete' }).first().click();
await page.getByRole('button', { name: 'Confirm' }).click();
await expect(page.getByText(ruleName)).not.toBeVisible();
await expect(page.getByText('Rule deleted successfully')).toBeVisible();
```

---

#### Test 2.7: Enable/Disable Rule
**Priority**: P1 (important)

**Steps**:
1. Create enabled rule
2. Click "Disable" toggle
3. Verify status changes to "Disabled"
4. Click "Enable" toggle
5. Verify status changes to "Enabled"

**Expected**:
- Toggle works immediately
- Status updates in UI
- Backend persists state

**Assertions**:
```typescript
await page.getByRole('switch', { name: 'Enable' }).first().click();
await expect(page.getByText('Disabled')).toBeVisible();

await page.getByRole('switch', { name: 'Enable' }).first().click();
await expect(page.getByText('Enabled')).toBeVisible();
```

---

#### Test 2.8: Filter Rules
**Priority**: P2 (nice to have)

**Steps**:
1. Create multiple rules with different severities
2. Use severity filter dropdown
3. Select "HIGH"
4. Verify only HIGH severity rules shown

**Expected**:
- Filter dropdown works
- Rules filtered correctly
- Filter persists on page reload (optional)

---

#### Test 2.9: Search Rules
**Priority**: P2 (nice to have)

**Steps**:
1. Create multiple rules
2. Enter search term in search box
3. Verify matching rules shown
4. Clear search
5. Verify all rules shown again

**Expected**:
- Search filters rules by name/description
- Search is case-insensitive
- Clear button works

---

### Category 3: Trace Drilldown 🔴

#### Test 3.1: Navigate to Trace Drilldown
**Priority**: P1 (important)

**Steps**:
1. Navigate to BeTrace app
2. Click "Trace Drilldown" in navigation
3. Verify page loads

**Expected**:
- Page loads without errors
- URL: `/a/betrace-app/trace-drilldown`
- Title: "Trace Drilldown" visible

**Assertions**:
```typescript
await page.goto('http://localhost:3000/a/betrace-app/trace-drilldown');
await expect(page.getByRole('heading', { name: 'Trace Drilldown' })).toBeVisible();
```

---

#### Test 3.2: Enter Trace ID
**Priority**: P1 (important)

**Steps**:
1. Navigate to Trace Drilldown page
2. Enter valid trace ID
3. Click "Load Trace"
4. Verify trace data loads

**Expected**:
- Input field accepts trace ID
- Button triggers load
- Trace data displays (if backend connected)
- Error message if trace not found

**Assertions**:
```typescript
await page.fill('[name="traceId"]', '1234567890abcdef');
await page.getByRole('button', { name: 'Load Trace' }).click();
await expect(page.getByText('Trace ID: 1234567890abcdef')).toBeVisible();
```

---

#### Test 3.3: Tempo Deep Link (if integrated)
**Priority**: P2 (nice to have)

**Steps**:
1. Load a trace
2. Click "View in Tempo" button
3. Verify Tempo opens in new tab

**Expected**:
- Button visible
- New tab opens
- Tempo URL correct: `/explore?datasource=Tempo&query=<trace_id>`

---

### Category 4: Backend Integration 🔴

#### Test 4.1: Backend Connection - Success
**Priority**: P0 (blocker)

**Steps**:
1. Start backend on localhost:12011
2. Configure plugin with backend URL
3. Verify connection status shows "Connected"
4. Load rules list
5. Verify rules load from backend

**Expected**:
- Connection status indicator shows green
- Rules load successfully
- No connection errors

---

#### Test 4.2: Backend Connection - Failure
**Priority**: P1 (important)

**Steps**:
1. Configure plugin with invalid backend URL
2. Try to load rules
3. Verify error message displayed

**Expected**:
- Error message: "Failed to connect to backend"
- Retry button visible
- Rules list shows empty state with error

**Assertions**:
```typescript
await expect(page.getByText('Failed to connect to backend')).toBeVisible();
await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
```

---

#### Test 4.3: Backend Connection - Retry
**Priority**: P1 (important)

**Steps**:
1. Start with backend down
2. Wait for error
3. Start backend
4. Click "Retry" button
5. Verify connection successful

**Expected**:
- Retry button functional
- Connection re-established
- Data loads successfully

---

### Category 5: Monaco Editor Integration 🟡

#### Test 5.1: Monaco Loads in Rule Form
**Priority**: P1 (important)

**Steps**:
1. Open create rule form
2. Verify Monaco editor loads
3. Type expression
4. Verify syntax highlighting works

**Expected**:
- Monaco editor visible
- Syntax highlighting for BeTraceDSL
- Auto-completion works (if implemented)

**Assertions**:
```typescript
await expect(page.locator('.monaco-editor')).toBeVisible();
await page.locator('.monaco-editor textarea').fill('span.duration > 1000');
```

---

#### Test 5.2: Monaco Validation (if implemented)
**Priority**: P2 (nice to have)

**Steps**:
1. Type invalid expression in Monaco
2. Verify error squiggles appear
3. Hover over error
4. Verify error message shown

**Expected**:
- Real-time syntax validation
- Error indicators visible
- Helpful error messages

---

### Category 6: Cross-Version Compatibility 🟢

#### Test 6.1: Grafana 9.x Compatibility
**Priority**: P0 (blocker)

**Steps**:
1. Install plugin in Grafana 9.5.0
2. Run all P0 tests
3. Verify all pass

**Expected**:
- Plugin loads without errors
- All core features work
- UI renders correctly

---

#### Test 6.2: Grafana 10.x Compatibility
**Priority**: P0 (blocker)

**Steps**:
1. Install plugin in Grafana 10.4.0
2. Run all P0 tests
3. Verify all pass

**Expected**:
- Plugin loads without errors
- All core features work
- UI renders correctly

---

#### Test 6.3: Grafana 11.x Compatibility
**Priority**: P0 (blocker)

**Steps**:
1. Install plugin in Grafana 11.0.0
2. Run all P0 tests
3. Verify all pass

**Expected**:
- Plugin loads without errors
- All core features work
- UI renders correctly

---

## Test Execution Strategy

### Phase 1: Core Functionality (P0 Tests)
**Target**: 1 day
**Tests**: 8 tests

1. Plugin loads
2. Plugin enables
3. Configuration page loads
4. Rules page loads
5. Create rule (happy path)
6. Edit rule
7. Delete rule
8. Backend connection

---

### Phase 2: Feature Completeness (P1 Tests)
**Target**: 1 day
**Tests**: 7 tests

1. Create rule validation
2. Invalid DSL expression
3. Enable/disable rule
4. Trace drilldown navigation
5. Backend connection failure
6. Backend connection retry
7. Monaco editor loads

---

### Phase 3: Edge Cases & Polish (P2 Tests)
**Target**: 0.5 days
**Tests**: 4 tests

1. Filter rules
2. Search rules
3. Tempo deep link
4. Monaco validation

---

### Phase 4: Cross-Version Testing
**Target**: 0.5 days
**Tests**: Run all P0/P1 tests across 3 Grafana versions

---

## Test Infrastructure Setup

### Mock Backend
```typescript
// tests/helpers/mock-backend.ts
import { MockBackend } from './MockBackend';

export const setupMockBackend = (port = 12011) => {
  const backend = new MockBackend(port);

  backend.on('GET', '/v1/rules', () => ({
    rules: [
      {
        id: 'rule-1',
        name: 'Test Rule',
        expression: 'span.duration > 1000',
        enabled: true,
        severity: 'HIGH',
      },
    ],
  }));

  backend.start();
  return backend;
};
```

---

### Test Fixtures
```typescript
// tests/fixtures/rules.ts
export const testRule = {
  name: 'E2E Test Rule',
  description: 'Created by E2E test',
  expression: 'span.duration > 1000000000',
  severity: 'HIGH',
  enabled: true,
};

export const invalidRule = {
  name: 'Invalid Rule',
  expression: 'span.duration >',
  severity: 'HIGH',
  enabled: true,
};
```

---

### Page Objects
```typescript
// tests/pages/RulesPage.ts
export class RulesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('http://localhost:3000/a/betrace-app/rules');
  }

  async clickCreateRule() {
    await this.page.getByRole('button', { name: 'Create Rule' }).click();
  }

  async fillRuleForm(rule: TestRule) {
    await this.page.fill('[name="name"]', rule.name);
    await this.page.fill('[name="description"]', rule.description);
    await this.page.locator('.monaco-editor').click();
    await this.page.keyboard.type(rule.expression);
    await this.page.selectOption('[name="severity"]', rule.severity);
  }

  async submitRule() {
    await this.page.getByRole('button', { name: 'Create' }).click();
  }

  async verifyRuleInList(name: string) {
    await expect(this.page.getByText(name)).toBeVisible();
  }
}
```

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: E2E Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        grafana-version: ['9.5.0', '10.4.0', '11.0.0']

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd grafana-betrace-app
          npm ci

      - name: Build plugin
        run: |
          cd grafana-betrace-app
          npm run build

      - name: Start Grafana
        run: |
          docker run -d \
            -p 3000:3000 \
            -v $(pwd)/grafana-betrace-app/dist:/var/lib/grafana/plugins/betrace-app \
            -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=betrace-app" \
            grafana/grafana:${{ matrix.grafana-version }}

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: |
          cd grafana-betrace-app
          npm run test:integration

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-${{ matrix.grafana-version }}
          path: grafana-betrace-app/playwright-report/
```

---

## Success Criteria

### Definition of Done
- [x] All P0 tests implemented (8 tests)
- [ ] All P0 tests passing (0% → 100%)
- [ ] All P1 tests implemented (7 tests)
- [ ] All P1 tests passing
- [ ] Tests run in CI/CD
- [ ] Tests pass across Grafana 9.x, 10.x, 11.x
- [ ] Page objects created for maintainability
- [ ] Mock backend working
- [ ] Test documentation complete

### Coverage Goals
- **P0 Tests**: 100% passing (blocking)
- **P1 Tests**: 90% passing (important)
- **P2 Tests**: 70% passing (nice to have)

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Test plan creation | 1 hour | ✅ Complete |
| Mock backend setup | 2 hours | ⏸️ Pending |
| Page objects | 2 hours | ⏸️ Pending |
| Phase 1 (P0 tests) | 1 day | ⏸️ Pending |
| Phase 2 (P1 tests) | 1 day | ⏸️ Pending |
| Phase 3 (P2 tests) | 0.5 days | ⏸️ Pending |
| Phase 4 (cross-version) | 0.5 days | ⏸️ Pending |
| CI/CD integration | 2 hours | ⏸️ Pending |
| **Total** | **3-4 days** | **In Progress** |

---

## Next Steps

1. ✅ Create test plan (this document)
2. ⏭️ Set up mock backend
3. ⏭️ Create page objects
4. ⏭️ Implement P0 tests
5. ⏭️ Set up CI/CD
6. ⏭️ Implement P1/P2 tests

---

**Status**: Plan Complete
**Ready For**: Implementation
**Est. Completion**: 3-4 days
