# AWS KMS Setup Tutorial

**Goal**: Complete AWS KMS configuration for BeTrace production deployment
**Time**: 45-60 minutes
**Difficulty**: Intermediate
**Prerequisites**: AWS account with admin access, BeTrace backend installed

---

## Overview

This tutorial walks through AWS KMS setup for BeTrace, including:
1. Creating a KMS master key
2. Configuring IAM permissions
3. Setting up BeTrace backend
4. Testing and validation
5. Production deployment checklist

**Why AWS KMS?**
- SOC2/HIPAA compliant key management
- Hardware Security Module (HSM) backed
- Automatic key rotation (optional)
- CloudTrail audit logging
- Multi-region replication support

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  BeTrace Backend                                                │
│  ┌────────────────────┐                                      │
│  │ KeyRetrievalService│                                      │
│  │  (with cache)      │                                      │
│  └────────┬───────────┘                                      │
│           │                                                   │
│           ▼                                                   │
│  ┌────────────────────┐                                      │
│  │  AwsKmsAdapter     │                                      │
│  └────────┬───────────┘                                      │
└───────────┼─────────────────────────────────────────────────┘
            │ KMS API calls
            │ (kms:GenerateDataKey, kms:Encrypt, kms:Decrypt)
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│  AWS KMS                                                   │
│  ┌─────────────────────────────────────────┐              │
│  │  Master Key (CMK)                        │              │
│  │  arn:aws:kms:us-east-1:123...:key/abc   │              │
│  │                                          │              │
│  │  - Encrypts data keys (envelope encryption)│           │
│  │  - Never leaves AWS KMS                  │              │
│  │  - HSM-backed                            │              │
│  └─────────────────────────────────────────┘              │
└───────────────────────────────────────────────────────────┘
```

**Key Concepts**:
- **Master Key (CMK)**: Never leaves AWS KMS, used to encrypt data keys
- **Data Key**: Generated for each operation, used to encrypt actual data
- **Envelope Encryption**: Data encrypted with data key, data key encrypted with master key
- **IAM Permissions**: Control who can use the master key

---

## Part 1: Create KMS Master Key (15 minutes)

### Step 1.1: Open AWS KMS Console

1. Log in to **AWS Console**
2. Navigate to **Services** → **Security, Identity, & Compliance** → **Key Management Service**
3. Ensure you're in the correct region (e.g., **us-east-1**)
   - Region appears in top-right corner
   - **Important**: BeTrace must use same region as KMS key

### Step 1.2: Create Customer Managed Key

1. Click **Customer managed keys** in left sidebar
2. Click **Create key** button (orange button, top-right)

### Step 1.3: Configure Key (Step 1 of 5)

**Key type**:
- Select: ☑️ **Symmetric**
- Reason: BeTrace uses symmetric encryption (AES-256-GCM)

**Key usage**:
- Select: ☑️ **Encrypt and decrypt**
- Reason: BeTrace needs both operations for envelope encryption

**Advanced options** (expand):
- **Key material origin**: ☑️ **KMS** (default)
- **Regionality**: ☑️ **Single-Region key** (unless you need multi-region)

**Multi-Region Keys** (optional):
- For disaster recovery across regions
- Costs ~$1/month per replica
- Recommended for enterprise deployments

Click **Next**

### Step 1.4: Add Labels (Step 2 of 5)

**Alias**:
- Enter: `betrace-master-key`
- Why: Human-readable name for the key
- You can reference by alias: `alias/betrace-master-key`

**Description**:
- Enter: `BeTrace KMS master key for compliance span signing and PII encryption`

**Tags** (optional but recommended):
- Key: `Application`, Value: `BeTrace`
- Key: `Environment`, Value: `Production`
- Key: `ManagedBy`, Value: `Terraform` (if using IaC)
- Key: `CostCenter`, Value: `Engineering`

Click **Next**

### Step 1.5: Define Key Administrative Permissions (Step 3 of 5)

**Key administrators** (can manage key but NOT use it):
- Select your IAM user or role
- **Recommended**: Create dedicated IAM role `betrace-kms-admin`

**Key deletion**:
- ☑️ **Allow key administrators to delete this key**
- Warning: Deleted keys cannot be recovered after 7-30 day waiting period

Click **Next**

### Step 1.6: Define Key Usage Permissions (Step 4 of 5)

**This account**:
- Select: IAM role used by BeTrace backend (e.g., `betrace-backend-role`)
- If role doesn't exist yet, you can add it later

**Other AWS accounts** (optional):
- For cross-account access
- Not typically needed for single-account deployments

**Important**: This step only grants `kms:Decrypt` and `kms:Encrypt`. You'll need to add `kms:GenerateDataKey` manually in next section.

Click **Next**

### Step 1.7: Review and Create (Step 5 of 5)

Review key policy JSON (will look like):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Enable IAM User Permissions",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:root"
      },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "Allow use of the key",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/betrace-backend-role"
      },
      "Action": [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:DescribeKey"
      ],
      "Resource": "*"
    }
  ]
}
```

Click **Finish**

### Step 1.8: Copy Key ARN

1. After creation, you'll see key details page
2. Copy the **ARN** (Amazon Resource Name):
   ```
   arn:aws:kms:us-east-1:123456789012:key/abcd1234-5678-90ab-cdef-1234567890ab
   ```
3. Save this ARN - you'll need it for BeTrace configuration

**Key ID vs. Alias vs. ARN**:
- **Key ID**: `abcd1234-5678-90ab-cdef-1234567890ab`
- **Alias**: `alias/betrace-master-key`
- **ARN**: `arn:aws:kms:us-east-1:123456789012:key/abcd1234-...`
- BeTrace requires full **ARN** in configuration

---

## Part 2: Configure IAM Permissions (20 minutes)

### Step 2.1: Understand Required Permissions

BeTrace needs 4 KMS permissions:

| Permission | Purpose | Usage Frequency |
|------------|---------|-----------------|
| `kms:GenerateDataKey` | Generate new encryption keys | Every cache miss (~20% requests) |
| `kms:Encrypt` | Encrypt plaintext data | Rare (mostly uses data keys) |
| `kms:Decrypt` | Decrypt ciphertext data | Every cache miss (~20% requests) |
| `kms:DescribeKey` | Verify key exists and is enabled | Health checks, startup |

### Step 2.2: Option A - IAM Policy (Recommended)

**Why IAM Policy?**
- Easier to manage (centralized in IAM)
- Can apply to multiple roles/users
- Version controlled with infrastructure as code

#### Create IAM Policy

1. Open **AWS Console** → **IAM** → **Policies**
2. Click **Create policy**
3. Click **JSON** tab
4. Paste policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BeTraceKMSAccess",
      "Effect": "Allow",
      "Action": [
        "kms:GenerateDataKey",
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": [
        "arn:aws:kms:us-east-1:123456789012:key/*"
      ],
      "Condition": {
        "StringEquals": {
          "kms:ViaService": [
            "betrace.your-company.com"
          ]
        }
      }
    }
  ]
}
```

**Customize**:
- Replace `123456789012` with your AWS account ID
- Replace `us-east-1` with your KMS region
- Replace `betrace.your-company.com` with your BeTrace domain (optional condition)
- For stricter security, replace `key/*` with specific key ARN

5. Click **Next: Tags** (optional)
6. Click **Next: Review**
7. **Name**: `BeTraceKMSAccess`
8. **Description**: `Allows BeTrace backend to use KMS for compliance signing and encryption`
9. Click **Create policy**

#### Attach Policy to IAM Role

1. Open **AWS Console** → **IAM** → **Roles**
2. Search for `betrace-backend-role` (or your BeTrace backend role)
3. Click role name
4. Click **Add permissions** → **Attach policies**
5. Search for `BeTraceKMSAccess`
6. Check ☑️ policy
7. Click **Add permissions**

#### Verify Policy Attached

```bash
# List policies attached to role
aws iam list-attached-role-policies --role-name betrace-backend-role

# Expected output:
# {
#   "AttachedPolicies": [
#     {
#       "PolicyName": "BeTraceKMSAccess",
#       "PolicyArn": "arn:aws:iam::123456789012:policy/BeTraceKMSAccess"
#     }
#   ]
# }
```

### Step 2.3: Option B - Inline Policy (Quick & Simple)

**Why Inline Policy?**
- Faster setup (no separate policy creation)
- Tied directly to role (deleted with role)
- Good for prototyping

#### Create Inline Policy

1. Open **AWS Console** → **IAM** → **Roles**
2. Click `betrace-backend-role`
3. Click **Add permissions** → **Create inline policy**
4. Click **JSON** tab
5. Paste:

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
      "Resource": "arn:aws:kms:us-east-1:123456789012:key/abcd1234-5678-90ab-cdef-1234567890ab"
    }
  ]
}
```

6. Replace `Resource` with your KMS key ARN from Step 1.8
7. Click **Review policy**
8. **Name**: `betrace-kms-access`
9. Click **Create policy**

### Step 2.4: Test IAM Permissions

Test KMS access using AWS CLI:

```bash
# Assume the BeTrace backend role (if testing locally)
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/betrace-backend-role \
  --role-session-name betrace-kms-test

# Export credentials from assume-role output
export AWS_ACCESS_KEY_ID=<AccessKeyId>
export AWS_SECRET_ACCESS_KEY=<SecretAccessKey>
export AWS_SESSION_TOKEN=<SessionToken>

# Test GenerateDataKey permission
aws kms generate-data-key \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd1234-... \
  --key-spec AES_256

# Expected output: JSON with CiphertextBlob and Plaintext
# If error: Check IAM policy attachment

# Test Encrypt permission
echo "test-plaintext" | base64 > /tmp/plaintext.txt
aws kms encrypt \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd1234-... \
  --plaintext fileb:///tmp/plaintext.txt

# Expected output: JSON with CiphertextBlob

# Test Decrypt permission
aws kms decrypt \
  --ciphertext-blob fileb:///tmp/ciphertext.bin

# Expected output: JSON with Plaintext

# Test DescribeKey permission
aws kms describe-key \
  --key-id arn:aws:kms:us-east-1:123456789012:key/abcd1234-...

# Expected output: JSON with KeyMetadata
```

**All tests passed?** ✅ IAM permissions are configured correctly.

---

## Part 3: Configure BeTrace Backend (10 minutes)

### Step 3.1: Update application.properties

Edit `backend/src/main/resources/application.properties`:

```properties
# ========================================
# KMS Configuration
# ========================================

# KMS Provider (local, aws, vault, gcp, azure)
betrace.kms.provider=aws

# AWS KMS Configuration
aws.kms.master-key-id=arn:aws:kms:us-east-1:123456789012:key/abcd1234-5678-90ab-cdef-1234567890ab
aws.kms.region=us-east-1

# Optional: Custom KMS endpoint (for LocalStack testing)
# aws.kms.endpoint=http://localhost:4566

# ========================================
# Cache Configuration (Optional)
# ========================================

# Cache TTL settings (defaults shown)
kms.cache.private-key-ttl-minutes=60
kms.cache.public-key-ttl-hours=24
kms.cache.encryption-key-ttl-minutes=60

# Maximum cache size (number of entries)
kms.cache.max-size=1000

# ========================================
# Key Rotation Configuration (Optional)
# ========================================

# Enable automatic key rotation
kms.rotation.enabled=true

# Rotation check schedule (cron: daily at 2 AM)
kms.rotation.check-cron=0 0 2 * * ?

# Maximum key age before rotation (NIST 800-57: 90 days)
kms.rotation.max-age-days=90
```

**Configuration Checklist**:
- ☑️ `betrace.kms.provider=aws` (NOT "local")
- ☑️ `aws.kms.master-key-id` is full ARN (not alias or key ID)
- ☑️ `aws.kms.region` matches KMS key region
- ☑️ No `aws.kms.endpoint` (unless using LocalStack)

### Step 3.2: Set Environment Variables (Production)

**For containerized deployments** (Docker, Kubernetes):

```bash
# Docker
docker run \
  -e BETRACE_KMS_PROVIDER=aws \
  -e AWS_KMS_MASTER_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/... \
  -e AWS_KMS_REGION=us-east-1 \
  betrace/backend:latest

# Kubernetes (ConfigMap + Secret)
kubectl create configmap betrace-kms-config \
  --from-literal=betrace.kms.provider=aws \
  --from-literal=aws.kms.region=us-east-1

kubectl create secret generic betrace-kms-secret \
  --from-literal=aws.kms.master-key-id=arn:aws:kms:...
```

### Step 3.3: Configure AWS Credentials

**Option A: IAM Instance Profile (Recommended for EC2/ECS)**:
- Attach IAM role `betrace-backend-role` to EC2 instance or ECS task
- AWS SDK automatically uses instance profile
- No credentials in config files

**Option B: Environment Variables**:
```bash
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export AWS_SESSION_TOKEN=<optional-session-token>
```

**Option C: AWS CLI Configuration**:
```bash
aws configure
# AWS Access Key ID: <your-access-key>
# AWS Secret Access Key: <your-secret-key>
# Default region name: us-east-1
```

**Recommendation**: Use IAM instance profile for production (no credentials in code).

---

## Part 4: Testing & Validation (15 minutes)

### Step 4.1: Start BeTrace Backend

```bash
cd /path/to/betrace
nix run .#backend
```

**Watch startup logs for**:
```
INFO  Initializing KMS provider: aws
INFO  Using AWS KMS - region: us-east-1, key: arn:aws:kms:...
```

**Warning signs** (should NOT see):
```
WARN  ⚠️  Using LocalKmsAdapter - NOT FOR PRODUCTION USE
WARN  ⚠️  VaultKmsAdapter not yet implemented - falling back to LocalKmsAdapter
```

### Step 4.2: Health Check

```bash
curl http://localhost:8080/q/health/ready | jq '.checks[] | select(.name == "kms")'
```

**Expected output (SUCCESS)**:
```json
{
  "name": "kms",
  "status": "UP",
  "data": {
    "provider": "aws",
    "latency_ms": 45,
    "status": "operational"
  }
}
```

**Troubleshooting**:
- `status: "DOWN"` → Check IAM permissions or network connectivity
- `provider: "local"` → Check `application.properties` configuration
- High `latency_ms` (>200ms) → Check AWS region proximity

### Step 4.3: Comprehensive Validation

```bash
curl -X POST http://localhost:8080/api/admin/kms/validate | jq .
```

**Expected output (PASS)**:
```json
{
  "provider": "aws",
  "overall": "PASS",
  "tests": {
    "generate_data_key": "PASS (45ms)",
    "encrypt": "PASS (38ms)",
    "decrypt": "PASS (42ms)",
    "key_retrieval_cache_miss": "PASS (95ms)",
    "key_retrieval_cache_hit": "PASS (2ms)"
  },
  "latency_ms": {
    "generate_data_key": 45,
    "encrypt": 38,
    "decrypt": 42,
    "cache_miss": 95,
    "cache_hit": 2
  },
  "recommendations": [
    "✅ KMS configuration is valid and ready for production"
  ]
}
```

**Latency Targets**:
- `generate_data_key`: <100ms ✅
- `encrypt`/`decrypt`: <100ms ✅
- `cache_miss`: <100ms ✅
- `cache_hit`: <10ms ✅

### Step 4.4: Test Compliance Span Signing

**Generate test compliance span**:

```bash
# This would be done by your application code, but you can test manually:
# (Example assumes you have a test endpoint)

# Check Prometheus metrics for KMS operations
curl -s http://localhost:8080/q/metrics | grep "kms_retrieve_signing_key_total"

# Expected: Counter increments with each signing operation
```

### Step 4.5: Verify Cache Performance

```bash
# Check cache hit/miss metrics
curl -s http://localhost:8080/q/metrics | grep kms_cache_hit_total
curl -s http://localhost:8080/q/metrics | grep kms_cache_miss_total
```

**Calculate hit rate**:
```bash
hits=$(curl -s http://localhost:8080/q/metrics | grep 'kms_cache_hit_total{key_type="signing"}' | awk '{print $2}')
misses=$(curl -s http://localhost:8080/q/metrics | grep 'kms_cache_miss_total{key_type="signing"}' | awk '{print $2}')
hit_rate=$(echo "scale=2; $hits / ($hits + $misses) * 100" | bc)
echo "Cache hit rate: ${hit_rate}%"
```

**Target**: >80% hit rate (reduces KMS API costs by 5x)

---

## Part 5: Production Deployment Checklist

### Pre-Deployment Validation

Before deploying to production, verify:

```bash
# 1. KMS provider is AWS (not local)
curl http://localhost:8080/api/admin/kms/status | jq -r '.provider'
# Expected: "aws"

# 2. All validation tests pass
curl -X POST http://localhost:8080/api/admin/kms/validate | jq -r '.overall'
# Expected: "PASS"

# 3. Health check is UP
curl http://localhost:8080/q/health/ready | jq -r '.checks[] | select(.name == "kms").status'
# Expected: "UP"

# 4. No LocalKmsAdapter warnings in logs
grep "LocalKmsAdapter" /var/log/betrace/backend.log
# Expected: No output (or only startup test logs)
```

### CloudWatch Logging (Recommended)

Enable KMS API call logging:

1. Open **AWS Console** → **CloudTrail**
2. Click **Event history**
3. Filter: **Event source** = `kms.amazonaws.com`
4. Monitor for:
   - `GenerateDataKey` calls
   - `Decrypt` calls
   - Any `AccessDenied` errors

### Cost Monitoring

Set up billing alerts:

1. Open **AWS Console** → **Billing** → **Budgets**
2. Create budget:
   - **Name**: BeTrace KMS Costs
   - **Budget amount**: $100/month (adjust based on usage)
   - **Alert threshold**: 80% ($80)
3. Add email notification

**Track monthly costs**:
```bash
# AWS CLI
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://kms-filter.json

# kms-filter.json:
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["AWS Key Management Service"]
  }
}
```

### Monitoring & Alerting

**Prometheus Alerts** (already configured in SRE P0):
- `KMSOperationFailures` - Error rate >1%
- `KMSHighLatency` - P99 latency >100ms
- `KMSCacheHitRateLow` - Hit rate <80%

**Grafana Dashboard**:
Import dashboard JSON from `monitoring/grafana/dashboards/kms-operations.json`

### Backup & Disaster Recovery

**KMS Key Backup**:
- AWS KMS keys cannot be exported (security feature)
- Keys are automatically replicated within region
- For DR: Create multi-region replica key

**Multi-Region Setup**:
1. Open KMS key in AWS Console
2. Click **Regionality** tab
3. Click **Create replica** → Select region
4. Update BeTrace config with primary + replica ARNs

---

## Troubleshooting

### Common Issues

#### Issue 1: "Access Denied" Error

**Symptoms**:
```
KmsException: User: arn:aws:iam::123...:role/betrace-backend-role is not authorized to perform: kms:GenerateDataKey on resource: arn:aws:kms:us-east-1:123...:key/abc...
```

**Causes**:
1. IAM policy not attached to role
2. IAM policy missing required permission
3. KMS key policy doesn't allow role

**Solutions**:

**Check IAM policy attached**:
```bash
aws iam list-attached-role-policies --role-name betrace-backend-role
```

**Check IAM policy permissions**:
```bash
aws iam get-policy-version \
  --policy-arn arn:aws:iam::123456789012:policy/BeTraceKMSAccess \
  --version-id v1 | jq '.PolicyVersion.Document'
```

**Check KMS key policy**:
```bash
aws kms get-key-policy \
  --key-id arn:aws:kms:us-east-1:123...:key/abc... \
  --policy-name default
```

**Fix**: Ensure all 4 permissions present: `GenerateDataKey`, `Encrypt`, `Decrypt`, `DescribeKey`

#### Issue 2: Health Check Returns DOWN

**Symptoms**:
```json
{
  "name": "kms",
  "status": "DOWN",
  "data": {
    "provider": "aws",
    "error": "Failed to generate data key"
  }
}
```

**Causes**:
1. Network connectivity (firewall, VPC configuration)
2. Incorrect KMS key ARN
3. KMS key disabled or deleted
4. Wrong AWS region

**Solutions**:

**Test connectivity**:
```bash
# From BeTrace backend host
curl https://kms.us-east-1.amazonaws.com

# Expected: HTTP 200 or 403 (not connection timeout)
```

**Verify key exists and is enabled**:
```bash
aws kms describe-key \
  --key-id arn:aws:kms:us-east-1:123...:key/abc...

# Check: "KeyState": "Enabled"
```

**Check AWS region**:
```bash
# Ensure BeTrace config region matches KMS key region
grep "aws.kms.region" application.properties
```

#### Issue 3: High Latency (>200ms)

**Symptoms**:
```json
{
  "latency_ms": {
    "generate_data_key": 250,
    "cache_miss": 280
  }
}
```

**Causes**:
1. KMS key in distant region (cross-region latency)
2. Network issues (VPC routing, NAT gateway)
3. AWS KMS service degradation

**Solutions**:

**Use KMS key in same region as BeTrace**:
- If BeTrace in us-east-1, create KMS key in us-east-1

**Check VPC endpoints** (for private subnet deployments):
```bash
# Create VPC endpoint for KMS
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-abc123 \
  --service-name com.amazonaws.us-east-1.kms \
  --route-table-ids rtb-abc123

# Benefits:
# - Reduces latency (traffic stays in AWS network)
# - Reduces NAT gateway costs
# - Improved security
```

**Monitor AWS service health**:
- Check: https://health.aws.amazon.com/health/status

### Full Troubleshooting Guide

For more issues, see: [KMS_TROUBLESHOOTING.md](KMS_TROUBLESHOOTING.md)

---

## Next Steps

### You've Completed AWS KMS Setup! 🎉

**What's working now**:
- ✅ AWS KMS master key created
- ✅ IAM permissions configured
- ✅ BeTrace backend integrated with AWS KMS
- ✅ All validation tests passing

**Recommended follow-ups**:

1. **Monitoring**: Set up Grafana dashboard for KMS metrics
2. **Alerting**: Configure PagerDuty for KMS operation failures
3. **Cost Optimization**: Monitor cache hit rate (target: >80%)
4. **Documentation**: Add KMS setup to your team's runbook

**Additional Resources**:
- [KMS Quickstart Guide](KMS_QUICKSTART.md) - Quick 30-minute overview
- [KMS Troubleshooting Guide](KMS_TROUBLESHOOTING.md) - Common issues & solutions
- [SRE Runbooks](../runbooks/) - Incident response procedures
- [PRD-006: KMS Integration](../prds/006-kms-integration.md) - Architecture details

---

## Appendix

### A. AWS KMS Pricing Calculator

```python
# Calculate monthly AWS KMS costs
import math

# Inputs
requests_per_second = 1000
cache_hit_rate = 0.80  # 80%
hours_per_month = 730

# KMS API calls per month
kms_calls_per_sec = requests_per_second * (1 - cache_hit_rate)
kms_calls_per_month = kms_calls_per_sec * 3600 * hours_per_month

# Pricing (us-east-1)
master_key_cost = 1.00  # $1/month
api_cost_per_10k = 0.03

# Calculate
api_cost = (kms_calls_per_month / 10000) * api_cost_per_10k
total_cost = master_key_cost + api_cost

print(f"KMS API calls/month: {kms_calls_per_month:,.0f}")
print(f"Master key cost: ${master_key_cost:.2f}")
print(f"API call cost: ${api_cost:.2f}")
print(f"Total monthly cost: ${total_cost:.2f}")

# Output:
# KMS API calls/month: 525,600,000
# Master key cost: $1.00
# API call cost: $1,576.80
# Total monthly cost: $1,577.80
```

### B. Terraform Example

See full Terraform module: [terraform/aws-kms/](../../terraform/aws-kms/)

```hcl
# Quick example
resource "aws_kms_key" "betrace_master_key" {
  description             = "BeTrace KMS master key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "betrace-master-key"
    Application = "BeTrace"
    Environment = "Production"
  }
}

resource "aws_kms_alias" "betrace_master_key_alias" {
  name          = "alias/betrace-master-key"
  target_key_id = aws_kms_key.betrace_master_key.key_id
}

resource "aws_iam_policy" "betrace_kms_access" {
  name        = "BeTraceKMSAccess"
  description = "Allows BeTrace backend to use KMS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:GenerateDataKey",
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.betrace_master_key.arn
      }
    ]
  })
}

output "kms_key_arn" {
  value       = aws_kms_key.betrace_master_key.arn
  description = "KMS master key ARN for BeTrace configuration"
}
```

### C. LocalStack for Testing

Test AWS KMS locally without AWS account:

```bash
# Start LocalStack
docker run -d \
  -p 4566:4566 \
  -e SERVICES=kms \
  localstack/localstack

# Create test key
aws --endpoint-url=http://localhost:4566 kms create-key \
  --description "LocalStack test key"

# Configure BeTrace
# application.properties:
betrace.kms.provider=aws
aws.kms.master-key-id=<key-id-from-localstack>
aws.kms.region=us-east-1
aws.kms.endpoint=http://localhost:4566
```

---

**Last Updated**: 2025-10-22
**Estimated Time**: 45-60 minutes
**Difficulty**: Intermediate
**Support**: support@betrace.dev
