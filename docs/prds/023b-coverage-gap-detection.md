# PRD-023B: Coverage Gap Detection

**Priority:** P2 (Medium - Advanced Analytics)
**Complexity:** High
**Personas:** SRE, Security Engineer
**Dependencies:** PRD-023A (metrics), PRD-009b (trace correlation)
**Implements:** Blind spot detection for rule coverage

## Problem

FLUO rules only detect what they're written to detect:
- **Blind spots**: 40%+ of production traces match NO rules (user research)
- **No visibility**: SREs don't know which endpoints/services lack monitoring
- **Manual discovery**: Finding coverage gaps requires manual trace inspection
- **Risk**: Unmonitored patterns = undetected incidents/violations

**Impact:**
- Security: Authentication bypass traces go undetected (no rule for new endpoint)
- Compliance: Missing audit evidence for unmatchable operations (SOC2 CC8.1)
- Operational: Service degradation in unmonitored endpoints

## Solution

### Coverage Gap Analysis

**Pattern Extraction Algorithm:**
1. Extract patterns from traces: `{service}.{operation}.{status_code}`
2. Example: `auth-service.POST /login.200` → pattern `auth.login.200`
3. Track patterns that match ZERO rules over time window
4. Calculate coverage: `matched_patterns / total_patterns`

**Pattern Normalization:**
- HTTP paths: `/users/123/profile` → `/users/{id}/profile`
- Case-insensitive: `GET` == `get`
- Operation extraction: `http.method` + `http.route`

## Implementation

### Pattern Extractor

**File:** `backend/src/main/java/com/fluo/analytics/TracePatternExtractor.java`

```java
@ApplicationScoped
public class TracePatternExtractor {
    public TracePattern extractPattern(CompleteTrace trace) {
        // Extract key attributes
        String service = trace.getServiceName();
        String operation = extractOperation(trace);
        String status = extractStatus(trace);

        // Normalize
        String normalizedOperation = normalizeOperation(operation);

        return new TracePattern(
            service,
            normalizedOperation,
            status,
            trace.getTraceId()
        );
    }

    private String extractOperation(CompleteTrace trace) {
        // Priority: http.route > span.name > operation.name
        return trace.getRootSpan()
            .getAttributes()
            .getOrDefault("http.route", trace.getRootSpan().getName());
    }

    private String normalizeOperation(String operation) {
        // Replace path parameters: /users/123 → /users/{id}
        return operation
            .replaceAll("/\\d+", "/{id}")
            .replaceAll("/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "/{uuid}")
            .toLowerCase();
    }

    private String extractStatus(CompleteTrace trace) {
        return trace.getRootSpan()
            .getAttributes()
            .getOrDefault("http.status_code", "unknown");
    }
}

@Data
@AllArgsConstructor
public class TracePattern {
    String service;
    String operation;
    String status;
    String exampleTraceId;

    public String toPatternKey() {
        return String.format("%s.%s.%s", service, operation, status);
    }
}
```

### Coverage Analyzer

**File:** `backend/src/main/java/com/fluo/analytics/CoverageAnalyzer.java`

```java
@ApplicationScoped
public class CoverageAnalyzer {
    @Inject TracePatternExtractor patternExtractor;
    @Inject RuleService ruleService;
    @Inject DuckDBClient duckdb;

    public CoverageReport analyzeCoverage(String tenantId, Duration window) {
        Instant start = Instant.now().minus(window);
        Instant end = Instant.now();

        // Query all traces from DuckDB
        List<CompleteTrace> traces = duckdb.query(
            "SELECT * FROM traces WHERE tenant_id = ? AND timestamp >= ? AND timestamp <= ?",
            tenantId, start, end
        );

        // Extract patterns
        Map<String, PatternStats> patternStats = new HashMap<>();
        for (CompleteTrace trace : traces) {
            TracePattern pattern = patternExtractor.extractPattern(trace);
            String key = pattern.toPatternKey();

            patternStats.computeIfAbsent(key, k -> new PatternStats(pattern))
                .incrementTraceCount();
        }

        // Test each pattern against rules
        List<Rule> rules = ruleService.getRulesForTenant(tenantId);
        for (PatternStats stats : patternStats.values()) {
            boolean matched = testPatternAgainstRules(stats.getPattern(), rules);
            if (matched) {
                stats.setMatchedByRule(true);
            }
        }

        // Calculate coverage
        long totalPatterns = patternStats.size();
        long matchedPatterns = patternStats.values().stream()
            .filter(PatternStats::isMatchedByRule)
            .count();

        double coveragePercentage = (double) matchedPatterns / totalPatterns * 100;

        // Identify top unmatched patterns
        List<UnmatchedPattern> unmatchedPatterns = patternStats.values().stream()
            .filter(stats -> !stats.isMatchedByRule())
            .sorted(Comparator.comparing(PatternStats::getTraceCount).reversed())
            .limit(10)
            .map(this::toUnmatchedPattern)
            .collect(Collectors.toList());

        return new CoverageReport(
            tenantId,
            start,
            end,
            totalPatterns,
            matchedPatterns,
            coveragePercentage,
            unmatchedPatterns
        );
    }

    private boolean testPatternAgainstRules(TracePattern pattern, List<Rule> rules) {
        // Create synthetic trace matching this pattern
        CompleteTrace syntheticTrace = createSyntheticTrace(pattern);

        // Test against all rules
        for (Rule rule : rules) {
            try {
                List<RuleMatch> matches = droolsEngine.evaluate(rule, syntheticTrace);
                if (!matches.isEmpty()) {
                    return true; // At least one rule matches
                }
            } catch (Exception e) {
                log.debugf("Rule %s failed to evaluate synthetic trace", rule.getId());
            }
        }

        return false; // No rules matched
    }

    private UnmatchedPattern toUnmatchedPattern(PatternStats stats) {
        // Generate suggested rule DSL
        String suggestedRule = generateRuleSuggestion(stats.getPattern());

        return new UnmatchedPattern(
            stats.getPattern().toPatternKey(),
            stats.getTraceCount(),
            stats.getPattern().getExampleTraceId(),
            suggestedRule
        );
    }

    private String generateRuleSuggestion(TracePattern pattern) {
        return String.format(
            "trace.has(service == '%s') and trace.has(operation == '%s') and trace.has(status == '%s')",
            pattern.getService(),
            pattern.getOperation(),
            pattern.getStatus()
        );
    }
}

@Data
class PatternStats {
    TracePattern pattern;
    long traceCount = 0;
    boolean matchedByRule = false;

    PatternStats(TracePattern pattern) {
        this.pattern = pattern;
    }

    void incrementTraceCount() {
        this.traceCount++;
    }
}

@Data
@AllArgsConstructor
class UnmatchedPattern {
    String patternKey;
    long traceCount;
    String exampleTraceId;
    String suggestedRule;
}

@Data
@AllArgsConstructor
class CoverageReport {
    String tenantId;
    Instant startTime;
    Instant endTime;
    long totalPatterns;
    long matchedPatterns;
    double coveragePercentage;
    List<UnmatchedPattern> unmatchedPatterns;
}
```

### Coverage API

**File:** `backend/src/main/java/com/fluo/routes/CoverageAnalyticsRoute.java`

```java
@Path("/api/analytics/coverage")
@ApplicationScoped
public class CoverageAnalyticsRoute {
    @Inject CoverageAnalyzer analyzer;
    @Inject AuthorizationService authz;

    @GET
    @RolesAllowed("security_admin") // P1 Security: Restrict to admins
    @SOC2(controls = {CC6_1, CC7_2}, notes = "Coverage gap analysis requires elevated access")
    public Response getCoverage(
        @QueryParam("window") @DefaultValue("24h") String windowStr,
        @Context SecurityContext ctx
    ) {
        String tenantId = ctx.getUserPrincipal().getName();

        // P1 Security: Verify admin role
        if (!authz.hasRole(ctx.getUserPrincipal(), "security_admin")) {
            throw new ForbiddenException("Requires security_admin role");
        }

        // P1 Security: Audit access
        auditLog.info("Coverage gap analysis requested", Map.of(
            "user", ctx.getUserPrincipal().getName(),
            "tenant", tenantId,
            "window", windowStr
        ));

        // Parse time window
        Duration window = Duration.parse("PT" + windowStr);

        // Validate window (max 7 days)
        if (window.toDays() > 7) {
            throw new BadRequestException("Max window: 7 days");
        }

        // Run analysis
        CoverageReport report = analyzer.analyzeCoverage(tenantId, window);

        // P0 Security: Emit compliance span
        emitComplianceSpan(SOC2, CC7_2, "coverage_analysis", Map.of(
            "tenant_id", tenantId,
            "user_id", ctx.getUserPrincipal().getName(),
            "coverage_percentage", report.getCoveragePercentage()
        ));

        return Response.ok(report).build();
    }

    @GET
    @Path("/patterns/{patternKey}")
    @RolesAllowed("security_admin")
    public Response getPatternDetails(
        @PathParam("patternKey") String patternKey,
        @Context SecurityContext ctx
    ) {
        String tenantId = ctx.getUserPrincipal().getName();

        // Query traces matching pattern
        List<String> traceIds = duckdb.query(
            "SELECT trace_id FROM traces WHERE tenant_id = ? AND pattern_key = ? LIMIT 10",
            tenantId, patternKey
        );

        return Response.ok(Map.of(
            "pattern", patternKey,
            "example_traces", traceIds
        )).build();
    }
}
```

### Scheduled Coverage Job

**File:** `backend/src/main/java/com/fluo/jobs/CoverageSnapshotJob.java`

```java
@ApplicationScoped
public class CoverageSnapshotJob {
    @Inject CoverageAnalyzer analyzer;
    @Inject CoverageSnapshotRepository repository;

    @Scheduled(cron = "0 0 * * * ?") // Every hour
    public void snapshotCoverage() {
        List<String> tenants = tenantService.getAllTenantIds();

        for (String tenantId : tenants) {
            try {
                CoverageReport report = analyzer.analyzeCoverage(tenantId, Duration.ofHours(1));

                // Store snapshot
                CoverageSnapshot snapshot = new CoverageSnapshot(
                    tenantId,
                    Instant.now(),
                    report.getTotalPatterns(),
                    report.getMatchedPatterns(),
                    report.getCoveragePercentage()
                );

                repository.save(snapshot);

                // Alert on low coverage
                if (report.getCoveragePercentage() < 70.0) {
                    Signal lowCoverageSignal = Signal.builder()
                        .tenantId(tenantId)
                        .severity(Severity.INFO)
                        .type("low_coverage")
                        .message(String.format("Rule coverage: %.1f%% (threshold: 70%%)", report.getCoveragePercentage()))
                        .metadata(Map.of(
                            "coverage_percentage", report.getCoveragePercentage(),
                            "total_patterns", report.getTotalPatterns(),
                            "matched_patterns", report.getMatchedPatterns()
                        ))
                        .build();

                    signalService.createSignal(tenantId, lowCoverageSignal);
                }
            } catch (Exception e) {
                log.errorf(e, "Coverage snapshot failed for tenant %s", tenantId);
            }
        }
    }
}
```

## Security Requirements

### P0 (Blocking)

**1. Tenant Isolation**
- Coverage analysis MUST filter by `tenant_id`
- Pattern testing MUST use tenant's rules only
- Test:
```java
@Test
void shouldNotLeakCrossTenantPatterns() {
    CoverageReport tenantAReport = analyzer.analyzeCoverage("tenant-a", Duration.ofHours(1));

    assertThat(tenantAReport.getUnmatchedPatterns())
        .noneMatch(pattern -> pattern.getExampleTraceId().contains("tenant-b"));
}
```

### P1 (High Priority)

**2. Admin-Only Access**
- Coverage gap analysis MUST require `security_admin` role
- Reveals blind spots = attack surface mapping
- Implementation:
```java
@RolesAllowed("security_admin")
public Response getCoverage(...) {
    if (!authz.hasRole(user, "security_admin")) {
        throw new ForbiddenException();
    }
    // ...
}
```

**3. Audit Logging**
- Log all coverage gap queries
- Log format:
```json
{
  "event": "coverage_analysis",
  "user_id": "admin@example.com",
  "tenant_id": "tenant-xyz",
  "window": "24h",
  "coverage_percentage": 73.5,
  "timestamp": "2025-10-11T10:23:45.123Z"
}
```

### P2 (Defense in Depth)

**4. Rate Limiting**
- Max 5 coverage queries/hour per user
- Analysis is expensive (queries DuckDB, evaluates rules)

## Configuration

**File:** `application.properties`

```properties
# Coverage analysis
coverage.max-window-days=7
coverage.pattern-cache-ttl=1h
coverage.low-threshold=70.0

# Scheduled snapshots
coverage.snapshot.schedule=0 0 * * * ?  # Hourly
coverage.snapshot.retention-days=90

# Security
coverage.analysis.require-admin=true
coverage.analysis.rate-limit-per-hour=5
```

## Acceptance Criteria

### Functional Requirements

**Pattern Extraction:**
```gherkin
Scenario: Extract pattern from trace
  Given trace T1 with:
    - service: "auth-service"
    - http.route: "/users/123/profile"
    - http.status_code: "200"
  When pattern is extracted
  Then pattern_key = "auth-service./users/{id}/profile.200"

Scenario: Normalize path parameters
  Given operation "/users/abc-123/settings"
  When normalized
  Then operation = "/users/{id}/settings"
```

**Coverage Calculation:**
```gherkin
Scenario: Calculate coverage percentage
  Given 100 unique patterns observed
  And 73 patterns match at least one rule
  When coverage is calculated
  Then coverage_percentage = 73.0

Scenario: Identify unmatched patterns
  Given pattern "payment.POST /refunds.200" with 500 traces
  And NO rules match this pattern
  When coverage analysis runs
  Then "payment.POST /refunds.200" appears in unmatchedPatterns
  And trace_count = 500
```

**Suggested Rules:**
```gherkin
Scenario: Generate rule suggestion
  Given unmatched pattern "auth.login.500"
  When rule suggestion is generated
  Then suggested_rule contains:
    - "trace.has(service == 'auth')"
    - "trace.has(operation == 'login')"
    - "trace.has(status == '500')"
```

### Security Requirements

```gherkin
Scenario: Admin-only access enforced
  Given user without "security_admin" role
  When GET /api/analytics/coverage
  Then 403 Forbidden response returned

Scenario: Coverage analysis audited
  Given security admin queries coverage
  When query completes
  Then audit log contains:
    - event: coverage_analysis
    - user_id: <admin>
    - tenant_id: <tenant>
    - coverage_percentage: <value>
```

## Testing Strategy

### Unit Tests

**Pattern Extraction:**
```java
@Test
void extractPattern_normalizesPathParams() {
    CompleteTrace trace = createTrace(
        "service-a",
        "/users/123/profile",
        "200"
    );

    TracePattern pattern = extractor.extractPattern(trace);

    assertThat(pattern.toPatternKey()).isEqualTo("service-a./users/{id}/profile.200");
}
```

**Coverage Calculation:**
```java
@Test
void analyzeCoverage_calculatesCorrectly() {
    // 100 patterns, 73 matched
    CoverageReport report = analyzer.analyzeCoverage("tenant1", Duration.ofHours(1));

    assertThat(report.getCoveragePercentage()).isEqualTo(73.0);
    assertThat(report.getTotalPatterns()).isEqualTo(100);
    assertThat(report.getMatchedPatterns()).isEqualTo(73);
}
```

### Integration Tests

**Testcontainers with DuckDB:**
```java
@QuarkusTest
class CoverageAnalyzerIntegrationTest {
    @Container
    static DuckDBContainer duckdb = new DuckDBContainer();

    @Test
    void analyzeCoverage_identifiesUnmatchedPatterns() {
        // Insert traces with no matching rules
        insertTrace("tenant1", "auth", "/new-endpoint", "200");

        CoverageReport report = analyzer.analyzeCoverage("tenant1", Duration.ofHours(1));

        assertThat(report.getUnmatchedPatterns())
            .anyMatch(p -> p.getPatternKey().contains("/new-endpoint"));
    }
}
```

## Files to Create/Modify

**New Files:**
- `backend/src/main/java/com/fluo/analytics/TracePatternExtractor.java`
- `backend/src/main/java/com/fluo/analytics/CoverageAnalyzer.java`
- `backend/src/main/java/com/fluo/routes/CoverageAnalyticsRoute.java`
- `backend/src/main/java/com/fluo/jobs/CoverageSnapshotJob.java`
- `backend/src/main/java/com/fluo/models/TracePattern.java`
- `backend/src/main/java/com/fluo/models/CoverageReport.java`
- `backend/src/test/java/com/fluo/analytics/TracePatternExtractorTest.java`

**Modified Files:**
- `backend/src/main/resources/application.properties`

## Success Criteria

- [ ] Pattern extraction with normalization
- [ ] Coverage calculation (matched / total patterns)
- [ ] Top 10 unmatched patterns identified
- [ ] Suggested rule DSL generated
- [ ] Admin-only API access
- [ ] Audit logging for coverage queries
- [ ] Hourly coverage snapshots
- [ ] Low coverage alerts (<70%)
- [ ] Test coverage >85%
