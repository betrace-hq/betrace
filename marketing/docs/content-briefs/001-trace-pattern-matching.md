# Content Brief: Trace Pattern Matching with FLUO

**Topic:** How FLUO's DSL Enables Pattern Matching on OpenTelemetry Traces
**Target Audience:** SREs, DevOps Engineers
**Word Count:** 800-1200 words
**Tone:** Technical, honest, helpful (not salesy)

---

## Required Reading for AI Agents

**Primary Sources (MUST READ):**
1. [trace-rules-dsl.md](../../../docs/technical/trace-rules-dsl.md) - Complete DSL syntax reference
2. [ADR-011: Pure Application Framework](../../../docs/adrs/011-pure-application-framework.md) - How FLUO is deployed
3. [CLAUDE.md](../../../CLAUDE.md) - Core FLUO purpose and workflow
4. [ai-content-guidelines.md](../ai-content-guidelines.md) - What to say vs NOT say

**Supplementary Sources (Optional):**
- [compliance.md](../../../docs/compliance.md) - Compliance use cases
- [ADR-015: Development Workflow](../../../docs/adrs/015-development-workflow-and-quality-standards.md)

---

## Documented Facts (Use These)

### FLUO's Core Purpose
- Behavioral Assurance System for OpenTelemetry Data
- Workflow: `OpenTelemetry Traces → Rules → Signals → Investigation`
- Three audiences: SREs (discover invariants), Developers (define invariants), Compliance (evidence)

### How Pattern Matching Works
1. FLUO receives OpenTelemetry traces via OTLP protocol
2. Rules are configured in FLUO's web UI (http://localhost:3000)
3. Rules use JavaScript-based DSL (NOT declarative)
4. When patterns match, FLUO generates "signals" (violations)
5. SREs investigate signals to discover hidden invariants

### Real DSL Examples (From trace-rules-dsl.md)

**Example 1: Auth Retry Storm Detection**
```javascript
trace.has(span => span.name === 'auth.login' && span.status === 'ERROR')
  .and(trace.has(span => span.name === 'auth.login' && span.status === 'OK'))
  .within('5 seconds')
```

**Example 2: Missing Audit Logs**
```javascript
trace.has(span => span.attributes['data.contains_pii'] === true)
  .and(trace.missing(span => span.name === 'audit.log'))
```

**Example 3: Slow Queries**
```javascript
trace.where(span => span.name.startsWith('payment'))
  .has(span => span.name.includes('db.query') && span.duration > 1000)
```

---

## Article Structure

### Section 1: The Problem (200 words)
**What to cover:**
- SREs face incidents caused by undocumented invariants
- Example: Auth retry storms overwhelm databases
- Existing tools (APM, logs) show symptoms, not patterns

**Sources:**
- CLAUDE.md (core purpose)
- ai-content-guidelines.md (use cases)

### Section 2: FLUO's Approach (300 words)
**What to cover:**
- FLUO is a deployed service (like Datadog), not a library
- Receives OpenTelemetry traces via OTLP
- Rules defined in FLUO UI using JavaScript DSL
- Generates signals when patterns match

**Sources:**
- ADR-011 (deployment model)
- trace-rules-dsl.md (DSL syntax)

**Example deployment:**
```bash
# Local development
nix run github:fluohq/fluo#dev

# Frontend: http://localhost:3000
# Backend: http://localhost:8080
```

### Section 3: DSL Examples (400 words)
**What to cover:**
- Show 3 real examples from trace-rules-dsl.md
- Explain what each rule detects
- Show OpenTelemetry span structure
- Explain how rules match spans

**Sources:**
- trace-rules-dsl.md (exact syntax)
- ai-content-guidelines.md (span structure)

**DO NOT INVENT:**
- ❌ No fictional helper functions (hasRepeatedRequests, hasTenantId, etc.)
- ❌ No declarative invariant syntax
- ❌ No client stories or invented metrics

### Section 4: Try It Yourself (200 words)
**What to cover:**
- How to deploy FLUO locally
- How to send traces to FLUO
- How to define rules in the UI
- What happens when patterns match

**Sources:**
- CLAUDE.md (development commands)
- ADR-011 (deployment model)

**Example:**
```bash
# Start FLUO
nix run .#dev

# In your app, send traces to FLUO
const exporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});
```

### Section 5: What This Enables (100 words)
**What to cover:**
- Discover undocumented invariants from incidents
- Prevent future incidents with rules
- Generate compliance evidence (cite compliance.md)

**Sources:**
- compliance.md (compliance use cases)
- ai-content-guidelines.md (what to say)

---

## Critical Constraints (AI Must Follow)

### ✅ MUST DO
1. Use EXACT DSL syntax from trace-rules-dsl.md
2. Cite sources for every technical claim: `[Source: trace-rules-dsl.md]`
3. Show FLUO as a deployed service, NOT a library
4. Acknowledge gaps: "No benchmarks available yet..."

### ❌ MUST NOT DO
1. Invent DSL syntax or helper functions
2. Show library imports: `import fluo from '@fluo/sdk'` (doesn't exist!)
3. Invent client stories, metrics, or features
4. Claim SOC2/HIPAA certification (not certified!)

### 🚨 IF YOU NEED SOMETHING NOT IN DOCS
Write: `[EXAMPLE NEEDED: describe what's missing]`

**DO NOT INVENT IT!**

---

## Success Criteria

**Article succeeds if:**
1. Every code example is from trace-rules-dsl.md
2. Every claim has a citation
3. No invented syntax, clients, or metrics
4. Honestly acknowledges gaps ("not documented yet")
5. Shows FLUO as deployed service, not library

**Article fails if:**
1. Invents DSL syntax not in docs
2. Shows library imports that don't exist
3. Makes claims without citations
4. Invents client stories or benchmarks

---

## Review Checklist

Before publishing, verify:
- [ ] All DSL examples match trace-rules-dsl.md exactly
- [ ] Deployment steps use Nix commands from CLAUDE.md
- [ ] No `import fluo` statements (FLUO is a service!)
- [ ] All technical claims cite sources
- [ ] Gaps are acknowledged honestly
- [ ] No SOC2/HIPAA certification claims
- [ ] No invented metrics or benchmarks
