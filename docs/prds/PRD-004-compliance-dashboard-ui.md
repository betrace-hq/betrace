# PRD-004: Compliance Dashboard UI

**Status:** Ready for Implementation
**Priority:** P0 (Highest ROI)
**Owner:** Frontend Team
**Effort:** 2 weeks (frontend-only)
**Dependencies:** None (works with existing ComplianceSpan data)

## Overview

FLUO's Compliance Dashboard transforms raw ComplianceSpan telemetry into actionable compliance intelligence. The dashboard provides real-time visibility into compliance posture by visualizing control coverage, evidence trails, and gaps—eliminating the need for manual TraceQL queries in Grafana. This dashboard serves as FLUO's "wow moment" in demos, proving that compliance-by-design works by showing live evidence generation.

The dashboard targets three personas: SREs need immediate visibility into compliance gaps, Compliance Officers need evidence export for audits, and Auditors need standardized proof of control effectiveness. Unlike competitors (Vanta, Drata) that manually collect evidence, FLUO's dashboard displays evidence automatically generated as a byproduct of normal operations.

## Problem Statement

**Current Pain Points:**

1. **SREs/DevOps:** Cannot answer "Are we compliant right now?" without writing complex TraceQL queries. Compliance gaps discovered during audits, not proactively.

2. **Compliance Officers:** Manual evidence collection requires deep Grafana knowledge. Filtering spans by framework/control/time requires custom queries. No standardized export format for auditors.

3. **Auditors:** Must parse raw OpenTelemetry spans without compliance context. No clear mapping from spans to controls. Evidence format inconsistent across organizations.

4. **Sales/Pre-Sales:** Cannot demonstrate compliance-by-design visually. Prospects don't trust verbal claims without proof. Competitors show dashboards; FLUO shows Grafana.

**Cost of Not Solving:**
- Lost deals: Prospects choose Vanta/Drata because they have visual compliance proof
- Operational risk: SREs discover compliance gaps during audits (too late)
- Audit overhead: Compliance teams spend 40+ hours/quarter extracting evidence
- Trust deficit: "Compliance-by-design" is a claim, not a visible reality

## Goals

1. **Demo Impact:** 80% of prospects have a "wow moment" seeing live compliance evidence within 2 minutes of dashboard load
2. **Operational Efficiency:** SREs identify 3+ compliance gaps within 5 minutes (vs 30+ minutes writing TraceQL queries)
3. **Audit Preparation:** Compliance Officers export evidence for auditors in <30 seconds (vs 30+ minutes in Grafana)
4. **Control Coverage:** Dashboard shows % coverage for each SOC2/HIPAA control with visual indicators
5. **Evidence Traceability:** Click-through from control → spans → source code annotations

## Non-Goals

1. **Compliance Certification:** Dashboard does NOT certify SOC2/HIPAA compliance (requires external auditor)
2. **Policy Management:** Dashboard does NOT store or manage security policies/procedures
3. **Remediation Workflow:** Dashboard does NOT include ticketing/assignment for gaps (future PRD)
4. **Historical Trending:** Phase 1 does NOT include time-series analysis (future enhancement)
5. **Multi-Tenant UI:** Phase 1 assumes single tenant (tenant isolation exists in backend)

## User Stories

### US-1: SRE Views Compliance Posture (Primary)
**As an** SRE
**I want to** see real-time compliance control coverage
**So that** I can identify gaps before audits

**Acceptance Criteria:**
- GIVEN I navigate to `/compliance` route
- WHEN the page loads
- THEN I see:
  - Overall compliance score (e.g., "SOC2: 87% coverage")
  - Grid of controls (CC6.1, CC6.2, etc.) with status: ✅ Covered, ⚠️ Partial, ❌ No Evidence
  - Count of evidence spans per control (e.g., "CC6.1: 1,247 spans")
  - Last evidence timestamp per control (e.g., "CC7.2: 3 minutes ago")
- AND controls with no evidence in last 24h are highlighted red
- AND clicking a control drills down to evidence spans

### US-2: Compliance Officer Filters Evidence
**As a** Compliance Officer
**I want to** filter evidence by framework, control, time range
**So that** I can prepare audit documentation

**Acceptance Criteria:**
- GIVEN I am on the compliance dashboard
- WHEN I select filters:
  - Framework dropdown: "SOC2", "HIPAA", "All"
  - Control multi-select: CC6.1, CC6.2, etc.
  - Date range picker: "Last 7 days", "Last 30 days", "Custom"
  - Outcome filter: "Success", "Failure", "All"
- THEN dashboard updates to show only matching evidence
- AND filter state persists in URL query params
- AND "Reset Filters" button returns to default view

### US-3: Auditor Exports Evidence
**As an** Auditor
**I want to** export compliance evidence as CSV/JSON
**So that** I can include it in my audit report

**Acceptance Criteria:**
- GIVEN I have filtered evidence for a specific control (e.g., CC6.1)
- WHEN I click "Export Evidence" button
- THEN I am prompted to choose format: CSV or JSON
- AND download begins with filename: `fluo-compliance-evidence-cc6_1-2025-10-12.csv`
- AND CSV contains columns: timestamp, framework, control, evidenceType, outcome, traceId, spanId, tenantId
- AND JSON is array of ComplianceSpan objects
- AND export includes only currently filtered spans (not all time)

### US-4: SRE Drills Down to Span Details
**As an** SRE
**I want to** click a control and see individual evidence spans
**So that** I can verify compliance claims are backed by real data

**Acceptance Criteria:**
- GIVEN I am viewing the control coverage grid
- WHEN I click "CC6.1" card
- THEN I navigate to `/compliance/controls/cc6_1` route
- AND I see:
  - Table of ComplianceSpan records (timestamp, evidenceType, outcome, traceId)
  - Pagination controls (20 spans per page)
  - Link to Grafana trace explorer for each span
  - "Back to Dashboard" navigation
- AND clicking a traceId opens Grafana in new tab with trace loaded

### US-5: Sales Engineer Demonstrates Compliance
**As a** Sales Engineer
**I want to** show live compliance evidence generation
**So that** prospects trust FLUO's compliance-by-design claims

**Acceptance Criteria:**
- GIVEN I am in a demo call with `/compliance` dashboard open
- WHEN I trigger a backend operation annotated with `@SOC2(controls = {CC6_1})`
- THEN within 5 seconds:
  - Dashboard auto-refreshes (WebSocket or 5s polling)
  - Control card updates evidence count (e.g., "CC6.1: 1,247 → 1,248 spans")
  - "Last Evidence" timestamp updates to "Just now"
- AND I can explain: "This span was emitted by our authorization check, proving CC6.1 works"

### US-6: Compliance Officer Identifies Gaps
**As a** Compliance Officer
**I want to** see which controls have no recent evidence
**So that** I can proactively fix compliance issues

**Acceptance Criteria:**
- GIVEN controls have varied evidence recency
- WHEN I view the dashboard
- THEN controls are sorted by status:
  1. ❌ No Evidence (in last 24h)
  2. ⚠️ Partial Coverage (<10 spans/hour)
  3. ✅ Active Coverage (≥10 spans/hour)
- AND "No Evidence" controls show banner: "⚠️ Missing evidence for 18 hours"
- AND clicking "Show Details" explains: "Expected: @SOC2(controls = {CC7_2}) annotations. Found: 0 spans."

### US-7: SRE Monitors Evidence Health
**As an** SRE
**I want to** see evidence generation trends
**So that** I can detect if instrumentation breaks

**Acceptance Criteria:**
- GIVEN dashboard has mini-trend chart per control
- WHEN I hover over control card
- THEN I see sparkline: evidence count over last 24h (1h buckets)
- AND tooltip shows: "12:00 PM: 47 spans, 1:00 PM: 52 spans, ..."
- AND sudden drops (>50% decrease) highlight the control yellow

## UI/UX Design

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ FLUO Header (existing)          [Avatar] [Theme] [Logout]  │
├─────────────────────────────────────────────────────────────┤
│ Compliance Dashboard                    [Export] [Refresh]  │
├─────────────────────────────────────────────────────────────┤
│ Filters:                                                     │
│ [Framework ▾] [Controls ▾] [Date Range ▾] [Outcome ▾]      │
│                                        [Reset Filters]       │
├─────────────────────────────────────────────────────────────┤
│ Overall Compliance Score                                     │
│ ┌──────────────────┐  ┌──────────────────┐                 │
│ │ SOC2: 87%        │  │ HIPAA: 72%       │                 │
│ │ 7 of 8 controls  │  │ 5 of 7 controls  │                 │
│ └──────────────────┘  └──────────────────┘                 │
├─────────────────────────────────────────────────────────────┤
│ Control Coverage Grid                                        │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│ │ ✅ CC6.1   │ │ ⚠️ CC6.2   │ │ ❌ CC6.3   │              │
│ │ 1,247 spans│ │ 8 spans    │ │ No evidence│              │
│ │ 3 min ago  │ │ 18h ago    │ │ Never      │              │
│ └────────────┘ └────────────┘ └────────────┘              │
│ [... 5 more controls in responsive grid ...]                │
└─────────────────────────────────────────────────────────────┘
```

### Components to Build

**New Components:**

1. **ComplianceDashboard** (`/src/components/compliance/compliance-dashboard.tsx`)
2. **ComplianceScoreCard** (`/src/components/compliance/compliance-score-card.tsx`)
3. **ControlCard** (`/src/components/compliance/control-card.tsx`)
4. **ControlDetailPage** (`/src/components/compliance/control-detail-page.tsx`)
5. **EvidenceExportButton** (`/src/components/compliance/evidence-export-button.tsx`)
6. **ComplianceFilters** (`/src/components/compliance/compliance-filters.tsx`)

## Implementation Phases

### Phase 1: Core Dashboard (Week 1)

**Goal:** Demo-ready dashboard with control coverage grid

**Tasks:**

1. **Backend API (Days 1-2)**
   - [ ] Create `ComplianceApiRoute` with `/summary` endpoint
   - [ ] Implement control status logic
   - [ ] Add filtering (framework, time range)
   - [ ] Unit + integration tests

2. **Frontend Components (Days 3-4)**
   - [ ] Create `/compliance` route
   - [ ] Build dashboard layout
   - [ ] Build ComplianceScoreCard
   - [ ] Build ControlCard components
   - [ ] Style with Tailwind + shadcn/ui

3. **Data Integration (Day 5)**
   - [ ] Implement API client
   - [ ] Wire up React Query
   - [ ] Add 5s polling
   - [ ] Test with live data

### Phase 2: Filtering & Export (Week 2)

**Goal:** Auditor-ready evidence export and drill-down

**Tasks:**

1. **Backend Enhancements (Days 6-7)**
   - [ ] Implement `/controls/{controlId}/spans` endpoint
   - [ ] Implement `/export` endpoint (CSV/JSON)
   - [ ] Add pagination
   - [ ] Tests

2. **Frontend Drill-Down (Days 8-9)**
   - [ ] Create control detail route
   - [ ] Build span table with pagination
   - [ ] Add Grafana trace links
   - [ ] Test navigation

3. **Filtering & Export (Day 10)**
   - [ ] Build filter components
   - [ ] Implement URL query sync
   - [ ] Build export button
   - [ ] Test export with 1000+ spans

## Success Metrics

1. **Demo Conversion:** 80% "wow moment" rate (target)
2. **Time to Identify Gaps:** <5 minutes (vs 30+ currently)
3. **Evidence Export Speed:** <30 seconds (vs 30+ minutes)
4. **Dashboard Load Time:** <500ms p95
5. **Test Coverage:** 90% instruction, 80% branch

## References

- **Vanta Dashboard:** Control coverage inspiration
- **Datadog APM:** Filtering/time range UX patterns
- **Grafana:** Span detail panel design
- **@docs/compliance.md:** Compliance evidence system overview
