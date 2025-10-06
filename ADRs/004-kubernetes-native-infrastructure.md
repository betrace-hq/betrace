# ADR-004: Kubernetes-Native Infrastructure Architecture

**Status:** Accepted
**Date:** 2025-09-21
**Deciders:** Architecture Team

## Context

FLUO requires a deployment platform that provides:

1. **Scalability**: Handle varying loads with automatic scaling
2. **Resilience**: Self-healing and fault tolerance
3. **Observability**: Built-in monitoring, logging, and tracing
4. **Portability**: Deploy consistently across environments (local, staging, production)
5. **Cloud Agnostic**: Not locked into a specific cloud provider
6. **Developer Experience**: Local development that mirrors production

### Problem Statement

Traditional deployment approaches suffer from:
- **Environment Drift**: Differences between local, staging, and production
- **Scaling Complexity**: Manual intervention required for load changes
- **Operational Overhead**: Complex setup and maintenance procedures
- **Vendor Lock-in**: Tied to specific cloud provider services
- **Limited Observability**: Difficult to debug and monitor distributed systems

## Decision

We will use **Kubernetes as the primary deployment platform** for all FLUO components, with Nix-generated manifests providing declarative infrastructure as code.

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Ingress                       │
│            (nginx-ingress-controller)           │
└─────────────────┬───────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │   BFF       │   Backend   │
    │ (fluo-bff)  │ (fluo-api)  │
    └─────────────┼─────────────┘
                  │
    ┌─────────────┼─────────────┐
    │    NATS     │   Workers   │
    │ (messaging) │ (processors)│
    └─────────────┼─────────────┘
                  │
    ┌─────────────┼─────────────┐
    │ Prometheus  │   Grafana   │
    │(monitoring) │(dashboards) │
    └─────────────┴─────────────┘
```

### Kubernetes Resource Strategy

Each component is deployed using standard Kubernetes resources:

- **Namespace**: Logical isolation per component
- **Deployment**: Manages pods with rolling updates
- **Service**: Internal service discovery
- **Ingress**: External traffic routing
- **ConfigMap**: Non-sensitive configuration
- **Secret**: Sensitive configuration
- **HPA**: Horizontal Pod Autoscaler for scaling

## Implementation Details

### Local Development
- **Docker Desktop Kubernetes**: Provides local K8s cluster
- **Port Forwarding**: Direct access to services during development
- **Hot Reload**: File watching for rapid iteration
- **Service Discovery**: Same DNS patterns as production

### Manifest Generation
Kubernetes manifests are generated from Nix expressions, providing:
- **Type Safety**: Nix validates resource structure at build time
- **Parameterization**: Environment-specific configuration via function parameters
- **Composition**: Reusable components across different environments
- **Version Control**: All infrastructure changes tracked in Git

### Example Manifest Generation
```nix
# Generate Kubernetes deployment from Nix data
deployment = pkgs.lib.generators.toYAML {} {
  apiVersion = "apps/v1";
  kind = "Deployment";
  metadata = {
    name = "fluo-bff";
    namespace = "fluo-bff";
  };
  spec = {
    replicas = 2;
    selector.matchLabels."app.kubernetes.io/name" = "bff";
    template = {
      # Pod specification...
    };
  };
};
```

### Namespace Organization
```
fluo-bff         # BFF frontend and API layer
fluo-backend     # Core business logic service
fluo-queue       # NATS message broker
fluo-workers     # Background job processors
fluo-monitoring  # Prometheus, Grafana, AlertManager
ingress-nginx    # Ingress controller (shared)
```

## Alternatives Considered

### 1. Docker Compose
**Rejected**:
- Limited scaling capabilities
- No built-in service discovery
- Difficult multi-environment deployment
- No native load balancing

### 2. Serverless (Lambda, Cloud Functions)
**Rejected**:
- Vendor lock-in
- Cold start latency issues
- Limited for stateful services (NATS)
- Complex local development

### 3. Traditional VMs with Configuration Management
**Rejected**:
- Manual scaling processes
- Configuration drift over time
- Higher operational overhead
- Slower deployment cycles

### 4. Platform-as-a-Service (Heroku, Railway)
**Rejected**:
- Limited customization options
- Vendor lock-in
- Higher costs at scale
- Limited observability control

## Consequences

### Positive
- **Automatic Scaling**: HPA scales pods based on CPU/memory/custom metrics
- **Self-Healing**: Failed pods are automatically restarted
- **Rolling Deployments**: Zero-downtime deployments with health checks
- **Service Discovery**: DNS-based service communication
- **Load Balancing**: Built-in traffic distribution
- **Resource Management**: CPU/memory limits and requests
- **Observability**: Native metrics, logging, and tracing integration
- **Portability**: Same deployment works locally and in cloud

### Negative
- **Complexity**: Kubernetes has a steep learning curve
- **Resource Overhead**: Additional cluster management overhead
- **Local Requirements**: Need Docker Desktop or minikube locally
- **Debugging**: Distributed systems are harder to debug
- **Storage**: Stateful services require persistent volume management

### Mitigation Strategies
- **Documentation**: Comprehensive K8s guides in CLAUDE.md
- **Tooling**: Nix provides kubectl, helm, and k9s tools automatically
- **Abstractions**: Component flakes hide K8s complexity behind simple interfaces
- **Local Setup**: Automated scripts for local cluster setup
- **Monitoring**: Comprehensive observability stack to aid debugging

## Implementation Status

- ✅ **Local Kubernetes**: Docker Desktop cluster operational
- ✅ **Ingress Controller**: nginx-ingress for external traffic
- ✅ **NATS Deployment**: Message broker with JetStream persistence
- ✅ **BFF Deployment**: Frontend with proper service-owned manifests
- ✅ **Workers Deployment**: Background job processors
- ✅ **Monitoring Stack**: Prometheus + Grafana + AlertManager
- ✅ **Cross-Platform Builds**: ARM64 → x86_64 container builds
- ⏳ **Backend Deployment**: Java/Quarkus service (planned)
- ⏳ **Production Setup**: Cloud provider deployment (planned)

## Operational Considerations

### Health Checks
All services implement:
- **Liveness Probes**: Detect if pod needs restart
- **Readiness Probes**: Detect if pod is ready for traffic
- **Startup Probes**: Handle slow-starting applications

### Resource Management
```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### Security Context
```yaml
securityContext:
  allowPrivilegeEscalation: false
  runAsNonRoot: true
  runAsUser: 1001
  capabilities:
    drop: ["ALL"]
```

### Horizontal Pod Autoscaling
```yaml
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Future Considerations

1. **GitOps Integration**: ArgoCD or Flux for automated deployments
2. **Service Mesh**: Istio for advanced traffic management and security
3. **Cluster Autoscaling**: Node-level scaling based on resource demands
4. **Multi-Region**: Cross-region deployments for disaster recovery
5. **Admission Controllers**: Policy enforcement and security scanning
6. **Custom Resources**: CRDs for FLUO-specific operational concerns

## References

- [Kubernetes Manifests](../infra/k8s/manifests/)
- [Component Deployments](../infra/components/)
- [Infrastructure Flake](../infra/flake.nix)
- [Local Development Guide](../infra/README.md)
- [ADR-001: Service-Owned Deployment Modules](./001-service-owned-deployment-modules.md)
- [ADR-005: Component-Based Infrastructure](./005-component-based-infrastructure.md)
- [ADR-007: NATS Message Broker](./007-nats-message-broker.md)