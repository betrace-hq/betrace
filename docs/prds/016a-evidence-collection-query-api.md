# PRD-016a: Evidence Collection Query API

**Status:** Draft
**Priority:** P0
**Dependencies:** None
**Relates To:** PRD-016b (consumers this API), PRD-016c (consumers this API)

## Problem Statement

External auditors and compliance officers need structured access to compliance evidence (spans and signals) for SOC2/HIPAA audits. Currently:
- Manual querying of TigerBeetle ledger for raw data
- Manual correlation of traces across systems
- No structured coverage metrics
- Time-consuming evidence collection (40-80 hours per audit)

## Solution

Build a REST API that queries compliance spans by framework, controls, and time range with:
- Tenant-isolated evidence access
- Signal correlation for violations
- Coverage metrics calculation
- PII redaction enforcement
- Audit trail for all queries

### API Endpoints

```java
@Path("/api/v1/evidence")
@Authenticated
@RolesAllowed({"compliance_officer", "auditor"})
public class EvidenceQueryResource {

    @POST
    @Path("/query")
    public EvidenceQueryResponse queryEvidence(EvidenceQueryRequest request) {
        // Query compliance spans by framework, controls, time range
        // Correlate signals for violations
        // Return structured JSON with coverage metrics
    }
}
```

### Request Model

```java
@Data
public class EvidenceQueryRequest {
    Framework framework;           // SOC2, HIPAA
    List<String> controls;         // ["CC6_1", "CC6_2"]
    Instant startTime;
    Instant endTime;
    String tenantId;               // Set by server
    boolean includeSignals;
    boolean includeTraceContext;
}
```

### Response Model

```java
@Data
public class EvidenceQueryResponse {
    String queryId;
    List<ControlEvidence> controls;
    int totalSpans;
    int totalSignals;
    QueryMetadata metadata;
}

@Data
public class ControlEvidence {
    String control;
    String description;
    int evidenceCount;
    List<ComplianceSpanSummary> spans;
    List<SignalSummary> signals;
    CoverageMetrics coverage;      // days with evidence / total days
}
```

## Acceptance Criteria

- **AC1**: Query SOC2 CC6.1 returns all spans with control=CC6_1
- **AC2**: Time range filter includes only spans in range
- **AC3**: Tenant isolation enforced (403 for other tenants)
- **AC4**: includeSignals=true correlates signals to controls
- **AC5**: Coverage metrics calculate correctly
- **AC6**: PII redaction applied unless user has pii_access role
- **AC7**: Pagination works with nextPageToken
- **AC8**: Query response time < 2 seconds (p95) for 10K spans

## Security Requirements

- **Authentication**: JWT token required
- **Authorization**: Role-based (compliance_officer, auditor, compliance_admin)
- **Tenant Isolation**: WHERE tenant_id = authenticated_tenant
- **PII Redaction**: @Redact annotations applied
- **Audit Trail**: Log all evidence queries

## Performance Requirements

- Query latency: < 2 seconds (p95) for 10K spans
- Throughput: 100 queries/minute per tenant
- Database indexes: (tenant_id, framework, control, timestamp)

## Test Requirements

- **Unit**: 15 tests (query builder, filtering, correlation)
- **Integration**: 10 tests (end-to-end, tenant isolation)
- **Security**: 5 tests (PII redaction, cross-tenant access)
- **Performance**: 3 tests (10K spans, concurrent load)

## Dependencies

- TigerBeetle ledger for compliance spans
- TenantContext for tenant isolation
- ComplianceSpanRepository
- AuditLogger
