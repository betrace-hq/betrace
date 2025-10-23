# PRD-015d: Export Functionality

**Parent PRD:** PRD-015 (Compliance Evidence Dashboard)
**Unit:** D
**Priority:** P1
**Dependencies:** Unit C (Signature Verification)

## Scope

Build export functionality for compliance evidence:
- Export compliance spans to CSV format
- Export compliance spans to JSON format
- Include signature verification status in exports
- Provide download endpoint for audit reports

This unit does NOT include:
- Metrics/dashboard (Unit E)
- Frontend UI (Unit F)

## Implementation

### 1. Export Request Model

**`backend/src/main/java/com/betrace/model/ComplianceExportRequest.java`:**
```java
package com.betrace.model;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Request for compliance evidence export.
 */
public record ComplianceExportRequest(
    String framework,
    String control,
    UUID tenantId,
    LocalDate startDate,
    LocalDate endDate,
    String format  // "csv" or "json"
) {}
```

### 2. CSV Export Processor

**`backend/src/main/java/com/betrace/processors/compliance/export/FormatComplianceCSVProcessor.java`:**
```java
package com.betrace.processors.compliance.export;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.betrace.model.ComplianceSpanRecord;

import java.util.List;

/**
 * Formats compliance spans as CSV for auditor export.
 */
@Named("formatComplianceCSVProcessor")
@ApplicationScoped
public class FormatComplianceCSVProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> spans = exchange.getIn().getBody(List.class);

        StringBuilder csv = new StringBuilder();

        // CSV header
        csv.append("Timestamp,Framework,Control,Evidence Type,Tenant ID,Outcome,Signature Valid,Trace ID,Span ID,Details\n");

        // CSV rows
        for (ComplianceSpanRecord span : spans) {
            csv.append(formatCSVValue(span.timestamp().toString())).append(",");
            csv.append(formatCSVValue(span.framework())).append(",");
            csv.append(formatCSVValue(span.control())).append(",");
            csv.append(formatCSVValue(span.evidenceType())).append(",");
            csv.append(formatCSVValue(span.tenantId().toString())).append(",");
            csv.append(formatCSVValue(span.outcome())).append(",");
            csv.append(formatCSVValue(formatSignatureStatus(span.signatureValid()))).append(",");
            csv.append(formatCSVValue(span.traceId())).append(",");
            csv.append(formatCSVValue(span.spanId())).append(",");
            csv.append(formatCSVValue(span.details())).append("\n");
        }

        exchange.getIn().setBody(csv.toString());
    }

    private String formatCSVValue(String value) {
        if (value == null) return "";
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private String formatSignatureStatus(Boolean signatureValid) {
        if (signatureValid == null) return "N/A";
        return signatureValid ? "Verified" : "Invalid";
    }
}
```

### 3. Export Request Parser

**`backend/src/main/java/com/betrace/processors/compliance/export/ParseComplianceExportRequestProcessor.java`:**
```java
package com.betrace.processors.compliance.export;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.betrace.model.ComplianceExportRequest;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

/**
 * Parses compliance export request from POST body.
 * Converts to query parameters for reuse of query route.
 */
@Named("parseComplianceExportRequestProcessor")
@ApplicationScoped
public class ParseComplianceExportRequestProcessor implements Processor {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void process(Exchange exchange) throws Exception {
        String body = exchange.getIn().getBody(String.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> request = objectMapper.readValue(body, Map.class);

        // Convert POST body to query parameters for query route
        exchange.getIn().setHeader("framework", request.get("framework"));
        exchange.getIn().setHeader("control", request.get("control"));
        exchange.getIn().setHeader("tenantId", request.get("tenantId"));
        exchange.getIn().setHeader("startDate", request.get("startDate"));
        exchange.getIn().setHeader("endDate", request.get("endDate"));
        exchange.getIn().setHeader("limit", request.getOrDefault("limit", 100000)); // Higher limit for exports
    }
}
```

### 4. Update Compliance Query Routes

**Update `backend/src/main/java/com/betrace/routes/ComplianceQueryRoutes.java`:**
```java
// Add export routes:

// Export compliance evidence to CSV
.post("/evidence/export/csv")
    .description("Export compliance evidence to CSV")
    .to("direct:exportComplianceCSV")

// Export compliance evidence to JSON
.post("/evidence/export/json")
    .description("Export compliance evidence to JSON")
    .to("direct:exportComplianceJSON");

// ... (in configure() method)

// Export to CSV
from("direct:exportComplianceCSV")
    .routeId("exportComplianceCSV")
    .log("Exporting compliance evidence to CSV")
    .process("parseComplianceExportRequestProcessor")
    .to("direct:queryComplianceEvidence")
    .unmarshal().json()
    .process("formatComplianceCSVProcessor")
    .setHeader("Content-Type", constant("text/csv"))
    .setHeader("Content-Disposition", simple("attachment; filename=compliance-evidence-${date:now:yyyyMMdd-HHmmss}.csv"));

// Export to JSON
from("direct:exportComplianceJSON")
    .routeId("exportComplianceJSON")
    .log("Exporting compliance evidence to JSON")
    .process("parseComplianceExportRequestProcessor")
    .to("direct:queryComplianceEvidence")
    .setHeader("Content-Type", constant("application/json"))
    .setHeader("Content-Disposition", simple("attachment; filename=compliance-evidence-${date:now:yyyyMMdd-HHmmss}.json"));
```

### 5. Configuration

**Update `backend/src/main/resources/application.properties`:**
```properties
# Export configuration
betrace.compliance.export.max-spans=100000
betrace.compliance.export.timeout-seconds=60
betrace.compliance.export.default-limit=10000
```

## Success Criteria

- [ ] Export compliance spans to CSV format
- [ ] Export compliance spans to JSON format
- [ ] CSV includes signature verification status (Verified, Invalid, N/A)
- [ ] CSV properly escapes commas, quotes, and newlines
- [ ] JSON includes full compliance span data
- [ ] Export includes Content-Disposition header for download
- [ ] Export filename includes timestamp (YYYYMMDD-HHMMSS)
- [ ] Export response time <10 seconds for 10,000 spans
- [ ] Export handles large result sets (up to 100,000 spans)
- [ ] Export respects query filters (framework, control, date range)

## Testing Requirements

### Unit Tests

**`backend/src/test/java/com/betrace/processors/compliance/export/FormatComplianceCSVProcessorTest.java`:**
```java
package com.betrace.processors.compliance.export;

import com.betrace.model.ComplianceSpanRecord;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class FormatComplianceCSVProcessorTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should format compliance spans as CSV correctly")
    void testFormatCSV() throws Exception {
        FormatComplianceCSVProcessor processor = new FormatComplianceCSVProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        List<ComplianceSpanRecord> spans = List.of(
            createTestSpan("soc2", "CC6_1", "audit_trail", "success", true),
            createTestSpan("hipaa", "164.312(a)", "access_control", "blocked", false),
            createTestSpan("gdpr", "Article 30", "data_processing", "success", null)
        );

        exchange.getIn().setBody(spans);

        processor.process(exchange);

        String csv = exchange.getIn().getBody(String.class);
        assertNotNull(csv);

        // Verify header
        assertTrue(csv.startsWith("Timestamp,Framework,Control,Evidence Type"));

        // Verify data rows
        assertTrue(csv.contains("soc2,CC6_1,audit_trail"));
        assertTrue(csv.contains("hipaa,164.312(a),access_control"));
        assertTrue(csv.contains("gdpr,Article 30,data_processing"));

        // Verify signature status formatting
        assertTrue(csv.contains("Verified"));  // true
        assertTrue(csv.contains("Invalid"));   // false
        assertTrue(csv.contains("N/A"));       // null

        // Verify outcomes
        assertTrue(csv.contains("success"));
        assertTrue(csv.contains("blocked"));
    }

    @Test
    @DisplayName("Should escape CSV special characters")
    void testCSVEscaping() throws Exception {
        FormatComplianceCSVProcessor processor = new FormatComplianceCSVProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        ComplianceSpanRecord span = new ComplianceSpanRecord(
            "span-1", "trace-1", Instant.now(), "soc2", "CC6_1",
            "audit_trail", TEST_TENANT_ID, "success", null,
            "Details with, comma and \"quotes\"", null
        );

        exchange.getIn().setBody(List.of(span));

        processor.process(exchange);

        String csv = exchange.getIn().getBody(String.class);

        // Verify quoted field with escaped quotes
        assertTrue(csv.contains("\"Details with, comma and \"\"quotes\"\"\""));
    }

    @Test
    @DisplayName("Should handle empty span list")
    void testEmptySpanList() throws Exception {
        FormatComplianceCSVProcessor processor = new FormatComplianceCSVProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        exchange.getIn().setBody(List.of());

        processor.process(exchange);

        String csv = exchange.getIn().getBody(String.class);
        assertNotNull(csv);
        assertTrue(csv.startsWith("Timestamp,Framework,Control"));
        assertEquals(1, csv.split("\n").length); // Only header
    }

    private ComplianceSpanRecord createTestSpan(
        String framework, String control, String evidenceType,
        String outcome, Boolean signatureValid
    ) {
        ComplianceSpanRecord span = new ComplianceSpanRecord(
            "span-" + System.nanoTime(),
            "trace-1",
            Instant.now(),
            framework,
            control,
            evidenceType,
            TEST_TENANT_ID,
            outcome,
            signatureValid != null ? "signature-data" : null,
            "Test details",
            null
        );
        span.setSignatureValid(signatureValid);
        return span;
    }
}
```

**`backend/src/test/java/com/betrace/processors/compliance/export/ParseComplianceExportRequestProcessorTest.java`:**
```java
package com.betrace.processors.compliance.export;

import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ParseComplianceExportRequestProcessorTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should parse export request and set headers")
    void testParseExportRequest() throws Exception {
        ParseComplianceExportRequestProcessor processor = new ParseComplianceExportRequestProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        String json = String.format("""
            {
                "framework": "soc2",
                "control": "CC6_1",
                "tenantId": "%s",
                "startDate": "2025-01-01",
                "endDate": "2025-01-31"
            }
            """, TEST_TENANT_ID);

        exchange.getIn().setBody(json);

        processor.process(exchange);

        assertEquals("soc2", exchange.getIn().getHeader("framework"));
        assertEquals("CC6_1", exchange.getIn().getHeader("control"));
        assertEquals(TEST_TENANT_ID.toString(), exchange.getIn().getHeader("tenantId"));
        assertEquals("2025-01-01", exchange.getIn().getHeader("startDate"));
        assertEquals("2025-01-31", exchange.getIn().getHeader("endDate"));
        assertEquals(100000, exchange.getIn().getHeader("limit")); // Export limit
    }
}
```

### Integration Tests

**`backend/src/test/java/com/betrace/compliance/ComplianceExportIntegrationTest.java`:**
```java
package com.betrace.compliance;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class ComplianceExportIntegrationTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should export compliance evidence as CSV")
    void testExportCSV() {
        given()
            .contentType("application/json")
            .body(Map.of(
                "framework", "soc2",
                "control", "CC6_1",
                "tenantId", TEST_TENANT_ID.toString(),
                "startDate", LocalDate.now().minusDays(7).toString(),
                "endDate", LocalDate.now().toString()
            ))
        .when()
            .post("/api/compliance/evidence/export/csv")
        .then()
            .statusCode(200)
            .contentType("text/csv")
            .header("Content-Disposition", containsString("attachment"))
            .header("Content-Disposition", containsString("compliance-evidence"))
            .header("Content-Disposition", containsString(".csv"))
            .body(startsWith("Timestamp,Framework,Control"));
    }

    @Test
    @DisplayName("Should export compliance evidence as JSON")
    void testExportJSON() {
        given()
            .contentType("application/json")
            .body(Map.of(
                "framework", "soc2",
                "tenantId", TEST_TENANT_ID.toString(),
                "startDate", LocalDate.now().minusDays(7).toString(),
                "endDate", LocalDate.now().toString()
            ))
        .when()
            .post("/api/compliance/evidence/export/json")
        .then()
            .statusCode(200)
            .contentType("application/json")
            .header("Content-Disposition", containsString("attachment"))
            .header("Content-Disposition", containsString("compliance-evidence"))
            .header("Content-Disposition", containsString(".json"))
            .body("$", is(instanceOf(List.class)));
    }

    @Test
    @DisplayName("Should include signature verification in CSV export")
    void testSignatureVerificationInCSV() {
        // This test requires test data with signatures
        given()
            .contentType("application/json")
            .body(Map.of(
                "tenantId", TEST_TENANT_ID.toString(),
                "startDate", LocalDate.now().minusDays(7).toString(),
                "endDate", LocalDate.now().toString()
            ))
        .when()
            .post("/api/compliance/evidence/export/csv")
        .then()
            .statusCode(200)
            .contentType("text/csv")
            .body(containsString("Signature Valid"));
    }
}
```

**Test Coverage Target:** 90% (ADR-014 compliance)

## Files to Create

**Backend - Models:**
- `backend/src/main/java/com/betrace/model/ComplianceExportRequest.java`

**Backend - Processors:**
- `backend/src/main/java/com/betrace/processors/compliance/export/FormatComplianceCSVProcessor.java`
- `backend/src/main/java/com/betrace/processors/compliance/export/ParseComplianceExportRequestProcessor.java`

**Backend - Tests:**
- `backend/src/test/java/com/betrace/processors/compliance/export/FormatComplianceCSVProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/compliance/export/ParseComplianceExportRequestProcessorTest.java`
- `backend/src/test/java/com/betrace/compliance/ComplianceExportIntegrationTest.java`

## Files to Modify

**Backend:**
- `backend/src/main/java/com/betrace/routes/ComplianceQueryRoutes.java` - Add CSV and JSON export routes
- `backend/src/main/resources/application.properties` - Add export configuration

## Implementation Notes

**Export Workflow:**
1. Parse export request (POST body)
2. Convert to query parameters
3. Reuse `direct:queryComplianceEvidence` route
4. Unmarshal JSON results
5. Format as CSV or leave as JSON
6. Set Content-Disposition header for download
7. Return file to client

**CSV Format:**
- Header row with column names
- One compliance span per row
- Signature status: "Verified", "Invalid", "N/A"
- Proper escaping of commas, quotes, newlines
- RFC 4180 compliant

**JSON Format:**
- Array of compliance span objects
- Full data structure (no truncation)
- Includes signature verification status
- Standard JSON formatting

**Performance Considerations:**
- Higher limit for exports (100,000 spans vs 1,000 for queries)
- Stream large result sets (future optimization)
- Timeout: 60 seconds for large exports
- Export operations logged for audit trail

**Security:**
- Authenticated requests only
- Tenant isolation enforced
- Export operations audited (TigerBeetle code=8)

## Next Steps

After completing Unit D, proceed to:
- **Unit E:** Metrics and dashboard (can be parallel)
- **Unit F:** Frontend UI (depends on all backend units)
