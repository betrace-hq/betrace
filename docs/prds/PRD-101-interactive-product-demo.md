# PRD-101: Interactive Product Demo

**Status:** DRAFT
**Priority:** P0 (Marketing Foundation)
**Created:** 2025-10-12
**Estimated Effort:** 1 week

## Context

Interactive product demos are critical for B2B SaaS conversion in 2025:
- Prospects who view demos are **6x more likely to convert**
- Inbound leads are **70% more likely to sign up for trial** after viewing demo
- Top 1% of demos saw **68.7% increase in CTR**

**Characteristics of high-performing demos:**
- Ungated (no form required)
- Short (<5 steps)
- Desktop-optimized (90% of top demos)
- Value-focused (show "aha moment" quickly)

## Problem Statement

Without an interactive demo, prospects must:
1. Request full sales demo (high friction)
2. Read documentation (time-intensive)
3. Deploy FLUO locally to evaluate (technical barrier)

**Result:** Lower conversion rates, longer sales cycles, less qualified leads.

## Goals

### Primary Goals
1. **Show FLUO workflow in <3 minutes**: OTel traces → Rules → Signals → Investigation
2. **Embed on landing page (PRD-100)**: Below hero section
3. **Ungated access**: No form required to start demo
4. **60%+ completion rate**: Engaging, clear value at each step

### Success Metrics
- Demo start rate: >30% of landing page visitors
- Completion rate: >60% of demo starters
- Demo-to-trial conversion: >15%
- Average time in demo: 2-3 minutes

## Proposed Solution

### Demo Narrative (5 Steps)

**Scenario:** SRE discovers undocumented invariant causing incidents

#### Step 1: The Incident (Problem Setup)
```
Screen: Grafana-style dashboard showing error spike
Narration: "Your service just threw 500 errors. Looking at traces,
you see a pattern: PII was accessed without an audit log."

Interactive Element: Click error spike to see trace timeline
Aha Moment: "This pattern happened 47 times before the incident"
```

#### Step 2: Write a Rule (FLUO's Core Value)
```
Screen: FLUO rule editor (Monaco DSL syntax)
Pre-filled Rule:
  trace.has(database.query).where(data.contains_pii == true)
    and not trace.has(audit.log)

Narration: "Turn this pattern into a rule so it never happens again."

Interactive Element: Click "Test Rule" to see matches in historical traces
Aha Moment: Rule matches 5 violations in last 24 hours (not yet incidents)
```

#### Step 3: Create a Signal (Detection)
```
Screen: FLUO signals dashboard
New Signal Appears: "PII Access Without Audit Log"
  - Severity: HIGH
  - Occurrences: 5 in last 24h
  - Affected Service: user-service

Narration: "FLUO found 5 violations of your rule in production traces."

Interactive Element: Click signal to drill into trace details
Aha Moment: "Caught 5 bugs before they became incidents"
```

#### Step 4: Investigate (Root Cause Analysis)
```
Screen: Trace viewer showing spans
Highlighted Spans:
  ✅ GET /users/{id} (200 OK)
  ✅ db.query("SELECT * FROM users WHERE id = ?")
  ❌ audit.log() call MISSING

Narration: "See exactly where the invariant was violated."

Interactive Element: Expand span to see attributes (user_id, query)
Aha Moment: "Know exactly what code to fix"
```

#### Step 5: Prevent Recurrence (Compliance Bonus)
```
Screen: Compliance dashboard
Compliance Span Generated:
  Framework: SOC2
  Control: CC7.2 (Audit Logging)
  Evidence: Rule "pii-audit-required" active since 2025-10-12

Narration: "FLUO also generates compliance evidence automatically."

Interactive Element: Click "Export for Auditor" to see signed span
Aha Moment: "Compliance audits just got easier"
```

### Demo End Screen
```
"Ready to try FLUO?"

CTA 1: "Request Trial Access" → Lead capture form
CTA 2: "Read Technical Docs" → PRD-102
CTA 3: "Explore Use Cases" → PRD-103

Social Proof: "Built with SOC2 controls. 9.5/10 Security Expert rating."
```

### Technical Implementation

#### Option 1: Navattic (Recommended)
**Pros:**
- No-code demo builder
- Desktop web capture support
- Analytics built-in
- Hosted infrastructure

**Cons:**
- $500-1000/month cost
- Less customization

**Implementation:**
1. Record FLUO frontend workflow (PRD-102 Rule Editor + Signals Dashboard)
2. Add hotspots for interactive clicks
3. Add narration text overlays
4. Export embed code for landing page

#### Option 2: Arcade.software
**Pros:**
- Similar to Navattic
- Slightly cheaper (~$400/month)
- Good analytics

**Cons:**
- Fewer customization options

#### Option 3: Custom Build (React + Framer Motion)
**Pros:**
- Full control over UX
- No monthly cost
- Can integrate with real FLUO API (demo mode)

**Cons:**
- 2-3 weeks development time
- Maintenance burden

**Recommendation:** Start with **Navattic** (faster launch), migrate to custom if needed

### Demo Delivery Options

#### Embedded on Landing Page (Primary)
```html
<iframe src="https://demo.fluo.com/incident-prevention"
        width="100%" height="600px" frameborder="0"></iframe>
```

**Placement:** Below "How FLUO Works" section in PRD-100

#### Standalone Demo Center (Secondary)
- URL: `demo.fluo.com`
- Multiple demo scenarios:
  - SRE: Incident Prevention (default)
  - Developer: API Misuse Detection
  - Compliance: SOC2 Evidence Generation

### Analytics Tracking

**Events to Track:**
1. `demo.started` - User clicked "Start Demo"
2. `demo.step_completed` - Completed each of 5 steps
3. `demo.abandoned` - Left before completing
4. `demo.cta_clicked` - Which CTA at end (trial, docs, use cases)

**Metrics Dashboard:**
```
Demo Funnel:
Landing Page Views: 1000
Demo Started: 300 (30%)
Step 1 Completed: 270 (90%)
Step 2 Completed: 240 (80%)
Step 3 Completed: 210 (70%)
Step 4 Completed: 195 (65%)
Step 5 Completed: 180 (60%)
CTA Clicked: 45 (25% of completers)
```

## Implementation Plan

### Phase 1: Script & Storyboard (2 days)
1. Write detailed narration for each step
2. Create mockups of each screen
3. Define interactive elements (clicks, hovers)
4. Review with 3 SREs for accuracy

### Phase 2: Recording & Build (3 days)
1. Set up demo environment (FLUO frontend + sample data)
2. Record screen captures for each step
3. Build demo in Navattic/Arcade
4. Add narration overlays and hotspots
5. Test demo flow (internal team)

### Phase 3: Integration (1 day)
1. Embed demo on landing page (PRD-100)
2. Add analytics tracking (PostHog events)
3. A/B test placement (below fold vs in hero)
4. Monitor demo completion rates

### Phase 4: Optimization (Ongoing)
1. Watch session recordings (PostHog)
2. Identify drop-off points
3. Refine narration, shorten steps
4. A/B test demo scenarios

## Testing Strategy

### User Testing (5 SREs, 3 Developers, 2 Compliance Officers)
**Questions:**
1. "Can you explain what FLUO does after watching the demo?" (comprehension)
2. "On a scale of 1-10, how likely are you to try FLUO after this demo?" (intent)
3. "What questions do you still have?" (objection handling)

**Success Criteria:**
- 8/10 users can explain FLUO correctly
- Average intent score: >7/10
- Most common question: "How do I get started?" (not "What does FLUO do?")

### A/B Testing
**Test 1: Demo Placement**
- A: Below hero section (standard)
- B: In hero section (instead of static diagram)
- Metric: Demo start rate

**Test 2: Demo Length**
- A: 5 steps (full narrative)
- B: 3 steps (show rule → signal → investigation only)
- Metric: Completion rate

**Test 3: Gating Strategy**
- A: Ungated (anyone can view)
- B: Email gate before starting
- Metric: Conversion rate (demo viewers → trial requests)

**Recommendation:** Start ungated (68.7% CTR boost)

## Dependencies

- **PRD-100**: Landing page to embed demo
- **PRD-102**: Technical docs for "Read Docs" CTA
- **FLUO Frontend**: Rule editor and signals dashboard (must be demoable)

## Risks & Mitigations

### Risk: Demo too technical for non-SRE buyers
**Mitigation:** Create 3 demo variants (SRE, Developer, Compliance), let user choose

### Risk: Low completion rate (<40%)
**Mitigation:** Shorten demo to 3 steps, focus on single "aha moment"

### Risk: Demo outdated as FLUO UI changes
**Mitigation:** Re-record quarterly, or build custom demo with real FLUO frontend

### Risk: High demo engagement but low trial conversion
**Mitigation:** Stronger CTA copy, reduce friction in trial signup form

## Open Questions

1. Should demo show real FLUO UI or polished mockups?
   - **Recommendation:** Real UI (authenticity) with sample data

2. Should we show code examples in demo?
   - **Recommendation:** Yes, but briefly (DSL rule syntax only)

3. Should demo auto-play or require clicks?
   - **Recommendation:** Click-to-advance (90% of top demos use this)

4. Should we track which personas complete demo most?
   - **Recommendation:** Yes, add "I am a: SRE/Dev/Compliance" dropdown before demo

## Success Criteria

- ✅ Demo completion rate >60%
- ✅ Demo-to-trial conversion >15%
- ✅ 8/10 user testers can explain FLUO after watching
- ✅ Embedded on landing page within 1 week
- ✅ <3 minute average demo duration

## References

- [State of Interactive Product Demos 2025](https://www.navattic.com/report/state-of-the-interactive-product-demo-2025)
- [Interactive Demo Statistics 2025](https://www.arcade.software/post/interactive-demo-statistics)
- [Navattic Demo Best Practices](https://www.navattic.com/blog/interactive-demos)
- PRD-100: Marketing Landing Page Foundation (embed target)
