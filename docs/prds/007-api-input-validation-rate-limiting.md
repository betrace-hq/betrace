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
- FLUO DSL syntax validation
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

**FLUO Implementation:** FLUO's InputSanitizer implements OWASP's validation patterns for rule expressions, trace IDs, and user input.

### 2. Bucket4j Rate Limiting
**URL:** https://github.com/vladimir-bukhtoyarov/bucket4j

**Relevance:** Production-ready token bucket rate limiting library for Java. Implements per-tenant and per-user rate limits with distributed caching support.

**Key Patterns:**
- Token bucket algorithm (constant rate with burst capacity)
- Per-key rate limiting (tenant ID, user ID)
- Distributed caching (Redis, Hazelcast)
- Bandwidth configuration (limit, refill rate)
- HTTP 429 (Too Many Requests) responses

**FLUO Implementation:** FLUO's RateLimitFilter uses Bucket4j for tenant-level (1000 req/min) and user-level (100 req/min) throttling.

### 3. Hibernate Validator (Bean Validation JSR 380)
**URL:** https://hibernate.org/validator/

**Relevance:** Reference implementation of Bean Validation (JSR 380) for declarative input validation. Provides annotation-based constraints (@NotNull, @Email, @Size) used throughout FLUO's API.

**Key Patterns:**
- Declarative validation with annotations
- Custom validator implementation
- Validation groups (different rules for create vs. update)
- Method parameter validation
- Cross-field validation

**FLUO Implementation:** All FLUO API request DTOs use Bean Validation annotations (see CreateRuleRequest, UpdateSignalStatusRequest).
