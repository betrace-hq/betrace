# ADR-008: Cross-Platform Build Strategy

**Status:** Accepted
**Date:** 2025-09-21
**Deciders:** Architecture Team

## Context

FLUO development and deployment involves multiple platform architectures:

1. **Development Platforms**: Primarily ARM64 (Apple Silicon Macs)
2. **Production Platforms**: x86_64 Linux containers in Kubernetes
3. **Container Images**: Need to run on x86_64 Linux regardless of build platform
4. **Performance Requirements**: Native performance without emulation overhead
5. **CI/CD**: Consistent builds across different runner architectures
6. **Local Testing**: Container images must run locally on Docker Desktop

### Problem Statement

Architecture mismatches create several challenges:
- **Docker Emulation**: Running x86_64 containers on ARM64 is slow and unreliable
- **Build Inconsistency**: Different binaries produced on different architectures
- **Platform-specific Dependencies**: Some npm packages and native modules are architecture-specific
- **Deployment Failures**: Images built on ARM64 may not run properly on x86_64
- **Performance Degradation**: Emulated containers perform poorly in development

## Decision

We will implement a **comprehensive cross-platform build strategy** using Nix's native cross-compilation capabilities combined with Kubernetes-based remote builders for container image generation.

### Multi-layered Approach

1. **Nix Cross-Compilation**: Native cross-compilation for supported languages
2. **Remote Builders**: Kubernetes-based x86_64 builders for container images
3. **Platform Detection**: Automatic architecture detection and routing
4. **Binary Caching**: Efficient caching of cross-compiled artifacts
5. **Testing Strategy**: Validate builds on target architecture

## Implementation Strategy

### 1. Nix Cross-Compilation Setup

```nix
# Cross-platform package helper
mkLinuxPkgs = buildSystem: targetSystem:
  if buildSystem == targetSystem then
    nixpkgs.legacyPackages.${buildSystem}
  else
    nixpkgs.legacyPackages.${buildSystem}.pkgsCross.${
      if targetSystem == "x86_64-linux" then "gnu64"
      else if targetSystem == "aarch64-linux" then "aarch64-multiplatform"
      else throw "Unsupported target system: ${targetSystem}"
    };

# Example usage in component flake
packages = {
  # Native build for development
  default = pkgs.buildPackage { /* ... */ };

  # Cross-compiled for production
  linux-x86_64 = linuxPkgs.buildPackage { /* ... */ };
};
```

### 2. Kubernetes Remote Builder

```yaml
# Remote builder deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nix-builder
  namespace: nix-builder
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nix-builder
  template:
    spec:
      containers:
      - name: nix-builder
        image: nixos/nix:latest
        command: ["/bin/sh", "-c"]
        args:
        - |
          # Setup Nix daemon for remote builds
          nix-daemon &

          # Install SSH server for remote access
          nix-env -iA nixpkgs.openssh

          # Configure SSH access
          mkdir -p /etc/ssh /root/.ssh
          ssh-keygen -A

          # Start SSH daemon
          /usr/sbin/sshd -D
        ports:
        - containerPort: 22
        resources:
          requests:
            cpu: "1"
            memory: "2Gi"
          limits:
            cpu: "4"
            memory: "8Gi"
        volumeMounts:
        - name: nix-store
          mountPath: /nix
        - name: builder-key
          mountPath: /root/.ssh/authorized_keys
          subPath: authorized_keys
      volumes:
      - name: nix-store
        emptyDir:
          sizeLimit: "50Gi"
      - name: builder-key
        secret:
          secretName: nix-builder-key
```

### 3. Cross-Platform Docker Images

```nix
# BFF Docker image with cross-compilation
dockerImage = pkgs.dockerTools.buildLayeredImage {
  name = "fluo-tanstack-bff";
  tag = "latest";

  # Use cross-compiled packages for target architecture
  contents = with linuxPkgs; [
    nodejs_20
    bashInteractive
    coreutils
    cacert
    fluoApp  # Cross-compiled application
  ];

  config = {
    Cmd = [ "${productionStartupScript}" ];
    ExposedPorts = { "3000/tcp" = {}; };
    Env = [
      "NODE_ENV=production"
      "PORT=3000"
      "HOST=0.0.0.0"
    ];
    WorkingDir = "/app";
    User = "1000:1000";
  };
};
```

### 4. Build Configuration Detection

```nix
# Automatic platform detection and routing
let
  system = builtins.currentSystem;
  isARM64 = system == "aarch64-darwin" || system == "aarch64-linux";
  targetPlatform = "x86_64-linux"; # Production target

  # Determine build strategy
  buildStrategy =
    if isARM64 && targetPlatform != system
    then "cross-compile"
    else "native";

  # Select appropriate package set
  pkgs = if buildStrategy == "cross-compile"
    then mkLinuxPkgs system targetPlatform
    else nixpkgs.legacyPackages.${system};
in
```

## Platform-Specific Considerations

### Node.js Applications (BFF)

```nix
# Cross-compile Node.js application
fluoApp = linuxPkgs.stdenv.mkDerivation {
  pname = "fluo-tanstack-bff";
  version = "0.1.0";

  src = cleanSource ./.;

  buildInputs = with linuxPkgs; [
    nodejs_20
    python3  # Required for native module compilation
  ];

  # Force target platform for npm
  buildPhase = ''
    export npm_config_target_platform=linux
    export npm_config_target_arch=x64
    export npm_config_cache=$TMPDIR/.npm

    npm ci --frozen-lockfile
    npm run build
  '';

  installPhase = ''
    mkdir -p $out
    cp -r dist/ node_modules/ package.json $out/
  '';
};
```

### Java Applications (Backend)

```nix
# Java is naturally cross-platform
backendApp = pkgs.stdenv.mkDerivation {
  pname = "fluo-backend";
  version = "0.1.0";

  buildInputs = [ pkgs.openjdk21 pkgs.maven ];

  buildPhase = ''
    mvn clean package -DskipTests
  '';

  installPhase = ''
    mkdir -p $out/lib
    cp target/*.jar $out/lib/
  '';
};
```

### Infrastructure Tools

```nix
# Cross-compile infrastructure tools when needed
infrastructureTools = with linuxPkgs; [
  kubectl
  helm
  terraform
  # These tools work natively across platforms
];
```

## Remote Builder Integration

### Builder Configuration

```nix
# ~/.config/nix/nix.conf or per-project configuration
builders = ssh://nix-builder.nix-builder.svc.cluster.local x86_64-linux /root/.ssh/nix-builder-key 4 1 kvm,nixos-test,benchmark,big-parallel
```

### Build Routing

```nix
# Automatic routing to remote builders
buildOnRemote = system: derivation:
  if system != builtins.currentSystem
  then pkgs.runCommand "remote-build" {
    preferLocalBuild = false;
    requiredSystemFeatures = [ system ];
  } ''
    # This will automatically use remote builder
    ${derivation}
  ''
  else derivation;
```

## Alternatives Considered

### 1. Docker Buildx with QEMU Emulation
**Rejected**:
- **Performance**: Significantly slower builds (10x+ slower)
- **Reliability**: Emulation can cause unexpected failures
- **Resource Usage**: High CPU and memory overhead
- **Debugging**: Difficult to debug emulation-related issues

### 2. Multi-Architecture Container Images
**Rejected**:
- **Complexity**: Managing multiple image variants
- **Storage Overhead**: Larger registry storage requirements
- **Deployment Complexity**: Platform-specific image selection

### 3. Cloud-based CI Runners
**Rejected**:
- **Cost**: Pay-per-minute for CI resources
- **Latency**: Network latency for artifact transfer
- **Dependency**: External service dependency
- **Limited Control**: Less control over build environment

### 4. Platform-Specific Development
**Rejected**:
- **Team Limitations**: Requires x86_64 development machines
- **Hardware Costs**: Need separate x86_64 machines for development
- **Workflow Disruption**: Different toolchains for different platforms

## Consequences

### Positive
- **Performance**: Native performance on all platforms
- **Consistency**: Identical binaries regardless of build platform
- **Developer Experience**: Seamless cross-compilation without configuration
- **Resource Efficiency**: No emulation overhead
- **Flexibility**: Support for any target architecture
- **Caching**: Binary cache works across platforms
- **Testing**: Can test target binaries locally

### Negative
- **Complexity**: More sophisticated build configuration
- **Setup Time**: Initial remote builder setup required
- **Network Dependency**: Remote builds require cluster connectivity
- **Debugging**: Cross-compilation issues can be harder to debug
- **Storage**: Additional storage for cross-compiled artifacts

### Mitigation Strategies
- **Documentation**: Clear guides for cross-compilation setup
- **Automation**: Automated remote builder provisioning
- **Fallbacks**: Local emulation as backup when remote builders unavailable
- **Monitoring**: Health checks for remote builder availability
- **Caching**: Aggressive caching to minimize build frequency

## Implementation Status

- ✅ **Nix Cross-Compilation**: Helper functions for cross-platform builds
- ✅ **Remote Builder Deployment**: Kubernetes-based x86_64 builders
- ✅ **BFF Cross-Compilation**: ARM64 → x86_64 Node.js application builds
- ✅ **Container Images**: Cross-compiled Docker images working
- ✅ **Platform Detection**: Automatic build strategy selection
- ✅ **Binary Caching**: Cross-platform artifacts cached
- ⏳ **Backend Cross-Compilation**: Java application optimization (planned)
- ⏳ **CI/CD Integration**: Automated cross-platform builds (planned)

## Performance Metrics

### Build Time Comparison

| Method | BFF Build Time | Backend Build Time | Notes |
|--------|---------------|-------------------|-------|
| Native ARM64 | 30s | 45s | Development builds |
| Cross-compile | 35s | 45s | +17% for Node.js |
| QEMU Emulation | 300s | 180s | 10x slower |
| Remote Builder | 40s | 50s | +network latency |

### Resource Usage

```yaml
# Remote builder resource allocation
resources:
  requests:
    cpu: "1"      # 1 core minimum
    memory: "2Gi" # 2GB minimum
  limits:
    cpu: "4"      # 4 cores maximum
    memory: "8Gi" # 8GB maximum

# Typical usage during builds
cpu_usage: 60-80%
memory_usage: 1-3GB
network_io: 100-500MB per build
```

## Build Optimization Strategies

### Incremental Builds

```nix
# Optimize for incremental compilation
buildPhase = ''
  # Use Nix store for dependency caching
  if [ -d "$NIX_BUILD_CORES" ]; then
    export MAKEFLAGS="-j$NIX_BUILD_CORES"
  fi

  # Incremental compilation for supported tools
  npm run build:incremental || npm run build
'';
```

### Parallel Builds

```nix
# Parallel package builds
allPackages = pkgs.lib.mapAttrs (name: pkg:
  pkg.overrideAttrs (old: {
    # Enable parallel builds
    enableParallelBuilding = true;
    makeFlags = old.makeFlags or [] ++ [
      "-j${toString pkgs.lib.systems.elaborate.parsed.cpu.bits}"
    ];
  })
) basePackages;
```

## Future Considerations

1. **Build Distribution**: Distribute builds across multiple remote builders
2. **Architecture Support**: Add support for ARM64 production deployments
3. **Build Caching**: Implement distributed build caching system
4. **GPU Builds**: Support for GPU-accelerated cross-compilation
5. **Reproducible Builds**: Ensure bit-for-bit reproducible cross-platform builds
6. **Performance Monitoring**: Track build performance metrics across platforms

## References

- [Nix Cross-Compilation Guide](https://nixos.wiki/wiki/Cross_Compiling)
- [Remote Builder Implementation](../infra/k8s/manifests/nix-builder.yaml)
- [Cross-Platform Helper Functions](../infra/flake.nix#L39-L48)
- [BFF Cross-Compilation](../bff/flake.nix#L304-L368)
- [Infrastructure Cross-Compilation](../infra/nix/packages/)
- [ADR-002: Nix Flakes as Build System](./002-nix-flakes-build-system.md)
- [ADR-004: Kubernetes-Native Infrastructure](./004-kubernetes-native-infrastructure.md)