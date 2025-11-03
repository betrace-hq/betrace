# Runbook: Backend Down

## Alert
- **Name**: BeTraceBackendDown
- **Severity**: Critical
- **MTTR Target**: 5 minutes

## Symptom
- Backend health check failing (`up{job="betrace-backend"} == 0`)
- No span ingestion
- Grafana plugin shows "Backend unreachable" error
- API requests timeout or return connection refused

## Impact
- **User Impact**: No rule evaluation, no new violations detected
- **Business Impact**: Loss of observability into trace patterns, compliance gaps
- **Data Loss Risk**: Spans not evaluated against rules (may miss critical violations)

## Diagnosis

### 1. Verify Alert
```bash
# Check if backend pods are running
kubectl get pods -n betrace -l app=betrace-backend

# Expected output:
# NAME                              READY   STATUS    RESTARTS   AGE
# betrace-backend-xxxxx-yyyyy       1/1     Running   0          10m
```

### 2. Check Pod Status
```bash
# If pods are not Running, check status
kubectl describe pod -n betrace -l app=betrace-backend

# Common failure states:
# - CrashLoopBackOff: Application crashing on startup
# - ImagePullBackOff: Cannot pull container image
# - Pending: Insufficient resources to schedule pod
# - OOMKilled: Pod killed due to memory limit
```

### 3. Check Logs
```bash
# Get recent logs
kubectl logs -n betrace deployment/betrace-backend --tail=50

# Look for:
# - Panic stack traces
# - "Fatal error" messages
# - Port binding failures
# - Configuration errors
```

### 4. Check Events
```bash
# Recent cluster events
kubectl get events -n betrace --sort-by='.lastTimestamp' | head -20
```

## Mitigation (Restore Service)

### Scenario A: CrashLoopBackOff (Application Panic)

**Cause**: Bad configuration or recent deployment introduced bug

**Action**:
```bash
# 1. Check if recent deployment caused issue
kubectl rollout history deployment/betrace-backend -n betrace

# 2. Rollback to previous version
kubectl rollout undo deployment/betrace-backend -n betrace

# 3. Verify pods are healthy
kubectl get pods -n betrace -l app=betrace-backend
kubectl logs -n betrace deployment/betrace-backend --tail=10
```

**Time**: ~2 minutes

### Scenario B: OOMKilled (Out of Memory)

**Cause**: Memory limit too low or memory leak

**Action**:
```bash
# 1. Increase memory limit temporarily
kubectl set resources deployment/betrace-backend -n betrace \
  --limits=memory=2Gi --requests=memory=1Gi

# 2. Verify pods restart successfully
kubectl get pods -n betrace -l app=betrace-backend -w
```

**Time**: ~3 minutes

**Follow-up**: Investigate memory leak or adjust baseline limits

### Scenario C: Pending (No Resources Available)

**Cause**: Cluster capacity exhausted

**Action**:
```bash
# 1. Check node resources
kubectl top nodes

# 2. Option A: Scale down non-critical workloads
kubectl scale deployment/{non-critical-app} -n {namespace} --replicas=0

# 3. Option B: Add cluster capacity (cloud provider)
# AWS: Increase ASG desired capacity
# GCP: gcloud container clusters resize {cluster} --num-nodes=5
# Azure: az aks scale --resource-group {rg} --name {cluster} --node-count 5

# 4. Verify backend pods schedule
kubectl get pods -n betrace -l app=betrace-backend -w
```

**Time**: ~5 minutes (scale down) or ~10 minutes (add nodes)

### Scenario D: ImagePullBackOff

**Cause**: Container registry authentication or image doesn't exist

**Action**:
```bash
# 1. Check image name in deployment
kubectl get deployment betrace-backend -n betrace -o yaml | grep image:

# 2. Verify image exists in registry
# Docker Hub: docker manifest inspect {image}
# ECR: aws ecr describe-images --repository-name betrace-backend
# GCR: gcloud container images describe {image}

# 3. If image missing, use known-good version
kubectl set image deployment/betrace-backend -n betrace \
  betrace-backend=betracehq/betrace-backend:v2.0.0

# 4. Verify pods start
kubectl get pods -n betrace -l app=betrace-backend -w
```

**Time**: ~3 minutes

### Emergency: Deploy Standalone Pod

If deployment is broken, deploy standalone pod:

```bash
# 1. Create emergency pod
kubectl run betrace-backend-emergency -n betrace \
  --image=betracehq/betrace-backend:v2.0.0 \
  --port=12011 \
  --env="LOG_LEVEL=info" \
  --restart=Always

# 2. Expose via service
kubectl expose pod betrace-backend-emergency -n betrace \
  --name=betrace-backend-emergency-svc \
  --port=12011 \
  --target-port=12011

# 3. Update Grafana plugin to point to emergency service
# Update datasource URL: http://betrace-backend-emergency-svc:12011
```

**Time**: ~5 minutes

## Resolution (Long-term Fix)

### If Rollback Was Required
1. Investigate what broke in rolled-back deployment
2. Fix issue in dev/staging environment
3. Deploy fix with proper testing
4. Update runbook if new failure mode discovered

### If Resource Limits Were Increased
1. Analyze memory usage patterns over 24h
2. Determine if increase is permanent or investigate leak
3. Update deployment YAML with new limits
4. Set up memory usage alerts

### If Configuration Error
1. Fix configuration in source control
2. Update ConfigMap/Secret
3. Restart deployment
4. Add configuration validation to CI/CD

## Prevention

1. **Pre-deployment checks**:
   - Run integration tests in staging
   - Verify configuration with dry-run: `kubectl apply --dry-run=server`
   - Use progressive rollout (canary/blue-green)

2. **Monitoring**:
   - Alert on pod restarts > 3 in 5 minutes
   - Alert on deployment rollout stuck
   - Track memory usage trend

3. **Resource planning**:
   - Set memory limits to 2x typical usage
   - Monitor p95 memory usage weekly
   - Plan cluster capacity for 2x peak load

4. **Deployment safety**:
   - Always deploy during business hours
   - Have rollback plan ready
   - Require approval for production changes

## Related Runbooks
- [high-latency.md](high-latency.md) - If backend slow but not down
- [high-memory.md](high-memory.md) - Memory pressure without OOM
- [high-cpu.md](high-cpu.md) - CPU exhaustion

## Post-Incident Actions
- [ ] Update post-incident review: [template](post-incident-template.md)
- [ ] Notify #betrace-incidents of resolution
- [ ] Update status page (if applicable)
- [ ] Schedule post-mortem within 48h (for critical incidents)
