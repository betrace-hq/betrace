---
name: OTEL Processor Development
category: Implementation
difficulty: Advanced
prerequisites:
  - Go programming
  - OpenTelemetry concepts
  - OTEL Collector architecture
tags:
  - opentelemetry
  - go
  - observability
  - processors
success_metrics:
  - Processor integrates with OTEL Collector pipeline
  - Passes OTEL Collector test suite
  - Documented configuration options
  - Example configurations provided
---

# OTEL Processor Development Skill

## Quick Reference

### OTEL Collector Architecture

```
Receivers → Processors → Exporters
    ↓           ↓           ↓
 Ingest     Transform    Export
(HTTP,      (Filter,    (Tempo,
 gRPC)      Mutate)     Jaeger)
```

### Processor Types

1. **Trace Processors**: Operate on spans/traces
2. **Metrics Processors**: Operate on metrics
3. **Logs Processors**: Operate on logs

### Common Processor Operations

- **Filter**: Drop spans based on criteria
- **Attribute**: Add/remove/modify span attributes
- **Batch**: Batch spans for efficient export
- **Sample**: Probabilistic/deterministic sampling
- **Transform**: Custom span manipulation

## Development Patterns

### 1. Processor Interface

All processors implement `component.Component`:

```go
package myprocessor

import (
    "context"
    "go.opentelemetry.io/collector/component"
    "go.opentelemetry.io/collector/consumer"
    "go.opentelemetry.io/collector/pdata/ptrace"
)

type myProcessor struct {
    config *Config
    next   consumer.Traces
}

func (p *myProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    // Process traces
    // Mutate td as needed
    // Pass to next processor
    return p.next.ConsumeTraces(ctx, td)
}

func (p *myProcessor) Capabilities() consumer.Capabilities {
    return consumer.Capabilities{MutatesData: true}
}
```

### 2. Configuration

Define processor config struct:

```go
package myprocessor

type Config struct {
    // Configuration fields
    Enabled   bool   `mapstructure:"enabled"`
    Threshold int    `mapstructure:"threshold"`
    KeyPath   string `mapstructure:"key_path"`
}

// Validate implements component.Config
func (cfg *Config) Validate() error {
    if cfg.Threshold < 0 {
        return errors.New("threshold must be non-negative")
    }
    return nil
}
```

YAML config example:

```yaml
processors:
  myprocessor:
    enabled: true
    threshold: 100
    key_path: /path/to/key
```

### 3. Factory Pattern

Create processor factory:

```go
package myprocessor

import (
    "context"
    "go.opentelemetry.io/collector/component"
    "go.opentelemetry.io/collector/consumer"
    "go.opentelemetry.io/collector/processor"
)

const (
    typeStr   = "myprocessor"
    stability = component.StabilityLevelAlpha
)

func NewFactory() processor.Factory {
    return processor.NewFactory(
        typeStr,
        createDefaultConfig,
        processor.WithTraces(createTracesProcessor, stability),
    )
}

func createDefaultConfig() component.Config {
    return &Config{
        Enabled:   true,
        Threshold: 100,
    }
}

func createTracesProcessor(
    ctx context.Context,
    set processor.CreateSettings,
    cfg component.Config,
    nextConsumer consumer.Traces,
) (processor.Traces, error) {
    oCfg := cfg.(*Config)
    return newMyProcessor(oCfg, nextConsumer), nil
}
```

### 4. Span Manipulation (Immutable Patterns)

**IMPORTANT**: Always create new spans, never mutate directly

```go
func (p *myProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    rss := td.ResourceSpans()
    for i := 0; i < rss.Len(); i++ {
        rs := rss.At(i)
        ilss := rs.ScopeSpans()
        for j := 0; j < ilss.Len(); j++ {
            ils := ilss.At(j)
            spans := ils.Spans()
            for k := 0; k < spans.Len(); k++ {
                span := spans.At(k)

                // Read span attributes
                attrs := span.Attributes()

                // Add new attribute (safe mutation within processor)
                attrs.PutStr("processor.name", "myprocessor")

                // Example: Filter spans
                if shouldFilter(span) {
                    spans.RemoveIf(func(s ptrace.Span) bool {
                        return s.SpanID() == span.SpanID()
                    })
                }
            }
        }
    }

    return p.next.ConsumeTraces(ctx, td)
}
```

### 5. Testing

Test processor with mock data:

```go
package myprocessor

import (
    "context"
    "testing"
    "go.opentelemetry.io/collector/consumer/consumertest"
    "go.opentelemetry.io/collector/pdata/ptrace"
    "github.com/stretchr/testify/assert"
)

func TestMyProcessor(t *testing.T) {
    // Create mock sink
    sink := new(consumertest.TracesSink)

    // Create processor
    cfg := &Config{Enabled: true, Threshold: 10}
    proc := newMyProcessor(cfg, sink)

    // Create test traces
    td := ptrace.NewTraces()
    rs := td.ResourceSpans().AppendEmpty()
    ils := rs.ScopeSpans().AppendEmpty()
    span := ils.Spans().AppendEmpty()
    span.SetName("test-span")
    span.Attributes().PutStr("http.method", "GET")

    // Process traces
    err := proc.ConsumeTraces(context.Background(), td)
    assert.NoError(t, err)

    // Verify output
    assert.Len(t, sink.AllTraces(), 1)
    outSpan := sink.AllTraces()[0].ResourceSpans().At(0).ScopeSpans().At(0).Spans().At(0)
    assert.Equal(t, "test-span", outSpan.Name())
}
```

## Common Processor Patterns

### Pattern 1: Attribute Processor (Add/Modify Attributes)

**Use Case**: Add custom metadata to spans

```go
func (p *attributeProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    rss := td.ResourceSpans()
    for i := 0; i < rss.Len(); i++ {
        rs := rss.At(i)
        ilss := rs.ScopeSpans()
        for j := 0; j < ilss.Len(); j++ {
            ils := ilss.At(j)
            spans := ils.Spans()
            for k := 0; k < spans.Len(); k++ {
                span := spans.At(k)
                attrs := span.Attributes()

                // Add metadata
                attrs.PutStr("environment", p.config.Environment)
                attrs.PutStr("deployment", p.config.Deployment)

                // Compute derived attribute
                if method, ok := attrs.Get("http.method"); ok {
                    attrs.PutBool("http.is_mutation",
                        method.Str() == "POST" || method.Str() == "PUT")
                }
            }
        }
    }
    return p.next.ConsumeTraces(ctx, td)
}
```

### Pattern 2: Filter Processor (Drop Spans)

**Use Case**: Filter out health check spans

```go
func (p *filterProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    rss := td.ResourceSpans()
    for i := 0; i < rss.Len(); i++ {
        rs := rss.At(i)
        ilss := rs.ScopeSpans()
        for j := 0; j < ilss.Len(); j++ {
            ils := ilss.At(j)
            spans := ils.Spans()

            // Remove health check spans
            spans.RemoveIf(func(span ptrace.Span) bool {
                if url, ok := span.Attributes().Get("http.url"); ok {
                    return strings.Contains(url.Str(), "/health")
                }
                return false
            })
        }
    }
    return p.next.ConsumeTraces(ctx, td)
}
```

### Pattern 3: Signing Processor (Cryptographic Integrity)

**Use Case**: Sign spans with HMAC for tamper detection

```go
func (p *signingProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    rss := td.ResourceSpans()
    for i := 0; i < rss.Len(); i++ {
        rs := rss.At(i)
        ilss := rs.ScopeSpans()
        for j := 0; j < ilss.Len(); j++ {
            ils := ilss.At(j)
            spans := ils.Spans()
            for k := 0; k < spans.Len(); k++ {
                span := spans.At(k)

                // Compute HMAC signature
                signature := p.computeSignature(span)

                // Add signature as attribute
                span.Attributes().PutStr("span.signature", signature)
                span.Attributes().PutStr("span.signature.algorithm", "HMAC-SHA256")
                span.Attributes().PutInt("span.signature.timestamp", time.Now().Unix())
            }
        }
    }
    return p.next.ConsumeTraces(ctx, td)
}

func (p *signingProcessor) computeSignature(span ptrace.Span) string {
    // Serialize span fields to sign
    data := fmt.Sprintf("%s:%s:%s:%d",
        span.TraceID().String(),
        span.SpanID().String(),
        span.Name(),
        span.StartTimestamp(),
    )

    // Compute HMAC-SHA256
    mac := hmac.New(sha256.New, p.signingKey)
    mac.Write([]byte(data))
    signature := mac.Sum(nil)

    // Return base64-encoded signature
    return base64.StdEncoding.EncodeToString(signature)
}
```

### Pattern 4: Compliance Processor (Emit Compliance Spans)

**Use Case**: Generate compliance evidence spans

```go
func (p *complianceProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    // Process existing spans
    rss := td.ResourceSpans()
    for i := 0; i < rss.Len(); i++ {
        rs := rss.At(i)
        ilss := rs.ScopeSpans()
        for j := 0; j < ilss.Len(); j++ {
            ils := ilss.At(j)
            spans := ils.Spans()
            for k := 0; k < spans.Len(); k++ {
                span := spans.At(k)

                // Check if span requires compliance tracking
                if p.requiresCompliance(span) {
                    // Add compliance span to batch
                    complianceSpan := ils.Spans().AppendEmpty()
                    complianceSpan.SetName("compliance.evidence")
                    complianceSpan.SetTraceID(span.TraceID())
                    complianceSpan.SetSpanID(generateSpanID())
                    complianceSpan.SetParentSpanID(span.SpanID())
                    complianceSpan.SetStartTimestamp(span.StartTimestamp())
                    complianceSpan.SetEndTimestamp(span.EndTimestamp())

                    attrs := complianceSpan.Attributes()
                    attrs.PutStr("compliance.framework", "soc2")
                    attrs.PutStr("compliance.control", "CC6_1")
                    attrs.PutStr("compliance.evidence_type", "audit_trail")
                    attrs.PutStr("compliance.operation", span.Name())
                }
            }
        }
    }

    return p.next.ConsumeTraces(ctx, td)
}
```

## OTEL Collector Integration

### Building Custom Collector

Create `otelcol-builder.yaml`:

```yaml
dist:
  name: otelcol-custom
  description: Custom OTEL Collector with FLUO processors
  version: 1.0.0
  output_path: ./dist

exporters:
  - gomod: go.opentelemetry.io/collector/exporter/otlpexporter v0.91.0

processors:
  - gomod: go.opentelemetry.io/collector/processor/batchprocessor v0.91.0
  - gomod: github.com/fluohq/otel-span-signer v1.0.0  # Custom processor

receivers:
  - gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.91.0
```

Build:

```bash
ocb --config otelcol-builder.yaml
```

### Collector Configuration

`otel-collector-config.yaml`:

```yaml
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
    send_batch_size: 1024

  # Custom span signer processor
  spansigner:
    enabled: true
    key_path: /keys/signing-key.pem
    algorithm: HMAC-SHA256

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, spansigner]  # Custom processor in pipeline
      exporters: [otlp/tempo]
```

## Error Handling

### Pattern: Graceful Degradation

```go
func (p *myProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    rss := td.ResourceSpans()
    for i := 0; i < rss.Len(); i++ {
        rs := rss.At(i)
        ilss := rs.ScopeSpans()
        for j := 0; j < ilss.Len(); j++ {
            ils := ilss.At(j)
            spans := ils.Spans()
            for k := 0; k < spans.Len(); k++ {
                span := spans.At(k)

                // Try to process span
                if err := p.processSpan(span); err != nil {
                    // Log error but continue processing
                    p.logger.Warn("Failed to process span, continuing",
                        zap.Error(err),
                        zap.String("span_id", span.SpanID().String()),
                    )
                    // Mark span as partially processed
                    span.Attributes().PutBool("processor.error", true)
                    span.Attributes().PutStr("processor.error_message", err.Error())
                }
            }
        }
    }

    // Always pass traces to next processor (degraded state is acceptable)
    return p.next.ConsumeTraces(ctx, td)
}
```

## Performance Considerations

### 1. Avoid Unnecessary Copies

```go
// BAD: Creates copy of entire trace
td2 := ptrace.NewTraces()
td.CopyTo(td2)

// GOOD: Mutate in-place
rss := td.ResourceSpans()
```

### 2. Batch Operations

```go
// BAD: Process spans one at a time
for each span:
    p.next.ConsumeTraces(ctx, singleSpan)

// GOOD: Batch spans
p.next.ConsumeTraces(ctx, allSpans)
```

### 3. Use Context for Cancellation

```go
func (p *myProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
        // Process traces
    }
}
```

## Security Considerations

### 1. Validate Configuration

```go
func (cfg *Config) Validate() error {
    if cfg.KeyPath == "" {
        return errors.New("key_path is required")
    }

    // Check file exists and is readable
    if _, err := os.Stat(cfg.KeyPath); os.IsNotExist(err) {
        return fmt.Errorf("key file does not exist: %s", cfg.KeyPath)
    }

    return nil
}
```

### 2. Sanitize Attributes

```go
func (p *myProcessor) sanitizeAttributes(attrs pcommon.Map) {
    // Remove sensitive attributes
    attrs.Remove("authorization")
    attrs.Remove("api_key")
    attrs.Remove("password")

    // Redact PII
    if email, ok := attrs.Get("user.email"); ok {
        attrs.PutStr("user.email", redact(email.Str()))
    }
}
```

### 3. Rate Limiting

```go
func (p *myProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    // Check rate limit
    if !p.rateLimiter.Allow() {
        p.logger.Warn("Rate limit exceeded, dropping traces")
        return nil  // Drop traces, don't fail pipeline
    }

    return p.next.ConsumeTraces(ctx, td)
}
```

## Common Pitfalls

### ❌ Pitfall 1: Mutating Input Without Capability

```go
func (p *myProcessor) Capabilities() consumer.Capabilities {
    return consumer.Capabilities{MutatesData: false}  // WRONG if mutating
}
```

**Fix**: Declare mutation capability

```go
func (p *myProcessor) Capabilities() consumer.Capabilities {
    return consumer.Capabilities{MutatesData: true}
}
```

### ❌ Pitfall 2: Not Handling Empty Traces

```go
func (p *myProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    span := td.ResourceSpans().At(0).ScopeSpans().At(0).Spans().At(0)  // PANIC if empty
}
```

**Fix**: Check lengths

```go
rss := td.ResourceSpans()
if rss.Len() == 0 {
    return p.next.ConsumeTraces(ctx, td)  // No-op for empty traces
}
```

### ❌ Pitfall 3: Blocking Operations

```go
func (p *myProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    // WRONG: Blocking KMS call on hot path
    signature := p.kms.Sign(span)  // 50ms latency!
}
```

**Fix**: Use caching or async processing

```go
// Cache signing keys
signingKey := p.keyCache.Get(tenantID)

// Compute signature locally (fast)
mac := hmac.New(sha256.New, signingKey)
```

## Example: otel-span-signer Processor

Complete example processor for span signing:

```go
// processor.go
package spansigner

import (
    "context"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/base64"
    "fmt"
    "time"

    "go.opentelemetry.io/collector/consumer"
    "go.opentelemetry.io/collector/pdata/ptrace"
    "go.uber.org/zap"
)

type spanSignerProcessor struct {
    config     *Config
    next       consumer.Traces
    logger     *zap.Logger
    signingKey []byte
}

func newSpanSignerProcessor(cfg *Config, next consumer.Traces, logger *zap.Logger) (*spanSignerProcessor, error) {
    // Load signing key
    key, err := loadSigningKey(cfg.KeyPath)
    if err != nil {
        return nil, fmt.Errorf("failed to load signing key: %w", err)
    }

    return &spanSignerProcessor{
        config:     cfg,
        next:       next,
        logger:     logger,
        signingKey: key,
    }, nil
}

func (p *spanSignerProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    if !p.config.Enabled {
        return p.next.ConsumeTraces(ctx, td)
    }

    rss := td.ResourceSpans()
    for i := 0; i < rss.Len(); i++ {
        rs := rss.At(i)
        ilss := rs.ScopeSpans()
        for j := 0; j < ilss.Len(); j++ {
            ils := ilss.At(j)
            spans := ils.Spans()
            for k := 0; k < spans.Len(); k++ {
                span := spans.At(k)

                // Sign span
                signature := p.signSpan(span)

                // Add signature attributes
                attrs := span.Attributes()
                attrs.PutStr("span.signature", signature)
                attrs.PutStr("span.signature.algorithm", "HMAC-SHA256")
                attrs.PutInt("span.signature.timestamp", time.Now().Unix())
            }
        }
    }

    return p.next.ConsumeTraces(ctx, td)
}

func (p *spanSignerProcessor) signSpan(span ptrace.Span) string {
    // Serialize span data
    data := fmt.Sprintf("%s:%s:%s:%d",
        span.TraceID().String(),
        span.SpanID().String(),
        span.Name(),
        span.StartTimestamp(),
    )

    // Compute HMAC-SHA256
    mac := hmac.New(sha256.New, p.signingKey)
    mac.Write([]byte(data))
    signature := mac.Sum(nil)

    return base64.StdEncoding.EncodeToString(signature)
}

func (p *spanSignerProcessor) Capabilities() consumer.Capabilities {
    return consumer.Capabilities{MutatesData: true}
}
```

## References

- **OTEL Collector Documentation**: https://opentelemetry.io/docs/collector/
- **Processor Development Guide**: https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/README.md
- **pdata Package**: https://pkg.go.dev/go.opentelemetry.io/collector/pdata
- **ADR-024**: OTEL Span Signer Processor (FLUO-specific)
- **Existing Processors**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor
