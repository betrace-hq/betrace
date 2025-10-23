# KMS Quickstart Guide

**Goal**: Get KMS integration working in 30 minutes
**Audience**: Developers, DevOps Engineers
**Prerequisites**: FLUO backend running, basic AWS knowledge

---

## What is KMS Integration?

FLUO uses Key Management Service (KMS) to:
- **Sign compliance spans** (tamper-evident audit trail)
- **Encrypt sensitive data** (PII redaction with AES-256)
- **Isolate tenant keys** (per-tenant cryptographic isolation)

**Why it matters**: SOC2/HIPAA compliance requires strong cryptographic controls with proper key lifecycle management.

---

## Quick Decision Tree: Which KMS Should I Use?

```
┌─ Development/Testing? ────────────────┐
│  Use: LocalKmsAdapter (default)       │
│  Setup: Zero configuration            │
│  ⚠️  NOT for production                │
└────────────────────────────────────────┘

┌─ Production (AWS Infrastructure)? ────┐
│  Use: AWS KMS                          │
│  Setup: 15-30 minutes                  │
│  ✅ Recommended for most users         │
└────────────────────────────────────────┘

┌─ Production (On-Premises)? ───────────┐
│  Use: HashiCorp Vault Transit         │
│  Status: Coming Q2 2026                │
│  Alternative: Use AWS KMS              │
└────────────────────────────────────────┘

┌─ Production (Multi-Cloud)? ───────────┐
│  Use: GCP Cloud KMS or Azure Key Vault│
│  Status: Coming Q3 2026                │
│  Alternative: Use AWS KMS              │
└────────────────────────────────────────┘
```

---

## Step 1: Development Setup (LocalKmsAdapter) - 2 Minutes

**Perfect for**: Local development, testing, proof-of-concept

### Configuration

No configuration needed! LocalKmsAdapter is the default:

```properties
# backend/src/main/resources/application.properties
# LocalKmsAdapter is used by default (fluo.kms.provider=local)
```

### Start FLUO

```bash
cd /path/to/fluo
nix run .#backend
```

### Verify KMS is Working

```bash
# Check health endpoint
curl http://localhost:8080/q/health/ready | jq '.checks[] | select(.name == "kms")'

# Expected output:
# {
#   "name": "kms",
#   "status": "UP",
#   "data": {
#     "provider": "local",
#     "latency_ms": 5,
#     "status": "operational"
#   }
# }
```

### Test Compliance Span Signing

```bash
# Validate KMS operations
curl -X POST http://localhost:8080/api/admin/kms/validate | jq .

# Expected output:
# {
#   "provider": "local",
#   "overall": "PASS",
#   "tests": {
#     "generate_data_key": "PASS (2ms)",
#     "encrypt": "PASS (1ms)",
#     "decrypt": "PASS (2ms)",
#     "key_retrieval_cache_miss": "PASS (5ms)",
#     "key_retrieval_cache_hit": "PASS (1ms)"
#   },
#   "recommendations": [
#     "✅ KMS configuration is valid and ready for production",
#     "⚠️  WARNING: Using LocalKmsAdapter (development only)",
#     "⚠️  For production, switch to: fluo.kms.provider=aws"
#   ]
# }
```

**✅ Success!** You're now using LocalKmsAdapter for development.

**⚠️ Important**: LocalKmsAdapter stores keys in memory. Keys are lost on restart. **DO NOT use in production.**

---

## Step 2: Production Setup (AWS KMS) - 15-30 Minutes

**Perfect for**: Production deployments, SOC2/HIPAA compliance

### 2.1 Create AWS KMS Master Key (5 minutes)

#### Option A: AWS Console (Easy)

1. Open AWS Console → **KMS** → **Customer managed keys**
2. Click **Create key**
3. Configure key:
   - **Key type**: Symmetric
   - **Key usage**: Encrypt and decrypt
   - **Alias**: `fluo-master-key`
   - **Description**: "FLUO compliance span signing and PII encryption"
4. Click **Next** → **Next** → **Finish**
5. Copy the **Key ARN**: `arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...`

#### Option B: AWS CLI (Fast)

```bash
# Create KMS key
aws kms create-key \
  --description "FLUO KMS master key" \
  --key-usage ENCRYPT_DECRYPT \
  --origin AWS_KMS

# Create alias
aws kms create-alias \
  --alias-name alias/fluo-master-key \
  --target-key-id <KEY_ID_FROM_PREVIOUS_COMMAND>

# Get key ARN
aws kms describe-key --key-id alias/fluo-master-key | jq -r '.KeyMetadata.Arn'
# Copy this ARN for next step
```

### 2.2 Configure IAM Permissions (10 minutes)

Your FLUO backend needs 4 IAM permissions:

**Required Permissions**:
- `kms:GenerateDataKey` - Generate encryption keys
- `kms:Encrypt` - Encrypt data
- `kms:Decrypt` - Decrypt data
- `kms:DescribeKey` - Verify key status

#### Option A: IAM Policy (Recommended)

Create `fluo-kms-policy.json`:

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
      "Resource": "arn:aws:kms:us-east-1:123456789012:key/*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "fluo.your-company.com"
        }
      }
    }
  ]
}
```

Attach to your FLUO backend IAM role:

```bash
# Attach policy to IAM role
aws iam put-role-policy \
  --role-name fluo-backend-role \
  --policy-name fluo-kms-access \
  --policy-document file://fluo-kms-policy.json

# Verify
aws iam get-role-policy \
  --role-name fluo-backend-role \
  --policy-name fluo-kms-access
```

#### Option B: Terraform (Infrastructure as Code)

See [`terraform/aws-kms/`](../../terraform/aws-kms/) for ready-to-use Terraform modules.

### 2.3 Configure FLUO Backend (2 minutes)

Edit `application.properties`:

```properties
# KMS Provider
fluo.kms.provider=aws

# AWS KMS Configuration
aws.kms.master-key-id=arn:aws:kms:us-east-1:123456789012:key/abcd-1234-5678-90ab-cdef12345678
aws.kms.region=us-east-1

# Optional: LocalStack for testing
# aws.kms.endpoint=http://localhost:4566
```

### 2.4 Restart FLUO Backend

```bash
# Restart backend
nix run .#backend
```

### 2.5 Verify AWS KMS is Working (3 minutes)

```bash
# Check health endpoint
curl http://localhost:8080/q/health/ready | jq '.checks[] | select(.name == "kms")'

# Expected output:
# {
#   "name": "kms",
#   "status": "UP",
#   "data": {
#     "provider": "aws",
#     "latency_ms": 45,
#     "status": "operational"
#   }
# }
```

### 2.6 Validate Full KMS Configuration (5 minutes)

```bash
# Run comprehensive validation
curl -X POST http://localhost:8080/api/admin/kms/validate | jq .

# Expected output (SUCCESS):
# {
#   "provider": "aws",
#   "overall": "PASS",
#   "tests": {
#     "generate_data_key": "PASS (45ms)",
#     "encrypt": "PASS (38ms)",
#     "decrypt": "PASS (42ms)",
#     "key_retrieval_cache_miss": "PASS (95ms)",
#     "key_retrieval_cache_hit": "PASS (2ms)"
#   },
#   "latency_ms": {
#     "generate_data_key": 45,
#     "cache_miss": 95,
#     "cache_hit": 2
#   },
#   "recommendations": [
#     "✅ KMS configuration is valid and ready for production"
#   ]
# }
```

**✅ Success!** AWS KMS is configured and working.

### 2.7 Troubleshooting Common Issues

#### Issue: "Access Denied" or "not authorized to perform: kms:GenerateDataKey"

**Cause**: IAM permissions missing

**Fix**:
```bash
# Verify IAM policy attached
aws iam list-role-policies --role-name fluo-backend-role

# If missing, attach policy (see Step 2.2)
```

#### Issue: Health check returns "DOWN"

**Cause**: Network connectivity or incorrect key ARN

**Fix**:
```bash
# Test KMS access directly
aws kms generate-data-key \
  --key-id arn:aws:kms:us-east-1:123456789012:key/... \
  --key-spec AES_256

# If this fails, check:
# 1. Key ARN is correct
# 2. Region is correct (us-east-1)
# 3. IAM permissions attached
```

#### Issue: Validation endpoint returns "FAIL"

**Cause**: One of the required permissions is missing

**Fix**: Check recommendations in validation response. Most common:
- Missing `kms:Decrypt` permission
- Incorrect encryption context
- Key is disabled or scheduled for deletion

**See full troubleshooting guide**: [KMS_TROUBLESHOOTING.md](KMS_TROUBLESHOOTING.md)

---

## Step 3: Verify Production Readiness (5 minutes)

### Pre-Deployment Checklist

Before deploying to production, verify:

```bash
# 1. KMS provider is NOT "local"
curl http://localhost:8080/api/admin/kms/status | jq '.provider'
# Expected: "aws" (NOT "local")

# 2. All validation tests pass
curl -X POST http://localhost:8080/api/admin/kms/validate | jq '.overall'
# Expected: "PASS"

# 3. Cache hit latency is low
curl -X POST http://localhost:8080/api/admin/kms/validate | jq '.latency_ms.cache_hit'
# Expected: <10ms

# 4. Health check is UP
curl http://localhost:8080/q/health/ready | jq '.checks[] | select(.name == "kms").status'
# Expected: "UP"
```

**✅ All checks passed?** You're ready for production!

---

## Step 4: Monitor KMS Performance (Ongoing)

### Key Metrics to Watch

**Cache Hit Rate** (target: >80%):
```bash
# Query Prometheus metrics
curl http://localhost:8080/q/metrics | grep kms_cache_hit_total
curl http://localhost:8080/q/metrics | grep kms_cache_miss_total
```

**KMS Operation Success Rate** (target: >99%):
```bash
curl http://localhost:8080/q/metrics | grep kms_errors_total
```

**P99 Latency** (target: <100ms uncached, <5ms cached):
```bash
curl http://localhost:8080/q/metrics | grep kms_retrieve_signing_key_seconds
```

### Grafana Dashboard

Import the FLUO KMS dashboard:
```bash
# Dashboard JSON available at:
# monitoring/grafana/dashboards/kms-operations.json
```

**Metrics visualized**:
- Cache hit rate (line chart)
- KMS operation latency (histogram)
- Error rate (counter)
- Key rotation status (gauge)

---

## Cost Estimation

### AWS KMS Pricing (us-east-1, as of 2025)

**Master Key Storage**: $1/month per key
**API Requests**: $0.03 per 10,000 requests

**Example Cost Calculation**:

```
Assumptions:
- 1,000 requests/second
- 80% cache hit rate → 200 KMS API calls/second
- 30 days/month

Monthly KMS API calls:
  200 calls/sec × 86,400 sec/day × 30 days = 518.4M calls/month

Monthly cost:
  Master key: $1
  API calls: (518.4M / 10,000) × $0.03 = $1,555.20
  Total: $1,556.20/month
```

**Cost Optimization**:
- Increase cache TTL (reduce KMS calls)
- Target >80% cache hit rate (reduces API costs by 5x)
- Use cache warming on deployment

**See**: [docs/runbooks/kms-cache-hit-rate-low.md](../runbooks/kms-cache-hit-rate-low.md) for cost optimization strategies.

---

## Advanced Configuration

### Multi-Region Setup

For disaster recovery, replicate KMS keys across regions:

```properties
# Primary region
aws.kms.master-key-id=arn:aws:kms:us-east-1:123456789012:key/primary-key-id
aws.kms.region=us-east-1

# Failover region (automatic via AWS KMS multi-region keys)
# Create multi-region key in AWS Console
```

### LocalStack for Testing

Test AWS KMS locally without AWS account:

```bash
# Start LocalStack
docker run -d -p 4566:4566 localstack/localstack

# Configure FLUO to use LocalStack
# application.properties:
aws.kms.endpoint=http://localhost:4566
```

### Key Rotation

FLUO automatically rotates tenant keys every 90 days (NIST 800-57 compliance).

**Configuration**:
```properties
# Key rotation settings (defaults)
kms.rotation.enabled=true
kms.rotation.check-cron=0 0 2 * * ?  # Daily at 2 AM
kms.rotation.max-age-days=90
```

**Monitor rotation status**:
```bash
curl http://localhost:8080/q/metrics | grep kms_last_rotation_timestamp_seconds
```

**See**: [docs/runbooks/key-rotation-failure.md](../runbooks/key-rotation-failure.md) for troubleshooting.

---

## Next Steps

### Just Getting Started?
- ✅ Complete this quickstart (30 minutes)
- 📖 Read: [AWS KMS Setup Tutorial](AWS_KMS_SETUP.md) (detailed step-by-step)
- 🔧 Test: [KMS Troubleshooting Guide](KMS_TROUBLESHOOTING.md) (common issues)

### Ready for Production?
- ☁️ Deploy: Use Terraform modules in `terraform/aws-kms/`
- 📊 Monitor: Set up Grafana dashboard + Prometheus alerts
- 📚 Review: [SRE Runbooks](../runbooks/) for incident response

### Advanced Use Cases?
- 🔐 BYOK: Bring Your Own Key with AWS KMS External Key Store
- 🌍 Multi-Region: Cross-region key replication for disaster recovery
- 🏢 Enterprise: Per-tenant KMS keys for ultimate isolation

---

## Support

### Documentation
- **Setup**: [AWS KMS Setup Tutorial](AWS_KMS_SETUP.md)
- **Troubleshooting**: [KMS Troubleshooting Guide](KMS_TROUBLESHOOTING.md)
- **Operations**: [SRE Runbooks](../runbooks/)
- **Architecture**: [PRD-006: KMS Integration System](../prds/006-kms-integration.md)

### Getting Help
- **Issues**: https://github.com/fluohq/fluo/issues
- **Slack**: `#fluo-support` (for customers)
- **Email**: support@fluo.dev

---

**Last Updated**: 2025-10-22
**Estimated Completion Time**: 30 minutes
**Difficulty**: Beginner to Intermediate
