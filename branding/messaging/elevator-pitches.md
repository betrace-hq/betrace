# BeTrace Elevator Pitches

**Version 1.0.0** - October 2025

This document provides elevator pitch scripts for different time limits and audiences.

---

## Table of Contents

1. [30-Second Pitches](#30-second-pitches)
2. [1-Minute Pitches](#1-minute-pitches)
3. [5-Minute Pitches](#5-minute-pitches)
4. [Audience-Specific Variations](#audience-specific-variations)
5. [Demo Scripts](#demo-scripts)

---

## 30-Second Pitches

### Universal (All Audiences)

**Script**:
"BeTrace is a Grafana plugin that enforces behavioral patterns on your OpenTelemetry traces. You write rules in BeTraceDSL—things like 'auth failures must retry within 5 seconds' or 'PII access requires audit logs.' BeTrace watches every trace in Tempo. When patterns are violated, you get queryable spans you can alert on, all inside Grafana. Prevent incidents, prove compliance, monitor AI—no new tools to learn."

**Word Count**: 68 words
**Speaking Time**: ~28 seconds at normal pace

**Key Points**:
- ✅ What: Grafana plugin for behavioral patterns
- ✅ How: Write rules in DSL, watch traces, alert on violations
- ✅ Value: Prevent incidents, compliance, AI safety
- ✅ Integration: Inside Grafana (no new tools)

---

### Technical (Developer/SRE Focus)

**Script**:
"BeTrace adds behavioral pattern matching to Grafana. TraceQL finds spans—BeTrace enforces behavior across spans. Write rules like 'auth failure → retry within 5s' in BeTraceDSL. Violations become queryable spans in Tempo. You can even replay rules on historical traces to see when a bug started. Prevent incidents by turning postmortems into preventive rules."

**Word Count**: 54 words
**Speaking Time**: ~24 seconds

**Key Points**:
- ✅ Comparison: TraceQL vs BeTrace
- ✅ Technical detail: Time-travel replay
- ✅ SRE pain: Incidents → preventive rules

---

### Business (Executive/Buyer Focus)

**Script**:
"BeTrace prevents incidents before they happen by enforcing behavioral patterns on your distributed traces. It's a Grafana plugin—works where you already work. One prevented incident pays for 5+ years. Plus, it generates automated compliance evidence and monitors AI agent behavior in production. 35-437x ROI, payback under 2 months."

**Word Count**: 49 words
**Speaking Time**: ~22 seconds

**Key Points**:
- ✅ ROI: 35-437x, payback <2 months
- ✅ Risk reduction: Prevent incidents
- ✅ Compliance: Automated evidence
- ✅ AI safety: Agent monitoring

---

## 1-Minute Pitches

### Universal (All Audiences)

**Script**:
"BeTrace is a Grafana plugin that brings behavioral assertions to OpenTelemetry traces. Here's the problem: distributed systems fail in complex, multi-span patterns that single-metric monitoring can't catch. TraceQL lets you query traces, but it doesn't enforce behavior.

BeTrace fixes this. You define behavioral patterns in BeTraceDSL—rules like 'auth failures must retry within 5 seconds' or 'PII access requires audit logs.' BeTrace watches every trace flowing through Tempo. When a pattern is violated, BeTrace emits a violation span—queryable in Grafana Explore, alertable via Grafana Alerting.

The killer feature? Time-travel replay. Test rules on historical traces before deploying to production. See exactly when a bug started. Turn every incident into a preventive rule that runs forever. Works inside the Grafana you already use—no new tools, no context switching."

**Word Count**: 135 words
**Speaking Time**: ~58 seconds

**Key Points**:
- ✅ Problem: Multi-span patterns, testing gaps
- ✅ Solution: Behavioral rules + time-travel replay
- ✅ Integration: Inside Grafana
- ✅ Value: Incident prevention

---

### SRE Focus

**Script**:
"You know that feeling when you get paged at 3am for the same bug that happened last month? BeTrace stops that.

Here's how: After an incident, you write a BeTrace rule describing what *should* have happened. Example: 'Auth failures must retry within 5 seconds.' Deploy the rule. Now BeTrace watches every trace in Tempo, and if the pattern is violated—if auth fails without a retry—you get alerted *before* it cascades into an outage.

The best part? You can replay rules on historical traces. See exactly when the bug started. Validate your rule caught it. Then deploy to production with confidence.

BeTrace is a Grafana plugin—Monaco editor for rules, violations queryable in Explore, alerts via Grafana Alerting. Turn tribal knowledge into enforced patterns. Sleep through the night."

**Word Count**: 130 words
**Speaking Time**: ~56 seconds

**Key Points**:
- ✅ Pain: 3am pages, repeat incidents
- ✅ Solution: Rules codify expected behavior
- ✅ Time-travel: Replay on history
- ✅ Outcome: Sleep, not pages

---

### Compliance Focus

**Script**:
"How do you prove to auditors that your PII access controls work *continuously*—not just when they're watching?

BeTrace generates queryable compliance evidence from your production traces. You define behavioral patterns—like 'PII access requires audit log' or 'payment processing requires fraud check'—as BeTrace rules. If the pattern is violated, BeTrace emits a violation span to Tempo.

Your auditor asks: 'Show me that PII access is always logged.' You run a Tempo query: `{span.betrace.violation = "PII_AUDIT_MISSING"}`. Zero results? Controls work. Violations found? You have evidence with timestamps, trace IDs, and context.

It's a Grafana plugin, so evidence is queryable like any other trace. Continuous compliance, not checkbox compliance. Faster audits, lower costs, better sleep."

**Word Count**: 124 words
**Speaking Time**: ~54 seconds

**Key Points**:
- ✅ Pain: Manual compliance evidence
- ✅ Solution: Automated evidence from traces
- ✅ Proof: Queryable violations
- ✅ Outcome: Faster audits, continuous validation

---

### AI Safety Focus

**Script**:
"The International AI Safety Report—96 experts from 30 countries—concluded that 'testing is insufficient for AI agents because they can distinguish test from production.' So how do you monitor AI agent behavior in production?

BeTrace. You define behavioral boundaries as rules: 'Agent accesses only authorized databases,' 'Goal deviation score below threshold,' 'No prompt injection attempts.' BeTrace watches every agent operation via OpenTelemetry traces. Violations trigger alerts before damage occurs.

Example: Your legal research agent tries to access HR documents it's not authorized for. BeTrace detects it, emits a violation span, and you get alerted in real-time via Grafana Alerting.

It's production AI safety monitoring where testing fails. Detect goal deviation, prompt injection, unauthorized tool use—inside Grafana."

**Word Count**: 125 words
**Speaking Time**: ~54 seconds

**Key Points**:
- ✅ Authority: AI Safety Report validation
- ✅ Pain: Testing fails for agents
- ✅ Solution: Runtime behavioral monitoring
- ✅ Examples: Goal deviation, prompt injection

---

## 5-Minute Pitches

### Universal (With Demo)

**Script**:

**[Slide 1: Problem (30 seconds)]**
"Distributed systems fail in complex, multi-span patterns. Your auth service fails. No retry. Database times out. Cascading failure. Your monitoring alerts *after* the damage is done. TraceQL lets you *find* the error span, but it doesn't prevent the pattern from happening again.

This is the gap BeTrace fills."

**[Slide 2: Solution Overview (45 seconds)]**
"BeTrace is a Grafana plugin that enforces behavioral patterns on OpenTelemetry traces. You define rules in BeTraceDSL describing expected behavior. BeTrace watches traces in Tempo. Violations become queryable spans. You alert on them via Grafana Alerting.

Three core capabilities:
1. **Multi-span pattern matching**: TraceQL finds spans → BeTrace enforces behavior
2. **Time-travel replay**: Test rules on historical traces before deploying
3. **Native Grafana integration**: Works where you already work—no new tools"

**[Slide 3: Live Demo - Rule Creation (90 seconds)]**
"Let me show you. This is BeTrace inside Grafana. We're in the BeTrace App Plugin.

I'm going to write a rule: 'Auth failures must retry within 5 seconds.' Here's the BeTraceDSL:

```javascript
rule \"Auth Retry Required\"
when
  $trace: Trace(
    has(auth.failure),
    not has(auth.retry, within=5s)
  )
then
  betrace.signal(\"AUTH_RETRY_MISSING\", $trace);
end
```

Monaco editor gives us syntax highlighting, autocomplete, inline validation. Save the rule."

**[Slide 4: Demo - Time-Travel Replay (60 seconds)]**
"Now the killer feature: time-travel replay. I'm going to test this rule on traces from last week—when we had that auth incident.

Click 'Test Rule' → Select time range → Run replay.

See this? 47 violations detected. Here's the first one—trace ID, timestamp, spans involved. Click to view in Grafana Explore. There's the auth failure. No retry. This is the bug that caused our incident.

Now when I deploy this rule to production, we'll catch it before it cascades."

**[Slide 5: Demo - Violations & Alerting (45 seconds)]**
"Violations appear as spans in Tempo. Query them in Grafana Explore:

`{span.betrace.violation = \"AUTH_RETRY_MISSING\"}`

Create a Grafana Alerting rule: 'Alert if any AUTH_RETRY_MISSING violations in last 5 minutes.' Send to Slack, PagerDuty, email—whatever you use.

Now every auth failure without a retry triggers an alert *before* it becomes an incident."

**[Slide 6: Use Cases (30 seconds)]**
"Three primary use cases:
1. **SREs**: Turn incidents into preventive rules
2. **Compliance**: Automated evidence from traces (SOC2, HIPAA, GDPR)
3. **AI Safety**: Monitor AI agent behavior in production"

**[Slide 7: Integration & Deployment (20 seconds)]**
"Installation: `grafana-cli plugins install betrace`

Works with Tempo, Grafana Alerting, and Grafana Explore. Pure Grafana integration—no external services, no new dashboards."

**[Slide 8: ROI & Closing (20 seconds)]**
"One prevented incident pays for 5+ years. 35-437x ROI, payback under 2 months.

Questions?"

**Total Time**: ~5 minutes

**Materials Needed**:
- Grafana instance with BeTrace installed
- Sample traces (including violations)
- Monaco editor with BeTraceDSL syntax highlighting
- Pre-configured alerting rule (for demo)

---

## Audience-Specific Variations

### For Grafana Users (Already Using Tempo)

**30-Second**:
"You're using Tempo and Grafana Alerting. BeTrace adds one thing you're missing: behavioral pattern matching. TraceQL finds spans—BeTrace enforces patterns across spans. Install with `grafana-cli plugins install betrace`. Write rules in the App Plugin. Query violations in Explore. Alert via Grafana Alerting. Done."

**Key Points**:
- ✅ Assumes familiarity with Tempo, TraceQL
- ✅ Emphasizes "one missing piece"
- ✅ Installation simplicity

---

### For Non-Grafana Users (New to Ecosystem)

**30-Second**:
"BeTrace is part of the Grafana observability ecosystem. Grafana is an open-source dashboard platform. Tempo stores traces. BeTrace adds behavioral pattern matching on top. If you're evaluating observability stacks, Grafana + Tempo + BeTrace gives you metrics, logs, traces, *and* behavioral assertions—all in one place."

**Key Points**:
- ✅ Explains Grafana ecosystem
- ✅ Positions BeTrace as part of stack
- ✅ Comparison to alternatives (Datadog, Honeycomb)

---

### For AI Safety Researchers

**1-Minute**:
"The International AI Safety Report identified a critical gap: 'Reliable mechanisms for monitoring AI systems during deployment do not yet exist.' We built that mechanism.

BeTrace uses OpenTelemetry traces to monitor AI agent behavior in production. You instrument your agent code with OTel spans. BeTrace enforces behavioral patterns via rules: goal deviation thresholds, authorized tool use, prompt injection detection.

When patterns are violated, you get real-time alerts with full trace context. You can replay rules on historical agent operations to detect when misbehavior started.

Research use case: We're working with AI safety institutes to provide production trace data for safety research—the behaviors testing misses."

**Key Points**:
- ✅ Authority: AI Safety Report validation
- ✅ Research angle: Data for safety studies
- ✅ Production monitoring where testing fails

---

## Demo Scripts

### 3-Minute Live Demo (Conference Talk)

**Setup**:
- Grafana with BeTrace plugin installed
- Tempo with sample traces (some with violations)
- Pre-written rule ready to demonstrate

**Script**:

**[Open BeTrace App Plugin]** (10 seconds)
"This is BeTrace inside Grafana. I'm in the App Plugin where we manage rules."

**[Show Rule Editor]** (30 seconds)
"Here's a rule I wrote: 'PII access requires audit log.' BeTraceDSL syntax:

```javascript
rule \"PII Audit Required\"
when
  $trace: Trace(has(pii.access), not has(audit.log))
then
  betrace.signal(\"PII_AUDIT_MISSING\", $trace);
end
```

Monaco editor, syntax highlighting, autocomplete. Save."

**[Test Rule on History]** (45 seconds)
"Now I'm going to test this rule on traces from last week. Click 'Test Rule' → Select time range: Last 7 days → Run.

3 violations found. Click on the first one. Here's the trace—database query accessed PII column 'ssn', but there's no audit log span. This is a compliance gap.

See the trace ID, timestamp, exact spans involved. Click 'View in Grafana Explore.'"

**[Show Violation in Grafana Explore]** (30 seconds)
"Grafana Explore opens with the violation span highlighted. Full trace context. I can see what service made the call, which user, what time.

Query for all violations: `{span.betrace.violation = \"PII_AUDIT_MISSING\"}`. 3 results—same 3 we found in replay."

**[Show Alerting Setup]** (30 seconds)
"Now create a Grafana Alert: 'Notify if any PII_AUDIT_MISSING violations in last 5 minutes.' Send to Slack.

Rule deployed. Now every PII access without an audit log triggers an alert before auditors find it."

**[Closing]** (15 seconds)
"That's BeTrace: Write rules, test on history, alert on violations. All inside Grafana."

---

### 30-Second Demo (Sales Call)

**Setup**: Pre-recorded screencast or live Grafana instance

**Script**:
"Quick demo: This is BeTrace's rule editor in Grafana. I write a rule: 'Auth failures must retry within 5 seconds.' Test it on last week's traces—47 violations found. Here's the first violation in Grafana Explore. Deploy rule to production. Now we alert before incidents, not after."

**Visuals**:
1. Rule editor with syntax-highlighted code
2. Replay results (47 violations)
3. Violation span in Grafana Explore
4. Alerting rule configured

---

## Pitch Delivery Tips

### For 30-Second Pitches
- **Speak clearly**: 120-140 words per minute (conversational)
- **Pause strategically**: After "Grafana plugin", "BeTraceDSL", "Tempo"
- **Emphasize value**: "Prevent incidents", "inside Grafana", "no new tools"
- **End with action**: "Ready to see a demo?" or "Questions?"

### For 1-Minute Pitches
- **Problem first**: Lead with pain point
- **Solution second**: How BeTrace solves it
- **Proof third**: Example or ROI
- **Call to action**: "Want to see it live?"

### For 5-Minute Pitches
- **Use visuals**: Slides or live demo (not just talking)
- **Show, don't tell**: Demo > describing features
- **Interactive**: Ask "Does this resonate?" mid-pitch
- **Time management**: Leave 1-2 minutes for questions

---

## Common Follow-Up Questions

### "How is this different from Grafana Alerting?"

**Answer**:
"Grafana Alerting reacts to metric thresholds. BeTrace validates behavioral invariants. For example, Alerting can tell you 'error rate > 5%', but it can't tell you 'PII accessed without audit log.' BeTrace violations trigger Grafana Alerting rules—they work together."

### "Can I use this without OpenTelemetry?"

**Answer**:
"BeTrace requires OpenTelemetry traces. If you're not using OTel yet, we can help you instrument. Most modern systems already emit OTel traces, so it's often just configuration. Once you have traces flowing to Tempo, BeTrace plugs right in."

### "What's the performance impact?"

**Answer**:
"BeTrace analyzes traces asynchronously after they're written to Tempo. Zero impact on your application performance. Rule evaluation is <50ms per trace, scales to 10K+ traces per second."

### "How much does it cost?"

**Answer**:
"BeTrace is open-source (Apache 2.0). Enterprise support and managed hosting available. One prevented incident typically pays for 5+ years of enterprise support. ROI is 35-437x based on our customer data."

---

## Version History

- **v1.0.0** (Oct 2025): Initial BeTrace elevator pitch scripts

**Last Reviewed**: 2025-10-23
**Next Review**: After first 20 customer pitches (gather feedback, refine)
