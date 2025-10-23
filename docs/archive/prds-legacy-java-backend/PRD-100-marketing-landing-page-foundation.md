# PRD-100: Marketing Landing Page Foundation

**Status:** DRAFT
**Priority:** P0 (Marketing Foundation)
**Created:** 2025-10-12
**Estimated Effort:** 1-2 weeks

## Context

BeTrace currently lacks a marketing-focused landing page that clearly communicates its value proposition to potential customers. The existing README.md is developer-focused and doesn't address sales conversion needs.

**Industry Benchmarks (2025):**
- Median B2B SaaS landing page conversion: 2.4%
- Top performers: 5-7%
- Page load <2s: 7% conversion boost per second saved
- Each extra form field: 4-8% conversion drop

## Problem Statement

Without a dedicated marketing landing page, BeTrace cannot:
1. Capture leads from organic/paid traffic
2. Communicate value to non-technical stakeholders
3. Support buying committee evaluation (SREs, Engineering Directors, Compliance Officers)
4. Generate pipeline for sales conversations

## Goals

### Primary Goals
1. **Clear Value Proposition**: Communicate "Behavioral Assurance for OpenTelemetry" in <5 seconds
2. **Multi-Persona Messaging**: Address SREs, Developers, and Compliance Officers
3. **Conversion Optimization**: Target 2-3% baseline conversion rate
4. **Fast Performance**: <2s page load time

### Success Metrics
- Conversion rate: 2-3% (baseline) → 5-7% (optimized)
- Bounce rate: <40%
- Time on page: >45 seconds
- CTA click-through rate: >10%

## Proposed Solution

### Page Structure

#### 1. Hero Section (Above the Fold)
```
Headline: "Behavioral Assurance for OpenTelemetry Data"
Subheadline: "Turn traces into invariants. Catch incidents before they happen."

CTA Primary: "Try Interactive Demo" (ungated)
CTA Secondary: "Read Documentation"

Visual: Animated diagram showing:
OpenTelemetry Traces → Rules (Invariants) → Signals (Violations) → Investigation
```

**Design Principles:**
- Single, clear headline (no jargon)
- Visual reinforcement of workflow
- Low-friction CTA (no form on hero)

#### 2. Problem Statement Section
```
"What BeTrace Solves"

For SREs:
❌ Incidents from undocumented invariants (e.g., "auth always precedes data access")
✅ Discover patterns from production traces, create rules to prevent recurrence

For Developers:
❌ No way to enforce service usage contracts (e.g., "never call API without token")
✅ Define behavioral invariants in DSL, expose violations immediately

For Compliance:
❌ Manual audit evidence collection for SOC2/HIPAA
✅ Trace patterns automatically generate cryptographically-signed compliance spans
```

#### 3. Core Workflow Section
```
"How BeTrace Works"

Step 1: Connect OpenTelemetry
  → Point OTLP exporter to BeTrace endpoint
  → No code changes required

Step 2: Write Rules (or Let BeTrace Learn)
  → DSL: `trace.has(auth.check) and trace.has(data.access)`
  → Auto-suggest rules from trace patterns

Step 3: Investigate Signals
  → Real-time violations in dashboard
  → Drill into spans, correlate with incidents

Step 4: Prevent Recurrence
  → Turn signals into alerts (Slack, PagerDuty)
  → Compliance evidence ready for auditors
```

**Visual:** Interactive demo embed (PRD-101)

#### 4. Differentiation Section
```
"BeTrace is NOT:"
❌ An APM tool (use Datadog/New Relic for metrics)
❌ A SIEM (use Splunk for security incidents)
❌ A generic observability platform

"BeTrace IS:"
✅ Behavioral pattern matching on telemetry
✅ Invariant discovery for incident prevention
✅ Compliance evidence generation from traces
```

#### 5. Social Proof Section
```
"Built with Compliance in Mind"

[Security Badge] SOC2 Controls Implemented
[Security Badge] HIPAA Technical Safeguards
[Performance Badge] <10ms Rule Evaluation Overhead
[Transparency Badge] Open Architecture (ADRs Published)

"Used by teams at:" [Logo placeholders]
```

#### 6. Use Case Highlights
```
"Proven Use Cases"

1. SRE: Incident Prevention
   → Discovered: "PII access without audit log" in 10% of traces
   → Result: Prevented compliance violation before audit

2. Developer: API Misuse Detection
   → Rule: "Authentication required before data access"
   → Result: 50 violations caught in staging, zero in production

3. Compliance: SOC2 Evidence Generation
   → Control CC6.1: Authorization checks
   → Result: 100% automated evidence collection for audit
```

**CTA:** "Explore Use Case Library" (links to PRD-103)

#### 7. Pricing/CTA Section
```
"Start with BeTrace Today"

[Three columns]

Column 1: Self-Hosted (Open Source)
- Deploy BeTrace packages yourself
- Community support
- Full feature access
CTA: "View GitHub"

Column 2: Managed Trial
- 30-day evaluation
- Pre-configured demo environment
- Slack support channel
CTA: "Request Trial Access"

Column 3: Enterprise
- SOC2 Type II compliance
- Dedicated support
- Custom integrations
CTA: "Contact Sales"
```

**Form Fields (Minimal):**
- Email (required)
- Company (optional)
- Use case (dropdown: SRE, Developer, Compliance, Other)

### Technical Requirements

#### Performance
- **Page Load:** <2 seconds (target: 1.5s)
- **First Contentful Paint (FCP):** <1s
- **Time to Interactive (TTI):** <2s
- **Lighthouse Score:** >90

**Optimization:**
- Static site generation (Astro or Next.js)
- Image optimization (WebP, lazy loading)
- Minimal JavaScript (<100KB bundle)
- CDN distribution (Cloudflare)

#### Responsive Design
- Mobile-first CSS (Tailwind)
- Breakpoints: 320px, 768px, 1024px, 1440px
- Touch-optimized CTAs (44px minimum tap target)

#### Analytics
- PostHog for behavior tracking
- Conversion funnel: Landing → Demo/Docs → Form → Trial
- Heatmaps for scroll depth and click patterns
- A/B testing framework (headline, CTA copy)

#### SEO
- Meta title: "BeTrace - Behavioral Assurance for OpenTelemetry | Incident Prevention"
- Meta description: "Turn OpenTelemetry traces into behavioral invariants. Discover patterns, prevent incidents, generate compliance evidence."
- Open Graph tags for social sharing
- Structured data (JSON-LD) for rich snippets

### Content Requirements

#### Copy Principles
1. **Clarity over Cleverness**: Technical accuracy, no buzzwords
2. **Benefit-Driven**: Lead with "what problem does this solve?"
3. **Persona-Specific**: Different messaging for SRE vs Compliance
4. **Proof Over Claims**: "9.5/10 Security Expert rating" vs "Highly secure"

#### Tone
- Confident but honest ("Built with SOC2 controls" not "SOC2 certified")
- Technical but accessible (explain "behavioral assurance")
- Transparent (link to ADRs, compliance-status.md)

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Choose framework: Astro (recommended for performance)
2. Set up project structure: `/marketing-site`
3. Implement hero section + problem statement
4. Add analytics (PostHog SDK)
5. Deploy preview environment (Vercel/Netlify)

### Phase 2: Content (Week 1-2)
1. Write copy for all 7 sections
2. Create workflow diagrams (animated SVG)
3. Design CTA buttons (A/B test 2 variants)
4. Add compliance badges + transparency links

### Phase 3: Optimization (Week 2)
1. Performance audit (Lighthouse CI)
2. Mobile responsive testing (BrowserStack)
3. A/B test headline variants
4. Set up conversion tracking

### Phase 4: Launch (End of Week 2)
1. Domain setup: `marketing.betrace.dev` or `betrace.com`
2. CDN configuration (Cloudflare)
3. SSL certificate
4. DNS cutover
5. Monitor conversion metrics

## Testing Strategy

### Performance Testing
- Lighthouse CI in GitHub Actions
- WebPageTest from multiple regions
- Core Web Vitals monitoring

### A/B Testing Plan
**Test 1: Headline Variants**
- A: "Behavioral Assurance for OpenTelemetry Data"
- B: "Turn Traces Into Incident Prevention Rules"
- Metric: Bounce rate, time on page

**Test 2: CTA Copy**
- A: "Try Interactive Demo"
- B: "See BeTrace in Action"
- Metric: Click-through rate

**Test 3: Form Length**
- A: Email only
- B: Email + Company + Use Case
- Metric: Conversion rate

### User Testing
- 5 SREs: "Can you understand what BeTrace does in 30 seconds?"
- 5 Engineering Managers: "Would this help you evaluate BeTrace?"
- 3 Compliance Officers: "Is the compliance messaging clear?"

## Dependencies

- **PRD-101**: Interactive demo embed (parallel development)
- **PRD-102**: Technical docs site (link target)
- **PRD-103**: Use case library (link target)

## Risks & Mitigations

### Risk: Page too technical for non-SRE buyers
**Mitigation:** Dedicated compliance/management section with business-focused benefits

### Risk: Conversion rate below 2%
**Mitigation:** A/B testing program, monthly optimization reviews

### Risk: Confusing positioning (APM vs SIEM vs BeTrace)
**Mitigation:** "BeTrace is NOT" section, comparison pages (PRD-105)

## Open Questions

1. Should we gate the interactive demo (PRD-101) or keep ungated?
   - **Recommendation:** Ungated (68.7% CTR boost for ungated demos)

2. What's the minimum viable form for trial signup?
   - **Recommendation:** Email only (each field = -4-8% conversion)

3. Should we show pricing on landing page?
   - **Recommendation:** Yes (transparency builds trust), but focus on "Contact Sales"

## Success Criteria

- ✅ Page loads in <2 seconds (P50)
- ✅ Conversion rate 2-3% within first month
- ✅ Bounce rate <40%
- ✅ 90+ Lighthouse performance score
- ✅ Positive feedback from 8/10 user testers

## References

- [Unbounce B2B SaaS Conversion Benchmarks 2025](https://unbounce.com/conversion-rate-optimization/b2b-conversion-rates/)
- [State of Interactive Product Demos 2025](https://www.navattic.com/report/state-of-the-interactive-product-demo-2025)
- ADR-011: Pure Application Framework (marketing site is external to core packages)
- [compliance-status.md](../compliance-status.md) - Honest compliance claims
