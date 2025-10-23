# PRD-004: PII Redaction Enforcement

**Priority:** P0 (Security Gap - Blocks Production)
**Complexity:** Complex (System)
**Personas:** All (GDPR/HIPAA compliance)
**Dependencies:** PRD-002 (TigerBeetle), PRD-003 (Compliance Signing), PRD-006 (KMS), PRD-009 (Span Ingestion)

## Problem

PII is **not redacted before OpenTelemetry export**, violating GDPR, HIPAA, and SOC2 requirements. Annotations exist (`@Redact`, `@PII`, `@Sensitive`) but are decorative only. PII leaks to all storage tiers (Tempo, Grafana, logs, DuckDB, Parquet) without enforcement.

## Solution Overview

Implement automatic PII detection and configurable redaction in the Camel span ingestion pipeline. Redaction occurs **before writing to any storage tier**, with cryptographic compliance evidence and immutable audit trails.

## System Architecture

### Data Flow Diagram

```
OTLP Span Received
        ↓
   [Camel Route: Span Ingestion]
        ↓
   PRD-004c: DetectPIIProcessor
        ↓ (sets piiFields header)
   PRD-004d: LoadRedactionRulesProcessor
        ↓ (sets redactionRules header)
   PRD-004e: ApplyRedactionProcessor
        ↓ (redacts span attributes, sets redactedFieldCount)
   PRD-004f: RecordRedactionEventProcessor
        ↓ (creates TigerBeetle audit event, sets redactionEventId)
   PRD-004g: GenerateRedactionComplianceSpanProcessor
        ↓ (generates SOC2 CC6.7 evidence)
   Span Log (redacted)
        ↓
   DuckDB (redacted)
        ↓
   Parquet (redacted)
```

## Unit PRD References

| PRD | Unit | Purpose | Dependencies |
|-----|------|---------|--------------|
| 004a | PIIDetectionService | Detect PII via patterns and conventions | None |
| 004b | RedactionService | Execute 5 strategies (HASH/MASK/TOKENIZE/REMOVE/ENCRYPT) | PRD-006 (KMS) |
| 004c | DetectPIIProcessor | Scan span attributes for PII in pipeline | 004a |
| 004d | LoadRedactionRulesProcessor | Load tenant-specific rules from TigerBeetle | PRD-002, 004c |
| 004e | ApplyRedactionProcessor | Apply redaction strategies to detected PII | 004b, 004d |
| 004f | RecordRedactionEventProcessor | Create immutable TigerBeetle audit event | PRD-002, 004e |
| 004g | GenerateRedactionComplianceSpanProcessor | Generate SOC2 CC6.7 evidence | PRD-003, 004f |

## Redaction Strategies

**Five strategies with different reversibility guarantees:**

| Strategy | Method | Reversible | Use Case |
|----------|--------|------------|----------|
| **HASH** | SHA-256 hash | ❌ No | Emails, usernames (one-way) |
| **MASK** | Partial masking | ❌ No | Phone numbers (show last 4 digits) |
| **TOKENIZE** | Deterministic token | ✅ Yes (lookup) | Credit cards (reversible via DB) |
| **REMOVE** | Complete removal | ❌ No | SSNs (no storage) |
| **ENCRYPT** | AES-256-GCM | ✅ Yes (decrypt with KMS) | Sensitive data (reversible with key) |

**Examples:**
- `HASH`: `"user@email.com"` → `"hash:5e88489c7bba"`
- `MASK`: `"555-123-4567"` → `"***-***-4567"`
- `TOKENIZE`: `"4532-1234-5678-9010"` → `"TOK-7f3a9b2c1d8e"`
- `REMOVE`: `"123-45-6789"` → `"[REDACTED]"`
- `ENCRYPT`: `"secret data"` → `"enc:aGVsbG8gd29ybGQ="`

## ADR Compliance

**Architecture Decision Records:**

- **ADR-011 (TigerBeetle):** Redaction rules and events stored in TigerBeetle (no SQL tables)
- **ADR-012 (Tenant Isolation):** Per-tenant redaction rules, mathematically isolated ledgers
- **ADR-013 (Camel-First):** Redaction implemented as Camel processors in pipeline
- **ADR-014 (Testing):** Named processors with 90% test coverage
- **ADR-015 (Tiered Storage):** Redaction occurs **before** all storage tiers (span log, DuckDB, Parquet)

## Success Criteria

**System Requirements:**

- [ ] **PII Detection:** Automatic detection via patterns (email, SSN, phone) and conventions (attribute names)
- [ ] **All Strategies Work:** HASH, MASK, TOKENIZE, REMOVE, ENCRYPT all functional
- [ ] **Redaction Before Storage:** PII redacted before span log, DuckDB, Parquet, Tempo, Grafana
- [ ] **No PII Leakage:** Original PII never reaches any storage tier (verified in tests)
- [ ] **Compliance Evidence:** SOC2 CC6.7 compliance span generated and signed for every redaction
- [ ] **Immutable Audit:** TigerBeetle event created for every redaction (WORM ledger)
- [ ] **Per-Tenant Rules:** Redaction strategies configurable per tenant, isolated in TigerBeetle
- [ ] **Performance:** Redaction overhead <1ms per span, no ingestion throughput impact

## Integration Testing

**End-to-End Scenarios:**

1. **Full Pipeline Test:**
   - Send OTLP span with PII → verify redacted in span log → verify redacted in DuckDB → verify redacted in Parquet
   - Assert: Original PII never appears in any storage tier

2. **Multi-Tenant Isolation:**
   - Tenant A: email=HASH, phone=MASK
   - Tenant B: email=REMOVE, phone=TOKENIZE
   - Verify: Each tenant's rules apply correctly, no cross-tenant leakage

3. **All Strategies Test:**
   - Span with 5 fields (email, phone, SSN, card, address)
   - Apply different strategy to each field
   - Verify: All 5 strategies produce correct output

4. **No Leakage Verification:**
   - Inject span with known PII value
   - Search all storage tiers (span log files, DuckDB queries, Parquet files)
   - Assert: Original PII string never found

5. **Compliance Chain:**
   - Redact PII → verify TigerBeetle event exists → verify compliance span exists → verify signature valid
   - Assert: Complete audit trail from redaction to compliance evidence

## Related PRDs

**Dependencies:**
- **PRD-002:** TigerBeetle persistence (redaction rules, audit events)
- **PRD-003:** Compliance span signing (cryptographic evidence)
- **PRD-006:** KMS integration (ENCRYPT strategy requires tenant keys)
- **PRD-009:** Span ingestion pipeline (where redaction occurs)

**Blocks:**
- Any feature displaying traces (must show redacted values only)
- Compliance audits (proves PII protection effectiveness)
- Production deployment (GDPR/HIPAA compliance requirement)

## Compliance Benefits

**Regulatory Alignment:**

- **GDPR Article 25:** Data protection by design and by default
- **HIPAA §164.514:** De-identification of Protected Health Information (PHI)
- **SOC2 CC6.7:** Encryption and redaction of sensitive data
- **PCI-DSS 3.4:** Primary Account Number (PAN) must be unreadable wherever stored

**Evidence Chain:**

1. **Detection:** PIIDetectionService finds PII in span
2. **Application:** RedactionService applies tenant-configured strategy
3. **Audit:** TigerBeetle records immutable event (code=6)
4. **Compliance:** SOC2 CC6.7 span generated and cryptographically signed
5. **Verification:** Auditors query TigerBeetle + verify signatures

## Future Enhancements

- Machine learning-based PII detection (train on tenant data patterns)
- Custom PII regex patterns (tenant-defined sensitive patterns)
- Redaction preview UI (preview before applying rules)
- Audit dashboard (visualize redaction coverage by tenant/service)
- K-anonymity and differential privacy techniques
- Reversible redaction API (authorized decrypt for ENCRYPT strategy)

## Public Examples

### 1. Microsoft Presidio
**URL:** https://github.com/microsoft/presidio

**Relevance:** Open-source PII detection and anonymization framework implementing pattern-based detection (email, SSN, phone) and multiple redaction strategies (hash, mask, encrypt, remove). Directly applicable to BeTrace's redaction requirements.

**Key Patterns:**
- Named entity recognition (NER) for PII detection
- Configurable detection patterns (regex, ML models)
- Multiple anonymization strategies (redact, replace, hash, encrypt)
- Multi-language support
- Custom PII entity types

**BeTrace Alignment:** Presidio's analyzer-anonymizer pattern maps to BeTrace's PIIDetectionService + RedactionService architecture.

### 2. Google Cloud DLP API
**URL:** https://cloud.google.com/dlp/docs

**Relevance:** Enterprise data loss prevention service implementing all 5 of BeTrace's redaction strategies (HASH, MASK, TOKENIZE, REMOVE, ENCRYPT/FPE). Industry standard for PII classification and transformation.

**Key Patterns:**
- InfoType detection (50+ built-in PII types)
- De-identification transformations (masking, crypto-based tokenization, format-preserving encryption)
- Re-identification with token mapping
- Risk analysis and k-anonymity
- Audit logging of redaction operations

**BeTrace Alignment:** DLP API's transformation types directly correspond to BeTrace's 5 redaction strategies.

### 3. Amazon Macie
**URL:** https://docs.aws.amazon.com/macie/

**Relevance:** AWS managed service for automated PII discovery and data classification. Demonstrates patterns for continuous PII scanning and risk scoring.

**Key Patterns:**
- Automated PII discovery in data stores
- Sensitive data classification (PII, credentials, API keys)
- Risk-based alerting
- Integration with AWS KMS for encryption
- Compliance reporting (GDPR, HIPAA, PCI-DSS)

**BeTrace Alignment:** Macie's continuous scanning pattern informs BeTrace's pipeline-based redaction (automatic detection before storage).
