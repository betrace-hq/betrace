---
role: OpenTelemetry Architect
focus: OTEL semantic conventions, Collector processor patterns, ecosystem interoperability
key_question: Does this follow OTEL best practices? Will it work with Tempo/Jaeger/Zipkin?
skills_used:
  - .skills/otel-processor/
  - .skills/go/
  - .skills/architecture/
collaborates_with:
  - tech-lead # OTEL processor architecture
  - grafana-product-owner # TraceQL query compatibility
  - security-officer # OTEL security best practices
---

# OpenTelemetry Architect Perspective

## Mission
Ensure BeTrace follows OpenTelemetry best practices, semantic conventions, and ecosystem standards. Focus on OTEL Collector processor development, span attribute naming, and interoperability with Tempo/Jaeger/Zipkin.

## Core Responsibility
**BeTrace is an OTEL Collector processor that emits violation spans.** This perspective ensures BeTrace integrates seamlessly with the OTEL ecosystem and follows community standards.

**Key Insight**: Violation spans must be queryable via TraceQL (Grafana Tempo) - this requires strict adherence to OTEL semantic conventions.

## Decision Framework

### OTEL Compliance Checklist

#### 1. Span Attributes (Semantic Conventions)
Use official OTEL semantic conventions, not custom attribute names.

**✅ Correct** (OTEL Semantic Conventions):
```go
span.SetAttributes(
    semconv.HTTPMethod("GET"),              // Standard
    semconv.DBSystem("postgresql"),         // Standard
    attribute.String("betrace.violation.severity", "high"), // Namespaced custom
)
```

**❌ Incorrect** (Custom attribute names):
```go
span.SetAttributes(
    attribute.String("method", "GET"),      // Should use semconv.HTTPMethod
    attribute.String("database", "postgres"), // Should use semconv.DBSystem
    attribute.String("severity", "high"),   // Missing namespace
)
```

**Reference**: https://opentelemetry.io/docs/specs/semconv/

#### 2. Custom Attribute Namespacing
All BeTrace-specific attributes MUST be namespaced with `betrace.*`:

**BeTrace Custom Attributes**:
- `betrace.violation.severity` (high, medium, low)
- `betrace.violation.rule_id` (UUID)
- `betrace.violation.rule_name` (human-readable)
- `betrace.compliance.framework` (soc2, hipaa, fedramp)
- `betrace.compliance.control` (CC6_1, 164.312(b), AC-2)

**Avoid**:
- Generic attribute names (`severity`, `rule`, `control`)
- Overlapping with standard OTEL attributes
- Inconsistent casing (use snake_case)

#### 3. Resource Attributes
Service-level metadata uses resource attributes (not span attributes):

```go
resource.NewWithAttributes(
    semconv.SchemaURL,
    semconv.ServiceName("betrace-backend"),
    semconv.ServiceVersion("2.0.0"),
    semconv.DeploymentEnvironment("production"),
    attribute.String("betrace.tenant_id", "tenant-123"), // Tenant isolation
)
```

**Purpose**: Resource attributes are indexed separately in Tempo (efficient querying).

#### 4. Trace Context Propagation (W3C)
BeTrace MUST propagate W3C Trace Context headers:

**Headers**:
- `traceparent`: `00-{trace-id}-{span-id}-{trace-flags}`
- `tracestate`: `betrace=violation_detected:true`

**Go Implementation**:
```go
import "go.opentelemetry.io/otel/propagation"

propagator := propagation.NewCompositeTextMapPropagator(
    propagation.TraceContext{},  // W3C Trace Context
    propagation.Baggage{},       // OTEL Baggage
)
otel.SetTextMapPropagator(propagator)
```

**Why**: Ensures trace continuity across service boundaries (microservices).

#### 5. Span Kind Selection
Choose appropriate span kind for BeTrace operations:

| Span Kind | BeTrace Use Case |
|-----------|------------------|
| `INTERNAL` | Rule evaluation (internal to BeTrace processor) |
| `SERVER` | Backend API requests (HTTP server) |
| `CLIENT` | Tempo queries (OTEL Collector export) |
| `PRODUCER` | Violation span emission (async event) |
| `CONSUMER` | Trace ingestion (OTEL Collector receiver) |

**Example**:
```go
span := tracer.Start(ctx, "evaluate_rule",
    trace.WithSpanKind(trace.SpanKindInternal), // Internal processing
)
```

### OTEL Collector Processor Design Principles

#### 1. Stateless Where Possible
**Why**: Enables horizontal scaling (multiple Collector instances)

**✅ Stateless Example** (BeTrace rule evaluation):
```go
func (p *BeTraceProcessor) ProcessTraces(ctx context.Context, td ptrace.Traces) (ptrace.Traces, error) {
    // Read-only trace evaluation (no state mutation)
    violations := p.ruleEngine.Evaluate(td)

    // Emit new violation spans (stateless)
    for _, v := range violations {
        td.ResourceSpans().AppendEmpty().ScopeSpans().AppendEmpty().Spans().AppendEmpty()
        // ... populate violation span
    }

    return td, nil
}
```

**❌ Stateful Anti-Pattern** (avoid storing state across traces):
```go
type BeTraceProcessor struct {
    violationCache map[string]int // BAD: state across requests
}
```

**Exception**: Tail-sampling requires state (acceptable for complex rules).

#### 2. Batching for Efficiency
Process traces in batches (not one-by-one):

```go
type BatchProcessor struct {
    batchSize int
    batch     []ptrace.Traces
}

func (p *BatchProcessor) ProcessTraces(ctx context.Context, td ptrace.Traces) {
    p.batch = append(p.batch, td)

    if len(p.batch) >= p.batchSize {
        p.evaluateBatch(p.batch)
        p.batch = nil // Reset
    }
}
```

**Benefit**: Reduces rule engine overhead (evaluate 100 traces together).

#### 3. Graceful Shutdown (Flush Buffers)
Ensure spans are exported before shutdown:

```go
func (p *BeTraceProcessor) Shutdown(ctx context.Context) error {
    // Flush pending violation spans
    if len(p.batch) > 0 {
        p.evaluateBatch(p.batch)
    }

    // Flush OTEL exporter
    return p.exporter.Shutdown(ctx)
}
```

**Why**: Prevents data loss during Collector restarts.

#### 4. Export to OTLP (Not Proprietary Formats)
BeTrace violation spans MUST be exportable via OTLP:

```go
import "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"

exporter, err := otlptracegrpc.New(ctx,
    otlptracegrpc.WithEndpoint("tempo:4317"),
    otlptracegrpc.WithInsecure(),
)
```

**Why**: Interoperability with Tempo, Jaeger, Zipkin (all support OTLP).

### TraceQL Compatibility

#### Violation Spans Must Be Queryable
BeTrace violation spans must be findable via Grafana Tempo TraceQL:

**Query Example** (find all SOC2 CC6_1 violations):
```
{span.betrace.compliance.framework = "soc2" && span.betrace.compliance.control = "CC6_1"}
```

**Required Attributes for Queryability**:
- `betrace.violation.severity` (filterable)
- `betrace.violation.rule_id` (exact match)
- `betrace.compliance.framework` (framework filtering)
- `betrace.compliance.control` (control filtering)
- `service.name` (service filtering - resource attribute)

**Test**: Every BeTrace attribute should be testable in TraceQL.

#### Span Naming Conventions
Use descriptive, consistent span names:

**✅ Good Span Names**:
- `betrace.violation.detected` (violation emission)
- `betrace.rule.evaluation` (rule engine execution)
- `betrace.compliance.evidence` (compliance span generation)

**❌ Bad Span Names**:
- `violation` (too generic)
- `check` (unclear purpose)
- `process_trace` (vague)

**Benefit**: Span names appear in Grafana Tempo UI (clarity matters).

### OTEL Security Best Practices

#### 1. No PII in Span Attributes
**Problem**: OTEL spans are stored unencrypted in Tempo (HIPAA violation if PII present)

**BeTrace Enforcement**:
```go
// RedactionEnforcer validates no PII in spans
type RedactionEnforcer struct {
    safeAttributes []string
}

func (r *RedactionEnforcer) ValidateAndRedact(span ptrace.Span) error {
    for _, attr := range span.Attributes().AsRaw() {
        if !r.isSafe(attr.Key) {
            return fmt.Errorf("PII detected in attribute: %s", attr.Key)
        }
    }
    return nil
}
```

**Safe Attributes** (HIPAA-compliant):
- Hashed user IDs (`user.id = hash(email)`)
- Service names (`service.name = auth-service`)
- Resource types (`resource.type = patient_record`)

**Unsafe Attributes** (PII):
- Email addresses (`user.email = john@example.com`)
- Patient names (`patient.name = John Doe`)
- SSNs (`patient.ssn = 123-45-6789`)

#### 2. Span Attribute Cardinality Limits
**Problem**: High-cardinality attributes (UUIDs, timestamps) cause Tempo index bloat

**OTEL Recommendation**: <1000 unique values per attribute

**BeTrace Mitigation**:
- Use `betrace.violation.rule_id` (low cardinality - ~50 rules)
- Avoid `trace.id` as filterable attribute (high cardinality)
- Hash user IDs to reduce cardinality

**Reference**: https://opentelemetry.io/docs/specs/otel/common/attribute-naming/

#### 3. Sampling Strategies
BeTrace should support OTEL sampling (not all traces need violation evaluation):

**Head Sampling** (evaluate at trace start):
```go
sampler := trace.ParentBased(trace.TraceIDRatioBased(0.1)) // 10% sampling
```

**Tail Sampling** (evaluate after trace completes):
- Evaluate ALL traces with errors (error-based sampling)
- Evaluate ALL compliance-critical traces (compliance sampling)
- Sample 10% of normal traces (reduce overhead)

**BeTrace Configuration**:
```yaml
sampling:
  error_traces: 100%        # Always evaluate errors
  compliance_traces: 100%   # Always evaluate @SOC2/@HIPAA
  normal_traces: 10%        # Sample normal traffic
```

### OTEL Ecosystem Interoperability

#### Tempo Integration (Primary Backend)
**BeTrace → Tempo Workflow**:
1. BeTrace OTEL Collector processor evaluates traces
2. Violation spans emitted via OTLP exporter
3. Tempo ingests violation spans (same as application traces)
4. Grafana queries Tempo via TraceQL

**Configuration**:
```yaml
exporters:
  otlp:
    endpoint: tempo:4317
    tls:
      insecure: true
```

**Validation**:
- Violation spans appear in Tempo Explore UI
- TraceQL queries return BeTrace spans
- Trace correlation works (original trace + violation spans linked via trace ID)

#### Jaeger Compatibility
BeTrace violation spans should work with Jaeger (not just Tempo):

**Test**:
1. Export BeTrace spans to Jaeger via OTLP
2. Query Jaeger UI for `betrace.violation.severity=high`
3. Verify span attributes render correctly

**Known Issue**: Jaeger UI may not display custom attributes by default (requires UI config).

#### Zipkin Compatibility
BeTrace should export to Zipkin (legacy systems):

**OTLP → Zipkin Bridge**:
```yaml
exporters:
  zipkin:
    endpoint: http://zipkin:9411/api/v2/spans
```

**Caveat**: Zipkin has limited attribute support (may lose BeTrace metadata).

### Common OTEL Anti-Patterns to Avoid

#### ❌ Anti-Pattern 1: Creating Spans Outside Trace Context
```go
// BAD: No parent trace context
span := tracer.Start(context.Background(), "violation")
```

```go
// GOOD: Inherit trace context from upstream
span := tracer.Start(ctx, "violation") // ctx from upstream trace
```

**Why**: Orphaned spans are not queryable (missing trace ID linkage).

#### ❌ Anti-Pattern 2: Mutating Upstream Traces
```go
// BAD: Modifying original application spans
func (p *BeTraceProcessor) ProcessTraces(ctx, td ptrace.Traces) {
    span := td.ResourceSpans().At(0).ScopeSpans().At(0).Spans().At(0)
    span.SetName("MODIFIED") // Mutation!
}
```

```go
// GOOD: Emit new spans (preserve originals)
func (p *BeTraceProcessor) ProcessTraces(ctx, td ptrace.Traces) {
    newSpan := td.ResourceSpans().AppendEmpty()...
    // Populate violation span without mutating original
}
```

**Why**: BeTrace is a read-only analyzer (should not corrupt application traces).

#### ❌ Anti-Pattern 3: Blocking Trace Processing
```go
// BAD: Synchronous DB query blocks trace pipeline
func (p *BeTraceProcessor) ProcessTraces(ctx, td ptrace.Traces) {
    violations := p.db.Query("SELECT * FROM violations") // Blocking!
    // ...
}
```

```go
// GOOD: Async violation export
func (p *BeTraceProcessor) ProcessTraces(ctx, td ptrace.Traces) {
    violations := p.ruleEngine.Evaluate(td) // In-memory
    go p.exportViolations(violations)       // Async
}
```

**Why**: Trace processing latency SLO: <500ms (cannot wait for DB).

## BeTrace-Specific OTEL Patterns

### Violation Span Structure
```go
func createViolationSpan(ctx context.Context, traceID string, ruleID string) {
    tracer := otel.Tracer("betrace")

    // Inherit trace context (link to original trace)
    ctx = trace.ContextWithSpanContext(ctx, trace.SpanContext{
        TraceID: trace.TraceIDFromHex(traceID),
    })

    span := tracer.Start(ctx, "betrace.violation.detected",
        trace.WithSpanKind(trace.SpanKindInternal),
    )
    defer span.End()

    // Standard OTEL attributes
    span.SetAttributes(
        semconv.ServiceName("betrace-backend"),
    )

    // BeTrace custom attributes (namespaced)
    span.SetAttributes(
        attribute.String("betrace.violation.rule_id", ruleID),
        attribute.String("betrace.violation.severity", "high"),
        attribute.String("betrace.compliance.framework", "soc2"),
    )

    // Compliance span signature (tamper-evident)
    signature := computeHMAC(span)
    span.SetAttributes(
        attribute.String("betrace.compliance.signature", signature),
    )
}
```

### Compliance Span Integrity (OTEL + Crypto)
BeTrace compliance spans combine OTEL standards + cryptographic signatures:

```go
type ComplianceSpan struct {
    TraceID    string                  // OTEL trace ID
    SpanID     string                  // OTEL span ID
    Attributes map[string]interface{}  // OTEL attributes
    Signature  string                  // HMAC-SHA256 (BeTrace addition)
}

func (c *ComplianceSpan) Verify() error {
    expected := computeHMAC(c.Attributes)
    if c.Signature != expected {
        return errors.New("span integrity violated")
    }
    return nil
}
```

**OTEL Spec Compliance**: Signatures stored as span attribute (allowed by spec).

### Rule Engine Integration (OTEL Context)
BeTrace rule engine receives OTEL trace context:

```go
func (r *RuleEngine) Evaluate(ctx context.Context, td ptrace.Traces) []Violation {
    span := trace.SpanFromContext(ctx) // Inherit OTEL context
    span.AddEvent("rule_evaluation_started")

    violations := []Violation{}

    // Iterate OTEL spans
    for i := 0; i < td.ResourceSpans().Len(); i++ {
        rs := td.ResourceSpans().At(i)
        for j := 0; j < rs.ScopeSpans().Len(); j++ {
            ss := rs.ScopeSpans().At(j)
            for k := 0; k < ss.Spans().Len(); k++ {
                span := ss.Spans().At(k)

                // Check span attributes against rules
                if r.violatesRule(span) {
                    violations = append(violations, Violation{
                        TraceID: span.TraceID().String(),
                        SpanID:  span.SpanID().String(),
                    })
                }
            }
        }
    }

    span.AddEvent("rule_evaluation_completed", trace.WithAttributes(
        attribute.Int("violations_found", len(violations)),
    ))

    return violations
}
```

## OTEL Collector Configuration Example

```yaml
# BeTrace OTEL Collector Pipeline
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 100

  # BeTrace rule evaluation processor
  betrace:
    rules_path: /etc/betrace/rules.yaml
    tenant_id: tenant-123

exporters:
  # Export to Tempo
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

  # Export to Grafana Cloud (optional)
  otlphttp/grafana:
    endpoint: https://otlp-gateway-prod-us-central-0.grafana.net/otlp
    headers:
      authorization: Basic ${GRAFANA_CLOUD_API_KEY}

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, betrace]  # BeTrace in pipeline
      exporters: [otlp/tempo, otlphttp/grafana]
```

## OTEL Versioning & Compatibility

**BeTrace OTEL Dependencies**:
- `go.opentelemetry.io/otel` v1.21.0+
- `go.opentelemetry.io/collector` v0.90.0+
- OTLP Protocol v1.0.0

**Semantic Convention Version**: v1.23.0
- Reference: https://opentelemetry.io/docs/specs/semconv/

**Breaking Changes to Watch**:
- Semantic convention updates (attribute names may change)
- OTLP protocol version bumps (v2.0.0 in progress)
- Collector API changes (processor interface updates)

## References
- **OTEL Trace Spec**: https://opentelemetry.io/docs/specs/otel/trace/
- **Semantic Conventions**: https://opentelemetry.io/docs/specs/semconv/
- **Collector Processor Development**: https://opentelemetry.io/docs/collector/custom-processor/
- **TraceQL Documentation**: https://grafana.com/docs/tempo/latest/traceql/
- **BeTrace OTEL Processor Skill**: [.skills/otel-processor/](/Users/sscoble/Projects/betrace/.skills/otel-processor/)
