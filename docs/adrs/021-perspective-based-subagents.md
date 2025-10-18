# ADR-021: Perspective-Based Subagents

**Status:** Accepted
**Date:** 2025-10-18
**Deciders:** Architecture Team

## Context

ADR-020 successfully migrated FLUO from subagent-based delegation to Agent Skills for technical capabilities. However, skills alone provide "how" (technical execution) without "should/why/for whom" (strategic perspective).

**Gap Identified:**
- ✅ **Skills** answer: "How do we implement this?" (OWASP checklist, PRD template, test patterns)
- ❌ **Missing**: "Should we implement this? Why? For whom?" (customer value, team capacity, security risk)

**Example Problem:**
```
User: "Add dark mode to the UI"

With skills only:
→ implementation/ skill: "Here's how to add CSS variables for dark mode"
→ react-tanstack/ skill: "Use shadcn/ui dark mode support"
→ Implementation proceeds WITHOUT asking if this is the right priority

With perspective-based subagents:
→ product-manager: RICE score = 250 (LOW), no churn data, defer
→ engineering-manager: Opportunity cost (could optimize performance instead)
→ customer-success: Workaround exists (browser extensions)
→ Decision: DEFER to backlog, prioritize customer value features
```

## Decision

We will introduce **perspective-based subagents** that mirror enterprise team roles, complementing the capability-based skills system.

### Subagent Team Structure

**7 Enterprise Roles:**
1. **Product Manager** - Customer value, market fit, prioritization
2. **Engineering Manager** - Team velocity, technical debt, capacity
3. **Tech Lead** - System design, scalability, architecture
4. **Security Officer** - Risk management, compliance, threats
5. **SRE** - Reliability, observability, production readiness
6. **Business Analyst** - ROI, stakeholder alignment, requirements
7. **Customer Success** - User experience, adoption, support

### Distinction: Capabilities vs. Perspectives

| Aspect | Skills (Capabilities) | Subagents (Perspectives) |
|--------|----------------------|--------------------------|
| **Question** | How? | Should? Why? For whom? |
| **Focus** | Technical execution | Strategic decision-making |
| **Examples** | OWASP checklist, test patterns | ROI evaluation, capacity planning |
| **When** | Implementation phase | Planning/prioritization phase |
| **Output** | Technical guidance | Go/no-go decision with rationale |

### Workflow Integration

```
1. Subagent (Perspective): Evaluate strategic fit
   ↓
2. Skills (Capability): Provide technical guidance
   ↓
3. Subagent (Perspective): Validate approach
   ↓
4. Implementation: Execute with skills
```

**Example: AI Agent Monitoring**
```
User: "Implement AI agent monitoring"

product-manager (perspective):
  ✅ High RICE score (16,000)
  ✅ Validated by International AI Safety Report
  → Decision: HIGH PRIORITY

product/ skill (capability):
  → Load PRD template patterns
  → Generate PRD structure

tech-lead (perspective):
  ✅ Fits pure application framework
  ⚠️ New dependency (embedding library)
  → Decision: APPROVE with caveat

architecture/ skill (capability):
  → Validate against ADR-011
  → Pure application patterns

engineering-manager (perspective):
  ✅ Team has bandwidth (21 points / 40 total)
  ✅ Maintains 70/30 feature/debt ratio
  → Decision: CAPACITY AVAILABLE

implementation/ skill (capability):
  → REST endpoint patterns
  → Service layer design
  → Execute implementation

security-officer (perspective):
  ⚠️ Need threat model for agent monitoring
  → Decision: APPROVE with security review

security/ skill (capability):
  → OWASP checklist
  → Threat modeling framework

sre (perspective):
  ⚠️ Performance impact of embeddings?
  → Decision: APPROVE with monitoring

quality/ skill (capability):
  → Test coverage validation
  → Failure scenario testing
```

## Architecture Changes

### Directory Structure

```
.subagents/
├── README.md                          # Team overview
├── product-manager/
│   ├── PERSPECTIVE.md                 # Role definition
│   └── prioritization-framework.md   # RICE, MoSCoW
├── engineering-manager/
│   └── PERSPECTIVE.md
├── tech-lead/
│   └── PERSPECTIVE.md
├── security-officer/
│   └── PERSPECTIVE.md
├── sre/
│   └── PERSPECTIVE.md
├── business-analyst/
│   └── PERSPECTIVE.md
└── customer-success/
    └── PERSPECTIVE.md
```

### PERSPECTIVE.md Format

```yaml
---
role: [Role Name]
focus: [Key areas of concern]
key_question: [Primary question this role asks]
---

# [Role] Perspective

## Role Definition
[What this role represents in enterprise team]

## Core Responsibilities
[What they're accountable for]

## Decision Framework
[How they evaluate requests]

## Integration with Skills
[Which capabilities they leverage]
```

## Benefits

### 1. Holistic Decision-Making
**Before (Skills Only)**:
```
User: "Add feature X"
→ Implementation skill: "Here's how"
→ Builds feature that doesn't solve customer problem
```

**After (Perspectives + Skills)**:
```
User: "Add feature X"
→ product-manager: "Does this solve customer problem? RICE score?"
→ engineering-manager: "Do we have capacity? Technical debt impact?"
→ tech-lead: "Right technical approach? Will it scale?"
→ Decision: Build / Defer / Redesign
→ If approved: Skills provide "how"
```

### 2. Clearer Trade-Offs
- Business value vs. technical feasibility
- Customer needs vs. team capacity
- Short-term delivery vs. long-term sustainability
- Security requirements vs. time-to-market

### 3. Cross-Functional Alignment
- All stakeholder perspectives considered early
- Conflicts surfaced before implementation
- Realistic constraints (capacity, users, risk)

### 4. Better Prioritization
- **Product Manager**: Customer value, market fit
- **Business Analyst**: ROI, stakeholder alignment
- **Engineering Manager**: Team capacity, technical debt
- **Security Officer**: Risk assessment
- **SRE**: Operational impact

### 5. Realistic Planning
- Capacity constraints identified upfront
- User adoption barriers surfaced
- Security requirements validated
- Operational concerns addressed

## Decision Authority

### Veto Power
- **Security Officer**: Security/compliance violations (BLOCK immediately)
- **Tech Lead**: Architecture violations (ADR-011 non-compliance)
- **Product Manager**: Customer value misalignment (strategic veto)

### Consensus Required
- **Feature Prioritization**: PM + Eng Manager + BA
- **Technical Design**: Tech Lead + SRE + Eng Manager
- **Production Deployment**: SRE + Security Officer + Tech Lead

### Advisory
- **Customer Success**: User experience feedback (advisory, not blocking)
- **Business Analyst**: ROI validation (advisory, not blocking)

## Consequences

### Positive
- **Better Decisions**: Multiple perspectives surface trade-offs
- **Reduced Waste**: Defer low-value features before implementation
- **Realistic Planning**: Capacity and constraints considered early
- **Stakeholder Alignment**: All viewpoints represented
- **Quality Outcomes**: Features that deliver customer value, technically sound, secure, operable

### Negative
- **Initial Overhead**: Must consult perspectives before implementation
- **Potential Conflicts**: Perspectives may disagree (requires resolution)
- **Learning Curve**: Team must understand role boundaries

### Mitigation Strategies
- **Decision Authority**: Clear veto/consensus/advisory roles
- **Streamlined Process**: Lightweight perspective consultation (not heavyweight governance)
- **Documentation**: Examples in `.subagents/README.md`
- **Iteration**: Refine based on usage patterns

## Alternatives Considered

### 1. Skills-Only Approach
**Rejected**: Provides "how" without "should/why/for whom"

**Tradeoffs**:
- ✅ Simpler (no perspective layer)
- ❌ No strategic decision-making
- ❌ Prioritization happens outside framework
- ❌ Waste due to building wrong features

### 2. Unified Skills + Perspectives
**Rejected**: Mixes technical and strategic concerns

**Tradeoffs**:
- ✅ Single system to learn
- ❌ Confuses "how" with "should"
- ❌ Skills become bloated with decision frameworks
- ❌ Violates separation of concerns

### 3. Ad-Hoc Perspective Consultation
**Rejected**: Inconsistent application

**Tradeoffs**:
- ✅ Flexible (use when needed)
- ❌ Easy to skip perspectives
- ❌ No standard process
- ❌ Tribal knowledge (not documented)

## Implementation Status

✅ **Completed (2025-10-18)**:
- `.subagents/` directory structure created
- 7 enterprise roles implemented with PERSPECTIVE.md
- `CLAUDE.md` updated to reference subagents
- ADR-021 documenting rationale

**Role Implementation Summary**:
1. ✅ `product-manager/` - RICE scoring, MoSCoW prioritization
2. ✅ `engineering-manager/` - 70/30 rule, capacity planning
3. ✅ `tech-lead/` - SOLID principles, architecture compliance
4. ✅ `security-officer/` - Risk matrix, OWASP compliance
5. ✅ `sre/` - Production readiness, SLO targets
6. ✅ `business-analyst/` - ROI calculation, stakeholder analysis
7. ✅ `customer-success/` - User impact assessment, adoption planning

## Success Metrics

**Quantitative**:
- ✅ 7 enterprise roles created
- ✅ 100% role coverage (product, eng, security, ops)
- ✅ Each role has PERSPECTIVE.md + decision framework

**Qualitative**:
- ✅ Holistic decision-making (multiple perspectives)
- ✅ Clearer trade-offs surfaced
- ✅ Realistic constraints identified early
- ✅ Better stakeholder alignment

## Example Scenarios

### Scenario 1: Feature Request

**Request**: "Add AI agent monitoring"

**product-manager**:
- RICE score: 16,000 (HIGH)
- Customer value: Solves critical AI safety gap
- **Decision**: ✅ PRIORITIZE

**engineering-manager**:
- Effort: 21 points (52% of sprint)
- Tech debt: Minimal impact
- **Decision**: ✅ CAPACITY AVAILABLE

**tech-lead**:
- Architecture: Fits ADR-011
- Design: Reuses DSL rule engine
- **Decision**: ✅ TECHNICALLY SOUND

**security-officer**:
- Risk: Medium (embedding accuracy)
- Compliance: No new PII concerns
- **Decision**: ✅ APPROVE with threat model

**Outcome**: ✅ APPROVED for next sprint

### Scenario 2: Technical Debt

**Request**: "Refactor rule engine (34 points, full sprint)"

**engineering-manager**:
- Violates 70/30 rule (blocks all features)
- **Recommendation**: Phase into 3 sprints

**tech-lead**:
- Phase 1 (13pts): Caching (biggest impact)
- Phase 2 (8pts): Parallelization
- Phase 3 (13pts): Refactoring
- **Decision**: ✅ PHASED APPROACH

**sre**:
- Performance critical (p99 850ms → 500ms)
- Regression risk if not tested
- **Decision**: ✅ APPROVE with comprehensive tests

**Outcome**: ✅ Phase 1 this sprint, Phase 2 next sprint

### Scenario 3: Security Veto

**Request**: "Skip PII redaction for performance"

**security-officer**:
- HIPAA violation (CRITICAL)
- Data breach liability (HIGH RISK)
- **Decision**: ❌ VETO (security violation)

**product-manager**:
- Customer trust impact
- Regulatory non-compliance
- **Decision**: ❌ SUPPORT VETO

**Outcome**: ❌ REJECTED immediately (security veto)

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

## References

- **ADR-020**: Agent Skills Migration (capabilities)
- **`.skills/` Directory**: Technical capabilities
- **`.subagents/` Directory**: Stakeholder perspectives
- **CLAUDE.md**: Integration of skills + subagents
- **Enterprise Team Roles**: Stack Overflow 2025 Developer Survey

## Migration from Skills-Only

**Before (Skills Only)**:
```
User request → Load skill → Execute technical guidance
```

**After (Perspectives + Skills)**:
```
User request → Consult subagent perspectives → Load skills → Execute
```

**Example Migration**:
- **Before**: "Implement feature X" → `implementation/` skill provides patterns
- **After**: "Implement feature X" → `product-manager` evaluates → if approved → `implementation/` skill provides patterns

## Notes

**Why 7 Roles?**
- Covers all enterprise stakeholder perspectives
- Product (PM, BA, CS), Engineering (EM, TL, SRE), Security (SO)
- Avoids over-fragmentation (too many roles)

**Why Not More Roles?**
- 7 roles provide comprehensive coverage
- Additional roles risk decision paralysis
- Can expand if gaps identified

**Perspective Maintenance**:
- Perspectives version-controlled with codebase
- Update perspectives alongside ADRs
- Reflect FLUO's strategic priorities (AI safety, compliance, behavioral assurance)
