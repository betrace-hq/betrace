# Customer Testimonial Guide

**Version**: 1.0
**Last Updated**: 2025-11-02
**Purpose**: Obtain real customer testimonials to replace hypothetical scenarios

---

## Current State

**All case studies in BeTrace materials are currently hypothetical.**

Marketing materials use:
- "Representative Scenarios"
- "Illustrative Examples"
- "Hypothetical Use Cases"

**Goal**: Replace with real customer testimonials where possible.

---

## Legal Requirements

### Before Approaching Customer

- [ ] Customer has been using BeTrace for 30+ days minimum
- [ ] Customer has achieved measurable results
- [ ] Relationship is strong (NPS score 8+ if available)
- [ ] Customer has NOT had recent issues/complaints

### Required Approvals

**From Customer**:
1. **Written Permission** - Legal release form signed
2. **Content Approval** - Customer reviews final copy before publication
3. **Logo Usage** - Separate approval if using company logo
4. **Quote Attribution** - Approval for using individual's name/title

**From BeTrace**:
1. **Legal Review** - Legal team reviews release form
2. **Executive Approval** - Leadership signs off on customer selection
3. **Marketing Approval** - Final copy approved before publication

---

## Release Form Template

```
CUSTOMER TESTIMONIAL RELEASE FORM

Customer: [Company Name]
Date: [Date]
BeTrace Representative: [Name]

PERMISSION GRANTED

[Company Name] ("Customer") grants BeTrace ("Company") permission to:

1. Use Customer's company name in marketing materials
2. Use Customer's logo in marketing materials (if applicable)
3. Publish the case study attached as Exhibit A
4. Include metrics and results as stated in Exhibit A
5. Use testimonial quote attributed to [Name, Title]

RESTRICTIONS

- Company will submit final copy to Customer for approval before publication
- Company will remove content within 30 days if requested by Customer
- Company will not disclose proprietary/confidential information beyond Exhibit A

TERM

This permission is valid for [1 year / indefinite] from the date signed.

CUSTOMER SIGNATURE

Name: _______________________
Title: _______________________
Company: _______________________
Date: _______________________

COMPANY SIGNATURE

Name: _______________________
Title: _______________________
Date: _______________________

EXHIBIT A: [Attach approved case study copy]
```

---

## Case Study Interview Process

### 1. Qualifying Questions (Before Interview)

**Send to customer success team to identify good candidates**:

- [ ] Has customer been using BeTrace for 30+ days?
- [ ] Has customer achieved measurable results?
- [ ] Would customer rate experience 8+/10?
- [ ] Has customer given permission to be contacted for case study?
- [ ] Is customer willing to have company name published?

**If all YES → proceed to interview**

### 2. Interview Questions

**Context Setting** (5 min):
1. What industry are you in?
2. What's your company size (employees, revenue tier)?
3. What's your role and how did you discover BeTrace?

**Problem Definition** (10 min):
4. What problem were you trying to solve?
5. What was the business impact of that problem? (Cost, risk, time)
6. What alternatives did you evaluate? (Competitors, build vs buy)
7. Why did you choose BeTrace?

**Implementation** (10 min):
8. How long did implementation take?
9. What challenges did you face during setup?
10. How many people were involved?
11. What observability stack are you using? (Grafana, Tempo, etc.)

**Results** (15 min):
12. What specific results have you achieved? (Metrics, cost savings, time saved)
13. Can you quantify the impact? (ROI, incidents prevented, time to resolution)
14. Any specific incidents where BeTrace proved valuable? (Stories)
15. How does your team use BeTrace day-to-day?

**Testimonial** (5 min):
16. What would you say to someone considering BeTrace?
17. What's the most valuable capability for your use case?
18. Anything that surprised you about BeTrace?

**Logistics** (5 min):
19. Can we use your company name in the case study?
20. Can we use your logo?
21. Can we attribute a quote to you with your name/title?
22. Who needs to review/approve before publication?

### 3. Post-Interview Workflow

**Within 24 hours**:
- [ ] Send thank-you email
- [ ] Transcribe interview notes
- [ ] Draft case study (use template below)

**Within 1 week**:
- [ ] Send draft to customer for review
- [ ] Incorporate customer feedback
- [ ] Finalize metrics with customer confirmation

**Within 2 weeks**:
- [ ] Get customer approval on final copy
- [ ] Send release form for signature
- [ ] Get legal review
- [ ] Get executive approval

**Within 3 weeks**:
- [ ] Publish case study
- [ ] Send published link to customer
- [ ] Thank customer with small gift (if appropriate)

---

## Case Study Template

```markdown
# Customer Case Study: [Company Name]

**Industry**: [Healthcare, Finance, E-commerce, etc.]
**Company Size**: [50-200 employees, $10-50M ARR, etc.]
**Use Case**: [SRE Incident Prevention, Compliance, AI Monitoring, etc.]
**Published**: [Date]

---

## The Challenge

[2-3 paragraphs describing the problem]

**Key Issues**:
- [Bullet point 1]
- [Bullet point 2]
- [Bullet point 3]

**Business Impact**:
- [Cost, risk, time impact of the problem]

---

## Why BeTrace

[1-2 paragraphs on evaluation process and decision]

**Evaluation Criteria**:
- [What they were looking for]
- [How BeTrace compared to alternatives]
- [Key decision factors]

---

## Implementation

**Timeline**: [X weeks/months]
**Team Size**: [X people involved]
**Integration**: [Grafana version, Tempo, OpenTelemetry, etc.]

**Setup Process**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Challenges Faced**:
- [Challenge 1 and how resolved]
- [Challenge 2 and how resolved]

---

## Results

**Measured Outcomes**:

| Metric | Before BeTrace | After BeTrace | Improvement |
|--------|---------------|---------------|-------------|
| [Metric 1] | [Value] | [Value] | [X%] |
| [Metric 2] | [Value] | [Value] | [X%] |
| [Metric 3] | [Value] | [Value] | [X%] |

**Business Impact**:
- **Cost Savings**: $[Amount] per [year/month]
- **Time Savings**: [X hours/week saved]
- **Risk Reduction**: [Incidents prevented, compliance gaps closed]
- **ROI**: [Calculation with methodology]

**Specific Example**:
[Story of a specific incident/violation BeTrace caught]

---

## Customer Testimonial

> "[Quote from customer contact]"
>
> — [Name], [Title], [Company Name]

---

## Key Takeaways

1. **[Takeaway 1]**: [1-2 sentences]
2. **[Takeaway 2]**: [1-2 sentences]
3. **[Takeaway 3]**: [1-2 sentences]

---

## About [Company Name]

[1 paragraph about customer's business]

---

## About BeTrace

BeTrace is a Grafana plugin for behavioral pattern matching on OpenTelemetry traces. [Standard boilerplate]

**Learn More**: [Link to website]

---

*Case study metrics verified by customer and used with written permission.*
*Published: [Date]*
```

---

## Metrics to Collect

### Quantitative Metrics (Measurable)

**SRE Use Cases**:
- Incidents per month (before vs after)
- Mean time to resolution (MTTR)
- Investigation time per incident
- Number of rules/invariants defined
- Violations detected per month

**Compliance Use Cases**:
- Audit preparation time
- Evidence collection time (hours saved)
- Compliance gaps detected
- Control validation frequency

**AI Monitoring Use Cases**:
- Agent operations monitored
- Violations detected (count, %)
- Hallucinations caught
- Bias patterns identified

**Financial Metrics** (if customer shares):
- Cost avoided (incidents prevented × avg cost)
- Time saved (hours × eng cost)
- ROI calculation (savings / investment)

### Qualitative Metrics (Descriptive)

- Team satisfaction with BeTrace
- Integration ease
- Learning curve
- Support experience
- Feature requests/gaps
- Would they recommend? (NPS)

---

## Priority Customers to Approach

### Tier 1: Ideal Candidates

**Criteria**:
- [ ] 60+ days of usage
- [ ] Measurable results achieved
- [ ] Strong relationship (regular contact)
- [ ] Public company or recognizable brand
- [ ] Willing to be named

**Action**: Prioritize these for case studies

### Tier 2: Good Candidates

**Criteria**:
- [ ] 30+ days of usage
- [ ] Some results achieved
- [ ] Good relationship
- [ ] Willing to be named OR anonymized
- [ ] Interesting use case

**Action**: Approach after Tier 1 complete

### Tier 3: Future Candidates

**Criteria**:
- [ ] <30 days usage
- [ ] Early results
- [ ] May want anonymity
- [ ] Still evaluating

**Action**: Follow up in 60-90 days

---

## Anonymized Case Studies

**If customer won't allow name usage**, use anonymized format:

```markdown
# Case Study: Fortune 500 Financial Services Company

**Industry**: Financial Services
**Company Profile**: Fortune 500, 10,000+ employees, $5B+ revenue
**Use Case**: Regulatory Compliance Monitoring
**Region**: United States

[Rest of case study with all identifying details removed]

*Customer requested anonymity. Metrics verified and used with permission.*
```

**What to anonymize**:
- Company name
- Individual names
- Specific products/services
- Geographic specifics (city → region)
- Exact metrics (round to ranges)

**What to keep**:
- Industry
- Company size tier
- Use case category
- Relative improvements (%)
- General tech stack

---

## ROI Calculation Worksheet

**Use this to calculate customer ROI**:

### 1. Costs (BeTrace Investment)

| Item | Amount | Notes |
|------|--------|-------|
| BeTrace license | $[Amount]/year | Annual subscription |
| Implementation time | [X hours] × $[Rate] | Engineer hours × hourly rate |
| Training | $[Amount] | If applicable |
| Ongoing maintenance | [Y hours/month] × $[Rate] × 12 | Typically 0.5 FTE |
| **Total Investment** | **$[Total]** | Sum of above |

### 2. Benefits (Value Delivered)

| Benefit | Calculation | Amount |
|---------|-------------|--------|
| Incidents prevented | [X incidents] × $[Avg cost] | Cost per incident |
| Time saved | [Y hours/month] × $[Rate] × 12 | Investigration time |
| Fines avoided | $[Fine amount] × [Probability] | If applicable |
| Downtime prevented | [Z hours] × $[Cost/hour] | If applicable |
| **Total Benefit** | Sum of above | **$[Total]** |

### 3. ROI Calculation

```
ROI = (Total Benefit - Total Investment) / Total Investment

Example:
Total Benefit: $500,000
Total Investment: $50,000
ROI = ($500,000 - $50,000) / $50,000 = 9x or 900%
```

### 4. Payback Period

```
Payback Period = Total Investment / (Monthly Benefit × 12)

Example:
Total Investment: $50,000
Monthly Benefit: $41,667 ($500,000 / 12)
Payback = $50,000 / $500,000 = 0.1 years = 1.2 months
```

**Include in case study**:
- [ ] Show ROI calculation methodology
- [ ] State assumptions clearly
- [ ] Add disclaimer: "Results vary by organization"

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Premature Outreach
**Problem**: Approaching customers too early (<30 days)
**Result**: Not enough data, weak testimonial
**Solution**: Wait for 60+ days, measurable results

### ❌ Mistake 2: Leading Questions
**Problem**: "You saved a lot of money with BeTrace, right?"
**Result**: Biased testimonial, not credible
**Solution**: Ask open-ended: "What results have you seen?"

### ❌ Mistake 3: Publishing Without Approval
**Problem**: Publishing before customer reviews final copy
**Result**: Legal issues, damaged relationship
**Solution**: Always get written approval before publishing

### ❌ Mistake 4: Overstating Results
**Problem**: Rounding up metrics or extrapolating
**Result**: Loss of credibility when verified
**Solution**: Use exact customer-provided metrics

### ❌ Mistake 5: No ROI Methodology
**Problem**: "Customer achieved 500x ROI" with no explanation
**Result**: Readers skeptical, may hurt credibility
**Solution**: Show calculation, state assumptions

---

## Success Metrics

**Track these for case study program**:

- [ ] Number of case studies published
- [ ] Customer satisfaction with case study process
- [ ] Case study impact on sales (pipeline influence)
- [ ] Web traffic to case study pages
- [ ] Case studies used in sales conversations
- [ ] Customer retention of case study participants

**Goal**: 3-5 case studies across different use cases by end of Q1 2025

---

## Timeline & Milestones

### Phase 1: Preparation (Week 1-2)
- [ ] Identify 10 potential customers
- [ ] Finalize release form template
- [ ] Get legal approval on process
- [ ] Train CS team on qualifying questions

### Phase 2: Outreach (Week 3-6)
- [ ] Approach 5 Tier 1 candidates
- [ ] Conduct 3-5 interviews
- [ ] Draft 2-3 case studies
- [ ] Get customer approvals

### Phase 3: Publication (Week 7-8)
- [ ] Legal review of final copy
- [ ] Executive approval
- [ ] Publish to website
- [ ] Promote via marketing channels

### Phase 4: Ongoing (Monthly)
- [ ] Approach 2 new customers per month
- [ ] Publish 1 case study per month
- [ ] Update existing case studies (annually)

---

## Resources Needed

### People
- **Customer Success**: Identify candidates, facilitate intros
- **Marketing**: Conduct interviews, write case studies
- **Legal**: Review release forms, approve content
- **Sales**: Provide customer relationship context

### Budget
- **Thank-you gifts**: $100-500 per customer
- **Legal review**: [Cost if external counsel]
- **Design**: Case study layout/graphics
- **Time**: ~20 hours per case study (interview, writing, approvals)

---

## Questions & Support

**For questions about customer testimonials**:
- Legal requirements → Legal team
- Customer selection → Customer Success team
- Interview process → Marketing team
- Content approval → Marketing/Product leadership

**Templates available**:
- `docs/templates/release-form.docx`
- `docs/templates/case-study-template.md`
- `docs/templates/interview-questions.md`

---

**Last Updated**: 2025-11-02
**Version**: 1.0
**Maintainer**: Marketing Team
**Next Review**: After first 3 case studies published
