# PRD-108: Multi-Path Conversion Funnel

**Status:** DRAFT
**Priority:** P2 (Conversion Optimization)
**Created:** 2025-10-12
**Estimated Effort:** 1 week

## Context

B2B SaaS buying in 2025 is **committee-driven**, not individual-driven:
- Typical buying committee: 6-10 stakeholders (Gartner 2025)
- Different personas have different evaluation criteria
- Single CTA ("Request Demo") creates friction for early-stage researchers
- Multi-path funnels optimize for **buying committee journey**, not just individual touchpoints

**BeTrace's Three Personas:**
1. **SREs**: Hands-on evaluators (want to see product immediately)
2. **Engineering Directors**: Business case builders (want ROI data)
3. **Compliance Officers**: Risk assessors (want security/compliance proof)

## Problem Statement

Single-path conversion funnels fail because:
1. SREs don't want to "book a demo" (too high friction)
2. Directors don't want to "try interactive demo" (too technical)
3. Compliance officers don't fit either path (need different content)
4. One size fits all → lower conversion rates

**Result:** Qualified leads drop off because CTA doesn't match evaluation stage.

## Goals

### Primary Goals
1. **Persona-Specific Paths**: Different CTAs for different personas/stages
2. **Buying Committee Optimization**: Multiple stakeholders can self-serve
3. **Conversion Rate Lift**: Optimize for full committee, not just individual
4. **Lead Qualification**: Route leads to appropriate sales motion

### Success Metrics
- Overall conversion rate: +15% lift
- Qualified lead rate: +25% (better persona matching)
- Time-to-trial: -20% (self-service paths)
- Sales close rate: +10% (better-qualified leads)

## Proposed Solution

### Conversion Funnel Paths

#### Path 1: Technical Evaluator (SRE, Developer)
**Persona:** Hands-on engineer who wants to try product immediately
**Friction Tolerance:** Low (no forms, no sales calls)
**Conversion Goal:** Trial signup

```
Landing Page
    ↓
[CTA: "Try Interactive Demo"] (ungated)
    ↓
Interactive Demo (PRD-101)
    ↓
[CTA: "Read Technical Docs"]
    ↓
Documentation Site (PRD-102)
    ↓
[CTA: "Request Trial Access"] (minimal form: email only)
    ↓
Trial Environment (self-service)
    ↓
[Automated email: "Schedule implementation call?"]
    ↓
Sales Engagement (Product-Qualified Lead)
```

**Key CTAs:**
- Primary: "Try Interactive Demo" (immediate gratification)
- Secondary: "Read Technical Docs" (self-service evaluation)
- Tertiary: "Request Trial Access" (high intent, low friction)

#### Path 2: Business Case Builder (Engineering Director, VP)
**Persona:** Decision-maker who needs to justify budget
**Friction Tolerance:** Medium (will fill form for valuable content)
**Conversion Goal:** Sales conversation with business case

```
Landing Page
    ↓
[CTA: "Calculate ROI"]
    ↓
ROI Calculator (PRD-104)
    ↓
[CTA: "Download ROI Report"] (gated: email + company)
    ↓
PDF Report Delivered
    ↓
[Email: "See how others achieved these results"]
    ↓
Case Study Library (PRD-106)
    ↓
[CTA: "Schedule ROI Review Call"] (high-value offer)
    ↓
Sales Engagement (Sales-Qualified Lead)
```

**Key CTAs:**
- Primary: "Calculate ROI" (build business case)
- Secondary: "Download Case Studies" (social proof)
- Tertiary: "Schedule ROI Review" (consultative sales)

#### Path 3: Risk Assessor (Compliance Officer, InfoSec)
**Persona:** Gatekeeper evaluating security/compliance
**Friction Tolerance:** High (willing to engage if concerns addressed)
**Conversion Goal:** InfoSec approval

```
Landing Page
    ↓
[CTA: "View Security & Compliance"]
    ↓
Security Page (PRD-107)
    ↓
[CTA: "Download Security Whitepaper"] (gated)
    ↓
Whitepaper Delivered
    ↓
[Email: "Schedule compliance assessment"]
    ↓
Compliance Assessment Call (Solutions Engineer)
    ↓
InfoSec Approval → Pass to Technical Evaluator
```

**Key CTAs:**
- Primary: "View Security Status" (transparency)
- Secondary: "Download Compliance Guide" (detailed evidence)
- Tertiary: "Schedule Assessment" (expert consultation)

#### Path 4: Researcher (Early-Stage, Low Intent)
**Persona:** Exploring options, not ready to commit
**Friction Tolerance:** Very low (no forms)
**Conversion Goal:** Newsletter signup, content engagement

```
Landing Page
    ↓
[CTA: "Explore Use Cases"]
    ↓
Use Case Library (PRD-103)
    ↓
[CTA: "Subscribe for Updates"] (minimal: email only)
    ↓
Email Nurture Campaign
    ↓
[Email: Monthly content, product updates]
    ↓
Re-engage when ready (drip campaign)
```

**Key CTAs:**
- Primary: "Explore Use Cases" (educate)
- Secondary: "Compare BeTrace vs X" (positioning)
- Tertiary: "Subscribe for Updates" (stay in touch)

---

## CTA Matrix by Page & Persona

### Landing Page (PRD-100)

| Section | SRE/Developer | Director | Compliance | Researcher |
|---------|--------------|----------|------------|------------|
| **Hero** | Try Demo | Calculate ROI | View Security | Explore Use Cases |
| **Problem** | Read Docs | See Case Studies | Compliance Status | Compare BeTrace vs APM |
| **Workflow** | Try Demo | Download Guide | Security Whitepaper | Subscribe |
| **Social Proof** | GitHub | ROI Report | Audit Evidence | Blog |
| **Footer** | Request Trial | Contact Sales | Schedule Assessment | Newsletter |

### Documentation Site (PRD-102)

| Page | Primary CTA | Secondary CTA |
|------|-------------|---------------|
| **What is BeTrace** | Try Demo | Quick Start |
| **Quick Start** | Request Trial | Join Slack |
| **DSL Syntax** | Test in Editor | See Examples |
| **Compliance** | Download Guide | Schedule Call |
| **API Reference** | Request API Key | Contact Support |

### Use Case Pages (PRD-103)

| Persona | Primary CTA | Secondary CTA | Tertiary CTA |
|---------|-------------|---------------|--------------|
| **SRE** | Try Demo | Download Implementation Guide | Request Trial |
| **Developer** | Read Docs | Download API Contract Guide | Try Demo |
| **Compliance** | Download Evidence Guide | Schedule Assessment | View Security |

---

## CTA Design & Copy

### Visual Hierarchy

**Primary CTA:**
- Large button (48px height)
- High contrast color (BeTrace brand blue)
- Above the fold
- Clear action verb ("Try," "Calculate," "Download")

**Secondary CTA:**
- Medium button (40px height)
- Outline style (less prominent)
- Below primary CTA
- Supportive action ("Learn More," "Explore")

**Tertiary CTA:**
- Text link (underlined)
- Footer or sidebar placement
- Low-friction ("Subscribe," "Bookmark")

### Copy Guidelines

**❌ Generic:**
- "Get Started"
- "Learn More"
- "Contact Us"

**✅ Specific:**
- "Try Interactive Demo" (clear action)
- "Calculate Your ROI" (clear value)
- "Download Security Whitepaper" (clear deliverable)

### A/B Testing Plan

**Test 1: Primary CTA Copy (SRE Path)**
- A: "Try Interactive Demo"
- B: "See BeTrace in Action"
- C: "Explore BeTrace Live"
- Metric: Click-through rate

**Test 2: Form Length (Director Path)**
- A: Email only
- B: Email + Company
- C: Email + Company + Role + Challenge
- Metric: Form completion rate

**Test 3: CTA Placement (Compliance Path)**
- A: Security badges above fold
- B: Security badges below use cases
- Metric: Security page views

---

## Lead Scoring & Routing

### Lead Scoring Matrix

| Signal | Points | Qualification |
|--------|--------|---------------|
| **Trial Request** | +50 | High Intent (PQL) |
| **ROI Calculator Completion** | +40 | High Intent (SQL) |
| **Security Whitepaper Download** | +30 | Medium Intent |
| **Case Study Download** | +25 | Medium Intent |
| **Interactive Demo Completion** | +20 | Medium Intent |
| **Newsletter Signup** | +5 | Low Intent |

**Qualification Thresholds:**
- **Product-Qualified Lead (PQL):** 50+ points
- **Sales-Qualified Lead (SQL):** 40+ points
- **Marketing-Qualified Lead (MQL):** 20+ points
- **Subscriber:** <20 points

### Routing Rules

**PQL (Trial Request):**
- Route to: Product team (automated trial provisioning)
- Follow-up: Email with onboarding guide
- Timeline: Instant trial access, follow-up in 3 days

**SQL (ROI Calculator, Case Study):**
- Route to: Sales team (BDR/AE)
- Follow-up: Phone call within 24 hours
- Offer: ROI review call, custom demo

**MQL (Demo, Docs, Comparison Pages):**
- Route to: Marketing automation (email nurture)
- Follow-up: Drip campaign (7 emails over 30 days)
- Goal: Convert to SQL or PQL

**Subscriber (Newsletter):**
- Route to: Marketing automation (monthly digest)
- Follow-up: Content emails, product updates
- Goal: Re-engage when ready

---

## Email Nurture Campaigns

### Technical Evaluator Nurture (PQL)

**Day 0:** Welcome email + trial access credentials
**Day 3:** "Getting started with BeTrace" (quick start guide)
**Day 7:** "Rule library examples" (copy-paste templates)
**Day 14:** "Schedule implementation call" (offer support)
**Day 21:** "Trial expiring soon" (convert to paid)

### Business Case Builder Nurture (SQL)

**Day 0:** ROI report delivered + case study link
**Day 2:** "How [Company X] achieved 60% MTTR reduction"
**Day 5:** "Schedule ROI review call" (BDR outreach)
**Day 10:** "Security & compliance overview" (address objections)
**Day 15:** "Final follow-up: Still interested?" (breakup email)

### Risk Assessor Nurture (InfoSec)

**Day 0:** Security whitepaper delivered
**Day 3:** "BeTrace security architecture deep dive"
**Day 7:** "Compliance evidence generation walkthrough"
**Day 14:** "Schedule compliance assessment" (Solutions Engineer)
**Day 21:** "Security FAQ" (address common concerns)

---

## Implementation Plan

### Phase 1: CTA Audit & Design (2 days)
1. Audit existing CTAs across all pages
2. Design new CTA variants (3 per persona)
3. Create CTA component library (React)
4. Define A/B test variations

### Phase 2: Landing Page Updates (2 days)
1. Add persona-specific CTAs to hero section
2. Create "Choose your path" section (3 paths)
3. Implement CTA tracking (PostHog)
4. Mobile responsive testing

### Phase 3: Lead Scoring & Routing (2 days)
1. Configure PostHog lead scoring rules
2. Set up CRM integration (HubSpot/Salesforce)
3. Create automated routing workflows
4. Test lead assignment logic

### Phase 4: Email Nurture (1 day)
1. Write email copy for 3 nurture campaigns
2. Configure email automation (SendGrid/Mailgun)
3. Set up drip sequences
4. Test email deliverability

---

## Testing Strategy

### Funnel Analysis
- **Metrics:** Conversion rate at each stage
- **Tool:** PostHog funnel analysis
- **Goal:** Identify drop-off points, optimize CTAs

**Example Funnel (SRE Path):**
```
Landing Page: 1000 visitors
↓ (30% CTR on "Try Demo")
Interactive Demo: 300 starters
↓ (60% completion)
Demo Completed: 180 completers
↓ (25% CTR on "Request Trial")
Trial Signup: 45 signups (4.5% overall conversion)
```

### A/B Testing
- **Test Duration:** 2 weeks minimum (statistical significance)
- **Traffic Split:** 50/50 (control vs variant)
- **Success Metric:** Conversion rate, not just clicks

### Cohort Analysis
- **Question:** Which persona path has highest lifetime value?
- **Hypothesis:** PQL (trial) has faster close, SQL (ROI) has higher ACV
- **Analysis:** Track cohorts by entry path, measure close rate + revenue

---

## Dependencies

- **PRD-100**: Landing page (primary CTA placement)
- **PRD-101**: Interactive demo (SRE path)
- **PRD-102**: Documentation (SRE path)
- **PRD-103**: Use cases (all paths)
- **PRD-104**: ROI calculator (Director path)
- **PRD-107**: Security badges (Compliance path)

## Risks & Mitigations

### Risk: Too many CTAs confuse visitors (analysis paralysis)
**Mitigation:** Use "Choose your path" section, clear persona labels

### Risk: Lead scoring is inaccurate (false positives)
**Mitigation:** Iterate on scoring model, feedback from sales team

### Risk: Email nurture campaigns feel spammy
**Mitigation:** Personalize based on entry path, easy unsubscribe, valuable content

### Risk: Low conversion on high-friction paths (Compliance)
**Mitigation:** A/B test form fields, offer ungated preview content

## Open Questions

1. Should we use a single "Request Trial" CTA for all personas?
   - **Recommendation:** No, persona-specific CTAs (SRE: "Try," Director: "Calculate ROI")

2. Should lead scoring be visible to prospects (gamification)?
   - **Recommendation:** No, internal use only (avoid manipulation)

3. Should we auto-qualify leads based on email domain (e.g., @google.com)?
   - **Recommendation:** Yes, enterprise domains get higher priority routing

4. Should nurture campaigns stop after trial signup?
   - **Recommendation:** Shift to onboarding campaign, not marketing nurture

## Success Criteria

- ✅ Overall conversion rate: +15% lift
- ✅ PQL rate: +25% (better persona matching)
- ✅ Time-to-trial: -20% (self-service paths)
- ✅ Sales close rate: +10% (better-qualified leads)
- ✅ Email open rate: >40% (nurture campaigns)

## References

- [B2B Buying Committee Journey 2025](https://www.gartner.com/en/sales/insights/b2b-buying-journey)
- [Multi-Path Conversion Funnels](https://www.cxl.com/blog/conversion-funnel-optimization/)
- [Lead Scoring Best Practices](https://www.hubspot.com/marketing-statistics)
- PRD-100-107: All marketing foundations (CTA integration points)
