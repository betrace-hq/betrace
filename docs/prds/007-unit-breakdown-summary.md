# PRD-007 Unit Breakdown Summary

**Parent PRD:** PRD-007 (API Input Validation & Rate Limiting)
**Created:** 2025-10-10

## Overview

PRD-007 has been split into **5 independently implementable units** following BeTrace's architecture principles (ADR-013 Camel-First, ADR-014 Named Processors, ADR-011 Pure Application).

## Units

### Unit A: Bean Validation Foundation (JSR-380)
**File:** `007a-bean-validation-foundation.md`
**Priority:** P0
**Dependencies:** None (foundation unit)

**Scope:**
- Implement Bean Validation (JSR-380) annotations for all API request DTOs
- Create validated request records for rules, signals, traces
- Integrate validation with Camel routes and error handlers
- Standardized validation error response format

**Key Files:**
- Request DTOs: `CreateRuleRequest`, `QuerySignalsRequest`, `IngestTracesRequest`, `TraceSpanDTO`
- Processor: `ValidationErrorProcessor`
- Error Response: `ValidationErrorResponse`, `FieldError`

**Success Criteria:**
- All API endpoints have validated request DTOs
- Invalid requests return 400 with detailed field errors
- 90%+ test coverage

---

### Unit B: Custom Validators (BeTrace DSL, Trace ID, Tenant ID)
**File:** `007b-custom-validators.md`
**Priority:** P0
**Dependencies:** Unit A (Bean Validation Foundation)

**Scope:**
- Custom Bean Validation validators for BeTrace-specific formats
- BeTrace DSL syntax validation (integrates with existing `FluoDslParser`)
- OpenTelemetry Trace ID format validation (32-char hex)
- OpenTelemetry Span ID format validation (16-char hex)
- Tenant existence validation (checks TigerBeetle)

**Key Files:**
- Annotations: `@ValidFluoDsl`, `@ValidTraceId`, `@ValidSpanId`, `@TenantExists`
- Validators: `FluoDslValidator`, `TraceIdValidator`, `SpanIdValidator`, `TenantExistsValidator`

**Success Criteria:**
- Invalid BeTrace DSL syntax rejected with detailed parse error
- Invalid Trace/Span IDs rejected
- Non-existent tenant IDs rejected
- 90%+ test coverage

---

### Unit C: Rate Limiting Infrastructure (Token Bucket + Redis)
**File:** `007c-rate-limiting-infrastructure.md`
**Priority:** P0
**Dependencies:**
- Unit A (Bean Validation Foundation) - for error response format
- PRD-001 (Authentication) - for per-user rate limits

**Scope:**
- Token bucket algorithm with Redis backend
- Per-tenant rate limits (1000 req/min default)
- Per-user rate limits (100 req/min default)
- Rate limit violation metrics for Grafana

**Key Files:**
- Processors: `RateLimitProcessor`, `RateLimitErrorProcessor`
- Services: `RateLimiter`, `MetricsService`
- Error Response: `RateLimitErrorResponse`, `RateLimitExceededException`

**Success Criteria:**
- Tenant and user rate limits enforced
- Rate limit violations return 429 with Retry-After header
- Token bucket allows bursts up to limit
- Redis stores rate limit state (multi-instance support)
- 90%+ test coverage

---

### Unit D: Request Sanitization & Injection Prevention
**File:** `007d-request-sanitization-injection-prevention.md`
**Priority:** P0
**Dependencies:** Unit A (Bean Validation Foundation)

**Scope:**
- XSS prevention (HTML/JavaScript stripping using OWASP sanitizer)
- SQL injection detection and blocking
- LDAP injection detection and blocking
- Command injection detection and blocking
- Request size limits (1MB default, prevents memory DoS)

**Key Files:**
- Processors: `InputSanitizerProcessor`, `InjectionAttemptErrorProcessor`
- Services: `InputSanitizer`
- Exceptions: `InjectionAttemptException`, `RequestEntityTooLargeException`

**Success Criteria:**
- XSS attacks blocked (malicious HTML stripped)
- SQL/LDAP/command injection attempts blocked
- Oversized requests return 413
- Injection attempts logged and metrics recorded
- 90%+ test coverage

---

### Unit E: Compliance Audit Logging (SOC2 Evidence)
**File:** `007e-compliance-audit-logging.md`
**Priority:** P0
**Dependencies:**
- Unit A (Validation Failures)
- Unit C (Rate Limit Violations)
- Unit D (Injection Attempts)

**Scope:**
- Emit SOC2 compliance spans for security events
- Validation failures → SOC2 CC6.1 (Logical Access Controls)
- Rate limit violations → SOC2 CC6.1 (Access Controls)
- Injection attempts → SOC2 CC7.1 (System Monitoring)
- Integrate with existing BeTrace compliance framework

**Key Files:**
- Processors: `ComplianceAuditProcessor`
- Services: `ComplianceSpanEmitter`

**Success Criteria:**
- Validation failures emit SOC2 CC6.1 compliance spans
- Rate limit violations emit SOC2 CC6.1 compliance spans
- Injection attempts emit SOC2 CC7.1 compliance spans
- Compliance spans queryable via Grafana/TraceQL
- 90%+ test coverage

---

## Dependency Graph

```
Unit A: Bean Validation Foundation
  ↓
  ├─→ Unit B: Custom Validators
  ├─→ Unit C: Rate Limiting (also needs PRD-001 Auth)
  ├─→ Unit D: Request Sanitization
  └─→ Unit E: Compliance Audit Logging
        ↑
        ├── Unit A (validation failures)
        ├── Unit C (rate limit violations)
        └── Unit D (injection attempts)
```

## Implementation Order

**Recommended sequence:**

1. **Unit A** (foundation) - Required by all other units
2. **Unit B** or **Unit D** (parallel) - Independent of each other
3. **Unit C** (after Unit A, needs PRD-001 Auth for user limits)
4. **Unit E** (last) - Depends on A, C, D for security events

**Alternative (if PRD-001 not ready):**
1. Unit A
2. Unit B
3. Unit D
4. Unit C (implement tenant-only rate limiting, defer user limits)
5. Unit E

## Architecture Compliance

All units follow BeTrace's architecture:

- **ADR-013 (Camel-First):** All validation, rate limiting, and sanitization implemented as Camel processors
- **ADR-014 (Named Processors):** All processors extracted as named CDI beans for testability
- **ADR-011 (Pure Application):** No deployment-specific logic, Redis is deployment-agnostic
- **ADR-015 (Testing Standards):** 90%+ instruction coverage, 80%+ branch coverage required for all units

## Test Coverage Goals

**Per Unit:**
- Instruction Coverage: 90%+
- Branch Coverage: 80%+

**Test Categories:**
1. Unit tests: Processor and service logic
2. Integration tests: End-to-end Camel route flows
3. Property-based tests: Security boundary enforcement (where applicable)

## Compliance Integration

Units integrate with BeTrace's existing compliance framework:
- **ComplianceSpan** (from `compliance-as-code` flake)
- **@SOC2 annotations** (existing)
- **ComplianceOtelProcessor** (existing)

**SOC2 Controls Covered:**
- **CC6.1 (Logical Access Controls):** Validation failures, rate limits
- **CC7.1 (System Monitoring):** Injection attempt detection

**Security Gaps NOT Addressed:**
- Compliance span cryptographic signatures (see @docs/compliance-status.md P0 gaps)
- PII redaction enforcement
- Rule engine sandboxing

## Files Created

### PRD Documents
- `/Users/sscoble/Projects/fluo/docs/prds/007a-bean-validation-foundation.md`
- `/Users/sscoble/Projects/fluo/docs/prds/007b-custom-validators.md`
- `/Users/sscoble/Projects/fluo/docs/prds/007c-rate-limiting-infrastructure.md`
- `/Users/sscoble/Projects/fluo/docs/prds/007d-request-sanitization-injection-prevention.md`
- `/Users/sscoble/Projects/fluo/docs/prds/007e-compliance-audit-logging.md`
- `/Users/sscoble/Projects/fluo/docs/prds/007-unit-breakdown-summary.md` (this file)

## Next Steps

1. Review each unit PRD for accuracy and completeness
2. Assign units to team members based on expertise
3. Start with Unit A (foundation)
4. Implement units in recommended order
5. Verify 90%+ test coverage before marking unit complete
