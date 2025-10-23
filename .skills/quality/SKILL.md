---
name: QA Expert
description: Evaluates test quality, coverage analysis, edge case detection, system resilience testing, and failure scenario assessment
---

# QA Expert Skill

## Purpose

This skill provides expertise in test quality and system resilience for BeTrace's behavioral assurance system.

## When to Use This Skill

Load this skill when:
- Reviewing test suites for completeness
- Assessing edge case coverage
- Evaluating failure scenarios
- Analyzing test coverage metrics
- Reviewing resilience and fault tolerance
- Validating test quality (not just coverage percentage)

## Quality Standards

### Coverage Thresholds (Enforced)
- **Overall Instruction Coverage**: ≥ 90%
- **Overall Branch Coverage**: ≥ 80%
- **Critical Components**: ≥ 95% instruction coverage

### Test Quality Principles
1. **Coverage ≠ Quality**: 100% coverage means nothing if tests don't validate behavior
2. **Edge Cases Matter**: Happy path tests are insufficient
3. **Failure Testing**: Test how system behaves when things go wrong
4. **Resilience**: Test recovery from failures
5. **Integration**: Unit tests + integration tests + E2E tests

## QA Review Checklist

### Test Coverage Analysis
- [ ] Instruction coverage ≥ 90% (enforced by `validate-coverage`)
- [ ] Branch coverage ≥ 80% (enforced by `validate-coverage`)
- [ ] Critical paths have ≥ 95% coverage
- [ ] New code has corresponding tests
- [ ] Tests added, not just code coverage via incidental execution

### Test Quality Assessment
- [ ] Tests validate behavior, not just code execution
- [ ] Assertions meaningful (not just `assertNotNull()`)
- [ ] Test names describe what is being tested
- [ ] Arrange-Act-Assert pattern followed
- [ ] No flaky tests (intermittent failures)
- [ ] Tests isolated (no shared state)

### Edge Case Coverage
- [ ] Null/empty input handling
- [ ] Boundary conditions (min/max values)
- [ ] Invalid input handling
- [ ] Concurrent access scenarios
- [ ] Large dataset handling
- [ ] Timeout scenarios

### Failure Scenario Testing
- [ ] Error paths tested (not just success)
- [ ] Exception handling validated
- [ ] Graceful degradation verified
- [ ] Recovery from failures tested
- [ ] Circuit breaker patterns tested
- [ ] Retry logic validated

### Integration & E2E Testing
- [ ] Integration tests for inter-service communication
- [ ] Database integration tested
- [ ] OpenTelemetry integration tested
- [ ] End-to-end user workflows tested
- [ ] External API mocking appropriate

## Test Organization

### Backend (JUnit 5)
```
backend/src/test/java/
├── unit/           # Pure logic tests (no I/O)
├── integration/    # Database, external services
└── e2e/            # Full system tests
```

### Frontend (Vitest)
```
bff/src/__tests__/
├── unit/           # Component logic tests
├── integration/    # Route/API integration
└── e2e/            # Playwright browser tests
```

## Common Test Anti-Patterns

### Anti-Pattern 1: Coverage for Coverage's Sake
```java
// ❌ Bad: Executes code but doesn't validate behavior
@Test
void testGetTrace() {
    traceService.getTrace("trace-123");
    // No assertions! Coverage but no validation
}

// ✅ Good: Validates behavior
@Test
void shouldReturnTraceWhenExists() {
    Trace trace = traceService.getTrace("trace-123");
    assertThat(trace).isNotNull();
    assertThat(trace.getId()).isEqualTo("trace-123");
    assertThat(trace.getSpans()).isNotEmpty();
}
```

### Anti-Pattern 2: Weak Assertions
```java
// ❌ Bad: Meaningless assertion
@Test
void testAnalyzeTrace() {
    AnalysisResult result = analyzer.analyze(trace);
    assertThat(result).isNotNull();  // Too weak!
}

// ✅ Good: Validates actual behavior
@Test
void shouldDetectViolationWhenPatternMatches() {
    AnalysisResult result = analyzer.analyze(trace);
    assertThat(result.hasViolations()).isTrue();
    assertThat(result.getViolations()).hasSize(1);
    assertThat(result.getViolations().get(0).getRuleName())
        .isEqualTo("pii_access_requires_audit");
}
```

### Anti-Pattern 3: Ignoring Edge Cases
```java
// ❌ Bad: Only tests happy path
@Test
void testDivide() {
    assertThat(calculator.divide(10, 2)).isEqualTo(5);
}

// ✅ Good: Tests edge cases
@Test
void shouldThrowExceptionWhenDividingByZero() {
    assertThatThrownBy(() -> calculator.divide(10, 0))
        .isInstanceOf(ArithmeticException.class)
        .hasMessage("Division by zero");
}

@Test
void shouldHandleNegativeNumbers() {
    assertThat(calculator.divide(-10, 2)).isEqualTo(-5);
}
```

### Anti-Pattern 4: Flaky Tests
```java
// ❌ Bad: Relies on timing/order
@Test
void testAsync() {
    service.executeAsync();
    Thread.sleep(100);  // Flaky! May fail on slow systems
    assertThat(service.isComplete()).isTrue();
}

// ✅ Good: Proper async testing
@Test
void shouldCompleteAsyncOperation() {
    CompletableFuture<Result> future = service.executeAsync();
    Result result = future.get(5, TimeUnit.SECONDS);
    assertThat(result).isNotNull();
}
```

## Edge Case Categories

### Input Validation Edge Cases
- Null inputs
- Empty collections
- Whitespace-only strings
- Very long strings (buffer overflow)
- Special characters (injection attacks)
- Negative numbers where positive expected
- Zero values
- Maximum integer values

### Boundary Conditions
- Array index 0 and length-1
- Empty arrays/lists
- Single-element collections
- Maximum collection size
- Minimum/maximum numeric values
- Date/time edge cases (leap years, timezone boundaries)

### Concurrency Edge Cases
- Race conditions
- Deadlocks
- Thread starvation
- Shared state mutations
- Atomic operation failures

### System Resource Edge Cases
- Out of memory scenarios
- Disk full conditions
- Network timeouts
- Connection pool exhaustion
- File handle limits

## Failure Scenario Testing

### Error Path Coverage
```java
@Test
void shouldHandleDatabaseConnectionFailure() {
    when(dataSource.getConnection())
        .thenThrow(new SQLException("Connection failed"));

    assertThatThrownBy(() -> service.getData())
        .isInstanceOf(DataAccessException.class)
        .hasCauseInstanceOf(SQLException.class);
}
```

### Graceful Degradation
```java
@Test
void shouldReturnCachedDataWhenDatabaseUnavailable() {
    when(database.query()).thenThrow(new SQLException());

    Result result = service.getDataWithFallback();

    assertThat(result.isFromCache()).isTrue();
    assertThat(result.getData()).isNotNull();
}
```

### Recovery Testing
```java
@Test
void shouldRecoverAfterTransientFailure() {
    // First call fails
    when(externalService.call())
        .thenThrow(new TimeoutException())
        .thenReturn(new Response("success"));

    // Circuit breaker should retry
    Result result = resilientService.callWithRetry();

    assertThat(result.isSuccess()).isTrue();
    verify(externalService, times(2)).call();
}
```

## Test Coverage Reports

### Viewing Coverage
```bash
# Run tests with coverage
nix run .#test

# View HTML coverage reports
nix run .#test-coverage
# Opens: http://localhost:12099

# Backend: JaCoCo report at :12099/backend/
# Frontend: Istanbul report at :12099/bff/
```

### Coverage Validation
```bash
# Enforces 90% instruction, 80% branch thresholds
nix run .#validate-coverage
```

## Integration Testing Patterns

### Database Integration
```java
@QuarkusTest
@TestTransaction
class TraceRepositoryTest {
    @Inject
    TraceRepository repository;

    @Test
    void shouldPersistAndRetrieveTrace() {
        Trace trace = createTestTrace();
        repository.save(trace);

        Trace retrieved = repository.findById(trace.getId());
        assertThat(retrieved).isEqualTo(trace);
    }
}
```

### OpenTelemetry Integration
```java
@QuarkusTest
class ComplianceSpanEmitterTest {
    @InjectSpy
    SpanExporter spanExporter;

    @Test
    void shouldEmitComplianceSpan() {
        service.performCompliantOperation();

        verify(spanExporter).export(argThat(spans ->
            spans.stream().anyMatch(span ->
                span.getAttribute("compliance.framework").equals("soc2")
            )
        ));
    }
}
```

## Progressive Disclosure

This SKILL.md provides high-level guidance. For detailed QA context:
1. Review `edge-case-catalog.md` for comprehensive edge case lists
2. Check `failure-scenario-patterns.md` for resilience testing
3. Consult `test-organization-guide.md` for project structure
4. See `coverage-analysis-guide.md` for interpreting coverage reports

## When Coverage Claims Are Misleading

**Red Flags**:
1. **100% coverage, no edge cases**: Tests execute code but don't validate behavior
2. **High coverage, weak assertions**: `assertNotNull()` everywhere
3. **Unit tests only**: No integration or E2E tests
4. **No failure scenarios**: Only happy path tested
5. **Flaky test suite**: Intermittent failures indicate poor test quality

**Quality Indicators**:
1. ✅ Edge cases explicitly tested
2. ✅ Failure scenarios validated
3. ✅ Meaningful assertions (behavior validation)
4. ✅ Integration + E2E tests present
5. ✅ Tests are fast and deterministic
6. ✅ Test names describe behavior
7. ✅ Arrange-Act-Assert pattern followed

## Test Metrics Beyond Coverage

- **Mutation Testing Score**: How many mutants killed?
- **Flakiness Rate**: Percentage of intermittent failures
- **Test Execution Time**: Fast feedback loop?
- **Assertion Density**: Assertions per test (aim for 3-5)
- **Edge Case Coverage**: Boundary conditions tested?
- **Failure Scenario Coverage**: Error paths tested?

## Summary

**Coverage is necessary but not sufficient**. Quality tests:
- Validate behavior, not just execute code
- Cover edge cases and failure scenarios
- Use meaningful assertions
- Are fast, deterministic, and maintainable
- Combine unit + integration + E2E testing
