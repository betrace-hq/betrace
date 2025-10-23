# PRD-023C: Compliance Reporting

**Priority:** P2 (Medium - Audit Support)
**Complexity:** Low
**Personas:** Compliance Officer, Auditor
**Dependencies:** PRD-023A (metrics)
**Implements:** Evidence export for SOC2/HIPAA audits

## Problem

Auditors require evidence of continuous monitoring:
- **SOC2 CC8.1**: "The entity monitors, evaluates, and communicates control deficiencies in a timely manner"
- **HIPAA 164.312(b)**: "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems"
- **Manual evidence collection**: SREs manually compile metrics for auditors (4+ hours/quarter)
- **No standardized format**: Evidence varies between audits, causing re-work

**Impact:**
- Audit delays: 2-4 weeks waiting for evidence
- Non-compliance risk: Missing evidence = control deficiency findings
- Engineering toil: Manual report generation instead of product work

## Solution

### Compliance Report CSV Export

**CSV Schema:**
```csv
date,tenant_id,rule_id,rule_name,framework,control_id,evaluation_count,match_count,signal_count,match_rate,signal_rate,false_positive_rate,p95_latency_ms
2025-01-15,tenant-a,rule-123,auth-check-required,soc2,CC6.1,15234,6894,842,0.45,0.12,0.08,23
2025-01-15,tenant-a,rule-456,pii-access-logged,hipaa,164.312(b),8932,8932,0,1.00,0.00,0.00,12
```

**Fields:**
- `date`: Aggregation date (daily)
- `tenant_id`: Tenant identifier
- `rule_id`: Rule UUID
- `rule_name`: Human-readable rule name
- `framework`: Compliance framework (soc2, hipaa, gdpr)
- `control_id`: Specific control (CC6.1, 164.312(b))
- `evaluation_count`: Total evaluations for the day
- `match_count`: Traces that matched rule
- `signal_count`: Signals generated
- `match_rate`: `match_count / evaluation_count`
- `signal_rate`: `signal_count / match_count`
- `false_positive_rate`: `false_positive_count / signal_count`
- `p95_latency_ms`: 95th percentile evaluation latency

## Implementation

### Compliance Report Generator

**File:** `backend/src/main/java/com/betrace/compliance/ComplianceReportGenerator.java`

```java
@ApplicationScoped
public class ComplianceReportGenerator {
    @Inject PrometheusClient prometheus;
    @Inject RuleService ruleService;

    public byte[] generateReport(
        String tenantId,
        Instant startDate,
        Instant endDate,
        ComplianceFramework framework
    ) {
        // Query rules for framework
        List<Rule> rules = ruleService.getRulesForFramework(tenantId, framework);

        // Generate daily aggregations
        List<ComplianceReportRow> rows = new ArrayList<>();
        for (LocalDate date = startDate.atZone(ZoneOffset.UTC).toLocalDate();
             date.isBefore(endDate.atZone(ZoneOffset.UTC).toLocalDate());
             date = date.plusDays(1)) {

            for (Rule rule : rules) {
                ComplianceReportRow row = aggregateMetricsForDay(tenantId, rule, date);
                rows.add(row);
            }
        }

        // Convert to CSV
        return toCsv(rows);
    }

    private ComplianceReportRow aggregateMetricsForDay(String tenantId, Rule rule, LocalDate date) {
        Instant dayStart = date.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant dayEnd = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        // Query Prometheus for daily metrics
        long evaluations = prometheus.querySum(
            "betrace_rule_evaluations_total{tenant_id='" + tenantId + "', rule_id='" + rule.getId() + "'}",
            dayStart, dayEnd
        );

        long matches = prometheus.querySum(
            "betrace_rule_matches_total{tenant_id='" + tenantId + "', rule_id='" + rule.getId() + "'}",
            dayStart, dayEnd
        );

        long signals = prometheus.querySum(
            "betrace_rule_signals_generated_total{tenant_id='" + tenantId + "', rule_id='" + rule.getId() + "'}",
            dayStart, dayEnd
        );

        long falsePositives = prometheus.querySum(
            "betrace_rule_signals_false_positive_total{tenant_id='" + tenantId + "', rule_id='" + rule.getId() + "'}",
            dayStart, dayEnd
        );

        double p95Latency = prometheus.queryQuantile(
            0.95,
            "betrace_rule_evaluation_duration_seconds{tenant_id='" + tenantId + "', rule_id='" + rule.getId() + "'}",
            dayStart, dayEnd
        ) * 1000; // Convert to ms

        // Calculate rates
        double matchRate = evaluations > 0 ? (double) matches / evaluations : 0.0;
        double signalRate = matches > 0 ? (double) signals / matches : 0.0;
        double fpRate = signals > 0 ? (double) falsePositives / signals : 0.0;

        return new ComplianceReportRow(
            date,
            tenantId,
            rule.getId(),
            rule.getName(),
            rule.getFramework().name().toLowerCase(),
            rule.getControlId(),
            evaluations,
            matches,
            signals,
            matchRate,
            signalRate,
            fpRate,
            p95Latency
        );
    }

    private byte[] toCsv(List<ComplianceReportRow> rows) {
        StringBuilder csv = new StringBuilder();

        // Header
        csv.append("date,tenant_id,rule_id,rule_name,framework,control_id,");
        csv.append("evaluation_count,match_count,signal_count,");
        csv.append("match_rate,signal_rate,false_positive_rate,p95_latency_ms\n");

        // Rows
        for (ComplianceReportRow row : rows) {
            csv.append(String.format(
                "%s,%s,%s,%s,%s,%s,%d,%d,%d,%.4f,%.4f,%.4f,%.2f\n",
                row.date(),
                row.tenantId(),
                row.ruleId(),
                escapeCsv(row.ruleName()),
                row.framework(),
                row.controlId(),
                row.evaluationCount(),
                row.matchCount(),
                row.signalCount(),
                row.matchRate(),
                row.signalRate(),
                row.falsePositiveRate(),
                row.p95LatencyMs()
            ));
        }

        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String escapeCsv(String value) {
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}

record ComplianceReportRow(
    LocalDate date,
    String tenantId,
    String ruleId,
    String ruleName,
    String framework,
    String controlId,
    long evaluationCount,
    long matchCount,
    long signalCount,
    double matchRate,
    double signalRate,
    double falsePositiveRate,
    double p95LatencyMs
) {}
```

### Compliance API

**File:** `backend/src/main/java/com/betrace/routes/ComplianceReportRoute.java`

```java
@Path("/api/compliance/reports")
@ApplicationScoped
public class ComplianceReportRoute {
    @Inject ComplianceReportGenerator generator;
    @Inject AuthorizationService authz;

    @GET
    @Path("/rule-analytics")
    @RolesAllowed("EXPORT_EVIDENCE")
    @Produces("text/csv")
    @SOC2(controls = {CC6_1, CC7_2}, notes = "Evidence export requires authorization + audit")
    public Response exportRuleAnalytics(
        @QueryParam("start") LocalDate start,
        @QueryParam("end") LocalDate end,
        @QueryParam("framework") @DefaultValue("soc2") String frameworkStr,
        @Context SecurityContext ctx
    ) {
        String tenantId = ctx.getUserPrincipal().getName();

        // P0 Security: Verify permission
        if (!authz.hasPermission(ctx.getUserPrincipal(), "EXPORT_EVIDENCE")) {
            throw new ForbiddenException("Requires EXPORT_EVIDENCE permission");
        }

        // Validate date range (max 1 year)
        if (ChronoUnit.DAYS.between(start, end) > 365) {
            throw new BadRequestException("Max date range: 1 year");
        }

        ComplianceFramework framework = ComplianceFramework.valueOf(frameworkStr.toUpperCase());

        // Generate report
        byte[] csv = generator.generateReport(
            tenantId,
            start.atStartOfDay(ZoneOffset.UTC).toInstant(),
            end.atStartOfDay(ZoneOffset.UTC).toInstant(),
            framework
        );

        // P0 Security: Emit compliance span
        emitComplianceSpan(SOC2, CC7_2, "evidence_export", Map.of(
            "tenant_id", tenantId,
            "user_id", ctx.getUserPrincipal().getName(),
            "framework", framework.name(),
            "start_date", start.toString(),
            "end_date", end.toString(),
            "row_count", csv.length / 100 // Rough estimate
        ));

        // P1 Security: Audit log
        auditLog.info("Compliance report exported", Map.of(
            "user", ctx.getUserPrincipal().getName(),
            "tenant", tenantId,
            "framework", framework.name(),
            "start", start.toString(),
            "end", end.toString()
        ));

        // Generate filename
        String filename = String.format(
            "compliance_%s_%s_%s_%s.csv",
            framework.name().toLowerCase(),
            tenantId,
            start,
            end
        );

        return Response.ok(csv)
            .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
            .build();
    }

    @GET
    @Path("/control-mapping")
    @RolesAllowed("EXPORT_EVIDENCE")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getControlMapping(@Context SecurityContext ctx) {
        String tenantId = ctx.getUserPrincipal().getName();

        // List all rules with compliance mappings
        List<Rule> rules = ruleService.getRulesForTenant(tenantId);

        List<ControlMapping> mappings = rules.stream()
            .filter(r -> r.getFramework() != null)
            .map(r -> new ControlMapping(
                r.getId(),
                r.getName(),
                r.getFramework().name(),
                r.getControlId(),
                r.getEvidenceType().name()
            ))
            .collect(Collectors.toList());

        return Response.ok(mappings).build();
    }
}

record ControlMapping(
    String ruleId,
    String ruleName,
    String framework,
    String controlId,
    String evidenceType
) {}
```

### Scheduled Report Generation

**File:** `backend/src/main/java/com/betrace/jobs/ComplianceReportJob.java`

```java
@ApplicationScoped
public class ComplianceReportJob {
    @Inject ComplianceReportGenerator generator;
    @Inject S3Client s3;

    @ConfigProperty(name = "compliance.report.s3.bucket")
    Optional<String> s3Bucket;

    @Scheduled(cron = "0 0 1 * * ?") // Daily at 1 AM
    public void generateDailyReports() {
        if (s3Bucket.isEmpty()) {
            log.info("Compliance report archival disabled (no S3 bucket)");
            return;
        }

        List<String> tenants = tenantService.getAllTenantIds();

        for (String tenantId : tenants) {
            try {
                // Generate last 30 days report
                LocalDate end = LocalDate.now();
                LocalDate start = end.minusDays(30);

                for (ComplianceFramework framework : ComplianceFramework.values()) {
                    byte[] csv = generator.generateReport(
                        tenantId,
                        start.atStartOfDay(ZoneOffset.UTC).toInstant(),
                        end.atStartOfDay(ZoneOffset.UTC).toInstant(),
                        framework
                    );

                    // Upload to S3
                    String key = String.format(
                        "compliance-reports/%s/%s/%s_%s.csv",
                        tenantId,
                        framework.name().toLowerCase(),
                        start,
                        end
                    );

                    s3.putObject(PutObjectRequest.builder()
                        .bucket(s3Bucket.get())
                        .key(key)
                        .serverSideEncryption(ServerSideEncryption.AES256)
                        .build(),
                        RequestBody.fromBytes(csv)
                    );

                    log.infof("Compliance report archived: %s", key);
                }
            } catch (Exception e) {
                log.errorf(e, "Failed to generate compliance report for tenant %s", tenantId);
            }
        }
    }
}
```

## Security Requirements

### P0 (Blocking)

**1. Authorization**
- Require `EXPORT_EVIDENCE` permission
- Test:
```java
@Test
void shouldRequirePermissionForExport() {
    User userWithoutPermission = new User("viewer");

    assertThatThrownBy(() ->
        reportRoute.exportRuleAnalytics(start, end, "soc2", userWithoutPermission)
    ).isInstanceOf(ForbiddenException.class);
}
```

**2. PII Redaction**
- CSV MUST NOT contain PII (no user_id, email, ip_address)
- Only aggregate metrics allowed
- Test:
```java
@Test
void csvShouldNotContainPII() {
    byte[] csv = generator.generateReport(tenantId, start, end, SOC2);
    String content = new String(csv);

    assertThat(content).doesNotContainPattern("@");  // No emails
    assertThat(content).doesNotContainPattern("\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}");  // No IPs
}
```

**3. Audit Logging**
- Log all evidence exports
- Log format:
```json
{
  "event": "evidence_export",
  "user_id": "auditor@example.com",
  "tenant_id": "tenant-xyz",
  "framework": "soc2",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "row_count": 12453,
  "timestamp": "2025-10-11T10:23:45.123Z"
}
```

### P1 (High Priority)

**4. S3 Encryption**
- Archived reports MUST use server-side encryption (AES256)
- Configuration:
```properties
compliance.report.s3.bucket=betrace-compliance-reports
compliance.report.s3.encryption=AES256
```

**5. Retention Policy**
- SOC2: 7 years minimum
- HIPAA: 6 years minimum
- Implement S3 lifecycle policy:
```json
{
  "Rules": [{
    "Id": "compliance-retention",
    "Status": "Enabled",
    "Transitions": [
      {"Days": 90, "StorageClass": "STANDARD_IA"},
      {"Days": 365, "StorageClass": "GLACIER"}
    ],
    "Expiration": {"Days": 2555}
  }]
}
```

## Configuration

**File:** `application.properties`

```properties
# Compliance reporting
compliance.report.max-date-range-days=365
compliance.report.s3.bucket=betrace-compliance-reports
compliance.report.s3.encryption=AES256

# Scheduled archival
compliance.report.schedule=0 0 1 * * ?  # Daily at 1 AM
compliance.report.retention-years=7

# Authorization
compliance.export.permission=EXPORT_EVIDENCE
compliance.export.require-mfa=true
```

## Acceptance Criteria

### Functional Requirements

**CSV Generation:**
```gherkin
Scenario: Generate compliance report
  Given rule "R1" with framework=SOC2, control=CC6.1
  And 30 days of metrics data
  When compliance report is generated
  Then CSV contains 30 rows (one per day)
  And each row includes: date, rule_id, framework, control_id, metrics

Scenario: CSV format is valid
  Given compliance report CSV
  When parsed by standard CSV library
  Then all rows parse successfully
  And header matches schema
```

**Filtering:**
```gherkin
Scenario: Filter by framework
  Given rules for SOC2 and HIPAA
  When report generated with framework=soc2
  Then CSV contains only SOC2 rules
  And HIPAA rules are excluded
```

**Date Range:**
```gherkin
Scenario: Validate date range
  Given start=2024-01-01, end=2026-01-01 (2 years)
  When report requested
  Then 400 Bad Request returned
  And error message: "Max date range: 1 year"
```

### Security Requirements

```gherkin
Scenario: Authorization required
  Given user without EXPORT_EVIDENCE permission
  When GET /api/compliance/reports/rule-analytics
  Then 403 Forbidden response returned

Scenario: No PII in CSV
  Given compliance report with 1000 rows
  When CSV is generated
  Then CSV contains NO email addresses
  And CSV contains NO IP addresses
  And CSV contains only aggregate metrics

Scenario: Export audited
  Given user exports compliance report
  When export completes
  Then audit log contains:
    - event: evidence_export
    - user_id: <user>
    - framework: soc2
    - row_count: <count>
```

## Testing Strategy

### Unit Tests

**CSV Generation:**
```java
@Test
void generateReport_validCsvFormat() {
    byte[] csv = generator.generateReport(tenantId, start, end, SOC2);
    String content = new String(csv);

    String[] lines = content.split("\n");
    assertThat(lines[0]).startsWith("date,tenant_id,rule_id");

    // Parse with CSV library
    CSVReader reader = new CSVReader(new StringReader(content));
    List<String[]> rows = reader.readAll();
    assertThat(rows).hasSizeGreaterThan(1); // Header + data
}
```

**Security:**
```java
@Test
void csvShouldNotContainPII() {
    byte[] csv = generator.generateReport(tenantId, start, end, SOC2);
    String content = new String(csv);

    assertThat(content).doesNotContainPattern("\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b");
}
```

### Integration Tests

**End-to-End:**
```java
@QuarkusTest
class ComplianceReportIntegrationTest {
    @Test
    void exportReport_requiresPermission() {
        given()
            .auth().oauth2(tokenWithoutPermission())
            .queryParam("start", "2025-01-01")
            .queryParam("end", "2025-01-31")
            .when().get("/api/compliance/reports/rule-analytics")
            .then()
            .statusCode(403);
    }

    @Test
    void exportReport_validCsv() {
        String csv = given()
            .auth().oauth2(tokenWithPermission("EXPORT_EVIDENCE"))
            .queryParam("start", "2025-01-01")
            .queryParam("end", "2025-01-31")
            .when().get("/api/compliance/reports/rule-analytics")
            .then()
            .statusCode(200)
            .header("Content-Disposition", containsString("attachment"))
            .extract().asString();

        assertThat(csv).contains("date,tenant_id,rule_id");
    }
}
```

## Files to Create/Modify

**New Files:**
- `backend/src/main/java/com/betrace/compliance/ComplianceReportGenerator.java`
- `backend/src/main/java/com/betrace/routes/ComplianceReportRoute.java`
- `backend/src/main/java/com/betrace/jobs/ComplianceReportJob.java`
- `backend/src/test/java/com/betrace/compliance/ComplianceReportGeneratorTest.java`

**Modified Files:**
- `backend/src/main/resources/application.properties`
- `backend/pom.xml` (add AWS S3 SDK)

## Dependencies

**Maven:**
```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>s3</artifactId>
</dependency>
<dependency>
    <groupId>com.opencsv</groupId>
    <artifactId>opencsv</artifactId>
    <version>5.7.1</version>
</dependency>
```

## Success Criteria

- [ ] CSV export with valid schema
- [ ] Filtering by compliance framework
- [ ] Authorization: EXPORT_EVIDENCE permission required
- [ ] PII redaction (no emails, IPs)
- [ ] Audit logging for all exports
- [ ] S3 archival with encryption
- [ ] Daily scheduled report generation
- [ ] 7-year retention policy
- [ ] Test coverage >90%
- [ ] Sample CSV validated by auditor
