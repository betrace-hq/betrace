# PRD-015e: Compliance Metrics and Dashboard

**Parent PRD:** PRD-015 (Compliance Evidence Dashboard)
**Unit:** E
**Priority:** P1
**Dependencies:** Unit B (Storage Queries) - can be parallel with Unit D

## Scope

Build compliance metrics and dashboard functionality:
- Calculate compliance metrics (span counts, control coverage)
- Calculate signature verification rate
- Calculate control coverage for frameworks
- Provide dashboard API endpoints

This unit does NOT include:
- Frontend UI (Unit F)

## Implementation

### 1. Compliance Metrics Model

**`backend/src/main/java/com/betrace/model/ComplianceMetrics.java`:**
```java
package com.betrace.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Compliance metrics for dashboard display.
 */
public record ComplianceMetrics(
    UUID tenantId,
    long totalSpans,
    double signatureVerificationRate,
    List<FrameworkMetrics> frameworkMetrics,
    Instant lastUpdated
) {
    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private UUID tenantId;
        private long totalSpans;
        private double signatureVerificationRate;
        private List<FrameworkMetrics> frameworkMetrics;
        private Instant lastUpdated;

        public Builder tenantId(UUID tenantId) {
            this.tenantId = tenantId;
            return this;
        }

        public Builder totalSpans(long totalSpans) {
            this.totalSpans = totalSpans;
            return this;
        }

        public Builder signatureVerificationRate(double rate) {
            this.signatureVerificationRate = rate;
            return this;
        }

        public Builder frameworkMetrics(List<FrameworkMetrics> metrics) {
            this.frameworkMetrics = metrics;
            return this;
        }

        public Builder lastUpdated(Instant lastUpdated) {
            this.lastUpdated = lastUpdated;
            return this;
        }

        public ComplianceMetrics build() {
            return new ComplianceMetrics(
                tenantId, totalSpans, signatureVerificationRate,
                frameworkMetrics, lastUpdated
            );
        }
    }
}
```

**`backend/src/main/java/com/betrace/model/FrameworkMetrics.java`:**
```java
package com.betrace.model;

/**
 * Metrics for a specific compliance framework.
 */
public record FrameworkMetrics(
    String framework,
    long spanCount,
    int controlCount,
    long validSignatures,
    long invalidSignatures,
    long successfulEvents,
    long failedEvents
) {}
```

**`backend/src/main/java/com/betrace/model/ControlCoverage.java`:**
```java
package com.betrace.model;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Control coverage for a framework.
 * Shows which controls have evidence.
 */
public record ControlCoverage(
    UUID tenantId,
    String framework,
    List<ControlCoverageItem> controls,
    Instant lastUpdated
) {}
```

**`backend/src/main/java/com/betrace/model/ControlCoverageItem.java`:**
```java
package com.betrace.model;

import java.time.Instant;

/**
 * Coverage information for a single control.
 */
public record ControlCoverageItem(
    String control,
    long spanCount,
    Instant lastEvidence,
    boolean hasCoverage
) {}
```

### 2. Compliance Metrics Processor

**`backend/src/main/java/com/betrace/processors/compliance/metrics/CalculateComplianceMetricsProcessor.java`:**
```java
package com.betrace.processors.compliance.metrics;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.betrace.services.DuckDBService;
import com.betrace.model.ComplianceMetrics;
import com.betrace.model.FrameworkMetrics;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Calculates compliance metrics for dashboard display.
 */
@Named("calculateComplianceMetricsProcessor")
@ApplicationScoped
public class CalculateComplianceMetricsProcessor implements Processor {

    @Inject
    DuckDBService duckDB;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = UUID.fromString(exchange.getIn().getHeader("tenantId", String.class));

        // Query metrics from DuckDB (last 30 days)
        String sql = """
            SELECT
                framework,
                COUNT(*) as span_count,
                COUNT(DISTINCT control) as control_count,
                SUM(CASE WHEN signature_valid = true THEN 1 ELSE 0 END) as valid_signatures,
                SUM(CASE WHEN signature_valid = false THEN 1 ELSE 0 END) as invalid_signatures,
                SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successful_events,
                SUM(CASE WHEN outcome != 'success' THEN 1 ELSE 0 END) as failed_events
            FROM compliance_spans
            WHERE timestamp >= CURRENT_DATE - INTERVAL 30 DAY
            GROUP BY framework
            """;

        List<Map<String, Object>> results = duckDB.executeQueryAsMaps(tenantId, sql);

        // Build framework metrics
        List<FrameworkMetrics> frameworkMetrics = new ArrayList<>();
        long totalSpans = 0;
        long totalValidSignatures = 0;
        long totalInvalidSignatures = 0;

        for (Map<String, Object> row : results) {
            String framework = (String) row.get("framework");
            long spanCount = ((Number) row.get("span_count")).longValue();
            int controlCount = ((Number) row.get("control_count")).intValue();
            long validSigs = ((Number) row.get("valid_signatures")).longValue();
            long invalidSigs = ((Number) row.get("invalid_signatures")).longValue();
            long successEvents = ((Number) row.get("successful_events")).longValue();
            long failedEvents = ((Number) row.get("failed_events")).longValue();

            frameworkMetrics.add(new FrameworkMetrics(
                framework, spanCount, controlCount, validSigs, invalidSigs,
                successEvents, failedEvents
            ));

            totalSpans += spanCount;
            totalValidSignatures += validSigs;
            totalInvalidSignatures += invalidSigs;
        }

        // Calculate signature verification rate
        double signatureRate = calculateSignatureRate(totalValidSignatures, totalInvalidSignatures);

        // Build metrics object
        ComplianceMetrics metrics = ComplianceMetrics.builder()
            .tenantId(tenantId)
            .totalSpans(totalSpans)
            .signatureVerificationRate(signatureRate)
            .frameworkMetrics(frameworkMetrics)
            .lastUpdated(Instant.now())
            .build();

        exchange.getIn().setBody(metrics);
    }

    private double calculateSignatureRate(long validSignatures, long invalidSignatures) {
        long totalSigned = validSignatures + invalidSignatures;
        return totalSigned > 0 ? (double) validSignatures / totalSigned : 0.0;
    }
}
```

### 3. Control Coverage Processor

**`backend/src/main/java/com/betrace/processors/compliance/metrics/CalculateControlCoverageProcessor.java`:**
```java
package com.betrace.processors.compliance.metrics;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.betrace.services.DuckDBService;
import com.betrace.model.ControlCoverage;
import com.betrace.model.ControlCoverageItem;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Calculates control coverage for a framework.
 * Shows which controls have evidence.
 */
@Named("calculateControlCoverageProcessor")
@ApplicationScoped
public class CalculateControlCoverageProcessor implements Processor {

    @Inject
    DuckDBService duckDB;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = UUID.fromString(exchange.getIn().getHeader("tenantId", String.class));
        String framework = exchange.getIn().getHeader("framework", String.class);

        // Query control coverage from DuckDB
        String sql = String.format("""
            SELECT
                control,
                COUNT(*) as span_count,
                MAX(timestamp) as last_evidence
            FROM compliance_spans
            WHERE framework = '%s'
                AND timestamp >= CURRENT_DATE - INTERVAL 30 DAY
            GROUP BY control
            ORDER BY control
            """, framework);

        List<Map<String, Object>> results = duckDB.executeQueryAsMaps(tenantId, sql);

        // Build control coverage items
        List<ControlCoverageItem> controls = new ArrayList<>();
        for (Map<String, Object> row : results) {
            String control = (String) row.get("control");
            long spanCount = ((Number) row.get("span_count")).longValue();
            Object lastEvidenceObj = row.get("last_evidence");
            Instant lastEvidence = lastEvidenceObj != null
                ? Instant.parse(lastEvidenceObj.toString())
                : null;

            controls.add(new ControlCoverageItem(
                control,
                spanCount,
                lastEvidence,
                spanCount > 0
            ));
        }

        // Build coverage object
        ControlCoverage coverage = new ControlCoverage(
            tenantId,
            framework,
            controls,
            Instant.now()
        );

        exchange.getIn().setBody(coverage);
    }
}
```

### 4. Update Compliance Query Routes

**Update `backend/src/main/java/com/betrace/routes/ComplianceQueryRoutes.java`:**
```java
// Add metrics routes:

// Get compliance metrics for dashboard
.get("/metrics/{tenantId}")
    .description("Get compliance metrics for dashboard")
    .to("direct:getComplianceMetrics")

// Get control coverage for framework
.get("/coverage/{tenantId}/{framework}")
    .description("Get control coverage for framework")
    .to("direct:getControlCoverage");

// ... (in configure() method)

// Get compliance metrics
from("direct:getComplianceMetrics")
    .routeId("getComplianceMetrics")
    .log("Calculating compliance metrics for tenant ${header.tenantId}")
    .process("calculateComplianceMetricsProcessor")
    .marshal().json();

// Get control coverage
from("direct:getControlCoverage")
    .routeId("getControlCoverage")
    .log("Calculating control coverage for tenant ${header.tenantId}, framework ${header.framework}")
    .process("calculateControlCoverageProcessor")
    .marshal().json();
```

## Success Criteria

- [ ] Calculate compliance metrics (span counts by framework)
- [ ] Calculate control coverage (which controls have evidence)
- [ ] Calculate signature verification rate (% valid signatures)
- [ ] Calculate success/failure event counts
- [ ] Metrics endpoint: `GET /api/compliance/metrics/{tenantId}`
- [ ] Coverage endpoint: `GET /api/compliance/coverage/{tenantId}/{framework}`
- [ ] Metrics calculated from last 30 days of data
- [ ] Response time <1 second for metrics calculation
- [ ] Metrics include framework breakdown (SOC2, HIPAA, GDPR, etc.)
- [ ] Control coverage shows last evidence timestamp

## Testing Requirements

### Unit Tests

**`backend/src/test/java/com/betrace/processors/compliance/metrics/CalculateComplianceMetricsProcessorTest.java`:**
```java
package com.betrace.processors.compliance.metrics;

import com.betrace.model.ComplianceMetrics;
import com.betrace.services.DuckDBService;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CalculateComplianceMetricsProcessorTest {

    private CalculateComplianceMetricsProcessor processor;
    private DuckDBService mockDuckDB;
    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        processor = new CalculateComplianceMetricsProcessor();
        mockDuckDB = Mockito.mock(DuckDBService.class);
        processor.duckDB = mockDuckDB;
    }

    @Test
    @DisplayName("Should calculate metrics for multiple frameworks")
    void testCalculateMetrics() throws Exception {
        List<Map<String, Object>> mockResults = List.of(
            Map.of(
                "framework", "soc2",
                "span_count", 100L,
                "control_count", 5,
                "valid_signatures", 90L,
                "invalid_signatures", 10L,
                "successful_events", 95L,
                "failed_events", 5L
            ),
            Map.of(
                "framework", "hipaa",
                "span_count", 50L,
                "control_count", 3,
                "valid_signatures", 45L,
                "invalid_signatures", 5L,
                "successful_events", 48L,
                "failed_events", 2L
            )
        );

        when(mockDuckDB.executeQueryAsMaps(eq(TEST_TENANT_ID), anyString()))
            .thenReturn(mockResults);

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID.toString());

        processor.process(exchange);

        ComplianceMetrics metrics = exchange.getIn().getBody(ComplianceMetrics.class);
        assertNotNull(metrics);
        assertEquals(TEST_TENANT_ID, metrics.tenantId());
        assertEquals(150L, metrics.totalSpans()); // 100 + 50
        assertEquals(2, metrics.frameworkMetrics().size());

        // Verify signature rate: (90 + 45) / (100 + 50) = 0.9
        assertEquals(0.9, metrics.signatureVerificationRate(), 0.01);
    }

    @Test
    @DisplayName("Should handle empty results")
    void testEmptyResults() throws Exception {
        when(mockDuckDB.executeQueryAsMaps(eq(TEST_TENANT_ID), anyString()))
            .thenReturn(List.of());

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID.toString());

        processor.process(exchange);

        ComplianceMetrics metrics = exchange.getIn().getBody(ComplianceMetrics.class);
        assertNotNull(metrics);
        assertEquals(0L, metrics.totalSpans());
        assertEquals(0.0, metrics.signatureVerificationRate());
        assertTrue(metrics.frameworkMetrics().isEmpty());
    }

    @Test
    @DisplayName("Should calculate signature rate correctly")
    void testSignatureRateCalculation() throws Exception {
        List<Map<String, Object>> mockResults = List.of(
            Map.of(
                "framework", "soc2",
                "span_count", 100L,
                "control_count", 5,
                "valid_signatures", 80L,
                "invalid_signatures", 20L,
                "successful_events", 90L,
                "failed_events", 10L
            )
        );

        when(mockDuckDB.executeQueryAsMaps(eq(TEST_TENANT_ID), anyString()))
            .thenReturn(mockResults);

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID.toString());

        processor.process(exchange);

        ComplianceMetrics metrics = exchange.getIn().getBody(ComplianceMetrics.class);
        // Signature rate: 80 / (80 + 20) = 0.8
        assertEquals(0.8, metrics.signatureVerificationRate(), 0.01);
    }
}
```

**`backend/src/test/java/com/betrace/processors/compliance/metrics/CalculateControlCoverageProcessorTest.java`:**
```java
package com.betrace.processors.compliance.metrics;

import com.betrace.model.ControlCoverage;
import com.betrace.services.DuckDBService;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
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

class CalculateControlCoverageProcessorTest {

    private CalculateControlCoverageProcessor processor;
    private DuckDBService mockDuckDB;
    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        processor = new CalculateControlCoverageProcessor();
        mockDuckDB = Mockito.mock(DuckDBService.class);
        processor.duckDB = mockDuckDB;
    }

    @Test
    @DisplayName("Should calculate control coverage for framework")
    void testCalculateControlCoverage() throws Exception {
        Instant now = Instant.now();
        List<Map<String, Object>> mockResults = List.of(
            Map.of(
                "control", "CC6_1",
                "span_count", 50L,
                "last_evidence", now.toString()
            ),
            Map.of(
                "control", "CC6_2",
                "span_count", 30L,
                "last_evidence", now.minusSeconds(3600).toString()
            ),
            Map.of(
                "control", "CC7_1",
                "span_count", 20L,
                "last_evidence", now.minusSeconds(7200).toString()
            )
        );

        when(mockDuckDB.executeQueryAsMaps(eq(TEST_TENANT_ID), anyString()))
            .thenReturn(mockResults);

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID.toString());
        exchange.getIn().setHeader("framework", "soc2");

        processor.process(exchange);

        ControlCoverage coverage = exchange.getIn().getBody(ControlCoverage.class);
        assertNotNull(coverage);
        assertEquals(TEST_TENANT_ID, coverage.tenantId());
        assertEquals("soc2", coverage.framework());
        assertEquals(3, coverage.controls().size());

        // Verify first control
        assertEquals("CC6_1", coverage.controls().get(0).control());
        assertEquals(50L, coverage.controls().get(0).spanCount());
        assertTrue(coverage.controls().get(0).hasCoverage());
        assertNotNull(coverage.controls().get(0).lastEvidence());
    }

    @Test
    @DisplayName("Should handle framework with no evidence")
    void testNoEvidence() throws Exception {
        when(mockDuckDB.executeQueryAsMaps(eq(TEST_TENANT_ID), anyString()))
            .thenReturn(List.of());

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID.toString());
        exchange.getIn().setHeader("framework", "gdpr");

        processor.process(exchange);

        ControlCoverage coverage = exchange.getIn().getBody(ControlCoverage.class);
        assertNotNull(coverage);
        assertEquals("gdpr", coverage.framework());
        assertTrue(coverage.controls().isEmpty());
    }
}
```

### Integration Tests

**`backend/src/test/java/com/betrace/compliance/ComplianceMetricsIntegrationTest.java`:**
```java
package com.betrace.compliance;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class ComplianceMetricsIntegrationTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should return compliance metrics for tenant")
    void testGetComplianceMetrics() {
        given()
            .pathParam("tenantId", TEST_TENANT_ID.toString())
        .when()
            .get("/api/compliance/metrics/{tenantId}")
        .then()
            .statusCode(200)
            .contentType("application/json")
            .body("tenantId", equalTo(TEST_TENANT_ID.toString()))
            .body("totalSpans", greaterThanOrEqualTo(0))
            .body("signatureVerificationRate", greaterThanOrEqualTo(0.0f))
            .body("frameworkMetrics", is(instanceOf(List.class)))
            .body("lastUpdated", notNullValue());
    }

    @Test
    @DisplayName("Should return control coverage for framework")
    void testGetControlCoverage() {
        given()
            .pathParam("tenantId", TEST_TENANT_ID.toString())
            .pathParam("framework", "soc2")
        .when()
            .get("/api/compliance/coverage/{tenantId}/{framework}")
        .then()
            .statusCode(200)
            .contentType("application/json")
            .body("tenantId", equalTo(TEST_TENANT_ID.toString()))
            .body("framework", equalTo("soc2"))
            .body("controls", is(instanceOf(List.class)))
            .body("lastUpdated", notNullValue());
    }
}
```

**Test Coverage Target:** 90% (ADR-014 compliance)

## Files to Create

**Backend - Models:**
- `backend/src/main/java/com/betrace/model/ComplianceMetrics.java`
- `backend/src/main/java/com/betrace/model/FrameworkMetrics.java`
- `backend/src/main/java/com/betrace/model/ControlCoverage.java`
- `backend/src/main/java/com/betrace/model/ControlCoverageItem.java`

**Backend - Processors:**
- `backend/src/main/java/com/betrace/processors/compliance/metrics/CalculateComplianceMetricsProcessor.java`
- `backend/src/main/java/com/betrace/processors/compliance/metrics/CalculateControlCoverageProcessor.java`

**Backend - Tests:**
- `backend/src/test/java/com/betrace/processors/compliance/metrics/CalculateComplianceMetricsProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/compliance/metrics/CalculateControlCoverageProcessorTest.java`
- `backend/src/test/java/com/betrace/compliance/ComplianceMetricsIntegrationTest.java`

## Files to Modify

**Backend:**
- `backend/src/main/java/com/betrace/routes/ComplianceQueryRoutes.java` - Add metrics and coverage routes

## Implementation Notes

**Metrics Calculation:**
- Calculated from last 30 days of hot storage (DuckDB)
- Framework breakdown (SOC2, HIPAA, GDPR, etc.)
- Control coverage per framework
- Signature verification rate (valid / total signed)
- Success/failure event counts

**Performance:**
- Metrics queries use aggregations (COUNT, SUM)
- DuckDB columnar storage enables fast aggregations
- Response time <1 second for metrics calculation

**Control Coverage:**
- Shows which controls have evidence
- Last evidence timestamp per control
- Span count per control
- Used to identify compliance gaps

**Dashboard Use Cases:**
1. **Management:** Total compliance spans, verification rate
2. **Compliance Officers:** Framework breakdown, control coverage
3. **Security Teams:** Success/failure event trends
4. **Auditors:** Control coverage gaps, last evidence dates

## Next Steps

After completing Unit E, proceed to:
- **Unit F:** Frontend UI (depends on all backend units A-E)
