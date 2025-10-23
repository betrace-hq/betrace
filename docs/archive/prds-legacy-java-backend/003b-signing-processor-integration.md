# PRD-003b: Signing Processor Integration

**Parent PRD:** PRD-003 (Compliance Span Cryptographic Signing)
**Unit:** B
**Priority:** P0
**Dependencies:** PRD-003a (Core Signature Service)

## Scope

Integrate the `ComplianceSignatureService` into the compliance span processing pipeline by creating a Camel processor that automatically signs all compliance spans. This processor will be invoked as part of the span creation flow.

## Implementation

### Signing Processor

**`backend/src/main/java/com/fluo/processors/compliance/SignComplianceSpanProcessor.java`:**
```java
@Named("signComplianceSpanProcessor")
@ApplicationScoped
public class SignComplianceSpanProcessor implements Processor {

    @Inject
    ComplianceSignatureService signatureService;

    private static final Logger log = LoggerFactory.getLogger(SignComplianceSpanProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        ComplianceSpan complianceSpan = exchange.getIn().getBody(ComplianceSpan.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);

        if (tenantId == null) {
            log.error("Missing tenantId header for compliance span signing");
            throw new IllegalArgumentException("tenantId header is required");
        }

        // Extract compliance attributes from span
        Map<String, Object> complianceAttrs = Map.of(
            "compliance.framework", complianceSpan.getFramework(),
            "compliance.control", complianceSpan.getControl(),
            "compliance.evidenceType", complianceSpan.getEvidenceType(),
            "compliance.tenantId", tenantId.toString(),
            "compliance.timestamp", Instant.now().toString(),
            "compliance.operation", complianceSpan.getOperation()
        );

        try {
            // Sign the attributes
            String signature = signatureService.signComplianceData(tenantId, complianceAttrs);

            // Add signature metadata to span
            complianceSpan.setAttribute("compliance.signature", signature);
            complianceSpan.setAttribute("compliance.signature.algorithm", "Ed25519");
            complianceSpan.setAttribute("compliance.signature.version", "v1");

            // Store signed span in exchange
            exchange.getIn().setBody(complianceSpan);
            exchange.getIn().setHeader("signatureGenerated", true);

            log.info("Generated signature for compliance span: {}", complianceSpan.getOperation());

        } catch (GeneralSecurityException e) {
            log.error("Failed to sign compliance span for tenant {}", tenantId, e);
            exchange.getIn().setHeader("signatureGenerated", false);
            throw new SignatureException("Failed to sign compliance span", e);
        }
    }
}
```

## Success Criteria

- [ ] All compliance spans have signatures added automatically
- [ ] Signature metadata stored in span attributes
- [ ] Signing failures logged with errors
- [ ] Exchange headers indicate success/failure
- [ ] Processor does not block span creation on signature failure
- [ ] Test coverage: 90%+

## Testing Requirements

### Unit Tests

**`backend/src/test/java/com/fluo/processors/compliance/SignComplianceSpanProcessorTest.java`:**

```java
@QuarkusTest
class SignComplianceSpanProcessorTest {

    @Inject
    @Named("signComplianceSpanProcessor")
    Processor signComplianceSpanProcessor;

    @InjectMock
    ComplianceSignatureService signatureService;

    private static final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should sign compliance span and add signature attributes")
    void testSignComplianceSpan() throws Exception {
        // Mock signature service
        when(signatureService.signComplianceData(any(UUID.class), anyMap()))
            .thenReturn("mock-signature-base64");

        // Create test span
        ComplianceSpan span = new ComplianceSpan();
        span.setFramework("soc2");
        span.setControl("CC6_1");
        span.setEvidenceType("audit_trail");
        span.setOperation("authorize_user");

        // Create exchange
        Exchange exchange = createTestExchange();
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID);

        // Process
        signComplianceSpanProcessor.process(exchange);

        // Verify signature added
        ComplianceSpan signedSpan = exchange.getIn().getBody(ComplianceSpan.class);
        assertEquals("mock-signature-base64", signedSpan.getAttribute("compliance.signature"));
        assertEquals("Ed25519", signedSpan.getAttribute("compliance.signature.algorithm"));
        assertEquals("v1", signedSpan.getAttribute("compliance.signature.version"));
        assertTrue(exchange.getIn().getHeader("signatureGenerated", Boolean.class));
    }

    @Test
    @DisplayName("Should throw exception when tenantId is missing")
    void testMissingTenantId() {
        ComplianceSpan span = new ComplianceSpan();
        span.setFramework("soc2");

        Exchange exchange = createTestExchange();
        exchange.getIn().setBody(span);
        // No tenantId header

        assertThrows(IllegalArgumentException.class, () -> {
            signComplianceSpanProcessor.process(exchange);
        });
    }

    @Test
    @DisplayName("Should handle signature generation failure")
    void testSignatureFailure() throws Exception {
        when(signatureService.signComplianceData(any(UUID.class), anyMap()))
            .thenThrow(new GeneralSecurityException("Key not found"));

        ComplianceSpan span = new ComplianceSpan();
        span.setFramework("soc2");

        Exchange exchange = createTestExchange();
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID);

        assertThrows(SignatureException.class, () -> {
            signComplianceSpanProcessor.process(exchange);
        });

        assertFalse(exchange.getIn().getHeader("signatureGenerated", Boolean.class));
    }

    @Test
    @DisplayName("Should include all compliance attributes in signature")
    void testSignatureIncludesAllAttributes() throws Exception {
        ArgumentCaptor<Map<String, Object>> attrsCaptor = ArgumentCaptor.forClass(Map.class);

        when(signatureService.signComplianceData(eq(TEST_TENANT_ID), attrsCaptor.capture()))
            .thenReturn("signature");

        ComplianceSpan span = new ComplianceSpan();
        span.setFramework("soc2");
        span.setControl("CC6_1");
        span.setEvidenceType("audit_trail");
        span.setOperation("test_operation");

        Exchange exchange = createTestExchange();
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID);

        signComplianceSpanProcessor.process(exchange);

        Map<String, Object> signedAttrs = attrsCaptor.getValue();
        assertEquals("soc2", signedAttrs.get("compliance.framework"));
        assertEquals("CC6_1", signedAttrs.get("compliance.control"));
        assertEquals("audit_trail", signedAttrs.get("compliance.evidenceType"));
        assertEquals("test_operation", signedAttrs.get("compliance.operation"));
        assertNotNull(signedAttrs.get("compliance.timestamp"));
    }

    private Exchange createTestExchange() {
        CamelContext context = new DefaultCamelContext();
        return new DefaultExchange(context);
    }
}
```

### Integration Tests

**`backend/src/test/java/com/fluo/compliance/SpanSigningIntegrationTest.java`:**
```java
@QuarkusTest
class SpanSigningIntegrationTest {

    @Test
    @DisplayName("Should sign compliance span end-to-end")
    void testEndToEndSpanSigning() {
        // Create compliance span
        // Process through signing pipeline
        // Verify signature exists and is valid
    }

    @Test
    @DisplayName("Should preserve existing span attributes after signing")
    void testAttributePreservation() {
        // Ensure signing doesn't overwrite other attributes
    }
}
```

## Files to Create

**Processor:**
- `backend/src/main/java/com/fluo/processors/compliance/SignComplianceSpanProcessor.java`

**Tests:**
- `backend/src/test/java/com/fluo/processors/compliance/SignComplianceSpanProcessorTest.java`
- `backend/src/test/java/com/fluo/compliance/SpanSigningIntegrationTest.java`

## Files to Modify

**Integration Point:**
- `backend/src/main/java/com/fluo/compliance/telemetry/ComplianceSpanProcessor.java`
  - Add call to `signComplianceSpanProcessor` in span processing pipeline

**Example Integration:**
```java
// In ComplianceSpanProcessor.java
@Inject
@Named("signComplianceSpanProcessor")
Processor signComplianceSpanProcessor;

public void processComplianceSpan(ComplianceSpan span, UUID tenantId) {
    // ... existing span processing ...

    // Sign the span
    Exchange exchange = createExchange();
    exchange.getIn().setBody(span);
    exchange.getIn().setHeader("tenantId", tenantId);

    try {
        signComplianceSpanProcessor.process(exchange);
        ComplianceSpan signedSpan = exchange.getIn().getBody(ComplianceSpan.class);
        // Continue with signed span
    } catch (Exception e) {
        log.error("Failed to sign compliance span", e);
        // Continue without signature (non-blocking)
    }
}
```

## Implementation Notes

### Error Handling
- Signature failures should log errors but not block span creation
- Set `signatureGenerated` header to track success/failure
- Emit metrics for signature failure rate

### Performance
- Signing should be fast (<5ms per span)
- No blocking operations in critical path
- Consider async signing in future optimization

### Compliance Attributes
- Always include: framework, control, evidenceType, operation
- Include tenantId for tenant isolation
- Include timestamp to prevent replay attacks

## Related ADRs

- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - Processor pattern
- **[ADR-014: Camel Testing Standards](../adrs/014-camel-testing-and-organization-standards.md)** - Named processors, 90% coverage
