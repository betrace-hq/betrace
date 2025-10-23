# PRD-007: API Input Validation & Rate Limiting

**Priority:** P0 (Security - Blocks Production)
**Complexity:** Medium
**Personas:** All
**Dependencies:** PRD-001 (Auth needed for per-user rate limits)

## Problem

**No input validation or rate limiting:**
- API endpoints accept any input without validation
- No protection against injection attacks
- No rate limiting → vulnerable to DoS
- No request size limits
- Malformed requests can crash backend

**Current State:**
- `SpanApiRoute.java` - No validation
- No Bean Validation annotations
- No rate limiting middleware
- No request sanitization

## Solution

### Input Validation

**Bean Validation (JSR 380):**
```java
public record CreateRuleRequest(
    @NotBlank @Size(max = 255) String name,
    @NotBlank @Size(max = 5000) String expression,
    @NotNull RuleSeverity severity
) {}
```

**Custom Validators:**
- BeTrace DSL syntax validation
- Trace ID format validation
- Tenant ID UUID validation

### Rate Limiting

**Strategy:** Token bucket per tenant + per user
- Tenant limit: 1000 req/min
- User limit: 100 req/min
- Authenticated endpoints only

**Technology:** Quarkus Rate Limiting extension + Redis

### Implementation

1. **Validation Annotations:**
```java
@Path("/api/rules")
public class RuleApiRoute {

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response createRule(@Valid CreateRuleRequest request) {
        // @Valid triggers validation
    }
}
```

2. **Rate Limiter:**
```java
@RateLimit(
    value = 100,
    window = "1m",
    scope = RateLimitScope.USER
)
@GET
public List<Signal> getSignals() {
    // Limited to 100 req/min per user
}
```

3. **Request Sanitization:**
- Strip HTML tags from string inputs
- Limit request body size (1MB max)
- Validate JSON structure
- Escape SQL/LDAP injection patterns

## Success Criteria

- [ ] All API endpoints have input validation
- [ ] Invalid requests return 400 with error details
- [ ] Rate limiting enforced (429 responses)
- [ ] Request size limits enforced
- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked
- [ ] DoS attacks mitigated
- [ ] Test coverage: Validation, rate limiting, injection prevention

## Files to Create

- `backend/src/main/java/com/fluo/validation/FluoDslValidator.java`
- `backend/src/main/java/com/fluo/validation/TraceIdValidator.java`
- `backend/src/main/java/com/fluo/security/RateLimitFilter.java`
- `backend/src/main/java/com/fluo/security/InputSanitizer.java`

## Dependencies

**Requires:** PRD-001 (Auth for per-user limits)
**Blocks:** All feature PRDs (secure foundation)

## Public Examples

### 1. OWASP Input Validation Cheat Sheet
**URL:** https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

**Relevance:** Industry-standard defensive coding patterns for preventing injection attacks (SQL injection, XSS, path traversal). Essential security guidance for API input validation.

**Key Patterns:**
- Whitelist validation (allow known good patterns)
- Canonicalization before validation
- Output encoding to prevent XSS
- Parameterized queries to prevent SQL injection
- File upload validation

**BeTrace Implementation:** BeTrace's InputSanitizer implements OWASP's validation patterns for rule expressions, trace IDs, and user input.

### 2. Bucket4j Rate Limiting
**URL:** https://github.com/vladimir-bukhtoyarov/bucket4j

**Relevance:** Production-ready token bucket rate limiting library for Java. Implements per-tenant and per-user rate limits with distributed caching support.

**Key Patterns:**
- Token bucket algorithm (constant rate with burst capacity)
- Per-key rate limiting (tenant ID, user ID)
- Distributed caching (Redis, Hazelcast)
- Bandwidth configuration (limit, refill rate)
- HTTP 429 (Too Many Requests) responses

**BeTrace Implementation:** BeTrace's RateLimitFilter uses Bucket4j for tenant-level (1000 req/min) and user-level (100 req/min) throttling.

### 3. Hibernate Validator (Bean Validation JSR 380)
**URL:** https://hibernate.org/validator/

**Relevance:** Reference implementation of Bean Validation (JSR 380) for declarative input validation. Provides annotation-based constraints (@NotNull, @Email, @Size) used throughout BeTrace's API.

**Key Patterns:**
- Declarative validation with annotations
- Custom validator implementation
- Validation groups (different rules for create vs. update)
- Method parameter validation
- Cross-field validation

**BeTrace Implementation:** All BeTrace API request DTOs use Bean Validation annotations (see CreateRuleRequest, UpdateSignalStatusRequest).

## Implementation Readiness Assessment

**Implementation Specialist Confidence:** 98% ✅ **READY TO IMPLEMENT**

### Clarifications Completed

**Rate Limiting Architecture:**
- ✅ Three-tier hierarchy: Tenant (1000/min) → User (100/min) → IP (fallback)
- ✅ Sliding window algorithm with 60-second window, 1-second buckets
- ✅ Redis-based distributed counters with atomic operations
- ✅ HTTP 429 responses with `Retry-After` and `X-RateLimit-*` headers
- ✅ Key pattern: `ratelimit:{tenant}:{resource}:{window}`

**Validation Strategy:**
- ✅ Use `@Valid` on REST resources for DTO validation
- ✅ Manual `RuleValidator.validateSyntax()` for DSL validation in Camel processors
- ✅ Accumulate all validation errors (return all, not fail-fast)
- ✅ Validation error response format with line/column numbers

**Technology Stack:**
- ✅ `quarkus-redis-client` for distributed rate limiting
- ✅ Quarkus Dev Services for local Redis (single instance)
- ✅ Named `RateLimitProcessor` in Camel route (ADR-014 compliant)
- ✅ Execution order: Auth → Rate Limit → Validation → Business Logic

**Observability:**
- ✅ Contribute to existing OTel spans with rate limit events
- ✅ Emit custom metrics: `fluo.rate_limit.checks`, `fluo.rate_limit.latency`
- ✅ Health/metrics endpoints (`/q/*`) exempt from rate limiting

**Tenant Configuration:**
- ✅ Tier-based limits in `application.properties`
- ✅ Free tier: 100/min, Paid: 10K/min, Enterprise: 100K/min
- ✅ Tenant `tier` column in database for tier resolution

### Implementation Estimate

**Total Time:** 4 hours

**Breakdown:**
1. **Redis Integration (1 hour):**
   - Add `quarkus-redis-client` to pom.xml
   - Configure Redis in application.properties
   - Implement `RateLimitService` with sliding window logic

2. **Camel Processor (1 hour):**
   - Create `RateLimitProcessor` as Named processor
   - Add to routes after `TenantProcessor`
   - Implement observability hooks

3. **Validation (1 hour):**
   - Add `@Valid` to request DTOs
   - Extend `RuleValidator` with error accumulation
   - Create validation error response format

4. **Testing (1 hour):**
   - Unit tests for sliding window algorithm
   - Integration tests with Redis
   - Load tests (<5ms p95 latency validation)

### Files to Create
```
backend/src/main/java/com/fluo/processors/RateLimitProcessor.java
backend/src/main/java/com/fluo/services/RateLimitService.java
backend/src/test/java/com/fluo/processors/RateLimitProcessorTest.java
backend/src/test/java/com/fluo/services/RateLimitServiceTest.java
```

### Files to Modify
```
backend/pom.xml (add quarkus-redis-client)
backend/src/main/resources/application.properties (rate limit config)
backend/src/main/java/com/fluo/components/RuleValidator.java (extend validation)
backend/src/main/java/com/fluo/routes/SpanApiRoute.java (add RateLimitProcessor)
```

### Remaining 2% Risk
- Quarkus + Camel + Redis integration edge cases (resolvable via testing)
- Redis connection pool tuning (standard configuration)

**Status:** No blockers. Ready to start implementation immediately.
