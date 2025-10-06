# SOP-005: Infrastructure Changes

## Purpose
Establish safe change management procedures for infrastructure modifications to ensure system stability and minimize risk.

## Scope
Applies to all infrastructure changes including Kubernetes manifests, Nix configurations, networking, storage, and security policies.

## Change Classification

### Change Types and Requirements

#### 1. Low Risk Changes
**Examples**: Documentation updates, non-functional configuration changes, monitoring adjustments
- **Approval**: Self-approved by engineer
- **Testing**: Local validation required
- **Rollback**: Simple revert possible

#### 2. Medium Risk Changes
**Examples**: Resource limit adjustments, new monitoring alerts, dependency updates
- **Approval**: Senior engineer review required
- **Testing**: Staging environment validation
- **Rollback**: Automated rollback available

#### 3. High Risk Changes
**Examples**: Network policy changes, RBAC modifications, storage changes
- **Approval**: Engineering manager + security review
- **Testing**: Comprehensive staging validation
- **Rollback**: Tested rollback procedure required

#### 4. Critical Changes
**Examples**: Cluster upgrades, major architecture changes, security protocol updates
- **Approval**: Engineering director + security team + stakeholder review
- **Testing**: Full integration testing
- **Rollback**: Detailed rollback plan with multiple checkpoints

## Pre-Change Requirements

### MANDATORY: Pre-Change Validation

Before ANY infrastructure change:

```bash
# 1. Validate current system state
nix run .#status-all

# 2. Backup current configuration
kubectl get all --all-namespaces -o yaml > backup-$(date +%Y%m%d-%H%M%S).yaml

# 3. Test changes in development
nix flake check
kubectl apply --dry-run=client -f [changed-manifests]

# 4. Verify rollback procedure
git stash push -m "backup before change"
# Test rollback steps...
git stash pop
```

**⚠️ CRITICAL: Changes MUST NOT proceed without successful validation.**

### Change Documentation Requirements

#### Change Request Template
```markdown
## Infrastructure Change Request

**Change ID**: INFRA-YYYY-NNNN
**Date**: [Date]
**Engineer**: [Name]
**Reviewer**: [Name]
**Risk Level**: [Low/Medium/High/Critical]

### Description
[Detailed description of what is changing and why]

### Components Affected
- [ ] Kubernetes cluster
- [ ] NATS message broker
- [ ] BFF application
- [ ] Worker pods
- [ ] Monitoring stack
- [ ] Network policies
- [ ] Storage systems
- [ ] Security configurations

### Testing Plan
[How the change will be tested]

### Rollback Plan
[Step-by-step rollback procedure]

### Success Criteria
[How to verify the change was successful]

### Timeline
- Start: [datetime]
- Expected completion: [datetime]
- Rollback deadline: [datetime]
```

## Change Implementation Procedures

### Standard Change Workflow

#### 1. Preparation Phase
```bash
# Create feature branch for infrastructure changes
git checkout -b infra/change-description

# Update Nix configurations
edit infra/components/[component]/flake.nix

# Validate Nix expressions
nix flake check

# Generate updated manifests
nix build .#all-manifests
```

#### 2. Testing Phase
```bash
# Deploy to local development environment
nix run .#dev-cluster-up
nix run .#deploy-all

# Validate functionality
./scripts/integration-tests.sh

# Performance baseline
kubectl top nodes
kubectl top pods --all-namespaces
```

#### 3. Staging Deployment (Medium+ Risk)
```bash
# Deploy to staging environment
kubectl config use-context staging
nix run .#deploy-staging

# Run comprehensive tests
nix run .#test-integration
nix run .#test-performance
nix run .#test-security
```

#### 4. Production Deployment
```bash
# Switch to production context
kubectl config use-context production

# Apply changes with monitoring
kubectl apply -f [manifests] --record

# Verify deployment success
nix run .#status-all
./scripts/health-check.sh

# Monitor for 30 minutes
watch -n 30 "kubectl get pods --all-namespaces | grep -v Running"
```

### Emergency Change Procedures

For critical security or stability issues requiring immediate infrastructure changes:

#### Fast-Track Process
1. **Document emergency justification**
2. **Get verbal approval** from engineering manager
3. **Implement minimal change** to resolve issue
4. **Monitor immediately** for adverse effects
5. **Document detailed post-mortem** within 24 hours

```bash
# Emergency change implementation
echo "EMERGENCY CHANGE: [description]" > emergency-change-log.txt
kubectl apply -f emergency-fix.yaml --record
nix run .#status-all
# Monitor continuously for 1 hour
```

## Infrastructure Components

### Kubernetes Cluster Changes

#### Node Management
```bash
# Add new node (planned capacity expansion)
kubectl get nodes
kubectl taint node [node-name] key=value:NoSchedule  # For maintenance

# Drain node safely
kubectl drain [node-name] --ignore-daemonsets --delete-emptydir-data

# Remove node
kubectl delete node [node-name]
```

#### Namespace and RBAC Changes
```bash
# Create new namespace with proper labels
kubectl create namespace new-namespace
kubectl label namespace new-namespace managed-by=fluo

# Apply RBAC changes
kubectl apply -f rbac-changes.yaml

# Verify permissions
kubectl auth can-i [verb] [resource] --as=system:serviceaccount:[namespace]:[serviceaccount]
```

### Storage Changes

#### Persistent Volume Management
```bash
# Backup data before storage changes
kubectl exec [pod-name] -- tar czf - /data | gzip > data-backup-$(date +%Y%m%d).tar.gz

# Resize persistent volume claim
kubectl patch pvc [pvc-name] -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'

# Verify expansion
kubectl get pvc [pvc-name] -o jsonpath='{.status.capacity.storage}'
```

#### Volume Snapshot Management
```bash
# Create volume snapshot before major changes
kubectl create volumesnapshot data-backup --source=pvc/data-volume

# Verify snapshot
kubectl get volumesnapshot data-backup -o yaml
```

### Network Configuration Changes

#### Network Policy Updates
```bash
# Test network connectivity before changes
kubectl exec [pod-name] -- nc -zv [target-service] [port]

# Apply network policy changes
kubectl apply -f network-policies.yaml

# Verify connectivity after changes
kubectl exec [pod-name] -- nc -zv [target-service] [port]
```

#### Service and Ingress Changes
```bash
# Update service configuration
kubectl apply -f service-updates.yaml

# Test external connectivity
curl -H "Host: fluo-api.localhost" http://localhost/health

# Update ingress rules
kubectl apply -f ingress-updates.yaml
```

### Monitoring and Observability Changes

#### Prometheus Configuration Updates
```bash
# Update Prometheus configuration
kubectl create configmap prometheus-config --from-file=prometheus.yml --dry-run=client -o yaml | kubectl apply -f -

# Reload Prometheus configuration
kubectl exec prometheus-0 -- curl -X POST http://localhost:9090/-/reload

# Verify new scrape targets
curl http://prometheus:9090/api/v1/targets
```

#### Grafana Dashboard Updates
```bash
# Update dashboards
kubectl create configmap grafana-dashboards --from-file=dashboards/ --dry-run=client -o yaml | kubectl apply -f -

# Restart Grafana to load new dashboards
kubectl rollout restart deployment/grafana
```

## Rollback Procedures

### Automated Rollback

#### Kubernetes Rollback
```bash
# Rollback deployment to previous version
kubectl rollout undo deployment/[deployment-name] -n [namespace]

# Rollback to specific revision
kubectl rollout undo deployment/[deployment-name] --to-revision=[revision-number]

# Verify rollback success
kubectl rollout status deployment/[deployment-name] -n [namespace]
```

#### Git-based Configuration Rollback
```bash
# Revert to previous commit
git revert [commit-hash]

# Apply reverted configuration
nix run .#deploy-all

# Verify system health
nix run .#status-all
```

### Manual Rollback Procedures

#### Complete Infrastructure Rollback
```bash
# 1. Stop current deployment
nix run .#delete-all

# 2. Restore from backup
kubectl apply -f backup-[timestamp].yaml

# 3. Verify restoration
nix run .#status-all
./scripts/integration-tests.sh

# 4. Update monitoring
kubectl logs -l app=prometheus --tail=100
```

#### Partial Component Rollback
```bash
# Rollback specific component
nix run ./infra/components/[component]#rollback

# Verify component health
kubectl get pods -l app=[component] -n [namespace]
```

## Change Validation and Testing

### Pre-deployment Testing

#### Infrastructure Validation Tests
```bash
# Validate Nix expressions
nix flake check --show-trace

# Validate Kubernetes manifests
kubectl apply --dry-run=server -f [manifests]

# Check resource quotas
kubectl describe quota --all-namespaces

# Validate RBAC
kubectl auth can-i --list --as=system:serviceaccount:[namespace]:[serviceaccount]
```

#### Security Validation
```bash
# Scan for security issues
nix run .#security-scan

# Validate network policies
kubectl describe networkpolicy --all-namespaces

# Check for exposed secrets
kubectl get secrets --all-namespaces -o json | jq '.items[] | select(.type=="Opaque") | .metadata.name'
```

### Post-deployment Validation

#### Health Checks
```bash
# Comprehensive health verification
./scripts/health-check-comprehensive.sh

# Performance baseline comparison
kubectl top nodes > post-change-performance.txt
diff pre-change-performance.txt post-change-performance.txt
```

#### Integration Testing
```bash
# Run full integration test suite
nix run .#test-integration

# Test external connectivity
curl -f http://fluo-api.localhost/health
curl -f http://fluo-grafana.localhost/api/health
```

## Risk Mitigation

### Change Windows

#### Planned Maintenance Windows
- **Low Risk**: Anytime during business hours
- **Medium Risk**: Off-hours or scheduled maintenance windows
- **High Risk**: Planned maintenance windows with stakeholder notification
- **Critical**: Emergency-only or major planned maintenance with extended notice

#### Change Frequency Limits
- **Maximum changes per day**: 3 (excluding emergency changes)
- **Minimum time between major changes**: 4 hours
- **Required stability period**: 24 hours before next major change

### Monitoring During Changes

#### Real-time Monitoring
```bash
# Monitor pod status continuously
watch -n 10 "kubectl get pods --all-namespaces | grep -v Running"

# Monitor resource usage
watch -n 30 "kubectl top nodes; echo '---'; kubectl top pods --all-namespaces --sort-by='cpu'"

# Monitor application health
watch -n 60 "curl -s http://fluo-api.localhost/health | jq '.status'"
```

#### Alert Configuration During Changes
- Reduce alert thresholds temporarily
- Add specific alerts for changes being made
- Increase alert frequency during change window
- Ensure escalation paths are active

## Documentation and Compliance

### Change Records

#### Required Documentation
- Pre-change system state snapshot
- Detailed change implementation steps
- Validation test results
- Post-change verification
- Performance impact analysis
- Lessons learned and improvements

#### Audit Trail
```bash
# Generate change audit report
kubectl get events --all-namespaces --sort-by='.firstTimestamp' | grep -A5 -B5 [change-timestamp]

# Export change history
git log --oneline --since="1 week ago" infra/ > infra-changes-$(date +%Y%m%d).log

# Document configuration changes
kubectl diff -f [new-manifests] > config-changes-$(date +%Y%m%d).diff
```

### Compliance Requirements

#### Change Approval Matrix
| Risk Level | Technical Approval | Security Review | Business Approval |
|------------|-------------------|-----------------|-------------------|
| Low        | Engineer          | Not Required    | Not Required      |
| Medium     | Senior Engineer   | If Security-Related | Not Required  |
| High       | Engineering Manager | Required      | If User-Facing    |
| Critical   | Engineering Director | Required     | Required          |

#### Regular Reviews
- **Weekly**: Review all infrastructure changes from past week
- **Monthly**: Analyze change success rate and rollback frequency
- **Quarterly**: Review and update change management procedures

## Related Documents
- [SOP-001: Development Workflow](001-development-workflow.md)
- [SOP-002: Deployment Process](002-deployment-process.md)
- [SOP-003: Security Protocols](003-security-protocols.md)
- [SOP-004: Monitoring & Alerting](004-monitoring-alerting.md)
- [ADR-001: Service-Owned Deployment Modules](../ADRs/001-service-owned-deployment-modules.md)
- [ADR-004: Kubernetes-Native Infrastructure Architecture](../ADRs/004-kubernetes-native-infrastructure.md)
- [ADR-005: Component-Based Infrastructure Modules](../ADRs/005-component-based-infrastructure.md)