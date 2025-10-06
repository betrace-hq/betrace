# SOP-001: Development Workflow

## Purpose
Establish mandatory quality gates and development practices to ensure code reliability and maintainability.

## Scope
Applies to all code changes in the FLUO monorepo (BFF, Backend, Infrastructure).

## Pre-Commit Requirements

### MANDATORY: All Tests and Checks Must Pass

Before committing any code, the following MUST pass without errors:

```bash
# 1. Run all project tests
nix run .#test-all

# 2. Verify all flake checks pass
nix flake check

# 3. Ensure builds complete successfully
nix run .#build-all
```

**⚠️ CRITICAL: Code MUST NOT be committed if any of these commands fail.**

### Development Environment Setup

1. **Enter development environment:**
   ```bash
   nix develop
   # OR use direnv for automatic activation
   echo "use flake" > .envrc && direnv allow
   ```

2. **Verify environment is working:**
   ```bash
   nix run .#status-all
   ```

### Code Quality Standards

#### Backend (Java/Quarkus)
- **Testing**: Unit tests must cover all new business logic
- **Format**: Use Maven checkstyle (enforced in CI)
- **Dependencies**: Update `backend/lib/config.nix` for version changes
- **Build**: Must pass `./mvnw clean package` in backend directory

#### BFF (TypeScript/React)
- **Testing**: Unit tests with Vitest, E2E tests with Playwright
- **Format**: ESLint and Prettier (configured in project)
- **Dependencies**: Use exact versions in package.json
- **Build**: Must pass `npm run build` and `npm run test`

#### Infrastructure (Nix)
- **Testing**: All Kubernetes manifests must validate
- **Format**: Use `nixpkgs-fmt` for consistent formatting
- **Dependencies**: Lock versions in flake.lock
- **Build**: All component flakes must build without errors

### Supply Chain Security & Dependency Management ✅ IMPLEMENTED

#### Enterprise-Grade Dependency Locking
FLUO has successfully implemented comprehensive supply chain security through Nix flakes:

**🔒 Cryptographic Dependency Locking:**
- **BFF (Frontend)**: npm dependencies locked with SHA256 hashes in `bff/flake.lock`
- **Backend (Java)**: Maven dependencies locked with SHA256 hashes in `backend/flake.lock`
- **Infrastructure**: All deployment tools locked with SHA256 hashes in `infra/flake.lock`
- **Monorepo**: Complete dependency tree locked in main `flake.lock`

**🛡️ Supply Chain Protection Features:**
- **Immutable Dependencies**: Cannot be modified after locking
- **Cryptographic Verification**: All dependencies verified with SHA256 hashes
- **Complete Audit Trail**: Full dependency provenance through Nix store
- **Offline Builds**: No network required after initial dependency resolution
- **Reproducible Builds**: Identical builds across all environments

#### Dependency Update Process
```bash
# Update dependencies (regenerates all locks with new hashes)
nix flake update

# Verify dependency integrity and build system
nix flake check

# Build with locked dependencies (fully offline)
nix build

# Test with locked dependencies
nix run .#test-all

# Commit updated flake.lock files with audit trail
git add */flake.lock
git commit -m "Update dependencies: locked with SHA256 hashes"
```

#### Security Benefits
- **Cryptographic Verification**: All dependencies verified with SHA256 hashes
- **Complete Provenance**: Full audit trail through Nix store
- **Reproducible Builds**: Identical builds across all environments
- **Supply Chain Protection**: Eliminates dependency confusion and injection attacks

### Git Workflow

#### Branch Strategy
- **Main branch**: `main` (protected, requires PR)
- **Feature branches**: `feature/description` or `fix/description`
- **Hotfix branches**: `hotfix/critical-issue`

#### Commit Requirements
1. **Descriptive commit messages** following conventional commits:
   ```
   feat(bff): add user authentication with React Context
   fix(backend): resolve NATS connection timeout issue
   docs(adr): update ADR-006 with final state management decision
   ```

2. **Atomic commits**: One logical change per commit
3. **All checks pass**: See Pre-Commit Requirements above

#### Pull Request Process
1. **Create PR** with clear description of changes
2. **Link issues** that are resolved by the PR
3. **Request review** from at least one team member
4. **Ensure CI passes** - all automated checks must be green
5. **Merge only after approval** and successful CI

### Local Development Validation

Before pushing changes, run the full validation suite:

```bash
# Complete validation workflow
./scripts/validate-changes.sh

# Or manually run each step:
nix flake check                    # Nix expressions valid
nix run .#test-all                # All tests pass
nix run .#build-all               # All components build
kubectl apply --dry-run=client -f infra/k8s/  # K8s manifests valid
```

### Component-Specific Requirements

#### Backend Changes
- **Database migrations**: Must be backward compatible
- **API changes**: Update OpenAPI spec if applicable
- **NATS integration**: Test message flow end-to-end
- **Health checks**: Verify `/health` endpoint functionality

#### BFF Changes
- **State management**: Use React Context + useReducer (NOT Zustand)
- **Workers**: Background operations must not block UI
- **Routing**: Validate Tanstack Router configuration
- **Build**: Verify production build optimizations

#### Infrastructure Changes
- **Security review**: Required for any K8s RBAC or network changes
- **Deployment testing**: Validate in local Docker Desktop cluster
- **Rollback plan**: Document rollback procedure for changes
- **Monitoring**: Ensure metrics/alerts cover new infrastructure

## Emergency Procedures

### Failed Checks
If pre-commit checks fail:

1. **DO NOT COMMIT** - Fix issues first
2. **Investigate failure** using verbose output
3. **Fix root cause** - don't skip checks
4. **Re-run validation** to confirm fixes
5. **Only then commit** once all checks pass

### Critical Hotfixes
For production incidents requiring immediate fixes:

1. **Create hotfix branch** from main
2. **Minimal change** to resolve incident
3. **Still run tests** - abbreviated test suite acceptable
4. **Fast-track review** - single reviewer approval
5. **Deploy immediately** after merge
6. **Follow up** with full testing and documentation

## Compliance Verification

### Daily Checks
- All commits in main branch passed CI
- No emergency deployments bypassed SOP
- All PRs had appropriate review

### Weekly Review
- Review any SOP violations and root causes
- Update SOP if development practices have evolved
- Ensure team is following established procedures

## Related Documents
- [ADR-002: Nix Flakes as Build System Foundation](../ADRs/002-nix-flakes-build-system.md)
- [ADR-003: Monorepo Structure with Flake Composition](../ADRs/003-monorepo-flake-composition.md)
- [SOP-002: Deployment Process](002-deployment-process.md)