---
name: Product Analyst
description: Transforms vague feature requests into detailed PRDs with acceptance criteria, scope boundaries, and implementation guidance
---

# Product Analyst Skill

## Purpose

This skill provides expertise in transforming ambiguous requirements into clear, actionable Product Requirement Documents (PRDs).

## When to Use This Skill

Load this skill when:
- User provides vague feature request ("we need better search")
- Requirements are ambiguous ("improve performance")
- Workflow feedback is unclear ("the flow is confusing")
- Feature scope needs definition
- Acceptance criteria need clarification
- Implementation approach needs validation

## PRD Structure

### Minimal PRD Template
```markdown
# PRD-XXX: [Feature Name]

## Problem Statement
[What problem are we solving? Why does this matter?]

## Goals
1. [Measurable goal 1]
2. [Measurable goal 2]

## Non-Goals
1. [What we're NOT doing in this phase]

## User Stories
- As a [role], I want [capability] so that [benefit]

## Acceptance Criteria
- [ ] Given [context], when [action], then [outcome]

## Technical Approach
[High-level implementation plan]

## Open Questions
- [ ] [Unresolved decision 1]
```

## Clarifying Questions Framework

### Ambiguous Request: "We need better search"
**Clarifying Questions**:
1. What are users searching for? (traces, rules, signals?)
2. What makes current search insufficient? (speed, relevance, features?)
3. Who are the primary users? (SREs, developers, compliance?)
4. What does "better" mean? (faster, more accurate, more filters?)
5. What are success metrics? (query time, result relevance, usage rate?)

### Ambiguous Request: "Improve performance"
**Clarifying Questions**:
1. Which performance? (latency, throughput, resource usage?)
2. What is current baseline? (p50/p99 latency, requests/sec?)
3. What is target? (specific SLA or percentage improvement?)
4. Which component? (frontend, backend, database, rule engine?)
5. What triggers the issue? (large datasets, concurrent users, complex rules?)

### Ambiguous Request: "The workflow is confusing"
**Clarifying Questions**:
1. Which workflow? (rule creation, trace analysis, signal investigation?)
2. Who is confused? (new users, experienced users, specific role?)
3. What is the expected flow? (describe ideal user journey)
4. Where do users get stuck? (specific UI element, step in process?)
5. What are alternatives? (how do competitors handle this?)

## Transforming Vague Requests

### Example 1: "Add AI agent monitoring"
**Vague Request**:
> "We need to monitor AI agents for safety"

**Clarified PRD**:
```markdown
# PRD-042: AI Agent Goal Deviation Detection

## Problem Statement
AI agents can deviate from assigned goals during multi-step execution,
potentially causing unintended actions. No production monitoring exists
to detect this behavior.

## Goals
1. Detect when agent actions diverge from original goal
2. Alert when deviation exceeds threshold
3. Provide investigation trail for post-incident analysis

## User Stories
- As an SRE, I want to detect goal deviation so I can intervene before harm
- As a compliance officer, I want audit trail of agent behavior

## Acceptance Criteria
- [ ] Given agent execution trace, when goal deviation > 0.3, then signal emitted
- [ ] Given deviation signal, when viewed in UI, then shows original goal + actual actions
- [ ] Given 1000 agent traces, when analyzed, then p99 latency < 100ms

## Technical Approach
- DSL pattern: `trace.has(agent.plan) and goal_deviation(plan, actions) > 0.3`
- Goal deviation calculated via embedding similarity
- Spans: `agent.plan.created`, `agent.action.executed`

## Non-Goals
- Automatic agent intervention (Phase 2)
- Multi-agent coordination tracking (Phase 3)
```

### Example 2: "Make it faster"
**Vague Request**:
> "The system is too slow, make it faster"

**Clarified PRD**:
```markdown
# PRD-043: Optimize Rule Evaluation Latency

## Problem Statement
Rule evaluation p99 latency is 850ms for tenants with >50 rules,
exceeding SLA of <500ms. Causes user-visible delays in violation detection.

## Goals
1. Reduce rule evaluation p99 latency from 850ms to <500ms
2. Support 100+ rules per tenant without degradation
3. Maintain 90%+ test coverage

## Acceptance Criteria
- [ ] Given tenant with 50 rules, when trace evaluated, then p99 < 500ms
- [ ] Given tenant with 100 rules, when trace evaluated, then p99 < 750ms
- [ ] Given optimization changes, when tests run, then coverage ≥ 90%

## Technical Approach
1. Add rule evaluation caching (LRU cache, per-tenant)
2. Parallelize independent rule evaluations (ExecutorService)
3. Index frequently-accessed span attributes

## Baseline Metrics
- Current p50: 320ms
- Current p95: 720ms
- Current p99: 850ms
- Tenant rule count distribution: median=25, p95=60, p99=120

## Non-Goals
- Query optimization (separate PRD)
- Frontend performance (separate PRD)
```

## Scope Boundaries

### Feature Scoping Questions
1. **MVP vs. Future**: What is minimal viable feature?
2. **Dependencies**: What must exist first?
3. **Integrations**: Which systems are affected?
4. **User Impact**: Who benefits? Who is disrupted?
5. **Rollback**: Can we reverse this change?

### Phase Breakdown
```markdown
## Phase 1: Core Functionality (Week 1-2)
- [ ] Basic feature implementation
- [ ] Unit tests (90%+ coverage)
- [ ] Integration tests

## Phase 2: Polish (Week 3)
- [ ] UI refinement
- [ ] Error handling edge cases
- [ ] Performance optimization

## Phase 3: Advanced (Future)
- [ ] Advanced features
- [ ] Multi-tenant customization
```

## Success Metrics

### Quantitative Metrics
- **Performance**: Latency (p50/p95/p99), throughput (req/sec)
- **Usage**: Active users, feature adoption rate, session duration
- **Quality**: Error rate, bug count, test coverage
- **Business**: Revenue impact, cost reduction, time saved

### Qualitative Metrics
- **User Satisfaction**: NPS score, user feedback, support tickets
- **Usability**: Task completion rate, time-to-complete, error rate
- **Adoption**: Onboarding success, feature discovery

## Example PRDs from FLUO

### PRD-003: Compliance Span Cryptographic Signing
**Problem**: Compliance spans can be tampered with, violating SOC2 integrity requirements

**Solution**: HMAC-SHA256 signatures on all compliance spans

**Success Metrics**:
- 100% of compliance spans signed
- Signature verification < 5ms
- Zero tampered spans detected in production

### PRD-004: Rule Engine Sandboxing
**Problem**: DSL rules can access service layer, violating security model

**Solution**: Bytecode-level sandbox using Java Instrumentation

**Success Metrics**:
- 100% of service layer calls blocked
- Rule execution latency increase < 10%
- Security expert rating ≥ 9/10

## Progressive Disclosure

This SKILL.md provides high-level guidance. For detailed PRD context:
1. Review `prd-template.md` for complete template with examples
2. Check `requirements-gathering.md` for stakeholder interview techniques
3. Consult `scope-definition.md` for feature scoping frameworks
4. See `acceptance-criteria-guide.md` for writing testable criteria

## Common PRD Anti-Patterns

1. **Overly Broad Scope**: "Improve all system performance" (too vague)
2. **Missing Success Metrics**: No way to measure success
3. **No Non-Goals**: Scope creep inevitable
4. **Implementation Details**: PRD is "what", not "how" (too deep)
5. **Missing User Stories**: No user perspective
6. **Untestable Criteria**: "Make it faster" (not measurable)
7. **No Alternatives**: Only one solution considered
8. **Missing Dependencies**: Assumes infrastructure exists

## Summary

**Product Analysis Principles**:
- Ask clarifying questions for vague requests
- Define measurable success criteria
- Establish clear scope boundaries (goals + non-goals)
- Write from user perspective (user stories)
- Include baseline metrics and targets
- Phase complex features (MVP → polish → advanced)
- Consider alternatives
- Validate technical feasibility
