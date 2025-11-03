# BeTrace API Examples

**Base URL:** `http://localhost:12011`
**OpenAPI Spec:** `http://localhost:12011/docs`

---

## Rules API

### Create Rule

Create a new BeTraceDSL rule for trace pattern matching.

```bash
curl -X POST http://localhost:12011/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "slow-requests",
    "description": "Alert on requests taking longer than 1 second",
    "expression": "span.duration > 1s",
    "enabled": true,
    "severity": "HIGH",
    "tags": ["performance", "latency"]
  }'
```

**Response:**
```json
{
  "id": "slow-requests",
  "name": "slow-requests",
  "description": "Alert on requests taking longer than 1 second",
  "expression": "span.duration > 1s",
  "enabled": true,
  "severity": "HIGH",
  "tags": ["performance", "latency"],
  "created_at": "2025-01-31T10:00:00Z",
  "updated_at": "2025-01-31T10:00:00Z"
}
```

---

### List Rules

Get all rules, with optional filtering.

```bash
# List all rules
curl http://localhost:12011/v1/rules

# List only enabled rules
curl http://localhost:12011/v1/rules?enabled_only=true

# Filter by severity
curl http://localhost:12011/v1/rules?severity=HIGH

# Filter by tags
curl "http://localhost:12011/v1/rules?tags=performance&tags=security"
```

**Response:**
```json
{
  "rules": [
    {
      "id": "slow-requests",
      "name": "slow-requests",
      "expression": "span.duration > 1s",
      "enabled": true,
      "severity": "HIGH",
      "tags": ["performance"]
    }
  ],
  "total_count": 1
}
```

---

### Get Rule by ID

Retrieve a specific rule.

```bash
curl http://localhost:12011/v1/rules/slow-requests
```

**Response:**
```json
{
  "id": "slow-requests",
  "name": "slow-requests",
  "expression": "span.duration > 1s",
  "enabled": true,
  "severity": "HIGH",
  "tags": ["performance"],
  "created_at": "2025-01-31T10:00:00Z",
  "updated_at": "2025-01-31T10:00:00Z"
}
```

---

### Update Rule

Update an existing rule.

```bash
curl -X PUT http://localhost:12011/v1/rules/slow-requests \
  -H "Content-Type: application/json" \
  -d '{
    "id": "slow-requests",
    "name": "slow-requests",
    "description": "Updated: Alert on requests > 500ms",
    "expression": "span.duration > 500ms",
    "enabled": true,
    "severity": "MEDIUM",
    "tags": ["performance"]
  }'
```

---

### Delete Rule

Delete a rule by ID.

```bash
curl -X DELETE http://localhost:12011/v1/rules/slow-requests
```

**Response:**
```json
{
  "success": true
}
```

---

### Enable Rule

Enable a disabled rule.

```bash
curl -X POST http://localhost:12011/v1/rules/slow-requests/enable
```

---

### Disable Rule

Disable an enabled rule.

```bash
curl -X POST http://localhost:12011/v1/rules/slow-requests/disable
```

---

## Spans API

### Ingest Spans

Submit OpenTelemetry spans for rule evaluation.

```bash
curl -X POST http://localhost:12011/v1/spans \
  -H "Content-Type: application/json" \
  -d '{
    "spans": [
      {
        "trace_id": "abc123",
        "span_id": "span-1",
        "name": "GET /api/users",
        "start_time": 1706700000000000000,
        "end_time": 1706700002000000000,
        "attributes": {
          "http.method": "GET",
          "http.status_code": 200,
          "http.url": "/api/users"
        }
      }
    ]
  }'
```

**Response:**
```json
{
  "accepted": 1,
  "rejected": 0,
  "errors": []
}
```

---

## Violations API

### List Violations

Query rule violations.

```bash
# List all violations
curl http://localhost:12011/v1/violations

# Filter by rule ID
curl http://localhost:12011/v1/violations?rule_id=slow-requests

# Limit results
curl http://localhost:12011/v1/violations?limit=10
```

**Response:**
```json
{
  "violations": [
    {
      "id": "viol-123",
      "rule_id": "slow-requests",
      "rule_name": "slow-requests",
      "trace_id": "abc123",
      "span_id": "span-1",
      "timestamp": "2025-01-31T10:05:00Z",
      "severity": "HIGH",
      "message": "Request exceeded 1s threshold",
      "context": {
        "duration": "2.1s",
        "url": "/api/users"
      }
    }
  ],
  "total_count": 1
}
```

---

## Health API

### Check Health

Check service health and version.

```bash
curl http://localhost:12011/v1/health
```

**Response:**
```json
{
  "status": "HEALTHY",
  "version": "2.0.0",
  "uptime_seconds": 3600,
  "metadata": {
    "storage": "in-memory"
  }
}
```

---

### Check Readiness

Check if service is ready to accept traffic.

```bash
curl http://localhost:12011/v1/ready
```

**Response:**
```json
{
  "status": "HEALTHY",
  "version": "2.0.0",
  "uptime_seconds": 3600,
  "metadata": {
    "storage": "in-memory"
  }
}
```

---

## Complete Example: Rule Lifecycle

```bash
#!/bin/bash
set -e

BASE_URL="http://localhost:12011"

# 1. Create a rule
echo "Creating rule..."
curl -X POST $BASE_URL/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "high-error-rate",
    "expression": "span.attributes[\"http.status_code\"] >= 500",
    "enabled": true,
    "severity": "CRITICAL",
    "tags": ["errors", "http"]
  }'

# 2. Ingest spans that violate the rule
echo -e "\n\nIngesting spans..."
curl -X POST $BASE_URL/v1/spans \
  -H "Content-Type: application/json" \
  -d '{
    "spans": [
      {
        "trace_id": "trace-123",
        "span_id": "span-1",
        "name": "GET /api/error",
        "start_time": 1706700000000000000,
        "end_time": 1706700001000000000,
        "attributes": {
          "http.method": "GET",
          "http.status_code": 500,
          "http.url": "/api/error"
        }
      }
    ]
  }'

# 3. Check for violations
echo -e "\n\nChecking violations..."
curl "$BASE_URL/v1/violations?rule_id=high-error-rate"

# 4. Disable the rule
echo -e "\n\nDisabling rule..."
curl -X POST $BASE_URL/v1/rules/high-error-rate/disable

# 5. Delete the rule
echo -e "\n\nDeleting rule..."
curl -X DELETE $BASE_URL/v1/rules/high-error-rate

echo -e "\n\nDone!"
```

---

## Advanced BeTraceDSL Examples

### Security: Detect PII Access Without Audit Log

```bash
curl -X POST http://localhost:12011/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pii-without-audit",
    "expression": "trace.has(span.name == \"pii.access\") and not trace.has(span.name == \"audit.log\")",
    "enabled": true,
    "severity": "CRITICAL",
    "tags": ["security", "compliance", "pii"]
  }'
```

### Performance: Detect Slow Database Queries

```bash
curl -X POST http://localhost:12011/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "slow-db-query",
    "expression": "span.name =~ \"^db\\.\" and span.duration > 100ms",
    "enabled": true,
    "severity": "HIGH",
    "tags": ["performance", "database"]
  }'
```

### Reliability: Detect Missing Retries on Failures

```bash
curl -X POST http://localhost:12011/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "no-retry-on-failure",
    "expression": "span.attributes[\"error\"] == true and not trace.has(span.attributes[\"retry.attempt\"])",
    "enabled": true,
    "severity": "MEDIUM",
    "tags": ["reliability", "retries"]
  }'
```

### Compliance: Detect Cross-Region Data Transfer

```bash
curl -X POST http://localhost:12011/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cross-region-transfer",
    "expression": "span.attributes[\"data.region\"] != span.attributes[\"service.region\"]",
    "enabled": true,
    "severity": "HIGH",
    "tags": ["compliance", "data-residency"]
  }'
```

---

## Error Handling

All API endpoints return standard HTTP status codes:

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request (validation error)
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

**Error Response Format:**
```json
{
  "code": 3,
  "message": "rule validation failed: invalid expression syntax",
  "details": []
}
```

---

## Rate Limiting

Default rate limits (configurable via environment):

- **Rule CRUD:** 100 requests/minute per IP
- **Span Ingestion:** 10,000 spans/second
- **Violation Queries:** 1,000 requests/minute

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706700360
```

---

## Authentication (Optional)

BeTrace supports optional API key authentication:

```bash
export BETRACE_API_KEY="your-api-key-here"

curl -X POST http://localhost:12011/v1/rules \
  -H "Authorization: Bearer $BETRACE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

---

## Metrics

BeTrace exposes Prometheus metrics at `/metrics`:

```bash
curl http://localhost:12011/metrics
```

**Key Metrics:**
- `betrace_rules_total` - Total number of active rules
- `betrace_spans_ingested_total` - Total spans ingested
- `betrace_violations_detected_total` - Total violations detected
- `betrace_span_evaluation_duration_seconds` - Rule evaluation latency

---

## OpenAPI Specification

The complete OpenAPI 2.0 specification is available at:

**JSON:** `http://localhost:12011/api/openapi/betrace.swagger.json`
**UI:** `http://localhost:12011/docs` (Swagger UI)

You can import the spec into tools like:
- Postman
- Insomnia
- curl
- Code generators (openapi-generator, swagger-codegen)

---

## Support

**Documentation:** https://github.com/betracehq/betrace
**Issues:** https://github.com/betracehq/betrace/issues
**Slack:** #betrace-dev
