# BeTrace Brand Guidelines

**Version 1.0.0** - October 2025

This document defines the BeTrace brand identity, visual system, and usage guidelines.

---

## Table of Contents

1. [Brand Story](#brand-story)
2. [Mission & Vision](#mission--vision)
3. [Brand Principles](#brand-principles)
4. [Visual Identity](#visual-identity)
5. [Voice & Tone](#voice--tone)
6. [Usage Guidelines](#usage-guidelines)

---

## Brand Story

### Why BeTrace Exists

**The Problem**: Distributed systems fail in complex, multi-span patterns that single-metric monitoring and query-based observability can't catch. TraceQL finds spans; it doesn't enforce behavior. Teams rely on post-incident analysis instead of prevention.

**The Insight**: Behavioral invariants ("auth failure → retry within 5s") can be codified as rules and continuously validated in production—if you have the right tool.

**The Solution**: BeTrace brings behavioral assertions to Grafana. Write rules in BeTraceDSL. Test them on historical traces (time-travel replay). Catch violations before they become incidents. Alert on patterns, not just metrics.

### What BeTrace Is

BeTrace is a **Grafana plugin** that adds behavioral pattern matching to OpenTelemetry traces.

**Not**: A standalone monitoring platform, a SIEM, an APM tool
**Is**: A native Grafana integration that enforces behavioral invariants on traces

### What BeTrace Does

1. **You define patterns** in BeTraceDSL (e.g., "PII access requires audit log")
2. **BeTrace watches traces** flowing through Tempo
3. **Violations become spans** queryable in Grafana Explore
4. **You alert on patterns** via Grafana Alerting → Slack, PagerDuty, etc.

---

## Mission & Vision

### Mission
**Prevent incidents by turning implicit behavioral expectations into explicit, continuously validated rules.**

### Vision
**A world where distributed systems' behavioral invariants are as well-tested in production as code is in CI/CD.**

### Values

1. **Clarity Over Cleverness**
   - Simple, obvious solutions > complex abstractions
   - Examples > jargon
   - Clear documentation > marketing fluff

2. **Integration Over Invention**
   - Build on Grafana, don't compete
   - Leverage OpenTelemetry standards
   - Work with existing tools (Tempo, Alerting)

3. **Prevention Over Reaction**
   - Catch violations before incidents
   - Time-travel testing (replay rules on history)
   - Shift left for production monitoring

4. **Trust Through Transparency**
   - Open-source first
   - Clear ROI metrics
   - Honest about limitations

---

## Brand Principles

### 1. Professional Yet Approachable

**What This Means**:
- Technical credibility without intimidation
- Enterprise-ready without corporate stuffiness
- Accessible to developers, trusted by executives

**In Practice**:
- Use "behavioral assertions" not "behavioral assurance system"
- Show code examples, not just diagrams
- Quantify value (incidents prevented, ROI) not vague benefits

### 2. Grafana-First

**What This Means**:
- BeTrace exists to enhance Grafana, not replace it
- Visual identity aligns with Grafana's design language
- Messaging emphasizes integration, not competition

**In Practice**:
- Lead with "Grafana plugin" in descriptions
- Use Grafana orange as accent color
- Screenshots always show BeTrace inside Grafana UI

### 3. Problem-Focused

**What This Means**:
- Start with customer pain, not product features
- Concrete examples > abstract capabilities
- "Turn last week's incident into a rule" > "Advanced pattern matching"

**In Practice**:
- Hero sections lead with problem statements
- Use cases are real-world (auth retries, PII auditing, agent monitoring)
- Every feature tied to outcome (prevent incidents, prove compliance, monitor AI)

---

## Visual Identity

### Logo

**Status**: Design in progress (see [LOGO_USAGE.md](logo/LOGO_USAGE.md))

**Concept**:
- Wordmark: "BeTrace" (capital B, capital T)
- Icon: Overlapping circles forming Venn diagram with checkmark (✓) in intersection
  - Left circle: "Be" (behavior)
  - Right circle: "Trace"
  - Intersection: ✓ (where behavior meets traces = assertions passing)

**Variations**:
- Full logo (wordmark + icon)
- Icon only (40x40px for Grafana plugin)
- Monochrome (white on dark, dark on white)

### Color Palette

See [COLOR_PALETTE.md](colors/COLOR_PALETTE.md) for full specifications.

**Primary**:
- Deep Teal (#0A7C91) - Behavior, trust, technical credibility

**Secondary**:
- Grafana Orange (#FF8C00) - Ecosystem integration, energy

**Accent**:
- Success Green (#00D084) - Validation, assertions passing

**Neutral**:
- Dark Gray (#1A1A1A) - Text
- Light Gray (#F5F5F5) - Backgrounds

### Typography

See [TYPOGRAPHY.md](typography/TYPOGRAPHY.md) for full specifications.

**Headings**: Inter Bold
**Body Text**: Inter Regular
**Code**: JetBrains Mono (monospace)

**Rationale**: Inter is Grafana's font. Alignment reinforces ecosystem integration.

### Imagery

**Style**:
- Clean, modern screenshots (actual product, not mockups)
- Minimal illustrations (geometric, not hand-drawn)
- Code examples with syntax highlighting
- Diagrams: simple, clear, not cluttered

**Avoid**:
- Generic stock photos
- Bee imagery (we're BeTrace, not TraceBee)
- Complex flowcharts
- Gratuitous animations

---

## Voice & Tone

See [VOICE_AND_TONE.md](voice-tone/VOICE_AND_TONE.md) for detailed guidelines.

### Brand Voice (Consistent Across All Content)

**Attributes**:
- **Clear**: Jargon-free explanations, concrete examples
- **Confident**: Backed by data (AI Safety Report, ROI metrics)
- **Helpful**: Problem-solving focus, educational tone
- **Direct**: Get to the point, no fluff

### Tone (Varies by Context)

**Documentation**: Instructional, precise
**Marketing**: Problem-focused, outcome-driven
**Sales**: Value-oriented, ROI-focused
**Support**: Patient, solution-focused

### Writing Principles

1. **Active Voice**: "BeTrace catches violations" not "Violations are caught by BeTrace"
2. **Short Sentences**: Average 15-20 words max
3. **Concrete Examples**: "Auth retry within 5s" not "temporal constraints"
4. **Second Person**: "You write rules" not "Users write rules"

---

## Usage Guidelines

### Name & Capitalization

**Correct**:
- BeTrace (capital B, capital T)
- BeTraceDSL (our domain-specific language)
- "the BeTrace plugin" (lowercase "p")

**Incorrect**:
- ❌ BTrace (missing "e")
- ❌ Be Trace (space)
- ❌ betrace (all lowercase, except in code/URLs)
- ❌ BETRACE (all caps)

### Describing BeTrace

**One-Sentence Description**:
"BeTrace is a Grafana plugin that enforces behavioral patterns on OpenTelemetry traces, catching multi-span invariant violations that TraceQL queries can't detect."

**Tagline Options** (Approved):
1. "Behavioral assertions for Grafana" (primary)
2. "Pattern matching for trace behavior" (technical)
3. "Make your traces behave" (action-oriented)

**Category**:
- Behavioral pattern matching (preferred)
- Behavioral assertions
- Trace pattern enforcement

### What BeTrace Is / Is Not

**IS**:
✅ A Grafana plugin (App + Datasource)
✅ Behavioral pattern matching for traces
✅ Multi-span invariant validation
✅ Integrated with Tempo, Alerting, Explore

**IS NOT**:
❌ NOT a standalone monitoring platform
❌ NOT a replacement for Grafana Alerting
❌ NOT a TraceQL replacement (it's complementary)
❌ NOT a SIEM or security tool (though supports AI safety)

### Comparing to Other Tools

**vs TraceQL**:
- "TraceQL finds spans. BeTrace enforces patterns."
- "TraceQL queries individual traces. BeTrace validates behavior across multiple spans and traces."

**vs Grafana Alerting**:
- "Alerting reacts to metric thresholds. BeTrace validates behavioral invariants."
- "Use both: BeTrace violations trigger Grafana Alerting rules."

**vs Standalone Monitoring**:
- "BeTrace works where you already work—inside Grafana."
- "No new tools to learn, no context switching."

### Code Examples

**Always use syntax highlighting**:
```javascript
// BeTraceDSL example
rule "Auth Retry Required"
when
  $trace: Trace(
    has(auth.failure),
    not has(auth.retry, within=5s)
  )
then
  betrace.signal("AUTH_RETRY_MISSING", $trace);
end
```

**Show result in Tempo**:
```
// Query violations in Grafana Explore
{span.betrace.violation = "AUTH_RETRY_MISSING"}
```

### Screenshots

**Requirements**:
- Show BeTrace inside Grafana UI (not standalone)
- Use light theme (Grafana default)
- Include Grafana navigation sidebar (context)
- Highlight relevant sections (red box or annotation)

**Recommended Shots**:
1. Monaco editor with BeTraceDSL syntax highlighting
2. Grafana Explore showing violation spans
3. Grafana Alerting rule based on BeTrace datasource
4. Dashboard with violation metrics

---

## Grafana Plugin Marketplace Guidelines

### Plugin Title
"BeTrace - Behavioral Assertions for Tempo"

### Short Description (140 characters max)
"Enforce behavioral patterns on OpenTelemetry traces. Catch multi-span invariant violations that TraceQL can't detect."

### Keywords/Tags
- Observability
- Traces
- Pattern Matching
- Behavioral Monitoring
- Tempo
- OpenTelemetry
- Compliance
- AI Safety
- Invariants

### Category
- Observability → Distributed Tracing

---

## Brand Evolution

### Migration from FLUO

**Timeline**:
- **Month 1-3**: Dual branding ("BeTrace, formerly FLUO")
- **Month 4+**: Full cutover (FLUO aliased but not promoted)

**Messaging**:
- "FLUO is now BeTrace—same power, clearer name"
- Emphasize: all features remain, better explains what we do

### Version History

- **v1.0.0** (Oct 2025): Initial BeTrace rebrand from FLUO

---

## Approval & Contact

**Brand Owner**: Product Marketing Team
**Questions**: See [branding/README.md](../README.md)
**Updates**: Submit PR with proposed changes

**Last Reviewed**: 2025-10-23
**Next Review**: 2026-01-23 (Quarterly)
