# PRD-014: Developer Rule Testing

**Priority:** P1 (User Workflow - Production Use)
**Complexity:** Medium (System)
**Type:** System Overview
**Personas:** Developer, SRE
**Dependencies:**
- PRD-009 (Trace Ingestion Pipeline)
- PRD-010 (Rule Management UI)
- PRD-002 (TigerBeetle Persistence)

## Architecture Integration

This PRD complies with FLUO's architectural standards:

- **ADR-011 (TigerBeetle-First):** Test execution results stored as TigerBeetle transfers (code=10)
- **ADR-013 (Camel-First):** Test execution implemented as Camel processors
- **ADR-014 (Named Processors):** All test logic in named CDI processors
- **ADR-015 (Tiered Storage):** Test results in TigerBeetle → DuckDB → Parquet for analytics
- **PRD-003 (Compliance Evidence):** Test executions generate SOC2 CC8.1 evidence (change management)

## Problem

**No way to test rules before deploying to production:**
- Developers write FLUO DSL rules blindly without validation
- No ability to test rules against sample traces
- Rules deployed to production may have false positives/negatives
- No feedback loop to refine rules iteratively
- No test history or regression testing

**Current State:**
- Rule editor exists (PRD-010) with syntax validation
- Real-time validation checks DSL syntax only
- No test execution environment
- No sample trace library
- No test result visualization

**Impact:**
- High false positive rate in production (wastes SRE time)
- Rules miss actual violations (false negatives)
- Developers cannot debug rule logic
- No confidence in rule accuracy before deploy
- No regression testing when rules change

## Solution

### Rule Testing Workflow

```
Developer writes rule in Monaco editor (PRD-010)
  ↓
[Upload sample trace JSON or select from library]
  ↓
[Click "Test Rule" button]
  ↓
Backend: Execute rule against sample trace
  ↓
Return test results:
  - Did rule fire? (signal generated)
  - Which spans matched?
  - Rule evaluation details (conditions met)
  - Performance metrics (execution time)
  ↓
Display results in UI with:
  - Pass/Fail indicator
  - Matched spans highlighted
  - Signal preview (if generated)
  - Performance metrics
  ↓
[Save test case for regression testing]
```

### Test Execution Architecture

**Test Trace Sources:**
1. **Upload JSON:** Developer provides OTLP trace JSON
2. **Library:** Pre-built sample traces (auth failure, PII leak, etc.)
3. **Production Copy:** Copy real trace from Signal detail (anonymized)

**Test Execution:**
```
POST /api/rules/test
  ↓
[validateTestRequestProcessor] → Validate rule DSL + trace JSON
  ↓
[parseTraceJsonProcessor] → Convert JSON to Span objects
  ↓
[executeRuleProcessor] → Run Drools rule against spans (isolated session)
  ↓
[recordTestResultProcessor] → TigerBeetle transfer (code=10)
  ↓
[generateComplianceSpanProcessor] → SOC2 CC8.1 evidence (change management)
  ↓
Return TestResultDto:
  - ruleFired: boolean
  - matchedSpans: List<SpanId>
  - signalGenerated: SignalDto | null
  - executionTimeMs: long
  - ruleDetails: Map<String, Object>
```

## Unit PRD References

This PRD has been decomposed into the following unit PRDs:

| PRD | Unit | Purpose | Dependencies | Lines |
|-----|------|---------|--------------|-------|
| 014a | RuleTestingService | Execute rules in isolated Drools session | PRD-009, PRD-005 | 297 |
| 014b | SampleTraceLibraryService | Manage sample trace library | PRD-002 | 263 |
| 014c | RecordTestExecutionProcessor | Record test results in TigerBeetle | PRD-002, PRD-014a | 271 |
| 014d | GenerateTestComplianceSpanProcessor | Generate SOC2 CC8.1 compliance spans | PRD-003, PRD-014c | 239 |
| 014e | RuleTestingPanel (React) | Test execution UI component | PRD-010, PRD-014a, PRD-014b | 289 |
| 014f | TestHistory (React) | Test history and regression testing UI | PRD-014c | 258 |

**Total:** 6 unit PRDs, 1,617 lines of implementation code

### TigerBeetle Schema (ADR-011)

**Test Execution Transfer (code=10):**
```java
Transfer testExecution = new Transfer(
    id: UUID (test execution ID),
    debitAccountId: userAccount,          // Developer who ran test
    creditAccountId: ruleAccount,         // Rule being tested
    amount: 1,  // Test count
    code: 10,  // Test execution type
    userData128: pack(
        rule_fired: 1 bit (did rule generate signal?),
        matched_span_count: 15 bits (how many spans matched),
        execution_time_ms: 32 bits,
        trace_source: 8 bits (1=upload, 2=library, 3=production_copy),
        test_passed: 1 bit (developer marked as passing),
        reserved: 71 bits
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

**Sample Trace Storage:**
```sql
-- DuckDB hot tier (not TigerBeetle - these are fixtures, not events)
CREATE TABLE sample_traces (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,  -- "Auth Failure - Invalid JWT"
    description TEXT,
    category VARCHAR(100),  -- "authentication", "pii", "compliance"
    trace_json JSONB NOT NULL,  -- OTLP trace
    expected_signals JSONB,  -- Expected rule matches
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_sample_traces_tenant ON sample_traces(tenant_id);
CREATE INDEX idx_sample_traces_category ON sample_traces(category);
```

### Data Flow Architecture

**Execute Test:**
```
POST /api/rules/test
{
  "ruleDsl": "detect pii_leak when has(span.attributes['pii']) and not has(span.attributes['redacted'])",
  "traceSource": "upload",
  "traceJson": { ... }  // OTLP trace JSON
}
  ↓
[validateTestRequestProcessor] → Validate DSL syntax
  ↓
[parseTraceJsonProcessor] → Convert to List<Span>
  ↓
[createIsolatedRuleSessionProcessor] → New Drools KieSession (no globals, no side effects)
  ↓
[compileAndInsertRuleProcessor] → Compile DSL to Drools, insert into session
  ↓
[insertSpansProcessor] → Insert spans into working memory
  ↓
[fireRulesProcessor] → Execute fireAllRules() and capture activations
  ↓
[extractMatchedSpansProcessor] → Identify which spans triggered rule
  ↓
[recordTestExecutionProcessor] → TigerBeetle transfer (code=10)
  ↓
[generateComplianceSpanProcessor] → SOC2 CC8.1 evidence
  ↓
Return TestResultDto
```

**Load Sample Trace:**
```
GET /api/sample-traces?category=authentication
  ↓
[loadSampleTracesProcessor] → Query DuckDB sample_traces table
  ↓
Return List<SampleTraceDto>
```

**Save Test Case:**
```
POST /api/rules/{ruleId}/test-cases
{
  "name": "Should detect PII leak without redaction",
  "traceJson": { ... },
  "expectedSignal": true
}
  ↓
[saveTestCaseProcessor] → Store in DuckDB rule_test_cases table
  ↓
[recordTestCaseSaveProcessor] → TigerBeetle transfer (code=10, op_type=save_test_case)
  ↓
Return testCaseId
```

**Run Regression Tests:**
```
POST /api/rules/{ruleId}/regression-test
  ↓
[loadAllTestCasesProcessor] → Load saved test cases for rule
  ↓
For each test case:
  [executeRuleProcessor] → Run test
  [compareResultProcessor] → Compare to expectedSignal
  ↓
[recordRegressionResultProcessor] → TigerBeetle transfer (code=10, op_type=regression)
  ↓
Return RegressionTestResultDto (pass/fail counts)
```

## Success Criteria

**Functional Requirements:**
- [ ] Execute rule against uploaded trace JSON
- [ ] Execute rule against sample trace from library
- [ ] Display which spans matched rule conditions
- [ ] Show signal preview if rule would fire
- [ ] Display execution time and performance metrics
- [ ] Save test cases for regression testing
- [ ] Run all test cases for a rule (regression test)
- [ ] Pre-built sample trace library (10+ traces)

**Performance Requirements:**
- [ ] Test execution completes in <1 second
- [ ] Support traces with 1000+ spans
- [ ] Regression test suite (10 test cases) runs in <5 seconds

**Compliance Requirements:**
- [ ] All test executions generate SOC2 CC8.1 evidence (change management)
- [ ] Test history immutably recorded in TigerBeetle
- [ ] Audit trail shows who tested rule before deployment

**Testing Requirements:**
- [ ] Unit tests for all processors (90% coverage per ADR-014)
- [ ] Integration tests for test execution workflow
- [ ] Security tests: rule cannot access globals, cannot create real signals

## Data Flow Diagram

```
Test Execution Flow:
  ↓
POST /api/rules/test {ruleDsl, traceJson}
  ↓
PRD-014a: RuleTestingService.executeTest()
  ├── Parse DSL
  ├── Create isolated Drools session (no globals)
  ├── Insert spans
  ├── Fire rules
  └── Return TestExecutionResult
  ↓
PRD-014c: RecordTestExecutionProcessor
  └── Create TigerBeetle transfer (code=10)
  ↓
PRD-014d: GenerateTestComplianceSpanProcessor
  └── Emit SOC2 CC8.1 compliance span
  ↓
Return results to PRD-014e: RuleTestingPanel
  └── Display matched spans, signal preview

Sample Trace Library Flow:
  ↓
GET /api/sample-traces?category=authentication
  ↓
PRD-014b: SampleTraceLibraryService.listByCategory()
  └── Query DuckDB for sample traces
  ↓
Return traces to PRD-014e: RuleTestingPanel
  └── Display trace library

Test History Flow:
  ↓
GET /api/rules/{ruleId}/test-history
  ↓
PRD-014c: TestHistoryService.getTestHistory()
  └── Query TigerBeetle transfers (code=10)
  ↓
Return history to PRD-014f: TestHistory
  └── Display test executions, statistics, regression test button
```

## Files to Create (If Implementing Without Decomposition)

**Backend:**
- `backend/src/main/java/com/fluo/services/RuleTestingService.java`
- `backend/src/main/java/com/fluo/processors/ExecuteRuleTestProcessor.java`
- `backend/src/main/java/com/fluo/processors/ParseTraceJsonProcessor.java`
- `backend/src/main/java/com/fluo/processors/RecordTestExecutionProcessor.java`
- `backend/src/main/java/com/fluo/processors/GenerateTestComplianceSpanProcessor.java`
- `backend/src/main/java/com/fluo/routes/RuleTestingRoute.java`
- `backend/src/main/java/com/fluo/dto/TestResultDto.java`
- `backend/src/main/java/com/fluo/dto/SampleTraceDto.java`
- `backend/src/main/resources/sample-traces/auth-failure.json`
- `backend/src/main/resources/sample-traces/pii-leak.json`

**Frontend:**
- `bff/src/components/rules/rule-testing-panel.tsx`
- `bff/src/components/rules/test-result-viewer.tsx`
- `bff/src/components/rules/sample-trace-library.tsx`
- `bff/src/components/rules/test-history.tsx`
- `bff/src/lib/api/rule-testing.ts`

**Tests:**
- `backend/src/test/java/com/fluo/services/RuleTestingServiceTest.java`
- `backend/src/test/java/com/fluo/processors/ExecuteRuleTestProcessorTest.java`
- `bff/src/components/rules/__tests__/rule-testing-panel.test.tsx`

## Compliance Benefits

**SOC2 CC8.1 (Change Management):**
- Evidence: All rule changes tested before deployment (test executions in TigerBeetle)
- Evidence: Regression tests prevent breaking changes
- Evidence: Developer approval workflow via test results

**Audit Trail:**
- Who tested the rule (user_id in transfer debitAccountId)
- When test executed (timestamp in transfer)
- What test passed/failed (rule_fired in userData128)
- What trace used for testing (trace_source in userData128)

## Integration with Existing PRDs

**PRD-010 (Rule Management UI):**
- Adds "Test Rule" panel to Monaco editor
- Test results displayed inline with rule editor
- Save test cases linked to rule versions

**PRD-009 (Trace Ingestion):**
- Reuses span parsing logic
- Test execution uses same Drools engine (isolated session)

**PRD-002 (TigerBeetle):**
- Test executions stored as transfers (code=10)
- Regression test history queryable for analytics

**PRD-003 (Compliance Spans):**
- Generates SOC2 CC8.1 compliance spans for testing
- Proves change management process

## Sample Trace Library (Initial Set)

**Authentication (3 traces):**
1. `auth-failure-invalid-jwt.json` - Expired JWT token
2. `auth-failure-missing-header.json` - No Authorization header
3. `auth-success.json` - Valid authentication flow

**PII Detection (3 traces):**
4. `pii-leak-unredacted-ssn.json` - SSN in span attributes, not redacted
5. `pii-leak-email-in-logs.json` - Email in log message
6. `pii-compliant.json` - PII properly redacted

**Compliance (4 traces):**
7. `compliance-unsigned-span.json` - Compliance span without signature
8. `compliance-missing-evidence.json` - SOC2 control without evidence
9. `compliance-full-chain.json` - Complete compliance evidence chain
10. `compliance-rotation-missing.json` - Key rotation not performed

## Future Enhancements

- AI-powered test case generation (GPT-4 generates traces from rule description)
- Visual trace builder (drag-and-drop span creation)
- Test coverage metrics (% of rule conditions covered by tests)
- Collaborative test library (share traces across tenants)
- Fuzzing test generator (random trace generation)
- Performance regression testing (alert on >10% slowdown)

## Implementation Status

**✅ DECOMPOSED** - This PRD has been decomposed into 6 unit PRDs (014a-014f).

All unit PRDs include:
- Full implementation code (Architecture Guardian)
- Bullet-point test requirements (QA Expert)
- Brief threat model (Security Expert)
- ADR compliance verification
- <300 lines per unit PRD ✓

**Files Created:**
- [PRD-014a: Test Execution Service](014a-test-execution-service.md) - 297 lines
- [PRD-014b: Sample Trace Library](014b-sample-trace-library.md) - 263 lines
- [PRD-014c: Test Result Recording](014c-test-result-recording.md) - 271 lines
- [PRD-014d: Test Compliance Spans](014d-test-compliance-spans.md) - 239 lines
- [PRD-014e: Test UI Component](014e-test-ui-component.md) - 289 lines
- [PRD-014f: Test History View](014f-test-history-view.md) - 258 lines

## Public Examples

### 1. Jest Testing Framework
**URL:** https://jestjs.io/

**Relevance:** Industry-standard unit testing framework demonstrating test fixture patterns, assertion libraries, and mocking strategies. While Jest is JavaScript-focused, its testing patterns are universal and apply to FLUO's rule testing workflow.

**Key Patterns:**
- Test fixtures and setup/teardown hooks
- Assertion matchers (`expect(result).toBe(expected)`)
- Mock data generation for test isolation
- Test coverage reporting
- Snapshot testing for regression detection

**FLUO Alignment:** Jest's test fixture pattern (arrange-act-assert) maps directly to FLUO's rule testing workflow: arrange sample trace → execute rule → assert signal generated.

### 2. Postman/Newman
**URL:** https://www.postman.com/

**Relevance:** API testing platform demonstrating test collections, request/response validation, and automated test execution. Shows patterns for testing API contracts against sample data, directly applicable to FLUO's trace-based rule testing.

**Key Patterns:**
- Collection-based test organization
- Pre-request scripts for test setup
- Response assertion scripts
- Environment variables for test data
- Newman CLI for automated regression testing

**FLUO Implementation:** FLUO's sample trace library mirrors Postman's collection concept. Test cases (rule + trace + expected signal) = Postman requests with assertions.

### 3. Grafana Explore
**URL:** https://grafana.com/docs/grafana/latest/explore/

**Relevance:** Interactive query interface for testing and debugging observability queries. Demonstrates query validation, result visualization, and query history—patterns directly applicable to FLUO's rule testing UI.

**Key Patterns:**
- Split-view query comparison
- Query syntax highlighting and validation
- Result table with filtering
- Query history for regression testing
- Time range selection for trace queries

**FLUO Alignment:** Grafana Explore's query testing workflow (write query → validate → execute → inspect results) mirrors FLUO's rule testing. FLUO already integrates with Grafana for trace queries, making this a natural reference.
