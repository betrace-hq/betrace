# BeTrace Backend IAM Policy for KMS Access
#
# This file creates an IAM policy that grants the BeTrace backend
# permission to use the KMS master key for encryption operations.
#
# Attach this policy to your BeTrace backend IAM role or user.

# IAM Policy for BeTrace Backend KMS Access
resource "aws_iam_policy" "betrace_kms_access" {
  name        = "betrace-kms-access-${var.environment}"
  description = "Grants BeTrace backend access to KMS master key for encryption operations"
  path        = "/betrace/"

  policy = data.aws_iam_policy_document.betrace_kms_access.json

  tags = merge(
    var.tags,
    {
      Name        = "betrace-kms-access-${var.environment}"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# IAM Policy Document for BeTrace Backend KMS Access
data "aws_iam_policy_document" "betrace_kms_access" {
  # Statement 1: KMS Key Operations
  statement {
    sid    = "BeTraceKmsKeyOperations"
    effect = "Allow"

    actions = [
      # Key metadata (read-only)
      "kms:DescribeKey",
      "kms:GetKeyPolicy",
      "kms:GetKeyRotationStatus",
      "kms:ListResourceTags",

      # Encryption operations (required for RedactionService)
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey",
      "kms:GenerateDataKeyWithoutPlaintext",

      # Grant management (required for envelope encryption)
      "kms:CreateGrant",
      "kms:RetireGrant",
      "kms:RevokeGrant"
    ]

    resources = [
      aws_kms_key.betrace_master_key.arn
    ]

    # Optional: Restrict to specific encryption contexts
    dynamic "condition" {
      for_each = var.enforce_encryption_context ? [1] : []

      content {
        test     = "StringEquals"
        variable = "kms:EncryptionContext:purpose"
        values   = ["pii_redaction", "compliance_evidence"]
      }
    }
  }

  # Statement 2: KMS Alias Resolution
  statement {
    sid    = "BeTraceKmsAliasResolution"
    effect = "Allow"

    actions = [
      "kms:DescribeKey"
    ]

    resources = [
      "arn:aws:kms:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:alias/betrace-${var.environment}"
    ]
  }

  # Statement 3: KMS Key Listing (optional, for monitoring)
  statement {
    sid    = "BeTraceKmsListKeys"
    effect = "Allow"

    actions = [
      "kms:ListKeys",
      "kms:ListAliases"
    ]

    resources = ["*"]
  }
}

# Optionally attach policy to existing IAM role
resource "aws_iam_role_policy_attachment" "betrace_kms_access" {
  count = var.attach_to_role ? 1 : 0

  role       = var.betrace_iam_role_name
  policy_arn = aws_iam_policy.betrace_kms_access.arn
}

# Optional: Create dedicated BeTrace backend IAM role
resource "aws_iam_role" "betrace_backend" {
  count = var.create_iam_role ? 1 : 0

  name        = "betrace-backend-${var.environment}"
  description = "IAM role for BeTrace backend service (${var.environment})"
  path        = "/betrace/"

  assume_role_policy = data.aws_iam_policy_document.betrace_backend_assume_role[0].json

  max_session_duration = 3600 # 1 hour

  tags = merge(
    var.tags,
    {
      Name        = "betrace-backend-${var.environment}"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )
}

# Assume role policy for BeTrace backend
data "aws_iam_policy_document" "betrace_backend_assume_role" {
  count = var.create_iam_role ? 1 : 0

  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = var.betrace_service_principals
    }

    actions = ["sts:AssumeRole"]

    # Optional: Restrict to specific external IDs
    dynamic "condition" {
      for_each = var.external_id != "" ? [1] : []

      content {
        test     = "StringEquals"
        variable = "sts:ExternalId"
        values   = [var.external_id]
      }
    }
  }
}

# Attach KMS policy to created IAM role
resource "aws_iam_role_policy_attachment" "betrace_backend_kms" {
  count = var.create_iam_role ? 1 : 0

  role       = aws_iam_role.betrace_backend[0].name
  policy_arn = aws_iam_policy.betrace_kms_access.arn
}

# Optional: Attach CloudWatch Logs policy to IAM role
resource "aws_iam_role_policy_attachment" "betrace_backend_cloudwatch" {
  count = var.create_iam_role && var.enable_cloudwatch_logs ? 1 : 0

  role       = aws_iam_role.betrace_backend[0].name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
}
