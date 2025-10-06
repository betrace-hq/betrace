# Standard Operating Procedures (SOPs)

This directory contains Standard Operating Procedures for the FLUO project to ensure consistent, reliable development and deployment practices.

## SOPs Index

1. **[Development Workflow](001-development-workflow.md)** - Code quality, testing, and commit requirements
2. **[Deployment Process](002-deployment-process.md)** - Safe deployment practices and rollback procedures
3. **[Security Protocols](003-security-protocols.md)** - Security requirements and incident response
4. **[Monitoring & Alerting](004-monitoring-alerting.md)** - Observability standards and alert handling
5. **[Infrastructure Changes](005-infrastructure-changes.md)** - Change management for infrastructure modifications

## Quick Reference

### Pre-Commit Checklist
- [ ] All tests pass (`nix run .#test-all`)
- [ ] All flake checks pass (`nix flake check`)
- [ ] Code follows project conventions
- [ ] Changes are documented if user-facing
- [ ] Security review completed for infrastructure changes

### Emergency Contacts
- **Infrastructure Issues**: See [SOP-004](004-monitoring-alerting.md) for escalation procedures
- **Security Incidents**: See [SOP-003](003-security-protocols.md) for immediate response steps
- **Deployment Failures**: See [SOP-002](002-deployment-process.md) for rollback procedures

### Critical Commands
```bash
# Emergency system health check
nix run .#status-all

# Emergency deployment rollback
nix run .#delete-all && git checkout [last-stable-commit] && nix run .#deploy-all

# Security incident isolation
kubectl scale deployment [affected-deployment] --replicas=0

# Infrastructure change validation
nix flake check && kubectl apply --dry-run=client -f [manifests]
```

## Compliance

These SOPs ensure compliance with:
- Architecture Decision Records (ADRs)
- Security best practices
- Reliability standards (99.9% uptime)
- Change management requirements