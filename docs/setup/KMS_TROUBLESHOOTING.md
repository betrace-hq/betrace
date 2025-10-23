# KMS Troubleshooting Guide

**Purpose**: Diagnose and fix common KMS integration issues
**Audience**: Developers, DevOps, Support Engineers
**Time to Resolution**: 5-30 minutes per issue

---

## Quick Diagnostic Commands

Run these commands to gather diagnostic information:

```bash
# 1. Check KMS provider configuration
grep "betrace.kms.provider" backend/src/main/resources/application.properties

# 2. Check health endpoint
curl http://localhost:8080/q/health/ready | jq '.checks[] | select(.name == "kms")'

# 3. Run validation endpoint
curl -X POST http://localhost:8080/api/admin/kms/validate | jq .

# 4. Check KMS status
curl http://localhost:8080/api/admin/kms/status | jq .

# 5. View recent KMS errors in logs
grep "KmsException\|KMS\|kms" /var/log/betrace/backend.log | tail -n 50

# 6. Check Prometheus metrics
curl -s http://localhost:8080/q/metrics | grep kms_errors_total
```

---

## Top 10 Common Issues

### Issue 1: "Access Denied" - IAM Permission Error

**Symptom**:
```
KmsException: User: arn:aws:iam::123456789012:role/betrace-backend-role
is not authorized to perform: kms:GenerateDataKey on resource:
arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...
```

**Cause**: IAM policy missing required KMS permissions

**Diagnosis**:
```bash
# Check IAM policies attached to role
aws iam list-attached-role-policies --role-name betrace-backend-role

# Check inline policies
aws iam list-role-policies --role-name betrace-backend-role

# Get policy details
aws iam get-role-policy \
  --role-name betrace-backend-role \
  --policy-name betrace-kms-access
```

**Solution**:

1. **Verify all 4 permissions present**:
   - `kms:GenerateDataKey`
   - `kms:Encrypt`
   - `kms:Decrypt`
   - `kms:DescribeKey`

2. **Add missing permissions**:

Create `betrace-kms-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:GenerateDataKey",
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:123456789012:key/*"
    }
  ]
}
```

Attach policy:
```bash
aws iam put-role-policy \
  --role-name betrace-backend-role \
  --policy-name betrace-kms-access \
  --policy-document file://betrace-kms-policy.json
```

3. **Verify fix**:
```bash
# Test KMS access
aws kms generate-data-key \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-... \
  --key-spec AES_256

# Should return JSON with CiphertextBlob and Plaintext
```

**Prevention**: Use Terraform module from `terraform/aws-kms/` to ensure correct permissions.

---

### Issue 2: Health Check Returns "DOWN"

**Symptom**:
```json
{
  "name": "kms",
  "status": "DOWN",
  "data": {
    "provider": "aws",
    "error": "Failed to generate data key: Connection timed out"
  }
}
```

**Cause**: Network connectivity issue or KMS key problem

**Diagnosis**:
```bash
# Test network connectivity to AWS KMS
curl -v https://kms.us-east-1.amazonaws.com

# Test KMS key exists
aws kms describe-key \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...

# Check key state
aws kms describe-key \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-... \
  | jq '.KeyMetadata.KeyState'
```

**Solution**:

**If connection timeout**:
1. Check security group allows outbound HTTPS (port 443)
2. Check VPC route table has route to internet gateway
3. Check NAT gateway is working (for private subnets)

```bash
# Check security group
aws ec2 describe-security-groups --group-ids sg-abc123 \
  | jq '.SecurityGroups[].IpPermissionsEgress'

# Should include:
# - Protocol: -1 (all)
# - Port: 0-65535
# - Destination: 0.0.0.0/0
```

**If key state is "Disabled"**:
```bash
# Enable KMS key
aws kms enable-key --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...
```

**If key state is "PendingDeletion"**:
```bash
# Cancel deletion
aws kms cancel-key-deletion --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...
```

**Verify fix**:
```bash
curl http://localhost:8080/q/health/ready | jq '.checks[] | select(.name == "kms").status'
# Expected: "UP"
```

---

### Issue 3: Using LocalKmsAdapter in Production

**Symptom**:
```
WARN  ⚠️  Using LocalKmsAdapter - NOT FOR PRODUCTION USE
```

**Cause**: `betrace.kms.provider=local` in production environment

**Why this is bad**:
- Master keys stored in memory (lost on restart)
- No SOC2/HIPAA compliance
- Keys not backed by HSM
- Audit failure guaranteed

**Diagnosis**:
```bash
# Check current provider
curl http://localhost:8080/api/admin/kms/status | jq -r '.provider'

# If output is "local" → PROBLEM
```

**Solution**:

1. **Set up AWS KMS** (see [AWS_KMS_SETUP.md](AWS_KMS_SETUP.md))

2. **Update configuration**:
```properties
# backend/src/main/resources/application.properties
betrace.kms.provider=aws
aws.kms.master-key-id=arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...
aws.kms.region=us-east-1
```

3. **Restart application**:
```bash
nix run .#backend
```

4. **Verify fix**:
```bash
curl http://localhost:8080/api/admin/kms/status | jq -r '.provider'
# Expected: "aws"
```

**Prevention**: Add deployment checklist step to validate KMS provider before production deployment.

---

### Issue 4: High KMS Latency (>200ms)

**Symptom**:
```json
{
  "latency_ms": {
    "generate_data_key": 350,
    "cache_miss": 380
  }
}
```

**Cause**: Cross-region latency or network issues

**Diagnosis**:
```bash
# Check KMS region
grep "aws.kms.region" application.properties

# Check BeTrace deployment region
curl http://169.254.169.254/latest/meta-data/placement/region

# Test latency directly
time aws kms generate-data-key \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-... \
  --key-spec AES_256
```

**Solution**:

**If regions don't match**:
1. Create KMS key in same region as BeTrace deployment
2. Update `aws.kms.master-key-id` and `aws.kms.region` in config

**If using NAT gateway** (adds 10-30ms latency):
1. Create VPC endpoint for KMS:
```bash
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-abc123 \
  --service-name com.amazonaws.us-east-1.kms \
  --route-table-ids rtb-abc123
```

Benefits of VPC endpoint:
- Reduces latency (traffic stays in AWS network)
- Reduces NAT gateway costs
- Improved security

**If AWS service degradation**:
1. Check AWS Service Health: https://health.aws.amazon.com/
2. Subscribe to AWS KMS status updates
3. Consider multi-region failover

**Verify fix**:
```bash
curl -X POST http://localhost:8080/api/admin/kms/validate | jq '.latency_ms.generate_data_key'
# Expected: <100ms
```

---

### Issue 5: Cache Hit Rate Low (<80%)

**Symptom**:
```bash
# Calculate cache hit rate
hits=$(curl -s http://localhost:8080/q/metrics | grep 'kms_cache_hit_total{key_type="signing"}' | awk '{print $2}')
misses=$(curl -s http://localhost:8080/q/metrics | grep 'kms_cache_miss_total{key_type="signing"}' | awk '{print $2}')
hit_rate=$(echo "scale=2; $hits / ($hits + $misses) * 100" | bc)
echo "Cache hit rate: ${hit_rate}%"
# Output: 45% (BELOW 80% TARGET)
```

**Cause**: Cache TTL too short or cache evictions

**Diagnosis**:
```bash
# Check cache configuration
grep "kms.cache" application.properties

# Check cache status
curl http://localhost:8080/api/admin/kms/status | jq '.cache_size'
```

**Solution**:

**Increase cache TTL**:
```properties
# application.properties
# Default: 60 minutes private, 24 hours public
kms.cache.private-key-ttl-minutes=120
kms.cache.public-key-ttl-hours=48
```

**Increase cache size** (if evictions due to size):
```properties
kms.cache.max-size=2000  # Default: 1000
```

**Implement cache warming** (on deployment):
```java
// Add to startup
@Startup
public class CacheWarmer {
    void warmCache(@Observes StartupEvent event) {
        // Pre-load top 100 active tenants
        for (UUID tenantId : getActiveT enants(100)) {
            keyRetrieval.getSigningKey(tenantId);
        }
    }
}
```

**Verify fix**:
```bash
# Wait 10 minutes, then recalculate hit rate
# Should be >80%
```

**See detailed guide**: [docs/runbooks/kms-cache-hit-rate-low.md](../runbooks/kms-cache-hit-rate-low.md)

---

### Issue 6: "Unsupported provider: vault" Error

**Symptom**:
```
UnsupportedOperationException: VaultKmsAdapter not yet implemented.
Supported providers: 'aws' (production), 'local' (development only).
```

**Cause**: Configured KMS provider not yet implemented

**Diagnosis**:
```bash
grep "betrace.kms.provider" application.properties
# Output: betrace.kms.provider=vault
```

**Solution**:

**Current supported providers**:
- ✅ `aws` - AWS KMS (production-ready)
- ✅ `local` - LocalKmsAdapter (development only)
- ❌ `vault` - Coming Q2 2026
- ❌ `gcp` - Coming Q3 2026
- ❌ `azure` - Coming Q3 2026

**Use AWS KMS for production**:
```properties
betrace.kms.provider=aws
aws.kms.master-key-id=arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...
aws.kms.region=us-east-1
```

**Alternative (on-premises requirement)**:
- Wait for VaultKmsAdapter (Q2 2026)
- Or implement custom KMS adapter (see `backend/src/main/java/com/betrace/kms/adapters/`)

**Verify fix**:
```bash
curl http://localhost:8080/api/admin/kms/status | jq -r '.provider'
# Expected: "aws"
```

---

### Issue 7: Key Rotation Overdue (>90 Days)

**Symptom**:
```
ALERT: KMSKeyRotationOverdue - Key rotation has not occurred for 95 days
```

**Cause**: Key rotation scheduler disabled or failing

**Diagnosis**:
```bash
# Check last rotation timestamp
curl -s http://localhost:8080/q/metrics | grep kms_last_rotation_timestamp_seconds

# Calculate days since rotation
last_rotation=$(curl -s http://localhost:8080/q/metrics | grep kms_last_rotation_timestamp_seconds | awk '{print $2}')
current_time=$(date +%s)
days_since_rotation=$(( ($current_time - $(echo $last_rotation | cut -d. -f1)) / 86400 ))
echo "Days since last rotation: $days_since_rotation"

# Check rotation scheduler status
grep "KeyRotationScheduler" /var/log/betrace/backend.log | tail -n 20
```

**Solution**:

**Enable rotation scheduler**:
```properties
# application.properties
kms.rotation.enabled=true
kms.rotation.check-cron=0 0 2 * * ?  # Daily at 2 AM
kms.rotation.max-age-days=90
```

**Manual rotation (emergency)**:
```bash
curl -X POST http://localhost:8080/api/admin/kms/rotate-all-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Verify fix**:
```bash
# Wait 24 hours, then check rotation occurred
grep "Key rotation complete" /var/log/betrace/backend.log | tail -n 1
```

**See detailed guide**: [docs/runbooks/key-rotation-failure.md](../runbooks/key-rotation-failure.md)

---

### Issue 8: "Invalid encryption context" Error

**Symptom**:
```
KmsException: The encryption context provided does not match the encryption context
used to generate the data key
```

**Cause**: Encryption context mismatch between encrypt and decrypt operations

**Diagnosis**:
```bash
# Check application logs for encryption context
grep "encryption context" /var/log/betrace/backend.log | tail -n 10
```

**Solution**:

**Encryption context must match exactly**:

Correct usage:
```java
// Encrypt
var context = Map.of("tenantId", "abc-123", "keyType", "encryption");
var dataKey = kms.generateDataKey("AES_256", context);

// Decrypt (MUST use same context)
byte[] decrypted = kms.decrypt(dataKey.encryptedKey(), context);
```

Incorrect usage:
```java
// Encrypt
var context1 = Map.of("tenantId", "abc-123");

// Decrypt (DIFFERENT context → ERROR)
var context2 = Map.of("tenant_id", "abc-123");  // Key name different!
byte[] decrypted = kms.decrypt(encrypted, context2);  // FAILS
```

**Common mistakes**:
- Key name typo: `tenantId` vs `tenant_id`
- Missing key in context
- Extra key in context
- Different value for same key

**Verify fix**:
```bash
curl -X POST http://localhost:8080/api/admin/kms/validate | jq '.tests.encrypt, .tests.decrypt'
# Both should be "PASS"
```

---

### Issue 9: AWS KMS Costs Higher Than Expected

**Symptom**:
```
AWS Bill: KMS charges $2,500/month (expected $100/month)
```

**Cause**: High KMS API usage due to low cache hit rate or excessive requests

**Diagnosis**:
```bash
# Check KMS API call volume
aws cloudwatch get-metric-statistics \
  --namespace AWS/KMS \
  --metric-name NumberOfRequests \
  --dimensions Name=KeyId,Value=abcd-1234-... \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum

# Check cache hit rate
hits=$(curl -s http://localhost:8080/q/metrics | grep kms_cache_hit_total | awk '{print $2}')
misses=$(curl -s http://localhost:8080/q/metrics | grep kms_cache_miss_total | awk '{print $2}')
hit_rate=$(echo "scale=2; $hits / ($hits + $misses) * 100" | bc)
echo "Cache hit rate: ${hit_rate}%"
```

**Solution**:

**Optimize cache configuration**:
```properties
# Increase cache TTL
kms.cache.private-key-ttl-minutes=120  # 2 hours
kms.cache.public-key-ttl-hours=48      # 48 hours

# Increase cache size
kms.cache.max-size=2000
```

**Cost calculation**:
```
# Current (50% hit rate):
1000 req/sec × 50% miss rate × 86400 sec/day × 30 days = 1.296B API calls/month
Cost: (1,296,000,000 / 10,000) × $0.03 = $3,888/month

# Optimized (80% hit rate):
1000 req/sec × 20% miss rate × 86400 sec/day × 30 days = 518M API calls/month
Cost: (518,400,000 / 10,000) × $0.03 = $1,555/month

Savings: $2,333/month (60% reduction)
```

**Verify fix**:
```bash
# After 1 week, check costs reduced
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AWS Key Management Service"]}}'
```

**See detailed guide**: [docs/runbooks/kms-cost-optimization.md](../runbooks/kms-cost-optimization.md) (if exists)

---

### Issue 10: Circuit Breaker OPEN (KMS Operations Blocked)

**Symptom**:
```
WARN  Circuit breaker 'kms-signing-key' is OPEN - blocking all requests
```

**Cause**: KMS experienced 50% failure rate, circuit breaker opened to protect system

**Diagnosis**:
```bash
# Check circuit breaker status
curl -s http://localhost:8080/q/metrics | grep 'circuit_breaker_state{name="kms-signing-key"}'
# 0 = CLOSED (normal)
# 1 = OPEN (blocking)
# 2 = HALF_OPEN (testing recovery)

# Check recent KMS errors
curl -s http://localhost:8080/q/metrics | grep kms_errors_total
```

**Solution**:

**Circuit breaker is protecting your system** - don't disable it!

**Fix the underlying KMS issue**:
1. Check health endpoint: `curl http://localhost:8080/q/health/ready`
2. Review recent errors: `grep "KmsException" /var/log/betrace/backend.log | tail -n 50`
3. Common causes:
   - IAM permission denied
   - KMS key disabled
   - Network connectivity issue
   - AWS service degradation

**Circuit breaker auto-recovery**:
- After 5 seconds, tests 1 request (HALF_OPEN)
- If successful, requires 3 consecutive successes → CLOSED
- If fails, stays OPEN for another 5 seconds

**Monitor recovery**:
```bash
# Watch circuit breaker state
watch -n 5 'curl -s http://localhost:8080/q/metrics | grep circuit_breaker_state'
```

**Manual reset** (if KMS fixed but circuit breaker stuck):
```bash
# Restart application (circuit breaker resets)
systemctl restart betrace-backend
```

**See detailed guide**: [docs/runbooks/kms-provider-failure.md](../runbooks/kms-provider-failure.md)

---

## Advanced Troubleshooting

### Enable Debug Logging

Add to `application.properties`:
```properties
# Enable KMS debug logging
quarkus.log.category."com.betrace.kms".level=DEBUG
quarkus.log.category."com.betrace.services.KeyRetrievalService".level=DEBUG

# Enable AWS SDK debug logging
quarkus.log.category."software.amazon.awssdk".level=DEBUG
```

Restart application, then check logs:
```bash
tail -f /var/log/betrace/backend.log | grep "KMS\|kms"
```

### Test KMS Directly (Bypass BeTrace)

Test AWS KMS using AWS CLI to isolate issue:

```bash
# Generate data key
aws kms generate-data-key \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-... \
  --key-spec AES_256 \
  --encryption-context tenantId=test-tenant

# Expected: JSON with CiphertextBlob and Plaintext

# Encrypt
echo "test-plaintext" | base64 > /tmp/plaintext.txt
aws kms encrypt \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-... \
  --plaintext fileb:///tmp/plaintext.txt

# Decrypt
aws kms decrypt \
  --ciphertext-blob fileb:///tmp/ciphertext.bin
```

If AWS CLI works but BeTrace doesn't:
- Check BeTrace IAM role permissions
- Check BeTrace configuration (key ARN, region)
- Enable debug logging in BeTrace

### Inspect OpenTelemetry Traces

View distributed traces for KMS operations:

```bash
# Query traces with KMS errors
# (Assuming Grafana Tempo backend)
curl -s "http://localhost:3100/api/search?tags=span.error=true&tags=span.kms.*" | jq .
```

Trace attributes to check:
- `tenant.id` - Which tenant caused issue
- `cache.hit` - Was cache used?
- `latency.ms` - How long did operation take?
- `error.message` - What went wrong?

### Check AWS CloudTrail Logs

View KMS API calls in CloudTrail:

1. Open AWS Console → **CloudTrail** → **Event history**
2. Filter:
   - **Event source**: `kms.amazonaws.com`
   - **Event name**: `GenerateDataKey`, `Encrypt`, `Decrypt`
   - **Time range**: Last 1 hour
3. Look for:
   - `errorCode`: AccessDenied, InvalidKeyId, etc.
   - `sourceIPAddress`: BeTrace backend IP
   - `requestParameters`: Encryption context

### Performance Profiling

Profile KMS operations to find bottlenecks:

```bash
# Query Prometheus for P99 latency breakdown
curl -s http://localhost:8080/q/metrics | grep kms_retrieve_signing_key_seconds_bucket

# Calculate P99
# (Use Grafana or PromQL for easier visualization)
```

Latency targets:
- `cache_hit`: <5ms ✅
- `cache_miss` (includes KMS call): <100ms ✅
- `generate_data_key`: <50ms ✅

If latency exceeds targets:
- Check network (VPC endpoint, NAT gateway)
- Check KMS region proximity
- Check AWS service health

---

## Getting Help

### Before Escalating

Collect diagnostic information:

```bash
#!/bin/bash
# diagnostic-bundle.sh

# Create diagnostic bundle
mkdir -p /tmp/betrace-kms-diagnostic
cd /tmp/betrace-kms-diagnostic

# 1. Configuration
grep -A 10 "KMS" /path/to/application.properties > config.txt

# 2. Health check
curl http://localhost:8080/q/health/ready > health.json

# 3. Validation
curl -X POST http://localhost:8080/api/admin/kms/validate > validation.json

# 4. Status
curl http://localhost:8080/api/admin/kms/status > status.json

# 5. Metrics
curl -s http://localhost:8080/q/metrics | grep kms_ > metrics.txt

# 6. Recent logs
grep -A 5 -B 5 "KmsException\|KMS\|kms" /var/log/betrace/backend.log | tail -n 200 > logs.txt

# 7. AWS KMS key info (if accessible)
aws kms describe-key --key-id $AWS_KMS_KEY_ARN > kms-key-info.json 2>&1

# 8. IAM policy (if accessible)
aws iam get-role-policy --role-name betrace-backend-role --policy-name betrace-kms-access > iam-policy.json 2>&1

# Create tarball
cd /tmp
tar -czf betrace-kms-diagnostic-$(date +%Y%m%d-%H%M%S).tar.gz betrace-kms-diagnostic/

echo "Diagnostic bundle created: $(ls -lh betrace-kms-diagnostic-*.tar.gz)"
```

### Support Channels

**Community Support**:
- GitHub Issues: https://github.com/betracehq/betrace/issues
- Tag: `kms-integration`

**Enterprise Support**:
- Email: support@betrace.dev
- Slack: `#betrace-support` (for customers)
- Include: Diagnostic bundle + steps to reproduce

**SRE Escalation** (for critical production issues):
- PagerDuty: "KMS Integration" escalation policy
- Severity: CRITICAL (if compliance spans failing)

### Documentation

**Setup Guides**:
- [KMS Quickstart Guide](KMS_QUICKSTART.md) - 30-minute overview
- [AWS KMS Setup Tutorial](AWS_KMS_SETUP.md) - Detailed step-by-step

**Operational Guides**:
- [SRE Runbook: KMS Provider Failure](../runbooks/kms-provider-failure.md)
- [SRE Runbook: Key Rotation Failure](../runbooks/key-rotation-failure.md)
- [SRE Runbook: Cache Hit Rate Low](../runbooks/kms-cache-hit-rate-low.md)

**Architecture**:
- [PRD-006: KMS Integration System](../prds/006-kms-integration.md)
- [ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)

---

## FAQ

### Q: Can I use KMS from a different AWS account?

**A**: Yes, with cross-account IAM permissions.

1. Add BeTrace account to KMS key policy:
```json
{
  "Sid": "Allow cross-account use",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::BETRACE_ACCOUNT_ID:role/betrace-backend-role"
  },
  "Action": ["kms:GenerateDataKey", "kms:Encrypt", "kms:Decrypt", "kms:DescribeKey"],
  "Resource": "*"
}
```

2. Update BeTrace config with cross-account key ARN
3. Test with validation endpoint

### Q: How do I migrate from LocalKmsAdapter to AWS KMS?

**A**: See [AWS_KMS_SETUP.md](AWS_KMS_SETUP.md), Section "Migration from Local to AWS"

Summary:
1. Set up AWS KMS key + IAM permissions
2. Update `betrace.kms.provider=aws` in config
3. Restart BeTrace (cache will repopulate)
4. Validate with `/api/admin/kms/validate`

**Note**: Existing compliance spans signed with LocalKmsAdapter will fail verification. This is expected (keys are not preserved across LocalKmsAdapter restarts).

### Q: Can I rotate AWS KMS master keys automatically?

**A**: AWS KMS supports automatic key rotation (once per year):

```bash
# Enable automatic rotation
aws kms enable-key-rotation \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...

# Check rotation status
aws kms get-key-rotation-status \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...
```

**BeTrace tenant key rotation** (90-day rotation) is separate and controlled by:
```properties
kms.rotation.enabled=true
kms.rotation.max-age-days=90
```

### Q: What happens if KMS is temporarily unavailable?

**A**: Circuit breaker protects your application:

1. After 50% failure rate, circuit breaker OPENS
2. Requests fail-fast (no KMS calls for 5 seconds)
3. After 5 seconds, circuit breaker tests recovery (HALF_OPEN)
4. If 3 consecutive successes, circuit breaker CLOSES (normal operation)

**Impact**: Compliance span signing temporarily unavailable, but application remains responsive.

### Q: Can I use LocalStack to test AWS KMS integration?

**A**: Yes! See [AWS_KMS_SETUP.md](AWS_KMS_SETUP.md), Appendix C.

```bash
# Start LocalStack
docker run -d -p 4566:4566 -e SERVICES=kms localstack/localstack

# Configure BeTrace
betrace.kms.provider=aws
aws.kms.endpoint=http://localhost:4566
```

---

**Last Updated**: 2025-10-22
**Maintained By**: BeTrace SRE Team
**Feedback**: support@betrace.dev
