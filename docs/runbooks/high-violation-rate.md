# Runbook: High Violation Rate

## Alert
- **Name**: BeTraceHighViolationRate
- **Severity**: Warning
- **MTTR Target**: 30 minutes

## Symptom
- Sustained elevated violation rate (> 100 violations/sec for 10+ minutes)
- May see increased backend CPU usage
- Grafana plugin shows many violations

## Impact
- **User Impact**: Possible signal that production bug was introduced OR rule misconfiguration
- **Business Impact**: May indicate service degradation or compliance issue
- **Operational Impact**: Increased telemetry volume to Tempo, higher storage costs

## Diagnosis

### 1. Verify Alert is Real (Not Flapping)
```bash
# Check current violation rate
curl http://backend:12011/metrics | grep betrace_violations_total

# Compare to historical baseline (last 7d average)
# Use Grafana to query: rate(betrace_violations_total[7d])
```

### 2. Identify Which Rules Are Firing
```bash
# Get violations grouped by rule (last 10 minutes)
START=$(date -u -d '10 minutes ago' +%s)
curl "http://backend:12011/v1/violations?start_time=$START" | \
  jq -r '.violations | group_by(.rule_id) | map({rule: .[0].rule_id, count: length}) | sort_by(.count) | reverse'

# Output:
# [
#   {"rule": "slow-queries", "count": 5420},
#   {"rule": "auth-failures", "count": 234},
#   ...
# ]
```

### 3. Check Rule Details
```bash
# Get rule configuration
curl http://backend:12011/v1/rules/{top_rule_id} | jq

# Key fields:
# - name: Human-readable rule name
# - expression: DSL pattern being matched
# - severity: HIGH/MEDIUM/LOW
# - created_at: When rule was created (recent = likely cause)
```

### 4. Sample Violations to Understand Pattern
```bash
# Get 10 recent violations for the noisy rule
curl "http://backend:12011/v1/violations?rule_id={rule_id}&limit=10" | jq '.violations[].metadata'

# Look for patterns:
# - All from same service?
# - Specific trace pattern?
# - New attribute values?
```

### 5. Correlate with Recent Changes

Check for recent changes that might have triggered violations:

**Application Deployments**:
```bash
# Check deployment history
kubectl rollout history deployment/{your-service} -n {namespace}

# Get deployment time
kubectl describe deployment/{your-service} -n {namespace} | grep "Created"
```

**Rule Changes**:
```bash
# Check if rule was recently created/modified
curl http://backend:12011/v1/rules/{rule_id} | jq '.updated_at, .created_at'

# Compare to violation start time
```

**Traffic Changes**:
```bash
# Check if traffic volume increased
# Query Tempo/Grafana for span ingestion rate
```

## Mitigation

### Scenario A: New Rule Misconfigured

**Symptoms**:
- Rule created within last 24h
- Violations started immediately after rule creation
- Rule expression too broad (e.g., `true`, `span.duration > 0`)

**Action**:
```bash
# 1. Disable the rule temporarily
curl -X POST http://backend:12011/v1/rules/{rule_id}/disable

# 2. Verify violation rate drops
watch 'curl -s http://backend:12011/metrics | grep betrace_violations_total'

# 3. Fix rule expression (refine to be more specific)
# Example: Change "span.duration > 1s" to "span.duration > 5s and span.service == 'critical-service'"
```

**Time**: ~5 minutes

### Scenario B: Application Bug Introduced

**Symptoms**:
- Rule has been stable for days/weeks
- Recent deployment of monitored service
- Violations correlate with specific service/endpoint

**Action**:
```bash
# 1. Confirm hypothesis by checking violation metadata
curl "http://backend:12011/v1/violations?rule_id={rule_id}&limit=100" | \
  jq '.violations | group_by(.metadata.service_name) | map({service: .[0].metadata.service_name, count: length})'

# 2. If confirmed, this is a GOOD THING - BeTrace caught a bug!
# 3. File incident for application team
# 4. Optionally adjust rule severity if it's noisy but not critical
curl -X PUT http://backend:12011/v1/rules/{rule_id} \
  -H "Content-Type: application/json" \
  -d '{"severity": "MEDIUM"}' # Downgrade from HIGH to MEDIUM

# 5. DO NOT disable rule unless violations are blocking operations
```

**Time**: ~10 minutes

**Follow-up**: Application team fixes bug, violation rate returns to baseline

### Scenario C: Legitimate Traffic Pattern Change

**Symptoms**:
- Traffic volume increased (Black Friday, viral event, etc.)
- Violation rate increased proportionally
- No obvious bug in application

**Action**:
```bash
# 1. Verify traffic increase
# Check span ingestion rate in Tempo/Grafana

# 2. Calculate violation rate as % of total spans
# If rate is consistent (e.g., 0.1% before and after), this is expected

# 3. Options:
#   A. Accept higher absolute violation count (do nothing)
#   B. Tighten rule to reduce noise:
curl -X PUT http://backend:12011/v1/rules/{rule_id} \
  -H "Content-Type: application/json" \
  -d '{"expression": "span.duration > 2s"}' # Increase threshold

#   C. Add sampling to rule (if DSL supports it):
#      "span.duration > 1s and random() < 0.1" # Sample 10% of violations
```

**Time**: ~15 minutes

### Scenario D: Rule Evaluation Error Causing False Positives

**Symptoms**:
- Violations seem incorrect when spot-checked
- Backend logs show rule evaluation errors
- Rule uses complex DSL expressions

**Action**:
```bash
# 1. Check backend logs for evaluation errors
kubectl logs -n betrace deployment/betrace-backend | grep "rule_id.*{rule_id}" | grep ERROR

# 2. Disable rule temporarily
curl -X POST http://backend:12011/v1/rules/{rule_id}/disable

# 3. Fix DSL expression (common issues):
#    - Missing null checks: span.attributes["key"] (fails if key missing)
#    - Type mismatches: span.duration > "1s" (wrong type)
#    - Syntax errors: span.duration > (missing value)

# 4. Test rule in staging before re-enabling
```

**Time**: ~20 minutes

## Resolution (Long-term Fix)

### If Rule Was Misconfigured
1. Update rule with correct expression
2. Test in staging with sample traces
3. Document expected violation rate for rule
4. Set up alert if violation rate deviates > 3x from baseline

### If Application Bug
1. Track application team's bug fix
2. Verify violation rate returns to baseline after fix deployed
3. Consider making rule permanent if it caught real issue
4. Add rule to regression test suite

### If Legitimate Traffic Change
1. Update baseline violation rate in alert thresholds
2. Document traffic pattern change in runbook
3. Adjust rule sampling or thresholds if needed

## Prevention

1. **Rule testing**:
   - Always test new rules in staging first
   - Sample production traffic before enabling
   - Use `enabled: false` initially, monitor dry-run metrics

2. **Change management**:
   - Require approval for HIGH/CRITICAL severity rules
   - Document expected violation rate in rule description
   - Link rules to observability runbooks

3. **Baseline tracking**:
   - Track 7-day moving average of violations per rule
   - Alert if rate exceeds 3x baseline
   - Review violation trends weekly

4. **Rule hygiene**:
   - Audit rules quarterly
   - Disable rules that haven't fired in 30 days
   - Archive obsolete rules

## Related Runbooks
- [critical-violation-spike.md](critical-violation-spike.md) - Sudden spike in CRITICAL violations
- [rule-evaluation-errors.md](rule-evaluation-errors.md) - DSL syntax errors
- [slow-rule-evaluation.md](slow-rule-evaluation.md) - Performance issues

## Post-Incident Actions
- [ ] Update violation baseline for affected rules
- [ ] Document root cause in rule description field
- [ ] Share findings with application teams
- [ ] Update alert threshold if needed
