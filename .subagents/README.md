# FLUO Enterprise Team (Perspective-Based Subagents)

This directory contains perspective-based subagents that mirror a standard enterprise software development team, complementing the capability-based Agent Skills.

## Concept: Perspectives vs. Capabilities

**Agent Skills** (`.skills/`) = Technical capabilities
- How to implement features
- How to review security
- How to write tests
- **Answer**: "How do we do this?"

**Subagents** (`.subagents/`) = Stakeholder perspectives
- Should we build this?
- What's the business value?
- Who will use it?
- **Answer**: "Should we do this? Why? For whom?"

## The Team

### Product & Business

#### 1. [Product Manager](./product-manager/)
**Focus**: Customer value, market fit, feature prioritization

**Key Questions**:
- Does this solve a real customer problem?
- What's the ROI?
- How do we measure success?

**Uses Skills**: `product/`, `implementation/`

#### 2. [Business Analyst](./business-analyst/)
**Focus**: Business requirements, ROI, stakeholder alignment

**Key Questions**:
- What's the business value?
- Who are the stakeholders?
- How do we calculate ROI?

**Uses Skills**: `product/`, `compliance/`

#### 3. [Customer Success](./customer-success/)
**Focus**: User experience, adoption, support burden

**Key Questions**:
- Will users understand this?
- Can they self-serve?
- What's the onboarding experience?

**Uses Skills**: `product/`, `react-tanstack/`, `quality/`

### Engineering & Technical

#### 4. [Engineering Manager](./engineering-manager/)
**Focus**: Team velocity, technical debt, developer experience

**Key Questions**:
- Can the team sustain this?
- What's the long-term cost?
- Are we balancing features vs. tech debt?

**Uses Skills**: `architecture/`, `quality/`, `nix/`

#### 5. [Tech Lead](./tech-lead/)
**Focus**: System design, scalability, technical excellence

**Key Questions**:
- Is this the right technical approach?
- Will it scale?
- Does it align with architecture?

**Uses Skills**: `architecture/`, `implementation/`, `java-quarkus/`, `react-tanstack/`

#### 6. [SRE](./sre/)
**Focus**: Reliability, observability, operational excellence

**Key Questions**:
- Will this work in production?
- How do we debug it?
- What's the failure mode?

**Uses Skills**: `quality/`, `implementation/`, `nix/`

### Security & Compliance

#### 7. [Security Officer](./security-officer/)
**Focus**: Risk management, compliance, threat landscape

**Key Questions**:
- What are the security implications?
- Are we compliant?
- What threats exist?

**Uses Skills**: `security/`, `compliance/`

## How It Works

### Workflow: Feature Request → Delivery

**Example**: "Add AI agent monitoring for goal deviation"

```
1. Product Manager (perspective):
   ✅ High customer value (AI safety validated by report)
   ✅ Competitive differentiation
   → Generate PRD using product/ skill

2. Business Analyst (perspective):
   ✅ ROI: Prevent $M incidents
   ✅ Aligns with enterprise AI safety market
   → Validate business case

3. Tech Lead (perspective):
   ✅ Fits pure application framework
   ⚠️ New dependency (embedding library)
   → Design using architecture/ skill

4. Engineering Manager (perspective):
   ✅ Team has bandwidth (21 points)
   ✅ 70/30 feature/debt balance maintained
   → Capacity planning

5. Security Officer (perspective):
   ✅ No new PII concerns
   ❓ Need threat model for agent monitoring
   → Security review using security/ skill

6. SRE (perspective):
   ✅ Observable via OpenTelemetry
   ⚠️ Performance impact of embeddings?
   → Production readiness using quality/ skill

7. Customer Success (perspective):
   ✅ Solves real pain point
   ⚠️ How do users configure thresholds?
   → Adoption planning

8. Implementation:
   → Use implementation/, java-quarkus/, quality/ skills
   → Execute technical work
```

## Perspective Files

Each subagent directory contains:

- **`PERSPECTIVE.md`** - Role definition, responsibilities, decision framework
- **Supporting files** - Role-specific frameworks and checklists

### PERSPECTIVE.md Format

```yaml
---
role: [Role Name]
focus: [Key areas of concern]
key_question: [Primary question this role asks]
---

# [Role] Perspective

## Role Definition
[What this role represents]

## Core Responsibilities
[What they're accountable for]

## Decision Framework
[How they make decisions]

## Integration with Skills
[Which capabilities they leverage]
```

## Example Conversations

### Example 1: Feature Approval

**User**: "Should we add dark mode to the UI?"

**Product Manager**:
- ⚠️ Low RICE score (250)
- ❌ No customer churn data
- ❌ Not competitive differentiator
- **Decision**: Defer

**Engineering Manager**:
- ✅ Low effort (8 points, 1 week)
- ❌ Opportunity cost (could optimize performance instead)
- **Decision**: Agree with defer

**Customer Success**:
- ⚠️ Some users request this
- ✅ Workaround exists (browser extensions)
- **Decision**: Not urgent

**Outcome**: ❌ Defer to backlog, prioritize customer value features

### Example 2: Technical Debt Decision

**User**: "Should we refactor the rule engine?"

**Engineering Manager**:
- ⚠️ Full sprint effort (34 points)
- ❌ Violates 70/30 rule
- **Recommendation**: Phase into 3 sprints

**Tech Lead**:
- ✅ Improves performance
- ✅ Simplifies codebase
- ✅ Supports phased approach
- **Decision**: Phase 1 (caching) this sprint

**SRE**:
- ✅ Performance improvement critical (p99 850ms → 500ms)
- ⚠️ Regression risk if not tested
- **Decision**: Require comprehensive tests

**Outcome**: ✅ Approve Phase 1 (caching layer, 13 points)

### Example 3: Security Concern

**User**: "Can we skip PII redaction for performance?"

**Security Officer**:
- ❌ CRITICAL: HIPAA violation
- ❌ HIGH RISK: Data breach liability
- ❌ NO WORKAROUND
- **Decision**: BLOCK

**Product Manager**:
- ❌ Customer trust violation
- ❌ Regulatory non-compliance
- **Decision**: Support security officer

**Outcome**: ❌ REJECTED (security veto)

## Decision Authority

### Veto Power
- **Security Officer**: Security/compliance violations
- **Tech Lead**: Architecture violations (ADR-011)
- **Product Manager**: Customer value misalignment

### Consensus Required
- **Feature Prioritization**: PM + Eng Manager + BA
- **Technical Design**: Tech Lead + SRE + Eng Manager
- **Production Deployment**: SRE + Security Officer + Tech Lead

### Advisory
- **Customer Success**: User experience feedback
- **Business Analyst**: ROI validation

## Integration with Skills

**Subagents provide perspective**:
- "Should we build this?" (priority)
- "For whom?" (stakeholders)
- "Why?" (value proposition)

**Skills provide capability**:
- "How do we build this?" (implementation)
- "What patterns?" (architecture)
- "What standards?" (quality)

**Example Flow**:
```
Product Manager (perspective): "Build AI agent monitoring"
↓ uses
product/ skill (capability): "Here's the PRD template"
↓
Tech Lead (perspective): "Design with DSL + embeddings"
↓ uses
architecture/ skill (capability): "ADR-011 compliance check"
↓ uses
implementation/ skill (capability): "REST endpoint patterns"
↓
Security Officer (perspective): "Security review required"
↓ uses
security/ skill (capability): "OWASP checklist"
```

## Benefits of Perspective-Based Subagents

### 1. Holistic Decision-Making
- Technical capability + stakeholder perspective
- Multiple viewpoints surface trade-offs
- Realistic constraints (capacity, users, risk)

### 2. Clearer Prioritization
- Business value + technical feasibility
- Customer needs + team capacity
- Short-term delivery + long-term sustainability

### 3. Cross-Functional Alignment
- All perspectives considered before execution
- Early identification of conflicts
- Stakeholder buy-in

### 4. Realistic Planning
- Capacity constraints (Eng Manager)
- User adoption barriers (Customer Success)
- Security requirements (Security Officer)
- Operational concerns (SRE)

### 5. Better Outcomes
- Features that deliver customer value (PM)
- Technically sound implementations (Tech Lead)
- Secure and compliant (Security Officer)
- Operable in production (SRE)
- Sustainable pace (Eng Manager)

## Comparison with Skills

| Aspect | Skills (`.skills/`) | Subagents (`.subagents/`) |
|--------|---------------------|---------------------------|
| **Purpose** | Technical capabilities | Stakeholder perspectives |
| **Question** | "How?" | "Should? Why? For whom?" |
| **Focus** | Execution | Decision-making |
| **Examples** | OWASP checklist, PRD template | ROI evaluation, capacity planning |
| **When to Use** | Implementation phase | Planning/prioritization phase |
| **Progressive Disclosure** | Yes (metadata → details) | Yes (perspective → framework) |

## Success Metrics

### Quantitative
- ✅ 7 enterprise roles represented
- ✅ 100% role coverage (product, eng, security, ops)
- ✅ Each role has PERSPECTIVE.md + decision framework

### Qualitative
- ✅ Holistic decision-making (multiple perspectives)
- ✅ Clearer trade-offs (business vs. technical vs. user)
- ✅ Realistic constraints surfaced early
- ✅ Better stakeholder alignment

## References

- **Agent Skills**: [../.skills/README.md](../.skills/README.md)
- **ADR-020**: Agent Skills Migration (capabilities)
- **ADR-021**: Perspective-Based Subagents (this paradigm)
- **CLAUDE.md**: Integration of skills + subagents

## Future Enhancements

**Planned**:
- [ ] Role-specific metrics dashboards
- [ ] Decision matrix templates
- [ ] Cross-role collaboration workflows
- [ ] Perspective conflict resolution framework

**Not Planned**:
- Automatic role assignment (human judgment required)
- Role voting mechanisms (defer to decision authority)
- Dynamic role creation (7 roles cover enterprise needs)
