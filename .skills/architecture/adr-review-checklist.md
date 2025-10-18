# Architecture Review Checklist

Use this checklist when reviewing code changes for architectural compliance.

## Pure Application Framework Compliance

### Infrastructure Separation
- [ ] No Docker/container build logic in application code
- [ ] No Kubernetes manifests or deployment configs
- [ ] No cloud provider SDKs (AWS, GCP, Azure) unless justified
- [ ] No infrastructure-as-code patterns (Terraform, Pulumi)
- [ ] No hardcoded deployment assumptions

### Package Export Pattern
- [ ] Applications export via `packages.${system}.app`
- [ ] Development servers via `apps.${system}.dev`
- [ ] Production servers via `apps.${system}.serve`
- [ ] Build artifacts are deployment-agnostic

### Local Development
- [ ] Works with `nix run .#dev` without external dependencies
- [ ] Hot reload functional for modified code
- [ ] No requirement for Docker daemon or Kubernetes cluster
- [ ] Observability stack accessible locally (Grafana, etc.)

## Code Quality Standards

### Test Coverage
- [ ] Overall instruction coverage ≥ 90%
- [ ] Overall branch coverage ≥ 80%
- [ ] Critical components ≥ 95% instruction coverage
- [ ] New code has corresponding tests

### Code Organization
- [ ] Single responsibility principle followed
- [ ] Clear separation of concerns
- [ ] Appropriate abstraction levels
- [ ] No circular dependencies
- [ ] Proper error handling

### Git Workflow
- [ ] Conventional commit format (`feat:`, `fix:`, `docs:`, etc.)
- [ ] Atomic commits (one logical change per commit)
- [ ] Descriptive commit messages (what and why)
- [ ] No merge conflicts

## Dependency Management

### Nix Flake Updates
- [ ] New dependencies added to `flake.nix` inputs
- [ ] Dependency hash locked (`flake.lock` updated)
- [ ] Justification for new dependencies documented
- [ ] No transitive dependency conflicts

### Supply Chain Security
- [ ] All dependencies cryptographically verified (Nix hashes)
- [ ] No unverified binary downloads
- [ ] License compatibility checked

## Security Considerations

### Security Best Practices
- [ ] No hardcoded secrets or credentials
- [ ] PII redaction enforced where applicable (`@Redact` annotations)
- [ ] Input validation for user-supplied data
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities (frontend)

### Compliance Annotations
- [ ] `@SOC2` / `@HIPAA` annotations present where required
- [ ] Compliance spans emit appropriate evidence
- [ ] No PII leakage in spans/logs

## Documentation

### Code Documentation
- [ ] Public APIs have docstrings/JavaDoc
- [ ] Complex logic has explanatory comments
- [ ] README updated if user-facing changes

### ADR Updates
- [ ] New architectural decisions documented as ADRs
- [ ] Existing ADRs updated if superseded
- [ ] ADR index (`docs/adrs/README.md`) updated

## Anti-Pattern Detection

### Common Issues
- [ ] No "quick fix" deployment hacks (violates ADR-011)
- [ ] No test coverage exemptions without justification
- [ ] No commented-out code blocks
- [ ] No `TODO` comments without tracking issues
- [ ] No duplicated logic (DRY principle)

### Performance
- [ ] No obvious performance regressions
- [ ] Database queries optimized (no N+1 queries)
- [ ] No unbounded loops or recursion
- [ ] Resource cleanup (connections, file handles)

## Final Validation

### Pre-Merge
- [ ] All CI checks passing
- [ ] Code review approved by at least one team member
- [ ] Branch up-to-date with main
- [ ] No breaking changes without migration plan

### Post-Merge
- [ ] Monitor for issues in development environment
- [ ] Verify build artifacts still deployment-agnostic
- [ ] Ensure observability stack still functional
