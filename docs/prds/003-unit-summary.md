# PRD-003: Unit Implementation Summary

**Parent PRD:** PRD-003 (Compliance Span Cryptographic Signing)
**Date:** 2025-10-10
**Status:** Split into 5 independent units

## Unit Overview

PRD-003 has been split into 5 independently implementable units:

### Unit A: Core Signature Service
**File:** `003a-core-signature-service.md`
**Priority:** P0
**Dependencies:** PRD-006 (KMS - can be mocked)
**Blocks:** All other units

**Scope:**
- `ComplianceSignatureService` with Ed25519 signing/verification
- Canonical JSON generation
- Compliance attribute extraction
- Tenant isolation enforcement

**Key Deliverables:**
- Service class with sign/verify methods
- 90%+ test coverage
- Performance: <5ms per operation

---

### Unit B: Signing Processor Integration
**File:** `003b-signing-processor-integration.md`
**Priority:** P0
**Dependencies:** PRD-003a (Core Signature Service)
**Blocks:** None

**Scope:**
- `SignComplianceSpanProcessor` Camel processor
- Automatic signature generation on span creation
- Integration with existing `ComplianceSpanProcessor`

**Key Deliverables:**
- Named processor for signing
- Integration into span processing pipeline
- Error handling and logging

---

### Unit C: Verification API Routes
**File:** `003c-verification-api-routes.md`
**Priority:** P0
**Dependencies:** PRD-003a (Core Signature Service)
**Blocks:** PRD-003d (TigerBeetle events), PRD-003e (Frontend UI)

**Scope:**
- Camel REST routes for verification API
- Named processors: `ExtractComplianceAttributesProcessor`, `VerifySignatureProcessor`
- Model classes: `ComplianceSpanVerificationRequest`, `VerificationResult`
- Single span and batch verification endpoints

**Key Deliverables:**
- POST /api/compliance/verify/span
- POST /api/compliance/verify/batch
- 90%+ test coverage

---

### Unit D: TigerBeetle Verification Events
**File:** `003d-tigerbeetle-verification-events.md`
**Priority:** P0
**Dependencies:** PRD-003c (Verification API), PRD-002 (TigerBeetle)
**Blocks:** None

**Scope:**
- `RecordVerificationEventProcessor` - Write events to TigerBeetle
- `QueryVerificationHistoryProcessor` - Read verification history
- GET /api/compliance/verify/history/{tenantId} endpoint
- Immutable audit trail in TigerBeetle

**Key Deliverables:**
- Verification events as TigerBeetle transfers (code=4)
- Query API for verification history
- TigerBeetle service extensions

---

### Unit E: Frontend Verification UI
**File:** `003e-frontend-verification-ui.md`
**Priority:** P0
**Dependencies:** PRD-003c (Verification API)
**Blocks:** None

**Scope:**
- `SignatureVerificationBadge` React component
- `VerificationHistory` React component
- API client for verification endpoints
- Integration with signal detail page

**Key Deliverables:**
- Visual verification status badges
- On-demand re-verification button
- Verification history display
- Storybook stories and component tests

---

## Dependency Graph

```
PRD-003a (Core Service)
    ↓
    ├──→ PRD-003b (Signing Processor) [Independent]
    └──→ PRD-003c (Verification API)
            ↓
            ├──→ PRD-003d (TigerBeetle Events) [Independent]
            └──→ PRD-003e (Frontend UI) [Independent]
```

## Implementation Order

**Recommended implementation sequence:**

1. **PRD-003a** (Core Service) - Foundation for all other units
2. **PRD-003b** (Signing Processor) - Can be implemented in parallel with C
3. **PRD-003c** (Verification API) - Required before D and E
4. **PRD-003d** (TigerBeetle Events) - Can be implemented in parallel with E
5. **PRD-003e** (Frontend UI) - Final UI integration

**Parallel tracks:**
- Track 1: 003a → 003b (signing flow)
- Track 2: 003a → 003c → 003d (verification + audit trail)
- Track 3: 003a → 003c → 003e (verification + UI)

## Testing Strategy

Each unit has independent tests:
- **Unit A**: Service tests, security tests, performance tests
- **Unit B**: Processor tests, integration tests
- **Unit C**: Route tests, processor tests, API integration tests
- **Unit D**: Processor tests, TigerBeetle integration tests
- **Unit E**: Component tests, Storybook stories, UI integration tests

All units target 90%+ test coverage per ADR-014.

## Success Criteria Summary

**When all units are complete:**
- ✅ All compliance spans have Ed25519 signatures
- ✅ Signatures verified via REST API
- ✅ Verification events recorded in TigerBeetle (immutable)
- ✅ Frontend displays verification status
- ✅ Tamper detection works end-to-end
- ✅ 90%+ test coverage across all units
- ✅ <5ms signature generation performance

## Related Documents

- **Parent PRD:** [PRD-003: Compliance Span Cryptographic Signing](./003-compliance-span-cryptographic-signing.md)
- **Architecture:** [ADR-013: Camel-First](../adrs/013-apache-camel-first-architecture.md), [ADR-014: Testing Standards](../adrs/014-camel-testing-and-organization-standards.md)
- **Compliance:** [docs/compliance-status.md](../compliance-status.md)

## Notes

- Each unit is independently testable and deployable
- Units can be implemented by different developers simultaneously
- All units preserve security requirements from parent PRD
- TigerBeetle integration provides immutable audit trail
- Frontend unit is optional for backend-only deployments
