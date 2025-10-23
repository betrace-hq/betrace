# Sandbox Violation Forensics Guide

**PRD-006 Unit 3:** Grafana Loki queries and forensic investigation procedures for sandbox violations.

## Overview

When BeTrace's sandbox detects a violation, it emits:
1. **OpenTelemetry Span** - Compliance evidence with full context
2. **Application Log** - Searchable in Grafana Loki
3. **Prometheus Metric** - Violation counter (tracked in Unit 1 dashboard)

This guide covers forensic investigation using Grafana Loki's LogQL.

## Quick Investigation Checklist

When investigating a sandbox violation:

1. ✅ **Identify the tenant** - Which customer triggered the violation?
2. ✅ **Find the rule** - Which rule contains malicious code?
3. ✅ **Check operation** - What forbidden API was attempted?
4. ✅ **Review stack trace** - Where in the code did violation occur?
5. ✅ **Check frequency** - Is this a one-off or repeated attack?
6. ✅ **Correlate with spans** - Link logs to OpenTelemetry traces

## Grafana Loki Queries

### 1. All Sandbox Violations (Last 1 Hour)

```logql
{app="fluo-backend"} |= "Sandbox violation detected"
```

**Use Case:** Quick overview of all recent violations

**Example Output:**
```
2025-10-12T23:54:00Z Sandbox violation detected: tenant=tenant-123, operation=Runtime.exec, class=com.example.rules.tenant123.rule456, rule=rule456
```

---

### 2. Violations by Tenant

```logql
{app="fluo-backend"} |= "Sandbox violation detected" | regexp "tenant=(?P<tenant>[^,]+)" | line_format "{{.tenant}}: {{.operation}}"
```

**Use Case:** Identify which tenants have malicious rules

**Example Output:**
```
tenant-123: Runtime.exec
tenant-456: System.exit
tenant-123: java.lang.reflect.Method.setAccessible
```

---

### 3. Violations by Operation Type

```logql
{app="fluo-backend"} |= "Sandbox violation detected" | regexp "operation=(?P<operation>[^,]+)" | line_format "{{.operation}}: {{.className}}"
```

**Use Case:** Identify attack patterns (e.g., all `Runtime.exec` attempts)

**Example Output:**
```
Runtime.exec: com.example.rules.tenant123.rule456
System.exit: com.example.rules.tenant456.rule789
```

---

### 4. High Violation Rate (Possible Attack)

```logql
{app="fluo-backend"} |= "HIGH VIOLATION RATE detected"
```

**Use Case:** Detect DDoS or brute-force attacks (>10 violations per tenant)

**Example Output:**
```
2025-10-12T23:55:00Z HIGH VIOLATION RATE detected: tenant=tenant-123 has 15 violations. Possible attack!
```

**Action:** Immediately disable tenant's rules and investigate

---

### 5. Violations by Specific Rule

```logql
{app="fluo-backend"} |= "Sandbox violation detected" | regexp "rule=(?P<rule>rule[0-9]+)" | rule="rule456"
```

**Use Case:** Investigate a specific malicious rule

**Example Output:**
```
2025-10-12T23:54:00Z Sandbox violation detected: tenant=tenant-123, operation=Runtime.exec, class=com.example.rules.tenant123.rule456, rule=rule456
```

**Action:** Disable rule456, notify tenant, review rule source code

---

### 6. Stack Trace Forensics

```logql
{app="fluo-backend"} |= "Sandbox violation detected" | json | line_format "{{.stackTrace}}"
```

**Use Case:** Extract full stack traces for deep forensics

**Example Output:**
```
at com.example.rules.tenant123.rule456.execute(rule456.java:42)
at org.drools.core.runtime.impl.ExecutionFlowControl.executeQueuedActions(ExecutionFlowControl.java:123)
at com.fluo.rules.RuleExecutor.evaluate(RuleExecutor.java:89)
```

**Action:** Review rule456.java line 42 to understand attacker's intent

---

### 7. Violations with OpenTelemetry Correlation

```logql
{app="fluo-backend"} |= "Sandbox violation detected" | regexp "spanId=(?P<spanId>span-[0-9]+)"
```

**Use Case:** Link logs to OpenTelemetry traces for full request context

**Example Output:**
```
2025-10-12T23:54:00Z Sandbox violation detected: tenant=tenant-123, operation=Runtime.exec, spanId=span-789
```

**Action:** Open Grafana Traces, search for `span-789` to see full trace

---

### 8. Violation Timeline (Aggregated by Hour)

```logql
sum by (tenant) (
  count_over_time(
    {app="fluo-backend"} |= "Sandbox violation detected" [1h]
  )
)
```

**Use Case:** Identify violation trends over time

**Example Output:**
```
tenant-123: 15 violations/hour
tenant-456: 3 violations/hour
```

**Action:** Prioritize investigation of tenant-123 (high rate)

---

### 9. Violations by Class Name (Identify Malicious Code)

```logql
{app="fluo-backend"} |= "Sandbox violation detected" | regexp "class=(?P<className>[^,]+)" | line_format "{{.className}}"
```

**Use Case:** Find all classes attempting forbidden operations

**Example Output:**
```
com.example.rules.tenant123.rule456
com.example.rules.tenant123.rule789
com.example.rules.tenant456.rule111
```

**Action:** Review rule source code for backdoors or exploits

---

### 10. Compliance Evidence Export (SOC2/HIPAA)

```logql
{app="fluo-backend"} |= "Sandbox violation detected" | json | line_format "tenant={{.tenant}}, operation={{.operation}}, timestamp={{.timestamp}}, spanId={{.spanId}}"
```

**Use Case:** Generate audit log for compliance auditors

**Example Output (CSV-friendly):**
```
tenant=tenant-123, operation=Runtime.exec, timestamp=2025-10-12T23:54:00Z, spanId=span-789
tenant=tenant-456, operation=System.exit, timestamp=2025-10-12T23:55:00Z, spanId=span-790
```

**Action:** Export to CSV, provide to auditor as SOC2 CC7.2 evidence

---

## Grafana Dashboard Integration

### Create Violation Forensics Dashboard

1. Navigate to **Grafana → Dashboards → New Dashboard**
2. Add panels with the queries above
3. Set time range to **Last 24 hours**
4. Enable auto-refresh (30 seconds)

### Recommended Panels

| Panel | Query | Type | Purpose |
|-------|-------|------|---------|
| Total Violations (24h) | Query #1 | Stat | Quick overview |
| Violations by Tenant | Query #2 | Table | Identify malicious tenants |
| Violations by Operation | Query #3 | Pie Chart | Attack pattern analysis |
| High Violation Alerts | Query #4 | Logs | Real-time attack detection |
| Violation Timeline | Query #8 | Graph | Trend analysis |

---

## OpenTelemetry Trace Investigation

### 1. Find Violation Span in Grafana Traces

Navigate to **Grafana → Explore → Traces**

**TraceQL Query:**
```
{span.event.type = "security.sandbox.violation"}
```

### 2. Inspect Span Attributes

Click on violation span to see:
- `tenant.id` - Tenant identifier
- `violation.operation` - Forbidden method
- `violation.className` - Rule class
- `violation.ruleId` - Rule identifier
- `violation.stackTrace` - Full stack trace
- `compliance.framework` - SOC2
- `compliance.control` - CC7.2
- `compliance.evidenceType` - audit_trail

### 3. Correlate with Parent Trace

Click **Show Full Trace** to see:
- HTTP request that triggered rule evaluation
- Rule execution duration
- Database queries (if any)
- Downstream service calls

**Use Case:** Understand full context of violation (was it part of legitimate request?)

---

## Incident Response Procedures

### Level 1: Single Violation (Low Priority)

**Symptoms:** 1-2 violations from a tenant

**Actions:**
1. Log violation for future reference
2. Monitor tenant for repeat violations
3. No immediate action required

**Timeline:** Review within 24 hours

---

### Level 2: Repeated Violations (Medium Priority)

**Symptoms:** 3-10 violations from same tenant/rule

**Actions:**
1. Review rule source code for intent
2. Contact tenant to verify behavior
3. Consider disabling rule if malicious
4. Document findings in security log

**Timeline:** Investigate within 4 hours

---

### Level 3: High Violation Rate (High Priority)

**Symptoms:** >10 violations per tenant (DDoS/attack indicator)

**Actions:**
1. **IMMEDIATE:** Disable tenant's rules
2. Alert security team
3. Review all rules from tenant for backdoors
4. Contact tenant, require code review before re-enabling
5. File security incident report

**Timeline:** Respond within 15 minutes

---

### Level 4: Critical Attack (P0 Emergency)

**Symptoms:** Violations from multiple tenants, coordinated attack

**Actions:**
1. **IMMEDIATE:** Enable global read-only mode
2. Escalate to on-call security engineer
3. Review all recent rule deployments
4. Check for supply chain compromise (malicious library?)
5. Notify customers of potential incident
6. Engage incident response team

**Timeline:** Respond within 5 minutes

---

## Automated Alerting

### Grafana Alerting Rules

Add to **Grafana → Alerting → Alert Rules**:

#### Alert 1: High Violation Rate

```yaml
name: High Sandbox Violation Rate
condition: |
  sum by (tenant) (
    count_over_time(
      {app="fluo-backend"} |= "Sandbox violation detected" [5m]
    )
  ) > 10
severity: critical
notify: security-team
```

#### Alert 2: New Tenant Violation

```yaml
name: First Violation from Tenant
condition: |
  {app="fluo-backend"} |= "Sandbox violation detected"
  | regexp "tenant=(?P<tenant>[^,]+)"
  | count by (tenant) == 1
severity: warning
notify: security-team
```

#### Alert 3: Repeated Same Operation

```yaml
name: Repeated Same Forbidden Operation
condition: |
  sum by (operation) (
    count_over_time(
      {app="fluo-backend"} |= "Sandbox violation detected" [1m]
    )
  ) > 5
severity: high
notify: security-team
```

---

## Compliance Evidence Export

### SOC2 CC7.2 (System Monitoring)

**Auditor Request:** "Provide evidence that security violations are logged and monitored"

**Evidence:**
1. Export Loki logs (Query #10) for audit period
2. Export OpenTelemetry spans with `compliance.control=CC7.2`
3. Provide Grafana dashboard screenshots showing violation tracking
4. Include incident response logs for any Level 3/4 violations

### HIPAA 164.312(b) (Audit Controls)

**Auditor Request:** "Demonstrate audit trail for PHI access violations"

**Evidence:**
1. Export logs showing violations during PHI-handling rule execution
2. Provide stack traces proving violation was blocked before PHI access
3. Show Grafana alerts configured for PHI-related violations
4. Document incident response procedures (this guide)

---

## Forensic Investigation Example

### Scenario: Tenant-123 Rule-456 Attempts Runtime.exec

**Step 1: Detect Violation**
```logql
{app="fluo-backend"} |= "tenant=tenant-123" |= "rule=rule456"
```

**Step 2: Review Stack Trace**
```logql
{app="fluo-backend"} |= "tenant=tenant-123" | json | line_format "{{.stackTrace}}"
```

**Step 3: Check Frequency**
```logql
sum by (rule) (
  count_over_time(
    {app="fluo-backend"} |= "tenant=tenant-123" [24h]
  )
)
```

**Step 4: Inspect Rule Source Code**
- Navigate to rule storage (S3/database)
- Review rule456 source code
- Look for `Runtime.getRuntime().exec()` calls

**Step 5: Determine Intent**
- **Malicious:** Disable rule, notify tenant, file incident report
- **Accidental:** Contact tenant, provide API alternatives, re-enable after fix

**Step 6: Document Findings**
- Create security incident ticket
- Add notes to tenant profile
- Update runbook if new attack pattern discovered

---

## Performance Considerations

### Log Volume

**Expected Volume:** 1-10 violations/day per 100 rules

**High Volume Mitigation:**
- Sample violations at 10% for high-volume tenants (configurable)
- Aggregate violations by rule (not per-invocation)
- Use Loki retention policies (30 days for violations)

### Query Performance

**Fast Queries (<1s):**
- Queries with time range < 1 hour
- Queries with specific tenant/rule filter
- Queries using indexed labels

**Slow Queries (>5s):**
- Full-text search across all logs
- Regex parsing without filters
- Aggregations over 24+ hours

**Optimization:**
- Add indexed labels for tenant, rule, operation
- Use Loki's `|=` operator before `| regexp`
- Limit time range to relevant window

---

## References

- **PRD-006:** Sandbox Monitoring and Hardening (Unit 3)
- **LogQL Documentation:** https://grafana.com/docs/loki/latest/logql/
- **TraceQL Documentation:** https://grafana.com/docs/tempo/latest/traceql/
- **SOC2 CC7.2:** System Monitoring Control
- **HIPAA 164.312(b):** Audit Controls
