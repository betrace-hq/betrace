# BeTrace Marketing Standards Checklist

**Version**: 1.0
**Last Updated**: 2025-11-02
**Purpose**: Prevent false claims, ensure consistency, maintain credibility

---

## ✅ Pre-Publication Checklist

Before publishing ANY marketing material (blog post, sales deck, whitepaper, social post, ad copy, email campaign), verify:

### 1. Positioning Alignment
- [ ] Material aligns with `docs/POSITIONING.md` (single source of truth)
- [ ] BeTrace described as "general-purpose trace pattern matcher" (not AI-only)
- [ ] Use cases list SRE, compliance, AI equally (not AI-first)
- [ ] No "THE mechanism for AI safety" language

###

 2. Performance Claims
- [ ] All performance metrics are measured and documented
- [ ] Claims reference specific tests (e.g., "50x+ speedup (measured: 60s → <1.2s)")
- [ ] No unverified claims (2,354x, 99.9998%, 10,000+ tests)
- [ ] Comparisons to competitors include context (system complexity differences)

### 3. Financial Claims (ROI / Pricing)
- [ ] ROI calculations show methodology step-by-step
- [ ] Assumptions are listed explicitly
- [ ] Disclaimer added: "Actual ROI varies by organization..."
- [ ] Industry averages are cited with source

### 4. Case Studies / Examples
- [ ] Hypothetical scenarios clearly labeled ("Representative Scenario", "Example")
- [ ] Real customer stories have written permission
- [ ] No future dates in scenarios
- [ ] Metrics are qualified ("hypothetical detection rate: 0.3-0.5%")

### 5. Compliance Claims
- [ ] States "BeTrace is NOT certified" explicitly
- [ ] Uses "generates evidence" not "ensures compliance"
- [ ] Distinguishes evidence generation from certification
- [ ] Links to `docs/compliance-status.md`

### 6. Competitive Positioning
- [ ] No "first-mover" claims
- [ ] Positioned as complementary, not competitive
- [ ] Fair comparisons (doesn't misrepresent competitors)
- [ ] Acknowledges what competitors do well

### 7. Technical Accuracy
- [ ] Claims match actual codebase capabilities
- [ ] Features described as "planned" if not yet implemented
- [ ] No absolute language ("100%", "never fails", "mathematical certainty")
- [ ] Terminology consistent with `docs/POSITIONING.md`

---

## 🚫 Red Flags Checklist

**STOP and revise if material contains any of these**:

### Absolute Claims
- [ ] "100%" (use "deterministic", "extensive", "high confidence")
- [ ] "Never" or "Always" (use "typically", "in tested scenarios")
- [ ] "Mathematical certainty" (use "empirical validation")
- [ ] "Guaranteed" (use "designed to", "enables")

### Unverified Statistics
- [ ] Specific percentages without sources (99.7%, 167x, 262x alone)
- [ ] Performance claims without measurements
- [ ] Customer metrics without permission
- [ ] ROI without calculation methodology

### First-Mover Language
- [ ] "First-ever", "First-mover", "Pioneering"
- [ ] "Revolutionary", "Game-changing", "Breakthrough"
- [ ] "Only tool that..." (verify this is actually true)

### AI-Only Positioning
- [ ] "BeTrace for AI Safety" (should be "BeTrace for SRE, Compliance, AI...")
- [ ] "AI monitoring tool" (should be "trace pattern matcher")
- [ ] "THE mechanism for AI" (overstates scope)
- [ ] AI Safety Report as "market validation" (should be "use case example")

### Hypotheticals as Facts
- [ ] Case studies presented as real without permission
- [ ] "Our customer saved $X" without customer name/permission
- [ ] Metrics without "representative example" qualifier
- [ ] Future dates (Oct 2025 in "real" case studies)

### Compliance Overclaims
- [ ] "SOC2 certified", "HIPAA compliant"
- [ ] "Automates compliance" (should be "generates evidence")
- [ ] "Ensures compliance" (should be "helps demonstrate")

---

## 📋 Required Elements by Content Type

### Blog Posts
- [ ] Author bio
- [ ] Published date
- [ ] Links to `docs/POSITIONING.md` or product page
- [ ] Disclaimers on any ROI/performance claims
- [ ] Clear labeling of hypothetical examples

### Sales Decks
- [ ] Slide 1: "For SRE, Compliance, AI" (not "For AI Systems")
- [ ] ROI slides: Show calculation + disclaimer
- [ ] Case studies: "Representative Scenarios (Illustrative)"
- [ ] Competitive positioning: "Complementary" language
- [ ] Link to authoritative docs at end

### Whitepapers
- [ ] Abstract with clear scope
- [ ] Methodology section for any benchmarks
- [ ] Assumptions section for any financial models
- [ ] References/citations for external claims
- [ ] "Representative example" labels on scenarios

### Website Copy
- [ ] Hero section aligns with `docs/POSITIONING.md`
- [ ] Use cases list all five equally
- [ ] Performance claims link to documentation
- [ ] Footer disclaimer: "Use at your own risk, verify independently"

### Social Media
- [ ] Character-limited claims are still accurate
- [ ] No absolute language ("Best", "Only", "First")
- [ ] Links to authoritative sources
- [ ] Hashtags accurate (#ObservabilityTools not #AIMonitoring only)

### Paid Advertising
- [ ] All claims can be substantiated if challenged
- [ ] ROI claims show methodology
- [ ] No competitor disparagement
- [ ] Legal review if making bold claims

---

## 📊 Performance Claims Standards

### ✅ Approved Performance Claims (Always Safe to Use)

**Simulation Testing**:
- "50x+ speedup over real-time testing (measured: 60s simulated in <1.2s)"
- "Deterministic reproducibility: same seed produces same execution sequence"
- "16 critical bugs found and fixed through 2,500+ test runs"

**Test Coverage**:
- "83.2% test coverage with 138 tests"
- "0 race conditions detected"

**Use EXACTLY this wording** - it's verified and defensible.

### ⚠️ Conditional Claims (Require Verification)

**Backend Performance**:
- "Processes millions of spans per second" ← **Need to verify this**
- "Sub-50ms latency" ← **Need to measure this**
- "Scales to X traces/day" ← **Need to benchmark this**

**Before using**: Run actual benchmarks, document methodology, publish results.

### ❌ Prohibited Claims (Never Use)

- ~~"2,354x speedup"~~ (unverified)
- ~~"100% reproducibility"~~ (too absolute)
- ~~"Mathematical certainty"~~ (inaccurate)
- ~~"10,000+ crash tests"~~ (overstated)
- ~~"99.9998% fault recovery"~~ (unsupported precision)

---

## 💰 ROI Claims Standards

### Required Format for ALL ROI Claims

**Always include these three components**:

1. **Calculation Methodology**
```markdown
**ROI Calculation**:
• Cost avoided: $5M (malpractice claim, industry average*)
• BeTrace cost: $30K/year (license + 0.5 FTE maintenance)
• ROI: ($5M - $30K) / $30K = 167x

*Source: [Citation if available, or "industry standard" if typical]
```

2. **Assumptions**
```markdown
**Assumptions**:
- One high-severity incident prevented per year
- Engineer cost: $250K/year fully loaded
- Malpractice claim average: $2-5M (healthcare)
```

3. **Disclaimer**
```markdown
**Note**: Actual ROI varies by organization size, incident frequency, and
detection effectiveness. This is a representative example.
```

### Standard ROI Ranges (Use These)

**By Use Case**:
- SRE Incident Prevention: 10-50x (based on incident frequency)
- Compliance Evidence: 5-10x (based on audit costs avoided)
- Security Breach Prevention: 100-500x (if high-value breach prevented)
- AI Safety Monitoring: 50-200x (if regulatory fine avoided)

**Always show range, not specific number, unless calculation is provided**.

---

## 📝 Case Study Standards

### Hypothetical Scenarios (Current State)

**Required Format**:
```markdown
## Representative Scenario: [Use Case Name]

**Context**: [Industry, system type]
**Pattern**: "[BeTraceDSL rule]"
**Hypothetical Impact**: [What could be prevented]
**ROI Calculation**: Based on [assumptions]

**Note**: This is a representative example demonstrating typical use cases.
Actual results vary by organization.
```

**Examples**:
- "Representative Scenario: Healthcare Hallucination Detection"
- "Example Use Case: Financial Services Bias Detection"
- "Illustrative Example: SRE Incident Investigation"

### Real Customer Case Studies (Future State)

**Requirements**:
1. **Written Permission**
   - [ ] Customer signed release form
   - [ ] Legal team reviewed
   - [ ] Customer approved final copy
   - [ ] Permission for logo use (if applicable)

2. **Verified Metrics**
   - [ ] All numbers provided by customer
   - [ ] BeTrace confirmed metrics where possible
   - [ ] Timeframe clearly stated
   - [ ] Calculations shown if ROI claimed

3. **Format**:
```markdown
## Customer Case Study: [Company Name or "Fortune 500 Healthcare Provider"]

**Industry**: [Healthcare, Finance, etc.]
**Size**: [Employees, revenue tier]
**Challenge**: [Customer's problem]
**Solution**: [How BeTrace was used]
**Results**: [Verified metrics]
**Testimonial**: "[Quote with attribution]"

*Results verified by customer and used with permission.*
```

---

## 🔍 Compliance Claims Standards

### ✅ Always Safe to Say

- "BeTrace generates compliance evidence"
- "Provides trace-based proof for SOC2, HIPAA, ISO27001 audits"
- "Creates immutable audit trails via OpenTelemetry spans"
- "BeTrace is NOT certified for any compliance framework"
- "Evidence generation complements, not replaces, compliance programs"

### ⚠️ Requires Disclaimer

If discussing specific controls:
```markdown
BeTrace can validate patterns like "PII access → audit log" to support
SOC2 CC7.2 (System Monitoring) controls. However, BeTrace itself is NOT
certified. Certification requires external auditors validating your
complete compliance program, of which BeTrace is one component.
```

### ❌ Never Say

- "SOC2 certified"
- "HIPAA compliant"
- "Ensures compliance"
- "Automates compliance"
- "Passes audits"
- "Meets regulatory requirements"

**Why**: These imply certification/compliance status that BeTrace doesn't have.

---

## 🎯 Positioning Standards

### Use Case Ordering (Always Use This Order)

When listing BeTrace use cases, use this order with equal prominence:

1. SRE / Site Reliability Engineering
2. Compliance / GRC
3. DevOps / Platform Engineering
4. Security
5. AI/ML Operations

**Never lead with AI-only positioning**.

### Elevator Pitch (Approved Version)

**30 seconds**:
> BeTrace validates that distributed systems behave as expected through
> continuous production monitoring. We match trace patterns against rules,
> catching violations that testing misses - from SRE incidents to compliance
> gaps to API misuse.

**Use this exact wording in sales/marketing materials**.

### Competitive Positioning (Approved Language)

**vs. Observability Tools**:
> BeTrace complements Datadog/Honeycomb/New Relic. They monitor metrics,
> we validate behavioral patterns. Use together: their dashboards + our
> invariant validation.

**vs. Compliance Tools**:
> BeTrace complements Drata/Vanta. They prove controls exist, we prove
> controls work in production. Use together: their workflows + our
> trace-based proof.

**vs. AI Monitoring Tools**:
> BeTrace complements LangSmith/W&B. They debug prompts, we validate
> production behavior. Use together: their testing + our production
> monitoring.

**Key message**: "BeTrace works WITH your existing tools, not instead of them."

---

## 🚀 Pre-Launch Checklist

Before launching major marketing campaigns (product launch, funding announcement, conference talks):

### Content Audit
- [ ] All materials reviewed against this checklist
- [ ] Positioning aligns with `docs/POSITIONING.md`
- [ ] No red flags present (see Red Flags Checklist above)
- [ ] Performance claims verified
- [ ] ROI calculations include methodology

### Legal Review
- [ ] Competitive claims are defensible
- [ ] Compliance claims don't imply certification
- [ ] Customer testimonials have written permission
- [ ] Disclaimer present on bold claims

### Internal Alignment
- [ ] Product team confirms technical accuracy
- [ ] Marketing team approves messaging
- [ ] Sales team trained on positioning
- [ ] Leadership signs off on strategy

### External Validation
- [ ] Beta customers reviewed materials (if applicable)
- [ ] Industry experts consulted (if making bold claims)
- [ ] Competitor analysis updated
- [ ] Legal counsel reviewed (if high-stakes)

---

## 📞 Escalation Process

**If unsure about a claim**:

1. **Check authoritative sources first**:
   - `docs/POSITIONING.md` - Positioning standards
   - `docs/compliance-status.md` - Compliance claims
   - `docs/whitepaper-simulation-testing.md` - Technical claims
   - Actual codebase - Feature claims

2. **If still unsure, escalate to**:
   - Technical claims → Product team
   - Performance claims → Engineering team
   - Financial claims → Finance team
   - Compliance claims → Legal/Security team
   - Positioning → Marketing/Product leadership

3. **When in doubt**: Be conservative. It's better to under-promise and over-deliver than vice versa.

---

## 📚 Appendix: Common Mistakes

### Mistake 1: AI-Only Positioning
**❌ Wrong**: "BeTrace: AI Safety Monitoring Tool"
**✅ Right**: "BeTrace: Trace Pattern Matcher for SRE, Compliance, and AI"

### Mistake 2: Unqualified ROI
**❌ Wrong**: "500x ROI in 90 days"
**✅ Right**: "500x ROI potential (calc: $10M fine avoided / $20K cost), actual varies"

### Mistake 3: Hypothetical as Real
**❌ Wrong**: "Our customer prevented $5M in claims"
**✅ Right**: "Representative scenario: Could prevent $5M in claims (industry avg)"

### Mistake 4: Absolute Performance
**❌ Wrong**: "2,354x speedup, 100% reproducibility"
**✅ Right**: "50x+ speedup (measured), deterministic reproducibility"

### Mistake 5: Compliance Certification
**❌ Wrong**: "BeTrace is SOC2 compliant"
**✅ Right**: "BeTrace generates evidence for SOC2 audits (not certified itself)"

---

## ✅ Approval & Sign-Off

**I have reviewed this checklist and understand**:
- [ ] All marketing materials must follow these standards
- [ ] Violations will be corrected before publication
- [ ] When in doubt, be conservative
- [ ] Positioning must align with `docs/POSITIONING.md`

**Approved By**: ___________________ Date: ___________

---

**Last Updated**: 2025-11-02
**Version**: 1.0
**Maintainer**: Marketing Team
**Review Frequency**: Quarterly
