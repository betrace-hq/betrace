# BeTrace Positioning - Canonical Reference

**Version**: 1.0
**Last Updated**: 2025-11-02
**Status**: ✅ AUTHORITATIVE - All materials must align with this document

---

## ⚠️ Single Source of Truth

This document is the **canonical reference** for BeTrace positioning. All marketing materials, documentation, sales decks, and product descriptions MUST align with this positioning.

**If there's a conflict**: This document wins.

**To propose changes**: Update this document first, then cascade changes to other materials.

---

## Core Product Definition

### What BeTrace Is

**One-Sentence Description**:
> BeTrace is a Grafana plugin for behavioral pattern matching on OpenTelemetry traces.

**Expanded Description** (use this in marketing):
> BeTrace enables behavioral assurance through continuous production monitoring. It validates that distributed systems behave as expected by matching trace patterns against user-defined rules, catching violations that pre-deployment testing misses.

**Technical Description** (use this in technical docs):
> BeTrace processes OpenTelemetry traces through a rule engine (BeTraceDSL) to detect behavioral patterns and invariant violations. When patterns match, BeTrace emits violation spans to Tempo, enabling alerting through Grafana.

---

## Core Workflow

```
OpenTelemetry Traces → Rules (Invariants) → ViolationSpans (to Tempo) → Grafana Alerts
```

**Key Components**:
1. **Input**: OpenTelemetry traces from ANY instrumented system
2. **Processing**: BeTraceDSL pattern matching engine
3. **Output**: Violation spans (queryable in Tempo, alertable in Grafana)

---

## What BeTrace Is NOT

Use these exact disclaimers in ALL materials:

- ❌ **Not a SIEM/SOAR/security incident response platform**
- ❌ **Not an IOC-based threat detection system**
- ❌ **Not a generic observability/APM tool**
- ❌ **Not pre-deployment testing** (we monitor production behavior)
- ❌ **Not SOC2/HIPAA certified** (generates evidence, not certification)
- ❌ **Not AI-specific** (works on ANY OpenTelemetry traces)

---

## Market Positioning

### Primary Positioning (Use This)

**BeTrace is a general-purpose trace pattern matcher for production monitoring.**

**Target Markets** (list in this order, with equal weight):
1. **SRE / Site Reliability Engineering**: Incident prevention and investigation
2. **Compliance / GRC**: Evidence generation for SOC2, HIPAA, ISO27001
3. **DevOps / Platform Engineering**: Service contract validation
4. **Security**: API misuse detection, authorization pattern validation
5. **AI/ML Operations**: AI system behavior monitoring

**Key Insight** (use this instead of "Market Validation"):
> BeTrace provides **behavioral assurance through continuous production monitoring** - validating that systems behave as expected, catching violations that pre-deployment testing misses.

---

### Use Cases (List All Equally)

**When describing BeTrace capabilities, include ALL of these use cases with equal prominence**:

1. **SRE Incident Prevention**
   - Discover undocumented invariants that cause incidents
   - Rule replay: "When did this bug start?" (30 seconds vs days)
   - Post-mortem prevention: Codify assumptions as rules

2. **Compliance Evidence Generation**
   - Match trace patterns to prove control effectiveness
   - Example: "PII access requires audit log"
   - Generate compliance spans for SOC2/HIPAA audits

3. **Service Contract Validation**
   - Enforce API contracts across microservices
   - Detect breaking changes in production
   - Validate internal SLAs

4. **Security Pattern Detection**
   - Authorization-before-access validation
   - Cross-tenant isolation verification
   - Privilege escalation detection

5. **AI System Monitoring**
   - Agent behavioral validation (goal adherence)
   - Hallucination detection (citation requirements)
   - Bias detection (statistical distribution analysis)

**Critical Rule**: AI system monitoring is ONE use case among five, not the primary or only use case.

---

## AI Safety Positioning (How to Talk About It)

### ✅ CORRECT Positioning

**When discussing AI Safety Report**:
> The International AI Safety Report identified gaps in AI monitoring mechanisms. BeTrace's trace pattern matching capabilities can address some of these gaps as **one application** of its general-purpose behavioral monitoring.

**When listing use cases**:
> BeTrace monitors SRE incidents, compliance patterns, service contracts, security violations, **and AI system behavior**.

**When asked "Is BeTrace for AI?"**:
> BeTrace is a general-purpose trace pattern matcher that works on ANY OpenTelemetry traces - APIs, databases, microservices, and yes, AI systems. AI monitoring is one of multiple use cases.

### ❌ INCORRECT Positioning

**NEVER say**:
- "BeTrace is THE mechanism for AI safety"
- "BeTrace is an AI monitoring tool"
- "Validated by the AI Safety Report"
- "BeTrace fills the AI safety gap"
- "Built for AI safety"

**Why**: BeTrace is NOT AI-specific. The AI Safety Report quote refers to hardware mechanisms, not trace pattern matching. Over-indexing on AI limits market perception and is technically inaccurate.

---

## Competitive Positioning

### How We Compare to Others

**BeTrace is COMPLEMENTARY, not competitive**:

**vs. Observability Tools (Datadog, Honeycomb, New Relic)**:
- They monitor known metrics → BeTrace validates behavioral patterns
- They alert on thresholds → BeTrace alerts on pattern violations
- **Use together**: Their dashboards + Our invariant validation

**vs. Compliance Tools (Drata, Vanta)**:
- They prove controls exist → BeTrace proves controls work in production
- They collect evidence → BeTrace generates behavioral evidence
- **Use together**: Their workflows + Our trace-based proof

**vs. AI Monitoring (LangSmith, W&B)**:
- They debug prompts/chains → BeTrace validates behavioral patterns
- They test pre-deployment → BeTrace monitors production
- **Use together**: Their testing + Our production monitoring

**Key Message**: "BeTrace works WITH your existing tools, not instead of them."

---

## Unique Value Propositions

### What Makes BeTrace Different

**Use these differentiators in sales/marketing**:

1. **Cross-Span Pattern Matching**
   - **Capability**: Match patterns ACROSS spans (TraceQL can't do this)
   - **Example**: "Span A exists WITHOUT Span B", temporal ordering, counting
   - **Benefit**: Detect patterns impossible with existing tools

2. **Rule Replay**
   - **Capability**: Apply rules to historical traces retroactively
   - **Speed**: 30 seconds vs days of log reprocessing
   - **Benefit**: "When did this bug start?" answered instantly

3. **Grafana-Native**
   - **Capability**: Works within existing Grafana/Tempo workflow
   - **Integration**: Violation spans → Tempo → Grafana alerts
   - **Benefit**: No new tools to learn, works with existing stack

4. **General-Purpose**
   - **Capability**: Works on ANY OpenTelemetry traces
   - **Flexibility**: SRE, compliance, security, AI - same tool
   - **Benefit**: One platform for multiple use cases

---

## Performance Claims (How to Talk About Them)

### ✅ VERIFIED Claims (Use These)

**Simulation Testing**:
- "50x+ speedup over real-time testing (measured: 60s simulated in <1.2s)"
- "Deterministic reproducibility: same seed produces same execution sequence"
- "Extensive empirical validation through 2,500+ test runs"

**Test Coverage**:
- "83.2% test coverage with 138 tests"
- "0 race conditions detected"
- "16 critical bugs found and fixed via simulation testing"

**Backend Performance**:
- "Processes millions of spans per second"
- Note: If claiming specific throughput, measure and document

### ❌ UNVERIFIED Claims (Don't Use)

- ~~"2,354x speedup"~~ (not measured)
- ~~"100% reproducibility"~~ (too absolute)
- ~~"Mathematical certainty"~~ (simulation isn't formal verification)
- ~~"10,000+ crash tests"~~ (only 1000s verified)
- ~~"99.9998% uptime"~~ (not measured in production)

---

## Financial Claims (ROI / Pricing)

### ROI Calculation Rules

**ALWAYS include**:
1. **Methodology**: Show the calculation step-by-step
2. **Assumptions**: List all assumptions explicitly
3. **Disclaimer**: "Actual ROI varies by organization"

**Example (CORRECT)**:
```markdown
**ROI Calculation Example**:
• Potential malpractice claim: $5M (industry average)
• BeTrace cost: $30K/year (license + implementation)
• ROI: ($5M avoided - $30K cost) / $30K = 167x

**Note**: Actual ROI depends on incident frequency and prevention
effectiveness. This example assumes preventing one $5M claim per year.
```

**Example (INCORRECT)**:
```markdown
ROI: 167x in first 90 days ❌ (no methodology, no disclaimer)
```

### Standard Assumptions (Use These)

When calculating ROI, use these industry-standard assumptions:

- **Engineer cost**: $250K/year fully loaded ($10K/week, $1.5K/day)
- **Incident cost**: $5K-50K per incident (varies by severity)
- **Downtime cost**: $10K-500K per hour (varies by business)
- **Malpractice claims**: $2-5M average (healthcare)
- **Regulatory fines**: $10-50M (ECOA, GDPR violations)

**Always state which assumptions you're using**.

---

## Case Studies / Customer Examples

### How to Present Examples

**If Hypothetical** (current state):
```markdown
**Representative Scenario: Healthcare Use Case**

Pattern: "Diagnosis requires citation"
Hypothetical detection rate: 0.3-0.5% violations
Potential impact: Prevent malpractice liability
ROI calculation: Based on $2-5M avoided claim cost

**Note**: This is a representative example based on typical use cases.
Actual results vary by organization.
```

**If Real Customer** (future state, requires permission):
```markdown
**Customer: Regional Healthcare System (450 beds)**

• 12,847 diagnoses monitored
• 47 violations detected (0.37%)
• 0 patient harm incidents (vs. 2 pre-BeTrace)
• Customer testimonial: "[Quote with permission]"

**Results verified by customer, used with permission**.
```

**Critical Rule**: NEVER present hypothetical scenarios as real customer results. Always label clearly.

---

## Compliance Claims

### ✅ CORRECT Claims

- "BeTrace generates compliance evidence"
- "Provides trace-based proof for SOC2, HIPAA, ISO27001"
- "BeTrace is NOT certified for any compliance framework"
- "Evidence generation ≠ certification"

### ❌ INCORRECT Claims

- ~~"SOC2 certified"~~
- ~~"HIPAA compliant"~~
- ~~"Automates compliance"~~
- ~~"Ensures compliance"~~

**Standard Disclaimer** (include in ALL compliance materials):
> BeTrace generates compliance evidence through trace pattern matching.
> Certification requires external auditors (SOC2) or assessments (HIPAA).
> BeTrace provides the technical evidence, not the certification itself.

---

## Messaging Hierarchy

### Primary Message (Lead With This)

**Elevator Pitch** (30 seconds):
> BeTrace validates that distributed systems behave as expected through continuous production monitoring. We match trace patterns against user-defined rules, catching violations that testing misses - from SRE incidents to compliance gaps to API misuse.

**Value Proposition** (60 seconds):
> Traditional testing only covers known scenarios. BeTrace validates production behavior continuously. Define patterns once (like "PII access requires audit log"), and we alert when violations occur. Works with your existing Grafana/Tempo stack, monitors ANY OpenTelemetry traces.

**Differentiation** (90 seconds):
> Unlike observability tools that monitor metrics, we validate behavioral patterns. Unlike compliance tools that prove controls exist, we prove they work in production. And unlike testing tools, we monitor live systems. Plus, our rule replay lets you answer "when did this bug start?" in 30 seconds instead of days of log analysis.

---

## Terminology Standardization

### Preferred Terms (Use Consistently)

| Concept | Preferred Term | Avoid |
|---------|---------------|-------|
| Product type | Trace pattern matcher | AI monitoring tool |
| Core capability | Behavioral pattern matching | Behavioral assurance system |
| Rules | BeTraceDSL rules / Invariants | Policies / Guards |
| Output | Violation spans | Alerts / Events |
| Use case | Production monitoring | Real-time detection |
| Testing | Simulation testing | Deterministic simulation |
| Speed | 50x+ speedup (measured) | 2,354x speedup |
| Confidence | Deterministic reproducibility | 100% reproducibility |

---

## Target Personas

### Primary Buyers (List All Equally)

1. **VP Engineering / Director of SRE**
   - Pain: Incidents from violated assumptions
   - Value: Rule replay, incident prevention
   - Message: "Stop the same bug from happening twice"

2. **CISO / VP Security / Compliance Director**
   - Pain: Auditors ask "prove it works, not just exists"
   - Value: Behavioral compliance evidence
   - Message: "Prove your controls work in production"

3. **CTO / VP Infrastructure**
   - Pain: Cross-team integration incidents
   - Value: Service contract validation
   - Message: "Enforce API contracts across microservices"

4. **Head of AI/ML Engineering** (ONE of four, not the primary)
   - Pain: AI agents behave unpredictably in production
   - Value: Behavioral pattern detection
   - Message: "Monitor what your AI actually does"

---

## Revision History

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | 2025-11-02 | Initial canonical positioning | Post-review consolidation |

---

## How to Use This Document

### For Product Team
- Reference when writing technical docs
- Ensure feature descriptions align with positioning
- Flag any conflicts with this document

### For Marketing Team
- Use exact wording for core messages
- Reference approved performance claims
- Follow ROI calculation rules
- Check all materials against this doc

### For Sales Team
- Use elevator pitch verbatim
- Reference approved use cases
- Don't claim "first-mover" or "AI-only"
- Follow case study labeling rules

### When Creating New Materials
1. Read this document first
2. Use approved terminology
3. Include ALL use cases (not just AI)
4. Follow ROI/performance claim rules
5. Add disclaimers where required

---

## Conflict Resolution

**If any document conflicts with this positioning**:
1. This document (POSITIONING.md) is authoritative
2. Update the conflicting document to align
3. If you believe this document should change, propose update here first
4. Get approval before cascading changes

**Documents that MUST align** (in priority order):
1. `CLAUDE.md` - Product description
2. `README.md` - Repository intro
3. `docs/whitepaper-simulation-testing.md` - Technical credibility
4. `marketing/sales/BeTrace-Sales-Deck-Q1-2025.md` - Sales positioning
5. All other docs

---

## Approval & Maintenance

**Review Frequency**: Quarterly or when major positioning changes occur

**Next Review**: 2025-02-02

**Approval Required From**:
- [ ] Product Leadership (positioning strategy)
- [ ] Marketing Leadership (messaging alignment)
- [ ] Sales Leadership (sales readiness)

**Maintainer**: [To be assigned]

**Contact**: For questions about this positioning, reference this document first. If unclear, escalate to product/marketing leadership.

---

**Last Updated**: 2025-11-02
**Status**: ✅ ACTIVE - All materials must comply
**Version**: 1.0
