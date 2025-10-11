# PRD-014b: Sample Trace Library

**Priority:** P1 (User Workflow)
**Complexity:** Simple (Component)
**Type:** Unit PRD
**Parent:** PRD-014 (Developer Rule Testing)
**Dependencies:** PRD-002 (TigerBeetle Persistence)

## Problem

Developers need pre-built sample traces to test rules against common scenarios. Without a trace library, every developer must create traces from scratch, which is time-consuming and error-prone.

## Solution

Provide curated library of sample traces covering common scenarios (authentication failures, PII leaks, compliance violations). Store in DuckDB for fast retrieval with categorization and search. Include 10+ pre-built traces representing typical FLUO use cases.

## Unit Description

**File:** `backend/src/main/java/com/fluo/services/SampleTraceLibraryService.java`
**Type:** CDI ApplicationScoped Service
**Purpose:** Manage sample trace library for rule testing

## Implementation

```java
package com.fluo.services;

import com.fluo.model.SampleTrace;
import io.duckdb.DuckDBConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class SampleTraceLibraryService {
    private static final Logger log = LoggerFactory.getLogger(SampleTraceLibraryService.class);

    @Inject
    DuckDBConnection duckDB;

    /**
     * Load all sample traces for tenant
     * @param tenantId Tenant UUID
     * @return List of sample traces
     */
    public List<SampleTrace> listSampleTraces(UUID tenantId) {
        String sql = """
            SELECT id, tenant_id, name, description, category, trace_json, expected_signals, created_at
            FROM sample_traces
            WHERE tenant_id = ?
            ORDER BY category, name
        """;

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, tenantId);
            ResultSet rs = stmt.executeQuery();

            List<SampleTrace> traces = new ArrayList<>();
            while (rs.next()) {
                traces.add(mapRow(rs));
            }

            log.info("Loaded {} sample traces for tenant {}", traces.size(), tenantId);
            return traces;

        } catch (Exception e) {
            log.error("Failed to load sample traces: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to load sample traces", e);
        }
    }

    /**
     * Load sample traces by category
     * @param tenantId Tenant UUID
     * @param category Category (authentication, pii, compliance)
     * @return List of sample traces in category
     */
    public List<SampleTrace> listByCategory(UUID tenantId, String category) {
        String sql = """
            SELECT id, tenant_id, name, description, category, trace_json, expected_signals, created_at
            FROM sample_traces
            WHERE tenant_id = ? AND category = ?
            ORDER BY name
        """;

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, tenantId);
            stmt.setString(2, category);
            ResultSet rs = stmt.executeQuery();

            List<SampleTrace> traces = new ArrayList<>();
            while (rs.next()) {
                traces.add(mapRow(rs));
            }

            log.debug("Loaded {} sample traces in category '{}' for tenant {}",
                    traces.size(), category, tenantId);
            return traces;

        } catch (Exception e) {
            log.error("Failed to load sample traces by category: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to load sample traces", e);
        }
    }

    /**
     * Get sample trace by ID
     * @param traceId Sample trace UUID
     * @return Sample trace
     */
    public SampleTrace getSampleTrace(UUID traceId) {
        String sql = """
            SELECT id, tenant_id, name, description, category, trace_json, expected_signals, created_at
            FROM sample_traces
            WHERE id = ?
        """;

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, traceId);
            ResultSet rs = stmt.executeQuery();

            if (rs.next()) {
                return mapRow(rs);
            }

            throw new IllegalArgumentException("Sample trace not found: " + traceId);

        } catch (Exception e) {
            log.error("Failed to get sample trace: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get sample trace", e);
        }
    }

    /**
     * Create new sample trace
     * @param sampleTrace Sample trace to create
     * @return Created sample trace with ID
     */
    public SampleTrace createSampleTrace(SampleTrace sampleTrace) {
        String sql = """
            INSERT INTO sample_traces (id, tenant_id, name, description, category, trace_json, expected_signals, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """;

        UUID id = UUID.randomUUID();

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, id);
            stmt.setObject(2, sampleTrace.getTenantId());
            stmt.setString(3, sampleTrace.getName());
            stmt.setString(4, sampleTrace.getDescription());
            stmt.setString(5, sampleTrace.getCategory());
            stmt.setString(6, sampleTrace.getTraceJson());
            stmt.setString(7, sampleTrace.getExpectedSignals());
            stmt.setObject(8, sampleTrace.getCreatedBy());

            stmt.executeUpdate();

            log.info("Created sample trace: id={}, name={}", id, sampleTrace.getName());

            sampleTrace.setId(id);
            return sampleTrace;

        } catch (Exception e) {
            log.error("Failed to create sample trace: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to create sample trace", e);
        }
    }

    /**
     * Delete sample trace
     * @param traceId Sample trace UUID
     */
    public void deleteSampleTrace(UUID traceId) {
        String sql = "DELETE FROM sample_traces WHERE id = ?";

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, traceId);
            int deleted = stmt.executeUpdate();

            if (deleted == 0) {
                throw new IllegalArgumentException("Sample trace not found: " + traceId);
            }

            log.info("Deleted sample trace: {}", traceId);

        } catch (Exception e) {
            log.error("Failed to delete sample trace: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete sample trace", e);
        }
    }

    /**
     * Initialize default sample traces for new tenant
     * @param tenantId Tenant UUID
     */
    public void initializeDefaultTraces(UUID tenantId, UUID userId) {
        log.info("Initializing default sample traces for tenant {}", tenantId);

        // Authentication traces
        createDefaultTrace(tenantId, userId, "auth-failure-invalid-jwt",
                "Auth Failure - Invalid JWT",
                "Authentication failure due to expired JWT token",
                "authentication",
                getAuthFailureInvalidJwtJson(),
                "{\"shouldFire\": true, \"signal\": \"auth_failure\"}");

        createDefaultTrace(tenantId, userId, "auth-failure-missing-header",
                "Auth Failure - Missing Header",
                "Authentication failure due to missing Authorization header",
                "authentication",
                getAuthFailureMissingHeaderJson(),
                "{\"shouldFire\": true, \"signal\": \"auth_failure\"}");

        createDefaultTrace(tenantId, userId, "auth-success",
                "Auth Success",
                "Successful authentication flow with valid JWT",
                "authentication",
                getAuthSuccessJson(),
                "{\"shouldFire\": false}");

        // PII traces
        createDefaultTrace(tenantId, userId, "pii-leak-unredacted-ssn",
                "PII Leak - Unredacted SSN",
                "SSN present in span attributes without redaction",
                "pii",
                getPiiLeakUnredactedSsnJson(),
                "{\"shouldFire\": true, \"signal\": \"pii_leak\"}");

        createDefaultTrace(tenantId, userId, "pii-leak-email-in-logs",
                "PII Leak - Email in Logs",
                "Email address exposed in log message",
                "pii",
                getPiiLeakEmailInLogsJson(),
                "{\"shouldFire\": true, \"signal\": \"pii_leak\"}");

        createDefaultTrace(tenantId, userId, "pii-compliant",
                "PII Compliant",
                "PII properly redacted in all spans",
                "pii",
                getPiiCompliantJson(),
                "{\"shouldFire\": false}");

        // Compliance traces
        createDefaultTrace(tenantId, userId, "compliance-unsigned-span",
                "Compliance - Unsigned Span",
                "Compliance span missing cryptographic signature",
                "compliance",
                getComplianceUnsignedSpanJson(),
                "{\"shouldFire\": true, \"signal\": \"compliance_violation\"}");

        createDefaultTrace(tenantId, userId, "compliance-missing-evidence",
                "Compliance - Missing Evidence",
                "SOC2 control executed without evidence span",
                "compliance",
                getComplianceMissingEvidenceJson(),
                "{\"shouldFire\": true, \"signal\": \"compliance_violation\"}");

        log.info("Initialized {} default sample traces for tenant {}", 8, tenantId);
    }

    private void createDefaultTrace(UUID tenantId, UUID userId, String name,
                                     String displayName, String description,
                                     String category, String traceJson,
                                     String expectedSignals) {
        SampleTrace trace = new SampleTrace();
        trace.setTenantId(tenantId);
        trace.setName(displayName);
        trace.setDescription(description);
        trace.setCategory(category);
        trace.setTraceJson(traceJson);
        trace.setExpectedSignals(expectedSignals);
        trace.setCreatedBy(userId);

        createSampleTrace(trace);
    }

    private SampleTrace mapRow(ResultSet rs) throws Exception {
        SampleTrace trace = new SampleTrace();
        trace.setId((UUID) rs.getObject("id"));
        trace.setTenantId((UUID) rs.getObject("tenant_id"));
        trace.setName(rs.getString("name"));
        trace.setDescription(rs.getString("description"));
        trace.setCategory(rs.getString("category"));
        trace.setTraceJson(rs.getString("trace_json"));
        trace.setExpectedSignals(rs.getString("expected_signals"));
        trace.setCreatedAt(rs.getTimestamp("created_at").toInstant());
        return trace;
    }

    // Placeholder methods - actual JSON in resource files
    private String getAuthFailureInvalidJwtJson() {
        return loadTraceFromResource("sample-traces/auth-failure-invalid-jwt.json");
    }

    private String getAuthFailureMissingHeaderJson() {
        return loadTraceFromResource("sample-traces/auth-failure-missing-header.json");
    }

    private String getAuthSuccessJson() {
        return loadTraceFromResource("sample-traces/auth-success.json");
    }

    private String getPiiLeakUnredactedSsnJson() {
        return loadTraceFromResource("sample-traces/pii-leak-unredacted-ssn.json");
    }

    private String getPiiLeakEmailInLogsJson() {
        return loadTraceFromResource("sample-traces/pii-leak-email-in-logs.json");
    }

    private String getPiiCompliantJson() {
        return loadTraceFromResource("sample-traces/pii-compliant.json");
    }

    private String getComplianceUnsignedSpanJson() {
        return loadTraceFromResource("sample-traces/compliance-unsigned-span.json");
    }

    private String getComplianceMissingEvidenceJson() {
        return loadTraceFromResource("sample-traces/compliance-missing-evidence.json");
    }

    private String loadTraceFromResource(String resourcePath) {
        try {
            return new String(getClass().getClassLoader()
                    .getResourceAsStream(resourcePath)
                    .readAllBytes());
        } catch (Exception e) {
            log.error("Failed to load trace resource: {}", resourcePath, e);
            return "{}";
        }
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Sample traces stored in DuckDB (not TigerBeetle - these are fixtures, not events)
**ADR-013 (Camel-First):** Used by LoadSampleTracesProcessor in Camel route
**ADR-014 (Named Processors):** Service injected into processors
**ADR-015 (Tiered Storage):** DuckDB storage (hot tier) - no archival needed

## DuckDB Schema

```sql
CREATE TABLE sample_traces (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,  -- authentication, pii, compliance
    trace_json TEXT NOT NULL,  -- OTLP trace JSON
    expected_signals TEXT,  -- JSON describing expected rule matches
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX idx_sample_traces_tenant ON sample_traces(tenant_id);
CREATE INDEX idx_sample_traces_category ON sample_traces(tenant_id, category);
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testListSampleTraces - returns all traces for tenant
- testListByCategory - filters by category (authentication, pii, compliance)
- testGetSampleTrace - retrieves specific trace by ID
- testGetSampleTrace_NotFound - throws exception when trace doesn't exist
- testCreateSampleTrace - inserts new trace with UUID
- testDeleteSampleTrace - removes trace from library
- testDeleteSampleTrace_NotFound - throws exception
- testInitializeDefaultTraces - creates 8+ default traces for new tenant
- testTenantIsolation - tenant A cannot see tenant B traces

**Integration Tests:**
- testFullWorkflow_CreateListDelete - create trace → list → delete
- testDefaultTraces_ValidOtlpJson - all default traces parse as valid OTLP

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Tenant data leakage - mitigate with tenant_id filter on all queries
- Malicious trace JSON - mitigate with validation before storage
- Resource exhaustion (large traces) - mitigate with size limit (1MB per trace)
- SQL injection - mitigate with prepared statements
- Unauthorized trace access - mitigate with RBAC checks

**Compliance:**
- SOC2 CC6.1 (Access Control) - tenant isolation enforced
- SOC2 CC8.1 (Change Management) - sample traces aid testing process

## Success Criteria

- [ ] List all sample traces for tenant
- [ ] Filter sample traces by category
- [ ] Create custom sample traces
- [ ] Delete sample traces
- [ ] Initialize 8+ default traces for new tenants
- [ ] Tenant isolation enforced
- [ ] All tests pass with 90% coverage
