# ADR-003: Monorepo Structure with Flake Composition

**Status:** Accepted
**Date:** 2025-09-21
**Deciders:** Architecture Team

## Context

BeTrace consists of multiple interconnected components that need to be developed, tested, and deployed together:

1. **BFF (Backend for Frontend)**: React/TypeScript frontend with API layer
2. **Backend**: Java/Quarkus service handling core business logic
3. **Infrastructure**: Kubernetes manifests, monitoring, and deployment automation

These components have different technology stacks but need coordinated development, shared dependencies, and unified deployment processes.

### Problem Statement

We need to decide on code organization that balances:
- **Independent Development**: Teams can work on components without interference
- **Coordinated Releases**: Components can be deployed together with version alignment
- **Shared Dependencies**: Common tools and libraries are consistent across components
- **Build Efficiency**: Avoid redundant builds and leverage caching
- **Developer Experience**: Easy navigation and contribution across components

## Decision

We will use a **monorepo structure with flake composition** where each component maintains its own `flake.nix` but the root flake orchestrates shared concerns and cross-component operations.

### Monorepo Structure

```
fluo/
├── flake.nix              # Root orchestration flake
├── flake.lock             # Shared dependency locks
├── ADRs/                  # Architecture decision records
├── bff/
│   ├── flake.nix          # BFF-specific build and dev environment
│   ├── src/               # React/TypeScript application
│   └── package.json       # Node.js dependencies
├── backend/
│   ├── flake.nix          # Backend-specific build and dev environment
│   ├── src/               # Java/Quarkus application
│   └── pom.xml            # Maven dependencies
└── infra/
    ├── flake.nix          # Infrastructure-specific tools and environments
    ├── components/        # Modular infrastructure components
    └── k8s/               # Kubernetes manifests
```

### Flake Composition Pattern

The root flake imports component flakes as inputs:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-24.05-darwin";
    flake-utils.url = "github:numtide/flake-utils";

    # Component flakes
    fluo-bff = {
      url = "path:./bff";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };

    fluo-infra = {
      url = "path:./infra";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };
}
```

### Shared Dependency Management

All flakes follow the same nixpkgs version through `inputs.follows`, ensuring:
- **Consistent toolchains**: Same Node.js, Java, kubectl versions
- **Unified caching**: Single nixpkgs evaluation for all components
- **Coordinated updates**: Update nixpkgs once at the root level

## Alternatives Considered

### 1. Separate Repositories (Polyrepo)
**Rejected**:
- Coordination overhead for releases
- Difficult to maintain consistency across repos
- Complex CI/CD pipelines
- Version skew between components

### 2. Single Monolithic Flake
**Rejected**:
- All developers need all tools installed
- Harder to optimize component-specific environments
- Tightly coupled builds
- Difficult to maintain as project grows

### 3. Git Submodules
**Rejected**:
- Complex workflow for developers
- Versioning complications
- Poor tooling support

## Consequences

### Positive
- **Atomic Commits**: Changes across components in single commit
- **Simplified CI/CD**: Single pipeline for entire system
- **Shared Tooling**: Common linting, formatting, and development tools
- **Cross-component Refactoring**: Easy to make breaking changes across components
- **Unified Documentation**: Single source of truth for architecture
- **Dependency Consistency**: All components use same base dependencies

### Negative
- **Repository Size**: Larger checkout size for all developers
- **Build Coupling**: Component builds may affect each other
- **Access Control**: Harder to restrict access to specific components
- **Cognitive Load**: Developers see all components even if they work on one

### Mitigation Strategies
- **Selective Development**: Component-specific dev shells (`nix develop .#bff`)
- **Modular Scripts**: Component-specific build/test scripts
- **Clear Documentation**: Component ownership and interaction patterns
- **Git Sparse Checkout**: Developers can check out only needed directories
- **Build Isolation**: Component builds are independent despite shared deps

## Implementation Status

- ✅ **Root Flake Structure**: Monorepo orchestration implemented
- ✅ **BFF Integration**: BFF flake with shared nixpkgs
- ✅ **Infrastructure Integration**: Infra flake with component composition
- ✅ **Shared Scripts**: Cross-component commands (build-all, test-all, deploy-local)
- ✅ **Documentation**: README and CLAUDE.md files guide component interaction
- ⏳ **Backend Integration**: Backend flake integration (planned)

## Key Implementation Details

### Root Flake Responsibilities
- **Environment Orchestration**: Provide shortcuts to component environments
- **Cross-component Operations**: Build all, test all, deploy all commands
- **Shared Configuration**: Common nixpkgs version and cache settings
- **Documentation**: Top-level README and development guidance

### Component Flake Responsibilities
- **Development Environment**: Component-specific tools and dependencies
- **Build Outputs**: Packages, containers, and deployment artifacts
- **Testing**: Component-specific test suites and validation
- **Documentation**: Component-specific README and API docs

### Dependency Management Strategy
```nix
# Root flake pins shared dependencies
inputs = {
  nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-24.05-darwin";
  flake-utils.url = "github:numtide/flake-utils";
};

# Component flakes follow root dependencies
fluo-bff = {
  url = "path:./bff";
  inputs.nixpkgs.follows = "nixpkgs";        # Share nixpkgs
  inputs.flake-utils.follows = "flake-utils"; # Share utilities
};
```

## Development Workflow

### Working on Single Component
```bash
# Enter component-specific environment
nix develop .#bff
cd bff && npm run dev

# Or use root-level shortcuts
nix run .#dev-bff-server
```

### Cross-component Development
```bash
# Build everything
nix run .#build-all

# Test everything
nix run .#test-all

# Deploy local stack
nix run .#deploy-local
```

### Adding New Components
1. Create component directory with `flake.nix`
2. Add component as input to root flake
3. Create development shortcuts in root flake
4. Update documentation and README

## Future Considerations

1. **Backend Integration**: Complete Java/Quarkus flake integration
2. **Workspace Optimization**: Investigate Nix workspaces for better isolation
3. **Build Caching**: Component-specific binary caches
4. **Selective Builds**: Only build changed components in CI
5. **Release Management**: Coordinated versioning and tagging strategy

## References

- [Root Flake Implementation](../flake.nix)
- [BFF Component Flake](../bff/flake.nix)
- [Infrastructure Component Flake](../infra/flake.nix)
- [Monorepo README](../README.md)
- [ADR-002: Nix Flakes as Build System](./002-nix-flakes-build-system.md)
- [ADR-005: Component-Based Infrastructure](./005-component-based-infrastructure.md)