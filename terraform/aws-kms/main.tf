# BeTrace AWS KMS Integration - Terraform Module
#
# This module creates:
# - AWS KMS Customer Master Key (CMK) for BeTrace backend
# - Key rotation enabled (90-day compliance requirement)
# - Key policy for BeTrace backend IAM role
#
# Usage:
#   module "betrace_kms" {
#     source = "./terraform/aws-kms"
#
#     environment    = "production"
#     betrace_role_arn = "arn:aws:iam::123456789012:role/betrace-backend"
#   }

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# KMS Customer Master Key (CMK) for BeTrace
resource "aws_kms_key" "betrace_master_key" {
  description = "BeTrace Backend Master Encryption Key (${var.environment})"

  # Security: Enable automatic key rotation (90-day compliance)
  enable_key_rotation = true
  rotation_period_in_days = 90

  # Key policy: Grant access to AWS account root + BeTrace backend role
  policy = data.aws_iam_policy_document.kms_key_policy.json

  # Cost optimization: 7-day deletion window (prevent accidental deletion)
  deletion_window_in_days = 7

  # Multi-region support (optional)
  multi_region = var.multi_region_enabled

  tags = merge(
    var.tags,
    {
      Name        = "betrace-kms-${var.environment}"
      Environment = var.environment
      ManagedBy   = "terraform"
      Purpose     = "betrace-backend-encryption"
    }
  )
}

# KMS Key Alias (easier to reference)
resource "aws_kms_alias" "betrace_master_key_alias" {
  name          = "alias/betrace-${var.environment}"
  target_key_id = aws_kms_key.betrace_master_key.key_id
}

# KMS Key Policy (who can use this key)
data "aws_iam_policy_document" "kms_key_policy" {
  # Statement 1: Enable IAM policies (required for AWS KMS)
  statement {
    sid    = "EnableIAMUserPermissions"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }

    actions   = ["kms:*"]
    resources = ["*"]
  }

  # Statement 2: Allow BeTrace backend to use the key
  statement {
    sid    = "AllowBeTraceBackendKeyUsage"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = var.betrace_role_arns
    }

    actions = [
      # Key management
      "kms:DescribeKey",
      "kms:GetKeyPolicy",
      "kms:GetKeyRotationStatus",
      "kms:ListResourceTags",

      # Data encryption operations
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey",
      "kms:GenerateDataKeyWithoutPlaintext",

      # Key validation
      "kms:CreateGrant",
      "kms:RetireGrant",
      "kms:RevokeGrant"
    ]

    resources = ["*"]
  }

  # Statement 3: Allow CloudWatch Logs encryption (if enabled)
  dynamic "statement" {
    for_each = var.enable_cloudwatch_logs ? [1] : []

    content {
      sid    = "AllowCloudWatchLogsEncryption"
      effect = "Allow"

      principals {
        type        = "Service"
        identifiers = ["logs.${data.aws_region.current.name}.amazonaws.com"]
      }

      actions = [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:CreateGrant",
        "kms:DescribeKey"
      ]

      resources = ["*"]

      condition {
        test     = "ArnLike"
        variable = "kms:EncryptionContext:aws:logs:arn"
        values   = ["arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/betrace/*"]
      }
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
