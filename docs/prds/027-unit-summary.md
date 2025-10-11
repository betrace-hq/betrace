# PRD-027 Unit Breakdown Summary

**Parent PRD:** PRD-027 (Advanced Query Language for Signal Search)
**Total Units:** 5 (A through E)
**Total Timeline:** 5 weeks (1 week per unit)

## Unit Overview

### Unit A: Core Query Infrastructure (Week 1)
**File:** `027a-core-query-infrastructure.md`
**Dependencies:** None (foundation)
**Scope:** Backend query execution pipeline

**Key Components:**
- Camel route: `SignalQueryRoute.java`
- 5 Named processors:
  - `ParseQueryRequestProcessor`
  - `ValidateSqlQueryProcessor`
  - `InjectTenantIsolationProcessor`
  - `ExecuteHotStorageQueryProcessor`
  - `FormatQueryResultsProcessor`
- `DuckDBQueryService` - Query execution on hot storage
- Request/Response models: `SignalQueryRequest`, `SignalQueryResponse`

**Success Criteria:**
- REST API endpoint `/api/signals/query` works
- SQL injection blocked
- Tenant isolation enforced
- Query execution on DuckDB functional

---

### Unit B: Saved Queries (Week 2)
**File:** `027b-saved-queries.md`
**Dependencies:** Unit A (requires query execution infrastructure)
**Scope:** Save and manage reusable queries

**Key Components:**
- Models: `SavedQuery`, `SavedQueryRequest`
- Service: `SavedQueryService` (in-memory storage)
- 6 Named processors:
  - `StoreSavedQueryProcessor`
  - `LoadSavedQueriesProcessor`
  - `GetSavedQueryProcessor`
  - `LoadSavedQueryProcessor`
  - `UpdateExecutionCountProcessor`
  - `DeleteSavedQueryProcessor`
- Camel routes: save, list, get, execute, delete

**Success Criteria:**
- Users can save queries
- Saved queries listed and retrieved
- Saved queries can be executed
- Execution count tracked

---

### Unit C: Frontend Query UI (Week 3)
**File:** `027c-frontend-query-ui.md`
**Dependencies:** Units A, B (requires backend APIs)
**Scope:** React UI for query execution

**Key Components:**
- `SignalQueryPage.tsx` - Main query interface
- `signal-query.ts` - API client
- `signal-query.ts` - TypeScript types
- Features:
  - SQL editor (Textarea)
  - Query execution with loading states
  - Results table
  - Saved queries sidebar
  - Example queries
  - Save query dialog

**Success Criteria:**
- Users can write and execute SQL queries
- Results displayed in table
- Saved queries accessible
- Error messages shown clearly

---

### Unit D: Performance Optimization (Week 4)
**File:** `027d-performance-optimization.md`
**Dependencies:** Units A, B, C (optimizes existing functionality)
**Scope:** Query performance and resilience

**Key Components:**
- `QueryCacheService` - In-memory result caching (60s TTL)
- `QueryRateLimitService` - 10 queries/minute per tenant
- `QueryCostEstimator` - Reject expensive queries
- 4 Named processors:
  - `CheckQueryCacheProcessor`
  - `CacheQueryResultProcessor`
  - `CheckRateLimitProcessor`
  - `EstimateQueryCostProcessor`
- DuckDB indexes on frequently queried fields
- OpenTelemetry metrics

**Success Criteria:**
- Query cache reduces time by 90%
- Rate limiting enforced
- Expensive queries rejected
- Indexes improve speed by 50%

---

### Unit E: Documentation & Polish (Week 5)
**File:** `027e-documentation-polish.md`
**Dependencies:** Units A-D (documents complete system)
**Scope:** Documentation and UX enhancements

**Key Components:**
- Documentation:
  - `signal-query-api.md` - API documentation
  - `signal-queries.md` - User guide
  - `query-errors.md` - Error catalog
- UI Enhancements:
  - `SqlEditor.tsx` - Monaco editor integration
  - `QueryHistory.tsx` - Last 10 queries
  - Field autocomplete
- Video tutorial (5-10 minutes)

**Success Criteria:**
- Complete API documentation
- User guide published
- Monaco editor integrated
- Video tutorial recorded

---

## Dependency Graph

```
Unit A (Core Query Infrastructure)
    ↓
Unit B (Saved Queries) ← depends on Unit A
    ↓
Unit C (Frontend Query UI) ← depends on Units A, B
    ↓
Unit D (Performance Optimization) ← depends on Units A, B, C
    ↓
Unit E (Documentation & Polish) ← depends on all units
```

## Implementation Order

**Sequential implementation required:**
1. Unit A first (foundation)
2. Unit B second (requires Unit A)
3. Unit C third (requires Units A, B)
4. Unit D fourth (optimizes Units A, B, C)
5. Unit E fifth (documents all units)

## File Counts

| Unit | Backend Files | Frontend Files | Test Files | Docs |
|------|---------------|----------------|------------|------|
| A    | 8             | 0              | 4          | 0    |
| B    | 8             | 0              | 5          | 0    |
| C    | 0             | 3              | 2          | 0    |
| D    | 8             | 0              | 4          | 0    |
| E    | 0             | 2              | 0          | 4    |
| **Total** | **24**   | **5**          | **15**     | **4** |

## Test Coverage Requirements

All units must meet ADR-014 standards:
- **90% instruction coverage** minimum
- **80% branch coverage** minimum
- Named processors with comprehensive tests
- Property-based tests for critical security (tenant isolation)

## Security Checklist (All Units)

- [x] **Unit A:** SQL injection prevention, tenant isolation
- [x] **Unit B:** Saved query validation, tenant isolation
- [x] **Unit C:** XSS prevention, secure API calls
- [x] **Unit D:** Rate limiting, cost estimation
- [x] **Unit E:** Secure documentation examples

## Performance Targets

| Metric | Target | Tested In |
|--------|--------|-----------|
| Query execution (1K signals) | <500ms | Unit A |
| Query execution (10K signals) | <3s | Unit A |
| Cached query | <50ms | Unit D |
| Rate limit | 10/minute | Unit D |

## Total Implementation Timeline

| Week | Unit | Focus |
|------|------|-------|
| 1 | A | Core backend infrastructure |
| 2 | B | Saved queries management |
| 3 | C | Frontend UI implementation |
| 4 | D | Performance optimization |
| 5 | E | Documentation and polish |

**Total Duration:** 5 weeks (25 working days)

## Success Metrics

**Unit A:**
- REST API functional
- Security validation passing
- Tenant isolation verified

**Unit B:**
- Saved queries CRUD working
- Execution tracking functional

**Unit C:**
- Query UI complete
- User experience polished

**Unit D:**
- Query performance <1s (1K signals)
- Cache hit rate >80%
- Rate limiting enforced

**Unit E:**
- Complete documentation
- Monaco editor integrated
- Video tutorial published

## Key Deliverables

### Backend (Units A, B, D)
- 1 Camel route file
- 15 named processors
- 3 services (DuckDB, SavedQuery, Cache, RateLimit, CostEstimator)
- 6 model classes
- 13 test files

### Frontend (Units C, E)
- 1 query page component
- 2 UI enhancement components (SqlEditor, QueryHistory)
- 1 API client
- 1 types file
- 2 test files
- 2 Storybook story files

### Documentation (Unit E)
- API documentation
- User guide
- Error catalog
- Video tutorial

## Risk Mitigation

| Risk | Unit | Mitigation |
|------|------|------------|
| SQL injection | A | Multi-layer validation |
| Performance degradation | D | Caching + indexes |
| Tenant data leakage | A | Automatic tenant isolation |
| Feature complexity | All | Incremental unit delivery |

## Architecture Compliance

All units comply with:
- **ADR-011:** Pure Application Framework (no external dependencies)
- **ADR-012:** Mathematical Tenant Isolation (auto-inject tenant_id)
- **ADR-013:** Apache Camel-First Architecture (all APIs as routes)
- **ADR-014:** Named Processors & Testing Standards (90% coverage)
- **ADR-015:** Tiered Storage Architecture (DuckDB hot storage)

## Future Enhancements (Post-MVP)

1. **Custom DSL** - User-friendly query language (2-3 weeks)
2. **Visual Query Builder** - Dropdown-based UI (1 week)
3. **Cold Storage Queries** - Parquet archives (1 week)
4. **Full-Text Search Extension** - DuckDB FTS (3 days)
5. **Query Result Export** - CSV/JSON/Parquet (2 days)
6. **Query Sharing** - Team collaboration (1 week)
