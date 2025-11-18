# BeTrace Quick Start for SRE Teams

**Get from zero to your first behavioral invariant violation in 5 minutes**

## What BeTrace Solves

**Problem:** When production incidents happen, you spend days replaying logs or re-running tests to figure out *when* the bad behavior started.

**Solution:** Apply rules retroactively to your existing Tempo traces and get the answer in 30 seconds.

## Prerequisites

- Existing Grafana + Tempo setup (BeTrace integrates with what you already have)
- Docker or Kubernetes (we support both)
- 5 minutes

## Option 1: Docker Compose (Fastest)

### Step 1: Deploy BeTrace (2 min)

```bash
# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/betracehq/betrace/main/distribution/docker/docker-compose.yml

# Start BeTrace backend + observability stack
docker-compose up -d

# Verify it's running
curl http://localhost:8080/health
# Expected: {"status":"healthy"}
```

**What you just deployed:**
- BeTrace Backend API (port 8080)
- Grafana with BeTrace plugin (port 3000)
- Tempo (trace storage, port 3200)
- Prometheus, Loki, Pyroscope (full observability stack)

### Step 2: Create Your First Rule (1 min)

BeTrace uses **BeTraceDSL** to define behavioral patterns. Let's detect a common SRE issue: **slow database queries without retries**.

```bash
# Create rule: "Detect DB queries >1s without retry logic"
curl -X POST http://localhost:8080/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "slow-db-no-retry",
    "name": "Slow DB Query Without Retry",
    "description": "Detects database queries taking >1s without retry spans",
    "dsl": "trace.has(span.name == \"db.query\" and span.duration > 1s) and not trace.has(span.name == \"retry\")",
    "severity": "warning",
    "enabled": true
  }'
```

**What this rule does:**
- Scans ALL traces in Tempo (including historical ones)
- Finds traces with slow DB queries (>1 second)
- Checks if there's a retry span in the same trace
- If NO retry → emits ViolationSpan to Tempo

### Step 3: Apply Rule to Historical Traces (1 min)

This is the **killer feature**: Apply new rules to traces from last week/month.

```bash
# Replay rule against last 24 hours of traces
curl -X POST http://localhost:8080/v1/rules/slow-db-no-retry/replay \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "'$(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)'",
    "end_time": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Check replay status
curl http://localhost:8080/v1/rules/slow-db-no-retry/replay/status
```

**Expected output:**
```json
{
  "rule_id": "slow-db-no-retry",
  "status": "completed",
  "traces_evaluated": 15420,
  "violations_found": 37,
  "duration_seconds": 2.3
}
```

**Translation:** Evaluated 15,420 traces from the last 24 hours in 2.3 seconds and found 37 violations.

### Step 4: View Violations in Grafana (1 min)

```bash
# Open Grafana
open http://localhost:3000

# Login: admin / admin (change in production!)
```

**In Grafana:**
1. Navigate to **Explore**
2. Select **Tempo** datasource
3. Run TraceQL query:
   ```
   { span.betrace.violation.rule_id = "slow-db-no-retry" }
   ```
4. See all 37 violation spans with timestamps

**What you just discovered:**
- Exactly which traces had slow DB queries without retries
- When this pattern started happening (timestamp of first violation)
- Services involved (trace metadata)

## Option 2: Kubernetes (Production)

### Step 1: Install with Helm (2 min)

```bash
# Add BeTrace Helm repo
helm repo add betrace https://betracehq.github.io/betrace
helm repo update

# Install (creates namespace, deploys backend + Grafana + observability stack)
helm install betrace betrace/betrace \
  --namespace betrace \
  --create-namespace \
  --set grafana.config.security.admin_password=YOUR_SECURE_PASSWORD

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=betrace-backend -n betrace --timeout=120s

# Port-forward to access locally
kubectl port-forward -n betrace svc/betrace-backend 8080:8080
kubectl port-forward -n betrace svc/betrace-grafana 3000:3000
```

### Step 2-4: Same as Docker Compose

Follow steps 2-4 above (create rule, replay, view in Grafana).

## Common SRE Use Cases

### Use Case 1: "When did this bug start?"

**Scenario:** Production incident on Tuesday. You suspect it started days ago but weren't monitoring for it.

**With BeTrace:**
```bash
# Create rule that detects the buggy behavior
curl -X POST http://localhost:8080/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "incident-pattern",
    "name": "Incident Pattern Detection",
    "dsl": "trace.has(span.name == \"payment.process\" and span.status == \"error\") and trace.has(span.attributes[\"user.region\"] == \"eu-west-1\")",
    "severity": "critical"
  }'

# Replay against last 7 days
curl -X POST http://localhost:8080/v1/rules/incident-pattern/replay \
  -d '{"start_time": "2025-01-09T00:00:00Z", "end_time": "2025-01-16T23:59:59Z"}'
```

**Result:** "First violation was 5 days ago at 2025-01-11 14:23:17 UTC" (from TraceQL query in Grafana)

**Value:** Answered in 30 seconds instead of days of log analysis.

### Use Case 2: Validate a fix worked

**Scenario:** You deployed a fix for authorization bypass. Want to prove it worked.

**With BeTrace:**
```bash
# Rule: Authorization check MUST happen before data access
curl -X POST http://localhost:8080/v1/rules \
  -d '{
    "id": "authz-before-data",
    "name": "Authorization Before Data Access",
    "dsl": "trace.has(span.name == \"data.access\") and not trace.has_before(span.name == \"authz.check\", \"data.access\")",
    "severity": "critical"
  }'

# Check violations BEFORE fix (last week)
# Expected: violations found

# Check violations AFTER fix (today)
# Expected: 0 violations

# Evidence for post-mortem: "Authorization bypass fixed, 0 violations since deploy"
```

### Use Case 3: Compliance evidence generation

**Scenario:** Auditor asks "How do you prove PII access is always logged?"

**With BeTrace:**
```bash
# Rule: PII access MUST have audit log in same trace
curl -X POST http://localhost:8080/v1/rules \
  -d '{
    "id": "pii-audit-soc2-cc6.1",
    "name": "PII Access Requires Audit Log (SOC2 CC6.1)",
    "dsl": "trace.has(span.attributes[\"data.classification\"] == \"PII\") and not trace.has(span.name == \"audit.log\")",
    "severity": "critical",
    "annotations": {
      "soc2_control": "CC6.1",
      "compliance_framework": "SOC2"
    }
  }'

# Run continuously in production
# Export violations report for auditors
curl http://localhost:8080/v1/compliance/reports/soc2 > soc2-evidence.json
```

**Value:** Behavioral proof (not just checkbox compliance).

## Next Steps

1. **Connect to Your Existing Tempo**
   - Edit `docker-compose.yml` or Helm `values.yaml`
   - Point `OTEL_EXPORTER_OTLP_ENDPOINT` to your Tempo instance
   - BeTrace will start evaluating YOUR production traces

2. **Write Rules for Your Services**
   - See [BeTraceDSL Reference](../docs/BETRACE_DSL_REFERENCE.md)
   - Start with patterns from recent incidents
   - Use rule replay to test against historical traces

3. **Set Up Grafana Alerts**
   - Create alert rules based on violation spans
   - Trigger PagerDuty/Slack when critical violations occur
   - See [Grafana Alerting Guide](../docs/GRAFANA_ALERTING_GUIDE.md)

4. **Explore Advanced Patterns**
   - Temporal ordering: `has_before()`, `has_after()`
   - Counting: `count(span.name == "retry") > 3`
   - Compliance annotations: `@SOC2(controls = {CC6_1})`

## Troubleshooting

### Backend not starting

```bash
# Check logs
docker logs betrace-backend
# or
kubectl logs -n betrace deployment/betrace-backend
```

**Common issue:** Tempo not reachable
**Fix:** Verify `OTEL_EXPORTER_OTLP_ENDPOINT` in config

### No violations found

**Possible reasons:**
1. Rule DSL is too strict (no traces match)
2. Tempo has no traces yet (send test traces with `otel-cli`)
3. Time range is wrong (check `start_time`/`end_time` in replay)

**Debug:**
```bash
# Check how many traces Tempo has
curl http://localhost:3200/api/search | jq '.traces | length'

# Test rule syntax
curl -X POST http://localhost:8080/v1/rules/validate \
  -d '{"dsl": "YOUR_DSL_HERE"}'
```

### Grafana plugin not showing

**Check:**
```bash
# Docker
docker exec betrace-grafana ls -la /var/lib/grafana/plugins

# Kubernetes
kubectl exec -n betrace <grafana-pod> -- ls -la /var/lib/grafana/plugins
```

**Expected:** `betrace-app` directory present

**Fix:** Ensure `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=betrace-app` is set

## Support

- **Documentation:** [docs/USER_GUIDE.md](../docs/USER_GUIDE.md)
- **DSL Reference:** [docs/BETRACE_DSL_REFERENCE.md](../docs/BETRACE_DSL_REFERENCE.md)
- **Issues:** https://github.com/betracehq/betrace/issues
- **Commercial Support:** Pilot program available ($2K for 90 days, see [PRICING.md](../PRICING.md))

## Why This Matters for SREs

**Before BeTrace:**
- Incident happens Tuesday
- Spend 2 days grepping logs to find "when did this start?"
- Write post-mortem: "Unknown when issue began, monitoring gap"
- No way to validate fix worked retroactively

**After BeTrace:**
- Incident happens Tuesday
- Write rule describing buggy behavior (5 min)
- Replay against last month's traces (30 seconds)
- Post-mortem: "Issue started Jan 11 at 14:23 UTC, fixed Jan 16, zero violations since"

**Value:** Turn "unknown unknowns" into "known patterns" retroactively.
