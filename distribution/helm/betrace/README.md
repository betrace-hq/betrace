# BeTrace Helm Chart

**Kubernetes deployment for BeTrace Behavioral Assurance System**

This Helm chart deploys BeTrace backend and Grafana with BeTrace plugin to Kubernetes. Per **ADR-011: Pure Application Framework**, this chart is an **external consumer** of BeTrace packages.

## Prerequisites

- Kubernetes 1.21+
- Helm 3.8+
- PV provisioner support (for Grafana persistence)

## Quick Start

### Install from GitHub Releases

```bash
# Add BeTrace Helm repository (once published)
helm repo add betrace https://betracehq.github.io/betrace
helm repo update

# Install BeTrace
helm install betrace betrace/betrace \
  --namespace betrace \
  --create-namespace
```

### Install from Source

```bash
# Clone repository
git clone https://github.com/betracehq/betrace
cd betrace/distribution/helm

# Install chart
helm install betrace ./betrace \
  --namespace betrace \
  --create-namespace
```

### Access Grafana

```bash
# Port-forward to Grafana
kubectl port-forward -n betrace svc/betrace-grafana 3000:3000

# Open browser
open http://localhost:3000

# Default credentials: admin/admin (CHANGE IN PRODUCTION)
```

## Configuration

### Key Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.enabled` | Enable BeTrace backend | `true` |
| `backend.image.repository` | Backend image repository | `ghcr.io/betracehq/betrace/backend` |
| `backend.image.tag` | Backend image tag | `latest` |
| `backend.replicaCount` | Number of backend replicas | `1` |
| `backend.resources.limits.cpu` | Backend CPU limit | `500m` |
| `backend.resources.limits.memory` | Backend memory limit | `512Mi` |
| `grafana.enabled` | Enable Grafana with plugin | `true` |
| `grafana.image.repository` | Grafana image repository | `grafana/grafana` |
| `grafana.image.tag` | Grafana image tag | `latest` |
| `grafana.plugin.enabled` | Install BeTrace plugin | `true` |
| `grafana.config.security.admin_password` | Grafana admin password | `admin` |
| `grafana.persistence.enabled` | Enable persistent storage | `true` |
| `grafana.persistence.size` | Storage size | `10Gi` |

### Full Configuration

See [values.yaml](values.yaml) for all available options.

### Custom Values

```bash
# Create custom values file
cat > custom-values.yaml <<EOF
backend:
  replicaCount: 3
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi

grafana:
  config:
    security:
      admin_password: "YOUR_SECURE_PASSWORD"
  persistence:
    size: 50Gi
  ingress:
    enabled: true
    hosts:
      - host: grafana.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: grafana-tls
        hosts:
          - grafana.example.com
EOF

# Install with custom values
helm install betrace ./betrace -f custom-values.yaml -n betrace --create-namespace
```

## BeTrace Plugin Installation

The chart uses an **init container pattern** to install the BeTrace Grafana plugin:

1. Init container runs `betrace-plugin-init:latest` image
2. Copies plugin files to shared volume
3. Grafana mounts volume at `/var/lib/grafana/plugins`
4. Plugin loaded on startup

**Architecture:**
```yaml
initContainers:
  - name: copy-betrace-plugin
    image: ghcr.io/betracehq/betrace/plugin-init:latest
    command: ["sh", "-c", "cp -r /plugin /grafana-plugins/betrace-app"]
    volumeMounts:
      - name: plugins
        mountPath: /grafana-plugins
```

## Integration with Official Grafana Helm Chart

If you're already using the [official Grafana Helm chart](https://github.com/grafana/helm-charts/tree/main/charts/grafana), you can add BeTrace plugin using init containers:

```yaml
# values.yaml for grafana/grafana chart
extraInitContainers:
  - name: install-betrace-plugin
    image: ghcr.io/betracehq/betrace/plugin-init:latest
    command: ["sh", "-c", "cp -r /plugin /grafana-plugins/betrace-app"]
    volumeMounts:
      - name: plugins
        mountPath: /grafana-plugins

extraVolumeMounts:
  - name: plugins
    mountPath: /var/lib/grafana/plugins

extraVolumes:
  - name: plugins
    emptyDir: {}

env:
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: "betrace-app"
```

Install Grafana with BeTrace:
```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana grafana/grafana -f values.yaml
```

## Observability Stack

### Deploy with Bundled Services

```yaml
# values.yaml
tempo:
  enabled: true

loki:
  enabled: true

prometheus:
  enabled: true

pyroscope:
  enabled: true
```

### Use External Services

```yaml
# values.yaml
backend:
  env:
    - name: OTEL_EXPORTER_OTLP_ENDPOINT
      value: "http://my-tempo.observability.svc:4317"
    - name: PYROSCOPE_SERVER_ADDRESS
      value: "http://my-pyroscope.observability.svc:4040"

grafana:
  datasources:
    - name: Tempo
      type: tempo
      url: http://my-tempo.observability.svc:3200
    - name: Loki
      type: loki
      url: http://my-loki.observability.svc:3100
```

## Upgrades

```bash
# Upgrade to new version
helm upgrade betrace betrace/betrace \
  --namespace betrace \
  --reuse-values \
  --set backend.image.tag=v2.1.0

# Rollback
helm rollback betrace -n betrace
```

## Uninstall

```bash
helm uninstall betrace -n betrace

# Delete namespace (if desired)
kubectl delete namespace betrace
```

## Troubleshooting

### Plugin Not Loading

**Symptom:** BeTrace plugin not visible in Grafana

**Check init container logs:**
```bash
kubectl logs -n betrace <grafana-pod> -c copy-betrace-plugin
```

**Verify plugin files:**
```bash
kubectl exec -n betrace <grafana-pod> -- ls -la /var/lib/grafana/plugins
```

**Check unsigned plugin env var:**
```bash
kubectl exec -n betrace <grafana-pod> -- env | grep UNSIGNED
```

### Backend Connection Failed

**Symptom:** Backend health check failing

**Check backend logs:**
```bash
kubectl logs -n betrace deployment/betrace-backend
```

**Test backend connectivity:**
```bash
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://betrace-backend:8080/health
```

### Persistent Storage Issues

**Symptom:** Grafana settings not persisting

**Check PVC status:**
```bash
kubectl get pvc -n betrace
kubectl describe pvc betrace-grafana-pvc -n betrace
```

## Production Checklist

- [ ] Change Grafana admin password
- [ ] Enable ingress with TLS
- [ ] Configure resource limits based on load testing
- [ ] Enable backup for persistent volumes
- [ ] Set up monitoring and alerting
- [ ] Use specific image tags (not `latest`)
- [ ] Configure pod security policies
- [ ] Enable network policies
- [ ] Set up RBAC appropriately

## See Also

- [Docker Distribution](../docker/README.md) - Docker Compose quick start
- [FlakeHub Publishing](../../.github/workflows/flakehub-publish.yml) - Nix distribution
- [Official Grafana Helm Chart](https://github.com/grafana/helm-charts/tree/main/charts/grafana)
- [ADR-011: Pure Application Framework](../../docs/adrs/011-pure-application-framework.md)
