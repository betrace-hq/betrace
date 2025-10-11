# PRD-006: KMS Integration System

**Priority:** P0 (Security Infrastructure)
**Complexity:** Complex (System)
**Type:** System Overview
**Dependencies:** PRD-002 (TigerBeetle), PRD-003 (Compliance Signing)

## Problem

FLUO requires cryptographic operations for compliance span signing (Ed25519) and PII encryption (AES-256-GCM), but currently has no key management system. Hardcoded keys or local key generation violates SOC2 CC6.7, HIPAA §164.312(a)(2)(iv), and NIST 800-53 SC-12. Without AWS KMS integration, keys cannot be securely generated, stored, rotated, or audited.

## Solution Overview

Integrate AWS KMS for centralized key management with per-tenant cryptographic isolation. Each tenant receives dedicated Ed25519 signing keys (for compliance spans) and AES-256 encryption keys (for PII redaction). Key metadata is stored in TigerBeetle (NOT SQL per ADR-011), with Caffeine caching for performance. Automated 90-day key rotation ensures compliance with cryptoperiod requirements.

## System Architecture

### Data Flow Diagram

```
Key Generation Request (tenantId, keyType)
        ↓
   PRD-006b: KeyGenerationService
        ├── Call AWS KMS GenerateDataKey (PRD-006a: AwsKmsClient)
        ├── Extract plaintext key (Ed25519 keypair or AES-256)
        ├── Store key metadata in TigerBeetle (code=8)
        └── Return keyId

Key Retrieval Request (tenantId, keyType)
        ↓
   PRD-006c: KeyRetrievalService
        ├── Check PRD-006d: KeyCache (60 min TTL private, 24 hour public)
        ├── If cache miss: Query TigerBeetle for key metadata
        ├── Decrypt key with AWS KMS (PRD-006a: AwsKmsClient)
        ├── Store in cache (PRD-006d: KeyCache)
        └── Return key bytes

Key Rotation (automated daily)
        ↓
   PRD-006e: KeyRotationScheduler
        ├── Query TigerBeetle for keys older than 90 days
        ├── Generate new key (PRD-006b: KeyGenerationService)
        ├── Mark old key as rotated (status=2)
        ├── Record rotation event (TigerBeetle transfer code=8)
        └── Invalidate cache (PRD-006d: KeyCache)
```

## Unit PRD References

| PRD | Unit | Purpose | Dependencies |
|-----|------|---------|--------------|
| 006a | AwsKmsClient | AWS SDK wrapper for KMS operations | None |
| 006b | KeyGenerationService | Generate Ed25519 and AES-256 keys via KMS | 006a, PRD-002 |
| 006c | KeyRetrievalService | Cache-first key retrieval with KMS decryption | 006a, 006d, PRD-002 |
| 006d | KeyCache | Caffeine cache with TTL policies | None |
| 006e | KeyRotationScheduler | Automated 90-day key rotation | 006b, 006d, PRD-002 |

## TigerBeetle Schema (ADR-011 Compliance)

**Key Metadata Account (code=8):**
```java
Account keyAccount = new Account(
    id: UUID (key ID),
    code: 8,  // KMS key type
    userData128: pack(
        key_type: 8 bits (1=SIGNING, 2=ENCRYPT),
        tenant_id: 96 bits,
        created_at: 32 bits (Unix timestamp seconds),
        status: 8 bits (1=active, 2=rotated, 3=revoked)
    ),
    userData64: KMS ARN hash (first 64 bits of SHA-256),
    reserved: publicKeyBytes  // 32 bytes for Ed25519 public key
);
```

**Key Operation Transfer (code=8):**
```java
Transfer keyOperation = new Transfer(
    id: UUID (event ID),
    debitAccountId: tenantAccount,
    creditAccountId: keyAccount,
    amount: 1,  // Operation count
    code: 8,  // KMS operation type
    userData128: pack(
        op_type: 8 bits (1=generate, 2=sign, 3=encrypt, 4=decrypt, 5=rotate),
        details: 120 bits (operation-specific metadata)
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

## Key Types

| Key Type | Algorithm | Use Case | Public/Private |
|----------|-----------|----------|----------------|
| **SIGNING** | Ed25519 | Compliance span signing (PRD-003) | Both |
| **ENCRYPTION** | AES-256-GCM | PII redaction encrypt strategy (PRD-004) | Private only |

## Cache Strategy (PRD-006d)

| Key Type | Visibility | TTL | Rationale |
|----------|-----------|-----|-----------|
| Signing (private) | Private | 60 min | Balance security and performance |
| Signing (public) | Public | 24 hours | Low risk, high reuse for signature verification |
| Encryption (private) | Private | 60 min | Minimize exposure window |

## ADR Compliance Summary

- **ADR-011 (TigerBeetle-First):** Key metadata stored as TigerBeetle accounts (code=8), operations as transfers (code=8). NO SQL tables.
- **ADR-012 (Tenant Isolation):** Per-tenant KMS keys with ledger isolation
- **ADR-013 (Camel-First):** KeyRetrievalService used in Camel processors (exception: KeyRotationScheduler is @Scheduled job)
- **ADR-014 (Testing Standards):** All services are @Named or @ApplicationScoped with 90% test coverage
- **ADR-015 (Tiered Storage):** Key events in TigerBeetle → DuckDB → Parquet for audit

## Success Criteria (System-Level)

**Functional Requirements:**
- [ ] Generate Ed25519 signing keys for new tenants
- [ ] Generate AES-256 encryption keys for new tenants
- [ ] Retrieve keys with cache-first strategy (hit rate >80%)
- [ ] Rotate keys automatically after 90 days
- [ ] Invalidate cache on rotation
- [ ] Record all key operations in TigerBeetle for audit

**Performance Requirements:**
- [ ] Key generation: <500ms per key
- [ ] Cached key retrieval: <1ms
- [ ] Uncached key retrieval: <100ms
- [ ] Rotation completes for 100 tenants in <5 minutes

**Security Requirements:**
- [ ] Private keys never stored in plaintext (KMS encrypted)
- [ ] Cache eviction after TTL (60 min private, 24 hour public)
- [ ] Per-tenant cryptographic isolation (no key sharing)
- [ ] Rotation events immutably recorded (TigerBeetle WORM)

**Compliance Requirements:**
- [ ] SOC2 CC6.7 (Encryption) - KMS manages all keys
- [ ] NIST 800-53 SC-12 (Key Management) - 90-day rotation
- [ ] HIPAA §164.312(a)(2)(iv) (Encryption) - AES-256-GCM
- [ ] PCI-DSS 3.6.4 (Key Rotation) - automated rotation

## Integration Testing

**End-to-End Scenarios:**

1. **Full Key Lifecycle:**
   - Create tenant → generate signing key → generate encryption key
   - Use keys for 90 days (simulate) → verify rotation triggers
   - Verify old key marked as rotated (status=2)
   - Verify cache invalidated after rotation

2. **Cache Performance:**
   - Generate key → retrieve (cache miss) → measure latency
   - Retrieve again (cache hit) → verify <1ms
   - Wait 60 min → verify private key expired
   - Wait 24 hours → verify public key expired

3. **Multi-Tenant Isolation:**
   - Tenant A generates signing key
   - Tenant B generates signing key
   - Tenant A retrieves key → verify only sees own key
   - Verify TigerBeetle ledger isolation

4. **Rotation Audit Trail:**
   - Create key → wait 90 days → trigger rotation
   - Query TigerBeetle transfers (code=8) → verify rotation event
   - Verify old key status=2, new key status=1
   - Verify both keys linked in userData128

5. **AWS KMS Failure Handling:**
   - Simulate KMS API failure during generation → verify error handling
   - Simulate KMS throttling → verify retry logic
   - Verify cache fallback when KMS unavailable

## Related PRDs

**Uses KMS Keys:**
- **PRD-003:** Compliance span signing (uses Ed25519 signing keys)
- **PRD-004:** PII redaction ENCRYPT strategy (uses AES-256 encryption keys)

**Depends On:**
- **PRD-002:** TigerBeetle persistence (key metadata storage)

**Integration Points:**
- ComplianceSpanProcessor calls KeyRetrievalService for signing keys
- RedactionService calls KeyRetrievalService for encryption keys
- All key operations recorded in TigerBeetle for audit

## Configuration

**Environment Variables:**
```properties
# application.properties
aws.kms.master-key-id=${AWS_KMS_MASTER_KEY_ID}
aws.kms.region=us-east-1
aws.kms.retry.max-attempts=3
aws.kms.retry.backoff-ms=100

fluo.kms.cache.private-key-ttl=60m
fluo.kms.cache.public-key-ttl=24h
fluo.kms.cache.max-entries=1000

fluo.kms.rotation.enabled=true
fluo.kms.rotation.age-days=90
fluo.kms.rotation.batch-size=100
```

**AWS IAM Policy:**
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
      "Resource": "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_ID"
    }
  ]
}
```

## Files Created

**Services:**
- `backend/src/main/java/com/fluo/services/AwsKmsClient.java` (PRD-006a)
- `backend/src/main/java/com/fluo/services/KeyGenerationService.java` (PRD-006b)
- `backend/src/main/java/com/fluo/services/KeyRetrievalService.java` (PRD-006c)
- `backend/src/main/java/com/fluo/services/KeyCache.java` (PRD-006d)
- `backend/src/main/java/com/fluo/services/KeyRotationScheduler.java` (PRD-006e)

**Models:**
- `backend/src/main/java/com/fluo/model/KEY_TYPE.java` (enum: SIGNING, ENCRYPTION)

**Tests:**
- `backend/src/test/java/com/fluo/services/AwsKmsClientTest.java`
- `backend/src/test/java/com/fluo/services/KeyGenerationServiceTest.java`
- `backend/src/test/java/com/fluo/services/KeyRetrievalServiceTest.java`
- `backend/src/test/java/com/fluo/services/KeyCacheTest.java`
- `backend/src/test/java/com/fluo/services/KeyRotationSchedulerTest.java`
- `backend/src/test/java/com/fluo/integration/KmsIntegrationTest.java`

## Files Modified

**Configuration:**
- `backend/pom.xml` - Add AWS SDK dependencies
- `backend/src/main/resources/application.properties` - Add KMS config

**Existing Services:**
- `backend/src/main/java/com/fluo/services/ComplianceSpanProcessor.java` - Inject KeyRetrievalService for signing
- `backend/src/main/java/com/fluo/services/RedactionService.java` - Inject KeyRetrievalService for encryption

## Compliance Benefits

**Regulatory Alignment:**
- **SOC2 CC6.7:** Centralized key management via AWS KMS
- **NIST 800-53 SC-12:** Cryptographic key establishment and management
- **HIPAA §164.312(a)(2)(iv):** Encryption and decryption with managed keys
- **PCI-DSS 3.6.4:** Cryptoperiod enforcement via 90-day rotation

**Evidence Chain:**
1. **Key Generation:** TigerBeetle account (code=8) created
2. **Key Usage:** Transfer (code=8) for each sign/encrypt operation
3. **Key Rotation:** Transfer (code=8, userData128.op_type=5) with old/new key linkage
4. **Audit Trail:** Query TigerBeetle for complete key lifecycle per tenant

## Future Enhancements

- Hardware Security Module (HSM) integration for on-premises deployments
- Azure Key Vault and Google Cloud KMS support (multi-cloud)
- Key escrow for compliance investigations
- Key usage analytics dashboard (operations per key)
- Customer-managed keys (BYOK) for enterprise tenants
- Automatic key rotation on compromise detection

## Public Examples

### 1. AWS KMS Java SDK
**URL:** https://docs.aws.amazon.com/kms/latest/developerguide/programming-keys.html

**Relevance:** Official AWS documentation for KMS operations in Java. This is FLUO's primary KMS provider, making it the authoritative reference for implementation.

**Key Patterns:**
- `GenerateDataKey` API for per-tenant encryption keys
- `Decrypt` API with KMS-managed master keys
- Envelope encryption pattern (DEK encrypted by KEK)
- Key policies for least-privilege access
- CloudTrail audit logging of key operations

**FLUO Implementation:** See [AwsKmsClient.java](../../backend/src/main/java/com/fluo/services/AwsKmsClient.java) for production integration with AWS KMS SDK v2.

### 2. HashiCorp Vault
**URL:** https://www.vaultproject.io/docs

**Relevance:** Alternative KMS with similar features to AWS KMS. Demonstrates secrets management patterns, key rotation, and access control policies applicable to multi-cloud or on-premises deployments.

**Key Patterns:**
- Transit secrets engine for encryption-as-a-service
- Dynamic secrets with TTL-based expiration
- Key versioning and rotation
- Policy-based access control (similar to AWS IAM)
- Audit logging of all secret operations

**FLUO Future:** If FLUO adds multi-cloud support or on-premises deployments, Vault provides a cloud-agnostic KMS alternative.

### 3. Google Cloud KMS
**URL:** https://cloud.google.com/kms/docs

**Relevance:** Multi-cloud KMS comparison demonstrating similar key management patterns. Useful for evaluating KMS features and understanding industry standards for cryptographic key lifecycle management.

**Key Patterns:**
- Key rings for organizing related keys
- Automatic key rotation schedules
- HSM-backed keys (Cloud HSM)
- Asymmetric key support (Ed25519, RSA)
- IAM policies for key access control

**FLUO Alignment:** Google Cloud KMS's key ring concept maps to FLUO's per-tenant key isolation. Rotation schedules inform FLUO's 90-day cryptoperiod.
