# Do You Need BeTrace? (Be Honest With Yourself)

**Last Updated:** October 2025

**Time to read:** 5 minutes
**Time to decide:** 2 minutes

---

## This Page Will Save You Time

90% of companies reading this **should not try BeTrace right now.**

If you're in that 90%, we'll tell you in the next 2 minutes. Bookmark us and come back when your situation changes.

If you're in the 10% where BeTrace solves a real problem, we'll get you to a demo fast.

---

## Self-Assessment (10 Questions)

Answer honestly. We don't want to waste your time any more than you want to waste ours.

### Question 1: Do You Emit OpenTelemetry Traces?

**Select one:**
- [ ] A. Yes, we already emit OTel traces (3 points)
- [ ] B. No, but we emit some form of distributed tracing (Datadog APM, Jaeger, Zipkin) (2 points)
- [ ] C. No, we don't do distributed tracing (0 points - stop here, you're not a fit)

**Why this matters:**
BeTrace matches patterns in OpenTelemetry span data. No traces = no patterns = BeTrace can't work.

**If you answered C:** Come back when you've instrumented with OpenTelemetry. This isn't negotiable.

---

### Question 2: What's Your Incident Frequency?

**Select one:**
- [ ] A. 2+ incidents/month from violated assumptions (e.g., "we assumed payment happens after inventory") (3 points)
- [ ] B. 1-2 incidents/quarter from violated assumptions (2 points)
- [ ] C. <1 incident/quarter from violated assumptions (1 point)
- [ ] D. Our incidents are infrastructure failures (servers crash, network down) (0 points)

**Why this matters:**
BeTrace detects behavioral violations, not infrastructure failures.

**If you answered D:** Use Datadog/New Relic/PagerDuty. BeTrace won't help with infrastructure issues.

---

### Question 3: Have You Ever Said This in a Post-Mortem?

**Select all that apply (1 point each):**
- [ ] "We assumed Service A always calls Service B first, but it didn't"
- [ ] "The code looked correct, but there was a race condition in production"
- [ ] "Tests passed, but production had an edge case we didn't test"
- [ ] "We thought authentication always happened before data access, but we found a code path that skipped it"
- [ ] "The retry logic worked in tests, but violated idempotency in production"

**Score:**
- 3+ checked: 3 points
- 1-2 checked: 2 points
- 0 checked: 0 points (you might not need BeTrace)

**Why this matters:**
These are all violated invariants. If you don't have these, you might not have the problem BeTrace solves.

---

### Question 4: Have You Ever Needed to Answer This Question?

**Select one:**
- [ ] A. "When did this bug start?" - and spent days grepping logs to find out (3 points)
- [ ] B. "Did this pattern occur in the past?" - and wished you could retroactively check (2 points)
- [ ] C. Never needed to ask these questions (0 points)

**Why this matters:**
This is BeTrace's killer feature (rule replay). If you've never needed retroactive pattern detection, this isn't valuable to you.

---

### Question 5: What's Your Engineering Team Size?

**Select one:**
- [ ] A. 50-500 engineers (3 points)
- [ ] B. 20-50 engineers (2 points)
- [ ] C. 500+ engineers (2 points)
- [ ] D. <20 engineers (1 point)

**Why this matters:**
- <20 engineers: Manual code review might be sufficient
- 50-500: Sweet spot (enough complexity, not enterprise procurement hell)
- 500+: You need this, but procurement will take 6+ months

---

### Question 6: What's Your Annual Revenue?

**Select one:**
- [ ] A. $10M-$100M ARR (3 points)
- [ ] B. $5M-$10M ARR (2 points)
- [ ] C. $100M+ ARR (2 points)
- [ ] D. <$5M ARR (0 points)

**Why this matters:**
- <$5M: Focus on product-market fit first
- $5M-$100M: ROI justification is straightforward (cost scales with trace volume, typical ROI: 10-50x)
- $100M+: You need this, but enterprise sales cycle is 6-12 months

---

### Question 7: What's Your Primary Use Case?

**Select all that apply (2 points each):**
- [ ] Multi-tenant SaaS (cross-tenant isolation is critical)
- [ ] Fintech/healthcare (compliance requires proof of behavioral patterns)
- [ ] E-commerce/marketplace (payment/inventory race conditions)
- [ ] AI/LLM applications (agent behavioral guardrails)
- [ ] High-throughput APIs (>100K requests/day with complex workflows)

**Score:**
- 2+ checked: 4 points
- 1 checked: 2 points
- 0 checked: 0 points

**Why this matters:**
These domains have high invariant violation risk. If you're not in one of these, you might have simpler validation needs.

---

### Question 8: What's Your Current Observability Spend?

**Select one:**
- [ ] A. $100K-$500K/year on Datadog/New Relic/Honeycomb (3 points)
- [ ] B. $50K-$100K/year (2 points)
- [ ] C. $500K+/year (2 points)
- [ ] D. <$50K/year (1 point)

**Why this matters:**
- <$50K: Your observability needs might be simple enough that BeTrace is overkill
- $100K+: You're already paying for observability and still missing bugs (BeTrace fills that gap, typical cost scales with trace volume)

---

### Question 9: Do You Have This Compliance Requirement?

**Select one:**
- [ ] A. We need to prove controls work in production (audit logs exist, patterns are validated) (3 points)
- [ ] B. We need SOC2/HIPAA certification (checkbox compliance) (1 point)
- [ ] C. No compliance requirements (0 points)

**Why this matters:**
- "Prove controls work": BeTrace is built for this (behavioral validation)
- "Get SOC2 checkbox": Use Drata/Vanta (they're faster/cheaper for certification)

**If you answered B:** Use Drata for certification. Come back to BeTrace later if auditor asks "prove this works in production."

---

### Question 10: Who Would Own BeTrace at Your Company?

**Select one:**
- [ ] A. VP Engineering / Principal Engineer / Staff SRE who owns incident response (3 points)
- [ ] B. Platform/Observability team (2 points)
- [ ] C. Security/Compliance team (1 point)
- [ ] D. Not sure / no one (0 points)

**Why this matters:**
BeTrace requires someone technical who:
- Understands your system architecture
- Has authority to define invariants
- Owns incident response

**If you answered D:** Come back when you have an owner. Tools without owners die within 3 months.

---

## Your Score

Add up your points from all 10 questions.

### Score: 0-10 Points (NOT A FIT - Don't Waste Your Time)

**You're in one or more of these buckets:**
- Don't emit OpenTelemetry traces
- Incidents are infrastructure failures (not behavioral violations)
- Pre-product-market fit (<$5M ARR)
- <20 engineers (manual review sufficient)
- Just need SOC2 checkbox (use Drata, not BeTrace)

**What to do:**
- [ ] Bookmark this page for later
- [ ] Focus on your current priorities
- [ ] Come back in 6-12 months if situation changes

**Alternative solutions:**
- **No OTel traces:** Start with OpenTelemetry instrumentation first
- **Infrastructure incidents:** Use Datadog/New Relic for infra monitoring
- **Early stage:** Focus on product-market fit, not invariants
- **SOC2 checkbox:** Use Drata/Vanta for certification

---

### Score: 11-18 Points (MARGINAL FIT - Evaluate in 3-6 Months)

**You have some signals, but not all:**
- Maybe you emit traces, but incidents are rare
- Maybe you have incidents, but <50 engineers (manual review still works)
- Maybe you're $5M-$10M ARR (ROI is borderline)

**What to do:**
- [ ] Join waitlist: [betrace.com/waitlist](https://betrace.com/waitlist)
- [ ] We'll email you in 3-6 months to re-assess
- [ ] Track your next 3 incidents: Are they violated assumptions?

**Decision criteria for 6 months from now:**
- If incidents increase (2+/month): Move to "Strong Fit"
- If team grows (50+ engineers): Move to "Strong Fit"
- If ARR grows ($10M+): Move to "Strong Fit"
- If still marginal: Wait another 6 months

---

### Score: 19-24 Points (STRONG FIT - Schedule Demo Now)

**You checked most boxes:**
- ✅ Emit OpenTelemetry traces (or similar)
- ✅ 2+ incidents/month from violated assumptions
- ✅ 50-500 engineers
- ✅ $10M-$100M ARR
- ✅ Multi-tenant SaaS / Fintech / E-commerce / AI
- ✅ Spending $100K+/year on observability
- ✅ Clear owner (VP Eng / Principal Eng / Staff SRE)

**What BeTrace will do for you:**
- **Week 1:** Define 10 critical invariants (8 hours engineering time)
- **Week 2-4:** Detect violations in production (2-3 violations caught)
- **Month 2:** Rule replay finds historical violations (incident investigation 90% faster)
- **Month 3:** Expand to 30+ invariants, prevent 1-2 incidents

**Expected ROI:**
- Cost: Scales with trace volume (typical ROI: 10-50x first year)
- Benefit: Avoid 5-10 incidents/year × $100K avg = $500K-$1M
- Investment pays for itself after preventing 1-2 major incidents

**Next steps:**
1. [ ] **Schedule 15-min demo:** [betrace.com/demo](https://betrace.com/demo)
2. We'll ask about your last 3 incidents
3. We'll define 1-2 invariants live on the call
4. You'll see rule replay in action (30 seconds)
5. Decision: Try 30-day POC or pass

**What we'll ask on the call:**
- "Tell me about your last incident caused by a violated assumption"
- "Do you emit OpenTelemetry traces? Which services?"
- "If we could detect that violation in 30 seconds, what's that worth?"

---

### Score: 25+ Points (PERFECT FIT - Priority Demo)

**You're the ideal BeTrace customer:**
- ✅ All signals are strong
- ✅ You've probably already tried to solve this problem
- ✅ You're spending real money on incidents (>$500K/year)

**What to do:**
1. **Email us directly:** priority@betrace.com (subject: "Perfect fit - score 25+")
2. We'll prioritize your demo within 24 hours
3. We'll assign a solutions engineer to your POC
4. 30-day POC with dedicated support

**What we'll provide:**
- Pre-call incident analysis (we'll review your public post-mortems)
- 10 pre-defined invariants for your domain
- Hands-on rule replay workshop
- Direct Slack channel with engineering team

---

## Common Questions

### "Our score is 15, but we REALLY have this problem. Can we still try BeTrace?"

**Answer:** Maybe. Email us (borderline@betrace.com) with:
- Your score breakdown
- Your last 2 incidents (describe the violated assumption)
- Why you think BeTrace would help

We'll evaluate case-by-case. Sometimes a company with score 15 has a critical use case that justifies BeTrace.

---

### "We scored 22, but we're not sure about the investment. Can we try it cheaper?"

**Answer:** Not really. BeTrace's value is:
- Rule replay (saves weeks of log grepping)
- Continuous validation (prevents $100K+ incidents)

If BeTrace's cost feels expensive, you probably don't have enough incidents to justify it. Come back when incident costs exceed several times the investment.

---

### "We scored 8, but we're about to scale rapidly (10x revenue in 12 months). Should we start now?"

**Answer:** No. Start when the pain hits, not in anticipation.

**Why:**
- Invariants are discovered through incidents, not predicted
- You'll waste time defining invariants for systems that will change
- Your architecture will evolve rapidly at 10x growth

**When to start:** When you hit 2+ incidents/month from violated assumptions (probably 6-9 months into your growth phase).

---

### "We scored 20, but we're enterprise (500+ engineers). Why is that only 2 points?"

**Answer:** Because enterprise procurement is slow (6-12 months).

**Reality:**
- **Technical fit:** You need BeTrace (complex systems, high incident rate)
- **Business fit:** Your procurement process will take forever

**What to do:** Start the procurement process now. By the time legal/security/procurement approve it, you'll have 3 more incidents that justify the purchase.

---

### "We don't emit OTel traces (scored 0 on Q1), but we're willing to instrument. Should we?"

**Answer:** Depends on why you want BeTrace.

**Good reason:** "We have 3+ incidents/month from violated assumptions, and OpenTelemetry + BeTrace will prevent them"
- **Action:** Instrument with OTel first (4-8 weeks), then try BeTrace

**Bad reason:** "We heard OTel + BeTrace are good practices"
- **Action:** Don't bother. Instrumentation overhead isn't worth it without clear ROI

**Test:** If you can't name 3 specific incidents in the last 6 months that BeTrace would've prevented, don't instrument yet.

---

## What Happens After You Score?

### If You're NOT a Fit (0-10 points):
- We won't follow up
- Bookmark this page
- Come back in 6-12 months if situation changes

### If You're MARGINAL Fit (11-18 points):
- Join waitlist: [betrace.com/waitlist](https://betrace.com/waitlist)
- We'll email quarterly to re-assess
- You can unsubscribe anytime

### If You're STRONG Fit (19-24 points):
- Schedule demo: [betrace.com/demo](https://betrace.com/demo)
- 15-minute call (we'll qualify you)
- 30-day POC if both sides agree it's a fit

### If You're PERFECT Fit (25+ points):
- Email priority@betrace.com
- Demo within 24 hours
- Dedicated solutions engineer for POC

---

## The Brutal Truth

**95% of companies don't need BeTrace.**

They either:
- Don't have the problem BeTrace solves (incidents are infra, not behavioral)
- Don't have enough volume (incidents are rare)
- Don't have the foundation (no OTel traces)
- Are too early (pre-PMF) or too late (enterprise procurement)

**That's fine. We're not for everyone.**

But if you're in the 5% where BeTrace solves a real, expensive problem, we want to talk.

---

## Next Steps

**Based on your score:**
- **0-10:** Bookmark for later
- **11-18:** [Join waitlist](https://betrace.com/waitlist)
- **19-24:** [Schedule demo](https://betrace.com/demo)
- **25+:** [Email us](mailto:priority@betrace.com)

**Don't know your score?** Re-read the 10 questions and add up your points.

**Still not sure?** Read [The "Oh Shit" Moment: 5 Scenarios Where BeTrace Saves Your Ass](./the-oh-shit-moment.md)

---

**Questions?**
- Email: hello@betrace.com
- [GitHub Issues](https://github.com/betracehq/betrace/issues)
