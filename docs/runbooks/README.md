# BeTrace Production Runbooks

This directory contains incident response guides for BeTrace production operations.

## Quick Reference

| Alert | Severity | MTTR | Runbook |
|-------|----------|------|---------|
| Backend Down | Critical | 5m | [backend-down.md](backend-down.md) |
| High Violation Rate | Warning | 30m | [high-violation-rate.md](high-violation-rate.md) |
| Critical Violation Spike | Critical | 10m | [critical-violation-spike.md](critical-violation-spike.md) |
| High CPU | Warning | 1h | [high-cpu.md](high-cpu.md) |
| High Memory | Warning | 1h | [high-memory.md](high-memory.md) |
| High Latency | Warning | 30m | [high-latency.md](high-latency.md) |
| High Error Rate | Warning | 15m | [high-error-rate.md](high-error-rate.md) |
| Compliance Emission Failure | Critical | 15m | [compliance-emission-failure.md](compliance-emission-failure.md) |

## Runbook Structure

Each runbook follows this template:

1. **Symptom**: What the user/system experiences
2. **Impact**: Business/operational consequences
3. **Diagnosis**: How to confirm root cause
4. **Mitigation**: Immediate actions to restore service
5. **Resolution**: Long-term fixes
6. **Prevention**: How to avoid recurrence

## On-Call Escalation

### Severity Levels

- **Critical**: Service down or data loss imminent
  - Page on-call immediately
  - MTTR target: 15 minutes
  - Examples: Backend down, compliance emission failure

- **Warning**: Degraded service or impending failure
  - Notify on-call via Slack/PagerDuty
  - MTTR target: 1 hour
  - Examples: High CPU, elevated violation rate

- **Info**: Anomaly detected, no immediate action needed
  - Log for review during business hours
  - Examples: Unusual traffic pattern

### Escalation Path

1. **L1 (On-call engineer)**: Respond within 5 minutes
   - Follow runbook
   - Restore service using documented mitigation steps
   - Escalate if unable to resolve in 15 minutes (critical) or 30 minutes (warning)

2. **L2 (Platform lead)**: Deep system knowledge
   - Investigate complex issues requiring code changes
   - Coordinate with product/engineering if incident requires feature rollback

3. **L3 (Engineering VP)**: Business-critical decisions
   - Major outages affecting multiple customers
   - Decisions requiring trade-offs between availability and data consistency

## Common Diagnosis Commands

### Check Backend Health
```bash
# Health check
curl http://backend:12011/health

# Readiness check
curl http://backend:12011/ready

# Metrics
curl http://backend:12011/metrics
```

### Check Rule Status
```bash
# List all rules
curl http://backend:12011/v1/rules

# Get specific rule
curl http://backend:12011/v1/rules/{rule_id}

# Check rule evaluation stats
curl http://backend:12011/metrics | grep betrace_rule_evaluation
```

### Check Violations
```bash
# Recent violations (last 1h)
START=$(date -u -d '1 hour ago' +%s)
curl "http://backend:12011/v1/violations?start_time=$START"

# Violations by severity
curl http://backend:12011/v1/violations?severity=CRITICAL

# Violations by rule
curl http://backend:12011/v1/violations?rule_id={rule_id}
```

### Check Logs (Kubernetes)
```bash
# Backend logs (last 100 lines)
kubectl logs -n betrace deployment/betrace-backend --tail=100

# Follow logs in real-time
kubectl logs -n betrace deployment/betrace-backend -f

# Search for errors
kubectl logs -n betrace deployment/betrace-backend | grep ERROR
```

### Check Resource Usage
```bash
# CPU and memory (Kubernetes)
kubectl top pods -n betrace

# Detailed resource stats
kubectl describe pod -n betrace -l app=betrace-backend
```

## Common Mitigation Actions

### Restart Backend (Kubernetes)
```bash
# Graceful restart
kubectl rollout restart deployment/betrace-backend -n betrace

# Force restart (if pods are stuck)
kubectl delete pods -n betrace -l app=betrace-backend
```

### Scale Backend
```bash
# Scale up to 5 replicas
kubectl scale deployment/betrace-backend -n betrace --replicas=5

# Check HPA status
kubectl get hpa -n betrace
```

### Disable Problematic Rule
```bash
# Via API
curl -X POST http://backend:12011/v1/rules/{rule_id}/disable

# Via Grafana plugin
# Navigate to Rules page → Select rule → Disable
```

### Emergency: Disable All Rules
```bash
# List all rule IDs
RULES=$(curl -s http://backend:12011/v1/rules | jq -r '.rules[].id')

# Disable each rule
for rule_id in $RULES; do
  curl -X POST http://backend:12011/v1/rules/$rule_id/disable
done
```

## Post-Incident Review

After resolving any critical or high-impact warning, conduct a post-incident review:

1. **Timeline**: Document key events (detection, mitigation, resolution)
2. **Root Cause**: Technical reason for failure
3. **Impact**: Duration, affected customers, business metrics
4. **Action Items**: Preventive measures, runbook updates, code improvements
5. **Follow-up**: Assign owners and track completion

Template: [docs/runbooks/post-incident-template.md](post-incident-template.md)

## Contact Information

- **Slack**: #betrace-incidents
- **PagerDuty**: BeTrace On-Call rotation
- **Docs**: https://github.com/betracehq/betrace/tree/main/docs
- **Status Page**: https://status.betrace.io (if applicable)
