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
- `.skills/java-quarkus/` - Quarkus backend patterns
- `.skills/react-tanstack/` - React frontend patterns
- `.skills/otel-processor/` - OTEL Collector processor development (Go)
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
4. **AI Safety**: Monitor AI system behavior in production (agents, hallucinations, bias)

**Core Workflow:**
```
OpenTelemetry Traces → Rules (Invariants) → ViolationSpans (to Tempo) → Grafana Alerts
```

**Market Validation:**
> "Hardware-enabled mechanisms could help customers and regulators to monitor general-purpose AI systems more effectively during deployment...but reliable mechanisms of this kind **do not yet exist**."
>
> — International Scientific Report on the Safety of Advanced AI (96 experts, 30+ countries, January 2025)

**BeTrace fills this gap** through behavioral assertions: continuous production monitoring where testing fails.

**What BeTrace is NOT:**
- ❌ Not a SIEM/SOAR/security incident response platform
- ❌ Not an IOC-based threat detection system
- ❌ Not a generic observability/APM tool
- ❌ Not pre-deployment testing (we monitor production behavior)

## Quick Start

```bash
# Start development environment
nix run .#dev

# Access points (via Caddy proxy at localhost:3000):
# Frontend (BFF):        http://localhost:3000
# Backend API:           http://api.localhost:3000
# Grafana + BeTrace Plugin: http://grafana.localhost:3000
# Process Compose UI:    http://process-compose.localhost:3000

# Direct ports (without proxy):
# Frontend:  localhost:12010
# Backend:   localhost:12011
# Grafana:   localhost:12015
# MCP Server: localhost:12016 (HTTP health checks)
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
- `backend/` - Quarkus (Java 21) API (single-tenant)
- `grafana-betrace-app/` - Grafana App Plugin (primary UI)
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
nix run .#test          # Run tests once with coverage
nix run .#test-watch    # Continuous testing (file watcher)
nix run .#test-tui      # Interactive TUI with live results
nix run .#test-coverage # Serve HTML coverage reports on :12099
nix run .#validate-coverage  # Check 90% instruction, 80% branch thresholds
nix run .#serve         # Production preview

# Observability
nix run .#restart       # Restart observability services
```

## Shell Prompt Integration

BeTrace includes a custom ZSH prompt that displays test stats directly in your command line:

**Example Prompt:**
```
~/Projects/betrace  main ✅ 94/94 89%
➜
```

**What it shows:**
- Current directory (blue)
- Git branch (green if clean, yellow* if uncommitted changes)
- Test results: `✅ passed/total coverage%` or `❌ failed/total`
- Stats appear when test results are < 30 minutes old

**Setup:**

The prompt is automatically configured via `.envrc` (direnv):
```bash
cd /path/to/betrace      # direnv automatically sets up prompt
```

Or manually:
```bash
nix develop           # Sets up on first run in shellHook
nix run .#setup-prompt  # Manual setup/reconfiguration
```

The prompt configuration is automatically activated when you:
1. Enter the project directory (via direnv `.envrc`)
2. Run `nix develop` (via shellHook)
3. Source `~/.zshrc` (persistent across all shells)

## Test Runner Features

The test-runner provides a fully-featured development experience:

**Features:**
- ✅ Runs BFF (Vitest) and Backend (JUnit) tests in parallel
- ✅ File watching with auto-execution on changes
- ✅ Real-time coverage tracking (90% instruction, 80% branch thresholds)
- ✅ Beautiful TUI with progress bars and color-coded results
- ✅ HTML coverage reports (Istanbul + JaCoCo)
- ✅ Test result history tracking (last 50 runs)
- ✅ Coverage trend analysis
- ✅ Desktop notifications with icons and sounds (✅/❌/⚠️)
- ✅ Process-compose orchestration

**Usage Patterns:**

```bash
# Quick test run with summary
nix run .#test

# Watch mode for TDD workflow
nix run .#test-watch

# 🎮 Interactive TUI Dashboard (the good stuff!)
nix run .#test-tui

# View detailed coverage reports
nix run .#test-coverage
# Opens: http://localhost:12099
```

**Interactive TUI Features:**
- 📊 Live test results dashboard with color-coded status
- 🚀 Run all tests, frontend only, or backend only
- 🔄 Re-run only failed tests
- 📈 View coverage trends over time
- 🔍 Inspect failed test details
- 📊 Open coverage reports in browser
- 🧹 Clear test cache
- All with beautiful `gum` styling and keyboard navigation!

**Test Results Location:**
- `/tmp/betrace-test-results/` - All test artifacts
- `/tmp/betrace-test-results/coverage/` - Coverage data
- `/tmp/betrace-test-results/reports/` - Test result summaries
- `/tmp/betrace-test-results/history/` - Historical data (last 50 runs)

**Coverage Thresholds (enforced):**
- Instruction coverage: 90% minimum
- Branch coverage: 80% minimum

Configure via environment variables:
```bash
export BETRACE_COVERAGE_INSTRUCTION_MIN=90
export BETRACE_COVERAGE_BRANCH_MIN=80
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

See @docs/adrs/015-development-workflow-and-quality-standards.md for:
- Git workflow (conventional commits)
- Code quality standards (90% coverage)
- Pre-commit requirements
- PR process

## Enterprise AI Safety

**As validated by the International AI Safety Report**, BeTrace addresses three critical gaps in AI risk management:

### 1. AI Agent Monitoring (Q1 2025 Priority)
**Report Finding**: "Testing is insufficient for agents because they can distinguish test from production"

**BeTrace Solution**: Runtime behavioral monitoring
```javascript
// Goal deviation detection
trace.has(agent.plan.created) and trace.has(agent.plan.executed)
trace.goal_deviation(original_goal, current_actions) < threshold

// Prompt injection / hijacking detection
trace.has(agent.instruction_source) and source not in [authorized_list]

// Tool use authorization
trace.has(agent.tool_use) and tool requires human_approval
```

**Use Cases**: Legal research agents, customer service agents, code generation agents

### 2. Hallucination Detection
**Report Finding**: "AI generates false statements...particularly concerning in high-risk domains"

**BeTrace Solution**: Pattern-based reliability verification
```javascript
// Medical diagnosis requires citations
trace.has(medical.diagnosis) and not trace.has(source_citation)

// Low-confidence claims require disclosure
trace.has(factual_claim) and confidence < 0.7
  and not trace.has(uncertainty_disclosure)
```

**Use Cases**: Healthcare clinical decision support, legal advice systems, financial recommendations

### 3. Bias Detection
**Report Finding**: "New evidence...has revealed more subtle forms of bias"

**BeTrace Solution**: Statistical distribution analysis
```javascript
// Hiring bias detection
trace.has(hiring.decision)
  and distribution_by(candidate.race) != expected_distribution

// Lending bias detection
trace.has(loan.approval_decision)
  and approval_rate_by(applicant.gender) has statistical_anomaly
```

**Use Cases**: Hiring AI, lending decisions, healthcare treatment recommendations

**For detailed implementation**: See @marketing/docs/AI-SAFETY-FOR-ENTERPRISE.md

## Compliance by Design

BeTrace generates compliance evidence through trace patterns:

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
inputs.betrace.url = "github:org/betrace";
outputs = { betrace, ... }: {
  packages.deployment = deployWith {
    frontend = betrace.packages.x86_64-linux.frontend;
    backend = betrace.packages.x86_64-linux.backend;
  };
};
```
