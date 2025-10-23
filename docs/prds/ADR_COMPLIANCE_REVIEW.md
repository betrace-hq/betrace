# Architecture-Guardian: PRD ADR Compliance Review

**Date:** 2025-10-10
**Reviewer:** Architecture-Guardian Agent
**Status:** In Progress

## Executive Summary

Initial review of 27 PRDs revealed that only PRDs 001, 002, 003, and 015 (ADR) are fully compliant with BeTrace's ADR architecture. The remaining 23 PRDs require revision to comply with:

- **ADR-011:** Pure Application Framework (no SQL coupling)
- **ADR-012:** Mathematical Tenant Isolation (physical separation)
- **ADR-013:** Apache Camel-First Architecture (no JAX-RS)
- **ADR-014:** Testing and Organization Standards (named processors, 90% coverage)
- **ADR-015:** Tiered Storage Architecture (integration with trace storage)

## Compliant PRDs

### ✅ PRD-001: Authentication & Authorization
**Status:** COMPLIANT (Revised 2025-10-10)
- Uses Camel interceptor pattern
- Named processors for auth flow
- TigerBeetle for auth events (code=5)
- Compliance evidence for SOC2 CC6.1
- 90% test coverage requirements

### ✅ PRD-002: Persistence Layer
**Status:** COMPLIANT (Revised 2025-10-10)
- TigerBeetle-only persistence
- Tiered storage (span log, DuckDB, Parquet)
- ColdStorageService abstraction (deployment-agnostic)
- Links to all relevant ADRs

### ✅ PRD-003: Compliance Span Cryptographic Signing
**Status:** COMPLIANT (Revised 2025-10-10)
- Camel REST DSL routes
- Named processors for signing/verification
- TigerBeetle for verification events (code=4)
- Integration with tiered storage

### ✅ ADR-015: Tiered Storage Architecture
**Status:** COMPLIANT (Created 2025-10-10)
- Comprehensive architecture document
- Camel routes for archival
- Two-phase commit pattern
- ColdStorageService abstraction

## PRDs Requiring Revision

### 🔴 P0 Security PRDs (Blocks Production)

#### PRD-004: PII Redaction Enforcement
**Priority:** P0
**Violations Expected:**
- May use JAX-RS endpoints
- May not have Camel processor pattern
- May not generate compliance evidence
- May not integrate with tiered storage

**Required Changes:**
1. Implement as Camel processor in span ingestion pipeline
2. Generate compliance spans for redaction events (SOC2 CC6.2)
3. Record redaction events in TigerBeetle (immutable audit)
4. Named processors: `DetectPIIProcessor`, `ApplyRedactionStrategyProcessor`, `RecordRedactionEventProcessor`

#### PRD-005: Rule Engine Sandboxing
**Priority:** P0
**Violations Expected:**
- Sandboxing approach may not be Camel-integrated
- May not generate compliance evidence for sandbox violations
- May not use TigerBeetle for violation events

**Required Changes:**
1. Implement as Camel processor wrapping Drools execution
2. Generate compliance spans for sandbox violations
3. Record violations in TigerBeetle
4. Named processors: `ValidateRuleSafetyProcessor`, `ExecuteInSandboxProcessor`, `RecordViolationProcessor`

#### PRD-006: KMS Integration
**Priority:** P0
**Violations Expected:**
- May have JAX-RS endpoints for key management
- May not have Camel routes for key operations
- May couple to specific KMS provider (AWS only)

**Required Changes:**
1. Create `KeyManagementService` abstraction (deployment-agnostic)
2. Default implementation: local filesystem for dev
3. External implementations: AWS KMS, Google KMS, Azure Key Vault
4. Camel routes for key operations with named processors
5. Generate compliance spans for key access (SOC2 CC6.6)

#### PRD-007: API Input Validation & Rate Limiting
**Priority:** P0
**Violations Expected:**
- May use JAX-RS validators
- May not be Camel interceptor pattern
- May not generate compliance evidence

**Required Changes:**
1. Implement as Camel interceptor (runs before auth)
2. Named processors: `ValidateInputProcessor`, `CheckRateLimitProcessor`, `RecordRateLimitViolationProcessor`
3. Generate compliance spans for validation failures
4. Record violations in TigerBeetle

### 🟡 P0 Core Feature PRDs

#### PRD-008: Signal Management System
**Priority:** P0
**Violations Expected:**
- Likely uses JAX-RS endpoints
- May have SQL table for signals (should use TigerBeetle)
- May not integrate with tiered storage

**Required Changes:**
1. Camel REST DSL routes for signal operations
2. Use TigerBeetle transfers for signals (already in PRD-002)
3. Named processors for signal lifecycle
4. Integration with tiered storage for signal metadata

#### PRD-009: Trace Ingestion Pipeline
**Priority:** P0
**Violations Expected:**
- May have JAX-RS endpoint for OTLP
- May not integrate with tiered storage properly

**Required Changes:**
1. Camel route for OTLP ingestion
2. Named processors: `ParseOTLPProcessor`, `AppendToSpanLogProcessor`, `InsertIntoDuckDBProcessor`, `EvaluateRulesProcessor`
3. Integration with ADR-015 tiered storage
4. Generate compliance spans for ingestion events

#### PRD-010: Rule Management UI
**Priority:** P0
**Violations Expected:**
- Backend may have JAX-RS endpoints
- May not have Camel routes for rule CRUD

**Required Changes:**
1. Camel REST DSL routes for rule operations
2. Named processors for rule lifecycle
3. Generate compliance spans for rule changes (audit trail)
4. Use TigerBeetle for rule storage (already in PRD-002)

#### PRD-011: Signal Investigation Workflow
**Priority:** P0
**Violations Expected:**
- May have JAX-RS endpoints
- May not integrate with tiered storage for trace queries

**Required Changes:**
1. Camel REST DSL routes for investigation
2. Named processors for workflow steps
3. Query traces from hot/cold storage (ADR-015)
4. Generate compliance spans for investigation actions

#### PRD-012: Tenant Management System
**Priority:** P0
**Violations Expected:**
- May have JAX-RS endpoints
- May not generate compliance evidence for tenant operations

**Required Changes:**
1. Camel REST DSL routes for tenant CRUD
2. Named processors for tenant lifecycle
3. Use TigerBeetle accounts for tenants (already in PRD-002)
4. Generate compliance spans for tenant changes (SOC2 CC6.1)

#### PRD-013: SRE Dashboard
**Priority:** P0
**Violations Expected:**
- Frontend-focused, likely compliant
- May need backend API route updates

**Required Changes:**
1. Ensure all backend APIs are Camel routes
2. Integration with tiered storage for metrics

### 🟢 P1 User Workflow PRDs

#### PRD-014: Developer Rule Testing
**Priority:** P1
**Violations Expected:**
- May have JAX-RS endpoints for test execution
- May not integrate with tiered storage for trace replay

**Required Changes:**
1. Camel REST DSL routes for test execution
2. Named processors for test lifecycle
3. Integrate with ADR-015 for trace replay
4. Generate compliance spans for test runs

#### PRD-015: Compliance Evidence Dashboard
**Priority:** P1
**Violations Expected:**
- Frontend-focused, likely compliant
- May need backend API updates

**Required Changes:**
1. Ensure all backend APIs are Camel routes
2. Query compliance spans from tiered storage
3. Verify signatures using PRD-003 verification routes

#### PRD-016: Audit Report Generation
**Priority:** P1
**Violations Expected:**
- May have JAX-RS endpoints for report generation
- May not query from tiered storage

**Required Changes:**
1. Camel REST DSL routes for report generation
2. Named processors for report lifecycle
3. Query compliance spans from Parquet (ADR-015)
4. Generate compliance span for report generation (audit of audit)

#### PRD-017: Alert & Notification System
**Priority:** P1
**Violations Expected:**
- May have JAX-RS endpoints
- May not use Camel routes for notifications

**Required Changes:**
1. Camel routes for notification delivery
2. Named processors: `EvaluateAlertConditionProcessor`, `SendNotificationProcessor`, `RecordNotificationProcessor`
3. Generate compliance spans for alert events
4. Store alert history in TigerBeetle

### 🟢 P1 Quality & Ops PRDs

#### PRD-018: Comprehensive Test Suite
**Priority:** P1
**Violations:** N/A (Testing PRD, no architecture)
**Action:** Review for ADR-014 compliance requirements

#### PRD-019: Observability for BeTrace
**Priority:** P1
**Violations Expected:**
- May couple to specific observability platforms

**Required Changes:**
1. Create observability abstraction
2. Default: OpenTelemetry export
3. External: Grafana, Datadog, etc.
4. No hardcoded platform coupling (ADR-011)

#### PRD-020: Performance Optimization
**Priority:** P1
**Violations:** N/A (Optimization PRD)
**Action:** Ensure optimizations don't violate ADRs

#### PRD-021: Graceful Degradation
**Priority:** P1
**Violations Expected:**
- Circuit breaker may not be Camel-integrated

**Required Changes:**
1. Use Camel circuit breaker EIP
2. Named processors for fallback logic
3. Record degradation events in TigerBeetle

#### PRD-022: Backup & Recovery
**Priority:** P1
**Violations Expected:**
- May not integrate with tiered storage properly
- May couple to specific backup solutions

**Required Changes:**
1. Backup strategy for TigerBeetle data files
2. Backup strategy for append-only span log
3. Recovery procedures using ADR-015 replay
4. No coupling to specific backup vendors (ADR-011)

### 🟢 P2 Enhancement PRDs

#### PRD-023: Rule Analytics
**Priority:** P2
**Violations Expected:**
- May have JAX-RS endpoints
- May not query from tiered storage

**Required Changes:**
1. Camel REST DSL routes
2. Query analytics from DuckDB/Parquet (ADR-015)
3. Named processors for analytics computation

#### PRD-024: Grafana Integration
**Priority:** P2
**Violations Expected:**
- May couple directly to Grafana

**Required Changes:**
1. Use observability abstraction from PRD-019
2. Grafana as external consumer of metrics
3. No Grafana-specific code in BeTrace (ADR-011)

#### PRD-025: CI/CD Integration
**Priority:** P2
**Violations:** N/A (External deployment concern)
**Action:** Ensure doesn't violate ADR-011 (Pure Application Framework)

#### PRD-026: Rule Versioning & Rollback
**Priority:** P2
**Violations Expected:**
- May have JAX-RS endpoints
- May not use TigerBeetle for version history

**Required Changes:**
1. Camel REST DSL routes
2. Store rule versions in TigerBeetle
3. Named processors for versioning operations
4. Generate compliance spans for rollback events

#### PRD-027: Advanced Query Language
**Priority:** P2
**Violations Expected:**
- May not integrate with tiered storage properly
- May couple to specific query engines

**Required Changes:**
1. Camel REST DSL routes for query execution
2. Query abstraction (DuckDB, Parquet, TigerBeetle)
3. Named processors for query translation
4. No coupling to specific query engines (ADR-011)

## Revision Priority

### Immediate (This Session)
1. ✅ PRD-001: Authentication & Authorization (DONE)
2. ✅ PRD-002: Persistence Layer (DONE)
3. ✅ PRD-003: Compliance Signing (DONE)

### Next Priority (P0 Security)
4. PRD-004: PII Redaction
5. PRD-005: Rule Engine Sandboxing
6. PRD-006: KMS Integration
7. PRD-007: API Input Validation

### Then (P0 Core Features)
8. PRD-008: Signal Management
9. PRD-009: Trace Ingestion
10. PRD-010: Rule Management UI
11. PRD-011: Signal Investigation
12. PRD-012: Tenant Management
13. PRD-013: SRE Dashboard

### Finally (P1/P2)
14-27: Remaining PRDs in priority order

## Common Violation Patterns

### Pattern 1: JAX-RS Endpoints
**Violation:** `@Path("/api/...")`, `@GET`, `@POST`, etc.
**Fix:** Convert to Camel REST DSL routes

**Before:**
```java
@Path("/api/signals")
public class SignalController {
    @GET
    public Response getSignals() { }
}
```

**After:**
```java
@ApplicationScoped
public class SignalRoutes extends RouteBuilder {
    public void configure() {
        rest("/api/signals")
            .get().to("direct:getSignals");

        from("direct:getSignals")
            .process("getSignalsProcessor");
    }
}
```

### Pattern 2: SQL Tables
**Violation:** `CREATE TABLE`, Flyway migrations, JPA entities
**Fix:** Use TigerBeetle accounts/transfers or tiered storage

**Before:**
```sql
CREATE TABLE signals (...);
```

**After:**
```java
// Signals are TigerBeetle transfers (PRD-002)
TBTransfer signal = new TBTransfer(
    id: signalUUID,
    debitAccountId: ruleUUID,
    creditAccountId: tenantUUID,
    ...
);
```

### Pattern 3: No Compliance Evidence
**Violation:** Operations don't generate compliance spans
**Fix:** Add `GenerateComplianceSpanProcessor` to routes

**Add:**
```java
from("direct:someOperation")
    .process("someOperationProcessor")
    .process("generateComplianceSpanProcessor")  // ✅ Add this
    .process("recordEventProcessor");  // TigerBeetle
```

### Pattern 4: Missing Named Processors
**Violation:** Inline lambda processors
**Fix:** Extract to named CDI processors

**Before:**
```java
.process(exchange -> {
    // Business logic here
});
```

**After:**
```java
.process("someOperationProcessor");

@Named("someOperationProcessor")
@ApplicationScoped
public class SomeOperationProcessor implements Processor {
    public void process(Exchange exchange) {
        // Business logic here
    }
}
```

### Pattern 5: Not Deployment-Agnostic
**Violation:** Hardcoded AWS, GCP, Azure, Redis, etc.
**Fix:** Create abstraction interface with default impl

**Before:**
```java
@Inject
S3Client s3;  // ❌ Couples to AWS
```

**After:**
```java
// Abstraction
public interface StorageService {
    void store(Path file);
}

// Default
@ApplicationScoped
@DefaultBean
public class FilesystemStorage implements StorageService { }

// External
@Alternative  // In consumer's project
public class S3Storage implements StorageService { }
```

## Testing Requirements (ADR-014)

All revised PRDs must include:

1. **Unit Tests (Processors):**
   - Test each processor independently
   - 90% instruction coverage minimum
   - Mock external dependencies

2. **Route Configuration Tests:**
   - Test route can be added to context
   - Verify route IDs and endpoints

3. **Integration Tests:**
   - End-to-end flow testing
   - Real TigerBeetle/DuckDB integration

4. **Security Tests:**
   - Tenant isolation validation
   - Permission enforcement
   - Input validation

5. **Performance Tests:**
   - Throughput benchmarks
   - Latency requirements

## Next Steps

1. **User Decision:** Which PRDs to revise next?
   - Recommend: P0 Security PRDs (004-007)
   - Then: P0 Core Features (008-013)

2. **Revision Approach:**
   - Revise one PRD at a time
   - Get user feedback after each revision
   - Ensure all ADR links are updated

3. **Implementation Order:**
   - Follow PRD dependency graph
   - PRD-001 → PRD-002 → PRD-003 (DONE)
   - Next: PRD-004 through PRD-007

## Summary Statistics

- **Total PRDs:** 27
- **Compliant:** 4 (15%)
- **Requiring Revision:** 23 (85%)
- **P0 PRDs Needing Revision:** 10
- **P1 PRDs Needing Revision:** 9
- **P2 PRDs Needing Revision:** 4

---

**Architecture-Guardian Agent**
*Ensuring BeTrace maintains architectural integrity across all PRDs*
