# Product Prioritization Framework

Structured approach for evaluating and prioritizing features for BeTrace.

## RICE Scoring Model

### Formula
```
RICE Score = (Reach × Impact × Confidence) / Effort
```

### Components

**Reach**: Number of users/events affected per quarter
- 10,000+ = Massive (all enterprise customers)
- 5,000-10,000 = High (most enterprise customers)
- 1,000-5,000 = Medium (segment of customers)
- 100-1,000 = Low (niche use case)
- <100 = Minimal (edge case)

**Impact**: Customer value delivered
- 3.0 = Massive (solves critical pain, no alternatives)
- 2.0 = High (significant improvement, weak alternatives)
- 1.0 = Medium (moderate improvement, alternatives exist)
- 0.5 = Low (nice-to-have, workarounds sufficient)
- 0.25 = Minimal (aesthetic/convenience)

**Confidence**: Certainty in estimates
- 100% = High (validated with customers, data-driven)
- 80% = Medium (some customer feedback, reasonable assumptions)
- 50% = Low (hypothesis, no validation)

**Effort**: Person-months of development time
- Include: coding, testing, documentation, review
- Exclude: ongoing maintenance (captured separately)

### Scoring Example

**Feature**: AI Agent Goal Deviation Detection

```
Reach = 10,000 (all enterprise customers deploying AI agents)
Impact = 3.0 (solves critical AI safety gap, no alternatives)
Confidence = 80% (validated by International AI Safety Report)
Effort = 1.5 person-months

RICE Score = (10,000 × 3.0 × 0.8) / 1.5 = 16,000
```

**Interpretation**: Score >10,000 = Highest priority

## MoSCoW Categorization

### Must Have
- Critical for product viability
- No workaround exists
- High customer/business impact
- Regulatory/compliance requirement

**BeTrace Examples**:
- Compliance span cryptographic signing (SOC2 requirement)
- PII redaction enforcement (HIPAA requirement)
- Rule engine sandboxing (security requirement)

### Should Have
- Important but not critical
- Workaround exists but painful
- Significant customer value
- Competitive parity

**BeTrace Examples**:
- AI agent monitoring (validated market need)
- Performance optimization (P99 latency SLA)
- Multi-tenant KMS isolation (security best practice)

### Could Have
- Desirable but not necessary
- Nice-to-have improvements
- Low effort, moderate value
- Polish and refinement

**BeTrace Examples**:
- Dark mode UI
- Advanced TraceQL query builder
- Custom dashboard templates

### Won't Have (This Release)
- Out of scope
- Low value relative to effort
- Strategic decision to defer
- Violates product principles

**BeTrace Examples**:
- Generic APM features (not differentiated)
- Infrastructure deployment (violates ADR-011)
- Pre-deployment testing tools (not our focus)

## Value vs. Effort Matrix

```
High Value │ QUICK WINS      │ STRATEGIC      │
           │ (Do First)      │ (Plan & Do)    │
           │                 │                │
           ├─────────────────┼────────────────┤
           │                 │                │
Low Value  │ FILL-INS        │ TIME SINKS     │
           │ (Do If Time)    │ (Avoid)        │
           └─────────────────┴────────────────┘
             Low Effort         High Effort
```

### Quadrant Definitions

**Quick Wins** (High Value, Low Effort)
- Immediate priorities
- Deliver in current sprint
- Example: Bug fixes with high user impact

**Strategic** (High Value, High Effort)
- Plan thoroughly
- Break into phases
- Example: AI agent monitoring (full feature set)

**Fill-Ins** (Low Value, Low Effort)
- Do if capacity available
- Don't block strategic work
- Example: UI polish, minor improvements

**Time Sinks** (Low Value, High Effort)
- Avoid or defer
- Reassess if priorities change
- Example: Complex features with minimal adoption

## Backlog Prioritization Process

### Step 1: Categorize
- Label each item: Must/Should/Could/Won't
- Place in Value vs. Effort quadrant
- Calculate RICE score

### Step 2: Stack Rank
- Sort by RICE score within each category
- Consider dependencies
- Account for strategic themes

### Step 3: Capacity Planning
- Estimate team velocity
- Assign items to sprints
- Leave buffer for unknowns (20%)

### Step 4: Communicate
- Share roadmap with stakeholders
- Explain trade-offs
- Set expectations on timelines

### Step 5: Review & Adjust
- Re-prioritize every sprint
- Incorporate customer feedback
- Adapt to market changes

## Feature Request Template

```markdown
## Feature Request

**Title**: [Concise feature name]

**Customer Problem**:
[What pain does this solve? For whom?]

**Proposed Solution**:
[High-level approach]

**Success Metrics**:
[How do we measure success?]

**Reach**: [Number of users affected]
**Impact**: [3.0 / 2.0 / 1.0 / 0.5 / 0.25]
**Confidence**: [100% / 80% / 50%]
**Effort**: [Person-months estimate]

**RICE Score**: [Calculated]

**MoSCoW**: [Must / Should / Could / Won't]

**Dependencies**:
[Other features/infrastructure required]

**Alternatives Considered**:
[Other approaches and why rejected]

**Customer Validation**:
[How was this validated?]
```

## Prioritization Red Flags

### Avoid These Traps

**❌ HiPPO (Highest Paid Person's Opinion)**
- Prioritize based on data, not authority
- Validate executive requests with customers

**❌ Feature Factory**
- Focus on outcomes, not output
- Measure impact, not velocity

**❌ Squeaky Wheel**
- Loudest customer ≠ most important
- Weight feedback by customer value

**❌ Shiny Object Syndrome**
- Stick to strategy
- Don't chase every trend

**❌ Analysis Paralysis**
- Perfect is the enemy of good
- Ship MVPs, iterate based on feedback

## BeTrace-Specific Guidance

### Core Positioning: Behavioral Assurance

**Prioritize features that**:
- ✅ Enable runtime behavioral monitoring
- ✅ Solve problems testing can't catch
- ✅ Provide compliance evidence
- ✅ Address AI safety concerns

**Deprioritize features that**:
- ❌ Replicate generic APM tools
- ❌ Focus on pre-deployment testing
- ❌ Don't leverage OpenTelemetry
- ❌ Violate pure application framework (ADR-011)

### Market Differentiation

**High Priority**: Features validated by International AI Safety Report
- AI agent monitoring
- Hallucination detection
- Bias detection
- Dual-use capability monitoring

**Medium Priority**: Compliance evidence generation
- SOC2, HIPAA, FedRAMP, ISO27001
- Automated audit trails
- Cryptographic integrity

**Low Priority**: Generic observability
- Competing with Datadog/New Relic
- Not differentiated
- Commoditized features

## References

- **Product Strategy**: @CLAUDE.md
- **Market Validation**: @marketing/docs/AI-SAFETY-FOR-ENTERPRISE.md
- **PRD Templates**: @.skills/product/SKILL.md
- **AI Safety Report**: International Scientific Report on the Safety of Advanced AI (January 2025)
