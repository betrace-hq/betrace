# Container Build Architecture: Nix/Flox-First

**Date:** November 11, 2025
**Status:** 🚧 IN PROGRESS
**Approach:** Docker as Build Artifact (No Dockerfiles)

---

## Philosophy

**BeTrace uses a Nix/Flox-first approach to container builds:**

❌ **NOT This (Imperative):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/server.js"]
```

✅ **This (Declarative):**
```nix
pkgs.dockerTools.buildLayeredImage {
  name = "betrace-backend";
  tag = "latest";
  contents = [ backend-package ];
  config.Cmd = [ "${backend-package}/bin/betrace-backend" ];
}
```

---

## Core Principles

### 1. Pure Applications Export Packages

**Principle:** Applications export Nix packages, not Docker images.

**Implementation:**
```nix
# backend/flake.nix (application flake)
outputs = { nixpkgs, ... }: {
  packages.app = pkgs.buildGoModule {
    # Build configuration
  };
};
```

**Benefit:** Application is deployment-agnostic (works in VMs, containers, bare metal)

### 2. Root Flake Generates Deployment Artifacts

**Principle:** Root flake consumes application packages and generates deployment artifacts.

**Implementation:**
```nix
# flake.nix (root flake)
outputs = { betrace-backend, ... }: {
  packages.container-backend = pkgs.dockerTools.buildLayeredImage {
    contents = [ betrace-backend.packages.app ];
  };
};
```

**Benefit:** Separation of concerns (app build vs. deployment packaging)

### 3. No Dockerfiles, Ever

**Principle:** Use `pkgs.dockerTools` to generate OCI images declaratively.

**Why:**
- ✅ Reproducible builds (Nix guarantees)
- ✅ Layer caching optimization (automatic)
- ✅ No imperative steps (RUN commands)
- ✅ Security scanning (Nix packages are audited)
- ✅ Supply chain integrity (nix flake lock)

**Available Tools:**
- `dockerTools.buildImage` - Single-layer images (simple)
- `dockerTools.buildLayeredImage` - Multi-layer images (better caching)
- `dockerTools.streamLayeredImage` - Stream directly to Docker

### 4. Docker Compose as Generated Artifact

**Principle:** Generate `docker-compose.yaml` from Nix expressions.

**Implementation:**
```nix
# Generate docker-compose.yaml
pkgs.writeText "docker-compose.yaml" (builtins.toJSON {
  version = "3.8";
  services = {
    backend = {
      image = "betrace-backend:latest";
      ports = [ "12011:12011" ];
    };
  };
});
```

**Benefit:** Single source of truth (Nix), compose file always in sync

### 5. Flox Orchestrates Builds

**Principle:** Use Flox commands to trigger container builds.

**Implementation:**
```bash
flox build containers          # Build all OCI images
flox build containers.backend  # Build specific image
flox run deploy.local          # Deploy locally with docker-compose
```

**Benefit:** Consistent developer experience (same tool for dev and deploy)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Application Flakes (bff/, backend/, grafana-betrace-app/)      │
│  - Export pure packages (no deployment logic)                   │
│  - buildGoModule, buildNpmPackage, mkDerivation                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ inputs
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Root Flake (flake.nix)                                          │
│  - Imports application packages                                 │
│  - Generates OCI images with dockerTools                        │
│  - Generates docker-compose.yaml                                │
│  - Exposes packages.container-*                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ nix build
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ OCI Images (./result/)                                          │
│  - betrace-backend.tar.gz                                       │
│  - betrace-frontend.tar.gz                                      │
│  - betrace-observability.tar.gz (Grafana, Loki, Tempo, etc.)   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ docker load
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Docker Registry (Local or Remote)                              │
│  - betrace-backend:latest                                       │
│  - betrace-frontend:latest                                      │
│  - betrace-grafana:latest                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ docker-compose up
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Running Containers                                              │
│  - backend (Go API)                                             │
│  - frontend (Caddy serving static files)                        │
│  - grafana (Observability UI)                                   │
│  - loki, tempo, prometheus, pyroscope (Data sources)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Container Images

### 1. Backend Container

**Package:** `packages.container-backend`

**Base:** Minimal (only runtime dependencies)

**Contents:**
- `betrace-backend` binary
- CA certificates (for HTTPS)
- Timezone data
- No shell, no package manager

**Configuration:**
```nix
pkgs.dockerTools.buildLayeredImage {
  name = "betrace-backend";
  tag = "latest";

  contents = with pkgs; [
    betrace-backend.packages.app
    cacert
    tzdata
  ];

  config = {
    Cmd = [ "${betrace-backend.packages.app}/bin/betrace-backend" ];
    Env = [
      "PORT=12011"
      "OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4317"
    ];
    ExposedPorts = {
      "12011/tcp" = {};
    };
    WorkingDir = "/app";
  };
}
```

**Image Size:** ~50 MB (Go binary + minimal runtime)

### 2. Frontend Container

**Package:** `packages.container-frontend`

**Base:** Caddy (static file server)

**Contents:**
- Caddy binary
- Frontend static files (from bff/dist)
- Caddyfile configuration

**Configuration:**
```nix
pkgs.dockerTools.buildLayeredImage {
  name = "betrace-frontend";
  tag = "latest";

  contents = with pkgs; [
    caddy
    betrace-frontend.packages.app
    (pkgs.writeTextFile {
      name = "Caddyfile";
      text = ''
        :${toString ports.frontend} {
          root * ${betrace-frontend.packages.app}
          file_server
          try_files {path} /index.html
        }
      '';
    })
  ];

  config = {
    Cmd = [ "${pkgs.caddy}/bin/caddy" "run" "--config" "/Caddyfile" ];
    ExposedPorts = {
      "${toString ports.frontend}/tcp" = {};
    };
  };
}
```

**Image Size:** ~70 MB (Caddy + static files)

### 3. Grafana Container

**Package:** `packages.container-grafana`

**Base:** nixpkgs grafana package

**Contents:**
- Grafana binary
- BeTrace app plugin (from grafana-betrace-app)
- Datasource configurations (Loki, Tempo, Prometheus)
- Provisioning configs

**Configuration:**
```nix
pkgs.dockerTools.buildLayeredImage {
  name = "betrace-grafana";
  tag = "latest";

  contents = with pkgs; [
    grafana
    (pkgs.linkFarm "grafana-plugins" [
      {
        name = "betrace-app";
        path = betrace-grafana-plugin.packages.default;
      }
    ])
  ];

  config = {
    Cmd = [ "${pkgs.grafana}/bin/grafana-server" ];
    Env = [
      "GF_PATHS_PLUGINS=/grafana-plugins"
      "GF_SERVER_HTTP_PORT=${toString ports.grafana}"
    ];
    ExposedPorts = {
      "${toString ports.grafana}/tcp" = {};
    };
  };
}
```

**Image Size:** ~200 MB (Grafana + plugins)

### 4. Observability Stack Container

**Package:** `packages.container-observability`

**Approach:** Single multi-service container OR separate containers

**Option A: Single Container (Process Compose)**
```nix
pkgs.dockerTools.buildLayeredImage {
  name = "betrace-observability";
  tag = "latest";

  contents = with pkgs; [
    loki
    tempo
    prometheus
    pyroscope
    alloy
    process-compose
  ];

  config.Cmd = [ "${pkgs.process-compose}/bin/process-compose" "up" ];
}
```

**Option B: Separate Containers (Recommended)**
```nix
{
  container-loki = buildLayeredImage { ... };
  container-tempo = buildLayeredImage { ... };
  container-prometheus = buildLayeredImage { ... };
  container-pyroscope = buildLayeredImage { ... };
  container-alloy = buildLayeredImage { ... };
}
```

**Recommendation:** Option B (separate containers) for flexibility and resource isolation.

---

## Image Optimization Strategies

### 1. Layered Images for Caching

**Use `buildLayeredImage` instead of `buildImage`:**

```nix
# Good: Multi-layer with automatic optimization
buildLayeredImage {
  name = "betrace-backend";
  maxLayers = 100;  # Optimize for Docker layer cache
}

# Bad: Single layer (no caching benefit)
buildImage {
  name = "betrace-backend";
}
```

**Benefit:** Docker caches unchanged layers, faster rebuilds

### 2. Minimal Runtime Dependencies

**Only include what's needed at runtime:**

```nix
# Good: Minimal
contents = [
  backend-package
  cacert
  tzdata
];

# Bad: Includes build tools
contents = [
  backend-package
  go
  git
  gcc
];
```

**Benefit:** Smaller images, reduced attack surface

### 3. Multi-Stage Nix Builds

**Separate builder and runtime:**

```nix
let
  # Builder environment (not in final image)
  builder = pkgs.buildGoModule {
    pname = "betrace-backend";
    # Build configuration
  };

  # Runtime-only image
in pkgs.dockerTools.buildLayeredImage {
  contents = [ builder ];  # Only the built artifact
}
```

**Benefit:** No build tools in production image

### 4. Reproducible Layers

**Pin nixpkgs for deterministic builds:**

```nix
inputs.nixpkgs.url = "github:NixOS/nixpkgs/23.11";  # Specific version
```

**Benefit:** Same inputs = same outputs (bitwise reproducible)

---

## Docker Compose Generation

### Generated File Structure

**File:** `docker-compose.yaml` (generated, not checked in)

**Generator:** Nix expression that outputs YAML

**Implementation:**
```nix
# nix/docker-compose-generator.nix
{ pkgs, ports, ... }:

let
  composeConfig = {
    version = "3.8";

    services = {
      backend = {
        image = "betrace-backend:latest";
        ports = [ "${toString ports.backend}:${toString ports.backend}" ];
        environment = {
          PORT = toString ports.backend;
          OTEL_EXPORTER_OTLP_ENDPOINT = "http://alloy:4317";
        };
        depends_on = [ "loki" "tempo" "prometheus" ];
      };

      frontend = {
        image = "betrace-frontend:latest";
        ports = [ "${toString ports.frontend}:${toString ports.frontend}" ];
        depends_on = [ "backend" ];
      };

      grafana = {
        image = "betrace-grafana:latest";
        ports = [ "${toString ports.grafana}:${toString ports.grafana}" ];
        environment = {
          GF_PATHS_PLUGINS = "/grafana-plugins";
        };
        depends_on = [ "loki" "tempo" "prometheus" "pyroscope" ];
      };

      loki = {
        image = "grafana/loki:latest";
        ports = [ "${toString ports.loki}:${toString ports.loki}" ];
        volumes = [ "./configs/loki.yaml:/etc/loki/local-config.yaml" ];
      };

      tempo = {
        image = "grafana/tempo:latest";
        ports = [ "${toString ports.tempo}:${toString ports.tempo}" ];
        volumes = [ "./configs/tempo.yaml:/etc/tempo.yaml" ];
      };

      prometheus = {
        image = "prom/prometheus:latest";
        ports = [ "${toString ports.prometheus}:${toString ports.prometheus}" ];
        volumes = [ "./configs/prometheus.yaml:/etc/prometheus/prometheus.yml" ];
      };

      pyroscope = {
        image = "grafana/pyroscope:latest";
        ports = [ "${toString ports.pyroscope}:${toString ports.pyroscope}" ];
      };

      alloy = {
        image = "grafana/alloy:latest";
        ports = [
          "4317:4317"  # OTLP gRPC
          "4318:4318"  # OTLP HTTP
        ];
        volumes = [ "./configs/alloy.river:/etc/alloy/config.river" ];
      };
    };
  };

in pkgs.writeText "docker-compose.yaml" (builtins.toJSON composeConfig)
```

**Usage:**
```bash
nix build .#docker-compose
cp result docker-compose.yaml
docker-compose up -d
```

### Alternative: YAML Generation

**Using pkgs.formats.yaml:**
```nix
let
  yamlFormat = pkgs.formats.yaml {};
in yamlFormat.generate "docker-compose.yaml" composeConfig
```

---

## Flox Integration

### Build Commands

**Add to `.flox/env/manifest.toml`:**

```toml
[hook]
on-activate = """
  # Container build aliases
  alias flox-build-containers='nix build .#containers-all'
  alias flox-build-backend='nix build .#container-backend'
  alias flox-build-frontend='nix build .#container-frontend'
  alias flox-load-images='docker load < result'
  alias flox-deploy-local='docker-compose up -d'
"""
```

**Usage:**
```bash
flox activate
flox-build-containers    # Build all OCI images
flox-load-images         # Load into Docker
flox-deploy-local        # Deploy with docker-compose
```

### Service Integration

**Separate development and production:**

```toml
# Development: Native processes (current)
[services.backend]
command = "go run ./cmd/betrace-backend"

# Production: Containers (new)
[services.backend-container]
command = "docker run -p 12011:12011 betrace-backend:latest"
```

---

## Build Workflow

### Local Development (Current)

```bash
flox services start       # Start native processes
# Backend runs as: go run ./cmd/betrace-backend
# Grafana runs as: grafana-server --config ...
```

**No containers involved.**

### Container Build and Test

```bash
# 1. Build all container images
nix build .#containers-all

# 2. Load images into Docker
docker load < result/betrace-backend.tar.gz
docker load < result/betrace-frontend.tar.gz
docker load < result/betrace-grafana.tar.gz

# 3. Generate docker-compose.yaml
nix build .#docker-compose
cp result docker-compose.yaml

# 4. Deploy locally
docker-compose up -d

# 5. Test
curl http://localhost:12011/health
curl http://localhost:12015/api/health
```

### CI/CD Build

```yaml
# .github/workflows/build-containers.yaml
name: Build Containers

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: cachix/install-nix-action@v24
        with:
          nix_path: nixpkgs=channel:nixos-unstable

      - name: Build container images
        run: nix build .#containers-all

      - name: Load images
        run: |
          docker load < result/betrace-backend.tar.gz
          docker load < result/betrace-frontend.tar.gz

      - name: Push to registry
        run: |
          docker tag betrace-backend:latest ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
          docker push ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
```

---

## Security Considerations

### 1. Minimal Images

**Only include runtime dependencies:**
- ✅ Application binary
- ✅ CA certificates
- ✅ Timezone data
- ❌ No shell (sh, bash)
- ❌ No package manager (apk, apt)
- ❌ No build tools (gcc, go, npm)

**Benefit:** Reduced attack surface (no shell = no shell injection)

### 2. Non-Root User

**Run as unprivileged user:**
```nix
config = {
  User = "betrace";
  WorkingDir = "/app";
};
```

**Benefit:** Container breakout is less severe

### 3. Read-Only Root Filesystem

**Make / read-only:**
```nix
config.Volumes = {
  "/tmp" = {};
  "/var/tmp" = {};
};
```

**Benefit:** Immutable runtime (can't modify binaries)

### 4. Supply Chain Security

**Nix provides:**
- ✅ Input pinning (flake.lock)
- ✅ SHA256 verification (all inputs)
- ✅ Reproducible builds (same inputs = same outputs)
- ✅ No network access during build

**Benefit:** No supply chain attacks (tarball substitution, etc.)

---

## Testing Strategy

### 1. Image Build Tests

**Test that images build successfully:**
```bash
nix build .#container-backend
nix build .#container-frontend
nix build .#container-grafana
```

**Expected:** Exit code 0, `./result/` contains `.tar.gz` files

### 2. Image Load Tests

**Test that images load into Docker:**
```bash
docker load < result/betrace-backend.tar.gz
docker images | grep betrace-backend
```

**Expected:** Image appears in `docker images` list

### 3. Container Smoke Tests

**Test that containers start and respond:**
```bash
docker run -d --name betrace-backend -p 12011:12011 betrace-backend:latest
sleep 5
curl http://localhost:12011/health
docker stop betrace-backend
```

**Expected:** HTTP 200, container stops cleanly

### 4. Integration Tests

**Test full stack with docker-compose:**
```bash
docker-compose up -d
sleep 10

# Test backend
curl http://localhost:12011/health

# Test Grafana
curl http://localhost:12015/api/health

# Test observability stack
curl http://localhost:3100/ready  # Loki
curl http://localhost:3200/ready  # Tempo
curl http://localhost:9090/-/ready  # Prometheus

docker-compose down
```

**Expected:** All services healthy

---

## Performance Metrics

### Image Sizes (Estimated)

| Image | Layers | Size | Base |
|-------|--------|------|------|
| betrace-backend | ~10 | 50 MB | Minimal (Go binary only) |
| betrace-frontend | ~15 | 70 MB | Caddy + static files |
| betrace-grafana | ~20 | 200 MB | Grafana + plugins |
| loki | ~15 | 150 MB | Official image |
| tempo | ~15 | 120 MB | Official image |
| prometheus | ~15 | 180 MB | Official image |
| pyroscope | ~15 | 140 MB | Official image |
| alloy | ~15 | 130 MB | Official image |

**Total Stack:** ~1.1 GB (all images loaded)

### Build Times (Estimated)

| Operation | Time (Cold) | Time (Warm Cache) |
|-----------|-------------|-------------------|
| nix build .#container-backend | 30s | 5s |
| nix build .#container-frontend | 45s | 5s |
| nix build .#container-grafana | 60s | 5s |
| nix build .#containers-all | 2m | 15s |
| docker load (all images) | 30s | 30s |
| docker-compose up | 20s | 10s |

**Total cold build + deploy:** ~3-4 minutes
**Total warm build + deploy:** ~1 minute

---

## Comparison: Nix vs. Dockerfile

### Dockerfile Approach (NOT Used)

**Pros:**
- Familiar to most developers
- Lots of examples and tutorials
- Supported by all CI/CD platforms

**Cons:**
- ❌ Imperative (hard to reason about)
- ❌ Non-reproducible (same Dockerfile ≠ same image)
- ❌ No layer optimization (manual COPY ordering)
- ❌ Build cache fragile (change one line = rebuild from there)
- ❌ Multi-stage builds verbose
- ❌ Security scanning separate step

### Nix dockerTools Approach (Used)

**Pros:**
- ✅ Declarative (what, not how)
- ✅ Reproducible (same inputs = same outputs)
- ✅ Automatic layer optimization
- ✅ Build cache robust (Nix handles dependencies)
- ✅ Multi-stage builds natural (separate derivations)
- ✅ Security built-in (input pinning, SHA verification)

**Cons:**
- Steeper learning curve for Dockerfile users
- Fewer examples (less common approach)
- Requires Nix installed on build machines

**Verdict:** **Use Nix** (benefits outweigh learning curve)

---

## File Structure

```
betrace/
├── flake.nix                          # Root flake (imports containers.nix)
├── nix/
│   ├── containers.nix                 # OCI image definitions
│   ├── docker-compose-generator.nix   # Generate docker-compose.yaml
│   └── container-configs/             # Container-specific configs
│       ├── grafana.ini
│       ├── loki.yaml
│       ├── tempo.yaml
│       └── ...
├── .flox/
│   └── env/
│       └── manifest.toml              # Flox build commands
├── docs/
│   ├── CONTAINER_BUILD_ARCHITECTURE.md  # This file
│   └── DEPLOYMENT_GUIDE.md              # How to deploy (future)
└── result/                            # Build outputs (gitignored)
    ├── betrace-backend.tar.gz
    ├── betrace-frontend.tar.gz
    ├── betrace-grafana.tar.gz
    └── docker-compose.yaml
```

---

## Next Steps

### Phase 1: Core Images ✅ (This Session)
- [x] Design architecture
- [ ] Implement `nix/containers.nix`
- [ ] Add container packages to `flake.nix`
- [ ] Build backend OCI image
- [ ] Build frontend OCI image
- [ ] Test image loading

### Phase 2: Observability Stack
- [ ] Build Grafana OCI image with BeTrace plugin
- [ ] Configure Loki, Tempo, Prometheus, Pyroscope
- [ ] Generate docker-compose.yaml from Nix

### Phase 3: Integration Testing
- [ ] Container smoke tests
- [ ] Full stack integration tests
- [ ] CI/CD pipeline for container builds

### Phase 4: Documentation
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Migration guide (native → containers)

---

## References

- [Nix dockerTools Documentation](https://nixos.org/manual/nixpkgs/stable/#sec-pkgs-dockerTools)
- [ADR-022: Grafana-First Architecture](../docs/adrs/022-grafana-first-architecture.md)
- [ADR-027: Phase Out BFF](../docs/adrs/027-phase-out-bff-for-grafana.md)
- [Flox Documentation](https://flox.dev/docs)

---

*Generated: November 11, 2025*
*Status: 🚧 IN PROGRESS*
*Approach: Nix/Flox-First, Docker as Build Artifact*
