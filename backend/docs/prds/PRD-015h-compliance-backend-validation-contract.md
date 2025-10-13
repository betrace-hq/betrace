# PRD-015h: Compliance Backend Validation Contract

**Parent PRD:** PRD-015f (Compliance Evidence Dashboard)
**Priority:** P2
**Status:** Backlog
**Estimated Effort:** 3 days

## Context

Security expert review identified that frontend security relies on backend enforcement. This PRD documents the required backend validations to ensure defense-in-depth security.

## Problem Statement

**Current State:**
- Frontend validates all inputs
- Backend validation requirements undocumented
- Risk of bypass if backend validation missing
- No API contract for security requirements

**Impact:**
- Security vulnerabilities if backend validation differs from frontend
- Maintenance burden keeping frontend/backend in sync
- Unclear responsibilities between teams

## Requirements

### API Contract Documentation

Create comprehensive backend validation requirements document.

**File:** `/Users/sscoble/Projects/fluo/backend/docs/api-contracts/compliance-api-security.md`

### Required Backend Validations

#### 1. Tenant Isolation

**Endpoint:** All `/api/compliance/*` endpoints

**Validation:**
```java
@PreAuthorize("hasPermission(#tenantId, 'tenant', 'read')")
public List<ComplianceSpan> getEvidenceSpans(
    @RequestParam String tenantId,
    @RequestParam(required = false) String framework,
    ...
) {
    // Validate tenantId matches authenticated user's tenant
    if (!SecurityContext.getTenantId().equals(tenantId)) {
        throw new ForbiddenException("Cannot access other tenant data");
    }

    // Continue processing...
}
```

**Test Requirements:**
- User from tenant A cannot query tenant B's data
- Tenant ID parameter tampering returns 403
- Missing tenant context returns 401

#### 2. Input Validation

**Date Range Validation:**
```java
public void validateDateRange(LocalDate startDate, LocalDate endDate) {
    if (startDate == null || endDate == null) {
        throw new ValidationException("Date range required");
    }

    if (startDate.isAfter(endDate)) {
        throw new ValidationException("Start date must be before end date");
    }

    long daysBetween = ChronoUnit.DAYS.between(startDate, endDate);
    if (daysBetween > 90) {
        throw new ValidationException("Date range cannot exceed 90 days");
    }

    if (startDate.isAfter(LocalDate.now())) {
        throw new ValidationException("Start date cannot be in the future");
    }
}
```

**Span ID Validation:**
```java
public void validateSpanId(String spanId) {
    if (spanId == null || !spanId.matches("^[0-9a-f]{32}$")) {
        throw new ValidationException("Invalid span ID format");
    }
}
```

**Framework Validation:**
```java
private static final Set<String> VALID_FRAMEWORKS = Set.of(
    "soc2", "hipaa", "iso27001", "fedramp", "pci-dss"
);

public void validateFramework(String framework) {
    if (framework != null && !VALID_FRAMEWORKS.contains(framework.toLowerCase())) {
        throw new ValidationException("Invalid framework: " + framework);
    }
}
```

#### 3. Rate Limiting

**Export Endpoint:** `/api/compliance/evidence/export`

**Implementation:**
```java
@RateLimiter(name = "compliance-export", fallbackMethod = "exportRateLimitFallback")
public ResponseEntity<byte[]> exportEvidence(
    @RequestParam String tenantId,
    @RequestBody ExportRequest request
) {
    // Rate limit: 1 export per 60 seconds per tenant
    // ...
}

public ResponseEntity<byte[]> exportRateLimitFallback(
    String tenantId,
    ExportRequest request,
    RateLimitExceededException ex
) {
    return ResponseEntity
        .status(429)
        .body(new ErrorResponse("Rate limit exceeded. Please wait 60 seconds."));
}
```

**Configuration:**
```yaml
resilience4j:
  ratelimiter:
    instances:
      compliance-export:
        limitForPeriod: 1
        limitRefreshPeriod: 60s
        timeoutDuration: 0s
```

#### 4. Export Size Limits

**Validation:**
```java
public void validateExportSize(ExportRequest request) {
    // Estimate result size before executing query
    long estimatedRows = complianceRepository.estimateResultSize(
        request.getTenantId(),
        request.getFilters()
    );

    long estimatedSizeBytes = estimatedRows * 1024; // 1KB per row estimate
    long maxSizeBytes = 50 * 1024 * 1024; // 50MB

    if (estimatedSizeBytes > maxSizeBytes) {
        throw new ValidationException(
            "Export size exceeds maximum of 50MB. " +
            "Please narrow your filters. " +
            "Estimated: " + (estimatedSizeBytes / 1024 / 1024) + "MB"
        );
    }
}
```

#### 5. CSRF Token Validation

**Implementation:**
```java
@Component
public class CSRFTokenFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {

        if (isStateChangingRequest(request)) {
            String tokenFromHeader = request.getHeader("X-CSRF-Token");
            String tokenFromSession = (String) request.getSession()
                .getAttribute("CSRF_TOKEN");

            if (!isValidToken(tokenFromHeader, tokenFromSession)) {
                response.setStatus(403);
                response.getWriter().write(
                    "{\"error\":\"CSRF_TOKEN_EXPIRED\"}"
                );
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isStateChangingRequest(HttpServletRequest request) {
        String method = request.getMethod();
        return "POST".equals(method) || "PUT".equals(method) ||
               "DELETE".equals(method) || "PATCH".equals(method);
    }
}
```

## Implementation Tasks

### 1. Document API Contract

Create comprehensive security requirements document:

**File:** `/Users/sscoble/Projects/fluo/backend/docs/api-contracts/compliance-api-security.md`

Sections:
- Tenant isolation requirements
- Input validation rules
- Rate limiting policies
- Export size limits
- CSRF token handling
- Error response formats

### 2. Backend Validation Tests

**File:** `/Users/sscoble/Projects/fluo/backend/src/test/java/com/fluo/compliance/ComplianceApiSecurityTest.java`

```java
@SpringBootTest
@AutoConfigureMockMvc
class ComplianceApiSecurityTest {

    @Test
    void shouldRejectCrossTenantAccess() {
        // User from tenant A requests tenant B data
        mockMvc.perform(get("/api/compliance/evidence")
                .param("tenantId", "tenant-b")
                .header("Authorization", "Bearer " + tenantAToken))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("Cannot access other tenant data"));
    }

    @Test
    void shouldRejectInvalidDateRange() {
        mockMvc.perform(get("/api/compliance/evidence")
                .param("tenantId", "tenant-a")
                .param("startDate", "2025-12-31")
                .param("endDate", "2025-01-01"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Start date must be before end date"));
    }

    @Test
    void shouldEnforceExportRateLimit() {
        // First export succeeds
        mockMvc.perform(post("/api/compliance/evidence/export")
                .param("tenantId", "tenant-a"))
            .andExpect(status().isOk());

        // Second export within 60s fails
        mockMvc.perform(post("/api/compliance/evidence/export")
                .param("tenantId", "tenant-a"))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.error").value(containsString("Rate limit")));
    }

    @Test
    void shouldValidateSpanIdFormat() {
        mockMvc.perform(get("/api/compliance/spans/invalid-id")
                .param("tenantId", "tenant-a"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Invalid span ID format"));
    }
}
```

### 3. Integration Tests

Verify frontend + backend security:

**File:** `/Users/sscoble/Projects/fluo/backend/src/test/java/com/fluo/compliance/ComplianceIntegrationTest.java`

Tests:
- Frontend validation matches backend validation
- Error messages are consistent
- Rate limiting works end-to-end
- CSRF token flow works correctly

## Success Criteria

- [ ] API security contract documented
- [ ] All backend validations implemented
- [ ] 100% test coverage on security validations
- [ ] Integration tests verify frontend/backend consistency
- [ ] Security review passes with 10/10 score

## Out of Scope

- Frontend changes (already compliant)
- Performance optimization
- Additional frameworks beyond the 5 supported

## Dependencies

- Spring Security configuration
- Resilience4j rate limiting library
- Database query estimation support

## Timeline

**Week 1:**
- Day 1: Document API contract
- Day 2-3: Implement backend validations
- Day 4: Write security tests
- Day 5: Integration testing and documentation

## Acceptance Criteria

1. All endpoints validate tenant isolation
2. Input validation matches frontend rules exactly
3. Rate limiting enforced server-side
4. Export size limits prevent abuse
5. CSRF tokens validated on state-changing requests
6. Security tests have 100% coverage
7. Documentation complete and reviewed
