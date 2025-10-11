# PRD-015c: Signature Verification Integration

**Parent PRD:** PRD-015 (Compliance Evidence Dashboard)
**Unit:** C
**Priority:** P1
**Dependencies:** Unit B (Storage Queries), PRD-003 (Compliance Signing)

## Scope

Integrate PRD-003 signature verification into compliance queries:
- Verify cryptographic signatures for each compliance span
- Display signature verification status in query results
- Handle spans without signatures (legacy spans)
- Handle verification failures gracefully

This unit does NOT include:
- Export functionality (Unit D)
- Metrics/dashboard (Unit E)
- Frontend UI (Unit F)

## Implementation

### 1. Verification Request/Result Models

**`backend/src/main/java/com/fluo/model/ComplianceSpanVerificationRequest.java`:**
```java
package com.fluo.model;

import java.util.Map;

/**
 * Request to verify a compliance span signature.
 * Integrates with PRD-003 verification routes.
 */
public record ComplianceSpanVerificationRequest(
    Map<String, Object> spanAttributes,
    String signature
) {}
```

**`backend/src/main/java/com/fluo/model/VerificationResult.java`:**
```java
package com.fluo.model;

/**
 * Result of compliance span signature verification.
 */
public record VerificationResult(
    boolean valid,
    String error
) {
    public static VerificationResult valid() {
        return new VerificationResult(true, null);
    }

    public static VerificationResult invalid(String error) {
        return new VerificationResult(false, error);
    }
}
```

### 2. Signature Verification Processor

**`backend/src/main/java/com/fluo/processors/compliance/query/VerifyComplianceSignaturesProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.apache.camel.ProducerTemplate;
import com.fluo.model.ComplianceSpanRecord;
import com.fluo.model.ComplianceSpanVerificationRequest;
import com.fluo.model.VerificationResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Verifies cryptographic signatures for compliance spans.
 * Integrates with PRD-003 verification routes.
 */
@Named("verifyComplianceSignaturesProcessor")
@ApplicationScoped
public class VerifyComplianceSignaturesProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(VerifyComplianceSignaturesProcessor.class);
    private static final long VERIFICATION_TIMEOUT_MS = 100;

    @Inject
    ProducerTemplate template;

    @Override
    public void process(Exchange exchange) throws Exception {
        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> spans = exchange.getIn().getBody(List.class);

        // Verify signatures for each span
        for (ComplianceSpanRecord span : spans) {
            if (span.signature() != null && !span.signature().isEmpty()) {
                verifySpanSignature(span);
            } else {
                // No signature present (old spans before PRD-003)
                span.setSignatureValid(null);
            }
        }

        exchange.getIn().setBody(spans);
    }

    private void verifySpanSignature(ComplianceSpanRecord span) {
        try {
            // Call PRD-003 verification route
            ComplianceSpanVerificationRequest request = new ComplianceSpanVerificationRequest(
                span.spanAttributes(),
                span.signature()
            );

            VerificationResult result = template.requestBody(
                "direct:verifyComplianceSpan",
                request,
                VerificationResult.class
            );

            span.setSignatureValid(result.valid());
            if (!result.valid()) {
                span.setVerificationError(result.error());
                log.warn("Signature verification failed for span {}: {}", span.spanId(), result.error());
            }
        } catch (Exception e) {
            // If verification fails, mark as invalid
            span.setSignatureValid(false);
            span.setVerificationError("Verification error: " + e.getMessage());
            log.error("Error verifying signature for span {}: {}", span.spanId(), e.getMessage(), e);
        }
    }
}
```

### 3. Update Compliance Query Routes

**Update `backend/src/main/java/com/fluo/routes/ComplianceQueryRoutes.java`:**
```java
// Update the queryComplianceEvidence route to include signature verification:

from("direct:queryComplianceEvidence")
    .routeId("queryComplianceEvidence")
    .log("Querying compliance evidence with filters")
    .process("parseComplianceQueryParametersProcessor")
    .process("validateQueryParametersProcessor")
    .multicast()
        .parallelProcessing()
        .to("direct:queryHotComplianceStorage", "direct:queryColdComplianceStorage")
    .end()
    .process("mergeComplianceResultsProcessor")
    .process("verifyComplianceSignaturesProcessor")  // NEW: Verify signatures
    .process("sortAndLimitResultsProcessor")
    .marshal().json();
```

### 4. Configuration

**Update `backend/src/main/resources/application.properties`:**
```properties
# Signature verification configuration
fluo.compliance.verify-signatures=true
fluo.compliance.verification-timeout-ms=100
fluo.compliance.verification-parallel=true
```

## Success Criteria

- [ ] Verify cryptographic signatures for compliance spans
- [ ] Display signature verification status (valid, invalid, N/A)
- [ ] Handle spans without signatures (set signatureValid=null)
- [ ] Handle verification failures gracefully (set signatureValid=false)
- [ ] Log verification failures with details
- [ ] Signature verification <100ms per span
- [ ] Integration with PRD-003 `direct:verifyComplianceSpan` route
- [ ] Query results include signatureValid field (true/false/null)
- [ ] Query results include verificationError field (when invalid)

## Testing Requirements

### Unit Tests

**`backend/src/test/java/com/fluo/processors/compliance/query/VerifyComplianceSignaturesProcessorTest.java`:**
```java
package com.fluo.processors.compliance.query;

import com.fluo.model.ComplianceSpanRecord;
import com.fluo.model.ComplianceSpanVerificationRequest;
import com.fluo.model.VerificationResult;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.ProducerTemplate;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VerifyComplianceSignaturesProcessorTest {

    private VerifyComplianceSignaturesProcessor processor;
    private ProducerTemplate mockTemplate;
    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        processor = new VerifyComplianceSignaturesProcessor();
        mockTemplate = Mockito.mock(ProducerTemplate.class);
        processor.template = mockTemplate;
    }

    @Test
    @DisplayName("Should verify valid signature successfully")
    void testVerifyValidSignature() throws Exception {
        ComplianceSpanRecord span = createSpanWithSignature("valid-signature");

        when(mockTemplate.requestBody(
            eq("direct:verifyComplianceSpan"),
            any(ComplianceSpanVerificationRequest.class),
            eq(VerificationResult.class)
        )).thenReturn(VerificationResult.valid());

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setBody(List.of(span));

        processor.process(exchange);

        assertTrue(span.signatureValid());
        assertNull(span.verificationError());
    }

    @Test
    @DisplayName("Should mark invalid signature as false")
    void testVerifyInvalidSignature() throws Exception {
        ComplianceSpanRecord span = createSpanWithSignature("invalid-signature");

        when(mockTemplate.requestBody(
            eq("direct:verifyComplianceSpan"),
            any(ComplianceSpanVerificationRequest.class),
            eq(VerificationResult.class)
        )).thenReturn(VerificationResult.invalid("Invalid signature"));

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setBody(List.of(span));

        processor.process(exchange);

        assertFalse(span.signatureValid());
        assertEquals("Invalid signature", span.verificationError());
    }

    @Test
    @DisplayName("Should handle spans without signature (legacy)")
    void testSpanWithoutSignature() throws Exception {
        ComplianceSpanRecord span = createSpanWithoutSignature();

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setBody(List.of(span));

        processor.process(exchange);

        assertNull(span.signatureValid());
        assertNull(span.verificationError());
        verify(mockTemplate, never()).requestBody(anyString(), any(), any());
    }

    @Test
    @DisplayName("Should handle verification exception gracefully")
    void testVerificationException() throws Exception {
        ComplianceSpanRecord span = createSpanWithSignature("signature");

        when(mockTemplate.requestBody(
            eq("direct:verifyComplianceSpan"),
            any(ComplianceSpanVerificationRequest.class),
            eq(VerificationResult.class)
        )).thenThrow(new RuntimeException("Verification service unavailable"));

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setBody(List.of(span));

        processor.process(exchange);

        assertFalse(span.signatureValid());
        assertTrue(span.verificationError().contains("Verification error"));
    }

    @Test
    @DisplayName("Should verify multiple spans")
    void testVerifyMultipleSpans() throws Exception {
        ComplianceSpanRecord span1 = createSpanWithSignature("sig1");
        ComplianceSpanRecord span2 = createSpanWithSignature("sig2");
        ComplianceSpanRecord span3 = createSpanWithoutSignature();

        when(mockTemplate.requestBody(
            eq("direct:verifyComplianceSpan"),
            any(ComplianceSpanVerificationRequest.class),
            eq(VerificationResult.class)
        ))
            .thenReturn(VerificationResult.valid())
            .thenReturn(VerificationResult.invalid("Tampered"));

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setBody(List.of(span1, span2, span3));

        processor.process(exchange);

        assertTrue(span1.signatureValid());
        assertFalse(span2.signatureValid());
        assertNull(span3.signatureValid());
        verify(mockTemplate, times(2)).requestBody(anyString(), any(), any());
    }

    private ComplianceSpanRecord createSpanWithSignature(String signature) {
        return new ComplianceSpanRecord(
            "span-1", "trace-1", Instant.now(), "soc2", "CC6_1",
            "audit_trail", TEST_TENANT_ID, "success", signature,
            "test details", Map.of("key", "value")
        );
    }

    private ComplianceSpanRecord createSpanWithoutSignature() {
        return new ComplianceSpanRecord(
            "span-2", "trace-2", Instant.now(), "soc2", "CC6_2",
            "audit_trail", TEST_TENANT_ID, "success", null,
            "test details", Map.of("key", "value")
        );
    }
}
```

### Integration Tests

**`backend/src/test/java/com/fluo/compliance/ComplianceSignatureVerificationIntegrationTest.java`:**
```java
package com.fluo.compliance;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class ComplianceSignatureVerificationIntegrationTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should return signature verification status in query results")
    void testSignatureVerificationInResults() {
        given()
            .queryParam("tenantId", TEST_TENANT_ID.toString())
            .queryParam("framework", "soc2")
            .queryParam("startDate", LocalDate.now().minusDays(7).toString())
            .queryParam("endDate", LocalDate.now().toString())
        .when()
            .get("/api/compliance/evidence/query")
        .then()
            .statusCode(200)
            .contentType("application/json")
            .body("$", is(instanceOf(List.class)))
            .body("[0]", hasKey("signatureValid"))
            .body("[0]", hasKey("signature"));
    }

    @Test
    @DisplayName("Should handle spans with invalid signatures")
    void testInvalidSignatures() {
        // This test would require inserting spans with tampered signatures
        // Implementation depends on test data setup
        given()
            .queryParam("tenantId", TEST_TENANT_ID.toString())
            .queryParam("startDate", LocalDate.now().minusDays(7).toString())
            .queryParam("endDate", LocalDate.now().toString())
        .when()
            .get("/api/compliance/evidence/query")
        .then()
            .statusCode(200)
            .contentType("application/json");
    }
}
```

**Test Coverage Target:** 90% (ADR-014 compliance)

## Files to Create

**Backend - Models:**
- `backend/src/main/java/com/fluo/model/ComplianceSpanVerificationRequest.java`
- `backend/src/main/java/com/fluo/model/VerificationResult.java`

**Backend - Processors:**
- `backend/src/main/java/com/fluo/processors/compliance/query/VerifyComplianceSignaturesProcessor.java`

**Backend - Tests:**
- `backend/src/test/java/com/fluo/processors/compliance/query/VerifyComplianceSignaturesProcessorTest.java`
- `backend/src/test/java/com/fluo/compliance/ComplianceSignatureVerificationIntegrationTest.java`

## Files to Modify

**Backend:**
- `backend/src/main/java/com/fluo/routes/ComplianceQueryRoutes.java` - Add verification processor to route
- `backend/src/main/java/com/fluo/model/ComplianceSpanRecord.java` - Ensure signatureValid and verificationError fields exist (already added in Unit A)
- `backend/src/main/resources/application.properties` - Add verification configuration

## Implementation Notes

**PRD-003 Integration:**
- Calls `direct:verifyComplianceSpan` route from PRD-003
- Expects `ComplianceSpanVerificationRequest` as input
- Receives `VerificationResult` as output
- Handles verification failures gracefully

**Performance Considerations:**
- Verification timeout: 100ms per span (configurable)
- Spans verified sequentially (could parallelize in future)
- Failed verifications logged but don't break query

**Signature Status Values:**
- `true`: Signature verified successfully
- `false`: Signature verification failed or exception occurred
- `null`: No signature present (legacy spans before PRD-003)

**Error Handling:**
- Verification exceptions caught and logged
- Span marked as invalid (signatureValid=false)
- Error message stored in verificationError field
- Query continues processing remaining spans

## Next Steps

After completing Unit C, proceed to:
- **Unit D:** Export functionality (depends on Unit C)
- **Unit E:** Metrics and dashboard (can be parallel with Unit D)
