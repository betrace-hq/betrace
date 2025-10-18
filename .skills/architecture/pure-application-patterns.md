# Pure Application Patterns

Examples of correct pure application framework patterns vs. anti-patterns.

## Component Flake Structure

### ✅ Correct Pattern
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
      buildInputs = [ /* dev tools only */ ];
    };
  };
}
```

### ❌ Anti-Pattern
```nix
{
  # DON'T: Export deployment functions
  lib.mkDeployment = { namespace, replicas, ... }: {
    deployment = { /* K8s manifest */ };
    service = { /* K8s service */ };
    ingress = { /* K8s ingress */ };
  };
}
```

## Service Implementation

### ✅ Correct Pattern
```java
// Pure business logic, no deployment assumptions
@ApplicationScoped
public class TraceAnalyzer {
    public AnalysisResult analyze(Trace trace) {
        // Business logic only
        return performAnalysis(trace);
    }
}
```

### ❌ Anti-Pattern
```java
// DON'T: Hardcode deployment assumptions
@ApplicationScoped
public class TraceAnalyzer {
    @ConfigProperty(name = "kubernetes.namespace")
    String k8sNamespace;  // ❌ Deployment coupling

    @ConfigProperty(name = "aws.region")
    String awsRegion;     // ❌ Cloud provider coupling
}
```

## Configuration

### ✅ Correct Pattern
```properties
# Application configuration (deployment-agnostic)
fluo.trace.batch-size=1000
fluo.rule.evaluation-timeout=5s
fluo.tenant.max-rules=100
```

### ❌ Anti-Pattern
```properties
# DON'T: Deployment-specific configuration
kubernetes.service.type=LoadBalancer
aws.s3.bucket=fluo-traces-prod
docker.registry=registry.example.com
```

## Dependency Declaration

### ✅ Correct Pattern
```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    quarkus = {
      url = "github:quarkusio/quarkus/3.x";
      # Application dependencies only
    };
  };
}
```

### ❌ Anti-Pattern
```nix
{
  inputs = {
    # DON'T: Infrastructure dependencies
    kubernetes-tools.url = "github:...";
    terraform.url = "github:...";
    aws-cli.url = "github:...";
  };
}
```

## Build Outputs

### ✅ Correct Pattern
```bash
# Build produces deployment-agnostic artifacts
nix build .#backend
# Result: backend.jar (runs anywhere with Java 21)

nix build .#frontend
# Result: static HTML/JS/CSS (serve anywhere)
```

### ❌ Anti-Pattern
```bash
# DON'T: Build deployment-specific artifacts
nix build .#docker-image
# Result: Docker image (deployment-specific)

nix build .#kubernetes-manifests
# Result: K8s YAML (deployment-specific)
```

## Local Development

### ✅ Correct Pattern
```bash
# All services start with single command
nix run .#dev

# Services available:
# Frontend:     http://localhost:3000
# Backend API:  http://localhost:8080
# Grafana:      http://localhost:12015

# No external dependencies required
```

### ❌ Anti-Pattern
```bash
# DON'T: Require external infrastructure
docker-compose up -d  # Requires Docker daemon
kubectl apply -f ...  # Requires K8s cluster
terraform apply       # Requires cloud credentials
```

## External Deployment Pattern

### ✅ Correct Pattern
```nix
# external-k8s-deploy/flake.nix (separate project)
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

### ❌ Anti-Pattern
```nix
# DON'T: Include deployment in application flake
{
  outputs = {
    # Application packages (correct)
    packages.frontend = ...;
    packages.backend = ...;

    # Deployment (incorrect - violates ADR-011)
    packages.k8s-manifests = ...;
    packages.docker-images = ...;
  };
}
```

## Testing

### ✅ Correct Pattern
```java
@QuarkusTest
class TraceAnalyzerTest {
    @Inject
    TraceAnalyzer analyzer;

    @Test
    void shouldAnalyzeTrace() {
        // Pure business logic test
        Trace trace = createTestTrace();
        AnalysisResult result = analyzer.analyze(trace);
        assertThat(result).isNotNull();
    }
}
```

### ❌ Anti-Pattern
```java
@QuarkusTest
class TraceAnalyzerTest {
    @Test
    void shouldDeployToKubernetes() {
        // DON'T: Test deployment infrastructure
        KubernetesClient client = ...;
        client.deployApplication(...);
    }
}
```

## Monorepo Orchestration

### ✅ Correct Pattern
```nix
# root flake.nix
{
  outputs = { frontend, backend, ... }: {
    apps = {
      # Local development orchestration only
      dev = orchestrateLocalDevelopment {
        services = [
          frontend.apps.dev
          backend.apps.dev
        ];
      };
    };
  };
}
```

### ❌ Anti-Pattern
```nix
{
  outputs = {
    # DON'T: Production orchestration in monorepo
    apps.deploy-prod = deployToProduction {
      kubernetes = { ... };
      aws = { ... };
    };
  };
}
```

## Summary

**Pure Application Framework Principles:**
1. Export packages, not infrastructure
2. No deployment assumptions in application code
3. Local development works without external dependencies
4. Deployment is external consumer responsibility
5. Build artifacts are deployment-agnostic

**Remember**: If it references Docker, Kubernetes, AWS, or any deployment target, it probably violates ADR-011.
