# ADR-009: Modular Configuration Management

**Status:** Accepted
**Date:** 2025-09-21
**Deciders:** Architecture Team

## Context

BeTrace components require sophisticated configuration management that balances:

1. **Version Management**: Easy updates to service versions (NATS 2.10.4 → 2.10.5)
2. **Environment Customization**: Different settings for dev/staging/production
3. **Deployment Scaling**: Size-based configurations (small/medium/large)
4. **Service Discovery**: Network endpoints and connection strings
5. **Security Configuration**: Authentication, authorization, and secrets
6. **Maintainability**: Clear, documented configuration structure
7. **Type Safety**: Compile-time validation of configuration values

### Problem Statement

Traditional configuration approaches suffer from:
- **Scattered Configuration**: Settings spread across multiple files and formats
- **Version Drift**: Inconsistent versions across environments
- **Hard-coded Values**: Network endpoints and resource limits embedded in code
- **Environment Inconsistency**: Different configuration patterns per environment
- **Validation Gaps**: Runtime errors from invalid configuration
- **Update Complexity**: Changing versions requires multiple file modifications

## Decision

We will implement **modular configuration management** using Nix expressions that separate concerns into focused modules with clear interfaces and composition patterns.

### Configuration Architecture

Each component uses a standardized `lib/` directory structure:

```
components/[service]/lib/
├── config.nix         # Version and base configuration
├── kubernetes.nix     # Kubernetes resource generation
├── packages.nix       # Container images and dependencies
└── overlays.nix       # Environment-specific overrides (optional)
```

### Configuration Flow

```
config.nix (base) → overlays.nix (env) → kubernetes.nix (K8s) → manifests.yaml
```

## Implementation Pattern

### 1. Base Configuration Module

```nix
# components/nats/lib/config.nix
{ lib }:

rec {
  # Version configuration - SINGLE SOURCE OF TRUTH
  natsVersion = "2.10.4";
  natsVariant = "alpine";
  natsImage = "nats:${natsVersion}-${natsVariant}";

  # Default configuration that can be overridden
  defaultConfig = {
    namespace = "fluo-queue";
    name = "nats";
    replicas = 3;

    # Resource configurations by deployment size
    resources = {
      small = {
        requests = { memory = "256Mi"; cpu = "100m"; };
        limits = { memory = "512Mi"; cpu = "250m"; };
      };
      medium = {
        requests = { memory = "512Mi"; cpu = "250m"; };
        limits = { memory = "1Gi"; cpu = "500m"; };
      };
      large = {
        requests = { memory = "1Gi"; cpu = "500m"; };
        limits = { memory = "2Gi"; cpu = "1"; };
      };
    };

    # Network configuration
    ports = {
      client = 4222;
      cluster = 6222;
      monitor = 8222;
      leafnode = 7422;
    };

    # Feature flags
    features = {
      jetstream = true;
      clustering = true;
      monitoring = true;
      tls = false;
    };
  };

  # Size-based deployment overlays
  sizeOverlays = {
    small = {
      replicas = 1;
      resources = defaultConfig.resources.small;
      features.clustering = false;
    };

    medium = {
      replicas = 3;
      resources = defaultConfig.resources.medium;
    };

    large = {
      replicas = 5;
      resources = defaultConfig.resources.large;
      features.tls = true;
    };
  };
}
```

### 2. Kubernetes Resource Generation

```nix
# components/nats/lib/kubernetes.nix
{ lib }:

{
  # Function that takes config and generates K8s resources
  mkKubernetesManifests = config: {

    deployment = {
      apiVersion = "apps/v1";
      kind = "Deployment";
      metadata = {
        name = config.name;
        namespace = config.namespace;
      };
      spec = {
        replicas = config.replicas;
        selector.matchLabels."app.kubernetes.io/name" = config.name;
        template = {
          metadata.labels."app.kubernetes.io/name" = config.name;
          spec = {
            containers = [{
              name = config.name;
              image = config.image;
              ports = lib.mapAttrsToList (name: port: {
                containerPort = port;
                name = name;
              }) config.ports;
              resources = config.resources;

              # Conditional features based on config
              env = lib.optionals config.features.jetstream [
                { name = "NATS_JETSTREAM"; value = "true"; }
              ] ++ lib.optionals config.features.clustering [
                { name = "NATS_CLUSTER"; value = "true"; }
              ];
            }];
          };
        };
      };
    };

    service = {
      apiVersion = "v1";
      kind = "Service";
      metadata = {
        name = config.name;
        namespace = config.namespace;
      };
      spec = {
        selector."app.kubernetes.io/name" = config.name;
        ports = lib.mapAttrsToList (name: port: {
          inherit name port;
          protocol = "TCP";
        }) config.ports;
      };
    };
  };
}
```

### 3. Package Management

```nix
# components/nats/lib/packages.nix
{ pkgs, natsImage }:

{
  # Container image based on config
  docker = pkgs.dockerTools.pullImage {
    imageName = "nats";
    imageDigest = "sha256:..."; # Pinned digest for reproducibility
    sha256 = "...";
  };

  # CLI tools for management
  nats-cli = pkgs.natscli;

  # Configuration files
  nats-config = pkgs.writeText "nats.conf" ''
    # Generated NATS configuration
    port: 4222
    monitor_port: 8222
    # ... other config
  '';
}
```

### 4. Configuration Composition

```nix
# components/nats/flake.nix - Bringing it all together
let
  configModule = import ./lib/config.nix { inherit lib; };
  kubernetesModule = import ./lib/kubernetes.nix { inherit lib; };
  packagesModule = import ./lib/packages.nix {
    inherit pkgs;
    natsImage = configModule.natsImage;
  };

  # Function to create manifests with overlay
  mkManifestsWithOverlay = overlay:
    let config = lib.recursiveUpdate configModule.defaultConfig overlay;
    in kubernetesModule.mkKubernetesManifests config;

in {
  # System-independent outputs
  lib = {
    inherit (kubernetesModule) mkKubernetesManifests;
    inherit (configModule) defaultConfig sizeOverlays;

    # Pre-configured deployments
    manifests = kubernetesModule.mkKubernetesManifests configModule.defaultConfig;
  };

  # Size-based configurations
  configs = configModule.sizeOverlays;

  # Manifests for each size
  manifests = {
    small = mkManifestsWithOverlay configModule.sizeOverlays.small;
    medium = mkManifestsWithOverlay configModule.sizeOverlays.medium;
    large = mkManifestsWithOverlay configModule.sizeOverlays.large;
  };
}
```

## Configuration Usage Patterns

### 1. Version Updates

To update NATS from 2.10.4 to 2.10.5:

```nix
# Only change needed in config.nix
natsVersion = "2.10.5";  # Changed from "2.10.4"
```

All deployments automatically use the new version.

### 2. Environment-Specific Overrides

```nix
# Infrastructure flake can override per environment
productionNATS = nats.lib.mkKubernetesManifests (
  lib.recursiveUpdate nats.lib.defaultConfig {
    replicas = 5;
    resources = nats.lib.defaultConfig.resources.large;
    features.tls = true;
    features.monitoring = true;
  }
);

developmentNATS = nats.lib.mkKubernetesManifests (
  lib.recursiveUpdate nats.lib.defaultConfig {
    replicas = 1;
    resources = nats.lib.defaultConfig.resources.small;
    features.clustering = false;
  }
);
```

### 3. Custom Configurations

```nix
# Specialized configuration for specific use case
highThroughputNATS = nats.lib.mkKubernetesManifests {
  name = "nats-ht";
  namespace = "high-throughput";
  replicas = 7;
  resources = {
    requests = { memory = "2Gi"; cpu = "1"; };
    limits = { memory = "4Gi"; cpu = "2"; };
  };
  features = {
    jetstream = true;
    clustering = true;
    monitoring = true;
    tls = true;
  };
}
```

## Alternatives Considered

### 1. ConfigMaps and Secrets
**Rejected**:
- **No Type Safety**: Runtime errors from invalid configuration
- **No Composition**: Difficult to layer configurations
- **Manual Management**: No automatic version propagation
- **Limited Logic**: Cannot express conditional configuration

### 2. Helm Values Files
**Rejected**:
- **YAML Limitations**: Limited expression capabilities
- **Template Complexity**: Complicated template logic
- **No Compile-time Validation**: Errors discovered at runtime
- **Versioning Complexity**: Multiple values files to maintain

### 3. Jsonnet/Dhall Configuration Languages
**Rejected**:
- **Additional Toolchain**: Another language to learn and maintain
- **Limited Ecosystem**: Fewer libraries and tools
- **Integration Complexity**: Extra build steps
- **Nix Integration**: Would duplicate Nix capabilities

### 4. Environment Variables
**Rejected**:
- **No Structure**: Flat namespace, no hierarchical configuration
- **Type Safety**: All values are strings
- **Documentation**: Hard to document expected variables
- **Composition**: Cannot layer or merge configurations

## Consequences

### Positive
- **Single Source of Truth**: Versions defined once, used everywhere
- **Type Safety**: Nix validates configuration at build time
- **Composition**: Easy to layer environment-specific overrides
- **Documentation**: Configuration is self-documenting through Nix
- **Testability**: Can test configuration generation in isolation
- **Maintainability**: Clear separation of concerns
- **Reusability**: Configuration patterns can be shared across components

### Negative
- **Learning Curve**: Team needs to understand Nix configuration patterns
- **Complexity**: More sophisticated than simple YAML files
- **Abstraction**: May hide underlying Kubernetes concepts
- **Debugging**: Configuration errors can be harder to trace

### Mitigation Strategies
- **Documentation**: Comprehensive examples and patterns
- **Templates**: Standard configuration templates for new components
- **Validation**: Automated testing of configuration generation
- **Tooling**: Helper scripts for common configuration tasks
- **Training**: Team workshops on configuration patterns

## Implementation Status

- ✅ **NATS Configuration**: Complete modular structure implemented
- ✅ **Size-based Overlays**: Small/medium/large deployment configurations
- ✅ **Version Management**: Single source of truth for NATS version
- ✅ **Resource Configuration**: Environment-specific resource allocation
- ✅ **Feature Flags**: Conditional feature enablement
- ✅ **BFF Configuration**: Service-owned deployment configuration
- ⏳ **Backend Configuration**: Java/Quarkus configuration module (planned)
- ⏳ **Cross-Component**: Shared configuration patterns (planned)

## Configuration Best Practices

### 1. Naming Conventions

```nix
# Clear, hierarchical naming
config = {
  service = {
    name = "nats";
    version = "2.10.4";
    image = "nats:${version}-alpine";
  };

  deployment = {
    replicas = 3;
    strategy = "RollingUpdate";
  };

  networking = {
    ports = { /* ... */ };
    ingress = { /* ... */ };
  };

  security = {
    authentication = true;
    tls = false;
  };
};
```

### 2. Validation Functions

```nix
# Built-in validation
validateConfig = config:
  assert lib.assertMsg (config.replicas > 0) "Replicas must be positive";
  assert lib.assertMsg (config.resources.requests.memory != null) "Memory requests required";
  config;
```

### 3. Default Inheritance

```nix
# Sensible defaults with override capability
mkConfig = overrides:
  lib.recursiveUpdate {
    # Sensible defaults
    replicas = 1;
    resources.requests.memory = "256Mi";
    features.monitoring = true;
  } overrides;
```

## Configuration Testing

### Unit Tests

```nix
# Test configuration generation
tests = {
  "default config generates valid k8s" =
    let manifests = mkKubernetesManifests defaultConfig;
    in assert manifests.deployment.spec.replicas == 3; true;

  "small overlay reduces replicas" =
    let manifests = mkKubernetesManifests (defaultConfig // sizeOverlays.small);
    in assert manifests.deployment.spec.replicas == 1; true;
};
```

### Integration Tests

```bash
# Validate generated manifests
nix build .#manifests.small
kubectl apply --dry-run=client -f result

# Test configuration composition
nix eval .#configs.medium --json | jq '.replicas == 3'
```

## Future Considerations

1. **Configuration Schema**: Formal schema validation for configurations
2. **Dynamic Configuration**: Runtime configuration updates without restart
3. **Configuration Drift Detection**: Monitoring for configuration changes
4. **Multi-Environment**: Standardized patterns for env-specific config
5. **Secret Management**: Integration with external secret providers
6. **Configuration Auditing**: Track configuration changes over time

## References

- [NATS Configuration Module](../infra/components/nats/lib/config.nix)
- [NATS Kubernetes Module](../infra/components/nats/lib/kubernetes.nix)
- [BFF Service-Owned Configuration](../bff/flake.nix#L29-L210)
- [Component Structure Example](../infra/components/nats/)
- [ADR-001: Service-Owned Deployment Modules](./001-service-owned-deployment-modules.md)
- [ADR-005: Component-Based Infrastructure](./005-component-based-infrastructure.md)
- [ADR-002: Nix Flakes as Build System](./002-nix-flakes-build-system.md)