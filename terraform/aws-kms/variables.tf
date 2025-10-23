# FLUO AWS KMS Terraform Module - Variables

# Required Variables

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.environment))
    error_message = "Environment must contain only lowercase letters, numbers, and hyphens"
  }
}

variable "fluo_role_arns" {
  description = "List of IAM role ARNs that FLUO backend will use (e.g., ['arn:aws:iam::123456789012:role/fluo-backend'])"
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for arn in var.fluo_role_arns : can(regex("^arn:aws:iam::[0-9]{12}:role/.+$", arn))
    ])
    error_message = "Each ARN must be a valid IAM role ARN (format: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME)"
  }
}

# Optional Variables - IAM Role Creation

variable "create_iam_role" {
  description = "Create a new IAM role for FLUO backend (true) or use existing role (false)"
  type        = bool
  default     = false
}

variable "fluo_iam_role_name" {
  description = "Name of existing IAM role to attach KMS policy to (only used if attach_to_role=true)"
  type        = string
  default     = ""
}

variable "attach_to_role" {
  description = "Attach KMS policy to existing IAM role specified in fluo_iam_role_name"
  type        = bool
  default     = false
}

variable "fluo_service_principals" {
  description = "AWS service principals allowed to assume the FLUO backend role (e.g., ['ec2.amazonaws.com', 'ecs-tasks.amazonaws.com'])"
  type        = list(string)
  default     = ["ec2.amazonaws.com"]
}

variable "external_id" {
  description = "External ID for assume role policy (recommended for cross-account access)"
  type        = string
  default     = ""
  sensitive   = true
}

# Optional Variables - KMS Configuration

variable "multi_region_enabled" {
  description = "Enable multi-region KMS key replication (for disaster recovery)"
  type        = bool
  default     = false
}

variable "enforce_encryption_context" {
  description = "Enforce encryption context validation (restricts key usage to specific contexts like 'pii_redaction')"
  type        = bool
  default     = true
}

# Optional Variables - Integrations

variable "enable_cloudwatch_logs" {
  description = "Grant KMS key permission to encrypt CloudWatch Logs"
  type        = bool
  default     = false
}

# Optional Variables - Tagging

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Computed Variables (for reference)

variable "key_rotation_period_days" {
  description = "KMS key rotation period in days (NIST 800-57 recommends 90 days)"
  type        = number
  default     = 90

  validation {
    condition     = var.key_rotation_period_days >= 90 && var.key_rotation_period_days <= 365
    error_message = "Key rotation period must be between 90-365 days (NIST 800-57 compliance)"
  }
}

variable "deletion_window_days" {
  description = "KMS key deletion window in days (prevents accidental deletion)"
  type        = number
  default     = 7

  validation {
    condition     = var.deletion_window_days >= 7 && var.deletion_window_days <= 30
    error_message = "Deletion window must be between 7-30 days"
  }
}
