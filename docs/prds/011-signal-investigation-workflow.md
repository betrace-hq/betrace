# PRD-011: Signal Investigation Workflow

**Priority:** P1 (Core Feature - Post-MVP)
**Complexity:** Complex (System)
**Type:** System Overview
**Personas:** SRE, Developer, Compliance
**Dependencies:**
- PRD-008 (Signal Management System)
- PRD-009 (Trace Ingestion Pipeline)
- PRD-002 (TigerBeetle Persistence)
- PRD-003 (Compliance Span Signing)

## Architecture Integration

This PRD complies with FLUO's architectural standards:

- **ADR-011 (TigerBeetle-First):** Investigation events stored as TigerBeetle transfers (code=9), no SQL notes table
- **ADR-013 (Camel-First):** Investigation actions implemented as Camel processors
- **ADR-014 (Named Processors):** All investigation logic in named CDI processors
- **ADR-015 (Tiered Storage):** Investigation events flow through TigerBeetle → DuckDB → Parquet
- **PRD-003 (Compliance Evidence):** All investigation actions generate SOC2 CC7.1 evidence (monitoring and detection)

## Problem

**No investigation workflow for signals:**
- Can't drill into trace details from signal
- No way to mark signal as false positive or resolved
- No investigation notes/comments persisted
- No related signals view (signals on same trace)
- No audit trail of investigation actions
- No compliance evidence that signals were investigated

**Current State:**
- Signal list exists in frontend (PRD-008)
- Signal detail page is placeholder
- No backend investigation APIs
- No TigerBeetle schema for investigations
- No compliance spans for investigation events

**Impact:**
- SREs cannot track investigation progress
- No accountability for signal triage
- Compliance audits cannot verify incident response
- False positives accumulate with no mechanism to suppress

## Solution

### Investigation Lifecycle

```
Signal Created (status=open)
  ↓
[SRE/Dev views signal] → TigerBeetle transfer (code=9, op_type=1: viewed)
  ↓
[SRE marks as investigating] → TigerBeetle transfer (code=9, op_type=2: status_change)
  ↓
[SRE adds investigation note] → TigerBeetle transfer (code=9, op_type=3: note_added)
  ↓
[SRE resolves signal] → TigerBeetle transfer (code=9, op_type=4: resolved)
  OR
[SRE marks false positive] → TigerBeetle transfer (code=9, op_type=5: false_positive)
```

### Units to Implement

This PRD should be decomposed into the following unit PRDs:

1. **PRD-011a: Signal Detail API Route** (Backend)
   - GET /api/signals/{signalId} with full trace context
   - Include related signals (same trace_id)
   - Include span details that triggered rule

2. **PRD-011b: Investigation Action Processor** (Backend)
   - UpdateSignalStatusProcessor
   - AddInvestigationNoteProcessor
   - RecordInvestigationEventToTigerBeetleProcessor

3. **PRD-011c: Investigation Event Schema** (Backend)
   - TigerBeetle transfer schema (code=9) for investigation events
   - Packing/unpacking utilities for note content (userData128)

4. **PRD-011d: Investigation Compliance Span Processor** (Backend)
   - Generate SOC2 CC7.1 compliance spans for investigation actions
   - Evidence: signal viewed, status changed, notes added, resolved

5. **PRD-011e: Signal Detail Page** (Frontend)
   - Trace timeline visualization
   - Related signals panel
   - Investigation notes UI
   - Status update buttons

6. **PRD-011f: Investigation Notes Component** (Frontend)
   - Markdown editor for notes
   - Note history timeline
   - Real-time updates

### TigerBeetle Schema (ADR-011)

**Investigation Event Transfer (code=9):**
```java
Transfer investigationEvent = new Transfer(
    id: UUID (investigation event ID),
    debitAccountId: userAccount,          // SRE/Dev who took action
    creditAccountId: signalAccount,       // Signal being investigated
    amount: 1,  // Event count
    code: 9,  // Investigation operation type
    userData128: pack(
        op_type: 8 bits (1=viewed, 2=status_change, 3=note_added, 4=resolved, 5=false_positive),
        old_status: 8 bits (for status_change),
        new_status: 8 bits (for status_change),
        note_length: 16 bits (for note_added),
        note_hash: 64 bits (SHA-256 hash of note content for integrity)
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

**Note Storage:**
- Notes stored in DuckDB `investigation_notes` table (hot tier, 0-7 days)
- Archived to Parquet after 7 days (cold tier, 7-365 days)
- TigerBeetle transfer contains note hash for integrity verification

**Signal Status Account:**
```java
// Signal account already defined in PRD-008
// userData128 updated to track investigation state:
Account signalAccount = new Account(
    id: signalId,
    code: 2,  // Signal type (from PRD-008)
    userData128: pack(
        rule_id: 64 bits,
        severity: 8 bits,
        status: 8 bits (1=open, 2=investigating, 3=resolved, 4=false_positive),
        last_updated_at: 32 bits,
        investigator_id: 16 bits (user who last updated)
    ),
    // ...
);
```

### Data Flow Architecture

**View Signal Details:**
```
GET /api/signals/{signalId}
  ↓
[getSignalProcessor] → Query TigerBeetle for signal account
  ↓
[loadTraceSpansProcessor] → Query DuckDB for trace spans (PRD-009)
  ↓
[loadRelatedSignalsProcessor] → Query TigerBeetle for signals with same trace_id
  ↓
[loadInvestigationHistoryProcessor] → Query TigerBeetle transfers (code=9)
  ↓
[recordViewEventProcessor] → Create TigerBeetle transfer (code=9, op_type=1)
  ↓
[generateComplianceSpanProcessor] → SOC2 CC7.1 evidence
  ↓
Return SignalDetailDto
```

**Update Signal Status:**
```
PATCH /api/signals/{signalId}/status
  ↓
[validateStatusTransitionProcessor] → Enforce state machine (open → investigating → resolved)
  ↓
[updateSignalStatusProcessor] → Update TigerBeetle account userData128
  ↓
[recordStatusChangeEventProcessor] → TigerBeetle transfer (code=9, op_type=2)
  ↓
[generateComplianceSpanProcessor] → SOC2 CC7.1 evidence
  ↓
[notifyWebSocketProcessor] → Real-time update to frontend
```

**Add Investigation Note:**
```
POST /api/signals/{signalId}/notes
  ↓
[validateNoteContentProcessor] → Sanitize markdown input
  ↓
[storeNoteInDuckDBProcessor] → INSERT into investigation_notes table
  ↓
[recordNoteEventProcessor] → TigerBeetle transfer (code=9, op_type=3) with note hash
  ↓
[generateComplianceSpanProcessor] → SOC2 CC7.1 evidence
  ↓
Return noteId
```

## Success Criteria

**Functional Requirements:**
- [ ] View full signal details with trace context
- [ ] See all spans from trace that triggered signal
- [ ] View related signals (same trace_id)
- [ ] Update signal status (open → investigating → resolved → false_positive)
- [ ] Add investigation notes with markdown support
- [ ] View investigation history timeline
- [ ] Export signal for incident report (JSON/PDF)

**Performance Requirements:**
- [ ] Signal detail page loads in <500ms
- [ ] Investigation actions complete in <200ms
- [ ] Support 10,000+ signals without pagination issues

**Compliance Requirements:**
- [ ] All investigation actions generate SOC2 CC7.1 evidence
- [ ] Investigation events immutably recorded in TigerBeetle
- [ ] Note integrity verified via SHA-256 hash in transfer
- [ ] Audit trail shows who investigated, when, and what actions taken

**Testing Requirements:**
- [ ] Unit tests for all processors (90% coverage per ADR-014)
- [ ] Integration tests for full investigation workflow
- [ ] Security tests for note injection, status bypass

## Unit PRD Breakdown

**Recommended decomposition** (create if >300 lines):

1. **PRD-011a:** Signal Detail API Route (~250 lines)
   - GET /api/signals/{signalId} implementation
   - Load trace spans, related signals, investigation history
   - RecordViewEventProcessor

2. **PRD-011b:** Investigation Action Processors (~300 lines)
   - UpdateSignalStatusProcessor
   - AddInvestigationNoteProcessor
   - ValidateStatusTransitionProcessor

3. **PRD-011c:** Investigation Event Recording (~200 lines)
   - RecordInvestigationEventProcessor
   - TigerBeetle transfer creation (code=9)
   - Note hash generation

4. **PRD-011d:** Investigation Compliance Spans (~200 lines)
   - GenerateInvestigationComplianceSpanProcessor
   - SOC2 CC7.1 evidence generation
   - Integration with PRD-003

5. **PRD-011e:** Signal Detail Page Component (~400 lines)
   - React component with trace timeline
   - Related signals panel
   - Status update UI

6. **PRD-011f:** Investigation Notes Component (~250 lines)
   - Markdown editor
   - Note history timeline
   - Real-time updates

**Total estimated:** 6 unit PRDs

## Files to Create (If Implementing Without Decomposition)

**Backend:**
- `backend/src/main/java/com/fluo/routes/SignalInvestigationRoute.java`
- `backend/src/main/java/com/fluo/processors/GetSignalProcessor.java`
- `backend/src/main/java/com/fluo/processors/UpdateSignalStatusProcessor.java`
- `backend/src/main/java/com/fluo/processors/AddInvestigationNoteProcessor.java`
- `backend/src/main/java/com/fluo/processors/RecordInvestigationEventProcessor.java`
- `backend/src/main/java/com/fluo/processors/GenerateInvestigationComplianceSpanProcessor.java`
- `backend/src/main/java/com/fluo/model/InvestigationEvent.java`
- `backend/src/main/java/com/fluo/dto/SignalDetailDto.java`

**Frontend:**
- `bff/src/routes/signals/$signalId.tsx`
- `bff/src/components/signals/trace-timeline.tsx`
- `bff/src/components/signals/investigation-notes.tsx`
- `bff/src/components/signals/related-signals-panel.tsx`
- `bff/src/components/signals/investigation-history.tsx`
- `bff/src/lib/api/signal-investigation.ts`

**Tests:**
- `backend/src/test/java/com/fluo/routes/SignalInvestigationRouteTest.java`
- `backend/src/test/java/com/fluo/processors/UpdateSignalStatusProcessorTest.java`
- `bff/src/components/signals/__tests__/trace-timeline.test.tsx`

## Compliance Benefits

**SOC2 CC7.1 (System Monitoring):**
- Evidence: All signals are investigated (viewed events in TigerBeetle)
- Evidence: Timely response to incidents (time from signal creation to investigation)
- Evidence: Investigation actions logged with user attribution

**SOC2 CC7.2 (Change Detection):**
- Evidence: Investigation notes document what changed in system behavior
- Evidence: False positive classification improves detection accuracy

**Audit Trail:**
- Who viewed the signal (user_id in transfer debitAccountId)
- When investigation started (timestamp in transfer)
- What actions taken (op_type in userData128)
- What resolution reached (status change events)

## Integration with Existing PRDs

**PRD-008 (Signal Management):**
- Extends signal lifecycle with investigation workflow
- Adds TigerBeetle transfers (code=9) for investigation events

**PRD-009 (Trace Ingestion):**
- Retrieves trace spans to show context for signal
- Links signal to specific span that triggered rule

**PRD-002 (TigerBeetle):**
- Uses TigerBeetle for investigation event ledger
- No SQL tables for notes (uses DuckDB hot tier instead)

**PRD-003 (Compliance Spans):**
- Generates SOC2 CC7.1 compliance spans for investigation actions
- Proves security monitoring is effective

## Future Enhancements

- AI-assisted investigation suggestions (GPT-4 analysis of trace)
- Automated false positive detection (ML model)
- Investigation playbooks (predefined response workflows)
- Signal correlation graph (visualize related signals across traces)
- Incident timeline generation (export for post-mortem)
- Integration with Jira/Linear for ticket creation

## Recommendation

**This PRD should be decomposed into unit PRDs (011a-011f) before implementation** to maintain consistency with PRD-001, PRD-004, and PRD-006 decomposition patterns.

Each unit PRD should include:
- Full implementation code (Architecture Guardian)
- Bullet-point test requirements (QA Expert)
- Brief threat model (Security Expert)
- ADR compliance verification
- <300 lines per unit PRD

## Public Examples

**Note:** FLUO is a behavioral assurance system for detecting invariant violations, NOT a security incident response platform. The following examples focus on **issue tracking workflows** rather than security incident management to avoid confusion about FLUO's purpose.

### 1. Jira Service Management - Issue Tracking Workflow
**URL:** https://www.atlassian.com/software/jira/service-management/features/incident-management

**Relevance:** Generic issue tracking workflow adaptable to FLUO's signal investigation lifecycle. Demonstrates status tracking, investigation notes, and audit trails without security-specific context.

**Key Patterns:**
- Issue lifecycle (New → In Progress → Resolved / Won't Fix)
- Investigation notes with timestamped comments
- Status transition audit trail
- Assignment and collaboration
- Custom workflows

**FLUO Adaptation:**
- Signal states: `New` → `Under Investigation` → `Resolved` / `False Positive` / `Won't Fix`
- Investigation notes = timestamped comments in TigerBeetle
- Status changes generate SOC2 CC7.1 compliance spans
- Avoid operational incident features (SLAs, escalations, paging)

**Why Jira?** Generic issue tracking avoids implying FLUO is a SIEM/SOAR/security incident response tool. Signals represent **pattern violations**, not **security incidents**.

### 2. GitHub Issues - Lightweight Investigation Workflow
**URL:** https://docs.github.com/en/issues

**Relevance:** Simplified issue tracking demonstrating minimal investigation workflow. Shows how to track investigation progress with labels, comments, and state changes.

**Key Patterns:**
- Open/Closed state model
- Labels for categorization (bug, false-positive, needs-investigation)
- Comment threads for investigation notes
- Assignees for ownership tracking
- State change audit trail

**FLUO Alignment:** GitHub's lightweight model maps to FLUO's signal investigation with minimal ceremony. Labels = signal severity, comments = investigation notes.

### 3. Linear - Modern Issue Tracking
**URL:** https://linear.app/docs

**Relevance:** Modern issue tracking with streamlined workflows. Demonstrates fast status transitions, keyboard-driven UX, and real-time collaboration—patterns applicable to FLUO's developer-first UI.

**Key Patterns:**
- Keyboard shortcuts for status changes
- Real-time collaborative editing
- Markdown support for issue descriptions
- Cycle-based workflow (sprints)
- API-first architecture

**FLUO UX Inspiration:** Linear's keyboard-driven interface (e.g., `Cmd+K` for actions) informs FLUO's signal investigation UX. Fast status transitions without modal dialogs.
