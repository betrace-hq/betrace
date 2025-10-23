# FLUO Docker Compose Quick Start

Get FLUO running locally with Docker Compose in under 5 minutes.

## Prerequisites

- Docker 20.10+ with Docker Compose
- 4GB RAM available
- 10GB disk space

## Quick Start

### Step 1: Build Docker Images

```bash
cd distribution/docker

# Build all FLUO images with Nix
nix run .#build-all

# Verify images
docker images | grep fluo
```

Expected output:
```
fluo-backend                latest    abc123    2 minutes ago   150MB
fluo-grafana-plugin         latest    def456    1 minute ago    500MB
fluo-plugin-init            latest    ghi789    30 seconds ago  100MB
```

### Step 2: Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Step 3: Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | http://localhost:3000 | admin/admin |
| **FLUO Backend** | http://localhost:8080 | - |
| **Prometheus** | http://localhost:9090 | - |
| **Tempo** | http://localhost:3200 | - |
| **Loki** | http://localhost:3100 | - |
| **Pyroscope** | http://localhost:4040 | - |

### Step 4: Access BeTrace Plugin

1. Open Grafana: http://localhost:3000
2. Login with admin/admin
3. Navigate to **Apps → BeTrace**
4. Start creating trace pattern rules!

## Services Overview

### FLUO Backend
- **Port:** 8080
- **Health Check:** http://localhost:8080/health
- **Metrics:** http://localhost:8080/metrics
- **Sends traces to:** Tempo (port 4317)
- **Sends profiles to:** Pyroscope (port 4040)

### Grafana
- **Port:** 3000
- **BeTrace Plugin:** Pre-installed via Docker image
- **Datasources:** Auto-provisioned (Tempo, Loki, Prometheus)

### Observability Stack
- **Tempo:** Distributed trace storage
- **Loki:** Log aggregation
- **Prometheus:** Metrics storage
- **Pyroscope:** Continuous profiling

## Configuration

### Environment Variables

Edit `docker-compose.yml` to customize:

```yaml
services:
  fluo-backend:
    environment:
      - PORT=8080
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4317
      - PYROSCOPE_SERVER_ADDRESS=http://pyroscope:4040
      # Add custom env vars here
```

### Grafana Configuration

```yaml
services:
  grafana:
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=YOUR_SECURE_PASSWORD
      - GF_AUTH_ANONYMOUS_ENABLED=false  # Disable for production
```

### Resource Limits

```yaml
services:
  fluo-backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Common Tasks

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f fluo-backend

# Last 100 lines
docker-compose logs --tail=100 grafana
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart fluo-backend
```

### Stop Services

```bash
# Stop (preserves data)
docker-compose stop

# Stop and remove containers (preserves volumes)
docker-compose down

# Nuclear option: remove everything including volumes
docker-compose down -v
```

### Update Images

```bash
# Rebuild images with Nix
nix run .#build-all

# Recreate containers
docker-compose up -d --force-recreate
```

## Testing the Stack

### 1. Health Checks

```bash
# Backend health
curl http://localhost:8080/health

# Grafana health
curl http://localhost:3000/api/health

# Prometheus targets
curl http://localhost:9090/api/v1/targets
```

### 2. Send Test Trace

```bash
# Using OTLP HTTP endpoint
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [{
      "resource": {
        "attributes": [{
          "key": "service.name",
          "value": {"stringValue": "test-service"}
        }]
      },
      "scopeSpans": [{
        "spans": [{
          "traceId": "5B8EFFF798038103D269B633813FC60C",
          "spanId": "EEE19B7EC3C1B173",
          "name": "test-span",
          "startTimeUnixNano": "1544712660000000000",
          "endTimeUnixNano": "1544712661000000000",
          "attributes": [{
            "key": "http.method",
            "value": {"stringValue": "GET"}
          }]
        }]
      }]
    }]
  }'
```

### 3. Query Trace in Grafana

1. Open Grafana → Explore
2. Select **Tempo** datasource
3. Search for trace ID: `5B8EFFF798038103D269B633813FC60C`
4. Should see test span

### 4. Create BeTrace Rule

1. Open Grafana → Apps → BeTrace
2. Click "Create Rule"
3. Enter DSL:
   ```
   trace.has(http.method == "GET")
   ```
4. Save rule
5. Test with sample trace

## Troubleshooting

### BeTrace Plugin Not Loading

**Symptom:** Plugin not visible in Grafana Apps

**Solution:**
```bash
# Check Grafana logs
docker-compose logs grafana | grep -i plugin

# Verify unsigned plugins env var
docker exec fluo-grafana env | grep UNSIGNED

# Should see:
# GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=betrace-app

# Restart Grafana
docker-compose restart grafana
```

### Backend Cannot Connect to Tempo

**Symptom:** Traces not appearing in Tempo

**Solution:**
```bash
# Test connectivity from backend container
docker exec fluo-backend sh -c 'apk add curl && curl tempo:4317'

# Check backend logs
docker-compose logs fluo-backend | grep -i tempo

# Verify Tempo is running
docker-compose ps tempo
```

### Port Already in Use

**Symptom:** Error: `bind: address already in use`

**Solution:**
```bash
# Find process using port
lsof -i :3000  # Replace with your port

# Kill process or change port in docker-compose.yml
ports:
  - "3001:3000"  # Map to different host port
```

### Out of Disk Space

**Symptom:** Container creation fails

**Solution:**
```bash
# Clean up Docker resources
docker system prune -a --volumes

# Check disk usage
docker system df

# Remove old images
docker images | grep months
docker rmi <image-id>
```

## Data Persistence

Volumes created by Docker Compose:

| Volume | Purpose | Size (Typical) |
|--------|---------|----------------|
| `grafana-data` | Grafana dashboards, settings | 100MB |
| `tempo-data` | Trace storage | 1-10GB |
| `loki-data` | Log storage | 500MB-5GB |
| `prometheus-data` | Metrics storage | 1-5GB |
| `pyroscope-data` | Profile data | 500MB-2GB |

### Backup Data

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup volumes
docker run --rm \
  -v docker_grafana-data:/data \
  -v $(pwd)/backups/$(date +%Y%m%d):/backup \
  alpine tar czf /backup/grafana-data.tar.gz -C /data .

# Repeat for other volumes
```

### Restore Data

```bash
# Stop services
docker-compose down

# Restore volume
docker run --rm \
  -v docker_grafana-data:/data \
  -v $(pwd)/backups/20250123:/backup \
  alpine tar xzf /backup/grafana-data.tar.gz -C /data

# Start services
docker-compose up -d
```

## Production Considerations

**⚠️ This Docker Compose setup is for LOCAL DEVELOPMENT ONLY**

For production, use:
- [Kubernetes Helm Chart](../helm/fluo/README.md)
- Managed Grafana (Grafana Cloud)
- Separate observability infrastructure
- Secrets management (not env vars)
- TLS/SSL certificates
- Resource limits and quotas
- High availability (3+ replicas)
- Monitoring and alerting

## Next Steps

- **Create Rules:** Use BeTrace plugin to define trace patterns
- **Explore Traces:** Use Grafana Explore with Tempo datasource
- **View Metrics:** Check Prometheus for backend metrics
- **Read Logs:** Use Loki to correlate logs with traces
- **Profile Performance:** Use Pyroscope to analyze CPU/memory

## See Also

- [Kubernetes Helm Chart](../helm/fluo/README.md)
- [Grafana Helm Integration](grafana-helm-integration.md)
- [FLUO Docker Images](../docker/README.md)
- [BeTrace Plugin Development](../../grafana-betrace-app/README.md)
