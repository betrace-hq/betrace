# PRD-015 Unit PRD Summary

**Parent PRD:** PRD-015 (Compliance Evidence Dashboard)
**Total Units:** 6 (A-F)
**Status:** Split into independently implementable units

## Overview

PRD-015 (Compliance Evidence Dashboard) has been split into 6 independently implementable unit PRDs. Each unit can be developed, tested, and deployed independently, with clear dependencies between units.

## Unit Breakdown

### Unit A: Query Infrastructure
**File:** `015a-query-infrastructure.md`
**Dependencies:** None (Foundation)
**Priority:** P1

**Scope:**
- Camel REST routes for compliance queries
- Query parameter parsing and validation processors
- Query filter model and request/response models
- Basic route configuration and error handling

**Key Deliverables:**
- `ComplianceQueryRoutes.java` - REST API routes
- `ParseComplianceQueryParametersProcessor.java` - Parse query params
- `ValidateQueryParametersProcessor.java` - Validate query params
- `ComplianceQueryFilter.java` - Query filter model
- `ComplianceSpanRecord.java` - Response model

**Success Criteria:**
- REST endpoint `/api/compliance/evidence/query` responds with 200 OK
- Query parameters parsed correctly
- Invalid parameters return 400 Bad Request
- 90% test coverage

---

### Unit B: Hot/Cold Storage Query Processors
**File:** `015b-storage-queries.md`
**Dependencies:** Unit A (Query Infrastructure)
**Priority:** P1

**Scope:**
- Query hot storage (DuckDB 0-7 days)
- Query cold storage (Parquet 7-365 days)
- Merge and sort results from both storage tiers
- Integrate with ADR-015 tiered storage architecture

**Key Deliverables:**
- `DuckDBService.java` - Hot storage query service
- `ColdStorageService.java` - Cold storage interface
- `FilesystemColdStorage.java` - Parquet file listing
- `QueryDuckDBComplianceProcessor.java` - Query hot storage
- `QueryColdStorageComplianceProcessor.java` - Query cold storage
- `MergeComplianceResultsProcessor.java` - Merge results
- `SortAndLimitResultsProcessor.java` - Sort and limit

**Success Criteria:**
- Query hot storage (DuckDB) for compliance spans
- Query cold storage (Parquet) for compliance spans
- Merge results from both storage tiers
- Query response time <1 second for 7-day range
- Query response time <5 seconds for 30-day range
- 90% test coverage

---

### Unit C: Signature Verification Integration
**File:** `015c-signature-verification.md`
**Dependencies:** Unit B (Storage Queries), PRD-003 (Compliance Signing)
**Priority:** P1

**Scope:**
- Verify cryptographic signatures for compliance spans
- Display signature verification status in query results
- Handle spans without signatures (legacy spans)
- Handle verification failures gracefully

**Key Deliverables:**
- `ComplianceSpanVerificationRequest.java` - Verification request model
- `VerificationResult.java` - Verification result model
- `VerifyComplianceSignaturesProcessor.java` - Signature verification

**Success Criteria:**
- Verify cryptographic signatures for compliance spans
- Display signature verification status (valid, invalid, N/A)
- Signature verification <100ms per span
- Integration with PRD-003 `direct:verifyComplianceSpan` route
- 90% test coverage

---

### Unit D: Export Functionality
**File:** `015d-export-functionality.md`
**Dependencies:** Unit C (Signature Verification)
**Priority:** P1

**Scope:**
- Export compliance spans to CSV format
- Export compliance spans to JSON format
- Include signature verification status in exports
- Provide download endpoint for audit reports

**Key Deliverables:**
- `ComplianceExportRequest.java` - Export request model
- `FormatComplianceCSVProcessor.java` - CSV formatter
- `ParseComplianceExportRequestProcessor.java` - Export request parser
- Export routes in `ComplianceQueryRoutes.java`

**Success Criteria:**
- Export compliance spans to CSV format
- Export compliance spans to JSON format
- CSV properly escapes commas, quotes, newlines
- Export response time <10 seconds for 10,000 spans
- Export handles large result sets (up to 100,000 spans)
- 90% test coverage

---

### Unit E: Compliance Metrics and Dashboard
**File:** `015e-metrics-dashboard.md`
**Dependencies:** Unit B (Storage Queries) - can be parallel with Unit D
**Priority:** P1

**Scope:**
- Calculate compliance metrics (span counts, control coverage)
- Calculate signature verification rate
- Calculate control coverage for frameworks
- Provide dashboard API endpoints

**Key Deliverables:**
- `ComplianceMetrics.java` - Metrics model
- `FrameworkMetrics.java` - Framework metrics model
- `ControlCoverage.java` - Control coverage model
- `CalculateComplianceMetricsProcessor.java` - Metrics calculation
- `CalculateControlCoverageProcessor.java` - Coverage calculation
- Metrics routes in `ComplianceQueryRoutes.java`

**Success Criteria:**
- Calculate compliance metrics (span counts by framework)
- Calculate control coverage (which controls have evidence)
- Calculate signature verification rate
- Metrics endpoint: `GET /api/compliance/metrics/{tenantId}`
- Coverage endpoint: `GET /api/compliance/coverage/{tenantId}/{framework}`
- Response time <1 second for metrics calculation
- 90% test coverage

---

### Unit F: Frontend UI
**File:** `015f-frontend-ui.md`
**Dependencies:** Units A, B, C, D, E (all backend units)
**Priority:** P1

**Scope:**
- Compliance evidence page with filters
- Compliance evidence table with signature badges
- Export buttons (CSV and JSON)
- Compliance metrics dashboard
- Control coverage visualization

**Key Deliverables:**
- `bff/src/routes/compliance/evidence.tsx` - Evidence page
- `bff/src/routes/compliance/metrics.tsx` - Metrics dashboard
- `bff/src/components/compliance/compliance-evidence-table.tsx` - Evidence table
- `bff/src/components/compliance/compliance-filters.tsx` - Filter UI
- `bff/src/components/compliance/export-buttons.tsx` - Export buttons
- `bff/src/lib/api/compliance.ts` - API client

**Success Criteria:**
- Compliance evidence page renders with filters
- Evidence table displays compliance spans
- Signature verification status shown (Verified, Invalid, N/A)
- Export CSV and JSON buttons work
- Compliance metrics dashboard renders
- Framework breakdown and control coverage displayed
- Responsive design (mobile, tablet, desktop)
- 90% test coverage

---

## Dependency Graph

```
Unit A (Query Infrastructure)
    ↓
Unit B (Storage Queries)
    ↓
Unit C (Signature Verification)
    ↓
Unit D (Export Functionality)

Unit B (Storage Queries)
    ↓
Unit E (Metrics Dashboard) [parallel with D]

Units A, B, C, D, E
    ↓
Unit F (Frontend UI)
```

## Implementation Order

**Recommended implementation order:**

1. **Unit A** - Query Infrastructure (Foundation)
2. **Unit B** - Storage Queries (Core functionality)
3. **Unit C** - Signature Verification (Security)
4. **Unit D + Unit E** - Export + Metrics (Parallel development)
5. **Unit F** - Frontend UI (Depends on all backend)

**Estimated Timeline:**
- Unit A: 2-3 days
- Unit B: 3-4 days
- Unit C: 2-3 days
- Unit D: 2-3 days
- Unit E: 2-3 days (parallel with D)
- Unit F: 4-5 days
- **Total:** 15-21 days (3-4 weeks)

## Testing Requirements

All units must achieve **90% test coverage** per ADR-014:
- Unit tests for all processors
- Integration tests for routes
- End-to-end tests for complete workflows
- Tenant isolation tests
- Performance tests (query response times)

## Architecture Compliance

All units comply with:
- **ADR-011:** Pure Application Framework (deployment-agnostic)
- **ADR-012:** Mathematical Tenant Isolation (per-tenant DuckDB/Parquet)
- **ADR-013:** Apache Camel-First Architecture (REST routes + processors)
- **ADR-014:** Camel Testing and Organization Standards (90% coverage)
- **ADR-015:** Tiered Storage Architecture (DuckDB hot + Parquet cold)

## Integration Points

**PRD-003 Integration (Unit C):**
- Signature verification via `direct:verifyComplianceSpan` route
- `VerificationResult` model for verification status

**ADR-015 Integration (Unit B):**
- DuckDB hot storage queries (0-7 days)
- Parquet cold storage queries (7-365 days)
- Unified query results via merge processor

**TigerBeetle Integration (All Units):**
- Audit logging for query operations (code=8)
- Audit logging for export operations (code=8)

## File Summary

**Backend Files Created:** 30+ files
- 1 Camel route file
- 12 processor files
- 8 model files
- 3 service files
- 15+ test files

**Frontend Files Created:** 8+ files
- 2 page files
- 3 component files
- 1 API client file
- 2+ test files

**Backend Files Modified:** 2 files
- `ComplianceQueryRoutes.java` (progressive updates)
- `application.properties` (configuration)

**Frontend Files Modified:** 1 file
- `header.tsx` (navigation link)

## Success Metrics

**Performance:**
- Query 7-day range: <1 second
- Query 30-day range: <5 seconds
- Export 10,000 spans: <10 seconds
- Signature verification: <100ms per span
- Metrics calculation: <1 second

**Quality:**
- 90% test coverage (ADR-014)
- Zero security vulnerabilities
- Full tenant isolation (ADR-012)
- Responsive UI (mobile, tablet, desktop)

**Functionality:**
- Query compliance spans by framework, control, date range
- Export to CSV and JSON with signature verification
- Display compliance metrics and control coverage
- Integrate with PRD-003 signature verification
- Unified hot/cold storage queries (ADR-015)

## Next Steps

1. Review unit PRDs with team
2. Assign units to developers
3. Begin with Unit A (foundation)
4. Implement units in dependency order
5. Conduct integration testing after Unit C
6. Deploy incrementally as units complete
