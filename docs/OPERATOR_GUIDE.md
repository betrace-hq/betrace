# BeTrace Operator Guide

**Version**: 2.0.0
**Last Updated**: 2025-11-02
**Target Audience**: Platform Engineers, SREs, DevOps Teams

---

## Table of Contents

1. [Introduction](#introduction)
2. [Production Deployment](#production-deployment)
3. [Scaling](#scaling)
4. [Monitoring](#monitoring)
5. [Maintenance](#maintenance)
6. [Security](#security)
7. [Disaster Recovery](#disaster-recovery)
8. [Performance Tuning](#performance-tuning)

---

## Introduction

This guide covers production deployment, scaling, monitoring, and maintenance of BeTrace. For user-facing features, see [USER_GUIDE.md](USER_GUIDE.md).

### Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│  Production Deployment                                     │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  BeTrace     │  │  BeTrace     │  │  BeTrace     │    │
│  │  Backend     │  │  Backend     │  │  Backend     │    │
│  │  Replica 1   │  │  Replica 2   │  │  Replica 3   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                           ↓                                │
│                  ┌──────────────────┐                      │
│                  │  Load Balancer   │                      │
│                  │  (Service/Ingress)                      │
│                  └────────┬─────────┘                      │
│                           ↓                                │
│              ┌────────────────────────┐                    │
│              │  Tempo (3+ replicas)   │                    │
│              │  Violation storage     │                    │
│              └────────────────────────┘                    │
└────────────────────────────────────────────────────────────┘
```

### Key Components

1. **BeTrace Backend**: Stateless Go service (horizontally scalable)
2. **Rule Storage**: Persistent disk (shared via PVC or S3-backed)
3. **OTLP Export**: Tempo or other OTLP-compatible backend
4. **Monitoring**: Prometheus, Grafana dashboards, alerts

---

## Production Deployment

### Prerequisites

- **Kubernetes**: 1.24+ (or Docker Compose for single-node)
- **Tempo**: OTLP-enabled backend (Grafana Tempo, Jaeger, SigNoz)
- **Grafana**: 9.0+ (for BeTrace plugin)
- **Prometheus**: For metrics collection
- **Persistent Storage**: For rule persistence (50GB+ recommended)

### Kubernetes Deployment (Recommended)

#### 1. Create Namespace

```bash
kubectl create namespace betrace
```

#### 2. Create Secrets

```bash
# OTLP endpoint
kubectl create secret generic betrace-config -n betrace \
  --from-literal=otel-endpoint=tempo.observability.svc.cluster.local:4317 \
  --from-literal=signature-key=$(openssl rand -base64 32)
```

#### 3. Deploy Backend

```yaml
# betrace-backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: betrace-backend
  namespace: betrace
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: betrace-backend
  template:
    metadata:
      labels:
        app: betrace-backend
        version: "2.0.0"
    spec:
      containers:
      - name: betrace-backend
        image: betracehq/backend:2.0.0
        ports:
        - containerPort: 12011
          name: http
          protocol: TCP
        env:
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: betrace-config
              key: otel-endpoint
        - name: BETRACE_SIGNATURE_KEY
          valueFrom:
            secretKeyRef:
              name: betrace-config
              key: signature-key
        - name: LOG_LEVEL
          value: "info"
        - name: BETRACE_STORAGE_PATH
          value: "/data/rules"
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 12011
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 12011
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: rules-storage
          mountPath: /data/rules
      volumes:
      - name: rules-storage
        persistentVolumeClaim:
          claimName: betrace-rules-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: betrace-rules-pvc
  namespace: betrace
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: fast-ssd  # Adjust to your cluster's storage class
```

Apply:
```bash
kubectl apply -f betrace-backend-deployment.yaml
```

#### 4. Create Service

```yaml
# betrace-backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: betrace-backend
  namespace: betrace
spec:
  selector:
    app: betrace-backend
  ports:
  - port: 12011
    targetPort: 12011
    name: http
  type: ClusterIP
```

Apply:
```bash
kubectl apply -f betrace-backend-service.yaml
```

#### 5. Create HorizontalPodAutoscaler

```yaml
# betrace-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: betrace-backend-hpa
  namespace: betrace
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: betrace-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1
        periodSeconds: 120
```

Apply:
```bash
kubectl apply -f betrace-hpa.yaml
```

#### 6. Deploy ServiceMonitor (Prometheus)

```yaml
# betrace-servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: betrace-backend
  namespace: betrace
spec:
  selector:
    matchLabels:
      app: betrace-backend
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

Apply:
```bash
kubectl apply -f betrace-servicemonitor.yaml
```

### Docker Compose Deployment (Single Node)

See [USER_GUIDE.md#option-2-docker-compose](USER_GUIDE.md#option-2-docker-compose-production-like).

### AWS ECS Deployment

```json
{
  "family": "betrace-backend",
  "taskRoleArn": "arn:aws:iam::123456789:role/betrace-task-role",
  "executionRoleArn": "arn:aws:iam::123456789:role/betrace-execution-role",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "betrace-backend",
      "image": "betracehq/backend:2.0.0",
      "portMappings": [
        {
          "containerPort": 12011,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
          "value": "tempo.example.com:4317"
        },
        {
          "name": "LOG_LEVEL",
          "value": "info"
        }
      ],
      "secrets": [
        {
          "name": "BETRACE_SIGNATURE_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:betrace-signature-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/betrace-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "betrace"
        }
      }
    }
  ]
}
```

---

## Scaling

### Horizontal Scaling

**Capacity per Instance**:
- **CPU**: 2 cores @ 70% utilization
- **Memory**: 1-2GB RSS
- **Throughput**: 2.65M spans/sec
- **Rules**: < 50 rules (recommended)

**Scaling Formula**:
```
Required Instances = (Target Spans/Sec) / (2.65M * 0.7)
                   = (Target Spans/Sec) / 1.86M

Example:
  10k spans/sec   → 1 instance
  100k spans/sec  → 1 instance (under capacity)
  1M spans/sec    → 1 instance (at 54% capacity)
  10M spans/sec   → 6 instances
```

**Auto-Scaling Configuration**:
```yaml
# Kubernetes HPA (see deployment above)
minReplicas: 3
maxReplicas: 10
targetCPUUtilizationPercentage: 70
```

**Manual Scaling**:
```bash
# Kubernetes
kubectl scale deployment betrace-backend -n betrace --replicas=5

# Docker Compose
docker-compose up -d --scale betrace-backend=5

# AWS ECS
aws ecs update-service \
  --cluster betrace-cluster \
  --service betrace-backend \
  --desired-count 5
```

### Vertical Scaling

**When to scale vertically**:
- > 50 rules per instance
- Complex rules with `trace.has()` (iterate all spans)
- High-cardinality trace attributes

**Resource Recommendations**:

| Workload | CPU | Memory | Max Rules | Throughput |
|----------|-----|--------|-----------|------------|
| Small | 1 core | 512MB | 25 | 1M spans/sec |
| Medium | 2 cores | 1GB | 50 | 2.65M spans/sec |
| Large | 4 cores | 2GB | 100 | 5M spans/sec |
| XLarge | 8 cores | 4GB | 200 | 10M spans/sec |

**Update resources** (Kubernetes):
```bash
kubectl set resources deployment betrace-backend -n betrace \
  --requests=cpu=4000m,memory=2Gi \
  --limits=cpu=8000m,memory=4Gi
```

### Rule Distribution (Advanced)

For > 100 rules, consider **rule sharding**:

```
┌──────────────────────┐
│  Load Balancer       │
└──────────┬───────────┘
           │
    ┌──────┴──────┬────────────┐
    ↓             ↓            ↓
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Backend │  │ Backend │  │ Backend │
│ Shard 1 │  │ Shard 2 │  │ Shard 3 │
│ Rules   │  │ Rules   │  │ Rules   │
│ 1-33    │  │ 34-66   │  │ 67-100  │
└─────────┘  └─────────┘  └─────────┘
```

**Implementation**:
- Use consistent hashing on `trace_id` to route spans
- Each shard loads subset of rules
- Deploy via StatefulSet with persistent rule storage

---

## Monitoring

### Key Metrics

#### Throughput
```promql
# Span ingestion rate
rate(betrace_spans_ingested_total[5m])

# Violation emission rate
rate(betrace_violations_total[5m])

# Rule evaluation rate
rate(betrace_rule_evaluations_total[5m])
```

#### Latency
```promql
# p99 request latency
histogram_quantile(0.99,
  rate(http_request_duration_seconds_bucket{job="betrace-backend"}[5m])
)

# p99 rule evaluation time
histogram_quantile(0.99,
  rate(betrace_rule_evaluation_duration_seconds_bucket[5m])
)
```

#### Errors
```promql
# HTTP 5xx error rate
rate(http_requests_total{job="betrace-backend",status=~"5.."}[5m])

# Rule evaluation errors
rate(betrace_rule_evaluation_errors_total[5m])

# OTLP export failures
rate(betrace_otlp_export_failures_total[5m])
```

#### Resources
```promql
# CPU utilization
rate(process_cpu_seconds_total{job="betrace-backend"}[5m])

# Memory usage
process_resident_memory_bytes{job="betrace-backend"}

# Goroutines (leak detection)
go_goroutines{job="betrace-backend"}
```

### Grafana Dashboards

Import pre-built dashboards:

```bash
# BeTrace Backend Overview
curl -O https://raw.githubusercontent.com/betracehq/betrace/main/grafana/dashboards/backend-overview.json

# Violation Trends
curl -O https://raw.githubusercontent.com/betracehq/betrace/main/grafana/dashboards/violation-trends.json

# Rule Performance
curl -O https://raw.githubusercontent.com/betracehq/betrace/main/grafana/dashboards/rule-performance.json
```

### Alerts

See [docs/deployment/alert-rules.yaml](deployment/alert-rules.yaml) for complete alerting configuration.

**Critical Alerts**:
- Backend down (MTTR: 5min)
- Critical violation spike (MTTR: 10min)
- Compliance emission failure (MTTR: 15min)

**Warning Alerts**:
- High CPU (> 80% for 10min)
- High memory (> 80% for 5min)
- High violation rate (> 100/sec for 10min)
- Slow rule evaluation (p95 > 100ms)

### Health Checks

**Liveness Probe**:
```bash
curl http://localhost:12011/health

# Response:
# {
#   "status": "healthy",
#   "version": "2.0.0",
#   "uptime_seconds": 3600
# }
```

**Readiness Probe**:
```bash
curl http://localhost:12011/ready

# Response:
# {
#   "status": "ready",
#   "checks": {
#     "otlp_exporter": "ok",
#     "rule_engine": "ok",
#     "storage": "ok"
#   }
# }
```

---

## Maintenance

### Backup and Restore

#### Rules Backup

```bash
# Export all rules to JSON
kubectl exec -n betrace deployment/betrace-backend -- \
  curl http://localhost:12011/v1/rules > rules-backup-$(date +%Y%m%d).json

# Or via external endpoint
curl http://betrace.example.com/v1/rules > rules-backup.json
```

#### Rules Restore

```bash
# Restore from backup
jq -c '.rules[]' rules-backup.json | while read rule; do
  curl -X POST http://betrace.example.com/v1/rules \
    -H "Content-Type: application/json" \
    -d "$rule"
done
```

#### Automated Backups

```yaml
# CronJob for daily backups
apiVersion: batch/v1
kind: CronJob
metadata:
  name: betrace-backup
  namespace: betrace
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: curlimages/curl:latest
            command:
            - sh
            - -c
            - |
              curl http://betrace-backend:12011/v1/rules | \
              aws s3 cp - s3://betrace-backups/rules-$(date +%Y%m%d).json
          restartPolicy: OnFailure
```

### Upgrades

#### Rolling Update (Zero Downtime)

```bash
# Update image version
kubectl set image deployment/betrace-backend -n betrace \
  betrace-backend=betracehq/backend:2.1.0

# Monitor rollout
kubectl rollout status deployment/betrace-backend -n betrace

# Verify new version
kubectl exec -n betrace deployment/betrace-backend -- \
  curl http://localhost:12011/health | jq '.version'
```

#### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/betrace-backend -n betrace

# Rollback to specific revision
kubectl rollout undo deployment/betrace-backend -n betrace --to-revision=3
```

### Database Migrations (Rules Schema)

BeTrace uses JSON file storage for rules. Schema changes are backward-compatible.

**Migration Process**:
1. New version reads old format
2. Writes new format on next save
3. No downtime required

---

## Security

### Authentication

**Option 1: API Key**

```yaml
# Add auth middleware
apiVersion: v1
kind: Secret
metadata:
  name: betrace-auth
  namespace: betrace
stringData:
  api-key: "your-secret-api-key-here"
```

Configure backend:
```bash
export BETRACE_API_KEY_HEADER="X-API-Key"
export BETRACE_API_KEY="your-secret-api-key-here"
```

**Option 2: OAuth2/OIDC (via Ingress)**

```yaml
# Nginx Ingress with OAuth2
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: betrace-backend
  namespace: betrace
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "https://oauth2.example.com/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://oauth2.example.com/start"
spec:
  rules:
  - host: betrace.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: betrace-backend
            port:
              number: 12011
```

### TLS/HTTPS

**Enable TLS termination** (Kubernetes Ingress):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: betrace-backend
  namespace: betrace
spec:
  tls:
  - hosts:
    - betrace.example.com
    secretName: betrace-tls-cert
  rules:
  - host: betrace.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: betrace-backend
            port:
              number: 12011
```

Create TLS certificate:
```bash
# Using cert-manager
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: betrace-tls
  namespace: betrace
spec:
  secretName: betrace-tls-cert
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - betrace.example.com
EOF
```

### Network Policies

```yaml
# Restrict access to backend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: betrace-backend-netpol
  namespace: betrace
spec:
  podSelector:
    matchLabels:
      app: betrace-backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: observability
    - podSelector:
        matchLabels:
          app: grafana
    ports:
    - protocol: TCP
      port: 12011
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: observability
    ports:
    - protocol: TCP
      port: 4317  # Tempo OTLP
```

### Secrets Management

**Do NOT hardcode**:
- `BETRACE_SIGNATURE_KEY` (compliance span signatures)
- API keys
- OTLP endpoint credentials

**Use secrets manager**:

```bash
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name betrace/signature-key \
  --secret-string "$(openssl rand -base64 32)"

# Kubernetes External Secrets
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: betrace-secrets
  namespace: betrace
spec:
  secretStoreRef:
    name: aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: betrace-config
  data:
  - secretKey: signature-key
    remoteRef:
      key: betrace/signature-key
EOF
```

---

## Disaster Recovery

### RTO/RPO Targets

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| **Backend** | 5 min | 0 (stateless) | Redeploy from image |
| **Rules** | 15 min | 24h | Daily S3 backups |
| **Violations** | N/A | 0 | Stored in Tempo (customer's DR plan) |

### Backup Strategy

1. **Rules**: Daily automated backups to S3 (see [Backup and Restore](#backup-and-restore))
2. **Configuration**: Store in Git, deploy via GitOps (ArgoCD/Flux)
3. **Secrets**: Replicate to DR region via secrets manager

### Recovery Procedures

#### Scenario 1: Backend Pod Crash

**RTO**: < 1 minute (automatic)

**Recovery**:
```bash
# Kubernetes restarts pod automatically
# Verify:
kubectl get pods -n betrace
```

#### Scenario 2: Complete Cluster Failure

**RTO**: 15 minutes

**Recovery**:
```bash
# 1. Provision new cluster
terraform apply -var="region=us-west-2"

# 2. Restore configuration from Git
kubectl apply -f k8s/betrace/

# 3. Restore rules from S3 backup
aws s3 cp s3://betrace-backups/rules-latest.json - | \
  jq -c '.rules[]' | while read rule; do
    curl -X POST http://betrace-backend:12011/v1/rules \
      -H "Content-Type: application/json" \
      -d "$rule"
  done

# 4. Verify
kubectl get pods -n betrace
curl http://betrace-backend:12011/health
```

#### Scenario 3: Data Corruption

**RTO**: 30 minutes

**Recovery**:
```bash
# 1. Identify corruption
kubectl logs -n betrace deployment/betrace-backend --tail=100

# 2. Stop backend
kubectl scale deployment betrace-backend -n betrace --replicas=0

# 3. Clear corrupted data
kubectl exec -n betrace betrace-backend-0 -- rm -rf /data/rules/*

# 4. Restore from backup
aws s3 cp s3://betrace-backups/rules-20251101.json - | \
  kubectl exec -n betrace betrace-backend-0 -i -- \
  sh -c 'cat > /tmp/rules.json && /restore-rules.sh /tmp/rules.json'

# 5. Restart backend
kubectl scale deployment betrace-backend -n betrace --replicas=3
```

---

## Performance Tuning

### Rule Optimization

**Slow Rules** (> 10ms evaluation time):

```lua
-- BAD: Iterates all spans in trace (O(n))
trace.has(span.name == "audit.log")

-- GOOD: Check current span first (O(1))
span.name == "audit.log" or trace.has(span.name == "audit.log")
```

**High-Cardinality Attributes**:

```lua
-- BAD: Creates metric explosion
span.attributes["user.id"] != nil

-- GOOD: Sample or use low-cardinality attribute
span.attributes["user.type"] == "admin"
```

### Backend Tuning

**Environment Variables**:

```yaml
# Increase batch size for OTLP export
- name: OTEL_BSP_MAX_EXPORT_BATCH_SIZE
  value: "512"  # Default: 100

# Increase queue size
- name: OTEL_BSP_MAX_QUEUE_SIZE
  value: "4096"  # Default: 1000

# Reduce export timeout
- name: OTEL_BSP_EXPORT_TIMEOUT
  value: "5s"  # Default: 10s
```

**Go Runtime Tuning**:

```yaml
# Increase GOMAXPROCS for CPU-bound workloads
- name: GOMAXPROCS
  value: "8"

# Tune garbage collector (lower = more aggressive)
- name: GOGC
  value: "50"  # Default: 100
```

### Storage Optimization

**Rule Storage**:
- Use SSD-backed storage (> 1000 IOPS)
- Consider caching rules in memory (default behavior)
- Periodic cleanup of deleted rules

**Violation Buffer**:
- Increase buffer size for bursty workloads
- Enable disk-backed queue for overflow

---

## Troubleshooting

See [docs/runbooks/README.md](runbooks/README.md) for complete incident response guides:

- [Backend Down](runbooks/backend-down.md)
- [High Violation Rate](runbooks/high-violation-rate.md)
- [High CPU Usage](runbooks/high-cpu.md)
- [High Memory Usage](runbooks/high-memory.md)

---

## Support

- **GitHub Issues**: https://github.com/betracehq/betrace/issues
- **Documentation**: https://docs.betrace.io
- **Slack Community**: betrace-community.slack.com
- **Enterprise Support**: support@betrace.io

---

**Last Updated**: 2025-11-02
**Version**: 2.0.0
