# PRD-015b: Hot/Cold Storage Query Processors

**Parent PRD:** PRD-015 (Compliance Evidence Dashboard)
**Unit:** B
**Priority:** P1
**Dependencies:** Unit A (Query Infrastructure)

## Scope

Build storage query processors for hot (DuckDB) and cold (Parquet) storage:
- Query hot storage (DuckDB 0-7 days)
- Query cold storage (Parquet 7-365 days)
- Merge and sort results from both storage tiers
- Integrate with ADR-015 tiered storage architecture

This unit does NOT include:
- Signature verification (Unit C)
- Export functionality (Unit D)
- Metrics/dashboard (Unit E)
- Frontend UI (Unit F)

## Implementation

### 1. DuckDB Service (Hot Storage Interface)

**`backend/src/main/java/com/fluo/services/DuckDBService.java`:**
```java
package com.fluo.services;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import com.fluo.model.ComplianceSpanRecord;

import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.HashMap;

/**
 * DuckDB service for hot storage queries (0-7 days).
 * Per ADR-015, uses per-tenant DuckDB files.
 */
@ApplicationScoped
public class DuckDBService {

    @ConfigProperty(name = "fluo.storage.duckdb.path", defaultValue = "./data-duckdb")
    String duckdbPath;

    /**
     * Execute SQL query against tenant's DuckDB file.
     */
    public List<ComplianceSpanRecord> executeQuery(UUID tenantId, String sql) throws SQLException {
        String dbPath = duckdbPath + "/" + tenantId + ".duckdb";
        List<ComplianceSpanRecord> results = new ArrayList<>();

        try (Connection conn = DriverManager.getConnection("jdbc:duckdb:" + dbPath);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            while (rs.next()) {
                ComplianceSpanRecord record = mapResultSetToRecord(rs);
                results.add(record);
            }
        }

        return results;
    }

    /**
     * Execute Parquet query (for cold storage via DuckDB).
     */
    public List<ComplianceSpanRecord> executeParquetQuery(String sql) throws SQLException {
        List<ComplianceSpanRecord> results = new ArrayList<>();

        // Use in-memory DuckDB for Parquet queries
        try (Connection conn = DriverManager.getConnection("jdbc:duckdb:");
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            while (rs.next()) {
                ComplianceSpanRecord record = mapResultSetToRecord(rs);
                results.add(record);
            }
        }

        return results;
    }

    /**
     * Execute query returning maps (for metrics).
     */
    public List<Map<String, Object>> executeQueryAsMaps(UUID tenantId, String sql) throws SQLException {
        String dbPath = duckdbPath + "/" + tenantId + ".duckdb";
        List<Map<String, Object>> results = new ArrayList<>();

        try (Connection conn = DriverManager.getConnection("jdbc:duckdb:" + dbPath);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            ResultSetMetaData metaData = rs.getMetaData();
            int columnCount = metaData.getColumnCount();

            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                for (int i = 1; i <= columnCount; i++) {
                    row.put(metaData.getColumnName(i), rs.getObject(i));
                }
                results.add(row);
            }
        }

        return results;
    }

    private ComplianceSpanRecord mapResultSetToRecord(ResultSet rs) throws SQLException {
        return new ComplianceSpanRecord(
            rs.getString("span_id"),
            rs.getString("trace_id"),
            rs.getTimestamp("timestamp").toInstant(),
            rs.getString("framework"),
            rs.getString("control"),
            rs.getString("evidence_type"),
            UUID.fromString(rs.getString("tenant_id")),
            rs.getString("outcome"),
            rs.getString("signature"),
            rs.getString("details"),
            null  // spanAttributes will be populated later if needed
        );
    }
}
```

### 2. Cold Storage Service (Parquet Interface)

**`backend/src/main/java/com/fluo/services/ColdStorageService.java`:**
```java
package com.fluo.services;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Interface for cold storage (Parquet files).
 * Per ADR-015, deployment-agnostic abstraction.
 */
public interface ColdStorageService {

    /**
     * List Parquet file paths for tenant and date range.
     *
     * @param tenantId Tenant UUID
     * @param startDate Start date (inclusive)
     * @param endDate End date (inclusive)
     * @return List of absolute Parquet file paths
     */
    List<String> listParquetFiles(UUID tenantId, LocalDate startDate, LocalDate endDate);
}
```

**`backend/src/main/java/com/fluo/services/FilesystemColdStorage.java`:**
```java
package com.fluo.services;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Filesystem-based cold storage implementation.
 * Per ADR-015, reads Parquet files from local directory.
 * Structure: ./data-cold-storage/tenant-uuid/YYYY/MM/DD/traces.parquet
 */
@ApplicationScoped
public class FilesystemColdStorage implements ColdStorageService {

    @ConfigProperty(name = "fluo.storage.cold-storage.path", defaultValue = "./data-cold-storage")
    String coldStoragePath;

    @Override
    public List<String> listParquetFiles(UUID tenantId, LocalDate startDate, LocalDate endDate) {
        List<String> parquetFiles = new ArrayList<>();
        Path tenantPath = Paths.get(coldStoragePath, tenantId.toString());

        if (!Files.exists(tenantPath)) {
            return parquetFiles;
        }

        LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            Path datePath = tenantPath.resolve(String.format("%04d/%02d/%02d/traces.parquet",
                current.getYear(), current.getMonthValue(), current.getDayOfMonth()));

            if (Files.exists(datePath)) {
                parquetFiles.add(datePath.toAbsolutePath().toString());
            }

            current = current.plusDays(1);
        }

        return parquetFiles;
    }
}
```

### 3. Hot Storage Query Processor

**`backend/src/main/java/com/fluo/processors/compliance/query/QueryDuckDBComplianceProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.fluo.services.DuckDBService;
import com.fluo.model.ComplianceSpanRecord;
import com.fluo.model.ComplianceQueryFilter;
import java.util.List;

/**
 * Queries compliance spans from DuckDB hot storage (0-7 days).
 */
@Named("queryDuckDBComplianceProcessor")
@ApplicationScoped
public class QueryDuckDBComplianceProcessor implements Processor {

    @Inject
    DuckDBService duckDB;

    @Override
    public void process(Exchange exchange) throws Exception {
        ComplianceQueryFilter filter = exchange.getIn().getBody(ComplianceQueryFilter.class);

        // Query compliance spans from tenant's DuckDB file
        String sql = buildComplianceQuery(filter);
        List<ComplianceSpanRecord> spans = duckDB.executeQuery(filter.tenantId(), sql);

        exchange.getIn().setBody(spans);
        exchange.setProperty("hotStorageResults", spans);
    }

    private String buildComplianceQuery(ComplianceQueryFilter filter) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT * FROM compliance_spans WHERE 1=1");

        if (filter.framework() != null) {
            sql.append(" AND framework = '").append(escapeSql(filter.framework())).append("'");
        }

        if (filter.control() != null) {
            sql.append(" AND control = '").append(escapeSql(filter.control())).append("'");
        }

        sql.append(" AND timestamp >= '").append(filter.startDate()).append("'");
        sql.append(" AND timestamp <= '").append(filter.endDate()).append("'");
        sql.append(" ORDER BY timestamp DESC");
        sql.append(" LIMIT ").append(filter.limit());

        return sql.toString();
    }

    private String escapeSql(String value) {
        // Basic SQL injection prevention
        return value.replace("'", "''");
    }
}
```

### 4. Cold Storage Query Processor

**`backend/src/main/java/com/fluo/processors/compliance/query/QueryColdStorageComplianceProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.fluo.services.ColdStorageService;
import com.fluo.services.DuckDBService;
import com.fluo.model.ComplianceSpanRecord;
import com.fluo.model.ComplianceQueryFilter;
import java.time.LocalDate;
import java.util.List;

/**
 * Queries compliance spans from Parquet cold storage (7-365 days).
 * Uses DuckDB's ability to query Parquet files directly.
 */
@Named("queryColdStorageComplianceProcessor")
@ApplicationScoped
public class QueryColdStorageComplianceProcessor implements Processor {

    @Inject
    ColdStorageService coldStorage;

    @Inject
    DuckDBService duckDB;

    @Override
    public void process(Exchange exchange) throws Exception {
        ComplianceQueryFilter filter = exchange.getIn().getBody(ComplianceQueryFilter.class);

        // Only query cold storage if date range extends beyond hot storage retention (7 days)
        LocalDate coldStorageCutoff = LocalDate.now().minusDays(7);
        if (filter.startDate().isAfter(coldStorageCutoff)) {
            // Query entirely within hot storage, no cold storage needed
            exchange.getIn().setBody(List.of());
            exchange.setProperty("coldStorageResults", List.of());
            return;
        }

        // List Parquet files for date range
        List<String> parquetPaths = coldStorage.listParquetFiles(
            filter.tenantId(),
            filter.startDate(),
            coldStorageCutoff.minusDays(1)  // Only query cold storage up to cutoff
        );

        if (parquetPaths.isEmpty()) {
            exchange.getIn().setBody(List.of());
            exchange.setProperty("coldStorageResults", List.of());
            return;
        }

        // Use DuckDB to query Parquet files directly
        String sql = buildParquetQuery(filter, parquetPaths);
        List<ComplianceSpanRecord> spans = duckDB.executeParquetQuery(sql);

        exchange.getIn().setBody(spans);
        exchange.setProperty("coldStorageResults", spans);
    }

    private String buildParquetQuery(ComplianceQueryFilter filter, List<String> parquetPaths) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT * FROM read_parquet([");

        // Add quoted Parquet file paths
        for (int i = 0; i < parquetPaths.size(); i++) {
            sql.append("'").append(parquetPaths.get(i).replace("'", "''")).append("'");
            if (i < parquetPaths.size() - 1) sql.append(", ");
        }

        sql.append("]) WHERE 1=1");

        if (filter.framework() != null) {
            sql.append(" AND framework = '").append(escapeSql(filter.framework())).append("'");
        }

        if (filter.control() != null) {
            sql.append(" AND control = '").append(escapeSql(filter.control())).append("'");
        }

        sql.append(" AND timestamp >= '").append(filter.startDate()).append("'");
        sql.append(" AND timestamp <= '").append(filter.endDate()).append("'");
        sql.append(" ORDER BY timestamp DESC");
        sql.append(" LIMIT ").append(filter.limit());

        return sql.toString();
    }

    private String escapeSql(String value) {
        return value.replace("'", "''");
    }
}
```

### 5. Merge Results Processor

**`backend/src/main/java/com/fluo/processors/compliance/query/MergeComplianceResultsProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.fluo.model.ComplianceSpanRecord;
import com.fluo.model.ComplianceQueryFilter;
import java.util.ArrayList;
import java.util.List;
import java.util.Comparator;

/**
 * Merges results from hot storage (DuckDB) and cold storage (Parquet).
 * Sorts by timestamp descending and applies limit.
 */
@Named("mergeComplianceResultsProcessor")
@ApplicationScoped
public class MergeComplianceResultsProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> hotResults =
            (List<ComplianceSpanRecord>) exchange.getProperty("hotStorageResults");
        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> coldResults =
            (List<ComplianceSpanRecord>) exchange.getProperty("coldStorageResults");
        ComplianceQueryFilter filter = exchange.getIn().getHeader("queryFilter", ComplianceQueryFilter.class);

        // Merge results
        List<ComplianceSpanRecord> merged = new ArrayList<>();
        if (hotResults != null) merged.addAll(hotResults);
        if (coldResults != null) merged.addAll(coldResults);

        // Sort by timestamp descending
        merged.sort(Comparator.comparing(ComplianceSpanRecord::timestamp).reversed());

        // Apply limit
        if (merged.size() > filter.limit()) {
            merged = merged.subList(0, filter.limit());
        }

        exchange.getIn().setBody(merged);
    }
}
```

### 6. Sort and Limit Processor

**`backend/src/main/java/com/fluo/processors/compliance/query/SortAndLimitResultsProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.fluo.model.ComplianceSpanRecord;
import com.fluo.model.ComplianceQueryFilter;
import java.util.Comparator;
import java.util.List;

/**
 * Sorts results by timestamp and applies final limit.
 * Used after signature verification.
 */
@Named("sortAndLimitResultsProcessor")
@ApplicationScoped
public class SortAndLimitResultsProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> results = exchange.getIn().getBody(List.class);
        ComplianceQueryFilter filter = exchange.getIn().getHeader("queryFilter", ComplianceQueryFilter.class);

        // Sort by timestamp descending
        results.sort(Comparator.comparing(ComplianceSpanRecord::timestamp).reversed());

        // Apply limit
        if (results.size() > filter.limit()) {
            results = results.subList(0, filter.limit());
        }

        exchange.getIn().setBody(results);
    }
}
```

### 7. Update Compliance Query Routes

**Update `backend/src/main/java/com/fluo/routes/ComplianceQueryRoutes.java`:**
```java
// Replace the placeholder route from Unit A with:

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
    // Signature verification will be added in Unit C
    .process("sortAndLimitResultsProcessor")
    .marshal().json();

// Query hot storage (DuckDB 0-7 days)
from("direct:queryHotComplianceStorage")
    .routeId("queryHotComplianceStorage")
    .process("queryDuckDBComplianceProcessor")
    .log("Hot storage returned ${body.size()} compliance spans");

// Query cold storage (Parquet 7-365 days)
from("direct:queryColdComplianceStorage")
    .routeId("queryColdComplianceStorage")
    .process("queryColdStorageComplianceProcessor")
    .log("Cold storage returned ${body.size()} compliance spans");
```

## Success Criteria

- [ ] Query hot storage (DuckDB) for compliance spans
- [ ] Query cold storage (Parquet) for compliance spans
- [ ] Merge results from both storage tiers
- [ ] Sort results by timestamp descending
- [ ] Apply limit to merged results
- [ ] Parallel queries to hot and cold storage (Camel multicast)
- [ ] Query response time <1 second for 7-day range (hot only)
- [ ] Query response time <5 seconds for 30-day range (hot + cold)
- [ ] SQL injection prevention in query builders
- [ ] Tenant isolation enforced (per-tenant DuckDB files)

## Testing Requirements

### Unit Tests

**`backend/src/test/java/com/fluo/processors/compliance/query/QueryDuckDBComplianceProcessorTest.java`:**
```java
package com.fluo.processors.compliance.query;

import com.fluo.model.ComplianceQueryFilter;
import com.fluo.model.ComplianceSpanRecord;
import com.fluo.services.DuckDBService;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class QueryDuckDBComplianceProcessorTest {

    private QueryDuckDBComplianceProcessor processor;
    private DuckDBService mockDuckDB;
    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        processor = new QueryDuckDBComplianceProcessor();
        mockDuckDB = Mockito.mock(DuckDBService.class);
        processor.duckDB = mockDuckDB;
    }

    @Test
    @DisplayName("Should query DuckDB with framework filter")
    void testQueryWithFramework() throws Exception {
        ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
            .framework("soc2")
            .control("CC6_1")
            .tenantId(TEST_TENANT_ID)
            .startDate(LocalDate.now().minusDays(7))
            .endDate(LocalDate.now())
            .limit(100)
            .build();

        ComplianceSpanRecord testRecord = new ComplianceSpanRecord(
            "span-1", "trace-1", Instant.now(), "soc2", "CC6_1",
            "audit_trail", TEST_TENANT_ID, "success", null, "test", null
        );

        when(mockDuckDB.executeQuery(eq(TEST_TENANT_ID), anyString()))
            .thenReturn(List.of(testRecord));

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setBody(filter);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> results = exchange.getIn().getBody(List.class);
        assertNotNull(results);
        assertEquals(1, results.size());
        assertEquals("soc2", results.get(0).framework());

        verify(mockDuckDB).executeQuery(eq(TEST_TENANT_ID), contains("framework = 'soc2'"));
        verify(mockDuckDB).executeQuery(eq(TEST_TENANT_ID), contains("control = 'CC6_1'"));
    }

    @Test
    @DisplayName("Should store hot storage results in exchange property")
    void testStoreResultsInProperty() throws Exception {
        ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
            .tenantId(TEST_TENANT_ID)
            .startDate(LocalDate.now().minusDays(7))
            .endDate(LocalDate.now())
            .limit(100)
            .build();

        List<ComplianceSpanRecord> testRecords = List.of(
            new ComplianceSpanRecord("span-1", "trace-1", Instant.now(),
                "soc2", "CC6_1", "audit_trail", TEST_TENANT_ID, "success", null, "test", null)
        );

        when(mockDuckDB.executeQuery(eq(TEST_TENANT_ID), anyString()))
            .thenReturn(testRecords);

        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setBody(filter);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> propertyResults =
            (List<ComplianceSpanRecord>) exchange.getProperty("hotStorageResults");
        assertNotNull(propertyResults);
        assertEquals(1, propertyResults.size());
    }
}
```

**`backend/src/test/java/com/fluo/processors/compliance/query/MergeComplianceResultsProcessorTest.java`:**
```java
package com.fluo.processors.compliance.query;

import com.fluo.model.ComplianceQueryFilter;
import com.fluo.model.ComplianceSpanRecord;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class MergeComplianceResultsProcessorTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should merge hot and cold storage results")
    void testMergeResults() throws Exception {
        MergeComplianceResultsProcessor processor = new MergeComplianceResultsProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        Instant now = Instant.now();
        List<ComplianceSpanRecord> hotResults = List.of(
            createComplianceSpan("span-1", now.minus(1, ChronoUnit.DAYS)),
            createComplianceSpan("span-2", now.minus(2, ChronoUnit.DAYS))
        );

        List<ComplianceSpanRecord> coldResults = List.of(
            createComplianceSpan("span-3", now.minus(10, ChronoUnit.DAYS)),
            createComplianceSpan("span-4", now.minus(11, ChronoUnit.DAYS))
        );

        exchange.setProperty("hotStorageResults", hotResults);
        exchange.setProperty("coldStorageResults", coldResults);
        exchange.getIn().setHeader("queryFilter", ComplianceQueryFilter.builder()
            .tenantId(TEST_TENANT_ID)
            .limit(100)
            .build());

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> merged = exchange.getIn().getBody(List.class);
        assertEquals(4, merged.size());
    }

    @Test
    @DisplayName("Should sort results by timestamp descending")
    void testSortResults() throws Exception {
        MergeComplianceResultsProcessor processor = new MergeComplianceResultsProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        Instant now = Instant.now();
        List<ComplianceSpanRecord> hotResults = List.of(
            createComplianceSpan("span-newest", now.minus(1, ChronoUnit.DAYS))
        );

        List<ComplianceSpanRecord> coldResults = List.of(
            createComplianceSpan("span-oldest", now.minus(10, ChronoUnit.DAYS))
        );

        exchange.setProperty("hotStorageResults", hotResults);
        exchange.setProperty("coldStorageResults", coldResults);
        exchange.getIn().setHeader("queryFilter", ComplianceQueryFilter.builder()
            .tenantId(TEST_TENANT_ID)
            .limit(100)
            .build());

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> merged = exchange.getIn().getBody(List.class);
        assertEquals("span-newest", merged.get(0).spanId());
        assertEquals("span-oldest", merged.get(1).spanId());
    }

    @Test
    @DisplayName("Should apply limit to merged results")
    void testApplyLimit() throws Exception {
        MergeComplianceResultsProcessor processor = new MergeComplianceResultsProcessor();
        CamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        Instant now = Instant.now();
        List<ComplianceSpanRecord> hotResults = List.of(
            createComplianceSpan("span-1", now.minus(1, ChronoUnit.DAYS)),
            createComplianceSpan("span-2", now.minus(2, ChronoUnit.DAYS)),
            createComplianceSpan("span-3", now.minus(3, ChronoUnit.DAYS))
        );

        List<ComplianceSpanRecord> coldResults = List.of(
            createComplianceSpan("span-4", now.minus(10, ChronoUnit.DAYS)),
            createComplianceSpan("span-5", now.minus(11, ChronoUnit.DAYS))
        );

        exchange.setProperty("hotStorageResults", hotResults);
        exchange.setProperty("coldStorageResults", coldResults);
        exchange.getIn().setHeader("queryFilter", ComplianceQueryFilter.builder()
            .tenantId(TEST_TENANT_ID)
            .limit(3)  // Limit to 3 results
            .build());

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        List<ComplianceSpanRecord> merged = exchange.getIn().getBody(List.class);
        assertEquals(3, merged.size());
    }

    private ComplianceSpanRecord createComplianceSpan(String spanId, Instant timestamp) {
        return new ComplianceSpanRecord(
            spanId, "trace-1", timestamp, "soc2", "CC6_1",
            "audit_trail", TEST_TENANT_ID, "success", null, "test", null
        );
    }
}
```

### Integration Tests

**`backend/src/test/java/com/fluo/compliance/ComplianceStorageQueryIntegrationTest.java`:**
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
class ComplianceStorageQueryIntegrationTest {

    private final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should query hot storage for recent data (last 7 days)")
    void testQueryHotStorage() {
        given()
            .queryParam("tenantId", TEST_TENANT_ID.toString())
            .queryParam("framework", "soc2")
            .queryParam("startDate", LocalDate.now().minusDays(3).toString())
            .queryParam("endDate", LocalDate.now().toString())
        .when()
            .get("/api/compliance/evidence/query")
        .then()
            .statusCode(200)
            .contentType("application/json")
            .body("$", is(instanceOf(List.class)));
    }

    @Test
    @DisplayName("Should query both hot and cold storage for 30-day range")
    void testQueryHotAndColdStorage() {
        given()
            .queryParam("tenantId", TEST_TENANT_ID.toString())
            .queryParam("startDate", LocalDate.now().minusDays(30).toString())
            .queryParam("endDate", LocalDate.now().toString())
        .when()
            .get("/api/compliance/evidence/query")
        .then()
            .statusCode(200)
            .contentType("application/json")
            .body("$", is(instanceOf(List.class)));
    }
}
```

**Test Coverage Target:** 90% (ADR-014 compliance)

## Files to Create

**Backend - Services:**
- `backend/src/main/java/com/fluo/services/DuckDBService.java`
- `backend/src/main/java/com/fluo/services/ColdStorageService.java`
- `backend/src/main/java/com/fluo/services/FilesystemColdStorage.java`

**Backend - Processors:**
- `backend/src/main/java/com/fluo/processors/compliance/query/QueryDuckDBComplianceProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/query/QueryColdStorageComplianceProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/query/MergeComplianceResultsProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/query/SortAndLimitResultsProcessor.java`

**Backend - Tests:**
- `backend/src/test/java/com/fluo/processors/compliance/query/QueryDuckDBComplianceProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/query/QueryColdStorageComplianceProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/query/MergeComplianceResultsProcessorTest.java`
- `backend/src/test/java/com/fluo/compliance/ComplianceStorageQueryIntegrationTest.java`

## Files to Modify

**Backend:**
- `backend/src/main/java/com/fluo/routes/ComplianceQueryRoutes.java` - Add multicast route for hot/cold storage queries
- `backend/pom.xml` - Add DuckDB JDBC driver dependency (if not present)
- `backend/src/main/resources/application.properties` - Add storage configuration

**Configuration Update:**
```properties
# Storage configuration
fluo.storage.duckdb.path=./data-duckdb
fluo.storage.cold-storage.path=./data-cold-storage
fluo.compliance.query.hot-storage-retention-days=7
```

## Implementation Notes

**ADR-015 Compliance:**
- Hot storage: DuckDB per-tenant files (`./data-duckdb/tenant-uuid.duckdb`)
- Cold storage: Parquet per-tenant directories (`./data-cold-storage/tenant-uuid/YYYY/MM/DD/`)
- Unified queries via DuckDB's `read_parquet()` function
- Parallel queries to hot and cold storage (Camel multicast)

**Performance Optimization:**
- Parallel queries reduce total query time
- DuckDB columnar storage enables fast filtering
- Parquet partition pruning (only reads relevant date partitions)
- SQL injection prevention in query builders

**Tenant Isolation:**
- Per-tenant DuckDB files enforce OS-level isolation
- Per-tenant Parquet directories enforce OS-level isolation
- Query processor validates tenantId from authenticated user

## Next Steps

After completing Unit B, proceed to:
- **Unit C:** Signature verification integration (depends on Unit B)
- **Unit D:** Export functionality (depends on Unit C)
