# FLUO DSL Reference

## Where DSL Rules Are Written

**IMPORTANT:** FLUO DSL rules are written in **FLUO's web UI** or **submitted via FLUO's REST API**.

They are **NOT** written in your application code. Your applications only send standard OpenTelemetry traces.

## DSL Syntax (custom AST)

### Basic Pattern Matching

```FluoDSL
// Check if trace contains a span
trace.has(span => span.name === 'http.request')

// Check span status
trace.has(span => span.status === 'ERROR')

// Check span attributes
trace.has(span => span.attributes['http.method'] === 'POST')

// Check span duration (in milliseconds)
trace.has(span => span.duration > 1000)
```

### Combining Patterns

```FluoDSL
// AND: Both patterns must exist
trace.has(span => span.name === 'auth.login' && span.status === 'ERROR')
  .and(trace.has(span => span.name === 'auth.login' && span.status === 'OK'))

// OR: Either pattern exists
trace.has(span => span.status === 'ERROR')
  .or(trace.has(span => span.status === 'TIMEOUT'))

// NOT: Pattern must NOT exist
trace.not(trace.has(span => span.name === 'audit.log'))
```

### Temporal Constraints

```FluoDSL
// Patterns within time window
trace.has(span => span.name === 'payment.charge')
  .and(trace.has(span => span.name === 'inventory.reserve'))
  .within('10 seconds')

// Patterns in sequence
trace.has(span => span.name === 'auth.check')
  .followedBy(trace.has(span => span.name === 'data.access'))
  .within('1 minute')
```

### Missing Patterns

```FluoDSL
// Detect missing expected behavior
trace.has(span => span.attributes['data.contains_pii'] === true)
  .and(trace.missing(span => span.name === 'audit.log'))

// Multiple missing patterns
trace.has(span => span.name === 'payment.charge')
  .and(trace.missing(span => span.name === 'fraud.check'))
  .and(trace.missing(span => span.name === 'risk.assessment'))
```

### Filtering Traces

```FluoDSL
// Only check traces from specific services
trace.where(span => span.attributes['service.name'] === 'payment-api')
  .has(span => span.duration > 5000)

// Only check specific operations
trace.where(span => span.name.startsWith('payment'))
  .has(span => span.status === 'ERROR')
```

## OpenTelemetry Span Structure

When writing FLUO rules, you match against OpenTelemetry span fields:

```json
{
  name: "http.request",           // Span operation name
  traceId: "abc123...",           // Unique trace ID
  spanId: "def456...",            // Unique span ID
  parentSpanId: "ghi789...",      // Parent span ID (if any)
  status: "OK" | "ERROR",         // Span status
  duration: 150,                  // Duration in milliseconds
  startTime: 1634567890000,       // Unix timestamp (ms)
  endTime: 1634567890150,         // Unix timestamp (ms)
  attributes: {                   // Custom attributes
    "http.method": "POST",
    "http.status_code": 200,
    "service.name": "api-gateway",
    "user.id": "user123",
    "data.contains_pii": true
  }
}
```

## Real-World Rule Examples

### 1. Detect Auth Retry Storms

```FluoDSL
// Rule configured in FLUO UI
trace.has(span => span.name === 'auth.login' && span.status === 'ERROR')
  .and(trace.has(span => span.name === 'auth.login' && span.status === 'OK'))
  .within('5 seconds')
```

**What it detects:** Failed login attempts followed by successful login within 5 seconds (potential brute force).

### 2. Missing Audit Logs for PII Access

```FluoDSL
// Rule configured in FLUO UI
trace.has(span => span.attributes['data.contains_pii'] === true)
  .and(trace.missing(span => span.name === 'audit.log'))
```

**What it detects:** Database queries accessing PII data without corresponding audit log entries (compliance violation).

### 3. Slow Database Queries in Payment Flow

```FluoDSL
// Rule configured in FLUO UI
trace.where(span => span.name.startsWith('payment'))
  .has(span =>
    span.name.includes('db.query') &&
    span.duration > 1000
  )
```

**What it detects:** Database queries taking longer than 1 second during payment processing.

### 4. Missing Circuit Breaker

```FluoDSL
// Rule configured in FLUO UI
trace.has(span => span.attributes['http.target'] === '/external-api')
  .and(trace.missing(span => span.name === 'circuit-breaker.check'))
```

**What it detects:** External API calls without circuit breaker protection.

### 5. Cascading Timeout Failures

```FluoDSL
// Rule configured in FLUO UI
trace.has(span => span.name === 'http.request' && span.status === 'TIMEOUT')
  .and(trace.has(span => span.parentSpanId !== null && span.status === 'TIMEOUT'))
  .within('10 seconds')
```

**What it detects:** Timeout failures propagating through service call chains.

## How Rules Generate Signals

When FLUO detects a trace matching a rule:

1. **Signal Created** - FLUO generates a signal (violation alert)
2. **Context Captured** - Full trace context is stored with the signal
3. **Alert Sent** - Notification sent to configured channels (Slack, PagerDuty, etc.)
4. **Investigation** - SREs use FLUO UI to investigate the signal and trace

## Creating Rules in FLUO

### Via Web UI

1. Navigate to `http://localhost:3000` (FLUO frontend)
2. Click "Rules" → "Create New Rule"
3. Fill in rule details:
   - **Name:** "Detect payment timeout cascade"
   - **DSL:** `trace.where(...).has(...)`
   - **Severity:** Critical/Warning/Info
   - **Enabled:** Yes/No
4. Click "Save"

### Via REST API

```bash
curl -X POST http://localhost:8080/api/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Detect auth retry storms",
    "dsl": "trace.has(span => span.name === \"auth.login\" && span.status === \"ERROR\").and(trace.has(span => span.name === \"auth.login\" && span.status === \"OK\")).within(\"5 seconds\")",
    "severity": "critical",
    "enabled": true
  }'
```

## Key Takeaways for Blog Posts

1. **Rules are configured in FLUO** (web UI or API), NOT in application code
2. **Applications only send standard OpenTelemetry traces** via OTLP
3. **FLUO matches patterns** using FluoDSL on incoming traces
4. **Signals are generated** when patterns are detected
5. **SREs investigate signals** to discover hidden invariants and fix root causes
