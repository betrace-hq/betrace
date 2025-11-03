# CLAUDE.md

## Agent Skills (Capabilities)
BeTrace uses Agent Skills for progressive disclosure of technical capabilities:
- `.skills/architecture/` - Pure application framework patterns, ADR compliance
- `.skills/security/` - OWASP review, compliance controls, cryptography
- `.skills/quality/` - Test coverage analysis, edge case detection
- `.skills/implementation/` - PRD execution, API/UI patterns
- `.skills/product/` - PRD creation from vague requirements
- `.skills/compliance/` - SOC2/HIPAA evidence generation
- `.skills/betrace-dsl/` - Write and validate BeTraceDSL rules for trace patterns
- `.skills/nix/` - Flake patterns, build optimization
- `.skills/flox/` - Flox environment management, service orchestration
- `.skills/react-tanstack/` - React frontend patterns
- `.skills/grafana-plugin/` - Grafana plugin development (App/Datasource)

**How Skills Work:**
- Each skill is a directory with `SKILL.md` (YAML metadata + instructions)
- Load skills dynamically based on task relevance
- Progressive disclosure: metadata → summary → detailed docs
- Answer: "How do we do this?" (technical execution)

## Subagents (Perspectives)
BeTrace uses perspective-based subagents that mirror enterprise team roles:
- `.subagents/product-manager/` - Customer value, market fit, prioritization
- `.subagents/engineering-manager/` - Team velocity, technical debt, capacity
- `.subagents/tech-lead/` - System design, scalability, architecture
- `.subagents/security-officer/` - Risk management, compliance, threats
- `.subagents/sre/` - Reliability, observability, production readiness
- `.subagents/business-analyst/` - ROI, stakeholder alignment, requirements
- `.subagents/customer-success/` - User experience, adoption, support
- `.subagents/grafana-product-owner/` - **VETO POWER**: Prevents building features Grafana already provides

**How Subagents Work:**
- Each subagent has `PERSPECTIVE.md` (role + decision framework)
- Provide stakeholder viewpoints on decisions
- Answer: "Should we do this? Why? For whom?" (strategic planning)
- Use skills for technical execution after perspective informs direction

**Skills vs. Subagents:**
- **Skills** = Technical capabilities (OWASP checklist, PRD template, test patterns)
- **Subagents** = Stakeholder perspectives (customer value, team capacity, security risk)
- **Workflow**: Subagent (perspective) → Skill (capability) → Implementation

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

**Key Insight:**
BeTrace provides **behavioral assurance through continuous production monitoring** - validating that systems behave as expected, catching violations that pre-deployment testing misses.

**Use Cases**: SRE incident prevention, compliance evidence generation, service contract validation, API misuse detection, and more.

**What BeTrace is NOT:**
- ❌ Not a SIEM/SOAR/security incident response platform
- ❌ Not an IOC-based threat detection system
- ❌ Not a generic observability/APM tool
- ❌ Not pre-deployment testing (we monitor production behavior)

## Quick Start

**Service orchestration managed by Flox** (see `.flox/env/manifest.toml`)

```bash
# Start all services (Grafana, Loki, Tempo, Prometheus, Pyroscope, Alloy, Backend)
flox services start

# Access points:
# Frontend:  http://localhost:12010
# Backend:   http://localhost:12011
# Grafana:   http://localhost:12015 (admin/admin)
# MCP Server: http://localhost:12016 (HTTP health checks)

# Check service status
flox services status

# Stop services
flox services stop
```

## MCP Server (AI Documentation Access)

BeTrace includes a Model Context Protocol (MCP) server that provides AI assistants with access to:
- ✅ BeTrace documentation (setup guides, DSL references, AI safety, compliance)
- ✅ BeTraceDSL rule creation from natural language
- ✅ DSL syntax validation with security limits
- ✅ Environment setup assistance (local, AWS, GCP, Azure)
- ✅ Troubleshooting guides for common issues

**Setup for Claude for Desktop:**
```bash
# MCP server runs automatically with `nix run .#dev`
# Configure Claude:
# 1. Open ~/Library/Application Support/Claude/claude_desktop_config.json
# 2. Add:
{
  "mcpServers": {
    "betrace": {
      "command": "node",
      "args": ["/absolute/path/to/betrace/mcp-server/dist/index.js"]
    }
  }
}
# 3. Restart Claude for Desktop
```

**Documentation**: See [mcp-server/README.md](mcp-server/README.md) for full setup and usage.

**Tools Available**:
- `create_betrace_dsl_rule` - Generate DSL from natural language
- `validate_betrace_dsl` - Check syntax and security limits
- `explain_betrace_setup` - Environment-specific setup guides
- `troubleshoot_betrace` - Diagnose common issues
- `search_betrace_docs` - Find documentation by keyword

## Project Structure

**Grafana-First Architecture** (ADR-022, ADR-027):
- `bff/` - React + Tanstack + Vite frontend (legacy, being phased out)
- `backend/` - Go (stdlib net/http) API with OpenTelemetry
- `grafana-betrace-app/` - Grafana App Plugin (primary UI)
- `flake.nix` - Build packages and dev shells (Nix)
- `.flox/env/manifest.toml` - Service orchestration (Flox)
- `.flox/pkgs/flake.nix` - Service wrappers (authoritative)

## Core Principles

1. **Pure Applications** - Export packages, not infrastructure
2. **Local Development First** - Instant startup, hot reload
3. **Deployment Agnostic** - External consumers handle deployment

## Development Commands

**Service Management (Flox):**
```bash
flox services start               # Start all services
flox services stop                # Stop all services
flox services status              # Check service status
flox services restart <service>   # Restart specific service (loki, tempo, grafana, backend, etc.)
```

**Development:**
```bash
# Start all services
flox services start

# Or individual dev servers
nix run .#frontend      # Frontend dev server only
nix run .#backend       # Backend dev server only
```

**Build & Test:**
```bash
nix build .#all                   # Build applications
nix run .#serve                   # Production preview

# Run tests
cd bff && npm test                # Frontend tests (Vitest)
cd backend && go test ./...       # Backend tests (Go)
```

**Fuzzing & Resilience Testing:**
```bash
# Backend: Deterministic simulation testing with random seeds
cd backend && CHAOS_SEED=12345 go test -run TestFuzzChaosMode ./internal/simulation -v

# Run 2500-test fuzzing campaign (CHAOS mode: 30% crash, 20% disk full)
cd backend && bash scripts/chaos-fuzzer.sh

# Check for bugs
cat backend/internal/simulation/.chaos-bugs.json

# Reproduce specific bug
CHAOS_SEED=<seed> go test -run TestFuzzChaosMode ./internal/simulation -v
```

**Testing Philosophy:**
BeTrace uses **deterministic simulation testing (DST)** with random seed fuzzing to validate fault tolerance:
- **Deterministic:** Same seed = same execution (reproducible bugs)
- **Fuzzing:** Random seeds explore thousands of execution paths
- **Results:** Found and fixed 16 critical bugs, improved fault recovery significantly (16 critical bugs fixed, measured over 2,500 test runs)
- See [docs/fuzzing-improved-resilience.md](docs/fuzzing-improved-resilience.md) for details

## Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite 6, Tanstack Router
- shadcn/ui, Tailwind CSS

**Backend:**
- Go 1.23, stdlib net/http
- OpenTelemetry integration
- 83.2% test coverage (138 tests, 0 race conditions)

**Development:**
- Nix Flakes (reproducible builds, packages, dev shells)
- Flox (service orchestration - see `.flox/env/manifest.toml`)
- Observability stack: Grafana, Loki, Tempo, Prometheus, Pyroscope, Alloy

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

## Development Workflow

**Service Management:**
```bash
flox services start              # Start all services
flox services stop               # Stop all services
flox services status             # Check service status
flox services restart <service>  # Restart specific service
```

**Build & Test:**
```bash
nix build .#all                  # Build all packages
cd bff && npm test               # Frontend tests
cd backend && go test ./...      # Backend tests
```

See [ADR-015](docs/adrs/015-development-workflow-and-quality-standards.md) for:
- Git workflow (conventional commits)
- Code quality standards
- Pre-commit requirements
- PR process

## Compliance by Design

BeTrace generates compliance evidence through trace patterns:

**Security Implementation Status:**
1. ✅ **PII Redaction Enforcement** - RedactionEnforcer with whitelist validation (COMPLETE)
2. ✅ **Compliance Span Signatures** - HMAC-SHA256 cryptographic integrity (COMPLETE)
3. ✅ **Rule Engine Sandboxing** - Bytecode-level isolation, 9.5/10 security rating (COMPLETE)
4. ⏸️ **Per-Tenant KMS Encryption** - Planned enhancement, not blocking production

**Implementation:**
- `@SOC2(controls = {CC6_1})` emits compliance spans automatically
- DSL rules validate patterns: `trace.has(pii.access) and trace.has(audit.log)`
- Evidence queryable via compliance API for auditors

**Current Status:** BeTrace is NOT certified for any compliance framework. See [docs/compliance-status.md](docs/compliance-status.md) and [docs/compliance.md](docs/compliance.md) for details.

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
