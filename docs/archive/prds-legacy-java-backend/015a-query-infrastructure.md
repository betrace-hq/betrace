# PRD-015a: Compliance Query Infrastructure

**Parent PRD:** PRD-015 (Compliance Evidence Dashboard)
**Unit:** A
**Priority:** P1
**Dependencies:** None (Foundation unit)

## Scope

Build the foundational query infrastructure for compliance evidence:
- Camel REST routes for compliance queries
- Query parameter parsing and validation processors
- Query filter model and request/response models
- Basic route configuration and error handling

This unit does NOT include:
- Storage queries (Unit B)
- Signature verification (Unit C)
- Export functionality (Unit D)
- Metrics/dashboard (Unit E)
- Frontend UI (Unit F)

## Implementation

### 1. Compliance Query Routes (Camel REST DSL)

**`backend/src/main/java/com/betrace/routes/ComplianceQueryRoutes.java`:**
```java
package com.betrace.routes;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestParamType;

/**
 * Camel REST routes for compliance evidence queries.
 * Foundation for PRD-015 compliance dashboard.
 */
@ApplicationScoped
public class ComplianceQueryRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // REST API for compliance evidence queries
        rest("/api/compliance")
            .description("Compliance evidence query API")
            .produces("application/json")
            .consumes("application/json")

            // Query compliance spans by filters
            .get("/evidence/query")
                .description("Query compliance spans with filters")
                .param().name("framework").type(RestParamType.query).description("Framework: soc2, hipaa, gdpr")
                    .defaultValue("").endParam()
                .param().name("control").type(RestParamType.query).description("Control ID: CC6_1, CC6_2, etc.")
                    .defaultValue("").endParam()
                .param().name("tenantId").type(RestParamType.query).description("Tenant UUID").required(true).endParam()
                .param().name("startDate").type(RestParamType.query).description("Start date (ISO-8601)")
                    .defaultValue("").endParam()
                .param().name("endDate").type(RestParamType.query).description("End date (ISO-8601)")
                    .defaultValue("").endParam()
                .param().name("limit").type(RestParamType.query).description("Result limit").defaultValue("100").endParam()
                .to("direct:queryComplianceEvidence");

        // Query compliance evidence (placeholder for storage queries in Unit B)
        from("direct:queryComplianceEvidence")
            .routeId("queryComplianceEvidence")
            .log("Querying compliance evidence with filters")
            .process("parseComplianceQueryParametersProcessor")
            .process("validateQueryParametersProcessor")
            // Storage queries will be added in Unit B
            .setBody(constant(java.util.List.of())) // Placeholder empty response
            .marshal().json();
    }
}
```

### 2. Query Parameter Parsing Processor

**`backend/src/main/java/com/betrace/processors/compliance/query/ParseComplianceQueryParametersProcessor.java`:**
```java
package com.betrace.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.betrace.model.ComplianceQueryFilter;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Parses and validates compliance query parameters from HTTP request.
 */
@Named("parseComplianceQueryParametersProcessor")
@ApplicationScoped
public class ParseComplianceQueryParametersProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        String framework = exchange.getIn().getHeader("framework", String.class);
        String control = exchange.getIn().getHeader("control", String.class);
        String tenantIdStr = exchange.getIn().getHeader("tenantId", String.class);
        String startDateStr = exchange.getIn().getHeader("startDate", String.class);
        String endDateStr = exchange.getIn().getHeader("endDate", String.class);
        Integer limit = exchange.getIn().getHeader("limit", Integer.class);

        // Parse tenant ID
        UUID tenantId = UUID.fromString(tenantIdStr);

        // Parse date range (default to last 7 days)
        LocalDate startDate = startDateStr != null && !startDateStr.isEmpty()
            ? LocalDate.parse(startDateStr)
            : LocalDate.now().minusDays(7);

        LocalDate endDate = endDateStr != null && !endDateStr.isEmpty()
            ? LocalDate.parse(endDateStr)
            : LocalDate.now();

        // Build query filter
        ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
            .framework(framework != null && !framework.isEmpty() ? framework : null)
            .control(control != null && !control.isEmpty() ? control : null)
            .tenantId(tenantId)
            .startDate(startDate)
            .endDate(endDate)
            .limit(limit != null ? limit : 100)
            .build();

        exchange.getIn().setHeader("queryFilter", filter);
        exchange.getIn().setBody(filter);
    }
}
```

### 3. Query Validation Processor

**`backend/src/main/java/com/betrace/processors/compliance/query/ValidateQueryParametersProcessor.java`:**
```java
package com.betrace.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.betrace.model.ComplianceQueryFilter;
import java.time.LocalDate;

/**
 * Validates compliance query parameters.
 */
@Named("validateQueryParametersProcessor")
@ApplicationScoped
public class ValidateQueryParametersProcessor implements Processor {

    private static final int MAX_LIMIT = 1000;
    private static final int MAX_DATE_RANGE_DAYS = 365;

    @Override
    public void process(Exchange exchange) throws Exception {
        ComplianceQueryFilter filter = exchange.getIn().getBody(ComplianceQueryFilter.class);

        // Validate limit
        if (filter.limit() < 1 || filter.limit() > MAX_LIMIT) {
            throw new IllegalArgumentException(
                "Limit must be between 1 and " + MAX_LIMIT + ", got: " + filter.limit()
            );
        }

        // Validate date range
        if (filter.startDate().isAfter(filter.endDate())) {
            throw new IllegalArgumentException(
                "Start date must be before end date. Got start=" + filter.startDate() +
                ", end=" + filter.endDate()
            );
        }

        long daysBetween = java.time.temporal.ChronoUnit.DAYS.between(filter.startDate(), filter.endDate());
        if (daysBetween > MAX_DATE_RANGE_DAYS) {
            throw new IllegalArgumentException(
                "Date range cannot exceed " + MAX_DATE_RANGE_DAYS + " days. Got " + daysBetween + " days"
            );
        }

        // Validate framework (if specified)
        if (filter.framework() != null) {
            String fw = filter.framework().toLowerCase();
            if (!isValidFramework(fw)) {
                throw new IllegalArgumentException(
                    "Invalid framework: " + fw + ". Valid: soc2, hipaa, gdpr, fedramp, iso27001, pci-dss"
                );
            }
        }

        // Validation passed, continue
    }

    private boolean isValidFramework(String framework) {
        return java.util.Set.of("soc2", "hipaa", "gdpr", "fedramp", "iso27001", "pci-dss")
            .contains(framework);
    }
}
```

### 4. Query Filter Model

**`backend/src/main/java/com/betrace/model/ComplianceQueryFilter.java`:**
```java
package com.betrace.model;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Query filter for compliance evidence queries.
 */
public record ComplianceQueryFilter(
    String framework,      // null = all frameworks
    String control,        // null = all controls
    UUID tenantId,
    LocalDate startDate,
    LocalDate endDate,
    int limit
) {
    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String framework;
        private String control;
        private UUID tenantId;
        private LocalDate startDate;
        private LocalDate endDate;
        private int limit = 100;

        public Builder framework(String framework) {
            this.framework = framework;
            return this;
        }

        public Builder control(String control) {
            this.control = control;
            return this;
        }

        public Builder tenantId(UUID tenantId) {
            this.tenantId = tenantId;
            return this;
        }

        public Builder startDate(LocalDate startDate) {
            this.startDate = startDate;
            return this;
        }

        public Builder endDate(LocalDate endDate) {
            this.endDate = endDate;
            return this;
        }

        public Builder limit(int limit) {
            this.limit = limit;
            return this;
        }

        public ComplianceQueryFilter build() {
            return new ComplianceQueryFilter(framework, control, tenantId, startDate, endDate, limit);
        }
    }
}
```

### 5. Compliance Span Record Model

**`backend/src/main/java/com/betrace/model/ComplianceSpanRecord.java`:**
```java
package com.betrace.model;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Compliance span record returned from queries.
 */
public class ComplianceSpanRecord {
    private String spanId;
    private String traceId;
    private Instant timestamp;
    private String framework;
    private String control;
    private String evidenceType;
    private UUID tenantId;
    private String outcome;
    private Boolean signatureValid;  // null = no signature, true/false = verified
    private String signature;
    private String verificationError;
    private String details;
    private Map<String, Object> spanAttributes;

    // Constructors
    public ComplianceSpanRecord() {}

    public ComplianceSpanRecord(String spanId, String traceId, Instant timestamp,
                                String framework, String control, String evidenceType,
                                UUID tenantId, String outcome, String signature,
                                String details, Map<String, Object> spanAttributes) {
        this.spanId = spanId;
        this.traceId = traceId;
        this.timestamp = timestamp;
        this.framework = framework;
        this.control = control;
        this.evidenceType = evidenceType;
        this.tenantId = tenantId;
        this.outcome = outcome;
        this.signature = signature;
        this.details = details;
        this.spanAttributes = spanAttributes;
    }

    // Getters and setters
    public String spanId() { return spanId; }
    public String traceId() { return traceId; }
    public Instant timestamp() { return timestamp; }
    public String framework() { return framework; }
    public String control() { return control; }
    public String evidenceType() { return evidenceType; }
    public UUID tenantId() { return tenantId; }
    public String outcome() { return outcome; }
    public Boolean signatureValid() { return signatureValid; }
    public String signature() { return signature; }
    public String verificationError() { return verificationError; }
    public String details() { return details; }
    public Map<String, Object> spanAttributes() { return spanAttributes; }

    public void setSignatureValid(Boolean signatureValid) {
        this.signatureValid = signatureValid;
    }

    public void setVerificationError(String verificationError) {
        this.verificationError = verificationError;
    }
}
```

## Success Criteria

- [ ] Camel REST route `/api/compliance/evidence/query` responds with 200 OK
- [ ] Query parameters parsed correctly (framework, control, tenantId, dates, limit)
- [ ] Default values applied (last 7 days, limit 100)
- [ ] Invalid parameters return 400 Bad Request with clear error messages
- [ ] Date range validation (max 365 days)
- [ ] Limit validation (1-1000)
- [ ] Framework validation (only valid frameworks accepted)
- [ ] Tenant ID UUID validation
- [ ] Query filter model correctly built from parameters

## Testing Requirements

### Unit Tests

**`backend/src/test/java/com/betrace/processors/compliance/query/ParseComplianceQueryParametersProcessorTest.java`:**
```java
package com.betrace.processors.compliance.query;

import com.betrace.model.ComplianceQueryFilter;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ParseComplianceQueryParametersProcessorTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should parse all query parameters correctly")
    void testParseAllParameters() throws Exception {
        ParseComplianceQueryParametersProcessor processor = new ParseComplianceQueryParametersProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        exchange.getIn().setHeader("framework", "soc2");
        exchange.getIn().setHeader("control", "CC6_1");
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID.toString());
        exchange.getIn().setHeader("startDate", "2025-01-01");
        exchange.getIn().setHeader("endDate", "2025-01-31");
        exchange.getIn().setHeader("limit", 100);

        processor.process(exchange);

        ComplianceQueryFilter filter = exchange.getIn().getHeader("queryFilter", ComplianceQueryFilter.class);
        assertNotNull(filter);
        assertEquals("soc2", filter.framework());
        assertEquals("CC6_1", filter.control());
        assertEquals(TEST_TENANT_ID, filter.tenantId());
        assertEquals(LocalDate.of(2025, 1, 1), filter.startDate());
        assertEquals(LocalDate.of(2025, 1, 31), filter.endDate());
        assertEquals(100, filter.limit());
    }

    @Test
    @DisplayName("Should apply default values when parameters missing")
    void testDefaultValues() throws Exception {
        ParseComplianceQueryParametersProcessor processor = new ParseComplianceQueryParametersProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID.toString());

        processor.process(exchange);

        ComplianceQueryFilter filter = exchange.getIn().getBody(ComplianceQueryFilter.class);
        assertNotNull(filter);
        assertNull(filter.framework());
        assertNull(filter.control());
        assertEquals(LocalDate.now().minusDays(7), filter.startDate());
        assertEquals(LocalDate.now(), filter.endDate());
        assertEquals(100, filter.limit());
    }

    @Test
    @DisplayName("Should throw exception for invalid tenant UUID")
    void testInvalidTenantId() {
        ParseComplianceQueryParametersProcessor processor = new ParseComplianceQueryParametersProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        exchange.getIn().setHeader("tenantId", "invalid-uuid");

        assertThrows(IllegalArgumentException.class, () -> processor.process(exchange));
    }
}
```

**`backend/src/test/java/com/betrace/processors/compliance/query/ValidateQueryParametersProcessorTest.java`:**
```java
package com.betrace.processors.compliance.query;

import com.betrace.model.ComplianceQueryFilter;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ValidateQueryParametersProcessorTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should validate valid query parameters")
    void testValidParameters() throws Exception {
        ValidateQueryParametersProcessor processor = new ValidateQueryParametersProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
            .framework("soc2")
            .control("CC6_1")
            .tenantId(TEST_TENANT_ID)
            .startDate(LocalDate.now().minusDays(30))
            .endDate(LocalDate.now())
            .limit(100)
            .build();

        exchange.getIn().setBody(filter);

        assertDoesNotThrow(() -> processor.process(exchange));
    }

    @Test
    @DisplayName("Should reject limit > 1000")
    void testLimitTooHigh() {
        ValidateQueryParametersProcessor processor = new ValidateQueryParametersProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
            .tenantId(TEST_TENANT_ID)
            .startDate(LocalDate.now().minusDays(7))
            .endDate(LocalDate.now())
            .limit(1001)
            .build();

        exchange.getIn().setBody(filter);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> processor.process(exchange));
        assertTrue(ex.getMessage().contains("Limit must be between"));
    }

    @Test
    @DisplayName("Should reject date range > 365 days")
    void testDateRangeTooLarge() {
        ValidateQueryParametersProcessor processor = new ValidateQueryParametersProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
            .tenantId(TEST_TENANT_ID)
            .startDate(LocalDate.now().minusDays(400))
            .endDate(LocalDate.now())
            .limit(100)
            .build();

        exchange.getIn().setBody(filter);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> processor.process(exchange));
        assertTrue(ex.getMessage().contains("Date range cannot exceed"));
    }

    @Test
    @DisplayName("Should reject startDate > endDate")
    void testInvalidDateOrder() {
        ValidateQueryParametersProcessor processor = new ValidateQueryParametersProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
            .tenantId(TEST_TENANT_ID)
            .startDate(LocalDate.now())
            .endDate(LocalDate.now().minusDays(7))
            .limit(100)
            .build();

        exchange.getIn().setBody(filter);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> processor.process(exchange));
        assertTrue(ex.getMessage().contains("Start date must be before end date"));
    }

    @Test
    @DisplayName("Should reject invalid framework")
    void testInvalidFramework() {
        ValidateQueryParametersProcessor processor = new ValidateQueryParametersProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
            .framework("invalid-framework")
            .tenantId(TEST_TENANT_ID)
            .startDate(LocalDate.now().minusDays(7))
            .endDate(LocalDate.now())
            .limit(100)
            .build();

        exchange.getIn().setBody(filter);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> processor.process(exchange));
        assertTrue(ex.getMessage().contains("Invalid framework"));
    }
}
```

### Integration Tests

**`backend/src/test/java/com/betrace/routes/ComplianceQueryRoutesTest.java`:**
```java
package com.betrace.routes;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class ComplianceQueryRoutesTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should return 200 OK for valid query")
    void testValidQuery() {
        given()
            .queryParam("tenantId", TEST_TENANT_ID.toString())
            .queryParam("framework", "soc2")
            .queryParam("control", "CC6_1")
            .queryParam("startDate", LocalDate.now().minusDays(7).toString())
            .queryParam("endDate", LocalDate.now().toString())
            .queryParam("limit", 100)
        .when()
            .get("/api/compliance/evidence/query")
        .then()
            .statusCode(200)
            .contentType("application/json");
    }

    @Test
    @DisplayName("Should return 400 for missing tenantId")
    void testMissingTenantId() {
        given()
            .queryParam("framework", "soc2")
        .when()
            .get("/api/compliance/evidence/query")
        .then()
            .statusCode(400);
    }

    @Test
    @DisplayName("Should return 400 for invalid framework")
    void testInvalidFramework() {
        given()
            .queryParam("tenantId", TEST_TENANT_ID.toString())
            .queryParam("framework", "invalid-framework")
        .when()
            .get("/api/compliance/evidence/query")
        .then()
            .statusCode(400)
            .body("message", containsString("Invalid framework"));
    }

    @Test
    @DisplayName("Should return 400 for invalid date range")
    void testInvalidDateRange() {
        given()
            .queryParam("tenantId", TEST_TENANT_ID.toString())
            .queryParam("startDate", LocalDate.now().toString())
            .queryParam("endDate", LocalDate.now().minusDays(7).toString())
        .when()
            .get("/api/compliance/evidence/query")
        .then()
            .statusCode(400)
            .body("message", containsString("Start date must be before end date"));
    }
}
```

**Test Coverage Target:** 90% (ADR-014 compliance)

## Files to Create

**Backend - Camel Routes:**
- `backend/src/main/java/com/betrace/routes/ComplianceQueryRoutes.java`

**Backend - Processors:**
- `backend/src/main/java/com/betrace/processors/compliance/query/ParseComplianceQueryParametersProcessor.java`
- `backend/src/main/java/com/betrace/processors/compliance/query/ValidateQueryParametersProcessor.java`

**Backend - Models:**
- `backend/src/main/java/com/betrace/model/ComplianceQueryFilter.java`
- `backend/src/main/java/com/betrace/model/ComplianceSpanRecord.java`

**Backend - Tests:**
- `backend/src/test/java/com/betrace/routes/ComplianceQueryRoutesTest.java`
- `backend/src/test/java/com/betrace/processors/compliance/query/ParseComplianceQueryParametersProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/compliance/query/ValidateQueryParametersProcessorTest.java`

## Files to Modify

None (this is a new feature with no modifications to existing files).

## Implementation Notes

**Camel Route Design:**
- REST endpoint: `GET /api/compliance/evidence/query`
- Route ID: `queryComplianceEvidence`
- Processors: `parseComplianceQueryParametersProcessor` → `validateQueryParametersProcessor`
- Placeholder response: empty list (Unit B will add storage queries)

**Error Handling:**
- Invalid UUID: `IllegalArgumentException` with 400 Bad Request
- Invalid date range: `IllegalArgumentException` with 400 Bad Request
- Invalid limit: `IllegalArgumentException` with 400 Bad Request
- Invalid framework: `IllegalArgumentException` with 400 Bad Request

**Default Values:**
- Date range: Last 7 days
- Limit: 100
- Framework: null (all frameworks)
- Control: null (all controls)

## Next Steps

After completing Unit A, proceed to:
- **Unit B:** Hot/cold storage query processors (depends on Unit A)
- **Unit C:** Signature verification integration (depends on Unit B)
