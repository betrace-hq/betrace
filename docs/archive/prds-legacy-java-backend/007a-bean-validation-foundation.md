# PRD-007a: Bean Validation Foundation (JSR-380)

**Parent PRD:** PRD-007 (API Input Validation & Rate Limiting)
**Unit:** A
**Priority:** P0
**Dependencies:** None (foundation unit)

## Scope

Implement foundational Bean Validation (JSR-380) annotations for all API request DTOs and integrate with Quarkus validation framework. This unit establishes the validation infrastructure without custom validators or security features.

## Problem

API endpoints accept any input without validation, allowing malformed requests to crash the backend or cause unexpected behavior.

## Solution

### Request DTOs with Bean Validation

**Create validated request DTOs for existing endpoints:**

```java
// Rule creation request
public record CreateRuleRequest(
    @NotBlank(message = "Rule name is required")
    @Size(max = 255, message = "Rule name must not exceed 255 characters")
    String name,

    @NotBlank(message = "Rule expression is required")
    @Size(max = 5000, message = "Rule expression must not exceed 5000 characters")
    String expression,

    @NotNull(message = "Severity is required")
    RuleSeverity severity,

    @NotNull(message = "Tenant ID is required")
    UUID tenantId
) {}

// Signal query request
public record QuerySignalsRequest(
    @NotNull(message = "Tenant ID is required")
    UUID tenantId,

    @Min(value = 1, message = "Page must be at least 1")
    @Max(value = 1000, message = "Page cannot exceed 1000")
    Integer page,

    @Min(value = 1, message = "Page size must be at least 1")
    @Max(value = 100, message = "Page size cannot exceed 100")
    Integer pageSize,

    @Pattern(regexp = "^(CRITICAL|HIGH|MEDIUM|LOW)$", message = "Invalid severity filter")
    String severityFilter
) {}

// Trace ingestion request
public record IngestTracesRequest(
    @NotNull(message = "Tenant ID is required")
    UUID tenantId,

    @NotEmpty(message = "Traces list cannot be empty")
    @Size(max = 1000, message = "Cannot ingest more than 1000 traces at once")
    List<@Valid TraceSpanDTO> traces
) {}

// Trace span DTO
public record TraceSpanDTO(
    @NotBlank(message = "Trace ID is required")
    String traceId,

    @NotBlank(message = "Span ID is required")
    String spanId,

    @NotNull(message = "Timestamp is required")
    Instant timestamp,

    @NotNull(message = "Attributes map is required")
    Map<String, Object> attributes
) {}
```

### Camel Route Integration with Validation

**Update existing Camel routes to use validated DTOs:**

```java
@ApplicationScoped
public class RuleApiRoutes extends RouteBuilder {

    @Override
    public void configure() {
        // Error handler for validation exceptions
        onException(ConstraintViolationException.class)
            .handled(true)
            .process("validationErrorProcessor")
            .marshal().json()
            .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(400));

        // Rule creation endpoint with validation
        rest("/api/rules")
            .post()
            .consumes(MediaType.APPLICATION_JSON)
            .produces(MediaType.APPLICATION_JSON)
            .type(CreateRuleRequest.class)  // Automatic validation
            .to("direct:createRule");

        from("direct:createRule")
            .process("createRuleProcessor")
            .marshal().json();
    }
}
```

### Validation Error Response Processor

**Named processor for standardized validation error responses:**

```java
@Named("validationErrorProcessor")
@ApplicationScoped
public class ValidationErrorProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Throwable cause = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Throwable.class);

        if (cause instanceof ConstraintViolationException cve) {
            ValidationErrorResponse response = new ValidationErrorResponse(
                "Validation failed",
                extractViolations(cve.getConstraintViolations())
            );
            exchange.getIn().setBody(response);
        }
    }

    private List<FieldError> extractViolations(Set<ConstraintViolation<?>> violations) {
        return violations.stream()
            .map(v -> new FieldError(
                v.getPropertyPath().toString(),
                v.getMessage(),
                v.getInvalidValue()
            ))
            .toList();
    }
}

public record ValidationErrorResponse(
    String error,
    List<FieldError> violations
) {}

public record FieldError(
    String field,
    String message,
    Object rejectedValue
) {}
```

## Files to Create

### Request DTOs
- `backend/src/main/java/com/betrace/dto/CreateRuleRequest.java`
- `backend/src/main/java/com/betrace/dto/QuerySignalsRequest.java`
- `backend/src/main/java/com/betrace/dto/IngestTracesRequest.java`
- `backend/src/main/java/com/betrace/dto/TraceSpanDTO.java`
- `backend/src/main/java/com/betrace/dto/UpdateRuleRequest.java`

### Error Handling
- `backend/src/main/java/com/betrace/processors/validation/ValidationErrorProcessor.java`
- `backend/src/main/java/com/betrace/dto/ValidationErrorResponse.java`
- `backend/src/main/java/com/betrace/dto/FieldError.java`

### Tests
- `backend/src/test/java/com/betrace/processors/validation/ValidationErrorProcessorTest.java`
- `backend/src/test/java/com/betrace/dto/CreateRuleRequestTest.java`
- `backend/src/test/java/com/betrace/dto/QuerySignalsRequestTest.java`
- `backend/src/test/java/com/betrace/routes/RuleApiRoutesValidationTest.java`

## Files to Modify

- `backend/src/main/java/com/betrace/routes/RuleApiRoute.java` - Add validation error handling and DTO types
- `backend/src/main/java/com/betrace/routes/SpanApiRoute.java` - Add validation for trace ingestion
- `backend/pom.xml` - Add Bean Validation dependencies (if not already present)

## Success Criteria

- [ ] All API endpoints have validated request DTOs
- [ ] Invalid requests return 400 with detailed field errors
- [ ] Validation error responses follow standard format
- [ ] No invalid data can reach business logic processors
- [ ] Validation covers: null checks, size limits, format constraints
- [ ] Test coverage: 90%+ instruction coverage per ADR-014

## Testing Requirements

### Unit Tests

**Validation Error Processor:**
```java
@Test
@DisplayName("Should format constraint violations into ValidationErrorResponse")
void testValidationErrorProcessorWithViolations() throws Exception {
    // Create mock constraint violations
    Set<ConstraintViolation<?>> violations = createMockViolations();
    ConstraintViolationException exception = new ConstraintViolationException(violations);

    Exchange exchange = new DefaultExchange(new DefaultCamelContext());
    exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);

    validationErrorProcessor.process(exchange);

    ValidationErrorResponse response = exchange.getIn().getBody(ValidationErrorResponse.class);
    assertNotNull(response);
    assertEquals("Validation failed", response.error());
    assertEquals(2, response.violations().size());
}
```

**Request DTO Validation:**
```java
@Test
@DisplayName("Should reject rule creation with blank name")
void testCreateRuleRequestWithBlankName() {
    CreateRuleRequest request = new CreateRuleRequest(
        "",  // blank name
        "valid expression",
        RuleSeverity.HIGH,
        UUID.randomUUID()
    );

    Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);
    assertEquals(1, violations.size());
    assertTrue(violations.stream()
        .anyMatch(v -> v.getMessage().contains("Rule name is required")));
}

@Test
@DisplayName("Should reject rule creation with expression exceeding max length")
void testCreateRuleRequestWithTooLongExpression() {
    String longExpression = "a".repeat(5001);  // Exceeds 5000 limit

    CreateRuleRequest request = new CreateRuleRequest(
        "Valid Name",
        longExpression,
        RuleSeverity.HIGH,
        UUID.randomUUID()
    );

    Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);
    assertTrue(violations.stream()
        .anyMatch(v -> v.getMessage().contains("must not exceed 5000 characters")));
}

@Test
@DisplayName("Should accept valid rule creation request")
void testCreateRuleRequestValid() {
    CreateRuleRequest request = new CreateRuleRequest(
        "Valid Rule",
        "trace.has(error.occurred)",
        RuleSeverity.HIGH,
        UUID.randomUUID()
    );

    Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);
    assertEquals(0, violations.size());
}
```

### Integration Tests

**Route Validation Integration:**
```java
@Test
@DisplayName("Should return 400 for invalid rule creation request via route")
void testRuleCreationRouteRejectsInvalidInput() throws Exception {
    CamelContext context = new DefaultCamelContext();
    context.addRoutes(ruleApiRoutes);

    ProducerTemplate template = context.createProducerTemplate();

    String invalidJson = """
        {
            "name": "",
            "expression": "valid",
            "severity": "HIGH",
            "tenantId": "%s"
        }
        """.formatted(UUID.randomUUID());

    Exchange response = template.request("direct:createRule", exchange -> {
        exchange.getIn().setBody(invalidJson);
        exchange.getIn().setHeader(Exchange.CONTENT_TYPE, MediaType.APPLICATION_JSON);
    });

    assertEquals(400, response.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
    ValidationErrorResponse errorResponse = response.getIn().getBody(ValidationErrorResponse.class);
    assertNotNull(errorResponse);
    assertTrue(errorResponse.violations().stream()
        .anyMatch(v -> v.field().equals("name")));
}
```

## Dependencies

**Maven (pom.xml):**
```xml
<!-- Bean Validation (already included with Quarkus) -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-hibernate-validator</artifactId>
</dependency>

<!-- For testing validation -->
<dependency>
    <groupId>org.hibernate.validator</groupId>
    <artifactId>hibernate-validator</artifactId>
    <scope>test</scope>
</dependency>
```

## Architecture Compliance

- **ADR-013 (Camel-First):** Validation integrated into Camel routes with error handlers
- **ADR-014 (Named Processors):** `ValidationErrorProcessor` extracted as named CDI bean
- **ADR-011 (Pure Application):** No deployment-specific validation logic
- **ADR-015 (Testing Standards):** 90%+ test coverage required

## Notes

- This unit does NOT include custom validators (BeTrace DSL, Trace ID format) - see Unit B
- This unit does NOT include rate limiting - see Unit C
- This unit does NOT include request sanitization - see Unit D
- This unit does NOT include compliance logging - see Unit E
