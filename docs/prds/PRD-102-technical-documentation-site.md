# PRD-102: Technical Documentation Site

**Status:** DRAFT
**Priority:** P0 (Marketing Foundation)
**Created:** 2025-10-12
**Estimated Effort:** 2 weeks

## Context

Technical documentation is critical for B2B SaaS sales enablement:
- **Reduces sales objections**: Technical buyers can self-evaluate
- **Shortens sales cycles**: Developers can validate integration feasibility
- **Improves trial conversion**: Clear getting started guides reduce time-to-value
- **SEO benefit**: Technical content ranks for long-tail keywords

**Current State:**
- FLUO has README.md and CLAUDE.md (developer-focused)
- No user-facing documentation for prospects
- Compliance docs (compliance-status.md, compliance.md) are honest but not marketing-ready

## Problem Statement

Without dedicated technical documentation, prospects must:
1. Read raw GitHub files (poor UX)
2. Ask sales/support basic integration questions (scaling issue)
3. Guess at FLUO's capabilities (leads to misaligned evaluations)

**Result:** Longer sales cycles, more support burden, lower trial conversion.

## Goals

### Primary Goals
1. **Self-Service Evaluation**: Developers can assess FLUO without sales call
2. **Fast Integration**: Getting started in <15 minutes
3. **Clear Positioning**: Understand what FLUO is (and is NOT)
4. **SEO Value**: Rank for "opentelemetry behavioral assurance," "trace pattern matching"

### Success Metrics
- Bounce rate: <30%
- Average session duration: >2 minutes
- Pages per session: >3
- Documentation-to-trial conversion: >10%
- Search ranking: Top 10 for "opentelemetry compliance evidence"

## Proposed Solution

### Site Structure

```
docs.fluo.com/
├── Getting Started/
│   ├── What is FLUO?
│   ├── Quick Start (5 min)
│   ├── Integration with OpenTelemetry
│   └── First Rule (Tutorial)
│
├── Core Concepts/
│   ├── Behavioral Assurance
│   ├── Traces, Rules, Signals
│   ├── DSL Rule Syntax
│   └── Compliance Spans
│
├── Use Cases/
│   ├── SRE: Incident Prevention
│   ├── Developer: API Misuse Detection
│   └── Compliance: Evidence Generation
│
├── API Reference/
│   ├── REST API
│   ├── OpenTelemetry Endpoint
│   └── Webhook Configuration
│
├── Rule Library/
│   ├── Authentication Patterns
│   ├── PII Access Rules
│   ├── Performance Invariants
│   └── Compliance Templates
│
└── Architecture/
    ├── Pure Application Framework (ADR-011)
    ├── Security Model
    ├── Compliance Status (honest transparency)
    └── ADRs (linked from GitHub)
```

### Key Pages (Detailed Specs)

#### 1. What is FLUO? (Landing Page)

**Goal:** Clear positioning in <60 seconds

```markdown
# What is FLUO?

FLUO is a **Behavioral Assurance System** for OpenTelemetry data.

## The Problem
Your OpenTelemetry traces contain patterns that, if violated, cause incidents:
- "Authentication always precedes data access"
- "PII queries always generate audit logs"
- "Cache hits for read-heavy endpoints"

But you don't know these invariants exist until they break.

## FLUO's Solution
1. **Discover Patterns**: FLUO analyzes traces to suggest invariants
2. **Write Rules**: Turn patterns into DSL rules (`trace.has(auth) and trace.has(data)`)
3. **Generate Signals**: Get alerted when rules are violated in production
4. **Investigate**: Drill into exact spans where invariants broke

## What FLUO is NOT
- ❌ **Not an APM**: Use Datadog/New Relic for metrics and dashboards
- ❌ **Not a SIEM**: Use Splunk/Elastic for security incident response
- ❌ **Not a Logs Aggregator**: Use Grafana Loki for log management

FLUO complements these tools by focusing on **behavioral patterns** in traces.

## Core Workflow
OpenTelemetry Traces → Rules (Invariants) → Signals (Violations) → Investigation

**Next:** [Quick Start Guide →](#)
```

#### 2. Quick Start (5 Minutes)

**Goal:** Run FLUO locally and see first signal

```markdown
# Quick Start (5 Minutes)

## Prerequisites
- Nix with flakes enabled
- Application sending OpenTelemetry traces

## Step 1: Start FLUO
nix run github:fluohq/fluo#dev

FLUO starts:
- Backend: http://localhost:8080
- Frontend: http://localhost:3000
- Grafana: http://localhost:12015

## Step 2: Send Traces to FLUO
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8080/v1/traces"

# Your application's existing OTLP exporter now sends to FLUO

## Step 3: Create Your First Rule
Navigate to http://localhost:3000/rules

Click "New Rule":

Name: auth-before-data
Rule:
  trace.has(span.name == "authenticate")
    and trace.has(span.name == "database.query")

Description: Ensure authentication happens before database access

Click "Save & Activate"

## Step 4: See Signals
Navigate to http://localhost:3000/signals

If any traces violate your rule, signals appear here:
- Timestamp
- Affected trace ID
- Rule that fired
- Drill-in to see exact spans

**Next:** [Write Advanced Rules →](#)
```

#### 3. DSL Rule Syntax Reference

**Goal:** Complete syntax documentation with examples

```markdown
# FLUO DSL Rule Syntax

FLUO rules are written in a domain-specific language for matching trace patterns.

## Basic Syntax

### Span Matching
trace.has(span.name == "database.query")
trace.has(span.attributes["http.method"] == "POST")
trace.has(span.status == "ERROR")

### Logical Operators
trace.has(A) and trace.has(B)      # Both must exist
trace.has(A) or trace.has(B)       # At least one exists
trace.has(A) and not trace.has(B)  # A exists, B doesn't

### Filters
trace.has(span.name == "db.query")
  .where(span.attributes["db.table"] == "users")

## Common Patterns

### Authentication Enforcement
# Rule: All data access requires authentication
trace.has(span.name == "data.access")
  and trace.has(span.name == "authenticate")

### PII Audit Logging
# Rule: PII access requires audit log
trace.has(database.query)
  .where(data.contains_pii == true)
  and trace.has(audit.log)

### Performance Invariants
# Rule: Cache must be checked before expensive query
trace.has(span.name == "expensive_query")
  and not trace.has(span.name == "cache.check")

## Advanced Features

### Span Ordering
trace.spansBefore(span.name == "auth", span.name == "data")
# Ensures auth span happens BEFORE data span

### Aggregations
trace.spanCount(span.name == "database.query") > 10
# Alert if trace has >10 DB queries (N+1 detection)

### Time Windows
trace.duration > 5000ms
# Alert if trace takes >5 seconds

**Next:** [See Rule Library Examples →](#)
```

#### 4. Compliance Evidence Generation

**Goal:** Explain compliance use case clearly

```markdown
# Compliance Evidence Generation

FLUO automatically generates compliance evidence from OpenTelemetry traces.

## How It Works

### 1. Annotate Code
@SOC2(controls = {CC6_1}, notes = "Authorization check")
public boolean authorizeUser(String userId, String resource) {
    // Emits compliance span
}

### 2. Define Compliance Rules
# SOC2 CC6.1: Authorization required for data access
trace.has(data.access)
  and trace.has(compliance.span.control == "CC6_1")

### 3. Query Compliance Spans
All compliance spans are queryable via:
- Grafana TraceQL
- FLUO Compliance Dashboard (PRD-015)
- Audit Report API (PRD-016)

## Supported Frameworks
- SOC2 Trust Service Criteria (CC6.1, CC6.2, CC7.1, CC7.2, CC8.1)
- HIPAA Technical Safeguards (164.312(a), 164.312(b))
- FedRAMP, ISO27001, PCI-DSS (extensible)

## Compliance Status (Transparency)
⚠️ **FLUO is NOT certified for any framework.**

FLUO provides:
✅ Compliance evidence collection primitives
✅ Built with SOC2/HIPAA controls in mind
✅ Cryptographic signatures for tamper-evidence (PRD-003)

Certification requires:
❌ External auditor (CPA for SOC2, 3PAO for FedRAMP)
❌ 12-18 month audit observation period
❌ $10-25K auditor fees

**Full details:** [Compliance Status Documentation](../compliance-status.md)

**Next:** [View Compliance Rule Templates →](#)
```

### Technical Implementation

#### Technology Stack

**Option 1: Docusaurus (Recommended)**
**Pros:**
- React-based (familiar to FLUO team)
- Built-in search (Algolia)
- Versioning support (for future API versions)
- Good SEO (static site generation)
- Active community

**Cons:**
- Slightly heavier than alternatives

**Option 2: Astro (Performance Focus)**
**Pros:**
- Extremely fast (<1s page loads)
- MDX support
- Good for SEO

**Cons:**
- Less mature than Docusaurus
- Manual search implementation

**Recommendation:** **Docusaurus** (balance of features and speed)

#### Features

##### 1. Search
- **Algolia DocSearch** (free for open source docs)
- Index all pages, API endpoints, code snippets
- Keyboard shortcut: `/` or `Ctrl+K`

##### 2. Code Syntax Highlighting
- **Prism.js** with custom FLUO DSL grammar
- Copy-to-clipboard buttons on code blocks
- Line highlighting for emphasis

##### 3. Interactive Examples
- **Live DSL Rule Editor** (Monaco editor)
- Test rules against sample traces
- See results immediately

##### 4. Responsive Design
- Mobile-optimized (40% of docs traffic is mobile)
- Collapsible sidebar
- Dark mode toggle

##### 5. Analytics
- **PostHog** for behavior tracking
- Track: Most viewed pages, search queries, external link clicks
- Identify documentation gaps

#### Performance Targets
- **Page Load:** <1.5s (P50)
- **First Contentful Paint:** <800ms
- **Time to Interactive:** <1.5s
- **Lighthouse Score:** >95

#### SEO Optimization
- **Sitemap.xml** for all pages
- **Structured data** (JSON-LD) for how-to guides
- **Open Graph** tags for social sharing
- **Canonical URLs** to avoid duplicate content
- **Meta descriptions** for all pages (150-160 chars)

**Target Keywords:**
- "opentelemetry behavioral assurance"
- "trace pattern matching"
- "compliance evidence generation"
- "opentelemetry rule engine"
- "incident prevention from traces"

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Set up Docusaurus project: `/docs-site`
2. Configure navigation structure (6 top-level sections)
3. Create page templates (concept, tutorial, reference)
4. Deploy preview environment (Vercel)

### Phase 2: Core Content (Week 1-2)
1. Write 4 key pages: What is FLUO, Quick Start, DSL Syntax, Compliance
2. Convert existing ADRs to user-friendly docs
3. Create 10 rule examples for Rule Library
4. API reference (OpenAPI spec → generated docs)

### Phase 3: Features (Week 2)
1. Integrate Algolia DocSearch
2. Add live DSL editor (Monaco + FLUO validator API)
3. Configure analytics (PostHog)
4. Dark mode styling

### Phase 4: Launch (End of Week 2)
1. Domain setup: `docs.fluo.com`
2. SSL certificate (Cloudflare)
3. Submit sitemap to Google Search Console
4. Cross-link from landing page (PRD-100)

## Testing Strategy

### Content Review
- **5 SREs**: "Can you integrate FLUO after reading Quick Start?"
- **3 Developers**: "Is the DSL syntax clear?"
- **2 Compliance Officers**: "Is the compliance positioning honest?"

**Success Criteria:**
- 8/10 users can complete Quick Start without help
- Average clarity rating: >8/10

### Performance Testing
- Lighthouse CI in GitHub Actions
- WebPageTest from 5 global locations
- Core Web Vitals monitoring

### SEO Audit
- Screaming Frog crawl (check for broken links)
- Ahrefs analysis (keyword rankings)
- Google Search Console (indexing status)

## Dependencies

- **PRD-100**: Landing page links to docs
- **PRD-101**: Interactive demo links to docs for "Learn More"
- **FLUO Backend**: API reference requires deployed backend

## Risks & Mitigations

### Risk: Documentation becomes stale as FLUO changes
**Mitigation:** Link docs deployment to CI/CD, version docs with FLUO releases

### Risk: Too technical for non-developer buyers
**Mitigation:** Separate "Use Cases" section with business-focused content

### Risk: Low SEO traffic (new site = no authority)
**Mitigation:** Cross-post to dev.to, Medium, HackerNews

### Risk: Search doesn't work well
**Mitigation:** Use proven solution (Algolia DocSearch), test with real queries

## Open Questions

1. Should docs be versioned (v1.0 vs v2.0)?
   - **Recommendation:** Not yet (pre-1.0), add versioning post-launch

2. Should API reference be auto-generated from OpenAPI spec?
   - **Recommendation:** Yes (Docusaurus supports Swagger UI plugin)

3. Should we include video tutorials?
   - **Recommendation:** Phase 2 (after launch), embed YouTube videos

4. Should docs site be open source (GitHub)?
   - **Recommendation:** Yes (transparency + community contributions)

## Success Criteria

- ✅ Bounce rate <30%
- ✅ Average session duration >2 minutes
- ✅ 8/10 user testers complete Quick Start successfully
- ✅ Page load <1.5s (P50)
- ✅ Lighthouse score >95
- ✅ Indexed by Google within 1 week

## References

- [Docusaurus](https://docusaurus.io/)
- [Algolia DocSearch](https://docsearch.algolia.com/)
- [Types of Technical Documentation 2025](https://whatfix.com/blog/types-of-technical-documentation/)
- ADR-011: Pure Application Framework (docs site is external)
- [compliance-status.md](../compliance-status.md) - Honest compliance claims
