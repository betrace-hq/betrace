# BeTrace Integration with SigNoz

**Platform:** SigNoz (OpenTelemetry-native observability)
**Status:** Community Supported
**Difficulty:** ⭐⭐☆☆☆ (Easy - 2-3 weeks)
**Last Updated:** 2025-01-23

---

## Executive Summary

### Overview

SigNoz is an **OpenTelemetry-native** observability platform that uses a single ClickHouse backend for logs, metrics, and traces. BeTrace integrates naturally with SigNoz due to shared OTEL foundations.

### Why SigNoz?

✅ **OpenTelemetry-First Design**: SigNoz extends upstream OTEL Collector (perfect fit for BeTrace)
✅ **Single Backend**: ClickHouse handles all telemetry (simpler than Grafana's multi-backend approach)
✅ **Cost-Effective**: Open-source, self-hostable, lower operational overhead
✅ **Cloud-Native**: Built for Kubernetes, Docker, microservices environments

### Integration Effort

| Component | Effort | Complexity |
|-----------|--------|-----------|
| **OTEL Receiver Development** | 1.5-2 weeks | Medium |
| **Standalone UI Setup** | 3-5 days | Low |
| **Testing & Validation** | 3-5 days | Low |
| **Total** | **2-3 weeks** | **Easy** |

### Architectural Fit

**Excellent (9/10)** - BeTrace's OTEL-native design maps perfectly to SigNoz architecture.

---

## Architecture Overview

### High-Level Integration

```
┌─────────────────────────────────────────────────────────┐
│  BeTrace Standalone UI (Optional)                      │
│  - Storybook components extracted                      │
│  - MonacoRuleEditor for BeTraceDSL                      │
│  - Rule CRUD interface                                  │
│  - http://betrace-ui:3000                               │
└────────────────┬────────────────────────────────────────┘
                 ↓ (HTTP REST API)
┌─────────────────────────────────────────────────────────┐
│  BeTrace Backend (Go)                                   │
│  - /api/rules (CRUD BeTraceDSL rules)                   │
│  - /api/violations (query violations)                   │
│  - BeTraceDSL engine (Lua-based)                        │
│  - Violation detection                                  │
└────────────────┬────────────────────────────────────────┘
                 ↓ (OTLP/gRPC - violation spans)
┌─────────────────────────────────────────────────────────┐
│  SigNoz OTEL Collector (Extended)                       │
│                                                          │
│  Receivers:                                             │
│  - otlp (BeTrace violations)                            │
│  - betrace (custom receiver for /api/violations)        │
│                                                          │
│  Processors:                                            │
│  - batch (performance)                                  │
│  - filter (severity-based)                              │
│  - attributes (enrich spans)                            │
│                                                          │
│  Exporters:                                             │
│  - clickhouse (SigNoz backend)                          │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│  SigNoz Backend (ClickHouse)                            │
│  - traces table (violation spans)                       │
│  - Queryable via SigNoz UI                              │
│  - SQL-like queries                                     │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│  SigNoz UI                                              │
│  - Trace explorer (view violations)                     │
│  - Dashboards (violation metrics)                       │
│  - Alerts (trigger on critical violations)              │
└─────────────────────────────────────────────────────────┘
```

---

## Integration Options

### Option A: Custom OTEL Receiver (Recommended)

**Best for:** Production deployments, teams comfortable with Go development

**Approach:** Build a custom OTEL Collector receiver that queries BeTrace's `/api/violations` endpoint and converts violations to OTEL spans.

**Advantages:**
- ✅ Native OTEL integration (standard tooling)
- ✅ Violations appear in SigNoz alongside app traces
- ✅ Automatic correlation by trace ID
- ✅ Leverage SigNoz's full feature set (alerts, dashboards, etc.)

**Disadvantages:**
- ⚠️ Requires Go development (1.5-2 weeks)
- ⚠️ Custom receiver maintenance

**Effort:** 1.5-2 weeks

---

### Option B: Standalone UI + SigNoz for Visualization

**Best for:** Quick prototypes, teams preferring frontend over backend work

**Approach:** Deploy BeTrace UI as standalone app, configure backend to emit OTLP spans to SigNoz, use SigNoz UI for violation queries.

**Advantages:**
- ✅ No custom receiver development
- ✅ Faster setup (3-5 days)
- ✅ Reuse existing Storybook components

**Disadvantages:**
- ⚠️ Two UIs to manage (BeTrace + SigNoz)
- ⚠️ Less integrated experience

**Effort:** 3-5 days

---

## Option A: Custom OTEL Receiver Implementation

### Step 1: Understand OTEL Receiver Interface

Every OTEL receiver must implement these interfaces:

```go
// go.opentelemetry.io/collector/receiver
type Factory interface {
    CreateDefaultConfig() component.Config
    CreateTracesReceiver(ctx context.Context, set receiver.Settings, cfg component.Config, nextConsumer consumer.Traces) (receiver.Traces, error)
}

type Traces interface {
    component.Component // Start, Shutdown methods
}
```

### Step 2: Create BeTrace Receiver Module

**Directory structure:**
```
betrace-otel-receiver/
├── go.mod
├── go.sum
├── receiver/
│   ├── betracereceiver/
│   │   ├── factory.go        # Receiver factory
│   │   ├── config.go         # Configuration struct
│   │   ├── receiver.go       # Main receiver logic
│   │   ├── violations.go     # API client for /api/violations
│   │   └── transform.go      # Violation → OTEL span conversion
└── cmd/
    └── otelcol/
        └── main.go           # Custom collector binary
```

### Step 3: Implement Receiver Factory

**File: `receiver/betracereceiver/factory.go`**

```go
package betracereceiver

import (
    "context"
    "time"

    "go.opentelemetry.io/collector/component"
    "go.opentelemetry.io/collector/consumer"
    "go.opentelemetry.io/collector/receiver"
)

const (
    typeStr   = "betrace"
    stability = component.StabilityLevelBeta
)

// NewFactory creates a factory for BeTrace receiver
func NewFactory() receiver.Factory {
    return receiver.NewFactory(
        component.MustNewType(typeStr),
        createDefaultConfig,
        receiver.WithTraces(createTracesReceiver, stability),
    )
}

func createDefaultConfig() component.Config {
    return &Config{
        Endpoint:      "http://localhost:12011",
        PollInterval:  10 * time.Second,
        Timeout:       5 * time.Second,
    }
}

func createTracesReceiver(
    ctx context.Context,
    set receiver.Settings,
    cfg component.Config,
    nextConsumer consumer.Traces,
) (receiver.Traces, error) {
    rCfg := cfg.(*Config)
    return newTracesReceiver(rCfg, nextConsumer, set.Logger), nil
}
```

### Step 4: Define Configuration

**File: `receiver/betracereceiver/config.go`**

```go
package betracereceiver

import (
    "errors"
    "time"

    "go.opentelemetry.io/collector/component"
)

// Config defines configuration for BeTrace receiver
type Config struct {
    // Endpoint is the BeTrace backend URL
    Endpoint string `mapstructure:"endpoint"`

    // PollInterval is how often to query /api/violations
    PollInterval time.Duration `mapstructure:"poll_interval"`

    // Timeout for API requests
    Timeout time.Duration `mapstructure:"timeout"`

    // SeverityFilter filters violations by severity (empty = all)
    SeverityFilter string `mapstructure:"severity_filter"`

    // StartTime for initial query (RFC3339 format)
    StartTime string `mapstructure:"start_time"`
}

func (cfg *Config) Validate() error {
    if cfg.Endpoint == "" {
        return errors.New("endpoint is required")
    }
    if cfg.PollInterval <= 0 {
        return errors.New("poll_interval must be positive")
    }
    return nil
}
```

### Step 5: Implement Receiver Logic

**File: `receiver/betracereceiver/receiver.go`**

```go
package betracereceiver

import (
    "context"
    "time"

    "go.opentelemetry.io/collector/component"
    "go.opentelemetry.io/collector/consumer"
    "go.uber.org/zap"
)

type betraceReceiver struct {
    cfg          *Config
    consumer     consumer.Traces
    logger       *zap.Logger
    client       *ViolationsClient
    lastPollTime time.Time
    stopCh       chan struct{}
}

func newTracesReceiver(cfg *Config, consumer consumer.Traces, logger *zap.Logger) *betraceReceiver {
    return &betraceReceiver{
        cfg:      cfg,
        consumer: consumer,
        logger:   logger,
        client:   NewViolationsClient(cfg.Endpoint, cfg.Timeout),
        stopCh:   make(chan struct{}),
    }
}

func (r *betraceReceiver) Start(ctx context.Context, host component.Host) error {
    r.logger.Info("Starting BeTrace receiver", zap.String("endpoint", r.cfg.Endpoint))

    // Set initial poll time
    if r.cfg.StartTime != "" {
        t, err := time.Parse(time.RFC3339, r.cfg.StartTime)
        if err != nil {
            r.logger.Warn("Invalid start_time, using now", zap.Error(err))
            r.lastPollTime = time.Now()
        } else {
            r.lastPollTime = t
        }
    } else {
        r.lastPollTime = time.Now().Add(-1 * time.Hour) // Last hour by default
    }

    // Start polling goroutine
    go r.poll(ctx)

    return nil
}

func (r *betraceReceiver) Shutdown(ctx context.Context) error {
    r.logger.Info("Shutting down BeTrace receiver")
    close(r.stopCh)
    return nil
}

func (r *betraceReceiver) poll(ctx context.Context) {
    ticker := time.NewTicker(r.cfg.PollInterval)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            if err := r.fetchAndExport(ctx); err != nil {
                r.logger.Error("Failed to fetch violations", zap.Error(err))
            }
        case <-r.stopCh:
            return
        case <-ctx.Done():
            return
        }
    }
}

func (r *betraceReceiver) fetchAndExport(ctx context.Context) error {
    // Query violations since last poll
    violations, err := r.client.QueryViolations(ctx, r.lastPollTime, time.Now(), r.cfg.SeverityFilter)
    if err != nil {
        return err
    }

    if len(violations) == 0 {
        r.logger.Debug("No new violations")
        return nil
    }

    r.logger.Info("Fetched violations", zap.Int("count", len(violations)))

    // Convert to OTEL traces
    traces := ViolationsToTraces(violations)

    // Export to next consumer (ClickHouse exporter)
    if err := r.consumer.ConsumeTraces(ctx, traces); err != nil {
        return err
    }

    // Update last poll time
    r.lastPollTime = time.Now()

    return nil
}
```

### Step 6: Implement API Client

**File: `receiver/betracereceiver/violations.go`**

```go
package betracereceiver

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "time"
)

// Violation matches BeTrace backend model
type Violation struct {
    ID        string    `json:"id"`
    RuleID    string    `json:"ruleId"`
    RuleName  string    `json:"ruleName"`
    Severity  string    `json:"severity"`
    Message   string    `json:"message"`
    TraceIDs  []string  `json:"traceIds"`
    SpanRefs  []SpanRef `json:"spanReferences"`
    CreatedAt time.Time `json:"createdAt"`
    Signature string    `json:"signature"`
}

type SpanRef struct {
    TraceID     string `json:"traceId"`
    SpanID      string `json:"spanId"`
    ServiceName string `json:"serviceName"`
}

type ViolationsClient struct {
    endpoint string
    client   *http.Client
}

func NewViolationsClient(endpoint string, timeout time.Duration) *ViolationsClient {
    return &ViolationsClient{
        endpoint: endpoint,
        client:   &http.Client{Timeout: timeout},
    }
}

func (c *ViolationsClient) QueryViolations(ctx context.Context, from, to time.Time, severity string) ([]Violation, error) {
    // Build query params
    params := url.Values{}
    params.Add("from", fmt.Sprintf("%d", from.UnixMilli()))
    params.Add("to", fmt.Sprintf("%d", to.UnixMilli()))
    if severity != "" {
        params.Add("severity", severity)
    }

    // Make HTTP request
    reqURL := fmt.Sprintf("%s/api/violations?%s", c.endpoint, params.Encode())
    req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
    if err != nil {
        return nil, err
    }

    resp, err := c.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("API returned %d", resp.StatusCode)
    }

    var violations []Violation
    if err := json.NewDecoder(resp.Body).Decode(&violations); err != nil {
        return nil, err
    }

    return violations, nil
}
```

### Step 7: Transform Violations to OTEL Spans

**File: `receiver/betracereceiver/transform.go`**

```go
package betracereceiver

import (
    "go.opentelemetry.io/collector/pdata/pcommon"
    "go.opentelemetry.io/collector/pdata/ptrace"
)

func ViolationsToTraces(violations []Violation) ptrace.Traces {
    traces := ptrace.NewTraces()

    for _, v := range violations {
        // Create resource spans for each violation
        rs := traces.ResourceSpans().AppendEmpty()

        // Set resource attributes
        resource := rs.Resource()
        resource.Attributes().PutStr("service.name", "betrace")
        resource.Attributes().PutStr("betrace.version", "1.0.0")

        // Create scope spans
        ss := rs.ScopeSpans().AppendEmpty()
        ss.Scope().SetName("betrace-receiver")

        // Create span for violation
        span := ss.Spans().AppendEmpty()
        span.SetName("betrace.violation")
        span.SetKind(ptrace.SpanKindInternal)

        // Set trace/span IDs (use first TraceID from violation)
        if len(v.TraceIDs) > 0 {
            traceID := pcommon.TraceID{}
            copy(traceID[:], []byte(v.TraceIDs[0]))
            span.SetTraceID(traceID)
        }

        spanID := pcommon.SpanID{}
        copy(spanID[:], []byte(v.ID))
        span.SetSpanID(spanID)

        // Set timestamps
        span.SetStartTimestamp(pcommon.NewTimestampFromTime(v.CreatedAt))
        span.SetEndTimestamp(pcommon.NewTimestampFromTime(v.CreatedAt.Add(1 * time.Millisecond)))

        // Set attributes
        attrs := span.Attributes()
        attrs.PutStr("betrace.violation.id", v.ID)
        attrs.PutStr("betrace.violation.rule_id", v.RuleID)
        attrs.PutStr("betrace.violation.rule_name", v.RuleName)
        attrs.PutStr("betrace.violation.severity", v.Severity)
        attrs.PutStr("betrace.violation.message", v.Message)
        attrs.PutStr("betrace.violation.signature", v.Signature)

        // Add span references
        for i, ref := range v.SpanRefs {
            attrs.PutStr(fmt.Sprintf("betrace.span_ref.%d.trace_id", i), ref.TraceID)
            attrs.PutStr(fmt.Sprintf("betrace.span_ref.%d.span_id", i), ref.SpanID)
            attrs.PutStr(fmt.Sprintf("betrace.span_ref.%d.service", i), ref.ServiceName)
        }

        // Set span status based on severity
        if v.Severity == "HIGH" || v.Severity == "CRITICAL" {
            span.Status().SetCode(ptrace.StatusCodeError)
            span.Status().SetMessage(v.Message)
        } else {
            span.Status().SetCode(ptrace.StatusCodeOk)
        }
    }

    return traces
}
```

### Step 8: Build Custom Collector

**File: `cmd/otelcol/main.go`**

```go
package main

import (
    "log"

    "go.opentelemetry.io/collector/component"
    "go.opentelemetry.io/collector/otelcol"

    // Import SigNoz OTEL Collector components
    "github.com/SigNoz/signoz-otel-collector/exporter/clickhouseexporter"

    // Import your BeTrace receiver
    "github.com/betracehq/betrace-otel-receiver/receiver/betracereceiver"
)

func main() {
    factories, err := components()
    if err != nil {
        log.Fatalf("Failed to build components: %v", err)
    }

    info := component.BuildInfo{
        Command:     "betrace-otel-collector",
        Description: "SigNoz OTEL Collector with BeTrace receiver",
        Version:     "1.0.0",
    }

    app := otelcol.NewCommand(
        otelcol.CollectorSettings{
            BuildInfo:  info,
            Factories:  factories,
        },
    )

    if err := app.Execute(); err != nil {
        log.Fatal(err)
    }
}

func components() (otelcol.Factories, error) {
    var err error
    factories := otelcol.Factories{}

    // Receivers
    factories.Receivers, err = component.MakeReceiverFactoryMap(
        betracereceiver.NewFactory(), // Your custom receiver
    )
    if err != nil {
        return otelcol.Factories{}, err
    }

    // Exporters
    factories.Exporters, err = component.MakeExporterFactoryMap(
        clickhouseexporter.NewFactory(), // SigNoz ClickHouse exporter
    )
    if err != nil {
        return otelcol.Factories{}, err
    }

    return factories, nil
}
```

### Step 9: OTEL Collector Configuration

**File: `config.yaml`**

```yaml
receivers:
  betrace:
    endpoint: "http://betrace-backend:12011"
    poll_interval: 10s
    timeout: 5s
    severity_filter: ""  # Empty = all severities
    # start_time: "2025-01-23T00:00:00Z"  # Optional: start from specific time

processors:
  batch:
    timeout: 10s
    send_batch_size: 100

  filter/severity:
    # Optional: filter out LOW severity violations
    traces:
      span:
        - 'attributes["betrace.violation.severity"] == "LOW"'

  attributes:
    # Enrich spans with additional metadata
    actions:
      - key: deployment.environment
        value: production
        action: insert

exporters:
  clickhouse:
    endpoint: "tcp://signoz-clickhouse:9000"
    database: signoz_traces
    username: default
    password: ""
    traces_table_name: signoz_traces

service:
  pipelines:
    traces:
      receivers: [betrace]
      processors: [batch, attributes]
      exporters: [clickhouse]

  telemetry:
    logs:
      level: info
```

### Step 10: Build and Deploy

```bash
# Initialize Go module
cd betrace-otel-receiver
go mod init github.com/betracehq/betrace-otel-receiver

# Install dependencies
go get go.opentelemetry.io/collector@latest
go get github.com/SigNoz/signoz-otel-collector@latest

# Build collector binary
go build -o betrace-otel-collector ./cmd/otelcol

# Run collector
./betrace-otel-collector --config=config.yaml
```

---

## Option B: Standalone UI + SigNoz Backend

### Step 1: Extract Storybook Components as Standalone App

**Use Vite to build standalone React app:**

```bash
cd grafana-betrace-app
npm install

# Create standalone build config
cat > vite.config.standalone.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-standalone',
    rollupOptions: {
      input: {
        main: './src/standalone.tsx',
      },
    },
  },
  server: {
    port: 3000,
  },
});
EOF

# Create standalone entry point
cat > src/standalone.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MonacoRuleEditor } from './components/MonacoRuleEditor';
import { RuleList } from './components/RuleList';

const App = () => {
  const [selectedRule, setSelectedRule] = React.useState(null);
  const [rules, setRules] = React.useState([]);

  return (
    <div>
      <h1>BeTrace Rule Management</h1>
      <RuleList rules={rules} onSelect={setSelectedRule} />
      {selectedRule && (
        <MonacoRuleEditor
          rule={selectedRule}
          onSave={() => setSelectedRule(null)}
          onCancel={() => setSelectedRule(null)}
        />
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
EOF

# Build standalone app
npm run build -- --config vite.config.standalone.ts
```

### Step 2: Configure BeTrace Backend for OTLP Export

**Update BeTrace backend to export violations as OTLP:**

```go
// backend/pkg/otel/exporter.go
package otel

import (
    "context"
    "time"

    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
)

func InitOTLPExporter(endpoint string) (*sdktrace.TracerProvider, error) {
    ctx := context.Background()

    // Create OTLP exporter
    exporter, err := otlptracegrpc.New(ctx,
        otlptracegrpc.WithEndpoint(endpoint),
        otlptracegrpc.WithInsecure(),
    )
    if err != nil {
        return nil, err
    }

    // Create resource
    res, err := resource.New(ctx,
        resource.WithAttributes(
            semconv.ServiceNameKey.String("betrace"),
            semconv.ServiceVersionKey.String("1.0.0"),
        ),
    )
    if err != nil {
        return nil, err
    }

    // Create tracer provider
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter,
            sdktrace.WithMaxQueueSize(1000),
            sdktrace.WithBatchTimeout(5*time.Second),
        ),
        sdktrace.WithResource(res),
    )

    return tp, nil
}
```

**Environment variable:**
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=signoz-otel-collector:4317
```

### Step 3: Deploy with Docker Compose

**File: `docker-compose.yml`**

```yaml
version: '3.8'

services:
  betrace-backend:
    image: betrace/backend:latest
    ports:
      - "12011:12011"
    environment:
      - OTEL_EXPORTER_OTLP_ENDPOINT=signoz-otel-collector:4317
    depends_on:
      - signoz-otel-collector

  betrace-ui:
    image: betrace/ui-standalone:latest
    ports:
      - "3000:3000"
    environment:
      - BETRACE_BACKEND_URL=http://betrace-backend:12011

  signoz-otel-collector:
    image: signoz/signoz-otel-collector:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"  # OTLP gRPC
      - "4318:4318"  # OTLP HTTP
    depends_on:
      - signoz-clickhouse

  signoz-clickhouse:
    image: clickhouse/clickhouse-server:latest
    ports:
      - "9000:9000"
    volumes:
      - signoz-data:/var/lib/clickhouse

  signoz-query-service:
    image: signoz/query-service:latest
    ports:
      - "8080:8080"
    depends_on:
      - signoz-clickhouse

  signoz-frontend:
    image: signoz/frontend:latest
    ports:
      - "3301:3301"
    depends_on:
      - signoz-query-service

volumes:
  signoz-data:
```

**File: `otel-collector-config.yaml`**

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "0.0.0.0:4317"
      http:
        endpoint: "0.0.0.0:4318"

processors:
  batch:
    timeout: 10s
    send_batch_size: 100

exporters:
  clickhouse:
    endpoint: "tcp://signoz-clickhouse:9000"
    database: signoz_traces
    traces_table_name: signoz_traces

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [clickhouse]
```

### Step 4: Start Services

```bash
docker-compose up -d

# Check logs
docker-compose logs -f betrace-backend
docker-compose logs -f signoz-otel-collector

# Access UIs
# BeTrace UI: http://localhost:3000
# SigNoz UI:  http://localhost:3301
```

---

## Data Model Mapping

### Violation → OTEL Span Attributes

| BeTrace Field | OTEL Span Attribute | Type | Example |
|---------------|---------------------|------|---------|
| `ID` | `betrace.violation.id` | string | `"viol-abc123"` |
| `RuleID` | `betrace.violation.rule_id` | string | `"rule-001"` |
| `RuleName` | `betrace.violation.rule_name` | string | `"missing_audit_log"` |
| `Severity` | `betrace.violation.severity` | string | `"HIGH"` |
| `Message` | `betrace.violation.message` | string | `"PII access without audit"` |
| `TraceIDs[0]` | `trace.id` | trace_id | `"abc123..."` |
| `SpanRefs` | `betrace.span_ref.N.*` | array | See below |
| `CreatedAt` | `span.start_time` | timestamp | `1706000000000000000` |
| `Signature` | `betrace.violation.signature` | string | `"hmac-sha256..."` |

### SpanRef Attributes

```
betrace.span_ref.0.trace_id = "trace-abc"
betrace.span_ref.0.span_id = "span-123"
betrace.span_ref.0.service = "payment-api"
betrace.span_ref.1.trace_id = "trace-abc"
betrace.span_ref.1.span_id = "span-456"
betrace.span_ref.1.service = "auth-service"
```

---

## Querying Violations in SigNoz

### Query Builder (UI)

1. Navigate to **Traces** tab in SigNoz UI
2. Add filter: `serviceName = betrace`
3. Add filter: `name = betrace.violation`
4. Group by: `betrace.violation.severity`

### SQL Queries (ClickHouse)

**Query all violations:**
```sql
SELECT
    timestamp,
    traceID,
    spanID,
    attributes['betrace.violation.rule_name'] AS rule_name,
    attributes['betrace.violation.severity'] AS severity,
    attributes['betrace.violation.message'] AS message
FROM signoz_traces.signoz_index_v2
WHERE serviceName = 'betrace'
  AND name = 'betrace.violation'
ORDER BY timestamp DESC
LIMIT 100;
```

**Query high-severity violations:**
```sql
SELECT
    timestamp,
    attributes['betrace.violation.rule_name'] AS rule_name,
    attributes['betrace.violation.message'] AS message,
    count() AS violation_count
FROM signoz_traces.signoz_index_v2
WHERE serviceName = 'betrace'
  AND attributes['betrace.violation.severity'] = 'HIGH'
  AND timestamp > now() - INTERVAL 1 HOUR
GROUP BY rule_name, message
ORDER BY violation_count DESC;
```

---

## Dashboard Examples

### Violations Over Time

**Query:**
```sql
SELECT
    toStartOfInterval(timestamp, INTERVAL 5 MINUTE) AS time_bucket,
    attributes['betrace.violation.severity'] AS severity,
    count() AS count
FROM signoz_traces.signoz_index_v2
WHERE serviceName = 'betrace'
  AND timestamp > now() - INTERVAL 24 HOUR
GROUP BY time_bucket, severity
ORDER BY time_bucket;
```

**Visualization:** Time series chart (line or bar)

### Top Violated Rules

**Query:**
```sql
SELECT
    attributes['betrace.violation.rule_name'] AS rule_name,
    count() AS violation_count
FROM signoz_traces.signoz_index_v2
WHERE serviceName = 'betrace'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY rule_name
ORDER BY violation_count DESC
LIMIT 10;
```

**Visualization:** Table or bar chart

---

## Alerting in SigNoz

### Create Alert Rule

1. Navigate to **Alerts** in SigNoz UI
2. Click **New Alert**
3. Configure:
   - **Metric**: `count(signoz_traces.signoz_index_v2)`
   - **Filter**: `serviceName = betrace AND attributes['betrace.violation.severity'] = 'HIGH'`
   - **Threshold**: `> 5` violations in 5 minutes
   - **Notification**: Slack, PagerDuty, Email

**Alert Query:**
```sql
SELECT count()
FROM signoz_traces.signoz_index_v2
WHERE serviceName = 'betrace'
  AND attributes['betrace.violation.severity'] = 'HIGH'
  AND timestamp > now() - INTERVAL 5 MINUTE
HAVING count() > 5;
```

---

## Testing & Validation

### Test Plan

#### 1. Unit Tests (Receiver)

```go
// receiver/betracereceiver/transform_test.go
func TestViolationsToTraces(t *testing.T) {
    violations := []Violation{
        {
            ID: "viol-001",
            RuleID: "rule-001",
            RuleName: "test_rule",
            Severity: "HIGH",
            Message: "Test violation",
            TraceIDs: []string{"trace-123"},
            CreatedAt: time.Now(),
        },
    }

    traces := ViolationsToTraces(violations)
    require.Equal(t, 1, traces.ResourceSpans().Len())

    span := traces.ResourceSpans().At(0).ScopeSpans().At(0).Spans().At(0)
    require.Equal(t, "betrace.violation", span.Name())

    attrs := span.Attributes()
    val, ok := attrs.Get("betrace.violation.rule_name")
    require.True(t, ok)
    require.Equal(t, "test_rule", val.Str())
}
```

#### 2. Integration Test

```bash
# 1. Start BeTrace backend
nix run .#backend

# 2. Create test rule
curl -X POST http://localhost:12011/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_rule",
    "expression": "trace.has(span.status == \"error\")",
    "severity": "HIGH",
    "enabled": true
  }'

# 3. Trigger violation (send trace with error span)
# ... use OTEL SDK to emit test trace

# 4. Query SigNoz for violation
# Should appear in SigNoz UI within poll_interval (10s)
```

#### 3. Performance Test

```bash
# Load test: 1000 violations/minute
for i in {1..1000}; do
  # Emit violation via BeTrace backend
  curl -X POST http://localhost:12011/internal/test/emit-violation
  sleep 0.06  # ~1000/min
done

# Monitor OTEL Collector metrics
curl http://localhost:8888/metrics | grep betrace
```

---

## Deployment Checklist

- [ ] Build custom OTEL Collector with BeTrace receiver
- [ ] Deploy SigNoz cluster (ClickHouse + Query Service + Frontend)
- [ ] Configure OTEL Collector with `betrace` receiver
- [ ] Deploy BeTrace backend with OTLP exporter endpoint
- [ ] (Optional) Deploy standalone BeTrace UI
- [ ] Create SigNoz dashboards for violations
- [ ] Set up alerts for critical violations
- [ ] Test end-to-end flow (rule creation → violation → SigNoz UI)
- [ ] Configure data retention policies in ClickHouse
- [ ] Set up backup/restore for rules and violations

---

## Troubleshooting

### Receiver Not Fetching Violations

**Check:**
```bash
# 1. Verify BeTrace backend is reachable
curl http://betrace-backend:12011/api/violations

# 2. Check OTEL Collector logs
docker logs signoz-otel-collector | grep betrace

# 3. Verify receiver config
cat config.yaml | grep -A 10 "receivers:"
```

### Violations Not Appearing in SigNoz

**Check:**
```bash
# 1. Query ClickHouse directly
docker exec -it signoz-clickhouse clickhouse-client
SELECT count() FROM signoz_traces.signoz_index_v2 WHERE serviceName = 'betrace';

# 2. Check OTEL Collector metrics
curl http://localhost:8888/metrics | grep "receiver_accepted_spans"

# 3. Verify exporter config
cat config.yaml | grep -A 10 "exporters:"
```

### High Memory Usage (OTEL Collector)

**Fix:**
```yaml
# Reduce batch size
processors:
  batch:
    send_batch_size: 50  # Lower from 100
    timeout: 5s          # Flush more frequently
```

---

## Migration from Grafana

### Export Rules from Grafana

```bash
# Export all rules
curl http://localhost:12011/api/rules > rules-backup.json

# No changes needed - rules API is platform-agnostic
```

### Reconfigure OTEL Export

**Before (Grafana/Tempo):**
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=tempo:4317
```

**After (SigNoz):**
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=signoz-otel-collector:4317
```

### Dual-Exporter Strategy (Zero Downtime)

```yaml
# OTEL Collector config - export to both platforms
exporters:
  clickhouse:  # SigNoz
    endpoint: "tcp://signoz-clickhouse:9000"
  otlp/tempo:  # Grafana Tempo
    endpoint: "tempo:4317"

service:
  pipelines:
    traces:
      receivers: [betrace]
      processors: [batch]
      exporters: [clickhouse, otlp/tempo]  # Dual export
```

**Gradual cutover:**
1. Week 1: Dual export, validate SigNoz data
2. Week 2: Primary SigNoz, Grafana as backup
3. Week 3: SigNoz only, decommission Grafana

---

## Performance Considerations

### Expected Throughput

| Metric | Value |
|--------|-------|
| **Violations/second** | 100-500 |
| **OTEL Collector CPU** | 0.5-1 core |
| **OTEL Collector Memory** | 256-512 MB |
| **ClickHouse Ingestion** | 10K spans/sec |
| **Poll Latency** | 10s (configurable) |

### Tuning

**High-volume environments (>500 violations/sec):**
```yaml
receivers:
  betrace:
    poll_interval: 5s  # Poll more frequently

processors:
  batch:
    send_batch_size: 500  # Larger batches
    timeout: 3s           # Lower latency
```

**Resource-constrained environments:**
```yaml
receivers:
  betrace:
    poll_interval: 30s  # Poll less frequently

processors:
  batch:
    send_batch_size: 50  # Smaller batches
    timeout: 10s         # Higher latency, lower CPU
```

---

## Cost Comparison

### Grafana Stack vs. SigNoz

| Component | Grafana Cloud | SigNoz (Self-Hosted) |
|-----------|---------------|----------------------|
| **Traces (10M spans/month)** | $50-200/month | $0 (storage only) |
| **Logs** | $50-150/month | $0 (storage only) |
| **Metrics** | $50-100/month | $0 (storage only) |
| **Infrastructure** | $0 (managed) | $50-100/month (VMs) |
| **Total** | **$150-450/month** | **$50-100/month** |

**Savings:** 60-80% with self-hosted SigNoz

---

## References

- **SigNoz Documentation**: https://signoz.io/docs/
- **SigNoz OTEL Collector**: https://github.com/SigNoz/signoz-otel-collector
- **OTEL Receiver Development**: https://opentelemetry.io/docs/collector/building/receiver/
- **ClickHouse Docs**: https://clickhouse.com/docs/
- **BeTrace ADRs**:
  - [ADR-022: Grafana-First Architecture](../adrs/022-grafana-first-architecture.md)
  - [ADR-026: BeTrace Core Competencies](../adrs/026-betrace-core-competencies.md)

---

## Support

- **GitHub Issues**: [betracehq/betrace/issues](https://github.com/betracehq/betrace/issues)
- **SigNoz Community**: [signoz.io/slack](https://signoz.io/slack)
- **OTEL Community**: [cloud-native.slack.com](https://cloud-native.slack.com)
