# PRD-103: Use Case Library

**Status:** DRAFT
**Priority:** P1 (Lead Generation)
**Created:** 2025-10-12
**Estimated Effort:** 1 week

## Context

Use case content is critical for B2B SaaS lead qualification and sales enablement:
- Helps prospects self-identify ("This is my problem")
- Demonstrates concrete value ("Here's how BeTrace solved it")
- Provides social proof (even without customer names early on)
- Generates qualified leads through gated premium content

**BeTrace's Three Core Personas:**
1. **SREs**: Incident prevention from undocumented invariants
2. **Developers**: API misuse detection and contract enforcement
3. **Compliance Officers**: Automated evidence generation for audits

## Problem Statement

Without documented use cases, prospects must:
1. Imagine how BeTrace applies to their situation (cognitive load)
2. Request custom demos from sales (doesn't scale)
3. Misunderstand BeTrace's positioning (e.g., confuse with APM)

**Result:** Unqualified leads, longer sales cycles, positioning confusion.

## Goals

### Primary Goals
1. **Persona-Specific Content**: One detailed use case per persona
2. **Before/After Clarity**: Show problem → BeTrace solution → measurable outcome
3. **Lead Qualification**: Gated premium content (e.g., implementation guides)
4. **SEO Value**: Rank for "opentelemetry incident prevention," "compliance automation"

### Success Metrics
- Use case page views: >20% of landing page traffic
- Form conversion rate: >15% (for gated content)
- Qualified lead score: >7/10 (self-reported relevance)
- Use case-to-trial conversion: >20%

## Proposed Solution

### Use Case Structure

Each use case follows this template:

```markdown
# [Persona]: [Outcome]

## The Problem (Before BeTrace)
- Describe pain point with concrete example
- Include realistic data (error rates, incident frequency)
- Explain why existing tools don't solve this

## The Solution (BeTrace Implementation)
- Step-by-step how BeTrace addresses the problem
- Include actual DSL rules and configuration
- Show BeTrace UI screenshots (signals, trace drill-down)

## The Results (After BeTrace)
- Quantify improvement (MTTR reduced by X%, compliance prep time -Y%)
- Include quotes (even if anonymized early on)
- Call out unexpected benefits

## Get Started
- CTA: "Download Implementation Guide" (gated)
- CTA: "Try Interactive Demo" (ungated)
- CTA: "Request Trial Access" (high intent)
```

### Use Case #1: SRE - Incident Prevention

**Title:** "How SREs Use BeTrace to Discover Undocumented Invariants Before They Cause Incidents"

#### The Problem
```markdown
Your team handles a critical API with 50K requests/min. Last month:
- **Incident:** 500 errors spiked to 15% for 8 minutes
- **Root Cause:** PII was accessed in a database query without an audit log being written
- **Impact:** 3 hours of investigation, potential HIPAA violation

During the postmortem, you realized:
1. This pattern (PII access → audit log) was an **undocumented invariant**
2. It had been violated 47 times in the past week without causing incidents
3. You had no way to detect violations until they became critical

**Existing tools don't help:**
- ❌ APM alerts on error rates (not patterns)
- ❌ Logs require manual grep (doesn't scale to 50K req/min)
- ❌ Distributed tracing shows the incident, not the pattern
```

#### The Solution
```markdown
**Step 1: Connect OpenTelemetry to BeTrace**
export OTEL_EXPORTER_OTLP_ENDPOINT="http://betrace.yourdomain.com/v1/traces"
# No code changes required

**Step 2: BeTrace Suggests Invariant**
BeTrace analyzed 24 hours of traces and suggested:
> "84% of traces that query `users` table also emit `audit.log` span.
> The 16% that don't may be a violation."

**Step 3: Turn Suggestion Into Rule**
name: pii-audit-required
rule: |
  trace.has(database.query)
    .where(span.attributes["db.table"] == "users")
    and not trace.has(span.name == "audit.log")

**Step 4: Monitor Signals in Real-Time**
BeTrace generates a signal every time the rule fires:
- Timestamp: 2025-10-12T14:32:11Z
- Trace ID: abc123... (click to see exact spans)
- Severity: HIGH
- Service: user-service

You drill into the trace and see:
✅ GET /users/{id} (200 OK)
✅ db.query("SELECT * FROM users WHERE id = ?")
❌ audit.log() call MISSING ← Exact location of bug
```

#### The Results
```markdown
**Quantifiable Outcomes:**
- **5 violations caught** in staging before production deploy
- **MTTR reduced by 60%** (traces pinpoint exact span, no manual log grep)
- **Zero incidents** from this pattern in 3 months since deploying BeTrace

**Unexpected Benefits:**
- Found 3 other undocumented invariants (cache-before-query, auth-before-data)
- Compliance team uses BeTrace signals as audit evidence (SOC2 CC7.2)
- New developers understand service contracts faster (rules document behavior)

> "BeTrace turned our postmortems into preventive rules. We catch broken invariants
> in staging now, not production."
> — Anonymous SRE, Financial Services Company
```

#### Get Started (CTAs)
```markdown
**Download:** "SRE Implementation Guide: Pattern Discovery to Production Rules" (PDF, gated)
**Try:** Interactive Demo - See BeTrace Catch an Invariant Violation
**Contact:** Request 30-Day Trial with Sample Trace Analysis
```

---

### Use Case #2: Developer - API Misuse Detection

**Title:** "How Developers Use BeTrace to Enforce Service Contracts and Catch API Misuse"

#### The Problem
```markdown
Your team maintains an internal authentication service used by 12 microservices.
The contract is simple: "Always call /verify-token before accessing protected resources."

**But developers forget:**
- New service ships without token validation → security incident
- Junior dev copies old code that bypasses auth → bug report
- Integration tests pass, but production traces show violations

**Existing tools don't help:**
- ❌ Unit tests only check individual functions, not integration paths
- ❌ API gateways enforce auth at the edge, not internal calls
- ❌ Code review catches obvious issues, not subtle integration bugs
```

#### The Solution
```markdown
**Step 1: Define Service Contract as BeTrace Rule**
name: auth-service-contract
rule: |
  trace.has(span.name == "protected_resource")
    and trace.has(span.name == "/verify-token")
    and trace.spansBefore("/verify-token", "protected_resource")

description: "Token verification must happen BEFORE accessing protected resources"

**Step 2: Integrate BeTrace into CI/CD**
# In your CI pipeline
- nix run .#test-rules --fixture=integration-tests/sample-traces.json
- BeTrace validates traces from integration tests against rules
- Build fails if violations detected

**Step 3: Monitor Production Violations**
BeTrace signals appear in real-time dashboard:
- Service: checkout-service (new deployment)
- Violation: Accessed /user-profile without /verify-token
- Trace: Shows exact request path

**Step 4: Auto-Rollback or Alert**
BeTrace webhook triggers PagerDuty alert:
> "checkout-service v1.2.3 violating auth-service-contract (5 signals in 2 min)"

Team rolls back deployment before security impact.
```

#### The Results
```markdown
**Quantifiable Outcomes:**
- **50 violations caught in staging** before production deploy
- **Zero security incidents** from auth bypass in 6 months
- **Documentation improvement:** Rules become living service contracts

**Unexpected Benefits:**
- Onboarding new developers: "Read the BeTrace rules to understand how services interact"
- Found legacy code paths that bypassed auth (fixed proactively)
- Compliance team happy: BeTrace generates @SOC2 evidence for CC6.1 (access control)

> "BeTrace is like linting for distributed systems. It catches integration bugs
> that unit tests miss."
> — Anonymous Staff Engineer, E-commerce Platform
```

#### Get Started (CTAs)
```markdown
**Download:** "Developer Guide: Turning API Contracts Into BeTrace Rules" (PDF, gated)
**Try:** Interactive Demo - See BeTrace Catch an API Misuse
**Contact:** Request Trial Access with Your OpenTelemetry Data
```

---

### Use Case #3: Compliance - Automated Evidence Generation

**Title:** "How Compliance Officers Use BeTrace to Generate Audit Evidence from Production Traces"

#### The Problem
```markdown
Your organization needs SOC2 Type II certification. One requirement (CC7.2) is:
> "System monitoring detects and logs unauthorized data access attempts."

**Manual evidence collection is painful:**
- ❌ Request logs from engineering team (takes 2 weeks)
- ❌ Manually grep logs for audit events (error-prone)
- ❌ No cryptographic proof logs weren't tampered with
- ❌ Auditor asks follow-up questions → repeat process

**Existing tools don't help:**
- ❌ SIEM logs are noisy, hard to map to specific controls
- ❌ APM tools don't generate compliance-specific evidence
- ❌ Cloud provider logs lack application-level context
```

#### The Solution
```markdown
**Step 1: Annotate Code with Compliance Metadata**
@SOC2(controls = {CC7_2}, notes = "Audit log for PII access")
public void logAuditEvent(String userId, String resource) {
    // Emits compliance span with SOC2 metadata
}

**Step 2: Define BeTrace Compliance Rule**
name: soc2-cc7.2-audit-logging
rule: |
  trace.has(database.query).where(data.contains_pii == true)
    and trace.has(compliance.span.control == "CC7_2")

description: "SOC2 CC7.2: PII access requires audit logging"

**Step 3: Query Compliance Evidence**
Navigate to BeTrace Compliance Dashboard (PRD-015):
- Filter: Framework = SOC2, Control = CC7.2
- Date Range: Last 12 months
- Result: 1.2M compliance spans (100% coverage)

**Step 4: Export for Auditor**
Click "Generate Audit Report" (PRD-016):
- PDF includes: Span count, sample traces, cryptographic signatures
- CSV export for detailed analysis
- Each span is tamper-evident (HMAC-SHA256 signature, PRD-003)
```

#### The Results
```markdown
**Quantifiable Outcomes:**
- **Zero manual evidence collection**: Fully automated from production traces
- **Audit prep time reduced by 80%**: 2 weeks → 2 days
- **100% control coverage**: Every PII access logged and traceable

**Unexpected Benefits:**
- Found 3 code paths that missed audit logging (fixed before audit)
- Auditor impressed by cryptographic signatures (higher trust)
- Reused evidence for HIPAA assessment (span metadata includes HIPAA controls)

> "BeTrace turned our compliance program from reactive to proactive. We know
> controls work because we see evidence in every trace."
> — Anonymous Compliance Officer, Healthcare SaaS
```

#### Get Started (CTAs)
```markdown
**Download:** "Compliance Officer's Guide: SOC2 Evidence with BeTrace" (PDF, gated)
**Try:** Interactive Demo - See Compliance Spans Generated from Traces
**Contact:** Schedule Compliance Assessment with BeTrace Specialist
```

---

### Use Case Page Design

**Layout:**
```
Hero Section:
- Title: "[Persona]: [Outcome]"
- Subtitle: 1-sentence problem statement
- CTA: "Read How" (scroll to content) + "Try Demo" (PRD-101)

Main Content:
- Problem (with visual: before diagram)
- Solution (with screenshots: BeTrace UI)
- Results (with metrics: before/after comparison)

Sidebar:
- Download gated content (lead capture form)
- Related use cases
- Customer quotes (when available)

Footer:
- CTA: "Ready to try BeTrace?" (trial signup)
- Social proof: "Built with SOC2 controls"
```

### Gated Content Strategy

**Premium Downloadable Guides:**
1. "SRE Implementation Guide: Pattern Discovery to Production Rules" (15 pages)
2. "Developer Guide: Turning API Contracts Into BeTrace Rules" (12 pages)
3. "Compliance Officer's Guide: SOC2 Evidence with BeTrace" (20 pages)

**Form Fields (Minimal):**
- Email (required)
- Company (required)
- Role (dropdown: SRE, Developer, Compliance, Other)
- Optionally: "What's your biggest observability challenge?" (text)

**Lead Scoring:**
- High intent: Compliance + Finance/Healthcare industry
- Medium intent: Developer + E-commerce/SaaS
- Low intent: Student + @gmail.com email

## Implementation Plan

### Phase 1: Content Creation (Week 1)
1. Write 3 use case pages (SRE, Developer, Compliance)
2. Create before/after diagrams (Figma or Excalidraw)
3. Generate BeTrace UI screenshots (from PRD-102 demo environment)
4. Review with 3 people per persona (validate authenticity)

### Phase 2: Gated Content (Week 1)
1. Write 3 downloadable PDF guides (15-20 pages each)
2. Design PDF templates (branded, professional)
3. Set up lead capture forms (PostHog or HubSpot)
4. Configure email automation (send PDF + follow-up sequence)

### Phase 3: Integration (Week 2)
1. Add use case pages to landing site (PRD-100)
2. Cross-link from documentation (PRD-102)
3. Embed in interactive demo end screen (PRD-101)
4. Configure analytics (track conversions by use case)

### Phase 4: SEO & Distribution (Week 2)
1. Optimize meta descriptions, Open Graph tags
2. Submit to Google Search Console
3. Share on LinkedIn, dev.to, HackerNews
4. Email to early beta testers (if any)

## Testing Strategy

### Content Validation
- **5 SREs**: "Is the incident prevention use case realistic?"
- **3 Developers**: "Would you use BeTrace based on the API misuse use case?"
- **2 Compliance Officers**: "Is the evidence generation use case compelling?"

**Success Criteria:**
- 8/10 users find use case "very relevant" or "extremely relevant"
- Average intent-to-try score: >7/10

### Conversion Testing
- **A/B Test:** Gated vs ungated content
  - A: PDF requires form fill
  - B: PDF freely downloadable, form optional
  - Metric: Leads generated vs content engagement

- **A/B Test:** Form field count
  - A: Email only
  - B: Email + Company + Role
  - Metric: Conversion rate

## Dependencies

- **PRD-100**: Landing page links to use case library
- **PRD-101**: Interactive demo references use cases
- **PRD-102**: Technical docs expand on use case implementations

## Risks & Mitigations

### Risk: Use cases feel generic (not BeTrace-specific)
**Mitigation:** Include actual DSL rules, BeTrace UI screenshots, specific metrics

### Risk: Low form conversion (<10%)
**Mitigation:** Reduce form fields, offer ungated preview (first 3 pages of PDF)

### Risk: Use cases don't resonate with target personas
**Mitigation:** User testing with 10 people per persona before publishing

### Risk: Gated content generates low-quality leads
**Mitigation:** Add qualifying questions ("What's your current observability setup?")

## Open Questions

1. Should use cases be gated or ungated?
   - **Recommendation:** Ungated content, gated premium guides (hybrid)

2. Should we include customer names/logos?
   - **Recommendation:** Not yet (pre-launch), use anonymized quotes

3. Should use cases include video walkthroughs?
   - **Recommendation:** Phase 2 (after launch), 3-5 min YouTube videos

4. Should we create industry-specific use cases (finance, healthcare)?
   - **Recommendation:** Yes, but after validating persona-based use cases work

## Success Criteria

- ✅ 3 use case pages published
- ✅ 3 gated PDF guides created
- ✅ Form conversion rate >15%
- ✅ 8/10 user testers rate content as "very relevant"
- ✅ Use case pages rank in top 20 for target keywords within 3 months

## References

- [B2B SaaS Landing Page Best Practices](https://www.caffeinemarketing.com/blog/20-best-b2b-saas-landing-page-examples)
- [Interactive Demo Use Cases 2025](https://www.arcade.software/post/interactive-demo-use-cases-marketing)
- PRD-100: Marketing Landing Page (links to use cases)
- PRD-101: Interactive Product Demo (references use cases)
- PRD-102: Technical Documentation (expands on implementations)
