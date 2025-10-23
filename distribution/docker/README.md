# BeTrace Docker Images

**External distribution target for BeTrace Pure Application Framework**

This directory contains Docker image definitions and orchestration configurations. Per **ADR-011: Pure Application Framework**, Docker images are **external consumers** of BeTrace packages, not part of the core application.

## Quick Start

### Prerequisites
- Docker installed
- Nix with flakes enabled
- BeTrace workspace built (`cd ../.. && nix build .#all`)

### Build Images

```bash
# Build all images
nix run .#build-all

# Or build individually
nix run .#build-backend   # Backend API only
nix run .#build-grafana   # Grafana with BeTrace plugin
```

### Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# Access services
# - Grafana: http://localhost:3000 (admin/admin)
# - FLUO Backend: http://localhost:8080
# - Prometheus: http://localhost:9090
# - Tempo: http://localhost:3200
```

## Available Images

### 1. `betrace-backend:latest`
BeTrace behavioral assurance backend (Go)

**Features:**
- Distroless base for security
- Multi-arch support (amd64, arm64)
- Health endpoint: `/health`
- Metrics endpoint: `/metrics`

**Environment Variables:**
- `PORT` - HTTP port (default: 8080)
- `OTEL_EXPORTER_OTLP_ENDPOINT` - Tempo endpoint (e.g., `http://tempo:4317`)
- `PYROSCOPE_SERVER_ADDRESS` - Pyroscope endpoint (e.g., `http://pyroscope:4040`)

**Usage:**
```bash
docker run -p 8080:8080 \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4317 \
  betrace-backend:latest
```

### 2. `betrace-grafana-plugin:latest`
Grafana with BeTrace plugin pre-installed

**Features:**
- Based on official Grafana image
- BeTrace app plugin included
- Pre-configured datasources (via provisioning)

**Environment Variables:**
- `GF_SECURITY_ADMIN_USER` - Admin username (default: admin)
- `GF_SECURITY_ADMIN_PASSWORD` - Admin password (default: admin)
- `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` - Required: `betrace-app`

**Usage:**
```bash
docker run -p 3000:3000 \
  -e GF_SECURITY_ADMIN_PASSWORD=secret \
  betrace-grafana-plugin:latest
```

### 3. `betrace-plugin-init:latest`
BeTrace plugin for use as Kubernetes init container

**Purpose:** Copy plugin files to Grafana plugins volume in Helm deployments

**Usage (Kubernetes):**
```yaml
initContainers:
  - name: copy-plugin
    image: betrace-plugin-init:latest
    command: ["cp", "-r", "/plugin", "/grafana-plugins/betrace-app"]
    volumeMounts:
      - name: plugins
        mountPath: /grafana-plugins
```

## Configuration Files

### `docker-compose.yml`
Complete BeTrace stack with observability services:
- BeTrace Backend
- Grafana with BeTrace plugin
- Tempo (traces)
- Loki (logs)
- Prometheus (metrics)
- Pyroscope (profiling)

### Observability Configuration
- `tempo-config.yaml` - Tempo configuration (OTLP receiver, storage)
- `prometheus.yml` - Prometheus scrape config (backend metrics)
- `provisioning/` - Grafana datasource provisioning

## Publishing Images

### GitHub Container Registry (GHCR)

Images are published to `ghcr.io/betracehq/betrace-*` via GitHub Actions.

**Workflow:** `.github/workflows/docker-publish.yml`

**Manual publish:**
```bash
# Build
nix build .#backend-docker

# Tag
docker tag betrace-backend:latest ghcr.io/betracehq/betrace-backend:v1.0.0

# Push
docker push ghcr.io/betracehq/betrace-backend:v1.0.0
```

## Multi-Architecture Builds

Images support both amd64 and arm64 platforms.

**Build multi-arch:**
```bash
# Requires Docker buildx
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/betracehq/betrace-backend:latest .
```

## ADR Compliance

This directory follows **ADR-011: Pure Application Framework**:

✅ **External Consumer Pattern**
- Docker images are consumers of BeTrace packages
- No Docker build logic in core application flakes
- Distribution logic separated from application logic

✅ **Package Consumption**
- Images use `betrace.packages.${system}.backend`
- No infrastructure coupling in core BeTrace

❌ **What This Is NOT**
- Not part of core BeTrace application
- Not required for development
- Not the only deployment method

## Development Workflow

### Local Testing
```bash
# Build images
nix run .#build-all

# Start stack
docker-compose up -d

# View logs
docker-compose logs -f betrace-backend

# Stop
docker-compose down
```

### Image Inspection
```bash
# List images
docker images | grep betrace

# Inspect image
docker inspect betrace-backend:latest

# Check layers
dive betrace-backend:latest
```

## Troubleshooting

### Plugin Not Loading in Grafana
**Symptom:** BeTrace plugin not visible in Grafana
**Fix:**
```bash
# Check unsigned plugin env var
docker exec betrace-grafana env | grep UNSIGNED

# Restart Grafana
docker-compose restart grafana
```

### Backend Cannot Connect to Tempo
**Symptom:** Traces not appearing in Tempo
**Fix:**
```bash
# Check network connectivity
docker exec betrace-backend curl tempo:4317

# Verify OTLP endpoint
docker inspect betrace-backend | grep OTEL_EXPORTER
```

## See Also

- [Helm Chart Deployment](../helm/README.md) - Kubernetes deployment
- [FlakeHub Publishing](../../.github/workflows/flakehub-publish.yml) - Nix flake distribution
- [ADR-011: Pure Application Framework](../../docs/adrs/011-pure-application-framework.md)
