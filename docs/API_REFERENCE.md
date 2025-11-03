# BeTrace API Reference

**Version**: 2.0.0
**Base URL**: `http://localhost:12011`
**OpenAPI Spec**: `http://localhost:12011/docs`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rules API](#rules-api)
3. [Spans API](#spans-api)
4. [Violations API](#violations-api)
5. [Health API](#health-api)
6. [Error Codes](#error-codes)
7. [Rate Limiting](#rate-limiting)
8. [Versioning](#versioning)

---

## Authentication

BeTrace API supports two authentication methods:

### Option 1: API Key (Header)

```bash
curl -H "X-API-Key: your-api-key-here" \
  http://localhost:12011/v1/rules
```

### Option 2: Bearer Token (OAuth2)

```bash
curl -H "Authorization: Bearer your-jwt-token" \
  http://localhost:12011/v1/rules
```

### Option 3: None (Default)

If no authentication is configured, API is open (not recommended for production).

---

## Rules API

Rules define behavioral patterns to match against traces.

### Create Rule

**Endpoint**: `POST /v1/rules`

**Request Body**:
```json
{
  "name": "string",              // Required: Rule identifier (alphanumeric, dashes, underscores)
  "description": "string",       // Optional: Human-readable description
  "expression": "string",        // Required: BeTraceDSL expression
  "enabled": boolean,            // Required: Enable rule immediately
  "severity": "string",          // Required: CRITICAL, HIGH, MEDIUM, LOW
  "tags": ["string"]             // Optional: Tags for organization
}
```

**Response**: `201 Created`
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "expression": "string",
  "enabled": boolean,
  "severity": "string",
  "tags": ["string"],
  "created_at": "2025-01-31T10:00:00Z",
  "updated_at": "2025-01-31T10:00:00Z"
}
```

**Errors**:
- `400 Bad Request`: Invalid DSL syntax or missing required fields
- `409 Conflict`: Rule with same name already exists
- `429 Too Many Requests`: Rate limit exceeded

**Example**:
```bash
curl -X POST http://localhost:12011/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pii-access-without-audit",
    "description": "Detects PII access without corresponding audit log",
    "expression": "trace.has(span.attributes[\"pii.accessed\"] == true) and not trace.has(span.name == \"audit.log\")",
    "enabled": true,
    "severity": "CRITICAL",
    "tags": ["compliance", "pii", "soc2"]
  }'
```

---

### List Rules

**Endpoint**: `GET /v1/rules`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `enabled_only` | boolean | Filter to enabled rules only |
| `severity` | string | Filter by severity (CRITICAL, HIGH, MEDIUM, LOW) |
| `tags` | string[] | Filter by tags (multiple allowed) |
| `limit` | integer | Max results (default: 100, max: 1000) |
| `offset` | integer | Pagination offset (default: 0) |

**Response**: `200 OK`
```json
{
  "rules": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "expression": "string",
      "enabled": boolean,
      "severity": "string",
      "tags": ["string"],
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ],
  "total_count": integer,
  "limit": integer,
  "offset": integer
}
```

**Example**:
```bash
# Get all enabled HIGH severity rules tagged with "performance"
curl "http://localhost:12011/v1/rules?enabled_only=true&severity=HIGH&tags=performance"
```

---

### Get Rule

**Endpoint**: `GET /v1/rules/{ruleId}`

**Path Parameters**:
- `ruleId` (string): Rule identifier

**Response**: `200 OK`
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "expression": "string",
  "enabled": boolean,
  "severity": "string",
  "tags": ["string"],
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "statistics": {
    "total_evaluations": integer,
    "total_violations": integer,
    "avg_evaluation_time_ms": float,
    "last_violation_at": "timestamp"
  }
}
```

**Errors**:
- `404 Not Found`: Rule does not exist

**Example**:
```bash
curl http://localhost:12011/v1/rules/pii-access-without-audit
```

---

### Update Rule

**Endpoint**: `PUT /v1/rules/{ruleId}`

**Path Parameters**:
- `ruleId` (string): Rule identifier

**Request Body**:
```json
{
  "name": "string",              // Required
  "description": "string",       // Optional
  "expression": "string",        // Required
  "enabled": boolean,            // Required
  "severity": "string",          // Required
  "tags": ["string"]             // Optional
}
```

**Response**: `200 OK`
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "expression": "string",
  "enabled": boolean,
  "severity": "string",
  "tags": ["string"],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**Errors**:
- `400 Bad Request`: Invalid DSL syntax
- `404 Not Found`: Rule does not exist

**Example**:
```bash
curl -X PUT http://localhost:12011/v1/rules/slow-requests \
  -H "Content-Type: application/json" \
  -d '{
    "name": "slow-requests",
    "expression": "span.duration > 2s",
    "enabled": true,
    "severity": "MEDIUM",
    "tags": ["performance"]
  }'
```

---

### Delete Rule

**Endpoint**: `DELETE /v1/rules/{ruleId}`

**Path Parameters**:
- `ruleId` (string): Rule identifier

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Rule deleted successfully"
}
```

**Errors**:
- `404 Not Found`: Rule does not exist

**Example**:
```bash
curl -X DELETE http://localhost:12011/v1/rules/old-rule
```

---

### Enable Rule

**Endpoint**: `POST /v1/rules/{ruleId}/enable`

**Path Parameters**:
- `ruleId` (string): Rule identifier

**Response**: `200 OK`
```json
{
  "id": "string",
  "name": "string",
  "enabled": true,
  "updated_at": "timestamp"
}
```

**Example**:
```bash
curl -X POST http://localhost:12011/v1/rules/slow-requests/enable
```

---

### Disable Rule

**Endpoint**: `POST /v1/rules/{ruleId}/disable`

**Path Parameters**:
- `ruleId` (string): Rule identifier

**Response**: `200 OK`
```json
{
  "id": "string",
  "name": "string",
  "enabled": false,
  "updated_at": "timestamp"
}
```

**Example**:
```bash
curl -X POST http://localhost:12011/v1/rules/noisy-rule/disable
```

---

## Spans API

The Spans API allows direct ingestion of OTLP spans for rule evaluation.

### Ingest Spans

**Endpoint**: `POST /v1/spans`

**Request Body**:
```json
{
  "spans": [
    {
      "trace_id": "string",
      "span_id": "string",
      "parent_span_id": "string",      // Optional
      "name": "string",
      "kind": "string",                // CLIENT, SERVER, INTERNAL, PRODUCER, CONSUMER
      "start_time": integer,           // Unix nanoseconds
      "end_time": integer,             // Unix nanoseconds
      "status": "string",              // OK, ERROR, UNSET
      "attributes": {
        "key": "value"
      }
    }
  ]
}
```

**Response**: `202 Accepted`
```json
{
  "accepted": integer,
  "rejected": integer,
  "violations_detected": integer
}
```

**Errors**:
- `400 Bad Request`: Invalid span format
- `413 Payload Too Large`: Batch size exceeds limit (max: 1000 spans)

**Example**:
```bash
curl -X POST http://localhost:12011/v1/spans \
  -H "Content-Type: application/json" \
  -d '{
    "spans": [{
      "trace_id": "abc123",
      "span_id": "span001",
      "name": "api.request",
      "kind": "SERVER",
      "start_time": 1699000000000000000,
      "end_time": 1699000002000000000,
      "status": "OK",
      "attributes": {
        "http.method": "POST",
        "http.route": "/api/users"
      }
    }]
  }'
```

---

## Violations API

Query violations detected by rules.

### List Violations

**Endpoint**: `GET /v1/violations`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `rule_id` | string | Filter by rule ID |
| `severity` | string | Filter by severity (CRITICAL, HIGH, MEDIUM, LOW) |
| `trace_id` | string | Filter by trace ID |
| `start_time` | integer | Unix timestamp (seconds) - start of time range |
| `end_time` | integer | Unix timestamp (seconds) - end of time range |
| `limit` | integer | Max results (default: 100, max: 1000) |
| `offset` | integer | Pagination offset (default: 0) |

**Response**: `200 OK`
```json
{
  "violations": [
    {
      "id": "string",
      "rule_id": "string",
      "rule_name": "string",
      "severity": "string",
      "trace_id": "string",
      "span_id": "string",
      "timestamp": integer,
      "message": "string",
      "metadata": {
        "span_name": "string",
        "duration_ms": integer,
        "service": "string"
      },
      "signature": "string"          // HMAC-SHA256 for compliance
    }
  ],
  "total": integer,
  "limit": integer,
  "offset": integer
}
```

**Example**:
```bash
# Get last hour of CRITICAL violations
START=$(date -u -d '1 hour ago' +%s)
curl "http://localhost:12011/v1/violations?severity=CRITICAL&start_time=$START"

# Get violations for specific trace
curl "http://localhost:12011/v1/violations?trace_id=abc123"

# Get violations for specific rule
curl "http://localhost:12011/v1/violations?rule_id=pii-access-without-audit"
```

---

### Get Violation

**Endpoint**: `GET /v1/violations/{violationId}`

**Path Parameters**:
- `violationId` (string): Violation identifier

**Response**: `200 OK`
```json
{
  "id": "string",
  "rule_id": "string",
  "rule_name": "string",
  "severity": "string",
  "trace_id": "string",
  "span_id": "string",
  "timestamp": integer,
  "message": "string",
  "metadata": {
    "span_name": "string",
    "duration_ms": integer,
    "service": "string",
    "full_trace": {
      "spans": []
    }
  },
  "signature": "string",
  "verified": boolean               // Signature verification result
}
```

**Example**:
```bash
curl http://localhost:12011/v1/violations/viol-abc123
```

---

## Health API

Health and readiness endpoints for monitoring.

### Health Check

**Endpoint**: `GET /health`

**Response**: `200 OK`
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime_seconds": integer,
  "timestamp": "2025-01-31T10:00:00Z"
}
```

**Example**:
```bash
curl http://localhost:12011/health
```

---

### Readiness Check

**Endpoint**: `GET /ready`

**Response**: `200 OK`
```json
{
  "status": "ready",
  "checks": {
    "otlp_exporter": "ok",
    "rule_engine": "ok",
    "storage": "ok"
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

**Response**: `503 Service Unavailable` (if not ready)
```json
{
  "status": "not_ready",
  "checks": {
    "otlp_exporter": "error: connection refused",
    "rule_engine": "ok",
    "storage": "ok"
  }
}
```

**Example**:
```bash
curl http://localhost:12011/ready
```

---

### Metrics

**Endpoint**: `GET /metrics`

Returns Prometheus-formatted metrics.

**Example**:
```bash
curl http://localhost:12011/metrics

# Output:
# # HELP betrace_spans_ingested_total Total spans ingested
# # TYPE betrace_spans_ingested_total counter
# betrace_spans_ingested_total 1234567
# ...
```

---

## Error Codes

BeTrace uses standard HTTP status codes:

| Code | Name | Description |
|------|------|-------------|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `202` | Accepted | Request accepted (async processing) |
| `400` | Bad Request | Invalid request format or parameters |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Authenticated but not authorized |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Resource already exists |
| `413` | Payload Too Large | Request body exceeds limits |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error (check logs) |
| `503` | Service Unavailable | Server not ready (check /ready) |

**Error Response Format**:
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}                   // Optional: Additional error context
  }
}
```

**Example Error**:
```json
{
  "error": {
    "code": "invalid_dsl_syntax",
    "message": "Rule expression has syntax error at line 1, column 15",
    "details": {
      "expression": "span.duration >",
      "error_position": 15
    }
  }
}
```

---

## Rate Limiting

BeTrace enforces rate limits to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /v1/rules` | 100 | 1 hour |
| `PUT /v1/rules/{id}` | 500 | 1 hour |
| `DELETE /v1/rules/{id}` | 100 | 1 hour |
| `POST /v1/spans` | 10,000 | 1 minute |
| `GET /v1/violations` | 1,000 | 1 minute |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699000000
```

**429 Response**:
```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Retry after 60 seconds.",
    "retry_after": 60
  }
}
```

---

## Versioning

BeTrace API uses URL versioning:

- **Current**: `/v1/*` (stable, production-ready)
- **Beta**: `/v2/*` (preview, may change)

**Deprecation Policy**:
- 90-day notice before deprecating endpoints
- 180-day support for deprecated endpoints
- Deprecation warnings in response headers:
  ```
  X-API-Deprecation: This endpoint is deprecated. Use /v2/rules instead.
  X-API-Sunset: 2025-07-01T00:00:00Z
  ```

---

## SDKs and Libraries

### Official SDKs

- **Go**: `go get github.com/betracehq/betrace-go`
- **Python**: `pip install betrace`
- **Node.js**: `npm install @betracehq/betrace`

### Example (Go)

```go
import "github.com/betracehq/betrace-go"

client := betrace.NewClient("http://localhost:12011", &betrace.Config{
    APIKey: "your-api-key",
})

// Create rule
rule, err := client.Rules.Create(&betrace.Rule{
    Name:       "slow-requests",
    Expression: "span.duration > 1s",
    Enabled:    true,
    Severity:   "HIGH",
})

// List violations
violations, err := client.Violations.List(&betrace.ViolationQuery{
    Severity:  "CRITICAL",
    StartTime: time.Now().Add(-1 * time.Hour),
})
```

---

## Webhooks (Coming Soon)

Subscribe to violation events via webhooks:

```json
POST /v1/webhooks
{
  "url": "https://example.com/betrace-webhook",
  "events": ["violation.created", "rule.disabled"],
  "filter": {
    "severity": ["CRITICAL", "HIGH"]
  }
}
```

---

## Support

- **OpenAPI Spec**: http://localhost:12011/docs
- **API Examples**: [backend/docs/api-examples.md](../backend/docs/api-examples.md)
- **GitHub Issues**: https://github.com/betracehq/betrace/issues
- **Documentation**: https://docs.betrace.io

---

**Last Updated**: 2025-11-02
**API Version**: v1
**Backend Version**: 2.0.0
