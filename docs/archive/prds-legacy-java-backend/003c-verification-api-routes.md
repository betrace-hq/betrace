# PRD-003c: Verification API Routes

**Parent PRD:** PRD-003 (Compliance Span Cryptographic Signing)
**Unit:** C
**Priority:** P0
**Dependencies:** PRD-003a (Core Signature Service)

## Scope

Implement Camel REST API routes for signature verification and associated named processors. This provides external API endpoints for auditors and internal systems to verify compliance span signatures.

## Implementation

### REST Routes

**`backend/src/main/java/com/betrace/routes/ComplianceVerificationRoutes.java`:**
```java
@ApplicationScoped
public class ComplianceVerificationRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // REST API for compliance verification
        rest("/api/compliance")
            .description("Compliance span verification API")
            .produces("application/json")
            .consumes("application/json")

            // Verify single span signature
            .post("/verify/span")
                .description("Verify cryptographic signature of compliance span")
                .to("direct:verifyComplianceSpan")

            // Verify batch of spans
            .post("/verify/batch")
                .description("Verify multiple compliance spans")
                .to("direct:verifyComplianceSpanBatch");

        // Verify single compliance span
        from("direct:verifyComplianceSpan")
            .routeId("verifyComplianceSpan")
            .log("Verifying compliance span signature")
            .process("extractComplianceAttributesProcessor")
            .process("verifySignatureProcessor")
            .marshal().json();

        // Verify batch of compliance spans
        from("direct:verifyComplianceSpanBatch")
            .routeId("verifyComplianceSpanBatch")
            .split(body())
                .to("direct:verifyComplianceSpan")
            .end()
            .aggregate(constant(true), new GroupedBodyAggregationStrategy())
            .completionTimeout(5000)
            .marshal().json();
    }
}
```

### Named Processors

**`backend/src/main/java/com/betrace/processors/compliance/ExtractComplianceAttributesProcessor.java`:**
```java
@Named("extractComplianceAttributesProcessor")
@ApplicationScoped
public class ExtractComplianceAttributesProcessor implements Processor {

    @Inject
    ComplianceSignatureService signatureService;

    private static final Logger log = LoggerFactory.getLogger(ExtractComplianceAttributesProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        ComplianceSpanVerificationRequest request =
            exchange.getIn().getBody(ComplianceSpanVerificationRequest.class);

        if (request == null) {
            throw new IllegalArgumentException("Verification request body is required");
        }

        // Extract attributes (excluding signature)
        Map<String, Object> attributes = signatureService.extractComplianceAttributes(
            request.spanAttributes()
        );

        // Validate tenantId exists
        String tenantIdStr = (String) request.spanAttributes().get("compliance.tenantId");
        if (tenantIdStr == null) {
            throw new IllegalArgumentException("compliance.tenantId is required");
        }

        UUID tenantId = UUID.fromString(tenantIdStr);

        // Store in headers for next processor
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("signature", request.signature());
        exchange.getIn().setHeader("complianceAttributes", attributes);

        log.debug("Extracted compliance attributes for tenant {}", tenantId);
    }
}
```

**`backend/src/main/java/com/betrace/processors/compliance/VerifySignatureProcessor.java`:**
```java
@Named("verifySignatureProcessor")
@ApplicationScoped
public class VerifySignatureProcessor implements Processor {

    @Inject
    ComplianceSignatureService signatureService;

    private static final Logger log = LoggerFactory.getLogger(VerifySignatureProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        String signature = exchange.getIn().getHeader("signature", String.class);
        Map<String, Object> attributes = exchange.getIn().getHeader("complianceAttributes", Map.class);

        if (tenantId == null || signature == null || attributes == null) {
            throw new IllegalArgumentException("Missing required verification data");
        }

        try {
            boolean valid = signatureService.verifySignature(tenantId, attributes, signature);

            VerificationResult result = new VerificationResult(
                valid,
                valid ? "Signature valid" : "Signature invalid or tampered",
                tenantId,
                Instant.now()
            );

            exchange.getIn().setBody(result);
            exchange.getIn().setHeader("signatureValid", valid);

            log.info("Signature verification for tenant {}: {}", tenantId, valid);

        } catch (GeneralSecurityException e) {
            log.error("Signature verification failed for tenant {}", tenantId, e);

            VerificationResult result = new VerificationResult(
                false,
                "Verification error: " + e.getMessage(),
                tenantId,
                Instant.now()
            );

            exchange.getIn().setBody(result);
            exchange.getIn().setHeader("signatureValid", false);
        }
    }
}
```

### Model Classes

**`backend/src/main/java/com/betrace/model/ComplianceSpanVerificationRequest.java`:**
```java
public record ComplianceSpanVerificationRequest(
    Map<String, Object> spanAttributes,
    String signature
) {
    public ComplianceSpanVerificationRequest {
        if (spanAttributes == null || spanAttributes.isEmpty()) {
            throw new IllegalArgumentException("spanAttributes cannot be null or empty");
        }
        if (signature == null || signature.isBlank()) {
            throw new IllegalArgumentException("signature cannot be null or blank");
        }
    }
}
```

**`backend/src/main/java/com/betrace/model/VerificationResult.java`:**
```java
public record VerificationResult(
    boolean valid,
    String message,
    UUID tenantId,
    Instant timestamp
) {}
```

## Success Criteria

- [ ] POST /api/compliance/verify/span endpoint accepts verification requests
- [ ] POST /api/compliance/verify/batch endpoint handles multiple spans
- [ ] Valid signatures return `valid: true` in response
- [ ] Tampered signatures return `valid: false` in response
- [ ] Invalid requests return 400 Bad Request
- [ ] Routes follow ADR-013 (Camel-First) and ADR-014 (Named Processors)
- [ ] Test coverage: 90%+

## Testing Requirements

### Route Configuration Tests

**`backend/src/test/java/com/betrace/routes/ComplianceVerificationRoutesTest.java`:**

```java
@QuarkusTest
class ComplianceVerificationRoutesTest {

    @Inject
    CamelContext camelContext;

    @Test
    @DisplayName("Should configure verification routes correctly")
    void testRoutesConfiguration() throws Exception {
        RouteDefinition verifySpanRoute = camelContext.getRouteDefinition("verifyComplianceSpan");
        RouteDefinition verifyBatchRoute = camelContext.getRouteDefinition("verifyComplianceSpanBatch");

        assertNotNull(verifySpanRoute);
        assertNotNull(verifyBatchRoute);
    }

    @Test
    @DisplayName("Should expose REST endpoints")
    void testRestEndpoints() {
        List<RestDefinition> restDefinitions = camelContext.getRestDefinitions();

        boolean hasVerifyEndpoint = restDefinitions.stream()
            .anyMatch(rest -> rest.getPath().equals("/api/compliance"));

        assertTrue(hasVerifyEndpoint);
    }
}
```

### Processor Unit Tests

**`backend/src/test/java/com/betrace/processors/compliance/ExtractComplianceAttributesProcessorTest.java`:**

```java
@QuarkusTest
class ExtractComplianceAttributesProcessorTest {

    @Inject
    @Named("extractComplianceAttributesProcessor")
    Processor extractProcessor;

    @InjectMock
    ComplianceSignatureService signatureService;

    @Test
    @DisplayName("Should extract compliance attributes from verification request")
    void testExtractAttributes() throws Exception {
        Map<String, Object> spanAttrs = Map.of(
            "compliance.framework", "soc2",
            "compliance.control", "CC6_1",
            "compliance.tenantId", "123e4567-e89b-12d3-a456-426614174000",
            "compliance.signature", "signature-base64",
            "span.name", "test-span" // Non-compliance attribute
        );

        Map<String, Object> extractedAttrs = Map.of(
            "compliance.framework", "soc2",
            "compliance.control", "CC6_1",
            "compliance.tenantId", "123e4567-e89b-12d3-a456-426614174000"
        );

        when(signatureService.extractComplianceAttributes(spanAttrs))
            .thenReturn(extractedAttrs);

        ComplianceSpanVerificationRequest request = new ComplianceSpanVerificationRequest(
            spanAttrs,
            "signature-base64"
        );

        Exchange exchange = createTestExchange();
        exchange.getIn().setBody(request);

        extractProcessor.process(exchange);

        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        String signature = exchange.getIn().getHeader("signature", String.class);
        Map<String, Object> attributes = exchange.getIn().getHeader("complianceAttributes", Map.class);

        assertNotNull(tenantId);
        assertEquals("signature-base64", signature);
        assertEquals(extractedAttrs, attributes);
    }

    @Test
    @DisplayName("Should throw exception when tenantId is missing")
    void testMissingTenantId() {
        Map<String, Object> spanAttrs = Map.of(
            "compliance.framework", "soc2"
            // Missing compliance.tenantId
        );

        ComplianceSpanVerificationRequest request = new ComplianceSpanVerificationRequest(
            spanAttrs,
            "signature"
        );

        Exchange exchange = createTestExchange();
        exchange.getIn().setBody(request);

        assertThrows(IllegalArgumentException.class, () -> {
            extractProcessor.process(exchange);
        });
    }
}
```

**`backend/src/test/java/com/betrace/processors/compliance/VerifySignatureProcessorTest.java`:**

```java
@QuarkusTest
class VerifySignatureProcessorTest {

    @Inject
    @Named("verifySignatureProcessor")
    Processor verifyProcessor;

    @InjectMock
    ComplianceSignatureService signatureService;

    private static final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should verify valid signature")
    void testVerifyValidSignature() throws Exception {
        Map<String, Object> attributes = Map.of("compliance.framework", "soc2");

        when(signatureService.verifySignature(TEST_TENANT_ID, attributes, "valid-signature"))
            .thenReturn(true);

        Exchange exchange = createTestExchange();
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID);
        exchange.getIn().setHeader("signature", "valid-signature");
        exchange.getIn().setHeader("complianceAttributes", attributes);

        verifyProcessor.process(exchange);

        VerificationResult result = exchange.getIn().getBody(VerificationResult.class);
        assertTrue(result.valid());
        assertEquals("Signature valid", result.message());
        assertTrue(exchange.getIn().getHeader("signatureValid", Boolean.class));
    }

    @Test
    @DisplayName("Should reject invalid signature")
    void testVerifyInvalidSignature() throws Exception {
        Map<String, Object> attributes = Map.of("compliance.framework", "soc2");

        when(signatureService.verifySignature(TEST_TENANT_ID, attributes, "invalid-signature"))
            .thenReturn(false);

        Exchange exchange = createTestExchange();
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID);
        exchange.getIn().setHeader("signature", "invalid-signature");
        exchange.getIn().setHeader("complianceAttributes", attributes);

        verifyProcessor.process(exchange);

        VerificationResult result = exchange.getIn().getBody(VerificationResult.class);
        assertFalse(result.valid());
        assertEquals("Signature invalid or tampered", result.message());
    }

    @Test
    @DisplayName("Should handle verification errors gracefully")
    void testVerificationError() throws Exception {
        Map<String, Object> attributes = Map.of("compliance.framework", "soc2");

        when(signatureService.verifySignature(any(), any(), any()))
            .thenThrow(new GeneralSecurityException("Key not found"));

        Exchange exchange = createTestExchange();
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID);
        exchange.getIn().setHeader("signature", "signature");
        exchange.getIn().setHeader("complianceAttributes", attributes);

        verifyProcessor.process(exchange);

        VerificationResult result = exchange.getIn().getBody(VerificationResult.class);
        assertFalse(result.valid());
        assertTrue(result.message().contains("Verification error"));
    }
}
```

### Integration Tests

**`backend/src/test/java/com/betrace/compliance/VerificationApiIntegrationTest.java`:**
```java
@QuarkusTest
class VerificationApiIntegrationTest {

    @Test
    @DisplayName("Should verify span signature via REST API")
    void testVerificationEndpoint() {
        given()
            .contentType(ContentType.JSON)
            .body(createVerificationRequest())
        .when()
            .post("/api/compliance/verify/span")
        .then()
            .statusCode(200)
            .body("valid", equalTo(true));
    }

    @Test
    @DisplayName("Should verify batch of spans")
    void testBatchVerification() {
        given()
            .contentType(ContentType.JSON)
            .body(createBatchVerificationRequest())
        .when()
            .post("/api/compliance/verify/batch")
        .then()
            .statusCode(200)
            .body("size()", equalTo(3));
    }
}
```

## Files to Create

**Routes:**
- `backend/src/main/java/com/betrace/routes/ComplianceVerificationRoutes.java`

**Processors:**
- `backend/src/main/java/com/betrace/processors/compliance/ExtractComplianceAttributesProcessor.java`
- `backend/src/main/java/com/betrace/processors/compliance/VerifySignatureProcessor.java`

**Models:**
- `backend/src/main/java/com/betrace/model/ComplianceSpanVerificationRequest.java`
- `backend/src/main/java/com/betrace/model/VerificationResult.java`

**Tests:**
- `backend/src/test/java/com/betrace/routes/ComplianceVerificationRoutesTest.java`
- `backend/src/test/java/com/betrace/processors/compliance/ExtractComplianceAttributesProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/compliance/VerifySignatureProcessorTest.java`
- `backend/src/test/java/com/betrace/compliance/VerificationApiIntegrationTest.java`

## Files to Modify

None (all new files)

## Implementation Notes

### REST API Design
- POST endpoints (verification requires request body)
- JSON content type for requests and responses
- Standard HTTP status codes (200, 400, 500)

### Error Handling
- Invalid requests return 400 Bad Request
- Verification errors logged and returned in response
- Batch verification continues on individual failures

### Performance
- Batch endpoint processes spans in parallel
- Timeout for batch operations (5 seconds)
- Consider pagination for large batches in future

## Related ADRs

- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - REST DSL and routes
- **[ADR-014: Camel Testing Standards](../adrs/014-camel-testing-and-organization-standards.md)** - Named processors, testing patterns
