# SOP-003: Security Protocols

## Purpose
Establish comprehensive security requirements and incident response procedures for the FLUO infrastructure.

## Scope
Applies to all FLUO components: BFF, Backend, Infrastructure, and development practices.

## Security Requirements

### MANDATORY: Infrastructure Security

All infrastructure components MUST implement:

```bash
# 1. Vulnerability scanning before deployment
nix run .#security-scan

# 2. RBAC validation
kubectl auth can-i --list --as=system:serviceaccount:fluo-bff:bff

# 3. Network policy verification
kubectl get networkpolicies --all-namespaces

# 4. Secret management validation
kubectl get secrets --all-namespaces -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.namespace}{"\n"}{end}'
```

**⚠️ CRITICAL: Do not deploy components that fail security validation.**

## Access Control

### Kubernetes RBAC
- **Principle of Least Privilege**: Each service account has minimal required permissions
- **Service Isolation**: Network policies restrict inter-pod communication
- **Secret Access**: Secrets mounted only to pods that require them

### Service Account Configuration
```yaml
# Example: BFF service account (minimal permissions)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: bff
  namespace: fluo-bff
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: bff-role
  namespace: fluo-bff
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
```

### Network Security
- **Default Deny**: All network policies default to deny
- **Explicit Allow**: Only required communications explicitly permitted
- **TLS Encryption**: All inter-service communication encrypted

## Secret Management

### Secret Creation and Rotation
```bash
# Create secrets using proper encoding
echo -n 'secret-value' | base64 | kubectl create secret generic my-secret --from-literal=key=-

# Rotate secrets quarterly (minimum)
kubectl patch secret my-secret -p '{"data":{"key":"'$(echo -n 'new-secret-value' | base64)'"}}'
```

### Secret Access Patterns
- **Environment Variables**: For non-sensitive configuration
- **Mounted Volumes**: For sensitive data (TLS certificates, API keys)
- **External Secret Stores**: For production environments (HashiCorp Vault, cloud KMS)

### Prohibited Practices
❌ **Never store secrets in**:
- Git repositories
- Container images
- ConfigMaps
- Environment variables for sensitive data
- Plain text files

## Container Security

### Image Security Requirements
```bash
# Scan images for vulnerabilities
docker scan [image-name]
# or using trivy
trivy image [image-name]
```

### Secure Container Practices
- **Non-root users**: Containers run as user ID 1000:1000
- **Read-only filesystems**: Where possible
- **Resource limits**: CPU and memory limits enforced
- **Security contexts**: Drop capabilities, no privilege escalation

### Example Secure Container Configuration
```yaml
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
    runAsNonRoot: true
    readOnlyRootFilesystem: true
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL
    resources:
      limits:
        memory: "512Mi"
        cpu: "500m"
      requests:
        memory: "256Mi"
        cpu: "250m"
```

## Data Protection

### Data Classification
- **Public**: Documentation, marketing materials
- **Internal**: Source code, development data
- **Confidential**: User data, API keys, certificates
- **Restricted**: PII, financial data, legal documents

### Encryption Requirements
- **Data in Transit**: TLS 1.3 minimum for all communications
- **Data at Rest**: AES-256 encryption for persistent volumes
- **Secrets**: Base64 encoded in Kubernetes, encrypted at rest by etcd

### Data Handling Procedures
```bash
# Backup encrypted volumes
kubectl create backup pvc/data-volume --encryption-key=/path/to/key

# Secure data deletion
kubectl delete pvc/data-volume --wait --grace-period=30
# Verify deletion
kubectl get pv | grep Available
```

## Incident Response

### Security Incident Classification
1. **Critical**: Active breach, data exfiltration, system compromise
2. **High**: Attempted breach, vulnerability exploitation, unauthorized access
3. **Medium**: Policy violations, suspicious activity, failed attacks
4. **Low**: Security warnings, audit findings, minor misconfigurations

### Immediate Response (Critical/High)
```bash
# 1. Isolate affected components
kubectl scale deployment [affected-deployment] --replicas=0

# 2. Preserve evidence
kubectl logs [affected-pod] > incident-logs-$(date +%Y%m%d-%H%M%S).txt

# 3. Apply emergency patches
kubectl patch deployment [deployment] -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","image":"secure-image:latest"}]}}}}'

# 4. Verify system integrity
nix run .#security-scan
```

### Contact Information
- **Security Team**: security@fluo.com (24/7)
- **Engineering Leadership**: engineering-leads@fluo.com
- **Legal/Compliance**: legal@fluo.com
- **External Support**: Kubernetes security hotline, cloud provider security

### Communication Templates

#### Internal Notification
```
SECURITY INCIDENT ALERT
Severity: [Critical/High/Medium/Low]
Time: [timestamp]
Affected Components: [list]
Brief Description: [summary]
Response Team: [team members]
Status: [investigating/contained/resolved]
Next Update: [time]
```

#### Customer Communication (if applicable)
```
Service Status Update
We are investigating reports of [brief description].
Current Status: [investigating/identified/monitoring/resolved]
Customer Impact: [description]
Timeline: [when issue started, key milestones]
Next Update: [time]
```

## Security Monitoring

### Automated Security Monitoring
```bash
# Deploy security monitoring stack
nix run ./infra/components/security-monitoring#deploy

# View security dashboard
kubectl port-forward svc/security-dashboard 3000:3000
```

### Key Security Metrics
- Failed authentication attempts
- Privilege escalation attempts
- Unusual network traffic patterns
- Container runtime security events
- File integrity violations

### Alert Configuration
```yaml
# Example: Alert on failed authentication
groups:
- name: security.rules
  rules:
  - alert: HighFailedAuthRate
    expr: rate(auth_failures_total[5m]) > 0.1
    for: 2m
    labels:
      severity: high
    annotations:
      summary: "High rate of authentication failures"
      description: "Failed auth rate is {{ $value }} per second"
```

## Compliance Requirements

### Regular Security Audits
- **Weekly**: Vulnerability scans of running containers
- **Monthly**: RBAC permission reviews
- **Quarterly**: Security policy compliance checks
- **Annually**: Penetration testing and security architecture review

### Documentation Requirements
- All security incidents documented with root cause analysis
- Security control implementations documented
- Access reviews documented with approval chains
- Change logs for security-related modifications

### Audit Trail Maintenance
```bash
# Kubernetes audit logs
kubectl logs kube-apiserver --namespace=kube-system | grep audit

# Application audit logs
kubectl logs -l app=bff --namespace=fluo-bff | grep -E "(AUTH|SECURITY|ACCESS)"

# Security scan results
nix run .#security-scan --output=audit-report-$(date +%Y%m%d).json
```

## Development Security

### Secure Development Practices
- **Code reviews required** for all security-related changes
- **Dependency scanning** integrated into CI/CD pipeline
- **Secret scanning** in pre-commit hooks
- **Security testing** in development environments

### Pre-commit Security Checks
```bash
# Automated security checks (add to .pre-commit-config.yaml)
- repo: https://github.com/trufflesecurity/trufflehog
  rev: main
  hooks:
  - id: trufflehog
- repo: https://github.com/aquasecurity/trivy
  rev: main
  hooks:
  - id: trivy-fs
```

## Emergency Procedures

### Security Breach Response
1. **Immediate**: Isolate affected systems
2. **5 minutes**: Notify security team
3. **15 minutes**: Begin forensic data collection
4. **30 minutes**: Implement containment measures
5. **1 hour**: Notify stakeholders and customers
6. **24 hours**: Complete incident analysis and remediation plan

### Recovery Procedures
```bash
# 1. Verify system integrity
nix run .#security-verify

# 2. Apply security patches
nix run .#security-patch

# 3. Restore from clean backup if necessary
nix run .#restore-from-backup --timestamp=[clean-backup-timestamp]

# 4. Re-deploy with enhanced monitoring
nix run .#deploy-with-security-monitoring
```

## Related Documents
- [SOP-001: Development Workflow](001-development-workflow.md)
- [SOP-002: Deployment Process](002-deployment-process.md)
- [SOP-004: Monitoring & Alerting](004-monitoring-alerting.md)
- [ADR-004: Kubernetes-Native Infrastructure Architecture](../ADRs/004-kubernetes-native-infrastructure.md)
- [ADR-009: Modular Configuration Management](../ADRs/009-modular-configuration-management.md)