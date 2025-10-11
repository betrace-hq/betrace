# FLUO Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records documenting the technical decisions behind FLUO's design and implementation.

## Current Architecture Status

**FLUO** is a **Pure Application Framework** - deployment-agnostic applications that export packages, not infrastructure.

## Core Architecture ADRs

### Primary Architecture
| ADR | Title | Status | Date | Implementation |
|-----|-------|--------|------|----------------|
| [011](./011-pure-application-framework.md) | **Pure Application Framework** | ✅ Implemented | 2025-01-05 | Complete |
| [015](./015-development-workflow-and-quality-standards.md) | **Development Workflow and Quality Standards** | ✅ Implemented | 2025-10-10 | Complete |

### Supporting Infrastructure
| ADR | Title | Status | Date | Implementation |
|-----|-------|--------|------|----------------|
| [002](./002-nix-flakes-build-system.md) | Nix Flakes as Build System Foundation | ✅ Implemented | 2025-09-21 | Complete |
| [003](./003-monorepo-flake-composition.md) | Monorepo Structure with Flake Composition | ✅ Implemented | 2025-09-21 | Complete |
| [006](./006-tanstack-frontend-architecture.md) | Tanstack Ecosystem for Frontend Architecture | ✅ Implemented | 2025-09-21 | Complete |

## Legacy ADRs (Superseded)

These ADRs have been superseded by the Pure Application Framework approach:

| ADR | Title | Status | Date | Superseded By |
|-----|-------|--------|------|---------------|
| [001](./001-service-owned-deployment-modules.md) | Service-Owned Deployment Modules | 🔄 Superseded | 2025-09-21 | ADR-011 |
| [004](./004-kubernetes-native-infrastructure.md) | Kubernetes-Native Infrastructure Architecture | 🔄 Superseded | 2025-09-21 | ADR-011 |
| [005](./005-component-based-infrastructure.md) | Component-Based Infrastructure Modules | 🔄 Superseded | 2025-09-21 | ADR-011 |
| [007](./007-nats-message-broker.md) | NATS as Message Broker Architecture | 📋 Deferred | 2025-09-21 | Future feature |
| [008](./008-cross-platform-build-strategy.md) | Cross-Platform Build Strategy | ✅ Implemented | 2025-09-21 | Via Nix |
| [009](./009-modular-configuration-management.md) | Modular Configuration Management | ✅ Implemented | 2025-09-21 | Via Nix |
| [010](./010-rag-documentation-system.md) | RAG Documentation System | 📋 Deferred | 2025-09-22 | Future feature |
| [012](./012-mathematical-tenant-isolation-architecture.md) | Mathematical Tenant Isolation Architecture | 📋 Deferred | 2025-01-05 | Future feature |
| [013](./013-apache-camel-first-architecture.md) | Apache Camel-First Architecture | 📋 Deferred | 2025-09-26 | Future feature |
| [014](./014-camel-testing-and-organization-standards.md) | Camel Testing and Code Organization Standards | 📋 Deferred | 2025-09-26 | Future feature |

## ADR Template

Use the following template when creating new ADRs:

```markdown
# ADR-XXX: [Title]

**Status:** [Proposed/Accepted/Superseded/Deprecated]
**Date:** YYYY-MM-DD
**Deciders:** [Architecture Team/Individual Names]

## Context

Describe the context and problem statement that led to this decision.

### Problem Statement

What specific problems are we trying to solve?

## Decision

What decision was made and how it will be implemented.

## Alternatives Considered

What other options were evaluated?

## Consequences

### Positive
- Benefits of this decision

### Negative
- Drawbacks or limitations

### Mitigation Strategies
- How negative consequences will be addressed

## Implementation Status

Current status and next steps.

## References

- Links to relevant documentation, discussions, or related ADRs
```

## Contributing

When proposing new architectural decisions:

1. **Create a new ADR** using the template above
2. **Discuss with the team** before marking as "Accepted"
3. **Update this index** with the new ADR
4. **Cross-reference** related ADRs when applicable
5. **Update CLAUDE.md** files if the decision affects development guidance

## Development Quick Start

```bash
# Start complete development environment
git clone <repository>
cd fluo
nix run .#dev

# Services available:
# Frontend:     http://localhost:3000
# Backend API:  http://localhost:8080
# Grafana:      http://localhost:12015
```

## Current Implementation

### ✅ Pure Application Framework
- **Frontend**: React + Tanstack + Vite
- **Backend**: Quarkus API (Java 21)
- **Development Observability**: Grafana, Loki, Tempo, Prometheus, Pyroscope, Alloy
- **Build System**: Nix Flakes for reproducible builds
- **Supply Chain Security**: All dependencies locked with cryptographic hashes

### ✅ Core Principles
- **Deployment Agnostic**: Applications export packages, not infrastructure
- **Local Development First**: Instant startup with `nix run .#dev`
- **Reproducible Builds**: Nix-based dependency management
- **Hot Reload**: Both frontend and backend support live reload
- **No Infrastructure Dependencies**: External consumers handle deployment

## Architectural Principles

The current ADRs reflect FLUO's evolved architectural principles:

- **Pure Applications**: Deployment-agnostic with external orchestration
- **Reproducible Builds**: Nix-based dependency management with supply chain security
- **Quality Standards**: 90% instruction coverage, conventional commits, code review
- **Local Development**: Rich local development experience with observability stack
