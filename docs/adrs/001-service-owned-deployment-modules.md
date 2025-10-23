# ADR-001: Service-Owned Deployment Modules

**Status:** Accepted
**Date:** 2025-09-21
**Deciders:** Architecture Team

## Context

BeTrace consists of multiple microservices (BFF, Backend, Workers, etc.) that need to be deployed to Kubernetes. We need a consistent, maintainable approach for managing Kubernetes deployments while allowing each service to maintain control over its deployment requirements.

### Problem Statement

1. **Service Autonomy**: Each service has unique deployment requirements (resources, health checks, environment variables, dependencies)
2. **Deployment Consistency**: Need standardized deployment patterns across all services
3. **Infrastructure Reusability**: Infrastructure team needs to compose deployments without duplicating service-specific knowledge
4. **Maintainability**: Changes to deployment logic should be owned by service teams

## Decision

We will implement **Service-Owned Deployment Modules** where each service exports a deployment function as part of its Nix flake `lib` output.

### Architecture Pattern

Each service flake exports:

```nix
lib = {
  # Main deployment function
  mkDeployment = { namespace, replicas, env, ingress, resources, ... }: {
    namespace = { /* K8s namespace */ };
    deployment = { /* K8s deployment */ };
    service = { /* K8s service */ };
    ingress = { /* optional K8s ingress */ };
  };

  # Convenience defaults
  defaultDeployment = mkDeployment {};

  # Service metadata
  dependencies = [ "service-a" "service-b" ];
  serviceInfo = { name, description, version, port, healthEndpoints };
};
```

Infrastructure flakes can then:

```nix
inputs = {
  betrace-bff.url = "path:../bff";
  betrace-backend.url = "path:../backend";
};

# Compose deployments
bffDeployment = betrace-bff.lib.mkDeployment {
  namespace = "production";
  replicas = 3;
  env = { DATABASE_URL = secrets.db; };
};
```

## Implementation Details

### Service Responsibilities
- **Deployment Logic**: Define K8s resources (Deployment, Service, Ingress)
- **Health Checks**: Specify liveness/readiness probe endpoints
- **Resource Requirements**: Set appropriate CPU/memory limits
- **Security Context**: Define container security settings
- **Dependencies**: Declare service dependencies

### Infrastructure Responsibilities
- **Environment Configuration**: Provide env vars, secrets, replicas
- **Resource Orchestration**: Compose multiple service deployments
- **Namespace Management**: Assign services to appropriate namespaces
- **Cross-Cutting Concerns**: Monitoring, logging, network policies

### Interface Contract

All services must implement:

```nix
lib.mkDeployment = {
  # Required parameters
  namespace ? "default"

  # Optional parameters with sensible defaults
  replicas ? 1
  env ? {}
  ingress ? null
  resources ? { /* service-specific defaults */ }
  image ? "service-name:latest"
  imagePullPolicy ? "Never"
}: {
  # Required outputs
  namespace = { /* K8s namespace resource */ };
  deployment = { /* K8s deployment resource */ };
  service = { /* K8s service resource */ };

  # Optional outputs
  ingress = lib.optionalAttrs (ingress != null) { /* K8s ingress */ };
}
```

## Consequences

### Positive
- **Service Ownership**: Teams control their deployment destiny
- **Type Safety**: Nix provides compile-time validation of K8s resources
- **Reusability**: Infrastructure can easily compose multiple services
- **Testability**: Deployment logic can be tested in isolation
- **Documentation**: Service deployment requirements are self-documenting

### Negative
- **Learning Curve**: Teams need to understand Nix deployment patterns
- **Interface Evolution**: Changes to the deployment interface affect all services
- **Complexity**: More sophisticated than simple YAML files

### Mitigation Strategies
- **Standard Templates**: Provide service deployment templates for common patterns
- **Documentation**: Maintain comprehensive examples and guides
- **Tooling**: Create helper functions for common K8s resource patterns
- **Migration Path**: Gradual migration from existing YAML-based deployments

## Alternatives Considered

### 1. Centralized YAML Templates
**Rejected**: Tight coupling between infrastructure and service deployment details

### 2. Helm Charts per Service
**Rejected**: Additional complexity without Nix's type safety benefits

### 3. Standardized Service Interface
**Rejected**: Less flexible than function-based approach

## Implementation Status

- ✅ **BFF Service**: Implemented `lib.mkDeployment` with full K8s resource generation
- 🔄 **Infrastructure Integration**: In progress - updating infra flake to consume BFF deployment
- ⏳ **Backend Service**: Planned
- ⏳ **Worker Service**: Planned

## Future Considerations

1. **Multi-Environment Support**: Extend pattern for dev/staging/prod configurations
2. **GitOps Integration**: Generate ArgoCD/Flux-compatible manifests
3. **Validation Framework**: Add K8s resource validation and testing
4. **Cross-Service Dependencies**: Enhanced dependency management and ordering

## References

- [BFF Deployment Implementation](../bff/flake.nix#L613-L794)
- [Kubernetes Resource Reference](https://kubernetes.io/docs/reference/kubernetes-api/)
- [Nix Flakes Manual](https://nixos.wiki/wiki/Flakes)