# BeTrace AWS KMS Terraform Module - Example Configurations

# Example 1: Production with Existing IAM Role
# Use this when you already have an IAM role for your BeTrace backend

module "betrace_kms_prod" {
  source = "./terraform/aws-kms"

  environment = "production"

  # Use existing IAM role (e.g., EC2 instance role, ECS task role)
  betrace_role_arns     = ["arn:aws:iam::123456789012:role/betrace-backend-prod"]
  attach_to_role     = true
  betrace_iam_role_name = "betrace-backend-prod"

  # Security: Enforce encryption context
  enforce_encryption_context = true

  # Cost optimization: Single-region deployment
  multi_region_enabled = false

  # Optional: Enable CloudWatch Logs encryption
  enable_cloudwatch_logs = false

  tags = {
    Environment = "production"
    Project     = "BeTrace"
    Owner       = "Platform Team"
    CostCenter  = "Engineering"
  }
}

# Outputs for production
output "prod_kms_key_arn" {
  description = "Production KMS key ARN (use in application.properties)"
  value       = module.betrace_kms_prod.kms_key_arn
}

output "prod_betrace_config" {
  description = "Production BeTrace backend configuration"
  value       = module.betrace_kms_prod.betrace_backend_config
}

# -----------------------------------------------------------------------------

# Example 2: Staging with New IAM Role
# Use this when you want Terraform to create a dedicated IAM role

module "betrace_kms_staging" {
  source = "./terraform/aws-kms"

  environment = "staging"

  # Create new IAM role for BeTrace backend
  create_iam_role         = true
  betrace_service_principals = ["ec2.amazonaws.com", "ecs-tasks.amazonaws.com"]

  # Security: External ID for cross-account access (optional)
  external_id = "betrace-staging-98765"

  # Multi-region for disaster recovery testing
  multi_region_enabled = true

  tags = {
    Environment = "staging"
    Project     = "BeTrace"
    Owner       = "Platform Team"
  }
}

# Outputs for staging
output "staging_kms_key_arn" {
  value = module.betrace_kms_staging.kms_key_arn
}

output "staging_iam_role_arn" {
  description = "Attach this role to your EC2/ECS instances"
  value       = module.betrace_kms_staging.iam_role_arn
}

# -----------------------------------------------------------------------------

# Example 3: Development (Use LocalKmsAdapter Instead)
# For development, use LocalKmsAdapter (no AWS KMS costs)
# This example is for reference only - don't deploy KMS for dev environments

# Development configuration (in application.properties):
# betrace.kms.provider=local
# local.kms.keys-directory=/tmp/betrace/kms-keys

# -----------------------------------------------------------------------------

# Example 4: Multi-Account Setup (Cross-Account KMS Access)
# Use this when BeTrace backend runs in Account A but KMS key is in Account B

module "betrace_kms_central" {
  source = "./terraform/aws-kms"

  environment = "production"

  # Grant access to IAM roles in multiple AWS accounts
  betrace_role_arns = [
    "arn:aws:iam::111111111111:role/betrace-backend-prod",  # Account A (production)
    "arn:aws:iam::222222222222:role/betrace-backend-dr",    # Account B (disaster recovery)
  ]

  # Security: Require external ID for cross-account access
  external_id = "betrace-cross-account-12345"

  tags = {
    Environment = "production"
    Project     = "BeTrace"
    MultiAccount = "true"
  }
}

# -----------------------------------------------------------------------------

# Example 5: High Security with Restricted Encryption Context
# Use this for maximum security (restrict key usage to specific tenants)

module "betrace_kms_enterprise" {
  source = "./terraform/aws-kms"

  environment = "enterprise"

  betrace_role_arns = ["arn:aws:iam::123456789012:role/betrace-backend-enterprise"]

  # Security: Enforce strict encryption context validation
  enforce_encryption_context = true

  # Compliance: Enable CloudWatch Logs encryption
  enable_cloudwatch_logs = true

  # Disaster recovery: Multi-region key replication
  multi_region_enabled = true

  tags = {
    Environment  = "enterprise"
    Compliance   = "SOC2,HIPAA,PCI-DSS"
    DataClass    = "PHI,PII"
    Project      = "BeTrace"
  }
}

# Add custom IAM policy condition to restrict tenants
resource "aws_iam_policy" "betrace_kms_tenant_restriction" {
  name        = "betrace-kms-tenant-restriction-enterprise"
  description = "Restrict KMS access to specific tenants only"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RestrictToApprovedTenants"
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = module.betrace_kms_enterprise.kms_key_arn
        Condition = {
          StringEquals = {
            "kms:EncryptionContext:tenantId" = [
              "tenant-enterprise-001",
              "tenant-enterprise-002",
              "tenant-enterprise-003"
            ]
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------

# Example 6: Cost-Optimized Setup (Single-Region, No CloudWatch)
# Use this to minimize AWS KMS costs

module "betrace_kms_cost_optimized" {
  source = "./terraform/aws-kms"

  environment = "production"

  betrace_role_arns = ["arn:aws:iam::123456789012:role/betrace-backend"]

  # Cost optimization: Single-region only
  multi_region_enabled = false

  # Cost optimization: No CloudWatch Logs encryption
  enable_cloudwatch_logs = false

  # Security: Still enforce encryption context
  enforce_encryption_context = true

  tags = {
    Environment = "production"
    CostOptimized = "true"
  }
}

# Estimated cost: ~$1.00-$1.50/month (assumes 80% cache hit rate)

# -----------------------------------------------------------------------------

# Example 7: Kubernetes/EKS Deployment with IRSA
# Use this for BeTrace backend running on Amazon EKS with IAM Roles for Service Accounts (IRSA)

module "betrace_kms_eks" {
  source = "./terraform/aws-kms"

  environment = "production"

  # Grant access to EKS service account IAM role
  betrace_role_arns = [
    "arn:aws:iam::123456789012:role/betrace-backend-eks-sa"
  ]

  tags = {
    Environment = "production"
    Platform    = "EKS"
    Cluster     = "betrace-prod-cluster"
  }
}

# Create IRSA role (separate from this module)
# See: https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html

# Kubernetes ServiceAccount annotation:
# apiVersion: v1
# kind: ServiceAccount
# metadata:
#   name: betrace-backend
#   annotations:
#     eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/betrace-backend-eks-sa

# Deployment uses ServiceAccount:
# apiVersion: apps/v1
# kind: Deployment
# spec:
#   template:
#     spec:
#       serviceAccountName: betrace-backend
#       containers:
#       - name: backend
#         env:
#         - name: AWS_KMS_MASTER_KEY_ID
#           value: "arn:aws:kms:us-east-1:123456789012:key/..."

# -----------------------------------------------------------------------------

# Example 8: Lambda Function Deployment
# Use this for BeTrace backend running as AWS Lambda

module "betrace_kms_lambda" {
  source = "./terraform/aws-kms"

  environment = "production"

  # Create IAM role for Lambda execution
  create_iam_role         = true
  betrace_service_principals = ["lambda.amazonaws.com"]

  tags = {
    Environment = "production"
    Platform    = "Lambda"
  }
}

# Attach Lambda execution role to Lambda function
resource "aws_lambda_function" "betrace_backend" {
  function_name = "betrace-backend-prod"
  role          = module.betrace_kms_lambda.iam_role_arn

  environment {
    variables = module.betrace_kms_lambda.betrace_backend_env_vars
  }

  # ... other Lambda configuration
}

# -----------------------------------------------------------------------------

# Example 9: Multiple Environments in Same Account
# Use this to separate dev/staging/prod KMS keys in the same AWS account

module "betrace_kms_dev" {
  source      = "./terraform/aws-kms"
  environment = "development"
  betrace_role_arns = ["arn:aws:iam::123456789012:role/betrace-backend-dev"]
  tags = { Environment = "development" }
}

module "betrace_kms_staging" {
  source      = "./terraform/aws-kms"
  environment = "staging"
  betrace_role_arns = ["arn:aws:iam::123456789012:role/betrace-backend-staging"]
  tags = { Environment = "staging" }
}

module "betrace_kms_prod" {
  source      = "./terraform/aws-kms"
  environment = "production"
  betrace_role_arns = ["arn:aws:iam::123456789012:role/betrace-backend-prod"]
  tags = { Environment = "production" }
}

# Separate outputs per environment
output "dev_kms_key_arn" { value = module.betrace_kms_dev.kms_key_arn }
output "staging_kms_key_arn" { value = module.betrace_kms_staging.kms_key_arn }
output "prod_kms_key_arn" { value = module.betrace_kms_prod.kms_key_arn }

# -----------------------------------------------------------------------------

# Example 10: Disaster Recovery with Multi-Region Replication
# Use this for high availability across AWS regions

# Primary region (us-east-1)
module "betrace_kms_primary" {
  source = "./terraform/aws-kms"

  environment          = "production"
  multi_region_enabled = true
  betrace_role_arns = [
    "arn:aws:iam::123456789012:role/betrace-backend-primary"
  ]

  tags = {
    Environment = "production"
    Region      = "primary"
  }
}

# Replica region (us-west-2)
resource "aws_kms_replica_key" "betrace_replica_west" {
  provider = aws.us-west-2

  description             = "BeTrace KMS replica in us-west-2"
  primary_key_arn         = module.betrace_kms_primary.kms_key_arn
  deletion_window_in_days = 7

  tags = {
    Environment = "production"
    Region      = "replica-west"
  }
}

# Configure multiple providers in providers.tf:
# provider "aws" {
#   region = "us-east-1"
#   alias  = "us-east-1"
# }
#
# provider "aws" {
#   region = "us-west-2"
#   alias  = "us-west-2"
# }

output "primary_kms_key_arn" {
  value = module.betrace_kms_primary.kms_key_arn
}

output "replica_kms_key_arn" {
  value = aws_kms_replica_key.betrace_replica_west.arn
}

# BeTrace backend configuration (failover):
# betrace.kms.provider=aws
# aws.kms.master-key-id=arn:aws:kms:us-east-1:123456789012:key/mrk-...  # Multi-region key
# aws.kms.region=us-east-1
# aws.kms.failover-region=us-west-2
