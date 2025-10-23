# Runbook: Key Rotation Failure

**Alert**: `KMSKeyRotationOverdue`
**Severity**: CRITICAL
**Response Time**: 1 hour (compliance deadline: 90 days)

---

## Symptoms

- Alert: `KMSKeyRotationOverdue` firing (>90 days since last rotation)
- Logs show `KeyRotationScheduler` errors
- Compliance audit shows key rotation gaps
- Admin dashboard shows rotation status "OVERDUE"

---

## Impact

**Compliance Risk**:
- **SOC2 CC6.1**: Logical access controls (key lifecycle management)
- **NIST 800-57**: Cryptographic key management (90-day rotation requirement)
- **HIPAA 164.312(a)(2)(iv)**: Encryption key management
- **PCI-DSS 3.6.4**: Cryptographic key rotation

**Security Risk**:
- Increased window for key compromise
- Cryptographic key material exposure over time
- Audit finding if discovered during SOC2/HIPAA assessment

**Business Risk**:
- SOC2 certification delayed or denied
- Enterprise customer contracts at risk
- Regulatory fines (HIPAA: up to $50K per violation)

---

## Diagnosis

### Step 1: Check Last Rotation Time

```bash
# Query last rotation timestamp
curl -s http://localhost:8080/q/metrics | grep kms_last_rotation_timestamp_seconds

# Calculate days since last rotation
last_rotation=$(curl -s http://localhost:8080/q/metrics | grep kms_last_rotation_timestamp_seconds | awk '{print $2}')
current_time=$(date +%s)
days_since_rotation=$(( ($current_time - $(echo $last_rotation | cut -d. -f1)) / 86400 ))
echo "Days since last rotation: $days_since_rotation"
echo "Compliance threshold: 90 days"
```

### Step 2: Check Rotation Scheduler Status

```bash
# Verify scheduler is running
curl -s http://localhost:8080/q/scheduler/status | jq '.schedulers[] | select(.name == "keyRotationCheck")'

# Expected output:
# {
#   "name": "keyRotationCheck",
#   "enabled": true,
#   "cron": "0 0 2 * * ?",  # Daily at 2 AM
#   "lastExecution": "2025-10-22T02:00:00Z",
#   "nextExecution": "2025-10-23T02:00:00Z"
# }
```

### Step 3: Review Rotation Failure Logs

```bash
# Search for rotation errors
grep "KeyRotationScheduler" /var/log/fluo/backend.log | grep -i error | tail -n 50

# Common error patterns:
# - "KmsException: AccessDenied" → IAM permissions issue
# - "TooManyRequestsException" → KMS throttling
# - "Timeout" → Rotation taking too long (too many tenants)
# - "TenantNotFoundException" → Tenant deleted but not removed from rotation list
```

### Step 4: Check Rotation Metrics

```bash
# Check rotation success rate
curl -s http://localhost:8080/q/metrics | grep kms_rotation_

# Key metrics:
# - kms_rotation_success_total → Successful rotations
# - kms_rotation_failures_total → Failed rotations
# - kms_rotation_duration_seconds → Time taken per rotation
# - kms_tenants_rotated_total → Number of tenants rotated
```

### Step 5: Identify Root Cause

| Symptom | Root Cause | Solution |
|---------|------------|----------|
| Scheduler `enabled=false` | Scheduler disabled by config | Enable scheduler (Solution 1) |
| `lastExecution` is null | Scheduler never ran | Check application startup (Solution 2) |
| `KmsException: AccessDenied` | IAM permissions missing | Fix IAM policy (Solution 3) |
| `TooManyRequestsException` | KMS throttling | Stagger rotation (Solution 4) |
| High `kms_rotation_duration_seconds` | Too many tenants | Optimize rotation (Solution 5) |

---

## Resolution

### Solution 1: Enable Key Rotation Scheduler

**Problem**: Scheduler disabled in configuration

```bash
# Check current configuration
grep "rotation" /opt/fluo/application.properties

# Enable scheduler
# Edit application.properties:
kms.rotation.enabled=true
kms.rotation.check-cron=0 0 2 * * ?  # Daily at 2 AM
kms.rotation.max-age-days=90

# Restart application
systemctl restart fluo-backend

# Verify scheduler is running
curl -s http://localhost:8080/q/scheduler/status | jq '.schedulers[] | select(.name == "keyRotationCheck").enabled'
# Expected: true
```

### Solution 2: Fix Scheduler Startup Issues

**Problem**: Scheduler failed to start during application boot

```bash
# Check startup logs
grep "KeyRotationScheduler" /var/log/fluo/backend.log | head -n 20

# Common issues:
# - Quarkus CDI injection failure
# - @Scheduled annotation configuration error
# - Bean creation exception

# Verify all required beans are available:
curl -s http://localhost:8080/q/arc/beans | jq '.beans[] | select(.beanClass | contains("KeyRotation"))'

# If scheduler bean missing, check for compilation errors:
journalctl -u fluo-backend | grep -i "error.*KeyRotation"
```

**Fix**: Ensure all dependencies are present in `pom.xml`:
```xml
<dependency>
  <groupId>io.quarkus</groupId>
  <artifactId>quarkus-scheduler</artifactId>
</dependency>
```

### Solution 3: Fix IAM Permissions for Rotation

**Problem**: Application cannot rotate keys due to missing permissions

```bash
# Required IAM permissions for key rotation:
# - kms:GenerateDataKey (create new keys)
# - kms:Decrypt (decrypt old keys during transition)
# - kms:Encrypt (encrypt with new keys)
# - kms:DescribeKey (verify key status)
# - kms:RetireGrant (optional: cleanup old grants)

# Verify IAM policy
aws iam get-role-policy --role-name fluo-backend-role --policy-name kms-access | jq '.PolicyDocument.Statement[]'

# If missing permissions, update policy:
aws iam put-role-policy \
  --role-name fluo-backend-role \
  --policy-name kms-access \
  --policy-document file:///path/to/kms-rotation-iam-policy.json
```

### Solution 4: Stagger Rotation to Avoid Throttling

**Problem**: Rotating all tenants at once causes KMS API throttling

**Current Behavior** (batch rotation):
```java
// Rotates ALL tenants in single job (can overwhelm KMS)
@Scheduled(cron = "0 0 2 * * ?")
void rotateTenantKeys() {
    List<UUID> tenants = getAllTenants();
    for (UUID tenant : tenants) {
        rotateTenantKeys(tenant);  // 100s-1000s of API calls
    }
}
```

**Fix** (staggered rotation):
```properties
# Edit application.properties to enable staggering:
kms.rotation.batch-size=100           # Rotate 100 tenants per run
kms.rotation.check-cron=0 */15 * * * ?  # Every 15 minutes (instead of daily)
kms.rotation.stagger-delay-ms=100     # 100ms between tenant rotations
```

**Verification**:
```bash
# Check rotation is staggered
grep "Rotating tenant keys" /var/log/fluo/backend.log | tail -n 10
# Should show timestamps spread over time, not all at once

# Monitor KMS API call rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/KMS \
  --metric-name CallCount \
  --dimensions Name=KeyId,Value=<key-arn> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum
# Should show smooth rate, not spikes
```

### Solution 5: Optimize Rotation Performance

**Problem**: Rotation takes too long (>1 hour for all tenants)

```bash
# Check rotation duration
curl -s http://localhost:8080/q/metrics | grep kms_rotation_duration_seconds_sum
curl -s http://localhost:8080/q/metrics | grep kms_rotation_duration_seconds_count

# Calculate average time per tenant
total_duration=$(curl -s http://localhost:8080/q/metrics | grep kms_rotation_duration_seconds_sum | awk '{print $2}')
total_count=$(curl -s http://localhost:8080/q/metrics | grep kms_rotation_duration_seconds_count | awk '{print $2}')
avg_duration=$(echo "scale=2; $total_duration / $total_count" | bc)
echo "Average rotation time per tenant: ${avg_duration}s"

# Target: <1s per tenant
# If >1s, investigate:
# - KMS latency (network issues?)
# - Database writes (TigerBeetle slow?)
# - Unnecessary operations (can optimize code?)
```

**Optimization Options**:
1. **Parallel rotation** (careful with KMS throttling):
   ```properties
   kms.rotation.parallel-threads=5  # Rotate 5 tenants concurrently
   ```

2. **Skip tenants without activity**:
   ```properties
   kms.rotation.skip-inactive-tenants=true
   kms.rotation.inactive-threshold-days=30  # Skip tenants inactive >30 days
   ```

3. **Incremental rotation** (rotate N tenants per day):
   ```properties
   kms.rotation.daily-quota=100  # Rotate 100 tenants/day (complete cycle in 90 days)
   ```

---

## Manual Rotation (Emergency)

If automated rotation is broken and compliance deadline is urgent:

```bash
# 1. Get list of tenants needing rotation
curl -X GET http://localhost:8080/api/admin/kms/tenants-needing-rotation \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Rotate all keys immediately (WARNING: May cause KMS throttling)
curl -X POST http://localhost:8080/api/admin/kms/rotate-all-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force": true, "stagger_ms": 100}'

# 3. Monitor rotation progress
watch -n 10 'curl -s http://localhost:8080/api/admin/kms/rotation-status -H "Authorization: Bearer $ADMIN_TOKEN"'

# Expected output:
# {
#   "total_tenants": 500,
#   "rotated": 350,
#   "remaining": 150,
#   "progress_pct": 70.0,
#   "estimated_completion": "2025-10-22T14:30:00Z"
# }
```

---

## Verification

### Confirm Resolution

```bash
# 1. Check last rotation timestamp is recent
last_rotation=$(curl -s http://localhost:8080/q/metrics | grep kms_last_rotation_timestamp_seconds | awk '{print $2}')
current_time=$(date +%s)
days_since_rotation=$(( ($current_time - $(echo $last_rotation | cut -d. -f1)) / 86400 ))
echo "Days since last rotation: $days_since_rotation"
# Expected: <90

# 2. Verify scheduler is running
curl -s http://localhost:8080/q/scheduler/status | jq '.schedulers[] | select(.name == "keyRotationCheck")'
# Expected: "enabled": true, "nextExecution": <future timestamp>

# 3. Check rotation success rate
success=$(curl -s http://localhost:8080/q/metrics | grep kms_rotation_success_total | awk '{print $2}')
failures=$(curl -s http://localhost:8080/q/metrics | grep kms_rotation_failures_total | awk '{print $2}')
success_rate=$(echo "scale=2; $success / ($success + $failures) * 100" | bc)
echo "Rotation success rate: ${success_rate}%"
# Expected: >95%

# 4. Confirm alert is resolved
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname == "KMSKeyRotationOverdue")'
# Expected: No results (alert cleared)
```

### Monitor Next Rotation

```bash
# Schedule watch for next rotation cycle
next_run=$(curl -s http://localhost:8080/q/scheduler/status | jq -r '.schedulers[] | select(.name == "keyRotationCheck").nextExecution')
echo "Next rotation check: $next_run"

# Set reminder to verify rotation completes
# (Use calendar, PagerDuty scheduled check, or cron job)
```

---

## Escalation

### When to Escalate

Escalate to **Security Team** if:
- Rotation failing consistently (>3 days of failures)
- Approaching 120 days without rotation (severe compliance risk)
- Cannot identify root cause within 2 hours
- Manual rotation also failing

### Escalation Contact

- **Slack**: `#fluo-security` (compliance issues)
- **Email**: security@betrace.dev
- **Security Lead**: [Contact info in PagerDuty]

### Information to Provide

```bash
# Collect rotation diagnostic data
mkdir -p /tmp/rotation-diagnostic
cp /var/log/fluo/backend.log /tmp/rotation-diagnostic/
curl -s http://localhost:8080/q/metrics | grep kms_ > /tmp/rotation-diagnostic/kms-metrics.txt
curl -s http://localhost:8080/q/scheduler/status > /tmp/rotation-diagnostic/scheduler-status.json
tar -czf rotation-diagnostic-$(date +%Y%m%d-%H%M%S).tar.gz /tmp/rotation-diagnostic/

# Include in escalation:
# 1. Days since last rotation
# 2. Rotation failure rate
# 3. Root cause hypothesis
# 4. Steps already taken
```

---

## Post-Incident

### Compliance Documentation

```bash
# Generate rotation compliance report for auditors
curl -X GET http://localhost:8080/api/admin/compliance/rotation-report \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"start_date": "2025-01-01", "end_date": "2025-12-31"}' \
  > kms-rotation-report-2025.pdf

# Report includes:
# - All rotation events (timestamps, tenants, success/failure)
# - Compliance status (NIST 800-57, SOC2 CC6.1)
# - Gaps and remediation actions
```

### Preventive Actions

- [ ] Add rotation monitoring dashboard to Grafana
- [ ] Set up PagerDuty escalation for 80-day threshold (early warning)
- [ ] Document rotation capacity planning (tenants vs. rotation time)
- [ ] Add rotation dry-run to CI/CD (test scheduler works)

---

## Related Documentation

- [Key Rotation Architecture](../../docs/prds/006-kms-integration.md#key-rotation)
- [NIST 800-57 Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [SOC2 CC6.1 Compliance](../compliance-status.md)
- [KMS Provider Failure Runbook](kms-provider-failure.md)

---

**Runbook Version**: 1.0
**Last Updated**: 2025-10-22
**Owner**: SRE Team + Security Team
