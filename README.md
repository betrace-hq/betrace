# BeTrace - v1.0 Candidate (Infrastructure Complete)

**Status**: 85% Complete - E2E Tests Unvalidated ⚠️
**Version**: 2.0.0 (v1.0 candidate)

BeTrace is a Grafana plugin for behavioral pattern matching on OpenTelemetry traces.

**All infrastructure complete. E2E tests created but not validated (0/36 passing when run).**

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

### Key Insight

BeTrace provides **behavioral assurance through continuous production monitoring** - validating that systems behave as expected, catching violations that pre-deployment testing misses.

**Use Cases**: SRE incident prevention, compliance evidence generation, service contract validation, API misuse detection, and AI system monitoring.

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

See **[distribution/README.md](distribution/README.md)** for deployment options:
- Docker Compose
- Kubernetes (Helm)
- Nix Flakes

---

## Project Structure

```
betrace/
├── backend/               # Go backend
├── grafana-betrace-app/   # Grafana plugin
├── mcp-server/            # AI documentation server
├── docs/                  # Documentation & ADRs
└── distribution/          # Deployment configurations
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
- Backend:   http://localhost:12011
- Loki:      http://localhost:3100
- Tempo:     http://localhost:3200
- Prometheus: http://localhost:9090
- Pyroscope: http://localhost:4040

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
- Comprehensive test suite with deterministic fuzzing

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
- Comprehensive test infrastructure with deterministic fuzzing

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

## 🎯 v1.0 Release Status

**Development**: 100% Complete ✅
**Testing Infrastructure**: 100% Complete ✅
**Test Execution**: 0% Complete ❌ (0/36 passing)
**Documentation**: 100% Complete ✅

**Remaining**: Fix E2E test failures, validate tests pass

### What's Complete

- ✅ Backend: 83.2% test coverage, zero race conditions, 3.78M spans/sec
- ✅ Grafana Plugin: Rules management, violations, trace drilldown, Tempo integration
- ✅ E2E Testing Infrastructure: 36 test files with page objects, CI/CD workflow
- ✅ Distribution: Plugin signing automation (3 scripts)
- ✅ Documentation: 26,077+ lines (USER_GUIDE, OPERATOR_GUIDE, API_REFERENCE, runbooks)

### What's NOT Complete

- ❌ E2E Tests: Infrastructure exists but 0/36 passing when run
- ❌ Test Validation: All tests timeout (Grafana not accessible)
- ⚠️ Root Cause: Services require persistent flox shell, tests designed for manual execution

### Honest Path to v1.0

See **[E2E_TEST_STATUS.md](E2E_TEST_STATUS.md)** for test run evidence.

User must:
1. Start services in Terminal 1: `flox activate --start-services` (keep open)
2. Run tests in Terminal 2: `cd grafana-betrace-app && npx playwright test`
3. Debug and fix why all 36 tests fail at navigation
4. Re-run until tests pass
5. Then: Generate GPG keys, run load tests, package plugin

**Reality**: Tests must pass before v1.0 release.

---

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

BeTrace generates compliance evidence through trace patterns.

**Implementation:**
- PII redaction enforcement with whitelist validation
- HMAC-SHA256 span signatures for tamper-evidence
- Rule engine sandboxing (9.5/10 security rating)

**Status:** NOT certified for any compliance framework. See [compliance-status.md](./docs/compliance-status.md) for details.

## Documentation

- [CLAUDE.md](./CLAUDE.md) - AI assistant instructions
- [Backend Documentation](./backend/README.md)
- [Architecture Decision Records](./docs/adrs/)
- [Compliance Documentation](./docs/compliance.md)