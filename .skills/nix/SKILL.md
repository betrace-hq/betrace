---
name: Nix Flakes Expert
description: Provides Nix flake patterns, build optimization, dependency management, and pure application packaging guidance
---

# Nix Flakes Expert Skill

## Purpose

Provides expertise in Nix flake-based build system for FLUO's pure application framework.

## When to Use This Skill

Load this skill when:
- Adding/updating dependencies
- Creating new flake outputs (packages/apps)
- Optimizing build performance
- Debugging Nix build failures
- Setting up development environments

## Core Patterns

### Component Flake Structure
```nix
{
  description = "Component Name - Pure Application";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs, ... }: {
    packages.x86_64-linux = {
      app = buildApp { };
      default = self.packages.x86_64-linux.app;
    };

    apps.x86_64-linux = {
      dev = {
        type = "app";
        program = "${startDevServer}/bin/dev";
      };
      serve = {
        type = "app";
        program = "${serveApp}/bin/serve";
      };
      default = self.apps.x86_64-linux.dev;
    };

    devShells.x86_64-linux.default = mkShell {
      buildInputs = [ /* dev tools */ ];
    };
  };
}
```

### Dependency Management
```nix
inputs = {
  nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  flake-utils.url = "github:numtide/flake-utils";

  # Pin specific versions
  quarkus.url = "github:quarkusio/quarkus/3.17.0";
  quarkus.flake = false;  # Not a flake
};
```

### Build Commands
```bash
# Update dependencies
nix flake update

# Lock specific input
nix flake lock --update-input nixpkgs

# Build application
nix build .#app

# Run development server
nix run .#dev

# Enter development shell
nix develop
```

## Pure Application Constraints

### ✅ Allowed Outputs
- `packages.app` - Application artifacts
- `apps.dev` - Development server
- `apps.serve` - Production server
- `devShells.default` - Dev environment

### ❌ Forbidden Outputs
- Docker images (deployment-specific)
- Kubernetes manifests (deployment-specific)
- Cloud provider integrations (deployment-specific)

## Common Issues

### Issue: Dependency Hash Mismatch
```bash
# Update flake lock
nix flake update
```

### Issue: Cache Miss (Slow Build)
```bash
# Use binary cache
nix build --option substituters "https://cache.nixos.org"
```

### Issue: Out of Disk Space
```bash
# Garbage collect
nix-collect-garbage -d
```

## Progressive Disclosure

For detailed Nix guidance:
1. `flake-patterns.md` - Advanced flake patterns
2. `build-optimization.md` - Performance tuning
3. `dependency-management.md` - Version pinning strategies

See also: [@docs/adrs/002-nix-flakes-build-system.md](../../docs/adrs/002-nix-flakes-build-system.md)
