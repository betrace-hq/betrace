# ADR-015: Development Workflow and Quality Standards

**Status:** Accepted
**Date:** 2025-10-10
**Deciders:** Architecture Team

## Context

FLUO is a Pure Application Framework (ADR-011) requiring consistent development practices and quality standards. Previous SOPs contained valuable workflow patterns but were heavily coupled to obsolete infrastructure assumptions.

This ADR consolidates valid development practices from legacy SOPs into architectural guidance aligned with the current pure application framework.

## Decision

We establish the following development workflow and quality standards for FLUO:

### 1. Git Workflow

#### Branch Strategy
- **Main branch**: `main` (protected, requires PR)
- **Feature branches**: `feature/description` or `fix/description`
- **Hotfix branches**: `hotfix/critical-issue`

#### Commit Requirements
Use conventional commits format:
```
feat(bff): add user authentication with React Context
fix(backend): resolve connection timeout issue
docs(adr): update ADR-015 with quality standards
```

- **Atomic commits**: One logical change per commit
- **Descriptive messages**: Clear description of what changed and why

### 2. Code Quality Standards

#### Test Coverage Requirements
- **Overall Instruction Coverage**: 90% minimum
- **Overall Branch Coverage**: 80% minimum
- **Critical Components**: 95% instruction coverage

#### Testing Stack
- **Backend**: JUnit 5, AssertJ for assertions, Mockito for mocking (minimal usage)
- **Frontend**: Vitest for unit tests, Playwright for E2E tests

#### Code Review Checklist
- [ ] All new code has corresponding tests
- [ ] Test coverage meets thresholds
- [ ] Code follows single responsibility principle
- [ ] Error handling is comprehensive
- [ ] No security vulnerabilities introduced
- [ ] Documentation updated if user-facing

### 3. Development Commands

#### Core Development Workflow
```bash
# Start development environment
nix run .#dev

# Start individual applications
nix run .#frontend    # React app on http://localhost:3000
nix run .#backend     # Quarkus API on http://localhost:8080

# Build applications
nix build .#all

# Run tests
nix run .#test

# Production preview
nix run .#serve
```

#### Quality Validation
```bash
# Verify Nix expressions
nix flake check

# Run test suite
nix run .#test

# Build all components
nix build .#all
```

### 4. Pre-Commit Requirements

Before committing any code:
1. All tests pass locally
2. Code follows project conventions
3. No breaking changes without discussion
4. Commit message follows conventional format

### 5. Pull Request Process

1. **Create PR** with clear description of changes
2. **Link issues** that are resolved by the PR
3. **Request review** from at least one team member
4. **Ensure checks pass** - all automated validation must succeed
5. **Merge only after approval** and successful CI

## Alternatives Considered

### 1. Keep SOPs as Separate Documents
**Rejected**: SOPs contained infrastructure assumptions conflicting with ADR-011

### 2. No Formal Standards
**Rejected**: Quality and consistency require documented standards

### 3. Tool-Enforced Standards Only
**Rejected**: Human guidance needed beyond automated enforcement

## Consequences

### Positive
- **Consistent Practices**: Clear guidelines for all developers
- **Quality Assurance**: Defined thresholds prevent quality regression
- **Git History**: Conventional commits enable automated changelog generation
- **Code Review**: Checklist ensures thorough review process

### Negative
- **Initial Learning**: New contributors must learn conventions
- **Enforcement Overhead**: Requires discipline to maintain standards

### Mitigation Strategies
- Document standards in CLAUDE.md for AI assistance
- Use pre-commit hooks for automated validation
- Regular team review of practices

## Implementation Status

✅ **Completed:**
- Git workflow standards defined
- Quality thresholds established
- Development commands documented
- Review checklist created

## References

- [ADR-011: Pure Application Framework](./011-pure-application-framework.md) - Current architecture
- [ADR-002: Nix Flakes as Build System](./002-nix-flakes-build-system.md) - Build system foundation
- [ADR-003: Monorepo Structure with Flake Composition](./003-monorepo-flake-composition.md) - Project structure
- [CLAUDE.md](../../CLAUDE.md) - Development guidance for AI assistance
