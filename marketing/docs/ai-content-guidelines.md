# AI Content Generation Guidelines

**Purpose:** This document provides structured, RAG-optimized information for AI agents to generate accurate FLUO content.

**Last Updated:** 2025-10-13
**Canonical Sources:** ADR-011, CLAUDE.md, compliance.md, trace-rules-dsl.md

---

## What FLUO Actually Is

### Core Definition
FLUO is a **Behavioral Assurance System for OpenTelemetry Data**.

**Deployment Model:** Standalone service (like Datadog, Grafana), NOT a library you import.

**How It Works:**
```
OpenTelemetry Traces → FLUO Service → Pattern Matching Rules → Signals (Violations) → Investigation
```

### What FLUO Is NOT
- ❌ NOT a library you import (`import fluo from '@fluo/sdk'` - this doesn't exist!)
- ❌ NOT a SIEM/SOAR/security incident response platform
- ❌ NOT an APM/monitoring tool (Datadog replacement)
- ❌ NOT an IOC-based threat detection system

### Architecture Model
**Pure Application Framework** (ADR-011)
- FLUO exports application packages (React frontend, Quarkus backend)
- Deployment is an external consumer responsibility
- No Docker/Kubernetes manifests provided by FLUO
- Local development via Nix: `nix run github:fluohq/fluo#dev`

---

## How Customers Actually Use FLUO

### Deployment Steps (Do NOT Invent These)

1. **Deploy FLUO Service**
   ```bash
   # Via Nix (documented in CLAUDE.md)
   nix run .#dev          # Local development
   nix run .#serve        # Production preview

   # External deployment (consumer responsibility)
   # NO official Docker/K8s manifests exist yet
   ```

2. **Configure OpenTelemetry Exporters**
   ```javascript
   // In YOUR application (NOT FLUO code)
   const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
   const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

   const exporter = new OTLPTraceExporter({
     url: 'http://fluo-service:4318/v1/traces', // FLUO's OTLP endpoint
   });
   ```

3. **Define Rules in FLUO UI**
   - Rules are configured in FLUO's web interface (http://localhost:3000)
   - NOT in your application code
   - Use the FLUO DSL (see below)

4. **Receive Signals**
   - FLUO generates "signals" when patterns are violated
   - SREs investigate signals to discover hidden invariants

---

## FLUO DSL - Actual Syntax

**Source:** [docs/technical/trace-rules-dsl.md](../../docs/technical/trace-rules-dsl.md)

### Real DSL Examples (Copy These Exactly)

#### Example 1: Detect Auth Retry Storms
```javascript
// Rule configured in FLUO UI (NOT in application code)
trace.has(span => span.name === 'auth.login' && span.status === 'ERROR')
  .and(trace.has(span => span.name === 'auth.login' && span.status === 'OK'))
  .within('5 seconds')
```

#### Example 2: Missing Audit Logs After PII Access
```javascript
trace.has(span => span.attributes['data.contains_pii'] === true)
  .and(trace.missing(span => span.name === 'audit.log'))
```

#### Example 3: Slow Payment Queries
```javascript
trace.where(span => span.name.startsWith('payment'))
  .has(span => span.name.includes('db.query') && span.duration > 1000)
```

### What OpenTelemetry Spans Look Like (Sent to FLUO)

```javascript
// Your services send these via OTLP (OpenTelemetry Protocol)
{
  name: "http.request",
  traceId: "abc123",
  spanId: "def456",
  parentSpanId: "ghi789",
  status: "OK" | "ERROR",
  duration: 150, // milliseconds
  attributes: {
    "http.method": "POST",
    "http.status_code": 200,
    "service.name": "api-gateway"
  }
}
```

### What the DSL Does NOT Support (Do NOT Invent These)
- ❌ No Java-style `invariant` declarations
- ❌ No `hasRepeatedRequests()` helper functions
- ❌ No `hasTenantId()` built-in predicates
- ❌ No declarative syntax - it's imperative JavaScript

---

## Use Cases (Documented)

### 1. SREs: Discover Undocumented Invariants
**Scenario:** Production incident reveals hidden assumptions

**Example:**
- Incident: Payment processing failed for 2 hours
- Root cause: Auth service retried failed logins, overwhelming DB
- FLUO rule (created post-incident):
  ```javascript
  trace.has(span => span.name === 'auth.login' && span.status === 'ERROR')
    .count() > 10
    .within('1 minute')
  ```
- **Outcome:** Future auth storms trigger signals before impacting payments

### 2. Developers: Define Invariants to Expose Service Misuse
**Scenario:** API clients misuse retry logic

**Example:**
- Developer expectation: Clients use exponential backoff
- Reality: Some clients retry immediately on 429 (rate limit)
- FLUO rule:
  ```javascript
  trace.has(span => span.attributes['http.status_code'] === 429)
    .followedBy(span => span.name === 'http.request')
    .within('100ms') // No backoff!
  ```
- **Outcome:** Detect clients ignoring rate limits

### 3. Compliance: Match Trace Patterns for Evidence
**Scenario:** SOC2 audit requires proof of access controls

**Example:**
- Control: All PII access must have authorization check
- FLUO rule:
  ```javascript
  trace.has(span => span.attributes['data.contains_pii'] === true)
    .requires(span => span.name === 'auth.check')
  ```
- **Outcome:** Generate compliance spans (immutable audit trail)

---

## Compliance Status (Be Honest About This!)

**Source:** [docs/compliance-status.md](../../docs/compliance-status.md)

### Current Reality
- ✅ Compliance evidence generation (spans emitted)
- ✅ Pattern validation (DSL rules)
- ✅ Cryptographic span signatures (HMAC-SHA256)
- ✅ PII redaction enforcement
- ✅ Rule engine sandboxing
- ❌ **NOT certified for any framework** (SOC2, HIPAA, etc.)
- ❌ **NOT production-ready for compliance** (requires external auditor)

### What to Say vs NOT Say

**✅ Acceptable Claims:**
- "FLUO provides compliance evidence collection primitives"
- "Built with SOC2/HIPAA controls in mind"
- "Compliance-ready architecture for behavioral assurance"

**❌ NEVER Claim:**
- "SOC2 certified" (requires external audit, $10-25K, 12-18 months)
- "HIPAA compliant" (requires BAAs, policies, assessments)
- "Automated compliance" (evidence generation ≠ certification)

### Path to Certification (If Asked)
1. Fix P0 security gaps: ✅ DONE (as of 2025-10-13)
2. Implement compliance rule templates: ⏸️ Planned
3. Deploy FLUO with annotations: ⏸️ Customer responsibility
4. Run for audit period: ⏸️ 6-12 months minimum
5. External audit: ⏸️ $10-25K, 2-3 months
6. **Total timeline:** 12-18 months from today

---

## Technology Stack (Current, Not Aspirational)

### Frontend (bff/)
- React 18 + TypeScript
- Vite 6, Tanstack Router
- shadcn/ui, Tailwind CSS
- **NOT deployed separately** - integrated with backend

### Backend (backend/)
- Java 21, Quarkus, Maven
- JUnit 5 testing
- OpenTelemetry integration
- **NOT containerized by default** - pure application package

### Development (Local Only)
- Nix Flakes (reproducible builds)
- Grafana observability stack (local dev only)
- Hot reload for both frontend and backend

### What FLUO Does NOT Provide
- ❌ Docker images
- ❌ Kubernetes manifests
- ❌ Cloud integrations (AWS, GCP, Azure)
- ❌ Deployment automation
- ❌ CI/CD pipelines

---

## Performance Characteristics (Be Honest)

### What We Know
- **Test Coverage:** 90% instruction, 80% branch (enforced thresholds)
- **Development Startup:** Instant with `nix run .#dev`
- **Hot Reload:** Yes (frontend via Vite, backend via Quarkus)

### What We DON'T Know (No Benchmarks Yet)
- ❌ Traces per second throughput
- ❌ Rule evaluation latency
- ❌ Signal generation delay
- ❌ Storage requirements at scale
- ❌ Resource usage (CPU, memory)

**If asked about performance:** "No public benchmarks available yet. FLUO is designed for pattern discovery, not real-time alerting."

---

## Security Architecture (Current State)

**Source:** [docs/compliance-status.md](../../docs/compliance-status.md)

### Implemented (Production Ready)
- ✅ Compliance span integrity (HMAC-SHA256 signatures)
- ✅ PII redaction enforcement (whitelist-based validation)
- ✅ Rule engine sandboxing (capability-based security, 9.5/10 rating)
- ✅ Input sanitization (XSS, SQL, LDAP, command injection)

### Planned (Not Yet Implemented)
- ⏸️ Per-tenant KMS encryption keys (P1, not blocking)
- ⏸️ Evidence export API for auditors (P2)
- ⏸️ Compliance rule templates (P2)

### Threat Model
**What FLUO Protects Against:**
- ✅ Privilege escalation via authentication bypass (ADR-016)
- ✅ PII leakage in compliance spans (RedactionEnforcer)
- ✅ Malicious DSL rules (sandboxed execution)

**What FLUO Does NOT Protect Against (Yet):**
- ❌ Cryptographic key compromise (no per-tenant keys)
- ❌ Insider threats (no evidence export audit trail)

---

## Competitive Positioning (Honest Comparison)

### When to Use FLUO

**✅ Use FLUO If:**
- Complex microservices (>10 services, >10 engineers)
- Need to discover undocumented invariants from incidents
- Want behavioral assurance beyond metrics/logs
- Trace patterns are critical to your system (e.g., compliance, auth flows)

**❌ Don't Use FLUO If:**
- Simple monolith or small team (<10 engineers)
- Just need infrastructure monitoring (CPU, memory) → Use APM (Datadog, New Relic)
- Need real-time alerting on metrics → Use Prometheus/Grafana
- Want pre-built integrations/dashboards → Use commercial APM

### vs APM (Datadog, New Relic)
- **APM Focus:** Metrics, dashboards, pre-built integrations
- **FLUO Focus:** Pattern discovery, behavioral invariants
- **Overlap:** Both consume OpenTelemetry traces
- **Difference:** APM shows "what happened", FLUO discovers "what should never happen"

### vs SIEM (Splunk, Elastic Security)
- **SIEM Focus:** Security events, threat detection, IOC matching
- **FLUO Focus:** Application behavior patterns, not security incidents
- **Overlap:** Both analyze events for anomalies
- **Difference:** SIEM is for security teams, FLUO is for SREs/developers

---

## Pricing (Current Reality)

### Open Source
- FLUO is open source (check GitHub for license)
- Free to deploy and use
- No commercial support offered yet

### No Commercial Offering Yet
- ❌ No SaaS version
- ❌ No paid support
- ❌ No enterprise features

**If asked about pricing:** "FLUO is open source. Deploy it yourself via Nix or external deployment tools."

---

## Example Article Structures (Use These)

### Structure 1: Problem → FLUO Solution → Implementation
```markdown
# [Title: Specific Problem]

## The Incident (Real, Documented Example)
[Describe a relatable SRE incident - auth retry storm, PII access without logs, etc.]

## Why Existing Tools Miss This
- APM shows high error rates but not the *pattern*
- Logs are too noisy to correlate
- Metrics don't capture multi-span behaviors

## How FLUO Detects This
[Cite ADR or trace-rules-dsl.md]

[Show actual DSL example from docs]

## Try It Yourself
```bash
nix run github:fluohq/fluo#dev
```

[Step-by-step with real commands from CLAUDE.md]

## What This Enables
[Only documented capabilities - cite compliance.md or ADRs]
```

### Structure 2: Technical Deep Dive
```markdown
# [Title: Technical Capability]

## Architecture Overview
[Cite ADR-011: Pure Application Framework]

## Technical Implementation
[Cite relevant ADRs with specific quotes]

## Code Example
[Exact syntax from trace-rules-dsl.md]

## Current Limitations
[Cite compliance-status.md or note "Not yet documented"]

## References
- [ADR-011](../../docs/adrs/011-pure-application-framework.md)
- [trace-rules-dsl.md](../../docs/technical/trace-rules-dsl.md)
```

---

## AI Writing Rules (CRITICAL)

### Rule 1: NO INVENTED EXAMPLES
If you need an example NOT in the documentation:
- Write: `[EXAMPLE NEEDED: describe what's missing]`
- Do NOT invent code, clients, metrics, or features

### Rule 2: CITE SOURCES
Every technical claim must cite:
- `[Source: ADR-011]`
- `[Source: trace-rules-dsl.md]`
- `[Source: compliance-status.md]`

### Rule 3: ACKNOWLEDGE GAPS
If documentation is silent:
- "The documentation doesn't specify..."
- "No benchmarks available yet..."
- "This is not yet implemented..."

### Rule 4: NO LIBRARY IMPORTS
FLUO is a **deployed service**, NOT a library. Never write:
```javascript
// ❌ WRONG - This doesn't exist!
import fluo from '@fluo/sdk';
```

Instead:
```javascript
// ✅ CORRECT - Your app sends traces to FLUO service
const exporter = new OTLPTraceExporter({
  url: 'http://fluo-service:4318/v1/traces',
});
```

### Rule 5: DEPLOYMENT HONESTY
FLUO does NOT provide:
- Docker images
- Kubernetes manifests
- Cloud deployment scripts

If asked: "FLUO exports pure application packages. Deployment is a consumer responsibility. See ADR-011."

---

## Quick Reference: What to Write vs Avoid

| ✅ WRITE THIS | ❌ NOT THIS |
|--------------|------------|
| "FLUO is a deployed service" | "Import FLUO library into your app" |
| "Configure rules in FLUO UI" | "Write rules in your application code" |
| "FLUO provides compliance evidence primitives" | "FLUO is SOC2 certified" |
| "No benchmarks available yet" | "FLUO handles 1M traces/sec" (invented!) |
| "Rules use JavaScript DSL" | "Rules use declarative invariant syntax" (wrong!) |
| "FLUO discovers behavioral invariants" | "FLUO is an APM replacement" |
| "[Source: ADR-011]" | (no citation) |

---

## Last Updated: 2025-10-13

**Canonical Sources:**
- [ADR-011: Pure Application Framework](../../docs/adrs/011-pure-application-framework.md)
- [trace-rules-dsl.md](../../docs/technical/trace-rules-dsl.md)
- [compliance-status.md](../../docs/compliance-status.md)
- [CLAUDE.md](../../CLAUDE.md)
