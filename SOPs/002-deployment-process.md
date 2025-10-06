# SOP-002: Deployment Process

## Purpose
Establish safe, reliable deployment practices with proper rollback procedures and change validation.

## Scope
Applies to all deployments in FLUO environments (local, staging, production).

## Pre-Deployment Checklist

### MANDATORY: Pre-deployment Validation

Before any deployment, the following MUST be completed:

```bash
# 1. Ensure all tests pass
nix run .#test-all

# 2. Verify flake checks pass
nix flake check

# 3. Build all components successfully
nix run .#build-all

# 4. Validate Kubernetes manifests
kubectl apply --dry-run=client -f infra/k8s/manifests/

# 5. Check infrastructure status
nix run .#status-all
```

**⚠️ CRITICAL: Deployments MUST NOT proceed if any validation step fails.**

## Deployment Environments

### Local Development
- **Purpose**: Development and initial testing
- **Cluster**: Docker Desktop Kubernetes
- **Command**: `nix run .#deploy-local`
- **Validation**: Automated health checks
- **Rollback**: `nix run .#delete-all` and redeploy

### Staging (Future)
- **Purpose**: Integration testing and validation
- **Cluster**: Cloud-hosted Kubernetes cluster
- **Command**: `nix run .#deploy-staging`
- **Validation**: Comprehensive integration tests
- **Rollback**: Automated via deployment versioning

### Production (Future)
- **Purpose**: Live user traffic
- **Cluster**: Production Kubernetes cluster
- **Command**: `nix run .#deploy-production`
- **Validation**: Blue-green or canary deployment
- **Rollback**: Immediate rollback capability required

## Deployment Procedures

### Standard Deployment Workflow

1. **Pre-deployment validation** (see checklist above)
2. **Deploy infrastructure components**:
   ```bash
   # Deploy in dependency order
   nix run ./infra/components/nats#deploy        # Message broker first
   nix run ./infra/components/prometheus#deploy  # Monitoring
   nix run ./infra/components/grafana#deploy     # Observability
   nix run ./infra/components/bff#deploy         # API layer
   nix run ./infra/components/workers#deploy     # Background processing
   ```
3. **Verify deployment health**:
   ```bash
   nix run .#status-all
   ```
4. **Run smoke tests**:
   ```bash
   # Test BFF API endpoint
   curl -H "Host: fluo-api.localhost" http://localhost/health

   # Test job submission and processing
   curl -H "Host: fluo-api.localhost" -X POST http://localhost/api/jobs \
     -H "Content-Type: application/json" \
     -d '{"type": "test", "data": {"validation": true}}'
   ```

### Fast Deployment (One Command)
```bash
# Deploy all components at once
nix run .#deploy-all
```

### Component-Specific Deployment
```bash
# Deploy individual components
nix run ./infra/components/[component]#deploy
```

## Health Verification

### Mandatory Health Checks

After deployment, verify the following endpoints:

1. **BFF Health**: `GET /health` → HTTP 200
2. **NATS Connectivity**: Port-forward and check `/varz`
3. **Worker Processing**: Submit test job and verify completion
4. **Grafana Dashboard**: Access monitoring interface
5. **Prometheus Metrics**: Verify metric collection

### Automated Health Verification
```bash
# Comprehensive health check script
./scripts/verify-deployment-health.sh
```

## Rollback Procedures

### Emergency Rollback
For critical production issues requiring immediate rollback:

```bash
# 1. Immediate rollback command
nix run .#rollback-to-previous

# 2. If rollback command unavailable, delete and redeploy previous version
nix run .#delete-all
git checkout [previous-stable-commit]
nix run .#deploy-all
```

### Planned Rollback
For planned rollbacks during maintenance windows:

```bash
# 1. Graceful shutdown
nix run .#graceful-shutdown

# 2. Deploy previous version
git checkout [target-commit]
nix run .#deploy-all

# 3. Verify health
nix run .#status-all
```

### Component-Specific Rollback
```bash
# Rollback individual component
nix run ./infra/components/[component]#rollback
```

## Deployment Monitoring

### Real-time Monitoring
During deployments, monitor:
- **Kubernetes pod status**: `kubectl get pods --all-namespaces`
- **Application logs**: `nix run .#logs-all`
- **Resource utilization**: Grafana dashboards
- **Error rates**: Prometheus alerts

### Post-Deployment Validation
After deployment completion:
- Monitor error rates for 30 minutes
- Verify all expected pods are running
- Check service endpoints respond correctly
- Validate message queue processing

## Change Management

### Deployment Windows
- **Local**: Anytime during development
- **Staging**: During business hours for collaboration
- **Production**: Planned maintenance windows only

### Communication Requirements
- **Local**: No communication required
- **Staging**: Slack notification to team
- **Production**:
  - 48-hour advance notice for planned deployments
  - Immediate notification for emergency deployments
  - Post-deployment status update

### Documentation Requirements
- Document all changes in deployment notes
- Update ADRs for architectural changes
- Record rollback procedures if custom steps required

## Failure Scenarios

### Common Failure Patterns
1. **Container startup failures**: Check resource limits and image availability
2. **Service connectivity issues**: Verify network policies and DNS resolution
3. **Database migration failures**: Always backup before schema changes
4. **Configuration errors**: Validate ConfigMaps and Secrets

### Escalation Procedures
1. **Immediate**: Attempt automatic rollback
2. **5 minutes**: Manual rollback if automatic fails
3. **15 minutes**: Escalate to senior team member
4. **30 minutes**: Escalate to engineering leadership

## Security Considerations

### Pre-deployment Security Checks
- Scan container images for vulnerabilities
- Validate RBAC configurations
- Verify secret management procedures
- Check network policy restrictions

### Post-deployment Security Validation
- Verify no sensitive information in logs
- Confirm proper access controls
- Test authentication and authorization
- Validate encrypted communications

## Compliance and Auditing

### Deployment Tracking
- All deployments logged with commit SHA and timestamp
- Change approvals documented
- Rollback events recorded with justification

### Regular Reviews
- Weekly deployment process review
- Monthly rollback procedure testing
- Quarterly security validation of deployment pipeline

## Related Documents
- [SOP-001: Development Workflow](001-development-workflow.md)
- [SOP-003: Security Protocols](003-security-protocols.md)
- [SOP-004: Monitoring & Alerting](004-monitoring-alerting.md)
- [ADR-001: Service-Owned Deployment Modules](../ADRs/001-service-owned-deployment-modules.md)
- [ADR-004: Kubernetes-Native Infrastructure Architecture](../ADRs/004-kubernetes-native-infrastructure.md)