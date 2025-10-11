# PRD-009: Trace Ingestion Pipeline

**Priority:** P0 (Core Feature)
**Complexity:** Complex
**Personas:** All
**Dependencies:** PRD-002 (Persistence), PRD-005 (Sandboxing)

## Problem

No span ingestion or trace correlation:
- `POST /api/spans` endpoint exists but doesn't evaluate rules
- Spans not correlated into traces
- No Drools rule evaluation
- Signals not generated automatically

## Solution

### Ingestion Flow

```
OpenTelemetry Span
  ↓
POST /api/spans
  ↓
Correlate by trace_id
  ↓
Evaluate Drools rules (per tenant)
  ↓
Generate signals (if rules fire)
  ↓
Persist signals to DB
```

### Trace Correlation

- Group spans by `trace_id`
- Track trace lifecycle (first span → last span)
- Evaluate rules on trace completion OR sliding window

### Implementation

**SpanProcessor:**
```java
@POST
@Path("/spans")
public Response ingestSpans(List<OtelSpan> spans) {
    for (OtelSpan span : spans) {
        String tenantId = extractTenant(span);
        String traceId = span.getTraceId();

        // Add span to trace
        traceAggregator.addSpan(traceId, span);

        // Check if trace complete
        if (traceAggregator.isComplete(traceId)) {
            evaluateRules(tenantId, traceId);
        }
    }
}
```

## Success Criteria

- [ ] Accepts OpenTelemetry span format
- [ ] Correlates spans into traces
- [ ] Evaluates Drools rules per tenant
- [ ] Generates signals automatically
- [ ] Handles high throughput (10K+ spans/sec)
- [ ] Test coverage: Correlation, rule evaluation, signal generation

## Files to Create

- `backend/src/main/java/com/fluo/ingestion/TraceAggregator.java`
- `backend/src/main/java/com/fluo/ingestion/SpanProcessor.java`
- `backend/src/main/java/com/fluo/model/OtelSpan.java`

## Public Examples

### 1. OpenTelemetry Collector
**URL:** https://opentelemetry.io/docs/collector/

**Relevance:** Official reference implementation for OTLP span ingestion. This is the industry-standard component for receiving, processing, and exporting telemetry data. FLUO ingests OTLP spans, making this the authoritative source for span format and ingestion patterns.

**Key Patterns:**
- OTLP receiver for gRPC/HTTP span ingestion
- Processor pipeline (batch, filter, transform)
- Exporter pattern for storage backends
- Resource and instrumentation scope handling
- Span attribute conventions

**FLUO Implementation:** FLUO's span ingestion endpoint accepts OTLP format spans matching OpenTelemetry Collector's receiver specification.

### 2. Jaeger Architecture
**URL:** https://www.jaegertracing.io/docs/architecture/

**Relevance:** CNCF graduated project demonstrating production-grade trace ingestion and storage architecture. Shows proven patterns for span correlation, trace assembly, and high-throughput ingestion.

**Key Patterns:**
- Span collector service (UDP/HTTP/gRPC)
- Trace correlation by trace_id + span_id
- Storage abstraction (Cassandra, Elasticsearch, memory)
- Query service for trace retrieval
- Sampling strategies

**FLUO Alignment:** Jaeger's trace correlation logic (assembling spans into complete traces) directly applies to FLUO's TraceAggregator component.

### 3. Grafana Tempo
**URL:** https://grafana.com/docs/tempo/latest/

**Relevance:** Modern trace storage system with tiered architecture (hot/cold storage). Demonstrates how to efficiently store and query traces using object storage backends, matching FLUO's tiered storage requirements (PRD-002).

**Key Patterns:**
- OTLP ingestion with protocol translation
- Block-based trace storage (columnar format)
- Tiered storage (local disk → S3/GCS)
- TraceQL query language
- Multi-tenancy with tenant ID isolation

**FLUO Implementation:** Tempo's tiered storage architecture (recent traces in fast storage, old traces in object storage) informs FLUO's DuckDB hot tier → Parquet cold tier design.
