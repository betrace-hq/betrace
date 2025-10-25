# BeTrace Compliance Evidence: Auditor Guide

This guide shows compliance auditors how to query and export evidence from BeTrace for SOC2, HIPAA, GDPR, and FedRAMP audits.

## Overview

BeTrace generates compliance evidence as **OpenTelemetry spans** stored in **Grafana Tempo**. Each evidence span contains:
- **Framework**: SOC2, HIPAA, GDPR, or FedRAMP
- **Control**: Specific control ID (e.g., CC6.1, 164.312(b), Art. 15, AC-3)
- **Outcome**: granted/denied/success/failure/etc.
- **Timestamp**: When the event occurred
- **Context**: user_id, resource, operation, etc.
- **Tamper-evident**: HMAC-SHA256 signatures (see `docs/compliance-status.md`)

## Accessing the System

### 1. Access Grafana

```bash
# URL: http://localhost:12015
# Default credentials: admin/admin
```

### 2. Navigate to Explore

```
Grafana → Explore → Select "Tempo" data source
```

## Query Examples

### SOC2 Trust Service Criteria

#### CC6.1 - Logical Access Controls

**Query all access control decisions:**
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"}
```

**Query denied access attempts:**
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1" && span.compliance.outcome = "denied"}
```

**Query access by specific user:**
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1" && span.user_id = "user-123"}
```

**Query access to specific resource:**
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1" && span.resource = "/api/sensitive-data"}
```

#### CC6.3 - Data Isolation

**Query all tenant isolation checks:**
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.3"}
```

**Query isolation violations (critical!):**
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.3" && span.compliance.outcome = "violation"}
```

**Query isolation by tenant:**
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.3" && span.tenant_id = "tenant-abc"}
```

#### CC7.1 - System Monitoring

**Query all monitoring evidence:**
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC7.1"}
```

**Query rule matches (anomalies detected):**
```traceql
{span.name = "rule.evaluate" && span.rule.matched = true}
```

#### CC7.2 - System Performance

**Query all performance audit events:**
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC7.2"}
```

### HIPAA Technical Safeguards

#### 164.312(a) - Access Control

**Query all PHI access control decisions:**
```traceql
{span.compliance.framework = "hipaa" && span.compliance.control = "164.312(a)"}
```

#### 164.312(b) - Audit Controls

**Query all PHI access logs:**
```traceql
{span.compliance.framework = "hipaa" && span.compliance.control = "164.312(b)"}
```

**Query access by specific healthcare provider:**
```traceql
{span.compliance.framework = "hipaa" && span.compliance.control = "164.312(b)" && span.user_id = "doctor-smith"}
```

**Query access to specific PHI type:**
```traceql
{span.compliance.framework = "hipaa" && span.compliance.control = "164.312(b)" && span.phi_type = "medical_record"}
```

#### 164.312(a)(2)(iv) - Encryption/Decryption

**Query all PHI encryption events:**
```traceql
{span.compliance.framework = "hipaa" && span.compliance.control = "164.312(a)(2)(iv)"}
```

**Query encryption failures (critical!):**
```traceql
{span.compliance.framework = "hipaa" && span.compliance.control = "164.312(a)(2)(iv)" && span.compliance.outcome = "failure"}
```

### GDPR Articles

#### Art. 15 - Right of Access

**Query all data access requests:**
```traceql
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 15"}
```

**Query denied access requests:**
```traceql
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 15" && span.compliance.outcome = "denied"}
```

**Query access requests by data subject:**
```traceql
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 15" && span.data_subject_id = "user-jane"}
```

#### Art. 17 - Right to Erasure

**Query all deletion requests:**
```traceql
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 17"}
```

**Query completed deletions:**
```traceql
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 17" && span.status = "completed"}
```

**Query pending deletions (SLA monitoring):**
```traceql
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 17" && span.status = "pending"}
```

#### Art. 7 - Consent

**Query all consent events:**
```traceql
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 7"}
```

**Query consent grants:**
```traceql
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 7" && span.action = "granted"}
```

**Query consent revocations:**
```traceql
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 7" && span.action = "revoked"}
```

### FedRAMP Controls

#### AU-2 - Audit Events

**Query all audit events:**
```traceql
{span.compliance.framework = "fedramp" && span.compliance.control = "AU-2"}
```

**Query admin events:**
```traceql
{span.compliance.framework = "fedramp" && span.compliance.control = "AU-2" && span.event_type = "admin"}
```

#### AC-3 - Access Enforcement

**Query all access enforcement decisions:**
```traceql
{span.compliance.framework = "fedramp" && span.compliance.control = "AC-3"}
```

**Query denied access (security alerts):**
```traceql
{span.compliance.framework = "fedramp" && span.compliance.control = "AC-3" && span.compliance.outcome = "denied"}
```

### Compliance Violations

**Query all violations (any framework):**
```traceql
{span.name = "compliance.violation"}
```

**Query SOC2 violations:**
```traceql
{span.name = "compliance.violation" && span.compliance.framework = "soc2"}
```

**Query HIPAA violations:**
```traceql
{span.name = "compliance.violation" && span.compliance.framework = "hipaa"}
```

**Query critical violations:**
```traceql
{span.name = "compliance.violation" && span.compliance.severity = "critical"}
```

## Time Range Queries

### Last 24 Hours

```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"} | duration >= 0
```

Use Grafana's time picker (top-right) to select "Last 24 hours".

### Specific Audit Period

For SOC2 Type II (12-month observation period):

1. Click time picker → "Absolute time range"
2. Start: 2024-01-01 00:00:00
3. End: 2024-12-31 23:59:59
4. Run query

### High-Volume Sampling

For large audit periods, use sampling:

```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"} | rate() > 0.01
```

## Exporting Evidence

### Method 1: Grafana Export (Recommended)

1. Run query in Explore
2. Click "Inspector" → "Data"
3. Click "Download CSV" or "Download JSON"
4. Save file with naming: `SOC2_CC6.1_Evidence_2024-01-01_to_2024-12-31.csv`

### Method 2: API Export (Automated)

```bash
#!/bin/bash
# Export SOC2 CC6.1 evidence for last 12 months

GRAFANA_URL="http://localhost:12015"
GRAFANA_TOKEN="your-api-token"  # Create in Grafana → Configuration → API Keys

START_TIME="2024-01-01T00:00:00Z"
END_TIME="2024-12-31T23:59:59Z"

QUERY='{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"}'

curl -H "Authorization: Bearer $GRAFANA_TOKEN" \
     -G "$GRAFANA_URL/api/datasources/proxy/tempo/api/search" \
     --data-urlencode "q=$QUERY" \
     --data-urlencode "start=$START_TIME" \
     --data-urlencode "end=$END_TIME" \
     -o "SOC2_CC6.1_Evidence.json"
```

### Method 3: Bulk Export Script

Create `export-compliance-evidence.sh`:

```bash
#!/bin/bash
set -euo pipefail

GRAFANA_URL="${GRAFANA_URL:-http://localhost:12015}"
GRAFANA_TOKEN="${GRAFANA_TOKEN:-}"
OUTPUT_DIR="./compliance-evidence-$(date +%Y%m%d)"

mkdir -p "$OUTPUT_DIR"

# Export function
export_evidence() {
    local framework=$1
    local control=$2
    local start=$3
    local end=$4

    local filename="${OUTPUT_DIR}/${framework}_${control}_${start}_to_${end}.json"
    local query="{span.compliance.framework = \"${framework}\" && span.compliance.control = \"${control}\"}"

    echo "Exporting $framework $control..."

    curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
         -G "$GRAFANA_URL/api/datasources/proxy/tempo/api/search" \
         --data-urlencode "q=$query" \
         --data-urlencode "start=$start" \
         --data-urlencode "end=$end" \
         -o "$filename"

    echo "  → Saved to $filename"
}

# SOC2 Controls
export_evidence "soc2" "CC6.1" "2024-01-01T00:00:00Z" "2024-12-31T23:59:59Z"
export_evidence "soc2" "CC6.3" "2024-01-01T00:00:00Z" "2024-12-31T23:59:59Z"
export_evidence "soc2" "CC7.1" "2024-01-01T00:00:00Z" "2024-12-31T23:59:59Z"

# HIPAA Controls
export_evidence "hipaa" "164.312(a)" "2024-01-01T00:00:00Z" "2024-12-31T23:59:59Z"
export_evidence "hipaa" "164.312(b)" "2024-01-01T00:00:00Z" "2024-12-31T23:59:59Z"

# GDPR Articles
export_evidence "gdpr" "Art. 15" "2024-01-01T00:00:00Z" "2024-12-31T23:59:59Z"
export_evidence "gdpr" "Art. 17" "2024-01-01T00:00:00Z" "2024-12-31T23:59:59Z"

# FedRAMP Controls
export_evidence "fedramp" "AU-2" "2024-01-01T00:00:00Z" "2024-12-31T23:59:59Z"
export_evidence "fedramp" "AC-3" "2024-01-01T00:00:00Z" "2024-12-31T23:59:59Z"

echo ""
echo "✅ Evidence export complete: $OUTPUT_DIR"
echo "   Files ready for auditor review"
```

Usage:
```bash
export GRAFANA_TOKEN="your-api-token"
chmod +x export-compliance-evidence.sh
./export-compliance-evidence.sh
```

## Evidence Verification

### Verify Span Signatures (Tamper-Evident)

All compliance spans include HMAC-SHA256 signatures. To verify:

1. Extract span from Tempo
2. Verify `compliance.tamper_evident = true` attribute
3. Check signature field (implementation in `backend/internal/observability`)

### Verify Audit Trail Completeness

**Check for gaps:**
```promql
# Prometheus query for evidence gaps
rate(betrace_compliance_audit_trail_gaps_total[1h]) > 0
```

**Verify continuous coverage:**
```traceql
# Should return spans for every hour in audit period
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"}
```

## Common Audit Scenarios

### SOC2 Type II Audit

**Required evidence (12-month period):**

1. **CC6.1 - Access Control**
   - Query: All access decisions
   - Export: `SOC2_CC6.1_Access_Control_2024.csv`
   - Sample size: Statistical sample per auditor guidance

2. **CC6.3 - Data Isolation**
   - Query: All isolation checks
   - Export: `SOC2_CC6.3_Data_Isolation_2024.csv`
   - Requirement: ZERO violations

3. **CC7.1 - System Monitoring**
   - Query: All monitoring events
   - Export: `SOC2_CC7.1_Monitoring_2024.csv`
   - Requirement: Continuous coverage

### HIPAA Compliance Assessment

**Required evidence:**

1. **164.312(b) - Audit Logs**
   - Query: All PHI access logs
   - Export: `HIPAA_164.312b_Audit_Logs_2024.csv`
   - Requirement: Every PHI access logged

2. **164.312(a)(2)(iv) - Encryption**
   - Query: All encryption events
   - Export: `HIPAA_164.312a2iv_Encryption_2024.csv`
   - Requirement: 100% PHI encrypted

### GDPR Data Subject Rights

**Required evidence:**

1. **Art. 15 - Right of Access**
   - Query: All data access requests
   - Export: `GDPR_Art15_Access_Requests_2024.csv`
   - SLA: Response within 30 days

2. **Art. 17 - Right to Erasure**
   - Query: All deletion requests
   - Export: `GDPR_Art17_Deletions_2024.csv`
   - SLA: Completion within 30 days

### FedRAMP ATO Evidence

**Required evidence:**

1. **AU-2 - Audit Events**
   - Query: All audit events
   - Export: `FedRAMP_AU2_Audit_Events_2024.csv`
   - Requirement: All security-relevant events logged

2. **AC-3 - Access Enforcement**
   - Query: All access decisions
   - Export: `FedRAMP_AC3_Access_Enforcement_2024.csv`
   - Requirement: All access controlled

## Statistics and Metrics

### Prometheus Queries for Audit Reports

**SOC2 CC6.1 - Access Control Success Rate:**
```promql
sum(increase(betrace_soc2_access_control_checks_total{outcome="granted"}[1y])) /
sum(increase(betrace_soc2_access_control_checks_total[1y]))
```

**HIPAA 164.312(b) - Total Access Logs:**
```promql
sum(increase(betrace_hipaa_access_log_entries_total[1y]))
```

**GDPR Art. 17 - Deletion Completion Rate:**
```promql
sum(increase(betrace_gdpr_data_deletion_requests_total{status="completed"}[1y])) /
sum(increase(betrace_gdpr_data_deletion_requests_total[1y]))
```

**Compliance Violations (any framework):**
```promql
sum(increase(betrace_compliance_violations_detected_total[1y])) by (framework, control, severity)
```

## Troubleshooting

### No Evidence Spans Found

1. Check time range (ensure within retention period)
2. Verify Tempo is running: `flox services status tempo`
3. Check backend is emitting spans: `flox services status backend`
4. Verify OTEL configuration: `echo $OTEL_EXPORTER_OTLP_ENDPOINT`

### Incomplete Evidence

1. Query for gaps: `rate(betrace_compliance_audit_trail_gaps_total[1h])`
2. Check Grafana alerts for "Evidence Gap" notifications
3. Review backend logs for span export errors

### Performance Issues

For large audit periods (>1 year), use:
1. Sampling: `| rate() > 0.01` in TraceQL
2. Pagination: Query smaller time chunks
3. Export to file instead of UI viewing

## Contact

For questions about compliance evidence:
- Technical issues: See `backend/internal/observability/README.md`
- Compliance questions: See `docs/compliance-status.md`
- Audit process: Contact BeTrace security team

## Retention Policy

**BeTrace compliance evidence retention:**
- Minimum: 30 days (operational)
- Recommended: 12 months (SOC2 Type II)
- HIPAA: 6 years
- Configure in Tempo: `.flox/configs/tempo.yaml`
