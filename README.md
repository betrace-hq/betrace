# BeTrace Monorepo

This is the BeTrace Real-time Behavioral Assurance System monorepo, managed using Nix flakes.

## ⚡ BeTrace's Core Purpose

**BeTrace is a Grafana plugin for behavioral pattern matching on OpenTelemetry traces**

Enables pattern matching on telemetry for:
1. **SREs**: Discover undocumented invariants that cause incidents
2. **Developers**: Define invariants to expose service misuse
3. **Compliance**: Match trace patterns to evidence control effectiveness

**Core Workflow:**
```
OpenTelemetry Traces → Rules (Invariants) → ViolationSpans (to Tempo) → Grafana Alerts
```

### Market Validation

> "Hardware-enabled mechanisms could help customers and regulators to monitor general-purpose AI systems more effectively during deployment...but reliable mechanisms of this kind **do not yet exist**."
>
> — International Scientific Report on the Safety of Advanced AI (96 experts, 30+ countries, January 2025)

**BeTrace fills this gap** through behavioral assertions: continuous production monitoring where testing fails.

---

### ⚠️ Important Disclaimers

**What BeTrace is NOT:**
- ❌ Not a SIEM/SOAR/security incident response platform
- ❌ Not an IOC-based threat detection system
- ❌ Not a generic observability/APM tool
- ❌ Not pre-deployment testing (we monitor production behavior)
- ❌ Not SOC2/HIPAA certified (generates evidence, not certification—see [Compliance Status](./docs/compliance-status.md))

**What BeTrace IS:**
- ✅ A Grafana plugin for behavioral pattern matching
- ✅ A compliance evidence generation system (evidence ≠ certification)
- ✅ A local development environment for telemetry analysis
- ✅ A Pure Application Framework (external consumers handle deployment—see [ADR-011](./docs/adrs/011-pure-application-framework.md))

---

## 🚀 Distribution & Deployment

BeTrace is available through multiple distribution channels:

### 🐋 Docker (Available)
```bash
cd distribution/docker
nix run .#build-all
docker-compose up -d
```
**Guide:** [Docker Compose Quick Start](distribution/docs/docker-compose-quickstart.md)

### ☸️ Kubernetes (Available)
```bash
helm install betrace distribution/helm/betrace \
  --namespace betrace \
  --create-namespace
```
**Guide:** [Helm Chart README](distribution/helm/betrace/README.md)

### ❄️ FlakeHub (Available)
```nix
{
  inputs.betrace.url = "https://flakehub.com/f/betracehq/betrace/*.tar.gz";
}
```
**Workflow:** [.github/workflows/flakehub-publish.yml](.github/workflows/flakehub-publish.yml)

### 📚 All Distribution Options
See **[distribution/README.md](distribution/README.md)** for complete guide including:
- Docker images (backend, Grafana plugin)
- Helm charts (Kubernetes)
- FlakeHub (Nix)
- Integration with official Grafana Helm chart
- Future: nixpkgs submission

---

## Project Structure

**Pure Application Framework** (deployment-agnostic):
```
betrace/
├── backend/               # Go Backend (stdlib net/http)
├── bff/                   # React + Tanstack Frontend
├── grafana-betrace-app/   # Grafana App Plugin (primary UI)
├── docs/                  # Architecture Decision Records
├── distribution/          # External deployment targets
└── flake.nix              # Local development orchestration
```

## Quick Start

**Service orchestration managed by Flox** (see [.flox/env/manifest.toml](.flox/env/manifest.toml))

### Starting Services

Services must run within an activated flox environment:

```bash
# Option 1: Manual activation
flox activate --start-services
# Then in the activated shell:
flox services status

# Option 2: One-liner
flox activate -- bash -c "flox services start && bash"
```

**Access points:**
- Grafana:   http://localhost:12015 (admin/admin)
- Loki:      http://localhost:3100
- Tempo:     http://localhost:3200
- Prometheus: http://localhost:9090
- Pyroscope: http://localhost:4040
- Backend:   http://localhost:8080

**Stop services:**
```bash
# In activated environment:
flox services stop

# Or exit the flox shell (Ctrl+D)
```

⚠️ **Important**: Services only run while the flox environment is active. Keep the shell open!

## Development Commands

### Development Servers
```bash
# Start all services (managed by Flox)
flox services start

# Individual services
nix run .#frontend      # Frontend dev server only
nix run .#backend       # Backend dev server only
```

### Build & Test
```bash
nix build .#all                   # Build applications
nix run .#serve                   # Production preview
```

### Service Management (Flox)
```bash
flox services start               # Start all services
flox services stop                # Stop all services
flox services status              # Check service status
flox services restart <service>   # Restart specific service
```

### Development Environment
```bash
flox activate                     # Activate Flox environment (recommended)

# Component-specific shells (optional)
nix develop .#frontend            # Frontend environment (Node.js, npm, Vite)
nix develop .#backend             # Backend environment (Go, OpenTelemetry)
```

## Available Packages

```bash
nix build .#all                   # Build all applications
nix build .#frontend              # React frontend bundle
nix build .#backend               # Go backend binary
```

## Testing

```bash
# Frontend (Vitest)
cd bff && npm test

# Backend (Go)
cd backend && go test ./...
```

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
- Go 1.23, stdlib net/http
- OpenTelemetry integration
- 93.4% test coverage (61 tests)

**Development:**
- Nix Flakes (reproducible builds)
- Flox (service orchestration)
- Grafana observability stack (Loki, Tempo, Prometheus, Pyroscope, Alloy)

## Key Constraints

Per **ADR-011: Pure Application Framework**:

**❌ BeTrace Core Does NOT Provide:**
- Container image definitions (see [distribution/docker](distribution/docker/))
- Kubernetes manifests (see [distribution/helm](distribution/helm/))
- Cloud-specific integrations
- CI/CD pipelines

**✅ BeTrace Core Provides:**
- Pure application packages (backend, frontend, Grafana plugin)
- Local dev orchestration (Flox services + Nix builds)
- Supply chain security (Nix flake locks)
- Test infrastructure (90% instruction, 80% branch coverage)

**Development Environment:**
- **Flox** manages services ([.flox/env/manifest.toml](.flox/env/manifest.toml))
- **Nix Flakes** provide build packages and dev shells
- Services: Grafana, Loki, Tempo, Prometheus, Pyroscope, Alloy, Backend (with watch mode)

## External Deployment

Deployment is a **consumer responsibility**. See [distribution/README.md](distribution/README.md) for:

- **Docker Compose**: Quick start with pre-built images
- **Kubernetes/Helm**: Production-ready Helm chart
- **Nix Flakes**: Custom deployments using BeTrace as input

Example custom deployment:
```nix
# external-deploy/flake.nix
inputs.betrace.url = "github:betracehq/betrace";
outputs = { betrace, ... }: {
  packages.deployment = deployWith {
    backend = betrace.packages.x86_64-linux.backend;
    grafana-plugin = betrace.packages.x86_64-linux.grafana-plugin;
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