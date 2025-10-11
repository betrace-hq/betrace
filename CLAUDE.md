# CLAUDE.md

## Agent Configuration
- @~/.claude/general-instructions.md

## Architecture
- @docs/adrs/011-pure-application-framework.md
- @docs/adrs/015-development-workflow-and-quality-standards.md

## ⚡ FLUO's Core Purpose

**FLUO is a Behavioral Assurance System for OpenTelemetry Data**

Enables pattern matching on telemetry for:
1. **SREs**: Discover undocumented invariants that cause incidents
2. **Developers**: Define invariants to expose service misuse
3. **Compliance**: Match trace patterns to evidence control effectiveness

**Core Workflow:**
```
OpenTelemetry Traces → Rules (Invariants) → Signals (Violations) → Investigation
```

**What FLUO is NOT:**
- ❌ Not a SIEM/SOAR/security incident response platform
- ❌ Not an IOC-based threat detection system
- ❌ Not a generic observability/APM tool

## Quick Start

```bash
# Start development environment
nix run .#dev

# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
# Grafana:  http://localhost:12015
```

## Project Structure

**Pure Application Framework** (deployment-agnostic):
- `bff/` - React + Tanstack + Vite frontend
- `backend/` - Quarkus (Java 21) API
- `flake.nix` - Local development orchestration only

## Core Principles

1. **Pure Applications** - Export packages, not infrastructure
2. **Local Development First** - Instant startup, hot reload
3. **Deployment Agnostic** - External consumers handle deployment

## Development Commands

```bash
# Development
nix run .#dev           # Both apps with hot reload
nix run .#frontend      # Frontend only
nix run .#backend       # Backend only

# Build & Test
nix build .#all         # Build applications
nix run .#test          # Run tests
nix run .#serve         # Production preview

# Observability
nix run .#restart       # Restart observability services
```

## Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite 6, Tanstack Router
- shadcn/ui, Tailwind CSS

**Backend:**
- Java 21, Quarkus, Maven
- JUnit 5 testing

**Development:**
- Nix Flakes (reproducible builds)
- Grafana observability stack (local dev only)

## Key Constraints

**❌ FLUO Does NOT Provide:**
- Docker/container builds
- Kubernetes manifests
- Cloud integrations
- Deployment automation

**✅ FLUO Provides:**
- Pure application packages
- Local dev orchestration
- Supply chain security (Nix locks)
- Hot reload development

## Development Workflow

See @docs/adrs/015-development-workflow-and-quality-standards.md for:
- Git workflow (conventional commits)
- Code quality standards (90% coverage)
- Pre-commit requirements
- PR process

## Compliance by Design

FLUO generates compliance evidence through trace patterns:

**Security Principles:**
1. **Never log PII without @Redact** - Use RedactionStrategy.HASH for sensitive data
2. **Compliance spans must be signed** - Cryptographic integrity for audit evidence
3. **Rules are sandboxed** - DSL cannot access service layer or mutate state
4. **Tenant crypto isolation** - Per-tenant encryption keys via KMS

**Implementation:**
- `@SOC2(controls = {CC6_1})` emits compliance spans automatically
- DSL rules validate patterns: `trace.has(pii.access) and trace.has(audit.log)`
- Evidence queryable via compliance API for auditors

See @docs/compliance-status.md and @docs/compliance.md for details.

## External Deployment

Deployment is a **consumer responsibility**. Consumers create external flake projects:

```nix
# external-deploy/flake.nix
inputs.fluo.url = "github:org/fluo";
outputs = { fluo, ... }: {
  packages.deployment = deployWith {
    frontend = fluo.packages.x86_64-linux.frontend;
    backend = fluo.packages.x86_64-linux.backend;
  };
};
```
