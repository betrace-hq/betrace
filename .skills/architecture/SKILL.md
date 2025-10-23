---
name: Architecture Guardian
description: Validates architectural decisions against ADRs, ensures pure application framework patterns, and reviews code for architectural compliance
---

# Architecture Guardian Skill

## Purpose

This skill provides expertise in BeTrace's architectural principles and validates that code changes align with established Architecture Decision Records (ADRs).

## When to Use This Skill

Load this skill when:
- Reviewing code changes that may impact architectural patterns
- Evaluating new dependencies or framework choices
- Assessing whether changes align with pure application framework principles
- Creating new ADRs or updating existing ones
- Refactoring code to match architectural standards

## Core Architectural Principles

### Pure Application Framework (ADR-011)
BeTrace is **deployment-agnostic**:
- ✅ Applications export packages, not infrastructure
- ✅ Local development orchestration via Nix
- ✅ External consumers handle deployment
- ❌ No Docker/Kubernetes in core codebase
- ❌ No cloud provider dependencies
- ❌ No deployment scripts in application code

### Development Workflow (ADR-015)
- 90% instruction coverage, 80% branch coverage minimum
- Conventional commits format
- Atomic commits with clear messages
- Code review required before merge

## Review Checklist

### Architecture Compliance
- [ ] Change aligns with pure application framework (no infrastructure code)
- [ ] Dependencies justify their inclusion (Nix flake updated)
- [ ] No mixing of build and deployment concerns
- [ ] Local development experience preserved (works with `nix run .#dev`)
- [ ] No hardcoded deployment assumptions

### Code Organization
- [ ] Single responsibility principle followed
- [ ] Clear separation of concerns
- [ ] Appropriate abstraction levels
- [ ] No circular dependencies

### Quality Standards
- [ ] Test coverage meets thresholds (90%/80%)
- [ ] Error handling is comprehensive
- [ ] Security best practices followed
- [ ] Documentation updated if needed

## Key ADRs

See the `adrs/` subdirectory for detailed architectural decisions:
- **ADR-011**: Pure Application Framework (PRIMARY)
- **ADR-015**: Development Workflow and Quality Standards
- **ADR-002**: Nix Flakes as Build System
- **ADR-003**: Monorepo Structure
- **ADR-006**: Tanstack Frontend Architecture

## Common Anti-Patterns to Flag

1. **Infrastructure Creep**: Adding deployment logic to application code
2. **Deployment Coupling**: Hardcoding Kubernetes/Docker assumptions
3. **Quality Regression**: Lowering test coverage thresholds
4. **Scope Expansion**: Adding features outside core behavioral assurance
5. **Dependency Bloat**: Adding unnecessary dependencies

## Progressive Disclosure

This SKILL.md provides high-level guidance. For detailed architectural context:
1. Review relevant ADR files in `adrs/` subdirectory
2. Check `pure-application-patterns.md` for implementation examples
3. Consult `adr-review-checklist.md` for thorough review process
