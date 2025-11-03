# BeTrace User Guide

**Version**: 2.0.0
**Last Updated**: 2025-11-02
**Target Audience**: Developers, SREs, DevOps Engineers

---

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Creating Rules](#creating-rules)
6. [Viewing Violations](#viewing-violations)
7. [Integration with Grafana](#integration-with-grafana)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)
10. [Next Steps](#next-steps)

---

## Introduction

### What is BeTrace?

BeTrace is a **behavioral pattern matching engine for OpenTelemetry traces**. It enables you to:

- **Define invariants** using BeTraceDSL (a Lua-based domain-specific language)
- **Detect violations** when trace patterns violate those invariants
- **Emit violations as OTLP spans** to your observability platform (Grafana/Tempo, SigNoz, Kibana)
- **Alert on violations** using your existing alerting infrastructure

### Use Cases

**For SREs**:
```
"I need to discover undocumented invariants that cause production incidents"
→ BeTrace finds patterns like 'PII access without audit log' or 'distributed deadlock'
```

**For Developers**:
```
"I want to enforce service contracts and catch misuse in production"
→ Define rules like 'span.service == "payment" and !span.has(attribute.auth_token)'
```

**For Compliance**:
```
"I need evidence that my controls are working (SOC2 CC6.1, HIPAA)"
→ BeTrace emits cryptographically-signed compliance spans for audit trails
```

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Your Application (OpenTelemetry instrumented)               │
│  - Emits traces to Tempo/Loki/etc                           │
└────────────────┬─────────────────────────────────────────────┘
                 ↓ (OTLP spans)
┌──────────────────────────────────────────────────────────────┐
│  BeTrace Backend (Go)                                        │
│  - Ingests spans via OTLP                                   │
│  - Evaluates BeTraceDSL rules                               │
│  - Emits violation spans to Tempo                           │
└────────────────┬─────────────────────────────────────────────┘
                 ↓ (Violation spans)
┌──────────────────────────────────────────────────────────────┐
│  Tempo (or other OTLP-compatible backend)                    │
│  - Stores violations as spans                                │
│  - Queryable by trace ID                                     │
└────────────────┬─────────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────────┐
│  Grafana (with BeTrace plugin)                               │
│  - Manage rules (CRUD)                                       │
│  - View violations                                           │
│  - Drill down to traces                                      │
│  - Set up alerts                                             │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 5-Minute Demo (Flox)

BeTrace uses **Flox** for development environment management. If you're using Nix Flakes instead, see [Alternative: Nix](#alternative-nix).

**Prerequisites**:
- [Flox installed](https://flox.dev/docs/install-flox/) (or Nix with flakes enabled)
- Docker (optional, for Tempo/Grafana)

**Steps**:

```bash
# 1. Clone repository
git clone https://github.com/betracehq/betrace.git
cd betrace

# 2. Start all services (Backend, Grafana, Tempo, Loki, Prometheus, Pyroscope, Alloy)
flox services start

# Wait ~30 seconds for services to initialize
flox services status

# 3. Access Grafana
open http://localhost:12015
# Login: admin / admin

# 4. Navigate to BeTrace plugin
# Grafana → Apps → BeTrace → Rules

# 5. Create your first rule
Name: slow-requests
Expression: span.duration > 1s
Severity: HIGH
Enabled: true

# 6. Send test trace
curl -X POST http://localhost:12011/v1/spans \
  -H "Content-Type: application/json" \
  -d '{
    "spans": [{
      "trace_id": "test-trace-001",
      "span_id": "test-span-001",
      "name": "slow-operation",
      "start_time": 1699000000000000000,
      "end_time": 1699000002000000000
    }]
  }'

# 7. View violations
# Grafana → Apps → BeTrace → Violations
# Should see 1 violation for "slow-requests" rule

# 8. Stop services
flox services stop
```

### Alternative: Nix

```bash
# Start backend only
nix run .#backend

# In another terminal, access at http://localhost:12011
```

---

## Installation

### Option 1: Flox (Recommended for Development)

Flox manages the complete BeTrace stack including observability services.

**Install Flox**:
```bash
# macOS / Linux
curl -fsSL https://downloads.flox.dev/by-env/stable/install | bash

# Verify installation
flox --version
```

**Start BeTrace**:
```bash
cd /path/to/betrace
flox services start

# Services started:
# - Backend:      http://localhost:12011
# - Grafana:      http://localhost:12015
# - Tempo:        http://localhost:3200
# - Loki:         http://localhost:3100
# - Prometheus:   http://localhost:9090
# - Pyroscope:    http://localhost:4040
# - Alloy:        http://localhost:12345 (telemetry pipeline)
```

**Configuration**:
Flox reads `.flox/env/manifest.toml` for service configuration. To customize:

```bash
# Edit manifest
vi .flox/env/manifest.toml

# Restart services
flox services restart
```

### Option 2: Docker Compose (Production-like)

**File**: `docker-compose.yml` (create this):

```yaml
version: '3.8'

services:
  betrace-backend:
    image: betracehq/backend:2.0.0
    ports:
      - "12011:12011"
    environment:
      - OTEL_EXPORTER_OTLP_ENDPOINT=tempo:4317
      - LOG_LEVEL=info
    depends_on:
      - tempo

  tempo:
    image: grafana/tempo:latest
    ports:
      - "3200:3200"  # HTTP
      - "4317:4317"  # OTLP gRPC
    command: ["-config.file=/etc/tempo/tempo.yaml"]
    volumes:
      - ./tempo.yaml:/etc/tempo/tempo.yaml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_INSTALL_PLUGINS=betracehq-betrace-app
    volumes:
      - grafana-storage:/var/lib/grafana

volumes:
  grafana-storage:
```

**Start**:
```bash
docker-compose up -d

# Access Grafana at http://localhost:3000
```

### Option 3: Kubernetes (Production)

See [docs/deployment/kubernetes.yaml](deployment/kubernetes.yaml) for full deployment.

**Quick deploy**:
```bash
kubectl apply -f https://raw.githubusercontent.com/betracehq/betrace/main/docs/deployment/kubernetes.yaml

# Wait for pods
kubectl wait --for=condition=ready pod -l app=betrace-backend -n betrace

# Port-forward to access locally
kubectl port-forward -n betrace svc/betrace-backend 12011:12011
kubectl port-forward -n betrace svc/grafana 3000:3000
```

### Option 4: Binary Release (Standalone)

**Download binary**:
```bash
# macOS (ARM64)
curl -L https://github.com/betracehq/betrace/releases/download/v2.0.0/betrace-backend-darwin-arm64 -o betrace-backend
chmod +x betrace-backend

# Linux (x86_64)
curl -L https://github.com/betracehq/betrace/releases/download/v2.0.0/betrace-backend-linux-amd64 -o betrace-backend
chmod +x betrace-backend
```

**Run**:
```bash
./betrace-backend \
  --otel-endpoint=tempo:4317 \
  --storage-path=/var/lib/betrace \
  --log-level=info
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `tempo:4317` | Tempo/OTLP endpoint for violation spans |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` | OTLP protocol (`grpc` or `http/protobuf`) |
| `BETRACE_STORAGE_PATH` | `/var/lib/betrace` | Directory for rule storage |
| `BETRACE_HTTP_PORT` | `12011` | HTTP API port |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `BETRACE_SIGNATURE_KEY` | `changeme` | Secret key for compliance span signatures (⚠️ change in production) |

### Configuration File (Optional)

**File**: `betrace.yaml`

```yaml
# Server configuration
server:
  http_port: 12011
  grpc_port: 12012

# Storage configuration
storage:
  type: disk  # "disk" or "memory"
  path: /var/lib/betrace/rules

# OTLP exporter configuration
otlp:
  endpoint: tempo:4317
  protocol: grpc  # or "http/protobuf"
  timeout: 10s
  batch_size: 100

# Rule engine configuration
rules:
  max_rules: 1000
  max_expression_length: 10000
  evaluation_timeout: 100ms

# Compliance configuration
compliance:
  signature_key_env: BETRACE_SIGNATURE_KEY
  emit_evidence: true

# Logging
logging:
  level: info
  format: json  # or "text"
```

**Load config**:
```bash
./betrace-backend --config=betrace.yaml
```

### Grafana Plugin Configuration

**Add data source**:

1. Grafana → Configuration → Data sources → Add data source
2. Select "BeTrace"
3. Configure:
   - **URL**: `http://betrace-backend:12011`
   - **Access**: Server (default)
4. Click "Save & Test"

---

## Creating Rules

### BeTraceDSL Syntax

BeTraceDSL is a Lua-based language for expressing trace patterns.

**Basic Structure**:
```lua
-- Boolean expression that evaluates to true when violation detected
span.duration > 1s
```

**Available Fields**:
- `span.name` - Span name (string)
- `span.service` - Service name (string)
- `span.duration` - Duration in nanoseconds (number)
- `span.status` - Status code: "ok", "error", "unset" (string)
- `span.kind` - Span kind: "client", "server", "internal", etc. (string)
- `span.attributes` - Map of span attributes
- `trace.id` - Trace ID (string)
- `trace.spans` - All spans in trace (array)

**Operators**:
- Comparison: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Logical: `and`, `or`, `not`
- String: `contains`, `starts_with`, `ends_with`, `matches` (regex)
- Trace: `trace.has(condition)`, `trace.count(condition)`, `trace.all(condition)`

### Example Rules

**1. Slow Requests**
```lua
-- Detect requests taking longer than 1 second
span.duration > 1000000000
```

**2. Error Status**
```lua
-- Detect spans with error status
span.status == "error"
```

**3. Missing Authentication**
```lua
-- Detect API calls without auth token
span.kind == "server" and
span.name:starts_with("/api/") and
not span.attributes["auth.token"]
```

**4. PII Access Without Audit**
```lua
-- Compliance rule: PII access must have audit log
trace.has(span.attributes["pii.accessed"] == true) and
not trace.has(span.name == "audit.log")
```

**5. Distributed Deadlock Pattern**
```lua
-- Detect circular dependencies in traces
trace.has(span.name == "service-a" and span.kind == "client") and
trace.has(span.name == "service-b" and span.kind == "client") and
trace.has(span.parent_id == "service-a" and span.name == "service-b") and
trace.has(span.parent_id == "service-b" and span.name == "service-a")
```

**6. High Cardinality Attributes**
```lua
-- Detect attributes with too many unique values (can explode metrics)
span.attributes["user.id"] and
#span.attributes["user.id"] > 1000
```

### Creating Rules via Grafana

1. **Navigate**: Grafana → Apps → BeTrace → Rules
2. **Click**: "Create Rule"
3. **Fill form**:
   - **Name**: `slow-database-queries`
   - **Description**: `Detects database queries slower than 500ms`
   - **Expression**: `span.name:contains("query") and span.duration > 500000000`
   - **Severity**: `HIGH`
   - **Tags**: `database`, `performance`
   - **Enabled**: ✓ (checked)
4. **Click**: "Save"

### Creating Rules via API

```bash
curl -X POST http://localhost:12011/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "slow-database-queries",
    "description": "Detects database queries slower than 500ms",
    "expression": "span.name:contains(\"query\") and span.duration > 500000000",
    "severity": "HIGH",
    "tags": ["database", "performance"],
    "enabled": true
  }'
```

### Testing Rules

**Test against sample span**:
```bash
curl -X POST http://localhost:12011/v1/rules/test \
  -H "Content-Type: application/json" \
  -d '{
    "expression": "span.duration > 1s",
    "span": {
      "name": "test-span",
      "duration": 2000000000,
      "status": "ok"
    }
  }'

# Response:
# {
#   "matches": true,
#   "evaluation_time_ms": 0.5
# }
```

---

## Viewing Violations

### Via Grafana Plugin

**Navigate**: Grafana → Apps → BeTrace → Violations

**Filter violations**:
- **Rule ID**: Filter by specific rule
- **Severity**: CRITICAL, HIGH, MEDIUM, LOW
- **Time Range**: Last 1h, 6h, 24h, 7d, custom
- **Limit**: 50, 100, 500, 1000 results

**Actions**:
- **View Trace**: Opens trace drilldown in BeTrace plugin
- **Open in Tempo**: Opens trace in Tempo explore view (deep link)
- **Export CSV**: Download violations as CSV for analysis

### Via API

**List recent violations**:
```bash
# Last 1 hour
curl "http://localhost:12011/v1/violations?start_time=$(date -u -d '1 hour ago' +%s)"

# Filter by severity
curl "http://localhost:12011/v1/violations?severity=HIGH"

# Filter by rule
curl "http://localhost:12011/v1/violations?rule_id=slow-requests"

# Combine filters
curl "http://localhost:12011/v1/violations?severity=CRITICAL&start_time=$(date -u -d '1 hour ago' +%s)&limit=100"
```

**Response**:
```json
{
  "violations": [
    {
      "id": "viol-abc123",
      "rule_id": "slow-requests",
      "rule_name": "slow-requests",
      "severity": "HIGH",
      "trace_id": "trace-001",
      "span_id": "span-001",
      "timestamp": 1699000000,
      "metadata": {
        "span_name": "slow-operation",
        "duration_ms": 2000
      }
    }
  ],
  "total": 1
}
```

### Via Tempo

Violations are stored as OTLP spans in Tempo with special attributes:

```bash
# Query Tempo for violation spans
curl "http://tempo:3200/api/search?tags=betrace.violation.id"

# Get specific violation by trace ID
curl "http://tempo:3200/api/traces/trace-001"
```

**Violation span attributes**:
- `betrace.violation.id` - Violation ID
- `betrace.violation.rule_id` - Rule that triggered
- `betrace.violation.rule_name` - Human-readable rule name
- `betrace.violation.severity` - CRITICAL, HIGH, MEDIUM, LOW
- `betrace.violation.message` - Violation description
- `betrace.violation.signature` - HMAC-SHA256 signature (compliance)

---

## Integration with Grafana

### Adding BeTrace as Data Source

See [Configuration](#grafana-plugin-configuration) section.

### Setting Up Alerts

**1. Create Alert Rule**:

Grafana → Alerting → Alert rules → New alert rule

**Query**:
```promql
# Count violations in last 5 minutes
count_over_time({job="betrace-backend", betrace_violation_severity="CRITICAL"}[5m]) > 5
```

**Conditions**:
- **Threshold**: > 5 violations in 5 minutes
- **For**: 2 minutes (avoid flapping)

**Notifications**:
- Slack: `#alerts` channel
- PagerDuty: On-call rotation
- Email: security@company.com

**2. Alert Template**:
```
🚨 BeTrace: {{ $value }} critical violations detected

Rule: {{ $labels.rule_name }}
Severity: {{ $labels.severity }}
Time: {{ $labels.timestamp }}

View in Grafana: {{ $externalURL }}/a/betrace-app/violations?severity=CRITICAL
```

### Creating Dashboards

**Dashboard**: Violation Trends

**Panels**:

1. **Time Series**: Violations over time (grouped by severity)
   - Query: `rate(betrace_violations_total[5m])`
   - Legend: `{{severity}}`

2. **Stat Panel**: Current violation rate
   - Query: `sum(rate(betrace_violations_total[1m]))`
   - Unit: violations/sec

3. **Table**: Top 10 rules by violation count
   - Query: `topk(10, count by (rule_name) (betrace_violations_total))`

4. **Bar Chart**: Violations by service
   - Query: `count by (service_name) (betrace_violations_total)`

**Import dashboard**:
```bash
# Download dashboard JSON
curl -O https://raw.githubusercontent.com/betracehq/betrace/main/grafana/dashboards/violations-overview.json

# Import in Grafana UI
Grafana → Dashboards → Import → Upload JSON file
```

---

## Troubleshooting

### Backend Not Starting

**Symptoms**:
- `curl http://localhost:12011/health` fails
- No logs in terminal

**Diagnosis**:
```bash
# Check if port is already in use
lsof -i :12011

# Check backend logs
flox services logs backend
# or
docker logs betrace-backend
```

**Solutions**:

1. **Port conflict**: Change port in config
   ```bash
   export BETRACE_HTTP_PORT=12012
   flox services restart backend
   ```

2. **Missing OTLP endpoint**:
   ```bash
   # Verify Tempo is running
   curl http://localhost:3200/ready

   # If not, start Tempo first
   flox services start tempo
   ```

3. **Storage permission error**:
   ```bash
   # Ensure storage directory exists and is writable
   mkdir -p /var/lib/betrace
   chmod 755 /var/lib/betrace
   ```

### Rules Not Matching

**Symptoms**:
- Rule created successfully
- Spans ingested (check backend logs)
- No violations appearing

**Diagnosis**:
```bash
# Test rule against sample span
curl -X POST http://localhost:12011/v1/rules/test \
  -H "Content-Type: application/json" \
  -d '{
    "expression": "span.duration > 1s",
    "span": {
      "trace_id": "test",
      "span_id": "test",
      "name": "operation",
      "start_time": 1699000000000000000,
      "end_time": 1699000002000000000
    }
  }'

# Check rule evaluation errors in backend logs
flox services logs backend | grep "rule evaluation error"
```

**Common Issues**:

1. **Syntax Error**:
   - Error: `unexpected symbol near '>'`
   - Fix: Check DSL syntax, ensure proper escaping

2. **Type Mismatch**:
   - Error: `attempt to compare number with string`
   - Fix: Use correct types (duration is number, not string)

3. **Missing Attribute**:
   - Expression: `span.attributes["user.id"] > 1000`
   - Issue: Attribute doesn't exist on span
   - Fix: Add null check: `span.attributes["user.id"] and span.attributes["user.id"] > 1000`

4. **Rule Disabled**:
   - Check: `curl http://localhost:12011/v1/rules/{rule_id} | jq '.enabled'`
   - Fix: Enable via API or Grafana UI

### Violations Not Appearing in Grafana

**Symptoms**:
- Backend logs show violations emitted
- Grafana Violations page empty

**Diagnosis**:
```bash
# Check if violations are in Tempo
curl "http://localhost:3200/api/search?tags=betrace.violation.id" | jq

# Check Grafana data source connection
curl http://localhost:3000/api/datasources | jq '.[] | select(.type == "betrace")'
```

**Solutions**:

1. **Data source not configured**:
   - Grafana → Configuration → Data sources
   - Add BeTrace data source
   - URL: `http://betrace-backend:12011`

2. **Time range issue**:
   - Check time range in Grafana (top-right)
   - Ensure it covers when violations occurred

3. **OTLP export failing**:
   ```bash
   # Check backend can reach Tempo
   curl http://tempo:3200/ready

   # Check OTLP endpoint env var
   env | grep OTEL_EXPORTER_OTLP_ENDPOINT
   ```

### High CPU Usage

**Symptoms**:
- Backend CPU > 80%
- Slow response times

**Diagnosis**:
```bash
# Check rule count
curl http://localhost:12011/v1/rules | jq '.rules | length'

# Check span ingestion rate
curl http://localhost:12011/metrics | grep betrace_spans_ingested_total
```

**Solutions**:

1. **Too many rules**:
   - **Recommendation**: < 50 rules per instance
   - **Action**: Disable unused rules, consolidate similar rules

2. **Complex rule expressions**:
   - **Issue**: Rules with `trace.has()` iterate all spans
   - **Action**: Optimize expressions, use span-level checks first

3. **High span volume**:
   - **Capacity**: 2.65M spans/sec per instance @ 70% CPU
   - **Action**: Scale horizontally (add more backend replicas)

### Memory Leak

**Symptoms**:
- Memory usage grows over time
- Backend OOMKilled in Kubernetes

**Diagnosis**:
```bash
# Check memory usage
curl http://localhost:12011/metrics | grep process_resident_memory_bytes

# Enable Go pprof
curl http://localhost:12011/debug/pprof/heap > heap.prof
go tool pprof -http=:8080 heap.prof
```

**Solutions**:

1. **Violation store not clearing**:
   - **Issue**: Old violations retained in memory
   - **Fix**: Ensure violations are periodically flushed to Tempo

2. **Rule count excessive**:
   - **Limit**: 1000 rules max (configurable)
   - **Action**: Archive old rules, clean up test rules

3. **Increase memory limit**:
   ```yaml
   # kubernetes.yaml
   resources:
     limits:
       memory: 2Gi  # Increase from 1Gi
   ```

---

## FAQ

**Q: Can I use BeTrace without Grafana?**
A: Yes! BeTrace backend is platform-agnostic. Use the REST API directly or integrate with SigNoz/Kibana. See [docs/integration/](../integration/).

**Q: How many rules can I have?**
A: Recommended < 50 rules per instance. Each rule adds ~24ns overhead per span. For 100+ rules, use multiple backend instances.

**Q: Does BeTrace support distributed traces?**
A: Yes! Use `trace.has()`, `trace.count()`, `trace.all()` to evaluate patterns across entire traces (all spans).

**Q: Can I test rules before enabling them?**
A: Yes! Use `POST /v1/rules/test` endpoint or create rule with `enabled: false` and monitor dry-run metrics.

**Q: How do I export violations for external analysis?**
A: Three options:
1. **CSV Export**: Grafana Violations page → Export CSV button
2. **API**: `GET /v1/violations` returns JSON
3. **Tempo**: Query OTLP spans directly from Tempo

**Q: Are violations stored forever?**
A: No. Violations are OTLP spans stored in Tempo with configurable retention (default: 30 days). For long-term storage, export to S3/GCS.

**Q: Can I use BeTrace for security monitoring?**
A: **Partially**. BeTrace detects behavioral anomalies (e.g., "PII access without auth") but is NOT a SIEM/SOAR platform. It's best used alongside security tools.

**Q: How do I backup rules?**
A:
```bash
# Export all rules to JSON
curl http://localhost:12011/v1/rules > rules-backup.json

# Restore rules
jq -c '.rules[]' rules-backup.json | while read rule; do
  curl -X POST http://localhost:12011/v1/rules \
    -H "Content-Type: application/json" \
    -d "$rule"
done
```

**Q: Can I use BeTrace in CI/CD pipelines?**
A: Yes! Run BeTrace backend in test mode, emit test traces, assert violations occur (or don't). Example:
```bash
# In CI
./betrace-backend --test-mode &
# Run tests, emit traces
# Query violations API
VIOLATIONS=$(curl http://localhost:12011/v1/violations | jq '.total')
if [ $VIOLATIONS -gt 0 ]; then
  echo "❌ Detected $VIOLATIONS invariant violations"
  exit 1
fi
```

---

## Next Steps

1. **Read [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md)** - Production deployment, scaling, monitoring
2. **Review [API Reference](API_REFERENCE.md)** - Complete REST API documentation
3. **Explore [Example Rules](../examples/rules/)** - Pre-built rules for common patterns
4. **Join Community**: [GitHub Discussions](https://github.com/betracehq/betrace/discussions)

---

## Getting Help

- **Documentation**: https://docs.betrace.io
- **GitHub Issues**: https://github.com/betracehq/betrace/issues
- **Slack Community**: [betrace-community.slack.com](https://betrace-community.slack.com)
- **Email Support**: support@betrace.io

---

**Last Updated**: 2025-11-02
**Version**: 2.0.0
