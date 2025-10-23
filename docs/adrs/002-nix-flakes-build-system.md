# ADR-002: Nix Flakes as Build System Foundation

**Status:** Accepted
**Date:** 2025-09-21
**Deciders:** Architecture Team

## Context

BeTrace is a complex system with multiple components (BFF, Backend, Infrastructure) that need to be built, tested, and deployed consistently across different platforms and environments. We need a build system that provides:

1. **Reproducible Builds**: Identical outputs regardless of the host system
2. **Dependency Management**: Precise control over all dependencies and their versions
3. **Cross-Platform Support**: Build on ARM64 (Apple Silicon) for x86_64 Linux deployment
4. **Developer Experience**: Fast, reliable development environments
5. **CI/CD Integration**: Consistent behavior in automated pipelines

### Problem Statement

Traditional build systems suffer from:
- **"Works on my machine" problems**: Different dependency versions across environments
- **Supply chain vulnerability**: Mutable dependencies can change between builds
- **Platform inconsistency**: Different behavior on macOS vs Linux
- **Slow setup**: Complex installation procedures for development environments
- **Version drift**: Dependencies update unexpectedly, breaking builds

## Decision

We will use **Nix Flakes** as the primary build system and dependency management solution for all BeTrace components.

### Implementation Strategy

Each component has its own `flake.nix` that defines:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-24.05-darwin";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system: {
      # Development environment
      devShells.default = pkgs.mkShell { /* tools */ };

      # Build outputs
      packages = { /* built artifacts */ };

      # Applications/scripts
      apps = { /* deployment scripts */ };
    });
}
```

### Nix Conventions and Usage Patterns

To ensure consistent usage across the BeTrace monorepo, the following conventions must be followed:

#### Build vs Run Semantics

**`nix build` Commands (Build Artifacts)**
- `nix build .#all` - Build all BeTrace components with locked dependencies
- `nix build .#bff` - Build BFF application artifacts (dist/, docker image)
- `nix build .#backend` - Build backend JAR and deployment artifacts
- `nix build .#component` - Build specific component outputs

**`nix run` Commands (Execute/Run Services)**
- `nix run .#bff` - Run BFF development server (Vite with hot reload)
- `nix run .#backend` - Run backend development server (Quarkus dev mode)
- `nix run .#orchestrate-builds` - Run build orchestration script with verbose output
- `nix run .#orchestrate-tests` - Run comprehensive test suite across components

#### Component-Level Conventions

Each BeTrace component (bff/, backend/, infra/) follows these patterns:

**Packages (for `nix build`)**:
- `default` - Primary build output (application artifacts)
- `docker` - Production container image
- `docker-dev` - Development container image with debug tools

**Apps (for `nix run`)**:
- `default` - Development server (hot reload, immediate feedback)
- `dev` - Alias for development server
- `build` - Build script with progress output
- `serve` - Production preview server

#### Monorepo Orchestration

**Build Operations**:
```bash
nix build .#all                    # Build all components (proper Nix way)
nix build .#bff                    # Build BFF artifacts only
nix build .#backend                # Build backend artifacts only
```

**Development Operations**:
```bash
nix run .#bff                      # Start BFF dev server
nix run .#backend                  # Start backend dev server
nix run .#orchestrate-builds       # Verbose build orchestration
nix run .#orchestrate-tests        # Comprehensive testing
```

#### Rationale

These conventions align with standard Nix community practices:
- **`nix build`** produces derivations stored in the Nix store
- **`nix run`** executes applications, servers, or scripts
- **Clear semantics** prevent confusion about whether an operation builds or runs
- **Consistent interface** across all BeTrace components and the monorepo

### Key Benefits

1. **Hermetic Builds**: All dependencies pinned to exact versions in `flake.lock`
2. **Binary Caching**: Pre-built packages from cache.nixos.org reduce build times
3. **Cross-Compilation**: Native support for building x86_64 packages on ARM64
4. **Instant Environments**: `nix develop` provides complete dev environment instantly
5. **Composition**: Flakes can reference other flakes with input follows

## Alternatives Considered

### 1. Docker-based Development
**Rejected**: Slower iteration, platform-specific issues, resource overhead

### 2. Language-specific Tools (npm, Maven, etc.)
**Rejected**: Each language requires different tooling, no cross-language consistency

### 3. Bazel
**Rejected**: Complex setup, limited ecosystem support, overkill for current scale

### 4. Traditional Package Managers (apt, brew, etc.)
**Rejected**: No reproducibility guarantees, platform-specific

## Consequences

### Positive
- **Zero Setup Time**: `nix develop` provides complete environment instantly
- **Reproducible Everywhere**: Identical builds on macOS, Linux, CI/CD
- **Fast Builds**: Binary cache eliminates compilation for most dependencies
- **Security**: Cryptographic hashes ensure supply chain integrity
- **Rollbacks**: Easy to revert to previous working versions
- **Multi-platform**: Native cross-compilation support

### Negative
- **Learning Curve**: Team needs to learn Nix language and concepts
- **Disk Usage**: Nix store can grow large (mitigated by garbage collection)
- **Debugging**: Nix build errors can be cryptic initially
- **Ecosystem**: Some packages may not be available in nixpkgs

### Mitigation Strategies
- **Documentation**: Comprehensive guides and examples in CLAUDE.md files
- **Training**: Regular team sessions on Nix best practices
- **Templates**: Standard flake templates for common patterns
- **Garbage Collection**: Automated cleanup of old Nix store entries
- **Fallbacks**: Docker alternatives for packages not in nixpkgs

## Implementation Status

- ✅ **Root Flake**: Monorepo orchestration with shared dependencies
- ✅ **BFF Flake**: Node.js 20, Vite, React, TypeScript toolchain
- ✅ **Infrastructure Flake**: kubectl, helm, terraform, container tools
- ✅ **Binary Caching**: Configured for cache.nixos.org and nix-community
- ✅ **Cross-Compilation**: ARM64 → x86_64 builds working
- ⏳ **Backend Flake**: Java 21, Maven, Quarkus integration (planned)

## Key Configuration

### Binary Cache Configuration
```nix
nixConfig = {
  substituters = [
    "https://cache.nixos.org/"
    "https://nix-community.cachix.org"
  ];
  trusted-public-keys = [
    "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
    "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
  ];
  builders-use-substitutes = true;
};
```

### Cross-Platform Build Helper
```nix
mkLinuxPkgs = buildSystem: targetSystem:
  if buildSystem == targetSystem then
    nixpkgs.legacyPackages.${buildSystem}
  else
    nixpkgs.legacyPackages.${buildSystem}.pkgsCross.${
      if targetSystem == "x86_64-linux" then "gnu64"
      else if targetSystem == "aarch64-linux" then "aarch64-multiplatform"
      else throw "Unsupported target system: ${targetSystem}"
    };
```

## Future Considerations

1. **Cachix Setup**: Private binary cache for BeTrace-specific packages
2. **Hydra CI**: Nix-native continuous integration
3. **NixOS Deployment**: Consider NixOS for production servers
4. **Flake Updates**: Automated dependency updates with testing

## References

- [Nix Flakes Reference](https://nixos.wiki/wiki/Flakes)
- [Root Flake Implementation](../flake.nix)
- [BFF Flake Implementation](../bff/flake.nix)
- [Infrastructure Flake Implementation](../infra/flake.nix)
- [ADR-003: Monorepo Structure](./003-monorepo-flake-composition.md)
- [ADR-008: Cross-Platform Build Strategy](./008-cross-platform-build-strategy.md)