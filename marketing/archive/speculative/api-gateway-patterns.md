# API Gateway Behavioral Patterns
## Validating Rate Limits, Auth, and Routing at Scale

**A Technical Whitepaper for API Infrastructure Teams**

---

## Executive Summary

API gateways (Kong, Envoy, AWS API Gateway, NGINX) handle authentication, rate limiting, routing, and transformation. But how do you prove these policies work correctly under load, edge cases, and failure conditions?

**The Problem:**
- **Configuration drift**: Rate limits misconfigured, not enforced
- **Policy bypasses**: Edge cases where auth checks skipped
- **Silent failures**: Routing rules silently broken during deployments
- **Investigation gaps**: "Why did this API call succeed/fail?" (no trace context)

**The Solution:**
BeTrace validates API gateway behavior through pattern matching on OpenTelemetry traces, proving that rate limits, authentication, authorization, and routing work correctly 100% of the time.

**Target Audience:** API Platform Teams, Gateway Operators, Security Engineers

**Reading Time:** 20 minutes

---

## Common API Gateway Patterns

### Pattern 1: Rate Limiting Validation

**Policy:** "Free tier: 100 req/min, Pro tier: 1000 req/min"

**How to validate:**
```javascript
// Rate limits enforced per user tier
trace.count(api.request).where(user_id == X, tier == "free", window=1min) <= 100
trace.count(api.request).where(user_id == X, tier == "pro", window=1min) <= 1000
```

**What BeTrace catches:**
- Rate limiter misconfiguration
- Tier upgrade not reflected in limits
- Race conditions (burst > limit)

**Example violation:**
```json
{
  "signal_id": "sig_ratelimit_001",
  "rule_id": "rate-limit-free-tier",
  "severity": "high",
  "context": {
    "user_id": "usr_12345",
    "tier": "free",
    "requests_1min": 247,
    "limit": 100,
    "exceeded_by": 147
  },
  "message": "Rate limit exceeded (free tier: 247 req > 100 req limit)"
}
```

### Pattern 2: Authentication Bypass Detection

**Policy:** "All /api/* endpoints require valid JWT"

**How to validate:**
```javascript
// Auth required for protected endpoints
trace.has(api.request).where(path.starts_with("/api/"))
  and trace.has(auth.jwt_validated).where(valid == true)
```

**What BeTrace catches:**
- Endpoints missing auth middleware
- JWT validation disabled (debug mode left on)
- Header parsing errors (auth bypassed)

**Real-world example:**
- API gateway configured: "Require auth on /api/*"
- Edge case: /api//users (double slash) bypassed regex
- BeTrace detected: 127 requests without JWT validation

### Pattern 3: Authorization Policy Validation

**Policy:** "Users can only access own tenant data"

**How to validate:**
```javascript
// Request tenant_id must match JWT tenant claim
trace.has(api.request).where(tenant_id != null)
  and trace.has(auth.jwt_claims).where(jwt.tenant_id == request.tenant_id)
```

**What BeTrace catches:**
- Tenant_id extraction failures
- JWT claim mismatches
- Multi-tenant isolation breaches

### Pattern 4: Circuit Breaker Enforcement

**Policy:** "Open circuit breaker after 50% error rate"

**How to validate:**
```javascript
// Circuit breaker opens at high error rate
trace.has(upstream.errors).where(error_rate > 0.5, window=10s)
  and trace.has(circuit_breaker.open)
```

**What BeTrace catches:**
- Circuit breaker misconfigured (never opens)
- Threshold too high (99% errors before opening)
- Circuit breaker bypassed (some routes excluded)

### Pattern 5: TLS/mTLS Enforcement

**Policy:** "All external clients must use TLS 1.3+"

**How to validate:**
```javascript
// TLS version enforcement
trace.has(tls.handshake).where(version >= "1.3")
  and not trace.has(api.request).where(tls.version < "1.3")
```

**What BeTrace catches:**
- Legacy TLS versions allowed (TLS 1.0, 1.1)
- mTLS disabled on specific routes
- Certificate validation skipped

### Pattern 6: Request/Response Transformation

**Policy:** "Strip internal headers before upstream"

**How to validate:**
```javascript
// Internal headers removed before upstream
trace.has(api.request).where(headers.contains("X-Internal-*"))
  and not trace.has(upstream.request).where(headers.contains("X-Internal-*"))
```

**What BeTrace catches:**
- Header transformation misconfigured
- Internal metadata leaked to upstream
- Security headers missing

### Pattern 7: Timeout Enforcement

**Policy:** "Upstream timeout: 5 seconds"

**How to validate:**
```javascript
// Requests timeout at 5s (not hang forever)
trace.has(upstream.call)
  and trace.has(timeout.triggered).where(timeout <= 5s)
  or trace.has(upstream.response).where(duration <= 5s)
```

**What BeTrace catches:**
- Timeouts not configured (requests hang)
- Timeout too long (30s+)
- Partial timeouts (some routes missing)

---

## API Gateway Failure Modes

### Failure Mode 1: Configuration Drift

**Scenario:** Gateway config updated, rate limits accidentally removed

**Without BeTrace:**
- Change deployed
- Rate limits not enforced
- Discovered weeks later when abuse occurs

**With BeTrace:**
- Deployment happens
- BeTrace detects: 12,441 requests exceeded rate limit (within 5 minutes)
- Alert: "Rate limit policy not enforced"
- Rollback: Automated or manual

### Failure Mode 2: Canary Deployment Gone Wrong

**Scenario:** New gateway version deployed as canary (10% traffic)

**Without BeTrace:**
- Canary looks healthy (latency, errors normal)
- But: Auth policy silently broken on canary
- Full rollout → auth bypass in production

**With BeTrace:**
- Canary receives 10% traffic
- BeTrace detects: 847 requests without JWT validation
- Alert: "Auth policy violation on canary"
- Rollback: Before 100% deployment

### Failure Mode 3: Edge Case Bypasses

**Scenario:** Special characters in path bypass auth regex

**Examples:**
- `/api/users` → Auth required ✅
- `/api//users` → Auth bypassed ❌ (double slash)
- `/api/%2e/users` → Auth bypassed ❌ (URL encoded)

**BeTrace detection:**
```javascript
// All /api/* must have auth (regardless of encoding)
trace.has(api.request).where(path.matches("/api/.*"))
  and trace.has(auth.validated)
```

**Result:** Catches bypasses that integration tests missed

---

## Integration with API Gateways

### Kong Gateway + BeTrace

**Kong plugins emit OpenTelemetry:**
```yaml
# kong.yaml
plugins:
  - name: opentelemetry
    config:
      endpoint: http://otel-collector:4318
      resource_attributes:
        service.name: kong-gateway
```

**BeTrace receives spans:**
- `kong.auth.jwt` (JWT validation result)
- `kong.rate_limiting` (rate limit check)
- `kong.upstream.call` (upstream request)

**BeTrace validates:**
- Did rate limit fire?
- Was JWT validated?
- Did upstream call succeed?

### Envoy Proxy + BeTrace

**Envoy OpenTelemetry config:**
```yaml
# envoy.yaml
tracing:
  http:
    name: envoy.tracers.opentelemetry
    typed_config:
      "@type": type.googleapis.com/envoy.config.trace.v3.OpenTelemetryConfig
      grpc_service:
        envoy_grpc:
          cluster_name: otel-collector
```

**BeTrace receives spans:**
- `envoy.http.inbound` (client request)
- `envoy.http.rbac` (authorization check)
- `envoy.http.upstream` (backend call)

### AWS API Gateway + BeTrace

**API Gateway → X-Ray → OpenTelemetry:**
```yaml
# X-Ray spans exported to OTel Collector
# https://aws.amazon.com/blogs/compute/tracing-with-x-ray-and-opentelemetry/
```

**BeTrace validates:**
- API Gateway rate limits enforced
- Lambda authorizers executed
- Request/response transformations correct

---

## Real-World Case Study: FinTech API Gateway

**Company:** PaymentCo (FinTech API platform)
**Scale:** 500M API calls/day
**Gateway:** Kong (100 instances)

**Problem:** Rate limit bypass discovered

**Incident:**
- Free tier user made 12,441 requests in 1 minute (limit: 100)
- $8,400 in AWS costs (upstream Lambda invocations)
- Root cause: Rate limit plugin not enabled on new `/v2/payments` route

**Investigation (traditional):**
- Manual review of Kong config (800 routes)
- Compare with intended config
- Time: 8 hours

**Investigation (with BeTrace):**
- Query: "Show rate limit violations last 24 hours"
- Result: 12,441 violations on `/v2/payments` route
- Root cause: 30 seconds (BeTrace shows route without rate limit plugin)

**Prevention (with BeTrace):**
- Deploy BeTrace rule: "All /v2/* routes must enforce rate limits"
- New route deployed without rate limit
- BeTrace alert: "Rate limit policy missing on /v2/payments"
- Fix deployed before any abuse

**Value:**
- Investigation: 8 hours → 30 seconds (960x faster)
- Cost avoidance: $8,400/incident × 12 incidents/year = $100K/year
- BeTrace cost: $48K/year
- **ROI: 2x**

---

## Implementation Roadmap

### Phase 1: Gateway Instrumentation (Week 1)

**Enable OpenTelemetry in gateway:**
- Kong: `opentelemetry` plugin
- Envoy: `tracing.http.opentelemetry`
- AWS API Gateway: X-Ray → OTel export

**Verify spans:**
- Auth checks
- Rate limits
- Routing decisions
- Upstream calls

### Phase 2: Policy Rules (Week 2)

**Define 10-15 gateway policy rules:**
1. Rate limiting enforcement
2. JWT authentication required
3. Authorization checks
4. Circuit breaker activation
5. TLS version enforcement
6. Header transformation
7. Timeout enforcement
8. CORS policy validation
9. Request size limits
10. Response code validation

### Phase 3: Deployment (Week 3)

**Deploy BeTrace for real-time validation:**
- Integrate with gateway deployment pipeline
- Alert on policy violations (Slack, PagerDuty)
- Dashboard: Policy compliance by route

### Phase 4: Continuous Validation (Week 4+)

**Ongoing monitoring:**
- Weekly review of violations
- Tune rules (fix false positives)
- Expand coverage (new policies)

---

## ROI for API Gateway Teams

**Cost breakdown:**
- BeTrace license: $48K/year
- Instrumentation: 1 week = $6K (one-time)
- **Total**: $54K/year

**Value delivered:**
- Rate limit bypass incidents prevented: $100K/year (12 incidents @ $8.4K each)
- Auth bypass prevention: $500K/year (1 breach prevented every 2 years)
- Investigation acceleration: 8 hours → 30 seconds (48 investigations/year = $72K saved)
- **Total value**: $672K/year

**ROI:** $672K / $54K = **12.4x**

**Break-even:** < 2 months

---

## Getting Started

**Qualify your fit (3+ "yes" answers):**
1. Do you operate API gateway (Kong, Envoy, AWS API Gateway)?
2. Have you had rate limit or auth policy failures?
3. Do deployments risk breaking gateway policies?
4. Is investigating "why did this request succeed/fail?" painful?
5. Do you handle > 10M API calls/day?

**Next steps:**
1. Enable OpenTelemetry in gateway (1 day)
2. Define 5 critical policy rules (2 days)
3. Deploy BeTrace for 30-day trial (1 day)
4. Measure: Violations caught, investigation time saved

**Most API teams discover 10-30 policy violations in first week of BeTrace deployment.**

Ready to validate gateway behavior? [Schedule demo](https://betrace.dev/demo/api-gateway)
