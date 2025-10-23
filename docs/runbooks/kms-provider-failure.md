# Runbook: KMS Provider Failure

**Alert**: `KMSOperationFailures`
**Severity**: CRITICAL
**Response Time**: Immediate (< 15 minutes)

---

## Symptoms

- Alert: `KMSOperationFailures` firing (error rate >1%)
- KMS health check failing: `/q/health/ready` returns DOWN
- Logs show `KmsException` errors
- Users report compliance span signing failures
- Circuit breaker may be OPEN (blocking all KMS operations)

---

## Impact

**User-Facing**:
- Compliance spans cannot be signed (audit trail breaks)
- PII redaction may fail (HIPAA violation risk)
- Service may become unavailable if circuit breaker opens

**Compliance Risk**:
- SOC2 CC7.1: Detection of system anomalies (evidence gaps)
- HIPAA 164.312(b): Audit controls (audit log integrity)

---

## Diagnosis

### Step 1: Check KMS Health

```bash
# Check readiness endpoint
curl http://localhost:8080/q/health/ready

# Expected output (healthy):
# {
#   "status": "UP",
#   "checks": [
#     {
#       "name": "kms",
#       "status": "UP",
#       "data": {
#         "provider": "aws",
#         "latency_ms": 45,
#         "status": "operational"
#       }
#     }
#   ]
# }

# If DOWN, check error details:
jq '.checks[] | select(.name == "kms")' <<< "$(curl -s http://localhost:8080/q/health/ready)"
```

### Step 2: Review KMS Error Metrics

```bash
# Check error rate
curl -s http://localhost:8080/q/metrics | grep kms_errors_total

# Check circuit breaker status
curl -s http://localhost:8080/q/metrics | grep circuit_breaker_state

# Circuit breaker states:
# 0 = CLOSED (normal)
# 1 = OPEN (blocking requests)
# 2 = HALF_OPEN (testing recovery)
```

### Step 3: Review Application Logs

```bash
# Search for KMS exceptions
grep "KmsException" /var/log/fluo/backend.log | tail -n 20

# Common error patterns:
# - "AccessDenied" → IAM permission issue
# - "KMSInvalidStateException" → KMS key disabled/deleted
# - "ThrottlingException" → KMS API rate limit exceeded
# - "NetworkException" → Connectivity issue
```

### Step 4: Identify Root Cause

| Error Message | Root Cause | Solution |
|---------------|------------|----------|
| `not authorized to perform: kms:GenerateDataKey` | IAM permissions missing | Fix IAM policy (Step 1) |
| `KMSInvalidStateException: key is disabled` | KMS key disabled | Enable KMS key (Step 2) |
| `ThrottlingException: Rate exceeded` | Too many KMS API calls | Optimize cache (Step 3) |
| `UnknownHostException: kms.amazonaws.com` | Network connectivity | Fix VPC/DNS (Step 4) |
| `Timeout: No response after 5000ms` | KMS latency spike | Check AWS status (Step 5) |

---

## Resolution

### Solution 1: Fix IAM Permissions

**Problem**: Application cannot access KMS key

```bash
# Verify IAM policy attached to application role
aws iam get-role-policy --role-name fluo-backend-role --policy-name kms-access

# Required permissions:
# - kms:GenerateDataKey
# - kms:Decrypt
# - kms:Encrypt
# - kms:DescribeKey

# If missing, attach correct policy:
aws iam put-role-policy \
  --role-name fluo-backend-role \
  --policy-name kms-access \
  --policy-document file:///path/to/kms-iam-policy.json

# Verify key policy allows application role:
aws kms get-key-policy --key-id <key-arn> --policy-name default
```

**IAM Policy Template** (see `terraform/aws-kms/iam-policy.json`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:GenerateDataKey",
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:123456789012:key/abcd-1234-*"
    }
  ]
}
```

### Solution 2: Enable KMS Key

**Problem**: KMS key is disabled or scheduled for deletion

```bash
# Check key state
aws kms describe-key --key-id <key-arn> | jq '.KeyMetadata.KeyState'

# Key states:
# - "Enabled" → Normal operation
# - "Disabled" → Need to enable
# - "PendingDeletion" → Need to cancel deletion

# Enable disabled key:
aws kms enable-key --key-id <key-arn>

# Cancel pending deletion:
aws kms cancel-key-deletion --key-id <key-arn>

# Verify key is enabled:
aws kms describe-key --key-id <key-arn> | jq '.KeyMetadata.Enabled'
# Should output: true
```

### Solution 3: Optimize Cache (Reduce KMS API Calls)

**Problem**: KMS API throttling due to high request volume

```bash
# Check cache hit rate
curl -s http://localhost:8080/q/metrics | grep kms_cache_hit_total
curl -s http://localhost:8080/q/metrics | grep kms_cache_miss_total

# Calculate hit rate:
# hit_rate = hits / (hits + misses)
# Target: >80%

# If hit rate low (<80%), investigate:
# 1. Cache evictions (cache too small?)
# 2. Unusual tenant access patterns (attack?)
# 3. Recent deployment (cache warming needed?)
```

**Temporary Mitigation** (increase cache TTL):
```properties
# Edit application.properties
kms.cache.private-key-ttl-minutes=120  # Increase from 60 to 120
kms.cache.public-key-ttl-hours=48       # Increase from 24 to 48

# Restart application to apply
```

### Solution 4: Fix Network Connectivity

**Problem**: Cannot reach KMS API endpoint

```bash
# Test DNS resolution
nslookup kms.us-east-1.amazonaws.com

# Test connectivity
curl -v https://kms.us-east-1.amazonaws.com

# Check VPC endpoints (if using PrivateLink)
aws ec2 describe-vpc-endpoints --filters "Name=service-name,Values=com.amazonaws.us-east-1.kms"

# Verify security group allows outbound HTTPS
aws ec2 describe-security-groups --group-ids <sg-id> | jq '.SecurityGroups[].IpPermissionsEgress'
```

### Solution 5: Check AWS Service Health

**Problem**: AWS KMS service degradation

```bash
# Check AWS Service Health Dashboard
open https://health.aws.amazon.com/health/status

# Check CloudWatch KMS metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/KMS \
  --metric-name UserErrorRate \
  --dimensions Name=KeyId,Value=<key-arn> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

**Temporary Mitigation** (if AWS outage):
- Circuit breaker will automatically protect application
- Wait for AWS to resolve (no manual action needed)
- Monitor circuit breaker recovery via metrics

---

## Verification

### Confirm Resolution

```bash
# 1. Check health endpoint is UP
curl http://localhost:8080/q/health/ready | jq '.status'
# Expected: "UP"

# 2. Verify error rate is zero
curl -s http://localhost:8080/q/metrics | grep kms_errors_total
# Should show no recent errors

# 3. Confirm circuit breaker is CLOSED
curl -s http://localhost:8080/q/metrics | grep 'circuit_breaker_state{name="kms-signing-key"}'
# Expected: 0 (CLOSED)

# 4. Test key retrieval manually
curl -X POST http://localhost:8080/api/admin/kms/test-key-retrieval \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "00000000-0000-0000-0000-000000000001"}'
# Expected: {"status": "success", "latency_ms": <50}
```

### Monitor for Regression

```bash
# Watch error rate for 10 minutes
watch -n 30 'curl -s http://localhost:8080/q/metrics | grep kms_errors_total'

# Check Grafana dashboard
open http://localhost:12015/d/kms-operations
```

---

## Escalation

### When to Escalate

Escalate to **Engineering Lead** if:
- IAM permissions correct but still getting AccessDenied
- KMS key enabled but still getting KMSInvalidStateException
- AWS reports no issues but KMS consistently failing
- Circuit breaker stuck OPEN after fixing underlying issue

### Escalation Contact

- **Slack**: `#fluo-oncall` (immediate response)
- **PagerDuty**: "KMS Integration" escalation policy
- **Engineering Lead**: [Contact info in PagerDuty]

### Information to Provide

```bash
# Collect diagnostic bundle
tar -czf kms-diagnostic-$(date +%Y%m%d-%H%M%S).tar.gz \
  /var/log/fluo/backend.log \
  <(curl -s http://localhost:8080/q/health/ready) \
  <(curl -s http://localhost:8080/q/metrics | grep kms_)

# Share in Slack thread with:
# 1. Timeline: When did alert start firing?
# 2. Error rate: Current kms_errors_total value
# 3. Recent changes: Any deployments in last 24 hours?
# 4. Steps taken: What troubleshooting already performed?
```

---

## Post-Incident

### Incident Review Checklist

- [ ] Root cause identified and documented
- [ ] Resolution time within SLA (<15 minutes for CRITICAL)
- [ ] Runbook followed and effective
- [ ] Any runbook improvements needed
- [ ] Preventive measures identified

### Preventive Actions

- **If IAM issue**: Add IAM policy validation to CI/CD pipeline
- **If network issue**: Add VPC endpoint monitoring
- **If cache issue**: Add cache hit rate alerting
- **If AWS outage**: Verify circuit breaker protected application

---

## Related Documentation

- [KMS Setup Guide](../setup/AWS_KMS_SETUP.md)
- [KMS Troubleshooting](../setup/KMS_TROUBLESHOOTING.md)
- [Circuit Breaker Runbook](circuit-breaker-open.md)
- [IAM Policy Template](../../terraform/aws-kms/iam-policy.json)

---

**Runbook Version**: 1.0
**Last Updated**: 2025-10-22
**Owner**: SRE Team
