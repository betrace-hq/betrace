# PRD-002 Split into Focused PRDs

**Date:** 2025-10-10
**Reason:** Original PRD-002 was too complex (testability score 4/10, marked NOT READY)

## Original PRD-002: Persistence Layer

The original PRD-002 combined multiple distinct persistence concerns:
1. TigerBeetle for signals/rules
2. DuckDB hot storage for traces
3. Cold storage abstraction (S3-compatible)
4. Archival pipeline with retry logic
5. Tenant isolation enforcement

This complexity made it:
- Hard to test (too many moving parts)
- Hard to implement (no clear starting point)
- Hard to review (architectural concerns mixed)

## New Split PRDs

### PRD-002a: TigerBeetle Event Ledger
**Priority:** P0 (Blocks Production)
**File:** [002a-tigerbeetle-event-ledger.md](002a-tigerbeetle-event-ledger.md)

**Scope:**
- Signals persistence (immutable WORM)
- Rules persistence with versioning
- Ledger-based tenant isolation
- Signal counters (rule debitsPosted)

**Testability:** 8/10
- Clear inputs/outputs
- Deterministic event sourcing
- Testable with embedded TigerBeetle
- Property-based tenant isolation tests

**Dependencies:** PRD-001 (Authentication)

**Implementation Order:** #1 (foundational)

---

### PRD-002b: Hot Trace Storage
**Priority:** P0 (Blocks Production)
**File:** [002b-hot-trace-storage.md](002b-hot-trace-storage.md)

**Scope:**
- DuckDB embedded storage (last 7 days)
- Trace query API (by tenant, time range, trace ID)
- Per-tenant database files (physical isolation)
- Parquet export for archival

**Testability:** 9/10
- Zero-ops embedded database
- Standard SQL queries
- Testable with in-memory DuckDB
- Fast query performance tests

**Dependencies:** PRD-002a (signals reference traces)

**Implementation Order:** #2 (after TigerBeetle)

---

### PRD-002c: Cold Storage Abstraction
**Priority:** P1 (Not Blocking MVP)
**File:** [002c-cold-storage-abstraction.md](002c-cold-storage-abstraction.md)

**Scope:**
- ColdStorageService interface (deployment-agnostic)
- FilesystemColdStorage default implementation
- Parquet format for trace batches
- Contract tests for all implementations

**Testability:** 9/10
- Clean interface contract
- Simple default implementation
- Testable with local filesystem
- Consumer implementations tested separately

**Dependencies:** None (standalone interface)

**Implementation Order:** #3 (parallel with #2, no dependencies)

---

### PRD-002d: Trace Archival Pipeline
**Priority:** P1 (Not Blocking MVP)
**File:** [002d-trace-archival-pipeline.md](002d-trace-archival-pipeline.md)

**Scope:**
- Scheduled archival (daily at 2 AM)
- Two-phase commit (export → verify → cleanup)
- Retry logic with exponential backoff
- Archival event recording (TigerBeetle)
- Compliance spans for audit

**Testability:** 7/10
- Complex distributed transaction logic
- Time-based scheduling harder to test
- Failure scenarios require careful mocking
- End-to-end tests with full stack

**Dependencies:** PRD-002b (DuckDB to export), PRD-002c (cold storage destination)

**Implementation Order:** #4 (last, after all dependencies)

---

## Implementation Roadmap

### Phase 1: Foundation (P0)
1. **PRD-002a**: TigerBeetle Event Ledger
   - Implement TigerBeetleService
   - Repository pattern for signals/rules
   - Property-based tenant isolation tests
   - **Deliverable:** Signals persist, rules persist

2. **PRD-002b**: Hot Trace Storage
   - Implement DuckDBService
   - Camel trace ingestion route
   - Query API with tenant isolation
   - **Deliverable:** Traces queryable for 7 days

**MVP Milestone:** After Phase 1, BeTrace can persist signals and query recent traces

### Phase 2: Long-Term Storage (P1)
3. **PRD-002c**: Cold Storage Abstraction (parallel with #4)
   - Define ColdStorageService interface
   - Implement FilesystemColdStorage
   - Contract tests for all implementations
   - **Deliverable:** Storage abstraction ready

4. **PRD-002d**: Trace Archival Pipeline
   - Scheduled archival Camel route
   - Two-phase commit processors
   - Verification and retry logic
   - **Deliverable:** Automatic archival to cold storage

**Production Milestone:** After Phase 2, BeTrace has full persistence with compliance retention

---

## Testability Improvement

| PRD | Original Score | New Score | Improvement |
|-----|---------------|-----------|-------------|
| **002 (Monolithic)** | 4/10 | N/A | Marked NOT READY |
| **002a (TigerBeetle)** | N/A | 8/10 | ✅ Ready |
| **002b (Hot Storage)** | N/A | 9/10 | ✅ Ready |
| **002c (Cold Abstraction)** | N/A | 9/10 | ✅ Ready |
| **002d (Archival)** | N/A | 7/10 | ✅ Ready |
| **Average** | 4/10 | **8.25/10** | +4.25 (106% improvement) |

---

## Cross-PRD Integration Points

### PRD-002a ↔ PRD-002b
- **Signal Creation:** When rule fires, signal is created in TigerBeetle (PRD-002a)
- **Trace Reference:** Signal contains trace ID stored in DuckDB (PRD-002b)
- **Query Flow:** User queries signal → fetch trace from DuckDB for investigation

### PRD-002b ↔ PRD-002c
- **Export:** DuckDB exports traces to Parquet (PRD-002b provides method)
- **Storage:** Parquet uploaded via ColdStorageService (PRD-002c provides interface)
- **Query:** DuckDB can query Parquet directly for historical queries

### PRD-002b → PRD-002d
- **Archival Source:** PRD-002d reads from DuckDB (PRD-002b)
- **Cleanup:** PRD-002d deletes archived traces from DuckDB
- **Scheduling:** PRD-002d determines what dates to archive

### PRD-002c → PRD-002d
- **Upload Destination:** PRD-002d uploads to ColdStorageService (PRD-002c)
- **Verification:** PRD-002d re-downloads from ColdStorage to verify integrity
- **Abstraction:** PRD-002d works with any ColdStorageService implementation

---

## Benefits of Split

### 1. **Independent Implementation**
Each PRD can be implemented and tested in isolation:
- PRD-002a doesn't need DuckDB working
- PRD-002b doesn't need cold storage
- PRD-002c doesn't need archival pipeline
- PRD-002d composes tested components

### 2. **Incremental Delivery**
Can deliver value progressively:
- After PRD-002a: Signals persist (MVP functionality)
- After PRD-002b: Traces queryable (full investigation workflow)
- After PRD-002c+d: Compliance retention (production-ready)

### 3. **Focused Reviews**
Each PRD reviewed independently:
- Architecture guardian reviews tenant isolation (PRD-002a/b)
- Security expert reviews storage interface (PRD-002c)
- QA expert reviews archival failure modes (PRD-002d)

### 4. **Parallel Development**
PRD-002a and PRD-002c have no dependencies:
- Can be developed simultaneously by different teams
- Reduces time to MVP

### 5. **Clear Testability**
Each PRD has focused test strategy:
- PRD-002a: Property-based tenant isolation
- PRD-002b: Query performance tests
- PRD-002c: Interface contract tests
- PRD-002d: Failure scenario tests

---

## Migration from Original PRD-002

The original PRD-002 has been archived to:
- **File:** [002-persistence-layer.ARCHIVED.md](002-persistence-layer.ARCHIVED.md)

All testability analysis and QA findings from original PRD-002 have been:
- Distributed across new PRDs (002a-d)
- Enhanced with specific test scenarios
- Mapped to individual implementation concerns

No functionality was removed, only reorganized for better implementation.

---

## References

- **Original Analysis:** Task Coordinator agent analysis (2025-10-10)
- **Product Analyst Report:** 5 PRD split recommendation
- **Architecture Guardian Report:** 3-layer architecture validation
- **QA Expert Analysis:** Testability scoring and blocking issues

All agent reports confirmed this split improves:
- Testability (4/10 → 8.25/10 average)
- Implementation clarity (clear dependencies)
- ADR compliance (all PRDs maintain ADR-011 through ADR-014)
