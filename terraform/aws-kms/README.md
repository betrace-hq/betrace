# FLUO AWS KMS Integration - Terraform Module

**Purpose**: Provision AWS KMS infrastructure for FLUO backend encryption operations.

**What This Module Creates**:
- ✅ AWS KMS Customer Master Key (CMK) with 90-day automatic rotation
- ✅ IAM policy granting FLUO backend KMS access
- ✅ (Optional) Dedicated IAM role for FLUO backend service
- ✅ KMS key alias for easier reference
- ✅ CloudWatch Logs encryption support (optional)

**Estimated Cost**: $1-3/month (AWS KMS master key + minimal API calls)

---

## Quick Start

### Prerequisites

1. **AWS CLI configured** with credentials:
   ```bash
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region, Output format
   ```

2. **Terraform installed** (version 1.5+):
   ```bash
   terraform --version
   ```

3. **Existing FLUO backend IAM role** (or let Terraform create one):
   ```bash
   # If using existing role:
   aws iam get-role --role-name fluo-backend
   ```

### Option 1: Use Existing IAM Role

If you already have an IAM role for your FLUO backend (e.g., EC2 instance role, ECS task role):

```hcl
# main.tf
module "fluo_kms" {
  source = "./terraform/aws-kms"

  environment         = "production"
  fluo_role_arns      = ["arn:aws:iam::123456789012:role/fluo-backend"]
  attach_to_role      = true
  fluo_iam_role_name  = "fluo-backend"

  tags = {
    Project = "FLUO"
    Owner   = "Platform Team"
  }
}

# Outputs
output "kms_key_arn" {
  value = module.fluo_kms.kms_key_arn
}

output "fluo_config" {
  value = module.fluo_kms.fluo_backend_config
}
```

**Deploy:**
```bash
terraform init
terraform plan
terraform apply
```

### Option 2: Create New IAM Role

If you want Terraform to create a dedicated IAM role for FLUO:

```hcl
# main.tf
module "fluo_kms" {
  source = "./terraform/aws-kms"

  environment = "production"

  # Create new IAM role
  create_iam_role        = true
  fluo_service_principals = ["ec2.amazonaws.com"]  # Or ecs-tasks.amazonaws.com, lambda.amazonaws.com

  # Optional: External ID for cross-account access
  external_id = "fluo-prod-12345"

  tags = {
    Project = "FLUO"
    Owner   = "Platform Team"
  }
}

# Outputs
output "kms_key_arn" {
  value = module.fluo_kms.kms_key_arn
}

output "iam_role_arn" {
  value = module.fluo_kms.iam_role_arn
}

output "fluo_config" {
  value = module.fluo_kms.fluo_backend_config
}
```

**Deploy:**
```bash
terraform init
terraform plan
terraform apply
```

**Attach IAM role to EC2 instance:**
```bash
# Replace i-1234567890abcdef with your FLUO backend EC2 instance ID
INSTANCE_ID="i-1234567890abcdef"
ROLE_NAME=$(terraform output -raw iam_role_name)

aws ec2 associate-iam-instance-profile \
  --instance-id $INSTANCE_ID \
  --iam-instance-profile Name=$ROLE_NAME
```

---

## Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `environment` | Environment name | `"production"` |
| `fluo_role_arns` | IAM role ARNs for FLUO backend | `["arn:aws:iam::123456789012:role/fluo-backend"]` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `create_iam_role` | `false` | Create new IAM role for FLUO backend |
| `attach_to_role` | `false` | Attach policy to existing role |
| `fluo_iam_role_name` | `""` | Name of existing role (if `attach_to_role=true`) |
| `fluo_service_principals` | `["ec2.amazonaws.com"]` | AWS services allowed to assume role |
| `multi_region_enabled` | `false` | Enable multi-region KMS key replication |
| `enforce_encryption_context` | `true` | Restrict key usage to specific contexts |
| `enable_cloudwatch_logs` | `false` | Allow CloudWatch Logs encryption |
| `tags` | `{}` | Additional resource tags |

---

## Outputs

### KMS Key Information

```bash
# Get KMS key ARN (use in FLUO backend config)
terraform output kms_key_arn

# Get key alias
terraform output kms_key_alias
```

### FLUO Backend Configuration

```bash
# Get full application.properties snippet
terraform output fluo_backend_config

# Example output:
# fluo.kms.provider=aws
# aws.kms.master-key-id=arn:aws:kms:us-east-1:123456789012:key/abcd-1234-...
# aws.kms.region=us-east-1
# ...
```

### Environment Variables (for Docker/Kubernetes)

```bash
# Get environment variables as JSON
terraform output -json fluo_backend_env_vars

# Example usage in Docker:
docker run \
  -e FLUO_KMS_PROVIDER=aws \
  -e AWS_KMS_MASTER_KEY_ID=$(terraform output -raw kms_key_arn) \
  -e AWS_KMS_REGION=us-east-1 \
  fluo/backend:latest
```

### Validation Commands

```bash
# Get validation commands
terraform output validation_commands

# Run validation
aws kms describe-key --key-id $(terraform output -raw kms_key_arn)
aws kms get-key-rotation-status --key-id $(terraform output -raw kms_key_arn)
```

---

## Post-Deployment Steps

### 1. Configure FLUO Backend

Copy the Terraform output to `application.properties`:

```bash
terraform output fluo_backend_config >> backend/src/main/resources/application.properties
```

Or set environment variables:

```bash
export FLUO_KMS_PROVIDER=aws
export AWS_KMS_MASTER_KEY_ID=$(terraform output -raw kms_key_arn)
export AWS_KMS_REGION=$(terraform output -raw aws_region)
```

### 2. Validate KMS Access

```bash
# Test KMS key permissions
aws kms describe-key --key-id $(terraform output -raw kms_key_arn)

# Test data key generation (simulates FLUO operation)
aws kms generate-data-key \
  --key-id $(terraform output -raw kms_key_arn) \
  --key-spec AES_256 \
  --encryption-context purpose=pii_redaction
```

### 3. Verify FLUO Backend Health

```bash
# Check KMS health endpoint
curl http://localhost:8080/q/health/ready | jq '.checks[] | select(.name == "kms")'

# Expected output:
# {
#   "name": "kms",
#   "status": "UP",
#   "data": {
#     "provider": "aws",
#     "masterKeyId": "arn:aws:kms:us-east-1:123456789012:key/..."
#   }
# }

# Run KMS validation tests
curl -X POST http://localhost:8080/api/admin/kms/validate | jq .

# Expected output:
# {
#   "overall_status": "PASS",
#   "tests": {
#     "generate_data_key": "PASS",
#     "encrypt": "PASS",
#     "decrypt": "PASS",
#     "key_retrieval": "PASS"
#   },
#   "latency_ms": {
#     "generate_data_key": 45,
#     "encrypt": 38,
#     "decrypt": 42,
#     "cache_hit": 0.8
#   }
# }
```

### 4. Monitor KMS Usage

```bash
# View CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/KMS \
  --metric-name NumberOfCalls \
  --dimensions Name=KeyId,Value=$(terraform output -raw kms_key_id) \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# View CloudTrail logs for KMS API calls
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=$(terraform output -raw kms_key_arn) \
  --max-results 10
```

---

## Security Best Practices

### 1. Key Rotation

✅ **Automatic rotation enabled** (90 days, NIST 800-57 compliance)

```bash
# Verify rotation status
aws kms get-key-rotation-status --key-id $(terraform output -raw kms_key_arn)

# Output:
# {
#   "KeyRotationEnabled": true,
#   "RotationPeriodInDays": 90
# }
```

### 2. Encryption Context Enforcement

✅ **Encryption context required** (prevents unauthorized key usage)

FLUO backend always includes encryption context:
```java
Map<String, String> context = Map.of(
    "tenantId", tenantId.toString(),
    "purpose", "pii_redaction"
);
kms.generateDataKey("AES_256", context);
```

Terraform enforces this via IAM policy condition:
```hcl
condition {
  test     = "StringEquals"
  variable = "kms:EncryptionContext:purpose"
  values   = ["pii_redaction", "compliance_evidence"]
}
```

### 3. Least Privilege IAM Policy

✅ **IAM policy grants only required permissions**

Permissions granted:
- ✅ `kms:DescribeKey` - Read key metadata
- ✅ `kms:GenerateDataKey` - Generate encryption keys (PRD-006)
- ✅ `kms:Encrypt` - Encrypt data
- ✅ `kms:Decrypt` - Decrypt data
- ❌ `kms:ScheduleKeyDeletion` - NOT granted (prevents accidental deletion)
- ❌ `kms:DisableKey` - NOT granted (prevents service disruption)

### 4. CloudTrail Logging

Enable CloudTrail to audit all KMS API calls:

```bash
# Check if CloudTrail is enabled
aws cloudtrail get-trail-status --name my-trail

# Create CloudTrail (if not exists)
aws cloudtrail create-trail \
  --name fluo-kms-audit \
  --s3-bucket-name my-cloudtrail-bucket

aws cloudtrail start-logging --name fluo-kms-audit
```

### 5. KMS Key Policy Review

Review key policy to ensure only authorized principals have access:

```bash
# Get current key policy
aws kms get-key-policy \
  --key-id $(terraform output -raw kms_key_arn) \
  --policy-name default

# Review principals and actions
```

---

## Cost Estimation

**AWS KMS Pricing** (us-east-1, as of 2025):

| Resource | Cost | Calculation |
|----------|------|-------------|
| KMS Master Key | $1.00/month | Per key, regardless of usage |
| GenerateDataKey | $0.03/10,000 requests | ~1,000/month = $0.003 |
| Encrypt | $0.03/10,000 requests | ~500/month = $0.0015 |
| Decrypt | $0.03/10,000 requests | ~100/month = $0.0003 |
| **Total** | **~$1.00 - $3.00/month** | Assumes 80% cache hit rate |

**Cost Optimization Tips**:
1. ✅ **High cache hit rate** (>80%) - PRD-006c design minimizes KMS API calls
2. ✅ **Reuse data keys** - Cache encryption keys for 60 minutes
3. ✅ **Batch operations** - Avoid per-request KMS calls
4. ❌ **Avoid multi-region keys** (unless required) - Costs 2x more

**Monitor costs**:
```bash
# View KMS costs in Cost Explorer
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://kms-filter.json

# kms-filter.json:
# {
#   "Dimensions": {
#     "Key": "SERVICE",
#     "Values": ["AWS Key Management Service"]
#   }
# }
```

---

## Troubleshooting

### Error: "Access Denied" when calling KMS API

**Symptom**:
```
KmsException: User: arn:aws:iam::123456789012:role/fluo-backend is not authorized to perform: kms:GenerateDataKey
```

**Causes**:
1. IAM policy not attached to role
2. Key policy doesn't grant access to role
3. Encryption context mismatch

**Solution**:
```bash
# 1. Verify IAM policy is attached
aws iam list-attached-role-policies --role-name fluo-backend

# 2. Verify key policy includes role ARN
aws kms get-key-policy \
  --key-id $(terraform output -raw kms_key_arn) \
  --policy-name default | jq '.Statement[] | select(.Sid == "AllowFluoBackendKeyUsage")'

# 3. Test with AWS CLI (bypasses encryption context)
aws kms generate-data-key \
  --key-id $(terraform output -raw kms_key_arn) \
  --key-spec AES_256 \
  --encryption-context purpose=pii_redaction
```

### Error: "Key rotation not enabled"

**Symptom**:
```bash
aws kms get-key-rotation-status --key-id $KEY_ID
# Output: "KeyRotationEnabled": false
```

**Solution**:
```bash
# Enable rotation via Terraform
# Set in variables.tf:
# variable "key_rotation_period_days" { default = 90 }

# Re-apply Terraform
terraform apply

# Verify
aws kms get-key-rotation-status --key-id $(terraform output -raw kms_key_arn)
```

### High KMS API Costs

**Symptom**: AWS bill shows $50+/month for KMS API calls

**Causes**:
1. Cache hit rate <80% (excessive KMS API calls)
2. No key caching (every request calls KMS)
3. Inefficient key usage pattern

**Solution**:
```bash
# Check cache hit rate
curl http://localhost:8080/api/admin/kms/status | jq '.cache'

# Expected:
# {
#   "cache_size": 250,
#   "cache_hit_rate": 0.85  # >80% is good
# }

# If cache hit rate <80%:
# 1. Increase cache TTL in application.properties:
kms.cache.private-key-ttl-minutes=120  # Increase from 60
kms.cache.public-key-ttl-hours=48      # Increase from 24

# 2. Increase cache size:
kms.cache.max-size=5000  # Increase from 1000

# 3. Review KMS API call logs:
grep "KMS API call" /var/log/fluo/backend.log | wc -l
```

---

## Advanced Configuration

### Multi-Region KMS Key Replication

For disaster recovery and cross-region deployments:

```hcl
module "fluo_kms" {
  source = "./terraform/aws-kms"

  environment           = "production"
  multi_region_enabled  = true

  # Primary region (where you run terraform apply)
  # Replica regions configured separately
}

# Create replica in us-west-2
resource "aws_kms_replica_key" "fluo_west" {
  provider = aws.us-west-2

  description             = "FLUO KMS replica in us-west-2"
  primary_key_arn         = module.fluo_kms.kms_key_arn
  deletion_window_in_days = 7
}
```

### Custom Encryption Context Validation

Restrict key usage to specific tenants:

```hcl
# In iam.tf, modify condition block:
condition {
  test     = "StringEquals"
  variable = "kms:EncryptionContext:tenantId"
  values   = ["tenant-123", "tenant-456"]  # Allowlist specific tenants
}
```

### CloudWatch Alarms

Monitor KMS health:

```hcl
resource "aws_cloudwatch_metric_alarm" "kms_throttle" {
  alarm_name          = "fluo-kms-throttle-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UserErrorCount"
  namespace           = "AWS/KMS"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "KMS throttling errors detected"

  dimensions = {
    KeyId = aws_kms_key.fluo_master_key.key_id
  }
}

resource "aws_cloudwatch_metric_alarm" "kms_api_errors" {
  alarm_name          = "fluo-kms-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "SystemErrorCount"
  namespace           = "AWS/KMS"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "KMS system errors detected"

  dimensions = {
    KeyId = aws_kms_key.fluo_master_key.key_id
  }
}
```

---

## Compliance

This Terraform module helps satisfy:

- **SOC2 CC6.1**: Logical access controls (IAM policies)
- **SOC2 CC6.7**: Encryption at rest (KMS master key)
- **SOC2 CC7.1**: System monitoring (CloudTrail logging)
- **HIPAA 164.312(a)(2)(iv)**: Encryption/decryption (KMS operations)
- **NIST 800-57**: Cryptographic key management (90-day rotation)
- **PCI-DSS 3.6.4**: Key rotation (automatic 90-day rotation)

**Evidence for Auditors**:
```bash
# Export KMS configuration for compliance evidence
terraform output -json > kms-compliance-evidence.json

# Export key policy
aws kms get-key-policy \
  --key-id $(terraform output -raw kms_key_arn) \
  --policy-name default > kms-key-policy.json

# Export CloudTrail logs (last 90 days)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=$(terraform output -raw kms_key_arn) \
  --start-time $(date -d '90 days ago' +%Y-%m-%d) \
  --max-results 1000 > kms-cloudtrail-logs.json
```

---

## Migration from Local KMS to AWS KMS

If you're currently using `LocalKmsAdapter` in development and want to migrate to AWS KMS for production:

### Step 1: Deploy AWS KMS Infrastructure

```bash
terraform init
terraform apply
```

### Step 2: Update FLUO Backend Configuration

```bash
# Backup current configuration
cp backend/src/main/resources/application.properties backend/src/main/resources/application.properties.backup

# Append AWS KMS configuration
terraform output fluo_backend_config >> backend/src/main/resources/application.properties
```

### Step 3: Restart FLUO Backend

```bash
# Restart backend service
sudo systemctl restart fluo-backend

# Or for Docker:
docker restart fluo-backend

# Or for Kubernetes:
kubectl rollout restart deployment/fluo-backend
```

### Step 4: Validate Migration

```bash
# Check KMS health
curl http://localhost:8080/q/health/ready | jq '.checks[] | select(.name == "kms")'

# Verify provider changed from 'local' to 'aws'
curl http://localhost:8080/api/admin/kms/status | jq '.provider'

# Expected output: "aws"
```

### Step 5: Test Encryption Round-Trip

```bash
# Run validation tests
curl -X POST http://localhost:8080/api/admin/kms/validate | jq .

# Expected output:
# {
#   "overall_status": "PASS",
#   "tests": {
#     "generate_data_key": "PASS",
#     "encrypt": "PASS",
#     "decrypt": "PASS"
#   }
# }
```

---

## Support

For issues with this Terraform module:

1. **Documentation**: See [AWS KMS Setup Guide](../../docs/setup/AWS_KMS_SETUP.md)
2. **Troubleshooting**: See [KMS Troubleshooting Guide](../../docs/setup/KMS_TROUBLESHOOTING.md)
3. **FLUO Backend**: See [KMS Quickstart](../../docs/setup/KMS_QUICKSTART.md)
4. **GitHub Issues**: https://github.com/fluohq/fluo/issues

---

## References

- **AWS KMS Documentation**: https://docs.aws.amazon.com/kms/
- **Terraform AWS Provider**: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- **PRD-006**: KMS Integration System (internal)
- **NIST 800-57**: Key Management Recommendations
- **SOC2 Trust Service Criteria**: CC6.1, CC6.7, CC7.1
- **HIPAA**: 164.312(a)(2)(iv) - Encryption/Decryption

---

**Version**: 1.0.0
**Last Updated**: 2025-10-22
**Maintained By**: FLUO Platform Team
