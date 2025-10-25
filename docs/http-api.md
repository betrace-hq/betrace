# BeTrace HTTP API

## Overview

The BeTrace backend exposes a RESTful HTTP API for rule management, span evaluation, and compliance evidence querying.

**Base URL:** `http://localhost:12011` (configurable via `BETRACE_PORT_BACKEND`)

**OpenAPI Spec:** [backend/api/openapi.yaml](../backend/api/openapi.yaml)

## Quick Start

### Start the Backend

Via Flox:
```bash
flox services start backend
```

Or directly:
```bash
cd backend
go run ./cmd/betrace-backend
# Or: PORT=8080 go run ./cmd/betrace-backend
```

### Health Check

```bash
curl http://localhost:12011/health
```

Response:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 3600
}
```

## Endpoints

### Health & Metrics

#### `GET /health`

Returns backend health status.

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 3600
}
```

#### `GET /metrics`

Prometheus metrics endpoint. Returns 30+ BeTrace-specific metrics:

- `betrace_rule_evaluation_duration_seconds` - Rule evaluation latency
- `betrace_rule_engine_spans_processed_total` - Total spans processed
- `betrace_compliance_spans_emitted_total` - Compliance evidence generated
- `betrace_soc2_access_control_checks_total` - SOC2 CC6.1 checks
- And 26 more...

**Example:**
```bash
curl http://localhost:12011/metrics | grep betrace_
```

### Rule Management

#### `GET /api/v1/rules`

List all rules.

**Response:**
```json
{
  "rules": [
    {
      "id": "detect-errors",
      "name": "Detect Error Spans",
      "expression": "span.status == \"ERROR\"",
      "enabled": true,
      "description": "Detects spans with ERROR status",
      "tags": ["errors", "monitoring"]
    }
  ],
  "total": 1
}
```

#### `POST /api/v1/rules`

Create a new rule.

**Request:**
```json
{
  "id": "slow-queries",
  "name": "Slow Database Queries",
  "expression": "span.name.contains(\"db\") and span.duration_ms > 1000",
  "enabled": true,
  "description": "Detects database queries over 1 second",
  "tags": ["performance", "database"]
}
```

**Response:** `201 Created`
```json
{
  "id": "slow-queries",
  "name": "Slow Database Queries",
  "expression": "...",
  "enabled": true
}
```

**Emits:** SOC2 CC8.1 compliance span (Change Management)

#### `GET /api/v1/rules/{ruleId}`

Get a specific rule.

**Example:**
```bash
curl http://localhost:12011/api/v1/rules/detect-errors
```

#### `PUT /api/v1/rules/{ruleId}`

Update an existing rule.

**Request:**
```json
{
  "expression": "span.status == \"ERROR\" and span.service == \"api\"",
  "enabled": true
}
```

**Emits:** SOC2 CC8.1 compliance span (Change Management)

#### `DELETE /api/v1/rules/{ruleId}`

Delete a rule.

**Response:** `204 No Content`

**Emits:** SOC2 CC8.1 compliance span (Change Management)

#### `POST /api/v1/rules/{ruleId}/enable`

Enable a rule.

**Response:**
```json
{
  "id": "detect-errors",
  "enabled": true
}
```

#### `POST /api/v1/rules/{ruleId}/disable`

Disable a rule.

**Response:**
```json
{
  "id": "detect-errors",
  "enabled": false
}
```

### Span Evaluation

#### `POST /api/v1/evaluate`

Evaluate a single span against all enabled rules.

**Request:**
```json
{
  "spanId": "abc123",
  "traceId": "trace-456",
  "serviceName": "api-gateway",
  "operationName": "POST /users",
  "duration": 2500000000,
  "status": "ERROR",
  "attributes": {
    "http.method": "POST",
    "http.status_code": "500",
    "error.message": "Database connection timeout"
  }
}
```

**Response:**
```json
{
  "spanId": "abc123",
  "matches": ["detect-errors", "slow-requests"],
  "evaluatedAt": "2025-10-24T10:30:00Z",
  "duration": 1.234
}
```

#### `POST /api/v1/evaluate/batch`

Evaluate multiple spans in a single request.

**Request:**
```json
{
  "spans": [
    { "spanId": "span-1", "traceId": "trace-1", ... },
    { "spanId": "span-2", "traceId": "trace-1", ... }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "spanId": "span-1",
      "matches": ["rule-1"],
      "evaluatedAt": "2025-10-24T10:30:00Z",
      "duration": 0.5
    },
    {
      "spanId": "span-2",
      "matches": [],
      "evaluatedAt": "2025-10-24T10:30:01Z",
      "duration": 0.3
    }
  ]
}
```

### Compliance Evidence

#### `GET /api/v1/compliance/evidence`

Query compliance evidence spans.

**Status:** Not yet implemented - use Tempo/Grafana for now.

**Planned Query Parameters:**
- `framework` - Filter by framework (soc2, hipaa, gdpr, fedramp)
- `control` - Filter by control (CC6.1, 164.312(b), etc.)
- `since` - RFC3339 timestamp
- `until` - RFC3339 timestamp

**Workaround:** Query Tempo directly via TraceQL:
```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"}
```

#### `POST /api/v1/compliance/export`

Export compliance evidence for auditors.

**Status:** Not yet implemented - use Grafana export or Tempo API.

**Planned Response:**
```json
{
  "framework": "soc2",
  "controls": ["CC6.1", "CC6.3", "CC7.1", "CC7.2", "CC8.1"],
  "period": { "start": "2024-01-01T00:00:00Z", "end": "2024-12-31T23:59:59Z" },
  "evidence": [ ... ],
  "signature": "HMAC-SHA256...",
  "exportedAt": "2025-10-24T10:30:00Z"
}
```

## Observability

### OpenTelemetry Tracing

All API requests emit OpenTelemetry spans with:

- **Span Name:** `{HTTP_METHOD} {PATH}`
- **Attributes:**
  - `http.method` - Request method
  - `http.url` - Request path
  - `http.status_code` - Response status
  - `http.user_agent` - Client user agent
  - `http.response_time_ms` - Request duration

**View traces in Grafana:**
```traceql
{service.name = "betrace-backend"}
```

### Prometheus Metrics

The `/metrics` endpoint exposes 30+ metrics:

**Performance Metrics:**
- `betrace_rule_evaluation_duration_seconds{rule_id, result}` - Histogram
- `betrace_rule_engine_spans_processed_total` - Counter
- `betrace_rule_engine_active_rules{enabled}` - Gauge

**Compliance Metrics:**
- `betrace_compliance_spans_emitted_total{framework, control, outcome}` - Counter
- `betrace_soc2_access_control_checks_total{outcome}` - Counter
- `betrace_hipaa_access_log_entries_total{outcome}` - Counter
- `betrace_gdpr_data_access_requests_total{outcome}` - Counter

**See:** [backend/internal/observability/metrics.go](../backend/internal/observability/metrics.go) for full list.

## Error Handling

All errors return JSON:

```json
{
  "error": "Rule not found: unknown-rule",
  "code": "Not Found"
}
```

**Common Status Codes:**
- `200 OK` - Success
- `201 Created` - Rule created
- `204 No Content` - Rule deleted
- `400 Bad Request` - Invalid input
- `404 Not Found` - Rule not found
- `500 Internal Server Error` - Server error
- `501 Not Implemented` - Feature not yet implemented

## Integration Examples

### JavaScript (Fetch API)

```javascript
// Create a rule
const createRule = async () => {
  const response = await fetch('http://localhost:12011/api/v1/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'http-500',
      name: 'HTTP 500 Errors',
      expression: 'span.attributes["http.status_code"] == "500"',
      enabled: true
    })
  });

  return await response.json();
};

// Evaluate a span
const evaluateSpan = async (span) => {
  const response = await fetch('http://localhost:12011/api/v1/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(span)
  });

  return await response.json();
};
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
)

type Rule struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Expression  string `json:"expression"`
    Enabled     bool   `json:"enabled"`
}

func createRule() error {
    rule := Rule{
        ID:         "http-500",
        Name:       "HTTP 500 Errors",
        Expression: `span.attributes["http.status_code"] == "500"`,
        Enabled:    true,
    }

    data, _ := json.Marshal(rule)
    resp, err := http.Post(
        "http://localhost:12011/api/v1/rules",
        "application/json",
        bytes.NewBuffer(data),
    )
    defer resp.Body.Close()

    return err
}
```

### cURL

```bash
# Create rule
curl -X POST http://localhost:12011/api/v1/rules \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "http-500",
    "name": "HTTP 500 Errors",
    "expression": "span.attributes[\"http.status_code\"] == \"500\"",
    "enabled": true
  }'

# List rules
curl http://localhost:12011/api/v1/rules

# Evaluate span
curl -X POST http://localhost:12011/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{
    "spanId": "abc123",
    "traceId": "trace-456",
    "serviceName": "api",
    "operationName": "POST /users",
    "duration": 1500000000,
    "status": "ERROR",
    "attributes": {
      "http.status_code": "500"
    }
  }'
```

## Configuration

**Environment Variables:**

- `PORT` - HTTP server port (default: `12011`)
- `BETRACE_PORT_BACKEND` - Alternative port variable
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OpenTelemetry collector endpoint (default: `localhost:4317`)

**Example:**
```bash
PORT=8080 OTEL_EXPORTER_OTLP_ENDPOINT=tempo:4317 ./betrace-backend
```

## Security

### CORS

The API allows CORS from all origins (`Access-Control-Allow-Origin: *`).

**Production:** Restrict to specific origins by modifying [server.go:62](../backend/internal/api/server.go#L62).

### Authentication

**Not yet implemented.** Plan to add:
- JWT-based authentication
- API key support
- WorkOS integration (see `backend/src/main/java/com/betrace/security/`)

### Rate Limiting

**Not yet implemented.** Consider adding middleware for production deployments.

## Testing

### Unit Tests

```bash
cd backend
go test ./internal/api/...
```

### Integration Tests

```bash
# Start backend
flox services start backend

# Test endpoints
curl http://localhost:12011/health
curl http://localhost:12011/metrics | grep betrace_
```

### Load Testing

```bash
# Example: wrk
wrk -t4 -c100 -d30s --latency http://localhost:12011/health
```

## References

- **OpenAPI Spec:** [backend/api/openapi.yaml](../backend/api/openapi.yaml)
- **Server Implementation:** [backend/internal/api/server.go](../backend/internal/api/server.go)
- **Observability:** [backend/internal/observability/](../backend/internal/observability/)
- **Grafana Integration Tests:** [docs/grafana-integration-tests.md](./grafana-integration-tests.md)
