# ADR-011: Pure Application Framework

**Status:** Accepted
**Date:** 2025-09-22
**Deciders:** Architecture Team

## Context

BeTrace was initially designed as a "platform" that included both application logic and deployment infrastructure. This created several architectural problems:

1. **Scope Creep**: Infrastructure concerns mixed with application concerns
2. **Deployment Coupling**: Applications tightly coupled to specific deployment patterns (Kubernetes)
3. **Complexity Overhead**: Excessive infrastructure code for core application functionality
4. **Consumer Lock-in**: External consumers forced into specific deployment patterns

The previous approach violated separation of concerns by having services export deployment functions rather than focusing on their core application responsibilities.

## Decision

We will transform BeTrace from a **"platform with deployment"** to a **"pure application framework"** where:

1. **Applications export packages, not deployments**
2. **Deployment becomes an external consumer concern**
3. **Infrastructure is completely separated from application logic**

## Architecture Changes

### New Component Responsibilities

**Frontend (bff/)**
- ✅ Build optimized React application bundle
- ✅ Provide development server with hot reload
- ✅ Serve static assets for production
- ❌ ~~Export Kubernetes manifests~~
- ❌ ~~Generate Docker images~~

**Backend (backend/)**
- ✅ Build Quarkus JAR with dependencies
- ✅ Provide development server with live reload
- ✅ Serve REST API endpoints
- ❌ ~~Export deployment configurations~~
- ❌ ~~Generate container images~~

**Root Monorepo**
- ✅ Compose applications for local development
- ✅ Provide unified development experience
- ✅ Coordinate inter-service communication locally
- ❌ ~~Infrastructure orchestration~~
- ❌ ~~Cloud provider integration~~

### Eliminated Scope

**Infrastructure Concerns (Now External)**
- ❌ Kubernetes manifest generation
- ❌ Docker image building
- ❌ Container orchestration
- ❌ Cloud provider abstractions
- ❌ Deployment scripts and automation
- ❌ Infrastructure-as-code patterns

**Removed Dependencies**
- ❌ kubectl, helm, terraform tools
- ❌ Cloud CLI tools (aws, gcp, azure)
- ❌ Container runtime requirements
- ❌ Kubernetes cluster dependencies

### New Service Interface Pattern

**Before (Deployment-Coupled):**
```nix
# Service exports deployment functions
lib.mkDeployment = { namespace, replicas, ... }: {
  deployment = { /* K8s manifest */ };
  service = { /* K8s service */ };
  ingress = { /* K8s ingress */ };
};
```

**After (Package-Focused):**
```nix
# Service exports application packages
packages = {
  app = buildApplication { };       # Built application
  default = app;                   # Default package
};

apps = {
  dev = startDevServer { };        # Development server
  serve = serveBuiltApp { };       # Production server
  default = dev;                   # Default app
};
```

## Implementation Details

### Component Flake Structure

Each component follows a pure application pattern:

```nix
{
  description = "Component Name - Pure Application";

  outputs = { pkgs, ... }: {
    packages = {
      app = buildApp { };           # Application artifacts
      default = app;
    };

    apps = {
      dev = startDevServer { };     # Hot reload development
      serve = serveProduction { };  # Production server
      default = dev;
    };

    devShells.default = mkShell {   # Development environment
      # Only tools needed for this application
    };
  };
}
```

### Monorepo Orchestration

The root flake provides local development orchestration:

```nix
{
  description = "BeTrace - Pure Application Framework";

  outputs = { frontend, backend, ... }: {
    apps = {
      dev = orchestrateLocalDevelopment {
        services = [ frontend.apps.dev backend.apps.dev ];
      };

      serve = orchestrateProduction {
        frontend = frontend.apps.serve;
        backend = backend.apps.serve;
      };
    };
  };
}
```

### External Deployment Pattern

Deployment becomes a consumer responsibility. While deployment logic is separated from core applications, it MAY reside in the same repository under a dedicated `distribution/` directory for convenience:

```nix
# distribution/docker/flake.nix (external consumer in same repo)
{
  inputs.fluo.url = "path:../..";  # Consumes FLUO packages

  outputs = { fluo, ... }: {
    packages.docker-images = buildDockerImages {
      backend = fluo.packages.x86_64-linux.backend;
      frontend = fluo.packages.x86_64-linux.frontend;
    };
  };
}

# OR: external-k8s-deploy/flake.nix (separate project/repo)
{
  inputs.fluo.url = "github:org/fluo";

  outputs = { fluo, ... }: {
    packages.k8s-manifests = generateKubernetesDeployment {
      frontend = fluo.packages.x86_64-linux.frontend;
      backend = fluo.packages.x86_64-linux.backend;
      # Consumer chooses deployment strategy
    };
  };
}
```

**Key Principle**: Distribution code must ALWAYS be an *external consumer* of application packages, whether in the same repo or separate. The `distribution/` directory pattern provides convenience while maintaining architectural separation.

## Migration Strategy

### ✅ Phase 1: Infrastructure Elimination (Completed)
- Removed `/infra` directory entirely
- Eliminated all Kubernetes manifest generation
- Removed Docker image building from core components
- Deleted cloud provider tooling dependencies

### ✅ Phase 2: Component Simplification (Completed)
- Simplified BFF flake to pure frontend patterns
- Simplified Backend flake to pure API patterns
- Removed `lib.mkDeployment` functions
- Focused on `packages` and `apps` outputs only

### ✅ Phase 3: Monorepo Refactoring (Completed)
- Updated root flake for local-only orchestration
- Created development orchestrator for both services
- Removed infrastructure deployment scripts
- Added pure application build and test coordination

### ✅ Phase 4: Documentation & Distribution (Completed)
- ✅ Create ADR-011 documenting architectural shift
- ✅ Update all CLAUDE.md files to reflect new patterns
- ✅ Remove infrastructure references from documentation
- ✅ Add external deployment examples
- ✅ Create `distribution/` directory for in-repo external consumers (Docker, Helm, etc.)

## Benefits

### 1. **Clear Separation of Concerns**
- Applications focus solely on application logic
- Deployment logic is externalized to consumers
- No mixing of build and deployment concerns

### 2. **Deployment Flexibility**
- Same application packages work in any deployment environment
- Consumers choose: Kubernetes, Docker, serverless, bare metal
- No vendor or platform lock-in

### 3. **Simplified Development**
- Faster builds (no infrastructure overhead)
- Cleaner development environments
- Focus on application functionality

### 4. **Reduced Scope**
- Smaller, more focused codebase
- Easier testing and maintenance
- Clear boundaries and responsibilities

### 5. **Consumer Freedom**
- External projects can consume BeTrace packages
- Multiple deployment strategies supported
- No forced infrastructure patterns

## External Deployment Examples

External deployment consumers can live in the same repo (`distribution/`) or separate repos:

### In-Repo Distribution (Convenience Pattern)
```nix
# distribution/docker/flake.nix
inputs.fluo.url = "path:../..";  # Consume from same repo
outputs = { fluo, ... }: {
  packages.docker-images = buildDockerImages {
    backend = fluo.packages.x86_64-linux.backend;
    frontend = fluo.packages.x86_64-linux.frontend;
  };
};
```

### Separate Repo Distribution (External Consumer)
```nix
# external-k8s/flake.nix
inputs.fluo.url = "github:org/fluo";
outputs = { fluo, ... }: {
  packages.k8s-manifests = generateKubernetesManifests {
    frontend = fluo.packages.x86_64-linux.frontend;
    backend = fluo.packages.x86_64-linux.backend;
  };
};
```

### Multi-Target Distribution
```nix
# distribution/helm/flake.nix
inputs.fluo.url = "path:../..";
outputs = { fluo, ... }: {
  packages.helm-chart = generateHelmChart {
    backend = fluo.packages.x86_64-linux.backend;
    plugin = fluo.packages.x86_64-linux.grafana-plugin;
  };
};
```

**See Also**: [distribution/README.md](../../distribution/README.md) for comprehensive distribution patterns

## Consequences

### Positive
- **Focused Scope**: Each component has single, clear responsibility
- **Deployment Agnostic**: Applications can be deployed anywhere
- **Fast Development**: No infrastructure overhead during development
- **Supply Chain Security**: Maintained Nix dependency locking
- **Consumer Choice**: External projects choose deployment patterns

### Negative
- **Initial Inconvenience**: No built-in deployment for quick demos
- **External Dependencies**: Deployment examples are separate projects
- **Learning Curve**: Teams need to understand external deployment patterns

### Mitigation Strategies
- **Quick Start Examples**: Provide template deployment projects
- **Documentation**: Comprehensive guides for common deployment patterns
- **Community**: Share external deployment projects as examples
- **Local Development**: Rich local development experience with `nix run .#dev`

## Alternatives Considered

### 1. **Hybrid Approach**: Keep some deployment logic
**Rejected**: Violates clean separation of concerns

### 2. **Optional Infrastructure**: Make deployment components optional
**Rejected**: Still mixes concerns and creates complexity

### 3. **Plugin Architecture**: Pluggable deployment modules
**Rejected**: Over-engineering for the problem scope

## Future Considerations

1. **Community Deployment Projects**: Foster ecosystem of deployment examples
2. **Deployment Templates**: Standard project templates for common patterns
3. **Integration Testing**: External deployment validation in CI/CD
4. **Documentation**: Rich guides for different deployment scenarios

## References

- [Previous ADR-001: Service-Owned Deployment Modules](./001-service-owned-deployment-modules.md) - Now superseded
- [Previous ADR-004: Kubernetes-Native Infrastructure](./004-kubernetes-native-infrastructure.md) - Now superseded
- [ADR-002: Nix Flakes as Build System](./002-nix-flakes-build-system.md) - Still valid for application builds
- [Root Flake Implementation](../flake.nix) - New pure orchestration pattern
- [Frontend Implementation](../bff/flake.nix) - Pure React application
- [Backend Implementation](../backend/flake.nix) - Pure Quarkus API