# PRD-018c: Integration Test Harness

**Priority:** P1 (Infrastructure - Test Foundation)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-018 (Comprehensive Test Suite)
**Dependencies:** PRD-002 (TigerBeetle), PRD-018a (TestFixtureGenerator)

## Problem

Integration tests require running real TigerBeetle and DuckDB instances. No standardized way to start/stop these services for tests. Manual setup is slow and error-prone. Tests fail if services aren't running.

## Solution

Implement Testcontainers-based integration test harness that automatically starts TigerBeetle and DuckDB before tests and cleans up afterward. Provide isolated test environments per test class. Support parallel test execution.

## Unit Description

**Files:**
- `backend/src/test/java/com/fluo/test/harness/TigerBeetleTestResource.java`
- `backend/src/test/java/com/fluo/test/harness/DuckDBTestResource.java`
- `backend/src/test/java/com/fluo/test/harness/IntegrationTestProfile.java`

**Type:** Quarkus Test Resources
**Purpose:** Start/stop external dependencies for integration tests

## Implementation

```java
// ============ TIGERBEETLE TEST RESOURCE ============

package com.fluo.test.harness;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.HashMap;
import java.util.Map;

/**
 * Testcontainers resource for TigerBeetle
 * Starts TigerBeetle container before tests, stops after
 */
public class TigerBeetleTestResource implements QuarkusTestResourceLifecycleManager {

    private static final int TIGERBEETLE_PORT = 3000;
    private GenericContainer<?> tigerBeetleContainer;

    @Override
    public Map<String, String> start() {
        // Start TigerBeetle container
        tigerBeetleContainer = new GenericContainer<>(
                DockerImageName.parse("ghcr.io/tigerbeetle/tigerbeetle:latest"))
                .withExposedPorts(TIGERBEETLE_PORT)
                .withCommand("start", "--addresses=0.0.0.0:3000", "/data/test.tigerbeetle")
                .withCreateContainerCmdModifier(cmd -> cmd.withEntrypoint(
                    "/bin/sh", "-c",
                    "tigerbeetle format --cluster=0 --replica=0 /data/test.tigerbeetle && " +
                    "tigerbeetle start --addresses=0.0.0.0:3000 /data/test.tigerbeetle"
                ));

        tigerBeetleContainer.start();

        // Get mapped port
        Integer mappedPort = tigerBeetleContainer.getMappedPort(TIGERBEETLE_PORT);
        String tigerBeetleAddress = "127.0.0.1:" + mappedPort;

        System.out.println("TigerBeetle test container started on: " + tigerBeetleAddress);

        // Return config properties for Quarkus
        Map<String, String> config = new HashMap<>();
        config.put("tigerbeetle.cluster.id", "0");
        config.put("tigerbeetle.replica.addresses", tigerBeetleAddress);

        return config;
    }

    @Override
    public void stop() {
        if (tigerBeetleContainer != null) {
            tigerBeetleContainer.stop();
            System.out.println("TigerBeetle test container stopped");
        }
    }
}

// ============ DUCKDB TEST RESOURCE ============

package com.fluo.test.harness;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * Test resource for DuckDB
 * Creates ephemeral in-memory database for tests
 */
public class DuckDBTestResource implements QuarkusTestResourceLifecycleManager {

    private Path tempDatabasePath;

    @Override
    public Map<String, String> start() {
        try {
            // Create temporary directory for DuckDB test database
            tempDatabasePath = Files.createTempDirectory("duckdb-test-");
            File dbFile = new File(tempDatabasePath.toFile(), "test.duckdb");

            String jdbcUrl = "jdbc:duckdb:" + dbFile.getAbsolutePath();

            System.out.println("DuckDB test database created: " + jdbcUrl);

            // Return config properties for Quarkus
            Map<String, String> config = new HashMap<>();
            config.put("quarkus.datasource.duckdb.jdbc.url", jdbcUrl);
            config.put("quarkus.datasource.duckdb.jdbc.driver", "org.duckdb.DuckDBDriver");

            return config;
        } catch (Exception e) {
            throw new RuntimeException("Failed to create DuckDB test database", e);
        }
    }

    @Override
    public void stop() {
        if (tempDatabasePath != null) {
            try {
                // Delete temporary database
                Files.walk(tempDatabasePath)
                        .sorted((a, b) -> b.compareTo(a)) // Delete files before directories
                        .forEach(path -> {
                            try {
                                Files.delete(path);
                            } catch (Exception e) {
                                System.err.println("Failed to delete: " + path);
                            }
                        });
                System.out.println("DuckDB test database deleted");
            } catch (Exception e) {
                System.err.println("Failed to clean up DuckDB test database: " + e.getMessage());
            }
        }
    }
}

// ============ INTEGRATION TEST PROFILE ============

package com.fluo.test.harness;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.HashMap;
import java.util.Map;

/**
 * Quarkus test profile for integration tests
 * Configures isolated test environment
 */
public class IntegrationTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        Map<String, String> config = new HashMap<>();

        // Use test-specific configuration
        config.put("quarkus.log.level", "INFO");
        config.put("quarkus.log.category.\"com.fluo\".level", "DEBUG");

        // Disable production features
        config.put("quarkus.scheduler.enabled", "false");

        // Use in-memory cache for tests
        config.put("quarkus.cache.caffeine.expire-after-write", "60S");

        return config;
    }

    @Override
    public String getConfigProfile() {
        return "test";
    }
}

// ============ BASE INTEGRATION TEST CLASS ============

package com.fluo.test.harness;

import com.fluo.test.fixtures.TestFixtureGenerator;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.common.QuarkusTestResource;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;

/**
 * Base class for integration tests
 * Automatically starts TigerBeetle and DuckDB
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@QuarkusTestResource(TigerBeetleTestResource.class)
@QuarkusTestResource(DuckDBTestResource.class)
public abstract class BaseIntegrationTest {

    @Inject
    protected TestFixtureGenerator fixtures;

    @BeforeEach
    public void baseSetup() {
        // Common setup for all integration tests
        cleanupTestData();
    }

    protected void cleanupTestData() {
        // Clean up any leftover test data
        // Called before each test to ensure isolation
    }
}

// ============ EXAMPLE INTEGRATION TEST ============

package com.fluo.integration;

import com.fluo.model.*;
import com.fluo.services.*;
import com.fluo.test.harness.BaseIntegrationTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test example showing full workflow
 */
class SignalCreationIntegrationTest extends BaseIntegrationTest {

    @Inject
    TenantService tenantService;

    @Inject
    RuleService ruleService;

    @Inject
    SignalService signalService;

    @Inject
    SpanIngestionService spanIngestionService;

    @Test
    @DisplayName("Signal creation flows through TigerBeetle → DuckDB → API")
    void testSignalCreationWorkflow() {
        // Given: Tenant with rule
        TestTenant testTenant = fixtures.createTenant("Integration Test Corp");
        UUID tenantId = testTenant.id;

        Rule rule = fixtures.createDetectPIILeakRule(tenantId);
        ruleService.createRule(rule);

        // When: Ingest spans that match rule
        List<Span> piiSpans = fixtures.createPIILeakTrace();
        spanIngestionService.ingestSpans(tenantId, piiSpans);

        // Wait for async processing (in real tests, use Awaitility)
        try { Thread.sleep(1000); } catch (InterruptedException e) {}

        // Then: Signal created in database
        List<Signal> signals = signalService.getSignalsForTenant(tenantId);
        assertThat(signals).hasSize(1);

        Signal signal = signals.get(0);
        assertThat(signal.getRuleId()).isEqualTo(rule.getId());
        assertThat(signal.getSeverity()).isEqualTo("critical");
        assertThat(signal.getStatus()).isEqualTo("open");
    }

    @Test
    @DisplayName("Multiple tenants are isolated in TigerBeetle")
    void testTenantIsolation() {
        // Given: Two tenants with same rule
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        Rule rule1 = fixtures.createDetectPIILeakRule(tenant1.id);
        Rule rule2 = fixtures.createDetectPIILeakRule(tenant2.id);

        ruleService.createRule(rule1);
        ruleService.createRule(rule2);

        // When: Tenant 1 ingests matching spans
        List<Span> spans = fixtures.createPIILeakTrace();
        spanIngestionService.ingestSpans(tenant1.id, spans);

        try { Thread.sleep(1000); } catch (InterruptedException e) {}

        // Then: Only tenant 1 has signal
        List<Signal> signals1 = signalService.getSignalsForTenant(tenant1.id);
        List<Signal> signals2 = signalService.getSignalsForTenant(tenant2.id);

        assertThat(signals1).hasSize(1);
        assertThat(signals2).isEmpty();
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Testcontainers runs real TigerBeetle for integration tests
**ADR-013 (Camel-First):** Integration tests validate Camel routes with real services
**ADR-014 (Named Processors):** Integration tests validate processor chains
**ADR-015 (Tiered Storage):** Tests validate data flow through TigerBeetle → DuckDB

## Test Requirements (QA Expert)

**Unit Tests:**
- testTigerBeetleResource_Starts - container starts successfully
- testTigerBeetleResource_ReturnsConfig - config properties are correct
- testDuckDBResource_CreatesDatabase - temporary database created
- testDuckDBResource_CleansUp - database deleted after test
- testIntegrationProfile_OverridesConfig - test config applied

**Integration Tests:**
- testFullWorkflow_TigerBeetleToDuckDB - data flows through both systems
- testParallelTests_Isolated - parallel tests don't interfere

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Test data leakage - mitigate with ephemeral containers
- Port conflicts - mitigate with random port assignment
- Resource exhaustion - mitigate with container limits

**Compliance:**
- SOC2 CC8.1 (Change Management) - integration tests validate system behavior

## Success Criteria

- [ ] TigerBeetle Testcontainer starts automatically before tests
- [ ] DuckDB ephemeral database created for each test
- [ ] BaseIntegrationTest class for common setup
- [ ] Test isolation between test classes
- [ ] Automatic cleanup after tests
- [ ] Support for parallel test execution
- [ ] All tests pass with 90% coverage
