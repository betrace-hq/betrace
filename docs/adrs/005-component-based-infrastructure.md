# ADR-005: Component-Based Infrastructure Modules

**Status:** Accepted
**Date:** 2025-09-21
**Deciders:** Architecture Team

## Context

BeTrace infrastructure consists of multiple interconnected services that need to be deployed to Kubernetes:

1. **Application Services**: BFF, Backend, Workers
2. **Infrastructure Services**: NATS, Prometheus, Grafana, AlertManager
3. **Platform Services**: Ingress controllers, cert-manager, operators

Each service has unique requirements for configuration, scaling, monitoring, and dependencies, but they need to work together as a cohesive system.

### Problem Statement

Monolithic infrastructure approaches lead to:
- **Tight Coupling**: Changes to one service affect others unnecessarily
- **Testing Difficulty**: Cannot test individual components in isolation
- **Reusability Issues**: Cannot easily reuse components across environments
- **Scaling Complexity**: All-or-nothing deployment and scaling decisions
- **Maintenance Overhead**: Large, complex configuration files

## Decision

We will implement **component-based infrastructure modules** where each service is packaged as an independent Nix flake with standardized interfaces, allowing composition into larger systems while maintaining modularity.

### Component Architecture Pattern

Each infrastructure component follows this structure:

```
infra/components/[component]/
├── flake.nix              # Component interface and build logic
├── lib/                   # Modular Nix expressions
│   ├── config.nix         # Configuration and version management
│   ├── kubernetes.nix     # Kubernetes resource generation
│   └── packages.nix       # Container images and binaries
└── README.md              # Component documentation
```

### Standardized Component Interface

Every component flake exports:

```nix
{
  # Packages
  packages = {
    all-manifests = /* Combined K8s YAML */;
    docker = /* Container image */;
    # Individual manifest files...
  };

  # Applications for deployment
  apps = {
    deploy = /* Deploy component */;
    delete = /* Remove component */;
    status = /* Check component status */;
    logs = /* View component logs */;
  };

  # Development environment
  devShells.default = /* Component-specific tools */;
}
```

## Implementation Examples

### NATS Component Structure
```nix
# components/nats/flake.nix
{
  outputs = { self, nixpkgs, flake-utils }:
    let
      configModule = import ./lib/config.nix { inherit lib; };
      kubernetesModule = import ./lib/kubernetes.nix { inherit lib; };
      packagesModule = import ./lib/packages.nix { inherit pkgs; };
    in {
      packages = {
        all-manifests = /* Generated K8s YAML */;
        docker = /* NATS container */;
      };

      # Size-based deployment configurations
      configs = {
        small = { replicas = 1; resources = "minimal"; };
        medium = { replicas = 3; resources = "standard"; };
        large = { replicas = 5; resources = "high-performance"; };
      };
    };
}
```

### BFF Component Integration
```nix
# components/bff/flake.nix
{
  inputs = {
    fluo-bff-source = { url = "path:../../../bff"; };
  };

  outputs = {
    packages = {
      # Use BFF's service-owned deployment module
      all-manifests = bffDeployment.manifests;
      docker = fluo-bff-source.packages.docker;
    };
  };
}
```

## Component Composition Strategy

### Infrastructure Flake Orchestration
The main infrastructure flake composes components:

```nix
{
  inputs = {
    # Component inputs
    grafana.url = "path:./components/grafana";
    prometheus.url = "path:./components/prometheus";
    nats.url = "path:./components/nats";
    bff-component.url = "path:./components/bff";
    workers.url = "path:./components/workers";
  };

  outputs = {
    packages = {
      # Combined manifests from all components
      all-manifests = pkgs.writeText "fluo-all-manifests.yaml" ''
        ${builtins.readFile grafana.packages.all-manifests}
        ---
        ${builtins.readFile prometheus.packages.all-manifests}
        ---
        ${builtins.readFile nats.packages.all-manifests}
        # ... other components
      '';
    };
  };
}
```

## Alternatives Considered

### 1. Monolithic Infrastructure Configuration
**Rejected**:
- Difficult to test individual components
- Changes affect entire system
- Hard to reuse components
- Complex dependency management

### 2. Helm Charts
**Rejected**:
- Template complexity grows over time
- Limited type safety
- Difficult composition patterns
- YAML-based configuration limitations

### 3. Terraform Modules
**Rejected**:
- Primarily designed for cloud resources, not K8s applications
- State management complexity
- Limited declarative composition

### 4. Kustomize
**Rejected**:
- Limited parameterization capabilities
- No build-time validation
- Difficult cross-component dependency management

## Consequences

### Positive
- **Independent Development**: Components can be developed and tested separately
- **Reusability**: Components can be reused across different environments
- **Type Safety**: Nix validates component interfaces at build time
- **Testability**: Each component can be tested in isolation
- **Composability**: Easy to create different system configurations
- **Version Management**: Each component manages its own dependencies
- **Documentation**: Component-specific documentation co-located with code

### Negative
- **Complexity**: More moving parts to coordinate
- **Learning Curve**: Developers need to understand component interfaces
- **Debugging**: Issues may span multiple components
- **Coordination**: Changes affecting multiple components require coordination

### Mitigation Strategies
- **Standardization**: Common patterns and interfaces across components
- **Documentation**: Clear component APIs and usage examples
- **Testing**: Integration tests verify component interactions
- **Tooling**: Scripts to deploy/test entire stacks
- **Monitoring**: Observability to understand component interactions

## Implementation Status

- ✅ **NATS Component**: Modular structure with config/kubernetes/packages separation
- ✅ **BFF Component**: Integration with service-owned deployment modules
- ✅ **Grafana Component**: Dashboards and configuration management
- ✅ **Prometheus Component**: Metrics collection and alerting
- ✅ **Workers Component**: Job processing with queue integration
- ✅ **Component Composition**: Infrastructure flake orchestrates all components
- ⏳ **Backend Component**: Java/Quarkus integration (planned)

## Component Dependencies

### Dependency Graph
```
BFF ──────┐
          ├─→ NATS ←── Workers
Backend ──┘

Prometheus ──→ Grafana
     ↑
     └─── All Services (metrics)

Ingress Controller ──→ BFF + Backend
```

### Dependency Management
Components declare their dependencies:

```nix
# In component flake
lib = {
  dependencies = [ "nats-client" "prometheus-metrics" ];
  serviceInfo = {
    name = "bff";
    provides = [ "web-ui" "api-gateway" ];
    consumes = [ "nats-messaging" "backend-api" ];
  };
};
```

## Operational Benefits

### Environment-Specific Deployment
```bash
# Deploy minimal local environment
nix run .#deploy-local

# Deploy staging environment with different scaling
nix run .#deploy-staging

# Deploy production with full monitoring
nix run .#deploy-production
```

### Component Management
```bash
# Deploy individual component
nix run .#components.nats.deploy

# Check component status
nix run .#components.bff.status

# View component logs
nix run .#components.workers.logs

# Scale component
nix run .#components.bff.scale 5
```

### Testing Strategy
```bash
# Test component in isolation
cd components/nats && nix flake check

# Test component integration
nix run .#test-integration

# Validate all manifests
nix run .#validate-manifests
```

## Future Considerations

1. **Component Registry**: Central catalog of available components
2. **Dependency Resolution**: Automatic dependency ordering and management
3. **Health Checks**: Cross-component health monitoring
4. **Blue-Green Deployments**: Component-level deployment strategies
5. **Resource Quotas**: Per-component resource management
6. **Security Policies**: Component-level security configurations

## Best Practices

### Component Design
- **Single Responsibility**: Each component has a focused purpose
- **Interface Stability**: Minimize breaking changes to component APIs
- **Configuration Externalization**: Environment-specific config via parameters
- **Documentation**: Clear README with usage examples
- **Testing**: Both unit tests and integration tests

### Naming Conventions
- **Components**: `kebab-case` directory names
- **Outputs**: Standardized output names (`all-manifests`, `docker`)
- **Apps**: Standard app names (`deploy`, `delete`, `status`, `logs`)
- **Namespaces**: Prefixed with `fluo-` for clarity

## References

- [Component Directory Structure](../infra/components/)
- [NATS Component Implementation](../infra/components/nats/)
- [BFF Component Implementation](../infra/components/bff/)
- [Infrastructure Orchestration](../infra/flake.nix)
- [ADR-001: Service-Owned Deployment Modules](./001-service-owned-deployment-modules.md)
- [ADR-004: Kubernetes-Native Infrastructure](./004-kubernetes-native-infrastructure.md)
- [ADR-009: Modular Configuration Management](./009-modular-configuration-management.md)