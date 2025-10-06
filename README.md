# FLUO Monorepo

This is the FLUO Real-time Behavioral Assurance System monorepo, managed using Nix flakes.

## Project Structure

```
fluo/
├── backend/     # Quarkus Backend (Java 21)
├── bff/         # Tanstack React Frontend (TypeScript)
├── infra/       # Kubernetes Infrastructure (Nix)
└── flake.nix    # Monorepo orchestration
```

## Quick Start

Enter the development environment:
```bash
nix develop
```

Check project status:
```bash
nix run .#status-all
```

## Development Commands

### Environment Management
- `nix develop` - Enter monorepo development environment
- `nix develop .#bff` - BFF development environment with Node.js 20, npm, Vite, and Tanstack tools
- `nix develop .#backend` - Backend development environment with OpenJDK 21, Maven, and Quarkus
- `nix develop .#infra` - Infrastructure environment with kubectl, helm, tofu, and container management tools

### Development Servers
- `nix run .#dev-bff-server` - Start BFF development server with Vite hot reload on localhost:3000
- `nix run .#dev-backend` - Start Backend development server using Quarkus dev mode with live reload

### Build & Test
- `nix run .#build-all` - Build all FLUO projects: BFF (Vite), Backend (Maven), and Infrastructure (Nix)
- `nix run .#test-all` - Run all test suites: BFF (Vitest + Playwright), Backend (JUnit), and Infrastructure validation

### Deployment
- `nix run .#deploy-local` - Deploy complete FLUO stack locally using Docker Desktop Kubernetes

### Maintenance
- `nix run .#clean-all` - Clean all build artifacts, dependencies, and Nix store garbage
- `nix run .#status-all` - Display comprehensive status of all FLUO projects and infrastructure

## Available Packages

### Application Builds
- `nix build .#bff-app` - FLUO BFF application build - Tanstack React frontend with TypeScript
- `nix build .#bff-docker` - Production Docker image for FLUO BFF with optimized Node.js runtime
- `nix build .#bff-docker-dev` - Development Docker image for FLUO BFF with debug tools and hot reload

### Infrastructure Images
- `nix build .#infra-bff-image` - Infrastructure-managed BFF container image for Kubernetes deployment
- `nix build .#infra-worker-image` - Worker pod container image for background job processing

## Development Shells

All development environments include comprehensive descriptions and are accessible via:

- **Default**: Combined environment with all tools for monorepo management
- **BFF**: Node.js 20, npm, Vite, TypeScript, and Tanstack ecosystem
- **Backend**: OpenJDK 21, Maven, and Quarkus development tools
- **Infrastructure**: kubectl, helm, OpenTofu, and container management

## Architecture

FLUO follows a well-documented architecture with formal Architecture Decision Records (ADRs):

📋 **[Architecture Decision Records (ADRs)](./ADRs/README.md)** - Comprehensive architectural documentation

### Key Architectural Decisions
- **[Service-Owned Deployment Modules](./ADRs/001-service-owned-deployment-modules.md)** - Services control their own deployment
- **[Nix Flakes as Build System](./ADRs/002-nix-flakes-build-system.md)** - Reproducible builds across platforms
- **[Monorepo with Flake Composition](./ADRs/003-monorepo-flake-composition.md)** - Coordinated multi-component development
- **[Kubernetes-Native Infrastructure](./ADRs/004-kubernetes-native-infrastructure.md)** - Cloud-native deployment platform
- **[Component-Based Infrastructure](./ADRs/005-component-based-infrastructure.md)** - Modular, reusable infrastructure
- **[Tanstack Frontend Ecosystem](./ADRs/006-tanstack-frontend-architecture.md)** - Type-safe, reactive frontend
- **[NATS Message Broker](./ADRs/007-nats-message-broker.md)** - Reliable inter-service communication
- **[Cross-Platform Build Strategy](./ADRs/008-cross-platform-build-strategy.md)** - ARM64 → x86_64 builds
- **[Modular Configuration](./ADRs/009-modular-configuration-management.md)** - Structured config management

### Component Overview

#### Backend (Java/Quarkus)
- **Technology**: Java 21 + Maven + Quarkus
- **Purpose**: Real-time behavioral assurance API
- **Development**: Hot reload with `./mvnw quarkus:dev`

#### BFF (TypeScript/React)
- **Technology**: Node.js 20 + Vite + React + Tanstack
- **Purpose**: Frontend application for FLUO dashboard
- **Development**: Hot reload with `npm run dev`

### Infrastructure (Nix/Kubernetes)
- **Technology**: Nix + Kubernetes + OpenTofu
- **Purpose**: Container orchestration and deployment
- **Development**: Local Kubernetes with Docker Desktop

## CI/CD Validation

The monorepo includes comprehensive checks:
- `bff-build` - Verify BFF application builds successfully with TypeScript and Vite
- `backend-build` - Verify Backend application compiles successfully with Java 21 and Maven
- `infra-tofu-fmt` - Validate Infrastructure as Code formatting with OpenTofu
- `infra-nix-fmt` - Validate Nix expression formatting with nixpkgs-fmt

Run all checks with:
```bash
nix flake check
```

## Nix Benefits

### Reproducibility
- **Pinned Dependencies**: All tools use exact versions across all systems
- **Deterministic Builds**: Container images built identically everywhere
- **Locked Inputs**: `flake.lock` ensures consistent dependency versions

### Developer Experience
- **Zero Setup**: `nix develop` provides complete development environment
- **Tool Consistency**: Everyone uses identical tool versions
- **Offline Capable**: Nix cache enables offline development

### CI/CD Integration
- **Hermetic Builds**: CI uses exact same environment as developers
- **Caching**: Nix binary cache speeds up builds significantly
- **Multi-platform**: Native support for different architectures

## Getting Help

Run any command with the `--help` flag or check the individual project documentation:
- [Backend Documentation](./backend/README.md)
- [BFF Documentation](./bff/CLAUDE.md)
- [Infrastructure Documentation](./infra/CLAUDE.md)