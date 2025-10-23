# BeTrace Monorepo

This is the BeTrace Real-time Behavioral Assurance System monorepo, managed using Nix flakes.

## ⚡ BeTrace's Core Purpose

**BeTrace is a Behavioral Assurance System for OpenTelemetry Data**

Enables pattern matching on telemetry for:
1. **SREs**: Discover undocumented invariants that cause incidents
   *"Why did this incident take 14 days to root-cause?"*
2. **Developers**: Define invariants to expose service misuse
   *"Catch API contract violations before they reach production"*
3. **Compliance**: Match trace patterns to evidence control effectiveness
   *"Prove SOC2 controls work—not just that they exist"*

**Core Workflow:**
```
OpenTelemetry Traces → Rules (Invariants) → Signals (Violations) → Investigation
```

### Why BeTrace?

Traditional observability is **forensic** (collect everything, search during incidents). BeTrace is **behavioral** (validate patterns continuously, detect violations in real-time).

**Real-World Impact:**
- 💰 **Cost**: $3.13M/year Datadog → $153K/year (Tempo + BeTrace) = 95% reduction
- ⏱️ **Speed**: 14-day incident investigation → 30 seconds (rule replay)
- 🎯 **Coverage**: 99% trace sampling → 100% pattern validation
- 🔒 **Compliance**: 160 hours manual evidence → 10 hours automated spans

### Whitepapers

Deep dives into BeTrace's architecture and use cases:

- 📊 [**The Economics of Observability**](./marketing/whitepapers/economics-of-observability.md) - When more data costs less than missing patterns
- 🔍 [**The Hidden Cost of Invariants**](./marketing/whitepapers/hidden-cost-undocumented-invariants.md) - How unknown business rules cost $93K per incident
- 🔐 [**Multi-Tenant Security**](./marketing/whitepapers/multi-tenant-security.md) - Proving isolation with behavioral assurance
- ✅ [**Compliance Evidence Automation**](./marketing/whitepapers/compliance-evidence-automation.md) - From checkbox compliance to behavioral proof

---

### ⚠️ Important Disclaimers

**BeTrace is NOT:**
- ❌ A deployment platform (it's a Pure Application Framework—see [ADR-011](./docs/adrs/011-pure-application-framework.md))
- ❌ SOC2/HIPAA certified (generates evidence, not certification—see [Compliance Status](./docs/compliance-status.md))
- ❌ A SIEM/SOAR tool (behavioral assurance, not security detection)

**BeTrace IS:**
- ✅ A pattern matching framework for OpenTelemetry traces
- ✅ A compliance evidence generation system (evidence ≠ certification)
- ✅ A local development environment for telemetry analysis
- ✅ A Pure Application Framework (external consumers handle deployment)

---

## 🚀 Distribution & Deployment

BeTrace is available through multiple distribution channels:

### 🐋 Docker (Quick Start)
```bash
cd distribution/docker
nix run .#build-all
docker-compose up -d
# Access Grafana: http://localhost:3000 (admin/admin)
```
**Guide:** [Docker Compose Quick Start](distribution/docs/docker-compose-quickstart.md)

### ☸️ Kubernetes (Helm Chart)
```bash
helm install betrace distribution/helm/betrace \
  --namespace betrace \
  --create-namespace
```
**Guide:** [Helm Chart README](distribution/helm/betrace/README.md)

### ❄️ Nix Flakes (FlakeHub)
```nix
{
  inputs.betrace.url = "https://flakehub.com/f/betracehq/betrace/*.tar.gz";
}
```
**Guide:** [FlakeHub Publishing](.github/workflows/flakehub-publish.yml)

### 📚 All Distribution Options
See **[distribution/README.md](distribution/README.md)** for complete distribution guide including:
- Docker images (ghcr.io)
- Helm charts (Kubernetes)
- FlakeHub (Nix)
- Integration with official Grafana Helm chart
- Future: nixpkgs submission

---

## Project Structure

**Pure Application Framework** (deployment-agnostic):
```
betrace/
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

BeTrace includes a comprehensive test runner with:

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

BeTrace follows the **Pure Application Framework** architecture (ADR-011):

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

**❌ BeTrace Does NOT Provide:**
- Docker/container builds
- Kubernetes manifests
- Cloud integrations
- Deployment automation

**✅ BeTrace Provides:**
- Pure application packages
- Local dev orchestration
- Supply chain security (Nix locks)
- Hot reload development

## External Deployment

Deployment is a **consumer responsibility**. Consumers create external flake projects:

```nix
# external-deploy/flake.nix
inputs.betrace.url = "github:org/betrace";
outputs = { betrace, ... }: {
  packages.deployment = deployWith {
    frontend = betrace.packages.x86_64-linux.frontend;
    backend = betrace.packages.x86_64-linux.backend;
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

BeTrace generates compliance evidence through trace patterns:

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