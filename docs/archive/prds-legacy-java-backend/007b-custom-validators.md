# PRD-007b: Custom Validators (BeTrace DSL, Trace ID, Tenant ID)

**Parent PRD:** PRD-007 (API Input Validation & Rate Limiting)
**Unit:** B
**Priority:** P0
**Dependencies:** Unit A (Bean Validation Foundation)

## Scope

Implement custom Bean Validation validators for BeTrace-specific data formats: DSL syntax, Trace IDs, Span IDs, and Tenant IDs. These validators ensure domain-specific correctness beyond standard JSR-380 constraints.

## Problem

Standard Bean Validation cannot validate:
- BeTrace DSL syntax correctness (rules must be valid before storage)
- OpenTelemetry Trace ID format (32-char hex)
- OpenTelemetry Span ID format (16-char hex)
- Tenant ID UUID format and existence

## Solution

### Custom Validation Annotations

```java
// BeTrace DSL syntax validator
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = BeTraceDslValidator.class)
public @interface ValidBeTraceDsl {
    String message() default "Invalid BeTrace DSL syntax";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

// Trace ID format validator
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = TraceIdValidator.class)
public @interface ValidTraceId {
    String message() default "Invalid Trace ID format (must be 32-character hex)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

// Span ID format validator
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = SpanIdValidator.class)
public @interface ValidSpanId {
    String message() default "Invalid Span ID format (must be 16-character hex)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

// Tenant existence validator (checks if tenant exists in TigerBeetle)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = TenantExistsValidator.class)
public @interface TenantExists {
    String message() default "Tenant does not exist";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

### Validator Implementations

**BeTrace DSL Syntax Validator:**
```java
@ApplicationScoped
public class BeTraceDslValidator implements ConstraintValidator<ValidBeTraceDsl, String> {

    @Inject
    BeTraceDslParser dslParser;

    @Override
    public boolean isValid(String expression, ConstraintValidatorContext context) {
        if (expression == null || expression.isBlank()) {
            return true;  // @NotBlank handles this
        }

        try {
            dslParser.parse(expression);
            return true;
        } catch (ParseError e) {
            // Customize error message with parse error details
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Invalid BeTrace DSL: " + e.getMessage() + " at position " + e.getPosition()
            ).addConstraintViolation();
            return false;
        }
    }
}
```

**Trace ID Format Validator:**
```java
@ApplicationScoped
public class TraceIdValidator implements ConstraintValidator<ValidTraceId, String> {

    private static final Pattern TRACE_ID_PATTERN = Pattern.compile("^[a-f0-9]{32}$");

    @Override
    public boolean isValid(String traceId, ConstraintValidatorContext context) {
        if (traceId == null || traceId.isBlank()) {
            return true;  // @NotBlank handles this
        }

        boolean valid = TRACE_ID_PATTERN.matcher(traceId.toLowerCase()).matches();

        if (!valid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Trace ID must be 32-character hexadecimal (OpenTelemetry format). Got: " + traceId
            ).addConstraintViolation();
        }

        return valid;
    }
}
```

**Span ID Format Validator:**
```java
@ApplicationScoped
public class SpanIdValidator implements ConstraintValidator<ValidSpanId, String> {

    private static final Pattern SPAN_ID_PATTERN = Pattern.compile("^[a-f0-9]{16}$");

    @Override
    public boolean isValid(String spanId, ConstraintValidatorContext context) {
        if (spanId == null || spanId.isBlank()) {
            return true;  // @NotBlank handles this
        }

        boolean valid = SPAN_ID_PATTERN.matcher(spanId.toLowerCase()).matches();

        if (!valid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Span ID must be 16-character hexadecimal (OpenTelemetry format). Got: " + spanId
            ).addConstraintViolation();
        }

        return valid;
    }
}
```

**Tenant Existence Validator:**
```java
@ApplicationScoped
public class TenantExistsValidator implements ConstraintValidator<TenantExists, UUID> {

    @Inject
    TenantService tenantService;

    @Override
    public boolean isValid(UUID tenantId, ConstraintValidatorContext context) {
        if (tenantId == null) {
            return true;  // @NotNull handles this
        }

        boolean exists = tenantService.exists(tenantId);

        if (!exists) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Tenant with ID " + tenantId + " does not exist"
            ).addConstraintViolation();
        }

        return exists;
    }
}
```

### Updated Request DTOs with Custom Validators

```java
// Rule creation with DSL validation
public record CreateRuleRequest(
    @NotBlank(message = "Rule name is required")
    @Size(max = 255, message = "Rule name must not exceed 255 characters")
    String name,

    @NotBlank(message = "Rule expression is required")
    @Size(max = 5000, message = "Rule expression must not exceed 5000 characters")
    @ValidBeTraceDsl  // Custom validator
    String expression,

    @NotNull(message = "Severity is required")
    RuleSeverity severity,

    @NotNull(message = "Tenant ID is required")
    @TenantExists  // Custom validator
    UUID tenantId
) {}

// Trace span with Trace ID and Span ID validation
public record TraceSpanDTO(
    @NotBlank(message = "Trace ID is required")
    @ValidTraceId  // Custom validator
    String traceId,

    @NotBlank(message = "Span ID is required")
    @ValidSpanId  // Custom validator
    String spanId,

    @NotNull(message = "Timestamp is required")
    Instant timestamp,

    @NotNull(message = "Attributes map is required")
    Map<String, Object> attributes
) {}
```

## Files to Create

### Validation Annotations
- `backend/src/main/java/com/betrace/validation/ValidBeTraceDsl.java`
- `backend/src/main/java/com/betrace/validation/ValidTraceId.java`
- `backend/src/main/java/com/betrace/validation/ValidSpanId.java`
- `backend/src/main/java/com/betrace/validation/TenantExists.java`

### Validator Implementations
- `backend/src/main/java/com/betrace/validation/BeTraceDslValidator.java`
- `backend/src/main/java/com/betrace/validation/TraceIdValidator.java`
- `backend/src/main/java/com/betrace/validation/SpanIdValidator.java`
- `backend/src/main/java/com/betrace/validation/TenantExistsValidator.java`

### Tests
- `backend/src/test/java/com/betrace/validation/BeTraceDslValidatorTest.java`
- `backend/src/test/java/com/betrace/validation/TraceIdValidatorTest.java`
- `backend/src/test/java/com/betrace/validation/SpanIdValidatorTest.java`
- `backend/src/test/java/com/betrace/validation/TenantExistsValidatorTest.java`
- `backend/src/test/java/com/betrace/dto/CreateRuleRequestCustomValidationTest.java`
- `backend/src/test/java/com/betrace/dto/TraceSpanDTOCustomValidationTest.java`

## Files to Modify

- `backend/src/main/java/com/betrace/dto/CreateRuleRequest.java` - Add `@ValidBeTraceDsl` and `@TenantExists`
- `backend/src/main/java/com/betrace/dto/TraceSpanDTO.java` - Add `@ValidTraceId` and `@ValidSpanId`
- `backend/src/main/java/com/betrace/services/TenantService.java` - Add `exists(UUID tenantId)` method

## Success Criteria

- [ ] BeTrace DSL syntax validated before rule creation
- [ ] Invalid DSL syntax returns detailed parse error with position
- [ ] Trace IDs validated against OpenTelemetry 32-char hex format
- [ ] Span IDs validated against OpenTelemetry 16-char hex format
- [ ] Tenant existence checked before accepting requests
- [ ] Non-existent tenant IDs rejected with 400 response
- [ ] Test coverage: 90%+ instruction coverage per ADR-014

## Testing Requirements

### Unit Tests

**BeTrace DSL Validator:**
```java
@Test
@DisplayName("Should accept valid BeTrace DSL expression")
void testValidBeTraceDslExpression() {
    BeTraceDslValidator validator = new BeTraceDslValidator();
    validator.dslParser = new BeTraceDslParser();

    boolean valid = validator.isValid("trace.has(error.occurred)", mockContext);

    assertTrue(valid);
    verify(mockContext, never()).buildConstraintViolationWithTemplate(any());
}

@Test
@DisplayName("Should reject invalid BeTrace DSL with detailed error")
void testInvalidBeTraceDslExpression() {
    BeTraceDslValidator validator = new BeTraceDslValidator();
    validator.dslParser = new BeTraceDslParser();

    boolean valid = validator.isValid("trace.has(unclosed_paren", mockContext);

    assertFalse(valid);
    verify(mockContext).buildConstraintViolationWithTemplate(
        argThat(msg -> msg.contains("position"))
    );
}

@Test
@DisplayName("Should handle null DSL expression gracefully")
void testNullBeTraceDslExpression() {
    BeTraceDslValidator validator = new BeTraceDslValidator();

    boolean valid = validator.isValid(null, mockContext);

    assertTrue(valid);  // @NotBlank handles null check
}
```

**Trace ID Validator:**
```java
@Test
@DisplayName("Should accept valid 32-character hex Trace ID")
void testValidTraceId() {
    TraceIdValidator validator = new TraceIdValidator();

    boolean valid = validator.isValid("a1b2c3d4e5f6789012345678901234ab", mockContext);

    assertTrue(valid);
}

@Test
@DisplayName("Should reject Trace ID with invalid length")
void testInvalidTraceIdLength() {
    TraceIdValidator validator = new TraceIdValidator();

    boolean valid = validator.isValid("abc123", mockContext);

    assertFalse(valid);
    verify(mockContext).buildConstraintViolationWithTemplate(
        argThat(msg -> msg.contains("32-character hexadecimal"))
    );
}

@Test
@DisplayName("Should reject Trace ID with non-hex characters")
void testInvalidTraceIdCharacters() {
    TraceIdValidator validator = new TraceIdValidator();

    boolean valid = validator.isValid("g1b2c3d4e5f6789012345678901234ab", mockContext);

    assertFalse(valid);
}

@Test
@DisplayName("Should accept Trace ID with uppercase hex characters")
void testTraceIdCaseInsensitive() {
    TraceIdValidator validator = new TraceIdValidator();

    boolean valid = validator.isValid("A1B2C3D4E5F6789012345678901234AB", mockContext);

    assertTrue(valid);
}
```

**Span ID Validator:**
```java
@Test
@DisplayName("Should accept valid 16-character hex Span ID")
void testValidSpanId() {
    SpanIdValidator validator = new SpanIdValidator();

    boolean valid = validator.isValid("a1b2c3d4e5f67890", mockContext);

    assertTrue(valid);
}

@Test
@DisplayName("Should reject Span ID with invalid length")
void testInvalidSpanIdLength() {
    SpanIdValidator validator = new SpanIdValidator();

    boolean valid = validator.isValid("abc123", mockContext);

    assertFalse(valid);
}
```

**Tenant Exists Validator:**
```java
@Test
@DisplayName("Should accept valid existing tenant ID")
void testExistingTenant() {
    UUID tenantId = UUID.randomUUID();
    when(mockTenantService.exists(tenantId)).thenReturn(true);

    TenantExistsValidator validator = new TenantExistsValidator();
    validator.tenantService = mockTenantService;

    boolean valid = validator.isValid(tenantId, mockContext);

    assertTrue(valid);
    verify(mockTenantService).exists(tenantId);
}

@Test
@DisplayName("Should reject non-existent tenant ID")
void testNonExistentTenant() {
    UUID tenantId = UUID.randomUUID();
    when(mockTenantService.exists(tenantId)).thenReturn(false);

    TenantExistsValidator validator = new TenantExistsValidator();
    validator.tenantService = mockTenantService;

    boolean valid = validator.isValid(tenantId, mockContext);

    assertFalse(valid);
    verify(mockContext).buildConstraintViolationWithTemplate(
        argThat(msg -> msg.contains("does not exist"))
    );
}
```

### Integration Tests

**End-to-End Validation with Routes:**
```java
@Test
@DisplayName("Should reject rule creation with invalid DSL syntax")
void testRuleCreationRejectsInvalidDsl() throws Exception {
    String invalidDslJson = """
        {
            "name": "Invalid Rule",
            "expression": "trace.has(unclosed_paren",
            "severity": "HIGH",
            "tenantId": "%s"
        }
        """.formatted(existingTenantId);

    Exchange response = template.request("direct:createRule", exchange -> {
        exchange.getIn().setBody(invalidDslJson);
    });

    assertEquals(400, response.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
    ValidationErrorResponse errorResponse = response.getIn().getBody(ValidationErrorResponse.class);
    assertTrue(errorResponse.violations().stream()
        .anyMatch(v -> v.field().equals("expression") && v.message().contains("Invalid BeTrace DSL")));
}

@Test
@DisplayName("Should reject trace ingestion with invalid Trace ID format")
void testTraceIngestionRejectsInvalidTraceId() throws Exception {
    String invalidTraceJson = """
        {
            "tenantId": "%s",
            "traces": [
                {
                    "traceId": "invalid-trace-id",
                    "spanId": "a1b2c3d4e5f67890",
                    "timestamp": "2025-01-15T10:00:00Z",
                    "attributes": {}
                }
            ]
        }
        """.formatted(existingTenantId);

    Exchange response = template.request("direct:ingestTraces", exchange -> {
        exchange.getIn().setBody(invalidTraceJson);
    });

    assertEquals(400, response.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
    ValidationErrorResponse errorResponse = response.getIn().getBody(ValidationErrorResponse.class);
    assertTrue(errorResponse.violations().stream()
        .anyMatch(v -> v.field().contains("traceId")));
}
```

## Architecture Compliance

- **ADR-013 (Camel-First):** Validators integrate seamlessly with Camel route validation
- **ADR-014 (Named Processors):** Validators are CDI beans with testability
- **ADR-011 (Pure Application):** No deployment-specific validation logic
- **ADR-015 (Testing Standards):** 90%+ test coverage with unit and integration tests

## Notes

- Validators depend on existing BeTrace components (BeTraceDslParser, TenantService)
- TenantService.exists() must be efficient (cached or fast lookup from TigerBeetle)
- Custom validators provide detailed error messages for better developer experience
- This unit does NOT include rate limiting (see Unit C) or request sanitization (see Unit D)
