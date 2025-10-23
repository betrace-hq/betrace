# PRD-018: Comprehensive Test Suite

**Priority:** P1 (Infrastructure - Production Readiness)
**Complexity:** Complex (System)
**Type:** System Overview
**Personas:** Developer, QA, DevOps
**Dependencies:**
- PRD-001 through PRD-017 (All features requiring test coverage)
- ADR-014 (Named Processors with 90% test coverage requirement)

## Architecture Integration

This PRD complies with BeTrace's architectural standards:

- **ADR-011 (TigerBeetle-First):** Test fixtures create TigerBeetle transfers for test data
- **ADR-013 (Camel-First):** Integration tests validate Camel routes end-to-end
- **ADR-014 (Named Processors):** Unit tests achieve 90% coverage for all processors
- **ADR-015 (Tiered Storage):** Tests validate data flow through TigerBeetle → DuckDB → Parquet

## Problem

**No comprehensive test suite across BeTrace:**
- Individual unit tests exist per PRD
- No integration tests validating multi-system workflows
- No end-to-end tests covering user journeys
- No performance benchmarks for rule evaluation
- No security tests for authentication, KMS, compliance
- No test fixtures for realistic multi-tenant scenarios
- Test coverage varies across components (goal: 90% per ADR-014)

**Current State:**
- Each PRD defines test requirements in isolation
- No shared test utilities or fixtures
- No continuous integration pipeline definition
- No test data generators for realistic scenarios
- No test coverage enforcement

**Impact:**
- Regressions slip into production
- Integration bugs discovered late
- Performance issues not caught early
- Security vulnerabilities missed
- Compliance evidence validation not automated
- Difficult to validate cross-system workflows

## Solution

### Test Pyramid Strategy

**Level 1: Unit Tests (Fast, Isolated)**
- All named processors (@Named classes)
- Service layer business logic
- Domain models and utilities
- Target: 90% coverage per ADR-014

**Level 2: Integration Tests (Medium Speed)**
- Camel route end-to-end flows
- TigerBeetle persistence operations
- KMS signing and encryption
- DuckDB query operations
- Multi-processor workflows

**Level 3: End-to-End Tests (Slow, Full System)**
- Complete user journeys (signup → rule creation → signal detection)
- Multi-tenant isolation validation
- Compliance evidence generation
- API contracts (frontend ↔ backend)

**Level 4: Performance Tests (Benchmarks)**
- Drools rule evaluation throughput
- TigerBeetle write performance
- Long-lived trace memory management
- Query performance (DuckDB, Parquet)

**Level 5: Security Tests (Penetration, Fuzzing)**
- Authentication bypass attempts
- RBAC policy enforcement
- KMS key isolation
- SQL injection, XSS, SSRF
- Compliance span signature verification

## Unit PRD References

✅ **DECOMPOSED** - This system has been decomposed into unit PRDs:

| PRD | Unit | Purpose | File | Lines |
|-----|------|---------|------|-------|
| [018a](./018a-test-fixture-generator.md) | TestFixtureGenerator | Generate realistic test data | `TestFixtureGenerator.java` | 390 |
| [018b](./018b-shared-test-utilities.md) | SharedTestUtilities | Common test helpers, assertions, matchers | `test/utils/*.java` | 408 |
| [018c](./018c-integration-test-harness.md) | IntegrationTestHarness | Testcontainers setup | `TigerBeetleTestResource.java`, `DuckDBTestResource.java` | 344 |
| [018d](./018d-camel-route-integration-tests.md) | CamelRouteIntegrationTests | Test all Camel routes end-to-end | `integration/routes/*.java` | 456 |
| [018e](./018e-multi-tenant-isolation-tests.md) | MultiTenantIsolationTests | Validate tenant data isolation | `MultiTenantIsolationTest.java` | 377 |
| [018f](./018f-compliance-evidence-tests.md) | ComplianceEvidenceTests | Validate SOC2/HIPAA/GDPR spans | `ComplianceEvidenceTest.java` | 441 |
| [018g](./018g-performance-benchmarks.md) | PerformanceBenchmarks | JMH benchmarks for critical paths | `benchmarks/*.java` | 433 |
| [018h](./018h-security-penetration-tests.md) | SecurityPenetrationTests | Security vulnerability testing | `SecurityPenetrationTest.java` | 475 |

**Total:** 8 unit PRDs, 3,324 lines

## Test Architecture

### Unit Test Structure (JUnit 5)

```java
@QuarkusTest
@TestProfile(IsolatedTestProfile.class)
class RuleEvaluationServiceTest {
    @Inject
    RuleEvaluationService ruleEvaluationService;

    @Inject
    TestFixtureGenerator fixtures;

    @Test
    @DisplayName("Should evaluate rule and generate signal when condition matches")
    void testEvaluateRule_Match() {
        // Given: Rule + matching spans
        Rule rule = fixtures.createRule("Detect PII Leak");
        List<Span> spans = fixtures.createSpansWithPII();

        // When: Evaluate rule
        EvaluationResult result = ruleEvaluationService.evaluate(rule, spans);

        // Then: Signal generated
        assertThat(result.isMatch()).isTrue();
        assertThat(result.getMatchedSpans()).hasSize(3);
    }
}
```

### Integration Test Structure (Testcontainers)

```java
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@QuarkusTestResource(TigerBeetleTestResource.class)
@QuarkusTestResource(DuckDBTestResource.class)
class SignalCreationIntegrationTest {
    @Test
    @DisplayName("Signal creation should flow through TigerBeetle → DuckDB → UI")
    void testSignalCreationWorkflow() {
        // Given: Authenticated tenant + rule
        UUID tenantId = authenticateTestTenant();
        UUID ruleId = createTestRule(tenantId);

        // When: Ingest spans that match rule
        ingestMatchingSpans(tenantId, ruleId);

        // Then: Signal appears in TigerBeetle
        Transfer signalTransfer = queryTigerBeetleTransfers(CODE_SIGNAL);
        assertThat(signalTransfer).isNotNull();

        // And: Signal appears in DuckDB
        Signal signal = queryDuckDBSignals(tenantId);
        assertThat(signal.getRuleId()).isEqualTo(ruleId);

        // And: API returns signal
        List<Signal> apiSignals = callSignalAPI(tenantId);
        assertThat(apiSignals).hasSize(1);
    }
}
```

### End-to-End Test Structure (Playwright)

```typescript
// bff/src/tests/e2e/signal-investigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Signal Investigation Workflow', () => {
  test('SRE can investigate signal from detection to resolution', async ({ page }) => {
    // Given: Authenticated SRE
    await page.goto('/auth');
    await page.fill('[name="email"]', 'sre@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // When: Navigate to signals page
    await page.goto('/signals');

    // Then: See critical signal
    await expect(page.locator('text=Detect PII Leak')).toBeVisible();

    // When: Click signal to investigate
    await page.click('text=Detect PII Leak');

    // Then: See signal details
    await expect(page.locator('text=Severity: Critical')).toBeVisible();

    // When: Add investigation note
    await page.fill('[name="note"]', 'Confirmed PII leak in user-service');
    await page.click('button:has-text("Add Note")');

    // Then: Note appears in timeline
    await expect(page.locator('text=Confirmed PII leak')).toBeVisible();

    // When: Mark as resolved
    await page.click('button:has-text("Resolve")');

    // Then: Status updates
    await expect(page.locator('text=Status: Resolved')).toBeVisible();
  });
});
```

### Performance Benchmark Structure (JMH)

```java
@State(Scope.Benchmark)
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
public class DroolsRuleEvaluationBench {
    private KieSession kieSession;
    private List<Span> testSpans;

    @Setup
    public void setup() {
        kieSession = createKieSession();
        testSpans = generateTestSpans(100); // 100-span trace
    }

    @Benchmark
    public int evaluateRule() {
        testSpans.forEach(kieSession::insert);
        return kieSession.fireAllRules();
    }

    @TearDown
    public void tearDown() {
        kieSession.dispose();
    }
}
```

## Test Fixtures and Data Generators

### Test Tenant Generator

```java
@ApplicationScoped
public class TestTenantGenerator {
    public TestTenant createTenant(String name) {
        UUID tenantId = UUID.randomUUID();
        // Create tenant account in TigerBeetle
        // Generate Ed25519 keypair via KMS
        // Create default user
        return new TestTenant(tenantId, name);
    }

    public TestUser createUser(UUID tenantId, String role) {
        // Create user with specific RBAC role
        // Generate JWT token for authentication
        return new TestUser(tenantId, role);
    }
}
```

### Test Span Generator

```java
@ApplicationScoped
public class TestSpanGenerator {
    public List<Span> createAuthenticationFailureTrace() {
        // Realistic trace: client → gateway → auth-service
        // Gateway span: http.status_code=401
        // Auth span: auth.failure_reason=invalid_jwt
        return List.of(clientSpan, gatewaySpan, authSpan);
    }

    public List<Span> createPIILeakTrace() {
        // Trace with SSN in span attributes (unredacted)
        // Trigger: user_ssn="123-45-6789" in attribute
        return List.of(userServiceSpan);
    }

    public List<Span> createCompliantEncryptionTrace() {
        // Trace with encryption compliance span
        // Should NOT generate signal
        return List.of(encryptionSpan, complianceSpan);
    }
}
```

### Test Rule Generator

```java
@ApplicationScoped
public class TestRuleGenerator {
    public Rule createDetectPIILeakRule(UUID tenantId) {
        String dsl = """
            DETECT "PII Leak"
            WHEN count(spans) > 0
            WHERE has(user_ssn)
            """;
        return ruleService.createRule(tenantId, "Detect PII Leak", dsl, "critical");
    }

    public Rule createAuthFailureRule(UUID tenantId) {
        String dsl = """
            DETECT "Auth Failure"
            WHEN count(spans) > 5
            WHERE http.status_code = 401
            """;
        return ruleService.createRule(tenantId, "Auth Failure", dsl, "high");
    }
}
```

## Test Coverage Requirements (ADR-014)

**Backend Coverage Targets:**
- Processors: 90% (strict)
- Services: 90% (strict)
- Domain models: 80%
- Utilities: 85%
- Overall: 90% minimum

**Frontend Coverage Targets:**
- Components: 80%
- Hooks: 85%
- Utilities: 90%
- Overall: 80% minimum

**Coverage Tools:**
- Backend: JaCoCo (Maven plugin)
- Frontend: Vitest coverage (v8)

## Continuous Integration Pipeline

**GitHub Actions Workflow:**
```yaml
name: CI Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Nix
        uses: cachix/install-nix-action@v20
      - name: Run backend unit tests
        run: cd backend && nix run .#test
      - name: Run frontend unit tests
        run: cd bff && npm run test
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start Testcontainers
        run: docker-compose -f test-compose.yml up -d
      - name: Run integration tests
        run: cd backend && mvn verify -Pintegration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start BeTrace stack
        run: nix run .#dev &
      - name: Run Playwright tests
        run: cd bff && npm run test:e2e

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run JMH benchmarks
        run: cd backend && mvn test -Pbenchmark
      - name: Archive results
        uses: actions/upload-artifact@v3
```

## Success Criteria

**Functional Requirements:**
- [ ] 90% unit test coverage for all processors (ADR-014)
- [ ] 80% unit test coverage for frontend components
- [ ] Integration tests for all Camel routes
- [ ] End-to-end tests for critical user journeys
- [ ] Performance benchmarks for rule evaluation, TigerBeetle writes
- [ ] Security tests for authentication, RBAC, KMS

**Test Fixtures:**
- [ ] Test tenant generator with realistic data
- [ ] Test span generator with 10+ scenario traces
- [ ] Test rule generator for common detection patterns
- [ ] Test signal generator for investigation workflows

**CI/CD Integration:**
- [ ] GitHub Actions workflow runs all test levels
- [ ] Coverage reports uploaded to Codecov
- [ ] Performance regression detection
- [ ] Security scan integration (SAST, DAST)

**Performance Requirements:**
- [ ] Unit tests run in <2 minutes
- [ ] Integration tests run in <5 minutes
- [ ] End-to-end tests run in <10 minutes
- [ ] Full CI pipeline completes in <20 minutes

**Compliance Requirements:**
- [ ] All compliance spans validated in tests
- [ ] Signature verification tests for Ed25519
- [ ] Multi-tenant isolation validated
- [ ] Audit trail immutability tests (TigerBeetle WORM)

## Integration with Existing PRDs

**All PRDs (001-017):**
- Test fixtures generate data for all features
- Integration tests validate cross-PRD workflows

**PRD-002 (TigerBeetle):**
- Testcontainers for TigerBeetle in integration tests
- Test utilities for transfer creation/querying

**PRD-003 (Compliance Spans):**
- Validate all compliance spans are signed
- Validate compliance span attributes (SOC2, HIPAA, GDPR)

**PRD-004 (Rule Engine):**
- Performance benchmarks for Drools evaluation
- Integration tests for DSL → Drools compilation

**PRD-006 (KMS):**
- Security tests for key isolation
- Test fixtures for signed transfers

**PRD-008 (Signals):**
- End-to-end tests for signal detection workflow
- Test fixtures for realistic signal scenarios

## Compliance Benefits

**SOC2 CC8.1 (Change Management - Testing):**
- Evidence: 90% test coverage across codebase
- Evidence: Automated test suite runs on every commit
- Evidence: Integration tests validate system behavior

**SOC2 CC7.2 (System Monitoring):**
- Evidence: Performance benchmarks track system health
- Evidence: Security tests validate monitoring effectiveness

**Audit Trail:**
- Test execution logs in CI/CD pipeline
- Coverage reports over time
- Performance trend analysis

## Security Considerations

**Threats & Mitigations:**
- **Test data leakage** - mitigate with ephemeral test databases
- **Test credentials in CI** - mitigate with GitHub Secrets
- **Performance test DOS** - mitigate with isolated benchmark environment
- **Test fixture injection** - mitigate with input validation in generators

**Security Test Scenarios:**
- Authentication bypass attempts
- RBAC escalation attempts
- KMS key extraction attempts
- SQL injection in DuckDB queries
- XSS in frontend components
- SSRF via webhook URLs

## Implementation Status

✅ **DECOMPOSED** - This PRD has been fully decomposed into 8 unit PRDs (018a-018h). See [Unit PRD References](#unit-prd-references) section for complete breakdown.

**Files Created:**
- `docs/prds/018a-test-fixture-generator.md` - Test data generators for all domain models
- `docs/prds/018b-shared-test-utilities.md` - Custom assertions, builders, helpers
- `docs/prds/018c-integration-test-harness.md` - Testcontainers for TigerBeetle, DuckDB
- `docs/prds/018d-camel-route-integration-tests.md` - End-to-end route validation
- `docs/prds/018e-multi-tenant-isolation-tests.md` - Security isolation validation
- `docs/prds/018f-compliance-evidence-tests.md` - Compliance span signature validation
- `docs/prds/018g-performance-benchmarks.md` - JMH benchmarks for critical paths
- `docs/prds/018h-security-penetration-tests.md` - OWASP Top 10 attack vector testing
