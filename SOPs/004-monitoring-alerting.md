# SOP-004: Monitoring & Alerting

## Purpose
Establish comprehensive observability standards and alert handling procedures to maintain system reliability and performance.

## Scope
Applies to all FLUO components with specific focus on infrastructure monitoring, application metrics, and incident response.

## Monitoring Stack Overview

### Core Monitoring Components
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **NATS**: Message broker monitoring
- **Kubernetes**: Cluster and pod monitoring

### Deployment and Access
```bash
# Deploy monitoring stack
nix run ./infra/components/prometheus#deploy
nix run ./infra/components/grafana#deploy

# Access dashboards
# Grafana: http://fluo-grafana.localhost (admin/admin)
# Prometheus: kubectl port-forward svc/prometheus 9090:9090 -n fluo-monitoring
```

## Critical System Metrics

### MANDATORY: Core Health Metrics

All FLUO components MUST expose and monitor:

1. **System Health**:
   - Service uptime/availability (target: >99.9%)
   - Response time (target: <200ms average)
   - Error rate (target: <0.1%)

2. **Infrastructure Health**:
   - Kubernetes cluster resources
   - Pod restart counts
   - Network connectivity

3. **Application Health**:
   - API endpoint response times
   - Message queue processing rates
   - Database connection health

### Monitoring Verification
```bash
# Verify monitoring stack health
nix run .#status-all

# Check metric collection
curl http://prometheus.fluo-monitoring:9090/api/v1/targets

# Validate dashboard access
curl -I http://fluo-grafana.localhost
```

## Key Performance Indicators (KPIs)

### Service Level Objectives (SLOs)

#### BFF API Service
- **Availability**: 99.9% uptime
- **Latency**:
  - 95th percentile: <200ms
  - 99th percentile: <500ms
- **Error Rate**: <0.1% of requests

#### Message Processing (NATS)
- **Throughput**: Process 1000+ messages/second
- **Latency**: <100ms average processing time
- **Reliability**: 99.95% message delivery success

#### Worker Pods
- **Processing**: Complete jobs within 30 seconds
- **Scaling**: Auto-scale based on queue depth
- **Resource Usage**: <80% CPU, <70% memory

### Business Metrics
- **Job Completion Rate**: >99.5%
- **User Request Success**: >99.9%
- **System Recovery Time**: <5 minutes

## Alerting Configuration

### Critical Alerts (P0 - Immediate Response)

#### System Down Alerts
```yaml
groups:
- name: critical.rules
  rules:
  - alert: ServiceDown
    expr: up{job=~"bff|workers|nats"} == 0
    for: 30s
    labels:
      severity: critical
      priority: P0
    annotations:
      summary: "{{ $labels.job }} service is down"
      description: "Service {{ $labels.job }} has been down for more than 30 seconds"
      runbook_url: "https://docs.fluo.com/runbooks/service-down"

  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
    for: 2m
    labels:
      severity: critical
      priority: P0
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }}"
```

#### Infrastructure Alerts
```yaml
  - alert: KubernetesNodeDown
    expr: up{job="kubernetes-nodes"} == 0
    for: 5m
    labels:
      severity: critical
      priority: P0
    annotations:
      summary: "Kubernetes node is down"
      description: "Node {{ $labels.instance }} has been down for more than 5 minutes"

  - alert: PodCrashLooping
    expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
    for: 5m
    labels:
      severity: critical
      priority: P0
    annotations:
      summary: "Pod is crash looping"
      description: "Pod {{ $labels.pod }} in namespace {{ $labels.namespace }} is crash looping"
```

### High Priority Alerts (P1 - 15 minute response)

#### Performance Degradation
```yaml
  - alert: HighLatency
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.2
    for: 5m
    labels:
      severity: high
      priority: P1
    annotations:
      summary: "High API latency detected"
      description: "95th percentile latency is {{ $value }}s"

  - alert: MessageQueueBacklog
    expr: nats_jetstream_stream_messages > 1000
    for: 10m
    labels:
      severity: high
      priority: P1
    annotations:
      summary: "Message queue backlog growing"
      description: "Queue has {{ $value }} unprocessed messages"
```

### Medium Priority Alerts (P2 - 1 hour response)

#### Resource Usage
```yaml
  - alert: HighMemoryUsage
    expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.8
    for: 15m
    labels:
      severity: medium
      priority: P2
    annotations:
      summary: "High memory usage"
      description: "Memory usage is {{ $value | humanizePercentage }}"

  - alert: DiskSpaceRunningLow
    expr: (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes) < 0.1
    for: 30m
    labels:
      severity: medium
      priority: P2
    annotations:
      summary: "Disk space running low"
      description: "Only {{ $value | humanizePercentage }} disk space remaining"
```

## Alert Handling Procedures

### Immediate Response (P0 - Critical)

#### 1. Acknowledgment (Within 2 minutes)
```bash
# Acknowledge alert in monitoring system
curl -X POST "http://alertmanager:9093/api/v1/alerts" \
  -H "Content-Type: application/json" \
  -d '{"status": "acknowledged", "comment": "Investigating..."}'
```

#### 2. Initial Assessment (Within 5 minutes)
```bash
# Quick health check
nix run .#status-all

# Check recent deployments
kubectl rollout history deployment --all-namespaces

# View recent logs
kubectl logs -l app=bff --tail=100 --since=10m
```

#### 3. Escalation Timeline
- **Immediate**: On-call engineer responds
- **5 minutes**: Escalate to senior engineer if unresolved
- **15 minutes**: Escalate to engineering manager
- **30 minutes**: Escalate to engineering director

### Response Actions by Alert Type

#### Service Down Response
```bash
# 1. Check pod status
kubectl get pods --all-namespaces | grep -v Running

# 2. Describe failed pods
kubectl describe pod [pod-name] -n [namespace]

# 3. Check recent events
kubectl get events --sort-by='.firstTimestamp' -A

# 4. Restart if necessary
kubectl rollout restart deployment/[deployment-name] -n [namespace]

# 5. Verify recovery
curl -f http://fluo-api.localhost/health
```

#### High Error Rate Response
```bash
# 1. Check application logs
kubectl logs -l app=bff --since=10m | grep -i error

# 2. Analyze error patterns
kubectl logs -l app=bff --since=1h | grep -i "5\d\d" | head -20

# 3. Check upstream dependencies
curl -f http://nats.fluo-queue:8222/varz

# 4. Review recent code changes
git log --oneline --since="1 hour ago"
```

#### Infrastructure Alert Response
```bash
# 1. Check cluster health
kubectl cluster-info

# 2. Review node status
kubectl get nodes -o wide

# 3. Check resource usage
kubectl top nodes
kubectl top pods --all-namespaces

# 4. Review cluster events
kubectl get events --field-selector type!=Normal -A
```

## Dashboards and Visualization

### Primary Dashboards

#### 1. System Overview Dashboard
- Service health status
- Request rates and latencies
- Error rates by service
- Infrastructure resource usage

#### 2. NATS Message Broker Dashboard
- Message throughput
- Queue depths
- Consumer lag
- Connection counts

#### 3. Kubernetes Cluster Dashboard
- Node health and resource usage
- Pod distribution and restarts
- Network traffic patterns
- Storage utilization

#### 4. Application Performance Dashboard
- API endpoint performance
- Database query performance
- Background job processing
- User experience metrics

### Dashboard Access and Maintenance
```bash
# Import predefined dashboards
kubectl apply -f infra/monitoring/dashboards/

# Backup dashboard configurations
kubectl get configmap grafana-dashboards -o yaml > dashboard-backup.yaml

# Update dashboard from file
kubectl create configmap grafana-dashboards --from-file=dashboards/ --dry-run=client -o yaml | kubectl apply -f -
```

## Log Management

### Centralized Logging
- **Collection**: Fluent Bit or similar log collectors
- **Storage**: Elasticsearch or cloud-native logging service
- **Analysis**: Kibana or similar log analysis tools

### Log Retention Policies
- **Application Logs**: 30 days
- **Audit Logs**: 1 year
- **Debug Logs**: 7 days
- **Security Logs**: 1 year

### Log Analysis Commands
```bash
# Search for errors across all services
kubectl logs -l tier=backend --since=1h | grep -i error

# Analyze request patterns
kubectl logs -l app=bff --since=10m | grep "POST /api" | wc -l

# Check authentication failures
kubectl logs -l app=bff --since=1h | grep -i "auth.*fail"

# Monitor specific user actions
kubectl logs -l app=bff --since=30m | grep "user_id=12345"
```

## Performance Monitoring

### Application Performance Monitoring (APM)
- **Request tracing**: OpenTelemetry integration
- **Database queries**: Query performance analysis
- **External API calls**: Latency and error tracking
- **Memory and CPU profiling**: Resource usage optimization

### Performance Analysis
```bash
# Generate performance report
kubectl exec -it [pod-name] -- curl http://localhost:8080/metrics

# Analyze memory usage
kubectl top pod [pod-name] --containers

# Check CPU utilization trends
kubectl logs -l app=bff --since=1h | grep -o "cpu_usage_percent:[0-9]*" | sort -n
```

## Incident Management Integration

### Incident Classification
- **P0 (Critical)**: Service completely down, data loss risk
- **P1 (High)**: Major functionality impaired, performance degraded
- **P2 (Medium)**: Minor functionality issues, resource warnings
- **P3 (Low)**: Cosmetic issues, informational alerts

### Escalation Contacts
```yaml
escalation_policies:
  critical:
    primary: on-call-engineer@fluo.com
    secondary: senior-engineer@fluo.com
    manager: engineering-manager@fluo.com
  high:
    primary: on-call-engineer@fluo.com
    fallback: team-lead@fluo.com
  medium:
    primary: on-call-engineer@fluo.com
    defer_hours: 4
```

### Post-Incident Procedures
1. **Immediate**: Resolve the incident and restore service
2. **24 hours**: Complete incident report with timeline
3. **48 hours**: Root cause analysis and prevention measures
4. **1 week**: Implement preventive monitoring and alerts
5. **1 month**: Review effectiveness of implemented measures

## Maintenance and Optimization

### Regular Maintenance Tasks
- **Daily**: Review critical alerts and system health
- **Weekly**: Analyze performance trends and capacity planning
- **Monthly**: Update alert thresholds and dashboard configurations
- **Quarterly**: Review and optimize monitoring stack performance

### Monitoring Stack Health
```bash
# Check Prometheus health
curl http://prometheus.fluo-monitoring:9090/-/healthy

# Verify Grafana connectivity
curl http://fluo-grafana.localhost/api/health

# Test alert manager
curl http://alertmanager.fluo-monitoring:9093/-/healthy

# Monitor storage usage
kubectl get pv | grep prometheus
```

## Related Documents
- [SOP-001: Development Workflow](001-development-workflow.md)
- [SOP-002: Deployment Process](002-deployment-process.md)
- [SOP-003: Security Protocols](003-security-protocols.md)
- [SOP-005: Infrastructure Changes](005-infrastructure-changes.md)
- [ADR-004: Kubernetes-Native Infrastructure Architecture](../ADRs/004-kubernetes-native-infrastructure.md)