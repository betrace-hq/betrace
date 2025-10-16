# FLUO Monorepo

This is the FLUO Real-time Behavioral Assurance System monorepo, managed using Nix flakes.

## ⚡ FLUO's Core Purpose

**FLUO is a Behavioral Assurance System for OpenTelemetry Data**

Enables pattern matching on telemetry for:
1. **SREs**: Discover undocumented invariants that cause incidents
2. **Developers**: Define invariants to expose service misuse
3. **Compliance**: Match trace patterns to evidence control effectiveness
4. **AI Safety**: Monitor AI system behavior in production (agents, hallucinations, bias)

**Core Workflow:**
```
OpenTelemetry Traces → Rules (Invariants) → Signals (Violations) → Investigation
```

**Market Validation:**
> "Hardware-enabled mechanisms could help customers and regulators to monitor general-purpose AI systems more effectively during deployment...but reliable mechanisms of this kind **do not yet exist**."
>
> — [International Scientific Report on the Safety of Advanced AI](https://www.aisafetyreport.org/) (96 experts, 30+ countries, January 2025)

**FLUO fills this gap** through behavioral assurance: continuous production monitoring where pre-deployment testing fails. See [Enterprise AI Safety Guide](./marketing/docs/AI-SAFETY-FOR-ENTERPRISE.md) for implementation details.

## Project Structure

**Pure Application Framework** (deployment-agnostic):
```
fluo/
├── backend/     # Quarkus Backend (Java 21)
├── bff/         # Tanstack React Frontend (TypeScript)
├── docs/        # Architecture Decision Records and documentation
└── flake.nix    # Local development orchestration
```

## Quick Start

Start the development environment:
```bash
nix run .#dev
# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
# Grafana:  http://localhost:12015
```

## Development Commands

### Development Servers
```bash
nix run .#dev           # Both apps with hot reload
nix run .#frontend      # Frontend only
nix run .#backend       # Backend only
```

### Build & Test
```bash
nix build .#all                   # Build applications
nix run .#test                    # Run tests once with coverage
nix run .#test-watch              # Continuous testing (file watcher)
nix run .#test-tui                # Interactive TUI with live results
nix run .#test-coverage           # Serve HTML coverage reports on :12099
nix run .#validate-coverage       # Check 90% instruction, 80% branch thresholds
nix run .#serve                   # Production preview
```

### Observability
```bash
nix run .#restart                 # Restart observability services
nix run .#status                  # Check project status
```

### Development Shells
```bash
nix develop                       # Default monorepo environment
nix develop .#frontend            # Frontend environment (Node.js, npm, Vite)
nix develop .#backend             # Backend environment (Java 21, Maven, Quarkus)
```

## Available Packages

```bash
nix build .#all                   # Build all applications
nix build .#frontend              # React frontend bundle
nix build .#backend               # Quarkus backend JAR
```

## Test Runner Features

FLUO includes a comprehensive test runner with:

- ✅ Parallel test execution (Vitest + JUnit)
- ✅ File watching with auto-execution
- ✅ Real-time coverage tracking (90% instruction, 80% branch thresholds)
- ✅ Beautiful TUI with progress bars
- ✅ HTML coverage reports (Istanbul + JaCoCo)
- ✅ Test result history (last 50 runs)
- ✅ Desktop notifications

**Interactive TUI Dashboard:**
```bash
nix run .#test-tui
```

Features:
- 📊 Live test results with color-coded status
- 🚀 Run all tests or specific suites
- 🔄 Re-run only failed tests
- 📈 View coverage trends
- 📊 Open coverage reports in browser

## Architecture

FLUO follows the **Pure Application Framework** architecture (ADR-011):

### Core Principles

1. **Pure Applications** - Export packages, not infrastructure
2. **Local Development First** - Instant startup, hot reload
3. **Deployment Agnostic** - External consumers handle deployment

### Key Architectural Decisions

📋 **[Architecture Decision Records](./docs/adrs/)**

- **[ADR-011: Pure Application Framework](./docs/adrs/011-pure-application-framework.md)** - Core architecture
- **[ADR-015: Development Workflow and Quality Standards](./docs/adrs/015-development-workflow-and-quality-standards.md)** - Quality standards
- **[ADR-002: Nix Flakes as Build System](./docs/adrs/002-nix-flakes-build-system.md)** - Reproducible builds
- **[ADR-003: Monorepo with Flake Composition](./docs/adrs/003-monorepo-flake-composition.md)** - Project structure

### Technology Stack

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

## Validation

```bash
nix flake check                   # Run all checks
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

## Development Workflow

See [ADR-015: Development Workflow and Quality Standards](./docs/adrs/015-development-workflow-and-quality-standards.md) for:
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

See [compliance-status.md](./docs/compliance-status.md) and [compliance.md](./docs/compliance.md) for details.

## Documentation

- [CLAUDE.md](./CLAUDE.md) - AI assistant instructions
- [Backend Documentation](./backend/README.md)
- [Architecture Decision Records](./docs/adrs/)
- [Compliance Documentation](./docs/compliance.md)
- [Test Runner Guide](./docs/test-runner-guide.md)