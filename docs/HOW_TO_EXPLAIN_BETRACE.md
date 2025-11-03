# How to Explain BeTrace

**Last Updated**: 2025-11-02
**Status**: ✅ AUTHORITATIVE - Reflects actual implementation

This guide shows how to explain BeTrace to different audiences using accurate, implementation-verified examples.

---

## The 10-Second Version

**"What is BeTrace?"**

> "Behavioral pattern matching for OpenTelemetry traces. Write rules to detect violations—like when a high-value payment skips fraud checks—and we emit violation spans you can query and alert on."

---

## The 30-Second Version (with context)

**"Why would I use that?"**

> "Testing catches bugs before deployment, but some violations only show up as behavioral patterns in production traces. BeTrace runs rules continuously on your live traces and emits violation spans back to Tempo, so you can query and alert on them.
>
> SREs use it to catch undocumented invariants. Compliance teams generate audit evidence. Developers enforce API contracts. Security teams detect authorization violations."

---

## The 2-Minute Version (with real example)

**"Can you give me an example?"**

> "Sure. Say you have a payment system. You write a rule in BeTraceDSL:
>
> ```javascript
> when { payment.charge_card.where(amount > 1000) }
> always { payment.fraud_check }
> never { payment.bypass_validation }
> ```
>
> This says: 'When there's a high-value payment, it must always have a fraud check and never bypass validation.'
>
> BeTrace evaluates every trace against this rule. When a violation occurs, it emits a ViolationSpan to Tempo with context (rule ID, trace ID, which clause failed). You can query violations and alert on them in your observability stack.
>
> The key insight: **you can't test for these patterns—they only appear across production traces**."

---

## Common Follow-Up Questions

### "Is this just for AI systems?"

> "No—it works on ANY OpenTelemetry traces. APIs, databases, microservices, payment systems, and yes, AI agents. AI monitoring is one of five equal use cases."

### "Is it only for Grafana?"

> "No—BeTrace processes any OpenTelemetry traces and can emit violations to any backend. It integrates well with Grafana/Tempo, but works with other observability stacks too."

### "How is this different from TraceQL?"

> "TraceQL queries individual spans. BeTrace matches **cross-span patterns** in a trace—like 'Span A exists WITHOUT Span B' or 'count spans matching X > 3'. It's pattern matching, not querying."

### "What's the DSL syntax?"

> "BeTraceDSL—trace-level pattern matching with implicit `has()`:
>
> **Simple patterns:**
> ```javascript
> payment and fraud_check
> database.query_pii and not audit.log
> ```
>
> **Conditional invariants (when-always-never):**
> ```javascript
> when { payment.where(amount > 1000) }
> always { fraud_check }
> never { bypass_validation }
> ```
>
> **With filtering:**
> ```javascript
> api.request.where(endpoint matches "/admin/.*")
> ```
>
> **Counting:**
> ```javascript
> count(http.retry) > 3
> ```
>
> The DSL is not Turing-complete (bounded execution), so it's safe on production traffic."

### "Does this replace testing?"

> "No—it complements it. Testing validates 'does my code do what I intended?' BeTrace validates 'is my production system behaving as expected?' You need both."

---

## DSL Syntax Quick Reference

### Basic Patterns

```javascript
// Existence check (implicit has)
payment.charge_card

// With attribute filtering
payment.charge_card.where(amount > 1000)

// Negation (detect absence)
payment and not fraud_check

// Logical operators
payment and fraud_check
api.request or api.fallback
not test_environment

// Counting
count(http.retry) > 3
count(http.request) == count(http.response)
```

### Conditional Invariants

```javascript
// Basic when-always-never
when { payment.where(amount > 1000) }
always { fraud_check }
never { bypass_validation }

// Always-only (no never clause)
when { deployment.where(env == production) }
always { approval and smoke_test }

// Never-only (no always clause)
when { customer.where(tier == free) }
never { premium_feature }

// Complex multi-condition
when {
  payment.where(amount > 10000) and
  (customer.new or not customer.verified)
}
always {
  fraud_check and
  (fraud_score.where(score < 0.3) or manual_review)
}
never {
  bypass_validation or skip_check
}
```

### Comparison Operators

```javascript
==     // equal
!=     // not equal
>      // greater than
>=     // greater than or equal
<      // less than
<=     // less than or equal
in     // in list: processor in [stripe, square]
matches // regex: endpoint matches "/api/v1/admin/.*"
```

---

## What NOT to Say

❌ "BeTrace is THE mechanism for AI safety" (it's one use case)
❌ "Built for AI monitoring" (it's general-purpose)
❌ "A Grafana plugin" (it integrates with Grafana, but works standalone)
❌ "2,354x speedup" (measured: 50x+)
❌ "100% reproducibility" (say "deterministic reproducibility")
❌ "Mathematical certainty" (say "extensive empirical validation")

---

## Key Talking Points (Equal Weight)

Present all five use cases with equal prominence:

1. **SRE / Site Reliability**
   - Catch invariant violations before incidents
   - Rule replay: "When did this bug start?" (30s vs days)
   - Post-mortem prevention: codify assumptions as rules

2. **Compliance / GRC**
   - Generate behavioral evidence (SOC2, HIPAA, ISO27001)
   - Prove controls work in production, not just exist
   - Example: "PII access requires audit log"

3. **DevOps / Platform Engineering**
   - Enforce API contracts across microservices
   - Detect breaking changes in production
   - Validate internal SLAs

4. **Security**
   - Authorization-before-access validation
   - Cross-tenant isolation verification
   - Privilege escalation detection

5. **AI/ML Operations**
   - Agent behavioral validation (goal adherence)
   - Hallucination detection (citation requirements)
   - Bias detection (statistical distribution analysis)

**Lead with the use case relevant to your audience—don't default to AI.**

---

## Technical Architecture (for technical audiences)

```
┌─────────────────────────────────┐
│ OpenTelemetry Traces (any source)
│ APIs, DBs, microservices, AI    │
└─────────────┬───────────────────┘
              ↓
┌─────────────────────────────────┐
│ BeTraceDSL Pattern Matching     │
│ • Implicit has() for simplicity │
│ • When-always-never invariants  │
│ • < 1ms evaluation per trace    │
└─────────────┬───────────────────┘
              ↓
┌─────────────────────────────────┐
│ Violation Spans → Tempo         │
│ • Queryable via TraceQL         │
│ • Alertable in Grafana          │
│ • Full context (rule, trace)    │
└─────────────────────────────────┘
```

**Key capabilities:**
- **Cross-span pattern matching**: Detect patterns TraceQL can't (e.g., "A without B")
- **Rule replay**: Apply rules to historical traces retroactively (30s vs days)
- **Grafana-native**: Works within existing workflow (but not limited to Grafana)
- **General-purpose**: Works on ANY OpenTelemetry traces

---

## Performance Claims (verified)

✅ **Use these:**
- "50x+ speedup over real-time testing (measured: 60s simulated in <1.2s)"
- "Deterministic reproducibility: same seed produces same execution"
- "83.2% test coverage, 138 tests, 0 race conditions"
- "16 critical bugs found and fixed via simulation testing"

❌ **Don't use:**
- "2,354x speedup" (not measured)
- "100% reproducibility" (too absolute)
- "Mathematical certainty" (simulation ≠ formal verification)

---

## Compliance Positioning

✅ **Correct:**
- "BeTrace generates compliance evidence"
- "Provides trace-based proof for SOC2, HIPAA, ISO27001"
- "Evidence generation ≠ certification"

❌ **Incorrect:**
- "SOC2 certified" (we're not)
- "HIPAA compliant" (we're not)
- "Automates compliance" (we generate evidence)

**Standard disclaimer:**
> BeTrace generates compliance evidence through trace pattern matching. Certification requires external auditors (SOC2) or assessments (HIPAA). BeTrace provides the technical evidence, not the certification itself.

---

## Example Conversations

### For SREs

**Scenario**: They had a production incident where retries exhausted connection pool

> "You can codify that as a BeTrace rule:
> ```javascript
> when { database.connection_attempt }
> always { count(database.retry) <= 10 }
> ```
>
> Next time this pattern starts appearing, you get alerts before the pool is exhausted. And with rule replay, you can answer 'when did this pattern start?' in 30 seconds by running the rule against historical traces."

### For Compliance Teams

**Scenario**: Auditor asks "prove your PII access controls work"

> "BeTrace validates this continuously in production:
> ```javascript
> when { database.query.where(contains_pii == true) }
> always { auth.validate and audit.log }
> never { export_external }
> ```
>
> Every PII access generates compliance evidence. Violations emit spans you can show auditors: 'Here are zero violations over 30 days, proving the control works.'"

### For Security Teams

**Scenario**: Concerned about privilege escalation

> "Monitor authorization patterns:
> ```javascript
> when { api.request.where(endpoint matches "/admin/.*") }
> always { auth.check_admin }
> never { auth.bypass or role.override }
> ```
>
> Any admin access without proper auth triggers a violation span. You can alert on it immediately or query for patterns over time."

---

## Positioning Against Competitors

**BeTrace is COMPLEMENTARY, not competitive:**

### vs. Observability Tools (Datadog, Honeycomb, New Relic)
- They monitor metrics → BeTrace validates behavioral patterns
- They alert on thresholds → BeTrace alerts on pattern violations
- **Use together**: Their dashboards + Our invariant validation

### vs. Compliance Tools (Drata, Vanta)
- They prove controls exist → BeTrace proves controls work in production
- They collect evidence → BeTrace generates behavioral evidence
- **Use together**: Their workflows + Our trace-based proof

### vs. AI Monitoring (LangSmith, W&B)
- They debug prompts/chains → BeTrace validates behavioral patterns
- They test pre-deployment → BeTrace monitors production
- **Use together**: Their testing + Our production monitoring

**Key message**: "BeTrace works WITH your existing tools, not instead of them."

---

## References

- **Canonical positioning**: [docs/POSITIONING.md](POSITIONING.md)
- **DSL technical reference**: [docs/technical/trace-rules-dsl.md](technical/trace-rules-dsl.md)
- **DSL skill documentation**: [.skills/betrace-dsl/SKILL.md](../.skills/betrace-dsl/SKILL.md)
- **Marketing standards**: [docs/MARKETING_STANDARDS.md](MARKETING_STANDARDS.md)

---

**Last Updated**: 2025-11-02
**Next Review**: When DSL syntax changes or new use cases emerge
