# BeTrace Feature Status

**Last Updated:** 2025-10-16
**Purpose:** Definitive source of truth for shipped vs. planned BeTrace features

---

## ✅ Shipped and Stable

These features are **production-ready** and tested:

### Core Pattern Matching
- ✅ **BeTrace DSL** - Pattern matching language for OpenTelemetry traces
  - Syntax: `trace.has(span_name).where(condition)`
  - Complex patterns: Multi-span sequences, when/always/never logic
  - Parser: Participle-based (Go)
  - File: `backend/internal/dsl/parser.go`

- ✅ **Rule Engine** - Go-native AST evaluation for pattern matching
  - Parses DSL to AST, caches compiled rules
  - < 1ms evaluation per trace
  - Rule isolation via in-memory storage
  - File: `backend/internal/rules/engine.go`

- ✅ **Rule Replay** - Retroactive pattern detection on historical traces
  - Query historical traces from DuckDB/Tempo
  - Apply current rules to past data
  - Discover violations that would have been missed
  - File: `backend/src/main/java/com/betrace/services/RuleReplayService.java`

### Compliance Evidence
- ✅ **Compliance Annotations** - Java annotations for evidence generation
  - `@SOC2(controls = {CC6_1})` - SOC2 Trust Service Criteria
  - `@HIPAA(safeguards = {_164_312_a})` - HIPAA Technical Safeguards
  - Auto-generates compliance spans on annotated methods
  - Source: `github:betracehq/compliance-as-code#java-soc2`

- ✅ **Compliance Spans** - Immutable evidence records
  - Cryptographically signed (HMAC-SHA256)
  - Tamper-evident audit trail
  - Queryable via TraceQL: `{span.compliance.framework = "soc2"}`
  - File: `backend/src/main/java/com/betrace/compliance/evidence/ComplianceSpan.java`

- ✅ **PII Redaction** - Automatic sensitive data protection
  - Whitelist-based attribute validation
  - Throws PIILeakageException on unredacted PII
  - Enforced before OTel export
  - File: `backend/src/main/java/com/betrace/compliance/evidence/RedactionEnforcer.java`

### Signal Generation
- ✅ **Signal Model** - Invariant violation events
  - Severity levels (INFO, WARNING, CRITICAL)
  - Trace correlation (links to violating traces)
  - Metadata for investigation
  - File: `backend/src/main/java/com/betrace/models/Signal.java`

- ✅ **Signal API** - Query and manage signals
  - REST endpoints for signal retrieval
  - Filtering by severity, tenant, time range
  - File: `backend/src/main/java/com/betrace/routes/SignalRoutes.java`

### Development Environment
- ✅ **Local Dev Orchestration** - Hot reload development
  - `nix run .#dev` - Start frontend + backend + observability stack
  - Frontend: React 18 + Vite 6 + Tanstack Router
  - Backend: Quarkus + Maven live reload
  - Grafana: http://localhost:12015

- ✅ **Test Infrastructure** - Comprehensive testing
  - `nix run .#test` - Run all tests with coverage
  - `nix run .#test-tui` - Interactive TUI dashboard
  - Coverage thresholds: 90% instruction, 80% branch
  - File: `test-runner.nix`

### OpenTelemetry Integration
- ✅ **Span Ingestion** - Accepts OTel traces
  - OTLP/HTTP endpoint
  - Span validation and parsing
  - File: `backend/src/main/java/com/betrace/models/Span.java`

- ✅ **DuckDB Storage** - Analytical trace database
  - Columnar storage for fast queries
  - Per-tenant isolation
  - Time-range queries for rule replay
  - File: `backend/src/main/java/com/betrace/database/`

---

## ❌ Not Yet Shipped

These features are **NOT implemented**. Marketing content should NOT claim these as current capabilities.

### Deployment & Infrastructure
- ❌ **Production Deployment Platform** - BeTrace is a Pure Application Framework (ADR-011)
  - External consumers create deployment flakes
  - No built-in Kubernetes manifests
  - No Docker image generation
  - No cloud provider integration
  - See: [ADR-011](./adrs/011-pure-application-framework.md)

- ❌ **One-Click Deployment** - Not provided
  - BeTrace exports packages, not deployments
  - Consumers handle deployment strategy

### Compliance Certification
- ❌ **SOC2 Certification** - Evidence generation ≠ certification
  - BeTrace generates compliance spans (✅ shipped)
  - External auditor required for certification (❌ not provided)
  - Timeline: 12-18 months + external audit
  - See: [Compliance Status](./compliance-status.md)

- ❌ **HIPAA Compliance** - Same as SOC2
  - Evidence generation: ✅ Shipped
  - Certification: ❌ Not provided
  - Requires BAAs, policies, external assessment

- ❌ **Evidence Export API** - Manual export via Grafana/Tempo
  - Planned: Dedicated API for auditors
  - Current: Use TraceQL queries directly
  - Priority: P2 (customer validation needed)

### Chaos Engineering Integration
- ❌ **Automated Chaos Workflows** - Manual process only
  - BeTrace validates behavior during chaos tests (✅ shipped)
  - Chaos experiment automation (❌ not implemented)
  - GitHub Actions integration (❌ not implemented)
  - Gremlin/Chaos Mesh connectors (❌ not implemented)

- ❌ **Chaos Experiment Orchestration** - Not a BeTrace feature
  - Use external chaos tools (Gremlin, Chaos Mesh, Litmus)
  - Export traces to BeTrace for validation

### AI Agent Monitoring
- ❌ **AI Agent Safety Features** - OUT OF SCOPE
  - Deleted per team consensus (2025-10-16)
  - Conflicts with BeTrace vision (behavioral assurance, not security detection)
  - If demand emerges: Separate product, not BeTrace extension
  - See: [Team Consensus](../TEAM-CONSENSUS-ACTIONS.md)

### Platform Engineering Features
- ❌ **Maturity Model** - Not implemented
  - DSL can validate platform patterns (✅ generic capability)
  - Maturity scoring algorithm (❌ not implemented)
  - Platform standards dashboard (❌ not implemented)

- ❌ **Pre-Built Pattern Libraries** - Not implemented
  - API gateway patterns (❌ library doesn't exist)
  - Service mesh patterns (❌ not implemented)
  - Golden path templates (❌ not implemented)

### Incident Response Automation
- ❌ **Ticketing Integration** - Not implemented
  - PagerDuty connector (❌ not implemented)
  - Jira automation (❌ not implemented)
  - Slack notifications (❌ not implemented)

- ❌ **Runbook Automation** - Not a BeTrace feature
  - BeTrace generates signals (✅ shipped)
  - Automation tooling (❌ external responsibility)

### Security Features
- ❌ **SIEM/SOAR Capabilities** - OUT OF SCOPE
  - BeTrace is behavioral assurance, NOT security detection
  - IOC-based threat detection (❌ not a feature)
  - Security incident response (❌ not a feature)
  - See: [CLAUDE.md](../CLAUDE.md#core-purpose)

- ❌ **Per-Tenant KMS Encryption** - Planned, not blocking
  - Current: Shared master key
  - Planned: Per-tenant DEKs with AWS KMS/GCP Cloud KMS
  - Priority: P1 (not blocking production)
  - See: [Compliance Status](./compliance-status.md#p1-tenant-cryptographic-isolation)

---

## 🚧 In Progress

These features are **actively being developed**:

### PRD-005 Phase 2: Rule Engine Sandboxing
- **Status:** Phase 1 complete (9.5/10 security rating)
- **Phase 2 Goal:** 10/10 security rating
- **Current Gaps:**
  - Minor bytecode-level enforcement improvements
  - Additional capability restrictions
- **Timeline:** 2-4 weeks
- **See:** PRD-005 documentation

### Marketing Content Validation
- **Status:** Pre-launch validation (this document created as part of process)
- **Goal:** Ensure all public content describes shipped features only
- **Timeline:** 1 week (before launch)
- **See:** [Pre-Launch Validation Report](../marketing/PRE-LAUNCH-VALIDATION-REPORT.md)

---

## 📅 Roadmap (Future)

These features are **validated for demand** but not yet scheduled:

### High Demand (Customer Validation Complete)
- **Compliance Evidence Export API** - Auditor-friendly export format
- **Multi-Tenant KMS Integration** - Per-tenant encryption keys
- **Rule Suggestion Engine** - AI-assisted invariant discovery

### Medium Demand (Needs Customer Validation)
- **Platform Pattern Library** - Pre-built patterns for common use cases
- **Chaos Engineering Rewrite** - Manual workflow guidance (not automation)
- **Service Mesh Integration** - Istio/Linkerd pattern templates

### Low Demand (Speculative)
- **API Gateway Patterns** - Gateway-specific DSL helpers
- **Incident Response Connectors** - PagerDuty/Jira integrations
- **Maturity Scoring** - Platform engineering assessment

---

## 🎯 How to Use This Document

### For Marketing
- **DO claim:** Features in "✅ Shipped and Stable"
- **DO NOT claim:** Features in "❌ Not Yet Shipped"
- **Clarify:** Features in "🚧 In Progress" as "coming soon"

### For Sales
- **Demo:** Shipped features only
- **Roadmap discussions:** Future features with "no timeline commitment"
- **Compliance:** Always clarify "evidence generation, not certification"

### For Engineering
- **Reference:** This document before making feature claims
- **Update:** This document when features ship or are deprecated
- **Review:** Quarterly to ensure accuracy

---

## 📖 Related Documents

**Architecture:**
- [ADR-011: Pure Application Framework](./adrs/011-pure-application-framework.md) - Why BeTrace doesn't provide deployment
- [ADR-015: Development Workflow](./adrs/015-development-workflow-and-quality-standards.md) - Quality standards
- [ADR-019: Marketing Directory Boundaries](./adrs/019-marketing-directory-boundaries.md) - Content-only policy

**Status:**
- [Compliance Status](./compliance-status.md) - What's really shipped for compliance
- [CLAUDE.md](../CLAUDE.md) - Core purpose and non-goals

**Marketing:**
- [Pre-Launch Validation Report](../marketing/PRE-LAUNCH-VALIDATION-REPORT.md) - Content accuracy audit
- [Whitepaper Feature Audit](../marketing/WHITEPAPER-FEATURE-AUDIT.md) - Whitepaper vs. shipped features

---

## ⚠️ Important Disclaimers

**BeTrace is NOT:**
- ❌ A deployment platform (it's a Pure Application Framework per ADR-011)
- ❌ A compliance certification (it generates evidence, not certification)
- ❌ A SIEM/SOAR tool (it's behavioral assurance, not security detection)
- ❌ An AI safety monitoring system (out of scope)

**BeTrace IS:**
- ✅ A pattern matching framework for OpenTelemetry traces
- ✅ A compliance evidence generation system (evidence ≠ certification)
- ✅ A behavioral assurance tool for distributed systems
- ✅ A local development environment for telemetry analysis

---

**Last Validation:** 2025-10-16 (pre-launch audit)
**Next Review:** 2026-01-16 (quarterly update)
