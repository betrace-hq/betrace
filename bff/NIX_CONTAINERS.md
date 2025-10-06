# Nix-Built Container Images (No Docker Daemon Required)

This guide shows how to build and deploy FLUO Tanstack BFF container images using only Nix, without requiring a Docker daemon.

## Overview

Nix can build OCI-compliant container images that work with any container runtime (Docker, Podman, containerd, etc.) without requiring Docker to be installed or running during the build process.

## Quick Start

### 1. Build Container Image

```bash
# Build production image (no Docker daemon needed)
nix build .#docker

# The result is a compressed tarball containing the OCI image
ls -la result
# result -> /nix/store/xxx-fluo-tanstack-bff.tar.gz
```

### 2. Use with Podman (Recommended)

```bash
# Load image into Podman
podman load < result

# Run container
nix run .#run-with-podman
```

### 3. Use with Docker (if available)

```bash
# Load image into Docker
docker load < result

# Run container
docker run -p 3000:3000 --env-file .env.docker fluo-tanstack-bff:latest
```

## Detailed Usage

### Building Images

#### Production Image

```bash
# Build optimized production image
nix build .#docker

# Check what was built
nix run .#docker-info
```

#### Development Image

```bash
# Build lightweight development image
nix build .#docker-dev

# This creates a minimal image suitable for development
```

#### Standalone Application

```bash
# Build just the application without containerization
nix build .#app

# Result contains the built app with all dependencies
./result/start.sh  # Run directly on the host
```

### Container Deployment

#### Using Podman (No Docker Required)

Podman is a daemonless container engine that's compatible with Docker commands:

```bash
# Install Podman via Nix
nix-env -iA nixpkgs.podman

# Build and run in one command
nix run .#run-with-podman

# Or manually:
nix build .#docker
podman load < result
podman run -d --name fluo-frontend -p 3000:3000 --env-file .env.docker fluo-tanstack-bff:latest
```

#### Push to Registry (No Docker Daemon)

```bash
# Push to a container registry using skopeo
nix run .#push-to-registry registry.example.com/fluo latest docker

# Push development image
nix run .#push-to-registry registry.example.com/fluo dev docker-dev
```

#### Export for Transfer

```bash
# Export as compressed tarball
nix run .#export-image docker fluo-production.tar.gz

# Transfer to another machine and load
scp fluo-production.tar.gz remote-host:/tmp/
ssh remote-host "gunzip < /tmp/fluo-production.tar.gz | podman load"
```

### Advanced Usage

#### Image Inspection

```bash
# View image details
nix run .#docker-info

# Inspect image layers
skopeo inspect docker-archive:result

# List image contents
skopeo copy docker-archive:result dir:/tmp/image-contents
```

#### Custom Registry Authentication

```bash
# Login to registry (with Podman)
podman login registry.example.com

# Or with skopeo
skopeo login registry.example.com

# Then push
nix run .#push-to-registry registry.example.com/fluo latest
```

#### Multi-Architecture Builds

```bash
# Build for different architectures
nix build .#docker --system x86_64-linux
nix build .#docker --system aarch64-linux

# Create manifest for multi-arch
skopeo copy --all docker-archive:result-x86 docker://registry.example.com/fluo:latest-x86
skopeo copy --all docker-archive:result-arm docker://registry.example.com/fluo:latest-arm
```

## Environment Configuration

### Required Environment Variables

Create `.env.docker` with required configuration:

```bash
cp .env.docker.example .env.docker
# Edit with your values:
# - WORKOS_API_KEY
# - WORKOS_CLIENT_ID
# - WORKOS_REDIRECT_URI
# - JWT_SECRET
```

### Runtime Configuration

```bash
# Run with custom environment
podman run -d \
  --name fluo-frontend \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e WORKOS_API_KEY=your_key \
  -e WORKOS_CLIENT_ID=your_client_id \
  -e WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback \
  -e JWT_SECRET=your_jwt_secret \
  fluo-tanstack-bff:latest
```

## Container Runtimes

### Podman (Recommended)

Podman is daemonless and rootless by default:

```bash
# Install
nix-env -iA nixpkgs.podman

# Basic usage
podman run --rm -p 3000:3000 --env-file .env.docker fluo-tanstack-bff:latest

# Rootless containers
podman run --user 1000:1000 -p 3000:3000 --env-file .env.docker fluo-tanstack-bff:latest

# Systemd integration
podman generate systemd --new --name fluo-frontend > fluo-frontend.service
sudo cp fluo-frontend.service /etc/systemd/system/
sudo systemctl enable --now fluo-frontend
```

### containerd

```bash
# Install containerd
nix-env -iA nixpkgs.containerd

# Import image
ctr image import result

# Run container
ctr run --rm --net-host fluo-tanstack-bff:latest fluo-frontend
```

### Docker (if preferred)

```bash
# Standard Docker usage
docker load < result
docker run -d --name fluo-frontend -p 3000:3000 --env-file .env.docker fluo-tanstack-bff:latest
```

## Kubernetes Deployment

### Direct from Nix

```bash
# Build and push to registry
nix run .#push-to-registry your-registry.com/fluo latest

# Create Kubernetes deployment
kubectl create deployment fluo-frontend --image=your-registry.com/fluo:latest
kubectl expose deployment fluo-frontend --port=3000 --target-port=3000
```

### Helm Chart

```yaml
# values.yaml
image:
  repository: your-registry.com/fluo
  tag: latest
  pullPolicy: IfNotPresent

env:
  WORKOS_API_KEY: "your-key"
  WORKOS_CLIENT_ID: "your-client-id"
  WORKOS_REDIRECT_URI: "https://your-domain.com/auth/callback"
  JWT_SECRET: "your-secret"

service:
  type: ClusterIP
  port: 3000
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Build and Deploy
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: cachix/install-nix-action@v17
    - name: Build image
      run: nix build .#docker
    - name: Push to registry
      run: |
        nix-env -iA nixpkgs.skopeo
        skopeo copy docker-archive:result docker://ghcr.io/${{ github.repository }}:${{ github.sha }}
```

### GitLab CI

```yaml
build-image:
  image: nixos/nix
  script:
    - nix build .#docker
    - nix-env -iA nixpkgs.skopeo
    - skopeo copy docker-archive:result docker://$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

## Security Considerations

### Image Security

The Nix-built images include several security features:

- **Minimal attack surface**: Only necessary packages included
- **Non-root user**: Runs as user 1000:1000
- **Read-only layers**: Application code is immutable
- **No package manager**: Reduces attack vectors
- **Reproducible builds**: Same inputs always produce identical images

### Runtime Security

```bash
# Run with security constraints
podman run -d \
  --name fluo-frontend \
  --user 1000:1000 \
  --read-only \
  --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  -p 3000:3000 \
  --env-file .env.docker \
  fluo-tanstack-bff:latest
```

### Secrets Management

```bash
# Use secrets instead of environment files
podman secret create workos-key - < workos-key.txt
podman run -d \
  --secret workos-key \
  --name fluo-frontend \
  -p 3000:3000 \
  fluo-tanstack-bff:latest
```

## Troubleshooting

### Build Issues

```bash
# Check Nix evaluation
nix eval .#docker --show-trace

# Build with debug output
nix build .#docker --verbose

# Clean build cache
nix-collect-garbage -d
```

### Runtime Issues

```bash
# Inspect image contents
skopeo copy docker-archive:result dir:/tmp/image-debug
ls -la /tmp/image-debug/

# Run with debug shell
podman run -it --entrypoint /bin/bash fluo-tanstack-bff:latest

# Check logs
podman logs fluo-frontend

# Monitor resources
podman stats fluo-frontend
```

### Common Problems

1. **"Permission denied" errors**: Use `--user 1000:1000` or configure rootless containers
2. **"Port already in use"**: Change port mapping with `-p 3001:3000`
3. **Environment variables not set**: Verify `.env.docker` file exists and is readable
4. **Image not found**: Ensure the image was loaded: `podman images`

## Performance Optimization

### Build Performance

```bash
# Use binary cache
echo "substituters = https://cache.nixos.org https://nix-community.cachix.org" >> ~/.config/nix/nix.conf

# Parallel builds
echo "max-jobs = auto" >> ~/.config/nix/nix.conf

# Use flake inputs cache
nix flake update --commit-lock-file
```

### Runtime Performance

```bash
# Allocate resources
podman run -d \
  --memory=512m \
  --cpus=0.5 \
  --name fluo-frontend \
  -p 3000:3000 \
  --env-file .env.docker \
  fluo-tanstack-bff:latest

# Use volume for better I/O
podman volume create fluo-data
podman run -d \
  --mount type=volume,source=fluo-data,target=/app/data \
  --name fluo-frontend \
  -p 3000:3000 \
  --env-file .env.docker \
  fluo-tanstack-bff:latest
```

## Comparison: Nix vs Docker

| Feature | Nix-built Images | Traditional Docker |
|---------|------------------|-------------------|
| **Build Requirements** | Only Nix | Docker daemon |
| **Reproducibility** | ✅ Fully reproducible | ⚠️ Varies by base image |
| **Security** | ✅ Minimal attack surface | ⚠️ Depends on base image |
| **Size** | ✅ Optimized layers | ⚠️ Often includes unnecessary packages |
| **Caching** | ✅ Content-addressed | ⚠️ Layer-based |
| **Rollbacks** | ✅ Automatic with Nix | ❌ Manual process |
| **Multi-arch** | ✅ Native support | ⚠️ Requires buildx |

## Additional Resources

- [Nix Docker Tools Documentation](https://nixos.org/manual/nixpkgs/stable/#sec-pkgs-dockerTools)
- [Podman Documentation](https://docs.podman.io/)
- [Skopeo Documentation](https://github.com/containers/skopeo)
- [OCI Image Specification](https://github.com/opencontainers/image-spec)
- [Container Security Best Practices](https://sysdig.com/blog/dockerfile-best-practices/)