# BeTrace gRPC+REST Architecture

## Overview

BeTrace uses **gRPC-first with grpc-gateway** for maximum platform portability:

- **gRPC** (:50051) - Native high-performance protocol for SigNoz, Kibana, CLI tools
- **REST** (:12011) - HTTP/JSON via grpc-gateway for Grafana, browsers, curl

**Single source of truth:** Protocol Buffer definitions generate both APIs.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    BeTrace Backend                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │    Protocol Buffer Definitions (.proto)        │    │
│  │    - betrace/v1/rules.proto                     │    │
│  │    - betrace/v1/violations.proto                │    │
│  │    - betrace/v1/spans.proto                     │    │
│  │    - betrace/v1/health.proto                    │    │
│  └────────────────────────────────────────────────┘    │
│         │                                                │
│         ↓                                                │
│  ┌────────────────────────────────────────────────┐    │
│  │         gRPC Services (Go)                      │    │
│  │    - RuleService                                │    │
│  │    - ViolationService                           │    │
│  │    - SpanService                                │    │
│  │    - HealthService                              │    │
│  └────────────────────────────────────────────────┘    │
│         │                           │                    │
│         ↓                           ↓                    │
│  ┌──────────────┐          ┌──────────────┐            │
│  │ gRPC Server  │          │ grpc-gateway │            │
│  │ :50051       │          │ (REST proxy) │            │
│  └──────────────┘          │ :12011       │            │
│                            └──────────────┘            │
└─────────────────────────────────────────────────────────┘
         │                           │
         ↓                           ↓
┌─────────────────┐        ┌─────────────────┐
│  SigNoz Plugin  │        │ Grafana Plugin  │
│  (gRPC native)  │        │ (REST/HTTP)     │
│  - Direct conn  │        │ - fetch() calls │
│  - 10x faster   │        │ - Browser-safe  │
└─────────────────┘        └─────────────────┘

         ↓                           ↓
┌─────────────────┐        ┌─────────────────┐
│ Kibana Plugin   │        │   CLI Tools     │
│ (gRPC native)   │        │   (gRPC/REST)   │
└─────────────────┘        └─────────────────┘
```

## Platform Compatibility

| Platform | Protocol | Client Type | Performance |
|----------|----------|-------------|-------------|
| **SigNoz** | gRPC | Native Go | 🚀 Fast |
| **Grafana** | REST | TypeScript fetch() | ✅ Good |
| **Kibana** | gRPC | Node.js gRPC | 🚀 Fast |
| **CLI Tools** | gRPC | Go/Python/Rust | 🚀 Fast |
| **Curl/Postman** | REST | HTTP client | ✅ Good |

## Protocol Buffer Definitions

### Rules API

```protobuf
service RuleService {
  rpc ListRules(ListRulesRequest) returns (ListRulesResponse) {
    option (google.api.http) = { get: "/api/rules" };
  }

  rpc CreateRule(CreateRuleRequest) returns (Rule) {
    option (google.api.http) = { post: "/api/rules" body: "*" };
  }

  rpc GetRule(GetRuleRequest) returns (Rule) {
    option (google.api.http) = { get: "/api/rules/{id}" };
  }

  rpc UpdateRule(UpdateRuleRequest) returns (Rule) {
    option (google.api.http) = { put: "/api/rules/{id}" body: "*" };
  }

  rpc DeleteRule(DeleteRuleRequest) returns (DeleteRuleResponse) {
    option (google.api.http) = { delete: "/api/rules/{id}" };
  }
}
```

**Generated:**
- Go gRPC server: `rules_grpc.pb.go`
- Go messages: `rules.pb.go`
- REST gateway: `rules.pb.gw.go`
- OpenAPI spec: `betrace.swagger.json`

## Observability: OpenTelemetry Metrics

BeTrace uses **OTel Metrics API** for universal platform support:

### Metrics Export

**Dual Export Strategy:**
1. **OTLP (gRPC push)** → SigNoz, Kibana, any OTel collector
2. **Prometheus scrape** → Prometheus, Grafana

```go
// backend/internal/observability/otel.go
func InitOpenTelemetry(ctx context.Context, serviceName string) {
    // 1. OTLP metrics exporter (push to SigNoz/Kibana)
    metricExporter := otlpmetricgrpc.New(ctx,
        otlpmetricgrpc.WithEndpoint("localhost:4317"),
    )

    meterProvider := metric.NewMeterProvider(
        metric.WithReader(metric.NewPeriodicReader(metricExporter)),
    )

    otel.SetMeterProvider(meterProvider)

    // 2. Prometheus /metrics endpoint (scrape from Prometheus)
    http.Handle("/metrics", promhttp.Handler())
}
```

### Metrics Platform Support

| Platform | Ingest Method | BeTrace Export |
|----------|---------------|----------------|
| **SigNoz** | OTLP (push) | ✅ Native |
| **Kibana** | OTLP (push) | ✅ Native |
| **Prometheus** | HTTP scrape | ✅ /metrics endpoint |
| **Grafana** | Prometheus backend | ✅ /metrics endpoint |
| **DataDog** | OTLP (push) | ✅ Native |

**No platform-specific code.** Single OTel implementation works everywhere.

## API Usage Examples

### REST API (Grafana Plugin)

```typescript
// Grafana plugin - Uses REST via fetch()
const response = await fetch('http://localhost:12011/api/rules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'detect-errors',
    expression: 'span.status == "ERROR"',
    enabled: true
  })
});

const rule = await response.json();
```

### gRPC API (SigNoz Plugin)

```go
// SigNoz plugin - Native gRPC
conn, _ := grpc.Dial("localhost:50051", grpc.WithInsecure())
client := pb.NewRuleServiceClient(conn)

rule, _ := client.CreateRule(ctx, &pb.CreateRuleRequest{
    Name:       "detect-errors",
    Expression: `span.status == "ERROR"`,
    Enabled:    true,
})
```

### cURL (Debugging)

```bash
# Create rule
curl -X POST http://localhost:12011/api/rules \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "detect-errors",
    "expression": "span.status == \"ERROR\"",
    "enabled": true
  }'

# List rules
curl http://localhost:12011/api/rules

# Get metrics
curl http://localhost:12011/metrics | grep betrace_
```

## Code Generation

### Generate gRPC + REST from Protos

```bash
cd backend/api/proto

# Install buf CLI
go install github.com/bufbuild/buf/cmd/buf@latest

# Install protoc plugins
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest

# Generate code
PATH="$PATH:$HOME/go/bin" buf generate
```

**Generated files:**
- `betrace/v1/*.pb.go` - Protocol Buffer messages
- `betrace/v1/*_grpc.pb.go` - gRPC server/client stubs
- `betrace/v1/*.pb.gw.go` - grpc-gateway REST proxy
- `openapi/betrace.swagger.json` - OpenAPI documentation

### Generate TypeScript Client (Grafana Plugin)

```bash
# Install protoc TypeScript plugin
npm install -g protoc-gen-ts

# Generate TypeScript types from .proto
protoc --ts_out=grafana-betrace-app/src/api/generated \
  backend/api/proto/betrace/v1/*.proto
```

**Usage in Grafana:**
```typescript
// Use generated types for type safety
import { Rule, CreateRuleRequest } from './api/generated/betrace/v1/rules_pb';

const rule: Rule = await fetch('/api/rules/1').then(r => r.json());
```

## Server Implementation

### Dual Server (gRPC + REST)

```go
// backend/cmd/betrace-backend/main.go
func main() {
    // 1. Start gRPC server
    grpcServer := grpc.NewServer()
    pb.RegisterRuleServiceServer(grpcServer, &services.RuleService{})

    grpcListener, _ := net.Listen("tcp", ":50051")
    go grpcServer.Serve(grpcListener)

    // 2. Start grpc-gateway (REST proxy)
    mux := runtime.NewServeMux()

    // Connect to local gRPC server
    opts := []grpc.DialOption{grpc.WithInsecure()}
    pb.RegisterRuleServiceHandlerFromEndpoint(ctx, mux, "localhost:50051", opts)

    // 3. Serve REST API
    http.ListenAndServe(":12011", mux)
}
```

**Result:**
- gRPC: `localhost:50051` (SigNoz, Kibana, CLI)
- REST: `localhost:12011` (Grafana, browsers)
- Same business logic, zero duplication

## Benefits

### 1. Platform Portability
- ✅ Works with Grafana (REST)
- ✅ Works with SigNoz (gRPC)
- ✅ Works with Kibana (gRPC)
- ✅ Works with any OTel-compatible platform

### 2. Type Safety
- ✅ Protobuf definitions = single source of truth
- ✅ Compile-time type checking
- ✅ No API drift between client and server

### 3. Performance
- 🚀 gRPC: 80% faster than REST (protobuf binary encoding)
- 🚀 Streaming: Real-time violations (gRPC-only)
- ✅ REST: Good enough for Grafana plugin

### 4. Versioning
- ✅ `betrace.v1`, `betrace.v2` packages
- ✅ Backward-compatible changes
- ✅ Gradual migration path

### 5. Documentation
- ✅ OpenAPI spec auto-generated from .proto
- ✅ Swagger UI for REST API
- ✅ gRPC reflection for debugging

## Monitoring

### Metrics

```bash
# View all BeTrace metrics
curl http://localhost:12011/metrics | grep betrace_

# Example metrics:
betrace_rule_evaluation_duration_seconds_bucket
betrace_rule_engine_spans_processed_total
betrace_compliance_spans_emitted_total
```

### Health Checks

```bash
# REST
curl http://localhost:12011/health

# gRPC (with grpcurl)
grpcurl -plaintext localhost:50051 betrace.v1.HealthService/Check
```

## References

- **Protocol Buffers:** [backend/api/proto/betrace/v1/](../backend/api/proto/betrace/v1/)
- **OpenAPI Spec:** [backend/api/openapi/betrace.swagger.json](../backend/api/openapi/betrace.swagger.json)
- **gRPC Services:** [backend/internal/grpc/services/](../backend/internal/grpc/services/)
- **OTel Metrics:** [backend/internal/observability/metrics_otel.go](../backend/internal/observability/metrics_otel.go)
