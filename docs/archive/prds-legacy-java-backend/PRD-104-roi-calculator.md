# PRD-104: ROI Calculator

**Status:** DRAFT
**Priority:** P1 (Lead Generation)
**Created:** 2025-10-12
**Estimated Effort:** 3-5 days

## Context

ROI calculators are powerful B2B SaaS sales tools:
- Help prospects build business case for buying committee
- Qualify leads (users who engage are serious evaluators)
- Provide shareable results (sent to directors, VPs)
- Generate qualified leads through email-gated results

**BeTrace's Value Prop:**
- **SREs**: Reduce MTTR, prevent incidents
- **Developers**: Catch bugs in staging (not production)
- **Compliance**: Reduce audit prep time

## Problem Statement

Without ROI calculator, prospects struggle to:
1. Quantify BeTrace's value in dollars
2. Justify budget allocation to leadership
3. Compare BeTrace cost vs incident cost
4. Build business case for buying committee

**Result:** Longer sales cycles, stalled evaluations, "circle back next quarter."

## Goals

### Primary Goals
1. **Quantify Value**: Convert BeTrace benefits into dollar savings
2. **Build Business Case**: Generate shareable report for management
3. **Qualify Leads**: Collect email + company for high-intent prospects
4. **Enable Champions**: Arm internal advocates with data to sell BeTrace internally

### Success Metrics
- Calculator usage: >10% of landing page visitors
- Completion rate: >70% of users who start
- Email capture rate: >60%
- Calculator-to-trial conversion: >25%
- Shared results: >15% of completions

## Proposed Solution

### Calculator Inputs

#### Section 1: Incident Costs (SRE Focus)
```
"How much do incidents cost your organization?"

Incident Frequency:
[Slider: 0-50] incidents per month
Default: 5

Average MTTR (Mean Time to Repair):
[Slider: 0-8] hours
Default: 2 hours

Engineer Hourly Cost:
[Input: $] per hour
Default: $150/hour (based on $300K fully-loaded cost)

Customer Impact per Incident:
[Dropdown]
- Low ($0 - internal tooling)
- Medium ($1K-10K - B2B SaaS)
- High ($10K-100K - e-commerce)
- Critical ($100K+ - financial services)
Default: Medium
```

#### Section 2: Development Efficiency (Developer Focus)
```
"How many bugs reach production that could be caught earlier?"

Production Bugs per Month:
[Slider: 0-100] bugs
Default: 10

Average Time to Fix per Bug:
[Slider: 0-16] hours
Default: 4 hours

Engineer Hourly Cost:
[Auto-populated from Section 1]

Percentage Catchable with Behavioral Rules:
[Slider: 0-100]%
Default: 40% (conservative estimate)
```

#### Section 3: Compliance Costs (Compliance Focus)
```
"How much time do you spend on compliance evidence collection?"

Audit Prep Time per Year:
[Slider: 0-500] hours
Default: 80 hours (2 weeks)

Compliance Officer Hourly Cost:
[Input: $] per hour
Default: $100/hour

Number of Controls Requiring Evidence:
[Slider: 0-50] controls
Default: 20 (typical SOC2)

Manual Evidence Collection Time per Control:
[Slider: 0-10] hours
Default: 2 hours
```

### Calculator Logic

#### Cost Calculation Formulas

**Incident Cost Savings:**
```javascript
const incidentCostPerMonth =
  (incidentFrequency * mttrHours * engineerCost) +
  (incidentFrequency * customerImpact)

// BeTrace reduces MTTR by 50-70% (traces pinpoint root cause)
const betraceMTTRReduction = 0.6
const betraceIncidentSavings = incidentCostPerMonth * betraceMTTRReduction

// BeTrace prevents 20-40% of incidents (caught in staging)
const betraceIncidentPrevention = 0.3
const betracePreventionSavings = incidentCostPerMonth * betraceIncidentPrevention

const totalIncidentSavings = betraceIncidentSavings + betracePreventionSavings
```

**Development Efficiency Savings:**
```javascript
const bugCostPerMonth =
  productionBugs * timeToFixPerBug * engineerCost

const catchableInStaging = bugCostPerMonth * (catchablePercentage / 100)

// Fixing in staging is 10x cheaper than production
const stagingFixCost = catchableInStaging * 0.1
const developmentSavings = catchableInStaging - stagingFixCost
```

**Compliance Efficiency Savings:**
```javascript
const annualComplianceCost =
  (auditPrepHours + (numControls * hoursPerControl)) * complianceOfficerCost

// BeTrace automates 80-90% of evidence collection
const betraceAutomationRate = 0.85
const complianceSavings = annualComplianceCost * betraceAutomationRate / 12 // monthly
```

**Total Monthly Savings:**
```javascript
const totalMonthlySavings =
  totalIncidentSavings +
  developmentSavings +
  complianceSavings

const annualSavings = totalMonthlySavings * 12
```

**ROI Calculation:**
```javascript
// BeTrace estimated cost (conservative)
const betraceMonthlyCost = 5000 // $5K/month for mid-market
const betraceAnnualCost = betraceMonthlyCost * 12

const netAnnualSavings = annualSavings - betraceAnnualCost
const roiPercentage = ((netAnnualSavings / betraceAnnualCost) * 100).toFixed(0)
const paybackMonths = (betraceAnnualCost / totalMonthlySavings).toFixed(1)
```

### Results Display

#### Visual: ROI Summary Card
```
┌─────────────────────────────────────────┐
│ Your Estimated BeTrace ROI                 │
├─────────────────────────────────────────┤
│ Annual Savings:     $437,000            │
│ BeTrace Cost:          $60,000             │
│ Net Benefit:        $377,000            │
│                                         │
│ ROI:               629%                 │
│ Payback Period:    1.6 months           │
└─────────────────────────────────────────┘
```

#### Breakdown Table
```markdown
| Savings Category        | Monthly  | Annual   |
|------------------------|----------|----------|
| Incident Cost Reduction | $18,500  | $222,000 |
| MTTR Reduction         | $9,300   | $111,600 |
| Incident Prevention    | $9,200   | $110,400 |
| Development Efficiency | $12,000  | $144,000 |
| Compliance Automation  | $6,000   | $72,000  |
| **Total Savings**      | **$36,500** | **$438,000** |
```

#### Visual: Savings Chart
```
[Bar chart showing monthly savings breakdown]
- Incident Reduction: 50%
- Development: 33%
- Compliance: 17%
```

#### Call to Action
```
"Want a detailed ROI report?"

[Email Gate Form]
Email: [________________]
Company: [________________]
Optionally: "What's your biggest observability challenge?"

[Button: "Send Me the Full ROI Report"]

After submit:
- Instant PDF download (includes assumptions, methodology)
- Email with PDF + trial signup link
- Sales notification (high-intent lead)
```

### Calculator Design

#### UX Principles
1. **Progressive Disclosure**: Show 1 section at a time (avoid overwhelming)
2. **Smart Defaults**: Pre-fill with industry benchmarks (user can adjust)
3. **Real-Time Updates**: Results update as user moves sliders
4. **Visual Feedback**: Charts and graphs (not just numbers)
5. **Mobile-Friendly**: 60% responsive layout (many users on mobile)

#### Visual Design
- **Clean, Modern**: Match landing page design (PRD-100)
- **Trust Indicators**: "Based on industry benchmarks" footnotes
- **Conservative Estimates**: "Results may vary" disclaimer
- **Shareable**: "Share this report" button (LinkedIn, email)

### Technical Implementation

#### Technology Stack

**Option 1: React Component (Embedded)**
```javascript
// components/ROICalculator.tsx
import { useState } from 'react'
import { LineChart, BarChart } from 'recharts'

export function ROICalculator() {
  const [inputs, setInputs] = useState(defaultInputs)
  const results = calculateROI(inputs)

  return (
    <div className="roi-calculator">
      <InputSection inputs={inputs} onChange={setInputs} />
      <ResultsSection results={results} />
      <EmailGateForm onSubmit={handleEmailCapture} />
    </div>
  )
}
```

**Option 2: Standalone Page**
- URL: `betrace.com/roi-calculator`
- Embed on landing page via `<iframe>` or direct link

**Recommendation:** **React component** (better UX, no iframe issues)

#### Analytics Events
```javascript
// PostHog tracking
posthog.capture('roi_calculator_started')
posthog.capture('roi_calculator_input_changed', { field: 'incidentFrequency', value: 10 })
posthog.capture('roi_calculator_completed', { totalSavings: 437000, roi: 629 })
posthog.capture('roi_calculator_email_submitted', { email, company })
posthog.capture('roi_calculator_shared', { method: 'linkedin' })
```

#### Email Automation
```
Subject: Your BeTrace ROI Report: $377K Annual Savings

Hi [Name],

Thanks for using the BeTrace ROI Calculator! Based on your inputs:

- Annual Savings: $437,000
- ROI: 629%
- Payback Period: 1.6 months

[Download Full PDF Report]

Ready to see these savings in action?
[Request 30-Day Trial]

Questions? Reply to this email or schedule a call:
[Book Demo with Solutions Engineer]

Best,
BeTrace Team
```

### PDF Report Contents

#### Page 1: Executive Summary
- Your ROI summary card
- Savings breakdown (chart)
- Key assumptions

#### Page 2: Detailed Methodology
- How we calculated incident savings
- Development efficiency assumptions
- Compliance automation rates
- Industry benchmarks cited

#### Page 3: Next Steps
- Request trial access
- Book demo with solutions engineer
- Read use case library (PRD-103)
- Download technical docs (PRD-102)

## Implementation Plan

### Phase 1: Calculator Logic (2 days)
1. Write calculation functions (JavaScript)
2. Define default values (research industry benchmarks)
3. Unit test formulas (ensure accuracy)
4. Create results visualizations (Recharts library)

### Phase 2: UI Development (2 days)
1. Build input forms (sliders, dropdowns)
2. Implement real-time results update
3. Design results cards and charts
4. Mobile responsive styling

### Phase 3: Email Integration (1 day)
1. Create email gate form (React Hook Form)
2. Integrate with PostHog or HubSpot
3. Set up email automation (SendGrid/Mailgun)
4. Generate PDF report (Puppeteer or React-PDF)

### Phase 4: Launch (Half day)
1. Embed on landing page (PRD-100)
2. Add analytics tracking
3. Test email flow end-to-end
4. Monitor conversion metrics

## Testing Strategy

### Calculation Validation
- **5 Test Cases**: Extreme inputs (0 incidents, 100 bugs, etc.)
- **Financial Review**: Have finance team validate formulas
- **Benchmark Check**: Compare defaults to industry data (Gartner, Forrester)

**Success Criteria:**
- Calculations accurate to 2 decimal places
- No negative savings values
- Results feel realistic (not exaggerated)

### User Testing
- **10 Target Personas**: 4 SREs, 3 Developers, 3 Compliance Officers
- **Questions:**
  1. "Are the default values realistic for your org?"
  2. "Would you use this report to justify BeTrace internally?"
  3. "What's missing from the calculator?"

**Success Criteria:**
- 8/10 users say defaults are "realistic" or "close"
- 7/10 users would share report with management

### Conversion Testing
- **A/B Test:** Email gate placement
  - A: Gate before showing results (no results without email)
  - B: Gate after showing results (optional download)
  - Metric: Email capture rate

- **A/B Test:** Form fields
  - A: Email only
  - B: Email + Company
  - Metric: Conversion rate

## Dependencies

- **PRD-100**: Landing page embeds calculator
- **PRD-103**: Use case library linked from report

## Risks & Mitigations

### Risk: ROI seems too good to be true (credibility issue)
**Mitigation:** Use conservative estimates, cite industry benchmarks, add "Results may vary" disclaimer

### Risk: Low completion rate (<50%)
**Mitigation:** Reduce input fields, improve UX, show progress bar

### Risk: Email gate reduces engagement
**Mitigation:** Show partial results before gate, offer PDF download as value-add

### Risk: Users game the calculator (extreme inputs)
**Mitigation:** Cap slider ranges, add validation, show "unlikely" warnings

## Open Questions

1. Should we show BeTrace pricing in calculator?
   - **Recommendation:** Use conservative estimate ($5K/month), note "actual pricing varies"

2. Should calculator be gated (email required to use)?
   - **Recommendation:** Ungated usage, gated PDF download (hybrid)

3. Should we include team size multiplier (scale savings)?
   - **Recommendation:** Yes, add "Engineering Team Size" input (10-500 engineers)

4. Should results be saved/shareable via URL?
   - **Recommendation:** Yes, generate unique URL for sharing (e.g., `betrace.com/roi/abc123`)

## Success Criteria

- ✅ Calculator completion rate >70%
- ✅ Email capture rate >60%
- ✅ Calculator-to-trial conversion >25%
- ✅ 8/10 user testers say results are realistic
- ✅ PDF shared by >15% of users

## References

- [B2B SaaS ROI Calculator Best Practices](https://www.demandcurve.com/playbooks/saas-roi-calculator)
- [Gartner: True Cost of Downtime](https://www.gartner.com/en/information-technology/glossary/downtime)
- [Unbounce B2B Conversion Benchmarks](https://unbounce.com/conversion-rate-optimization/b2b-conversion-rates/)
- PRD-100: Marketing Landing Page (embed location)
- PRD-103: Use Case Library (linked from report)
