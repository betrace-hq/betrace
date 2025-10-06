# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FLUO** is a **Pure Application Framework** consisting of two applications:
- **Frontend**: React application with Tanstack ecosystem (located in `bff/`)
- **Backend**: Java 21 Quarkus API service (located in `backend/`)

FLUO follows a **deployment-agnostic** approach where applications focus solely on their core functionality, and deployment is handled by external consumers.

## Architecture Decisions

FLUO's architecture is documented through Architecture Decision Records (ADRs):

- **[ADR-011: Pure Application Framework](./ADRs/011-pure-application-framework.md)** - **Primary architecture** defining FLUO as deployment-agnostic applications
- **[ADR-002: Nix Flakes as Build System Foundation](./ADRs/002-nix-flakes-build-system.md)** - Reproducible builds with Nix
- **[ADR-003: Monorepo Structure with Flake Composition](./ADRs/003-monorepo-flake-composition.md)** - Local development orchestration

📋 **See [ADR Index](./ADRs/README.md) for complete architectural documentation**

## Core Principles

### 1. Pure Application Focus
- **Applications build and serve themselves**
- **No deployment logic in application code**
- **No infrastructure dependencies**

### 2. Local Development First
- **Instant startup with `nix run .#dev`**
- **Hot reload for both frontend and backend**
- **No external dependencies for development**

### 3. Deployment Agnostic
- **Applications work in any environment**
- **Consumers choose deployment strategy**
- **No vendor or platform lock-in**

## Project Structure

```
fluo/
├── flake.nix          # Monorepo orchestration (local development only)
├── bff/               # Frontend: React + Tanstack + Vite
│   ├── flake.nix      # Pure frontend build and serve
│   ├── src/           # React application source
│   └── package.json   # npm dependencies
├── backend/           # Backend: Java 21 + Quarkus + Maven
│   ├── flake.nix      # Pure API build and serve
│   ├── src/           # Quarkus application source
│   └── pom.xml        # Maven dependencies
└── ADRs/              # Architecture Decision Records
    └── 011-pure-application-framework.md
```

## Development Commands

### Quick Start
```bash
# Start both applications with hot reload
nix run .#dev

# Start individual applications
nix run .#frontend    # React app on http://localhost:3000
nix run .#backend     # Quarkus API on http://localhost:8080
```

### Build and Test
```bash
# Build both applications
nix build .#all

# Build individual applications
cd bff && nix build       # Frontend artifacts
cd backend && nix build   # Backend JAR

# Run tests
nix run .#test           # All test suites
```

### Production Preview
```bash
# Serve production builds locally
nix run .#serve
# Frontend: http://localhost:8080
# Backend:  http://localhost:8081
```

### Component Development
```bash
# Work on frontend only
cd bff && nix develop    # Enter frontend environment
npm run dev              # Start Vite dev server

# Work on backend only
cd backend && nix develop  # Enter backend environment
mvn quarkus:dev           # Start Quarkus dev mode
```

## Application Outputs

### Frontend (bff/)
```nix
packages = {
  app = frontendApp;      # Built React application (static assets)
  default = app;
};

apps = {
  dev = devServer;        # Vite development server with hot reload
  serve = staticServer;   # Serves built application
  routes = routeGen;      # Tanstack Router route generation
  default = dev;
};
```

### Backend (backend/)
```nix
packages = {
  app = backendApp;       # Built Quarkus JAR with dependencies
  default = app;
};

apps = {
  dev = devServer;        # Quarkus development server with live reload
  serve = productionServer; # Serves built JAR
  test = testRunner;      # Maven test execution
  default = dev;
};
```

### Monorepo (root)
```nix
packages = {
  frontend = bff.packages.app;     # Frontend artifacts
  backend = backend.packages.app;  # Backend artifacts
  all = combined;                  # Both applications
  default = all;
};

apps = {
  dev = devOrchestrator;          # Start both apps with coordination
  frontend = bff.apps.dev;        # Frontend development only
  backend = backend.apps.dev;     # Backend development only
  build = buildAll;               # Build both applications
  test = testAll;                 # Test both applications
  serve = productionServe;        # Production preview
  status = statusChecker;         # Check application status
  default = dev;
};
```

## External Deployment

FLUO applications are **deployment-agnostic**. External consumers create their own deployment projects:

### Kubernetes Example
```nix
# external-k8s-deploy/flake.nix
{
  inputs.fluo.url = "github:org/fluo";

  outputs = { fluo, ... }: {
    packages.k8s-manifests = generateKubernetesDeployment {
      frontend = fluo.packages.x86_64-linux.frontend;
      backend = fluo.packages.x86_64-linux.backend;
    };
  };
}
```

### Docker Compose Example
```nix
# external-docker-deploy/flake.nix
{
  inputs.fluo.url = "github:org/fluo";

  outputs = { fluo, ... }: {
    packages.docker-compose = generateDockerCompose {
      frontend = fluo.packages.x86_64-linux.frontend;
      backend = fluo.packages.x86_64-linux.backend;
    };
  };
}
```

### Local Development with External Tools
```bash
# Consumer uses FLUO in their project
nix run github:org/fluo#dev    # Start FLUO development servers
nix build github:org/fluo#all  # Build FLUO applications
```

## Technology Stack

### Frontend (bff/)
- **Runtime**: Node.js 20
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6 for fast development and optimized builds
- **Routing**: Tanstack Router for type-safe, file-based routing
- **State Management**: React Context + useReducer
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS
- **Testing**: Vitest + Playwright

### Backend (backend/)
- **Runtime**: Java 21 (OpenJDK)
- **Framework**: Quarkus for native performance and fast startup
- **Build Tool**: Maven
- **Testing**: JUnit 5

### Development Environment
- **Build System**: Nix Flakes for reproducible environments
- **Supply Chain Security**: All dependencies locked in flake.lock
- **Cross-Platform**: Supports macOS (ARM64) and Linux (x86_64)

## Development Workflow

### Regular Development
```bash
# Start development environment
nix run .#dev

# Make changes - applications auto-reload
# Frontend: Vite hot reload
# Backend: Quarkus live reload
```

### Adding Dependencies
```bash
# Frontend dependencies
cd bff
npm install <package>    # Add to package.json
nix build               # Rebuilds with new dependencies

# Backend dependencies
cd backend
# Edit pom.xml to add dependency
nix build               # Rebuilds with new dependencies
```

### Testing
```bash
# Run all tests
nix run .#test

# Component-specific testing
cd bff && npm run test        # Frontend tests
cd backend && nix run .#test  # Backend tests
```

## Key Differences from Traditional Projects

### ❌ What FLUO Does NOT Provide
- Docker images or container builds
- Kubernetes manifests or deployments
- Cloud provider integrations
- Infrastructure-as-code patterns
- Deployment automation scripts

### ✅ What FLUO Provides
- **Pure application packages** that run anywhere
- **Local development orchestration** for fast iteration
- **Supply chain security** through Nix dependency locking
- **Hot reload development** for both frontend and backend
- **Production-ready builds** that external tools can deploy

## Migration from Infrastructure-Coupled Architecture

If you encounter references to removed infrastructure components:

- **`/infra` directory**: Removed - use external deployment projects
- **Docker builds in flakes**: Removed - applications serve directly
- **Kubernetes manifests**: Removed - create external deployment projects
- **`lib.mkDeployment` functions**: Removed - focus on `packages` and `apps`
- **Cloud provider tools**: Removed - deployment is external concern

## External Examples and Templates

For deployment examples, see:
- **Kubernetes**: Create external flake that consumes FLUO packages
- **Docker**: Use Nix dockerTools in external project
- **Serverless**: Package FLUO applications for serverless platforms
- **Bare Metal**: Use FLUO applications directly on servers

## Future Development

When adding new features:
1. **Focus on application logic** - no deployment concerns
2. **Use Nix for dependency management** - maintain supply chain security
3. **Test locally first** - use `nix run .#dev` for rapid iteration
4. **Update documentation** - keep CLAUDE.md files current
5. **Follow pure application principles** - export packages and apps, not deployments

FLUO is designed to be a **pure application framework** that can be deployed anywhere, rather than a platform that dictates deployment patterns.