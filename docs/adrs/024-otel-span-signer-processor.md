# ADR-024: OTEL Span Signer Processor

## Status
**Accepted** - 2025-01-22

## Context

BeTrace initially included span signing as an integrated feature (PRD-003: Span Integrity Through Cryptographic Signatures). This added ~500 LOC to the BeTrace backend for:
- Signature generation (HMAC-SHA256)
- Signature verification API
- Signature event recording
- Frontend verification UI

**Key Insight**: Span signing is **useful beyond BeTrace** for any system requiring telemetry integrity.

**User Feedback**:
> "I think span signing is a separate otel processor. I think it could be useful independently of betrace."

**OpenTelemetry Architecture**: Collectors support **pluggable processors** for span transformation

**Market Gap**: No existing OTEL processor provides cryptographic span signing (as of 2025-01-22)

## Decision

We extract span signing into a **standalone OTEL Collector processor** named `otel-span-signer`.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│            OTEL Collector Pipeline                      │
│                                                          │
│  Receivers → Processors → Exporters                     │
│              ↓                                           │
│         ┌────────────────┐                              │
│         │otel-span-signer│                              │
│         │                │                              │
│         │ - Signs spans  │                              │
│         │ - HMAC-SHA256  │                              │
│         │ - Per-tenant   │                              │
│         │   signing keys │                              │
│         │ - KMS-backed   │                              │
│         └────────────────┘                              │
│              ↓                                           │
│         Signed Spans → Tempo/Jaeger                     │
└─────────────────────────────────────────────────────────┘
```

### Signed Span Format

**Span Attributes Added**:
```json
{
  "span.signature": "base64-encoded-HMAC-SHA256-signature",
  "span.signature.algorithm": "HMAC-SHA256",
  "span.signature.timestamp": 1737580800,
  "span.signature.key_id": "tenant-abc-key-v1"
}
```

**Signature Computation**:
```
data = traceId + spanId + spanName + startTimestamp
signature = HMAC-SHA256(signingKey, data)
signatureB64 = base64(signature)
```

### Configuration

**OTEL Collector Config**:
```yaml
processors:
  spansigner:
    enabled: true
    algorithm: HMAC-SHA256
    key_provider: aws-kms  # or: local, vault, gcp, azure
    key_id: arn:aws:kms:us-east-1:123456789:key/abc
    # Optional: Per-tenant keys
    tenant_key_mapping:
      tenant-a: arn:aws:kms:us-east-1:123456789:key/key-a
      tenant-b: arn:aws:kms:us-east-1:123456789:key/key-b

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, spansigner]  # spansigner before export
      exporters: [otlp/tempo]
```

## Rationale

### 1. Separation of Concerns

**BeTrace Responsibility**: BeTraceDSL pattern matching

**OTEL Processor Responsibility**: Span transformation (signing)

**Benefit**: BeTrace focuses on unique capability, span signing is reusable

### 2. Broader Applicability

**Use Cases Beyond BeTrace**:
- **Compliance Auditing**: Prove spans weren't tampered with post-collection
- **Forensic Analysis**: Verify telemetry integrity during incident response
- **Multi-Tenant SaaS**: Prove tenant X's spans weren't modified by tenant Y
- **Supply Chain Security**: Sign spans from critical services (similar to Sigstore)

### 3. OTEL Ecosystem Integration

**Existing OTEL Processors** (100+ processors):
- `batch` - Batches spans
- `attributes` - Modifies span attributes
- `filter` - Filters spans
- `tail_sampling` - Samples traces

**otel-span-signer Adds**:
- Cryptographic integrity for spans
- KMS integration for key management
- Per-tenant signing keys

### 4. Performance: HMAC vs. Cosign

**Cosign Performance** (from user research):
- Signature generation: 50-200ms (too slow for real-time)
- Requires Rekor transparency log (network dependency)

**HMAC Performance**:
- Signature generation: <1ms (acceptable for real-time)
- No network dependency (key cached locally)

**Hybrid Approach**:
- **Real-time**: HMAC signing in OTEL processor (<1ms)
- **Batch attestations**: Cosign for periodic transparency log entries (offline)

## Implementation

### Go Implementation (otel-span-signer)

**Processor Interface**:
```go
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
    keyCache   *KeyCache
}

func (p *spanSignerProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
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
                attrs.PutStr("span.signature.key_id", p.config.KeyID)
            }
        }
    }

    return p.next.ConsumeTraces(ctx, td)
}

func (p *spanSignerProcessor) signSpan(span ptrace.Span) string {
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

    return base64.StdEncoding.EncodeToString(signature)
}
```

### Configuration Structure

```go
package spansigner

type Config struct {
    Enabled    bool              `mapstructure:"enabled"`
    Algorithm  string            `mapstructure:"algorithm"`
    KeyProvider string           `mapstructure:"key_provider"`
    KeyID      string            `mapstructure:"key_id"`

    // Optional: Per-tenant key mapping
    TenantKeyMapping map[string]string `mapstructure:"tenant_key_mapping"`

    // KMS configuration
    AWS   *AWSConfig   `mapstructure:"aws"`
    Vault *VaultConfig `mapstructure:"vault"`
    GCP   *GCPConfig   `mapstructure:"gcp"`
}

type AWSConfig struct {
    Region       string `mapstructure:"region"`
    MasterKeyID  string `mapstructure:"master_key_id"`
}

type VaultConfig struct {
    Addr       string `mapstructure:"addr"`
    Token      string `mapstructure:"token"`
    TransitKey string `mapstructure:"transit_key"`
}

type GCPConfig struct {
    ProjectID string `mapstructure:"project_id"`
    Location  string `mapstructure:"location"`
    KeyRing   string `mapstructure:"keyring"`
    KeyName   string `mapstructure:"key_name"`
}
```

### Verification (Optional Processor)

**Separate Processor**: `otel-span-verifier`

```go
func (p *spanVerifierProcessor) ConsumeTraces(ctx context.Context, td ptrace.Traces) error {
    rss := td.ResourceSpans()
    for i := 0; i < rss.Len(); i++ {
        rs := rss.At(i)
        ilss := rs.ScopeSpans()
        for j := 0; j < ilss.Len(); j++ {
            ils := ilss.At(j)
            spans := ils.Spans()
            for k := 0; k < spans.Len(); k++ {
                span := spans.At(k)

                // Verify signature
                if !p.verifySpan(span) {
                    p.logger.Warn("Signature verification failed",
                        zap.String("span_id", span.SpanID().String()),
                    )
                    // Mark span as unverified
                    span.Attributes().PutBool("span.signature.verified", false)
                } else {
                    span.Attributes().PutBool("span.signature.verified", true)
                }
            }
        }
    }

    return p.next.ConsumeTraces(ctx, td)
}
```

## Consequences

### Positive

1. **Modularity**: Span signing usable beyond BeTrace
2. **Reusability**: Any OTEL Collector user can sign spans
3. **Performance**: HMAC <1ms latency (real-time compatible)
4. **KMS Integration**: Supports AWS KMS, GCP Cloud KMS, HashiCorp Vault, Azure Key Vault
5. **Standard OTEL**: Follows OTEL Collector processor conventions

### Negative

1. **Additional Project**: Maintain `otel-span-signer` separately from BeTrace
2. **Go Development**: BeTrace team must learn Go (processors written in Go)
3. **Distribution**: Must publish to OTEL Collector registry

### Mitigation Strategies

1. **Skills**: Create `.skills/otel-processor/` skill for Go development ✅
2. **Documentation**: Provide processor configuration examples
3. **Testing**: Comprehensive tests for HMAC signing, KMS integration

## Implementation Plan

### Phase 1: Processor Scaffolding (Week 1)
- Create `otel-span-signer` repository
- Scaffold processor structure (Go)
- Implement basic HMAC signing
- Unit tests for signature generation

### Phase 2: KMS Integration (Week 2)
- AWS KMS client
- GCP Cloud KMS client
- HashiCorp Vault client
- Key caching layer

### Phase 3: Configuration & Testing (Week 3)
- Configuration validation
- Per-tenant key mapping
- Integration tests with OTEL Collector
- Performance benchmarks (<1ms latency)

### Phase 4: Distribution (Week 4)
- Publish to GitHub
- OTEL Collector builder config
- Documentation (README, examples)
- Submit to OTEL Collector contrib registry

## Alternatives Considered

### 1. Keep Span Signing in BeTrace
**Rejected**: Span signing is orthogonal to BeTraceDSL pattern matching

### 2. Use Cosign for Real-Time Signing
**Rejected**: 50-200ms latency too slow for real-time telemetry

### 3. Sign Spans in Application (Pre-Collection)
**Rejected**: Requires SDK changes, not portable across languages

## Future Enhancements

### 1. Cosign Attestations (Batch)

**Use Case**: Generate periodic Cosign attestations for transparency logs

**Flow**:
```
OTEL Collector → otel-span-signer (HMAC, real-time)
                      ↓
                   Tempo Storage
                      ↓
            Batch Job (daily) → Generate Cosign attestations
                      ↓
                 Rekor Transparency Log
```

**Example**:
```bash
# Daily batch job
cosign attest --key key.pem \
  --predicate spans-2025-01-22.json \
  --type https://betrace.dev/attestation/spans/v1 \
  --output attestation.json
```

### 2. Span Signature Verification in Grafana

**Use Case**: Display signature verification status in Grafana

**Implementation**:
- BeTrace Grafana datasource checks `span.signature.verified` attribute
- Display ✅ or ❌ in violation table

### 3. Multi-Signature Support

**Use Case**: Sign spans with multiple keys (e.g., app key + infrastructure key)

**Implementation**:
```yaml
processors:
  spansigner:
    signatures:
      - key_id: app-key
        algorithm: HMAC-SHA256
      - key_id: infra-key
        algorithm: HMAC-SHA256
```

**Span Attributes**:
```json
{
  "span.signatures": [
    {
      "key_id": "app-key",
      "signature": "base64-signature-1",
      "algorithm": "HMAC-SHA256"
    },
    {
      "key_id": "infra-key",
      "signature": "base64-signature-2",
      "algorithm": "HMAC-SHA256"
    }
  ]
}
```

## Impact on BeTrace

### Before (Integrated Signing)
- BeTrace backend signs spans
- `/api/signatures/verify` verification endpoint
- Signature event recording in TigerBeetle
- Frontend verification UI

### After (OTEL Processor)
- **OTEL Collector signs spans** (before BeTrace receives them)
- BeTrace treats signatures as span attributes (no special handling)
- Verification via Tempo queries, not BeTrace API
- No signature UI in BeTrace

### Code Removal from BeTrace

**PRDs to Archive**:
- `003a-core-signature-service.md` → ❌ Archived
- `003b-signing-processor-integration.md` → ❌ Archived
- `003c-verification-api-routes.md` → ❌ Archived
- `003d-tigerbeetle-verification-events.md` → ❌ Archived
- `003e-frontend-verification-ui.md` → ❌ Archived

**Backend Code to Remove**:
- `ComplianceSpanSigner.java` (~200 LOC) → ❌ Remove
- `SignatureVerificationService.java` (~150 LOC) → ❌ Remove
- Signature verification routes (~150 LOC) → ❌ Remove

**Total LOC Removed from BeTrace**: ~500 LOC

## References

- **OTEL Collector Processors**: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor
- **HMAC-SHA256**: https://en.wikipedia.org/wiki/HMAC
- **Sigstore Cosign**: https://github.com/sigstore/cosign
- **AWS KMS**: https://aws.amazon.com/kms/
- **GCP Cloud KMS**: https://cloud.google.com/kms
- **HashiCorp Vault Transit**: https://www.vaultproject.io/docs/secrets/transit
- **Related ADRs**:
  - ADR-022: Grafana-First Architecture
  - ADR-023: Single-Tenant Deployment Model
- **Skills**:
  - `.skills/otel-processor/` - OTEL Collector processor development
