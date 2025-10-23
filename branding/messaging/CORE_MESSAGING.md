# BeTrace Core Messaging

**Version 1.0.0** - October 2025

This document defines the BeTrace positioning, value propositions, and core messaging framework.

---

## Table of Contents

1. [Positioning Statement](#positioning-statement)
2. [Taglines](#taglines)
3. [One-Sentence Descriptions](#one-sentence-descriptions)
4. [Value Propositions](#value-propositions)
5. [Key Differentiators](#key-differentiators)
6. [Messaging by Audience](#messaging-by-audience)
7. [Problem-Solution Framing](#problem-solution-framing)

---

## Positioning Statement

### Primary Positioning

**For** SREs, compliance teams, and AI safety engineers
**Who** need to enforce behavioral invariants on distributed traces
**BeTrace** is a Grafana plugin
**That** adds behavioral pattern matching to OpenTelemetry traces
**Unlike** TraceQL queries or metric-based alerting
**BeTrace** catches multi-span invariant violations that single-metric monitoring can't detect

### Expanded Positioning

BeTrace brings behavioral assertions to Grafana. You define patterns in BeTraceDSL (e.g., "auth failures must retry within 5 seconds"), BeTrace watches your Tempo traces, and violations become queryable spans you can alert on—right inside Grafana. No new tools, no context switching, no surprises.

---

## Taglines

### Primary Tagline
**"Behavioral assertions for Grafana"**

**Use When**: General marketing, homepage, Grafana plugin listing

### Alternative Taglines (Approved)

**Technical Audiences**:
- "Pattern matching for trace behavior"
- "Enforce invariants on OpenTelemetry traces"

**Action-Oriented**:
- "Make your traces behave"
- "Write rules, not queries"

**Problem-Focused**:
- "Catch violations before incidents"
- "Turn incidents into preventive rules"

### Tagline Usage Guidelines

**Do**:
- ✅ Use primary tagline for consistency
- ✅ Pair with logo in marketing materials
- ✅ Include in email signatures, social bios

**Don't**:
- ❌ Create new taglines without approval
- ❌ Mix multiple taglines in same context
- ❌ Use taglines as full sentences (no period at end)

---

## One-Sentence Descriptions

### Short (< 100 characters)
"BeTrace enforces behavioral patterns on OpenTelemetry traces inside Grafana."

**Use When**: Twitter/X bio, short descriptions, metadata

### Standard (100-140 characters)
"BeTrace is a Grafana plugin that enforces behavioral patterns on OpenTelemetry traces, catching multi-span violations that TraceQL can't."

**Use When**: Grafana plugin listing (short description), LinkedIn company description

### Long (140-200 characters)
"BeTrace is a Grafana plugin that adds behavioral pattern matching to OpenTelemetry traces. Write rules in BeTraceDSL, catch violations in Tempo, and alert via Grafana Alerting—all in one tool."

**Use When**: Homepage hero, GitHub README, full descriptions

---

## Value Propositions

### Core Value Prop (Universal)

**Statement**:
"Prevent incidents by enforcing behavioral invariants on your distributed traces—inside the Grafana you already use."

**Supporting Points**:
1. **Multi-Span Patterns**: TraceQL finds spans → BeTrace enforces behavior across spans
2. **Time-Travel Replay**: Test rules on historical traces before deploying to production
3. **Native Integration**: Works inside Grafana—no new tools, no context switching

### Value Prop by Benefit

#### Prevent Incidents (SRE Focus)
**Statement**: "Turn last week's incident into a preventive rule that runs forever."

**How It Works**:
1. Incident happens (e.g., auth failures without retries)
2. Write BeTrace rule: `trace.has(auth.failure) → trace.has(auth.retry, within=5s)`
3. Deploy rule → catch violations before they become incidents

**ROI**: 1 prevented incident = 3am pages avoided + reputation protected + customer trust maintained

#### Prove Compliance (Compliance Focus)
**Statement**: "Prove your controls work with queryable evidence from production traces."

**How It Works**:
1. Define compliance patterns (e.g., "PII access requires audit log")
2. BeTrace emits violation spans when patterns break
3. Query evidence via Tempo TraceQL for auditors

**ROI**: Automated compliance evidence = faster audits + lower audit costs + continuous validation

#### Monitor AI Safety (AI Safety Focus)
**Statement**: "Monitor AI agent behavior in production where testing fails."

**How It Works**:
1. Define behavioral boundaries (e.g., "agent accesses only authorized databases")
2. BeTrace watches every agent operation
3. Violations trigger alerts before damage occurs

**ROI**: Early detection of goal deviation, prompt injection, unauthorized tool use

---

## Key Differentiators

### vs. TraceQL (Tempo's Query Language)

**TraceQL**: Finds individual spans and traces
**BeTrace**: Enforces patterns across multiple spans and traces

**Example**:
- **TraceQL**: `{span.http.status_code = 500}` → Find all error spans
- **BeTrace**: `trace.has(auth.failure) → trace.has(auth.retry, within=5s)` → Enforce retry behavior

**Message**: "TraceQL finds spans. BeTrace enforces behavior."

### vs. Grafana Alerting (Alone)

**Grafana Alerting**: Reacts to metric thresholds
**BeTrace**: Validates behavioral invariants as rules

**Example**:
- **Alerting**: "Alert if error rate > 5%"
- **BeTrace**: "Alert if PII accessed without audit log"

**Message**: "Use both: BeTrace violations trigger Grafana Alerting rules."

### vs. Standalone Monitoring Tools

**Others**: Separate dashboard, new UI to learn, context switching
**BeTrace**: Native Grafana plugin, works where you already work

**Example**:
- **Others**: Deploy new monitoring platform + integrate with Grafana
- **BeTrace**: `grafana-cli plugins install betrace` → done

**Message**: "BeTrace works where you already work—inside Grafana."

### vs. Post-Incident Analysis

**Current State**: Incident happens → postmortem → hope it doesn't repeat
**BeTrace State**: Incident happens → write rule → prevent future occurrences

**Example**:
- **Before**: "Auth retry storm caused outage. Fixed."
- **After**: "Auth retry storm rule deployed. Will never happen again."

**Message**: "Shift from reactive to preventive."

---

## Messaging by Audience

### SREs (Site Reliability Engineers)

**Pain Points**:
- 3am pages from repeat incidents
- Tribal knowledge ("everyone knows you have to retry auth failures")
- Postmortems that don't prevent recurrence

**Messaging**:
- **Hook**: "Turn last week's incident into a rule"
- **Value**: Prevent repeat incidents, codify tribal knowledge, sleep through the night
- **Proof**: "Auth retry within 5s" catches the bug that paged you at 3am

**Example Message**:
"You know that auth retry bug that paged you at 3am last week? Write a BeTrace rule: `trace.has(auth.failure) → trace.has(auth.retry, within=5s)`. Now you'll catch it before it becomes an incident. Forever."

### Compliance Officers

**Pain Points**:
- Manual audit evidence collection
- Can't prove controls work continuously
- Compliance as checkbox, not culture

**Messaging**:
- **Hook**: "Prove your controls work with queryable evidence"
- **Value**: Automated evidence generation, continuous compliance, faster audits
- **Proof**: SOC2 CC6.1 evidence automatically generated from production traces

**Example Message**:
"Your auditor asks: 'How do you ensure PII access is always logged?' BeTrace rule: `trace.has(pii.access) → trace.has(audit.log)`. Violations query: `{span.betrace.violation = "PII_AUDIT_MISSING"}`. Evidence delivered."

### AI Safety Engineers

**Pain Points**:
- Testing fails for AI agents (they distinguish test from production)
- No way to monitor agent behavior in production
- Prompt injection, goal deviation, unauthorized tool use

**Messaging**:
- **Hook**: "Monitor AI agent behavior in production"
- **Value**: Runtime behavioral monitoring, early warning for misbehavior
- **Proof**: Detects goal deviation, prompt injection, unauthorized database access

**Example Message**:
"AI agents behave differently in production than in tests. BeTrace watches every agent operation for goal deviation, prompt injection, and unauthorized tool use—catching misbehavior before damage occurs."

### Developers (Secondary Audience)

**Pain Points**:
- Service contracts are documentation, not enforcement
- API misuse causes incidents
- No way to validate cross-service behavior

**Messaging**:
- **Hook**: "Service contracts as code, not docs"
- **Value**: Enforce API contracts, catch misuse before production
- **Proof**: "Payment → fraud check → auth" enforced as pattern

**Example Message**:
"Your service contract says 'payment requires fraud check.' BeTrace enforces it: `trace.has(payment) → trace.has(fraud.check, before=payment)`. No more hoping consumers read the docs."

### Executive Buyers (C-Level, VPs)

**Pain Points**:
- Incidents damage reputation
- Compliance audits are expensive
- AI safety risks unclear

**Messaging**:
- **Hook**: "Prevent incidents, prove compliance, monitor AI—all in one tool"
- **Value**: Risk reduction, cost savings, competitive differentiation
- **Proof**: 35-437x ROI, payback < 2 months

**Example Message**:
"BeTrace prevents incidents by enforcing behavioral patterns on your traces. One prevented incident pays for 5+ years. Plus: automated compliance evidence, AI safety monitoring, all inside Grafana."

---

## Problem-Solution Framing

### Problem-First Messaging

**Principle**: Lead with customer pain, not product features

#### Structure:
1. **Problem** (Relatable pain point)
2. **Why It's Hard** (Context, failed attempts)
3. **Solution** (BeTrace's approach)
4. **Proof** (Example, ROI, social proof)

#### Example (SRE):

**Problem**: "You're paged at 3am because auth failures didn't retry. Again."

**Why It's Hard**: "Testing didn't catch it because the bug only happens under production load. Your monitoring alerted after the damage was done."

**Solution**: "BeTrace enforces behavioral patterns in production. Rule: `trace.has(auth.failure) → trace.has(auth.retry, within=5s)`. Violations alert before incidents."

**Proof**: "Catch violations in real-time. Replay rules on historical traces to see when the bug started. Turn every incident into a preventive rule."

---

## Competitive Messaging

### Not Competitive, Complementary

**Principle**: BeTrace integrates with Grafana, doesn't compete

**Messaging**:
- "BeTrace enhances Grafana with behavioral pattern matching"
- "Use BeTrace + Tempo + Grafana Alerting together"
- "We don't replace anything—we add a missing capability"

### Positioning Against Alternatives

#### TraceQL
"TraceQL queries find spans. BeTrace rules enforce behavior. Use both."

#### Grafana Alerting
"Alerting reacts to thresholds. BeTrace validates invariants. Violations trigger alerts."

#### Datadog, Honeycomb, Dynatrace
"Great APM tools. BeTrace adds behavioral pattern matching they don't have—inside Grafana."

#### LangSmith (AI-specific)
"LangSmith monitors LLM calls. BeTrace monitors any AI system via OpenTelemetry traces—agents, embeddings, RAG, all of it."

---

## Messaging Do's and Don'ts

### Do's ✅

**Problem-First**:
- ✅ Lead with customer pain ("3am pages", "manual audit evidence")
- ✅ Use concrete examples ("auth retry within 5s")
- ✅ Quantify value (ROI, incidents prevented)

**Clarity**:
- ✅ Use simple language ("behavioral patterns" not "behavioral assurance system")
- ✅ Show code examples (BeTraceDSL syntax)
- ✅ Compare to familiar tools (TraceQL, Grafana Alerting)

**Grafana-First**:
- ✅ Emphasize "Grafana plugin" in descriptions
- ✅ Show screenshots inside Grafana UI
- ✅ Highlight integration (Tempo, Alerting, Explore)

### Don'ts ❌

**Jargon**:
- ❌ Don't say "behavioral assurance system" (too technical)
- ❌ Don't bury the lead ("OpenTelemetry data" before value)
- ❌ Don't use acronyms without explanation (BDSL → BeTraceDSL)

**Confusion**:
- ❌ Don't explain what BeTrace is NOT (confusing)
- ❌ Don't hide Grafana dependency (it's a feature!)
- ❌ Don't compare to unrelated tools (SIEM, security)

**Features Over Benefits**:
- ❌ Don't lead with "pattern matching engine" (feature)
- ✅ Do lead with "prevent incidents" (benefit)

---

## Key Messages (Approved)

### Homepage Hero
"Behavioral assertions for Grafana. Catch violations before incidents."

### Grafana Plugin Listing
"Enforce behavioral patterns on OpenTelemetry traces. Catch multi-span invariant violations that TraceQL queries can't detect."

### GitHub README
"BeTrace adds behavioral pattern matching to Grafana. Write rules in BeTraceDSL, test on historical traces, alert on violations—all inside Grafana."

### Sales Pitch (30 seconds)
"BeTrace is a Grafana plugin that enforces behavioral patterns on your traces. You write rules like 'auth failures must retry within 5 seconds.' BeTrace watches every trace. Violations become queryable spans you can alert on. Prevent incidents, prove compliance, monitor AI—inside the Grafana you already use."

### Email Signature
"BeTrace - Behavioral assertions for Grafana | behaviortrace.dev"

### Twitter/LinkedIn Bio
"BeTrace enforces behavioral patterns on OpenTelemetry traces inside Grafana. Prevent incidents, prove compliance, monitor AI."

---

## Messaging Testing & Validation

### A/B Test Ideas

**Homepage Hero**:
- A: "Behavioral assertions for Grafana"
- B: "Make your traces behave"
- Metric: Click-through rate to "Install Plugin"

**Value Prop Framing**:
- A: "Prevent incidents by enforcing patterns"
- B: "Turn last week's incident into a preventive rule"
- Metric: Demo request rate

**Audience-Specific Landing Pages**:
- A: Generic (all audiences)
- B: SRE-focused ("3am pages")
- C: Compliance-focused ("automated evidence")
- Metric: Conversion to trial/demo

### Feedback Collection

**User Interviews**:
- "What do you think BeTrace does?"
- "How would you describe BeTrace to a colleague?"
- "What pain point does BeTrace solve for you?"

**Survey Questions**:
- "How clear is our homepage message? (1-10)"
- "What's the #1 benefit of BeTrace for you?"
- "Would you recommend BeTrace? Why/why not?"

---

## Version History

- **v1.0.0** (Oct 2025): Initial BeTrace core messaging framework

**Last Reviewed**: 2025-10-23
**Next Review**: 2026-01-23 (Quarterly, based on user feedback)
