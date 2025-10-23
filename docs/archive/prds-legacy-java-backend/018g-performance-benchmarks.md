# PRD-018g: Performance Benchmarks

**Priority:** P1 (Performance - Production Readiness)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-018 (Comprehensive Test Suite)
**Dependencies:** PRD-004 (Rule Engine), PRD-008 (Signal Management), PRD-018a (TestFixtureGenerator)

## Problem

BeTrace lacks performance benchmarks for critical paths: rule evaluation, TigerBeetle writes, long-lived trace management. No baseline metrics for performance regression detection. No validation that system meets throughput requirements (1000+ spans/sec).

## Solution

Implement JMH (Java Microbenchmark Harness) benchmarks for critical performance paths. Establish baseline metrics and track performance trends over time. Integrate benchmarks into CI/CD for regression detection.

## Unit Description

**Files:** `backend/src/test/java/com/betrace/benchmarks/`
**Type:** JMH Benchmark Classes
**Purpose:** Measure and track performance of critical system components

## Implementation

```java
// ============ DROOLS RULE EVALUATION BENCHMARK ============

package com.betrace.benchmarks;

import com.betrace.model.Span;
import com.betrace.services.DroolsRuleEngine;
import com.betrace.test.fixtures.TestFixtureGenerator;
import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.infra.Blackhole;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Benchmark for Drools rule evaluation performance
 * Measures throughput (ops/sec) for rule matching
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
@Warmup(iterations = 3, time = 5)
@Measurement(iterations = 5, time = 10)
@Fork(1)
public class DroolsRuleEvaluationBench {

    @State(Scope.Benchmark)
    public static class BenchmarkState {
        DroolsRuleEngine ruleEngine;
        TestFixtureGenerator fixtures;

        List<Span> smallTrace;    // 10 spans
        List<Span> mediumTrace;   // 100 spans
        List<Span> largeTrace;    // 1000 spans

        String simpleDrl;   // Single rule
        String complexDrl;  // 10 rules with complex conditions

        @Setup(Level.Trial)
        public void setup() {
            ruleEngine = new DroolsRuleEngine();
            fixtures = new TestFixtureGenerator();

            // Generate test traces
            smallTrace = generateTrace(10);
            mediumTrace = generateTrace(100);
            largeTrace = generateTrace(1000);

            // Generate DRL rules
            simpleDrl = generateSimpleDrl();
            complexDrl = generateComplexDrl();
        }

        private List<Span> generateTrace(int spanCount) {
            // Generate realistic trace with N spans
            return fixtures.createTestTrace(spanCount);
        }

        private String generateSimpleDrl() {
            return """
                package com.betrace.rules;
                rule "Detect PII Leak"
                when
                    $span : Span(attributes["user_ssn"] != null)
                then
                    // Signal generation
                end
                """;
        }

        private String generateComplexDrl() {
            // Generate 10 rules with complex conditions
            return """
                package com.betrace.rules;
                rule "Complex Rule 1"
                when
                    $span : Span(attributes["http.status_code"] == 401)
                    Number(intValue >= 5) from accumulate(
                        Span($tid : traceId),
                        count($tid)
                    )
                then
                    // Signal generation
                end
                // ... 9 more complex rules
                """;
        }
    }

    @Benchmark
    public void evaluateSimpleRule_SmallTrace(BenchmarkState state, Blackhole bh) {
        int rulesFired = state.ruleEngine.evaluate(state.simpleDrl, state.smallTrace);
        bh.consume(rulesFired);
    }

    @Benchmark
    public void evaluateSimpleRule_MediumTrace(BenchmarkState state, Blackhole bh) {
        int rulesFired = state.ruleEngine.evaluate(state.simpleDrl, state.mediumTrace);
        bh.consume(rulesFired);
    }

    @Benchmark
    public void evaluateSimpleRule_LargeTrace(BenchmarkState state, Blackhole bh) {
        int rulesFired = state.ruleEngine.evaluate(state.simpleDrl, state.largeTrace);
        bh.consume(rulesFired);
    }

    @Benchmark
    public void evaluateComplexRules_MediumTrace(BenchmarkState state, Blackhole bh) {
        int rulesFired = state.ruleEngine.evaluate(state.complexDrl, state.mediumTrace);
        bh.consume(rulesFired);
    }

    /**
     * Expected results:
     * - Simple rule + small trace: 10,000+ ops/sec
     * - Simple rule + medium trace: 1,000+ ops/sec
     * - Simple rule + large trace: 100+ ops/sec
     * - Complex rules + medium trace: 500+ ops/sec
     */
}

// ============ TIGERBEETLE WRITE BENCHMARK ============

package com.betrace.benchmarks;

import com.tigerbeetle.*;
import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.infra.Blackhole;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Benchmark for TigerBeetle write performance
 * Measures throughput for transfer creation
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
@Warmup(iterations = 3, time = 5)
@Measurement(iterations = 5, time = 10)
@Fork(1)
public class TigerBeetleWriteBench {

    @State(Scope.Benchmark)
    public static class BenchmarkState {
        TigerBeetleClient client;
        List<Transfer> singleTransfer;
        List<Transfer> batchTransfers10;
        List<Transfer> batchTransfers100;

        @Setup(Level.Trial)
        public void setup() throws Exception {
            // Connect to TigerBeetle test instance
            client = new TigerBeetleClient(0, new String[]{"127.0.0.1:3000"});

            // Prepare transfers
            singleTransfer = List.of(createTransfer());
            batchTransfers10 = createTransferBatch(10);
            batchTransfers100 = createTransferBatch(100);
        }

        @TearDown(Level.Trial)
        public void teardown() {
            client.close();
        }

        private Transfer createTransfer() {
            Transfer transfer = new Transfer();
            transfer.setId(uuidToUInt128(UUID.randomUUID()));
            transfer.setDebitAccountId(uuidToUInt128(UUID.randomUUID()));
            transfer.setCreditAccountId(uuidToUInt128(UUID.randomUUID()));
            transfer.setAmount(1);
            transfer.setCode(1);
            transfer.setLedger(1);
            return transfer;
        }

        private List<Transfer> createTransferBatch(int size) {
            List<Transfer> transfers = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                transfers.add(createTransfer());
            }
            return transfers;
        }

        private UInt128 uuidToUInt128(UUID uuid) {
            return new UInt128(uuid.getMostSignificantBits(), uuid.getLeastSignificantBits());
        }
    }

    @Benchmark
    public void writeSingleTransfer(BenchmarkState state, Blackhole bh) throws Exception {
        CreateTransferResult result = state.client.createTransfers(
            state.singleTransfer.toArray(new Transfer[0])
        );
        bh.consume(result);
    }

    @Benchmark
    public void writeBatch10Transfers(BenchmarkState state, Blackhole bh) throws Exception {
        CreateTransferResult result = state.client.createTransfers(
            state.batchTransfers10.toArray(new Transfer[0])
        );
        bh.consume(result);
    }

    @Benchmark
    public void writeBatch100Transfers(BenchmarkState state, Blackhole bh) throws Exception {
        CreateTransferResult result = state.client.createTransfers(
            state.batchTransfers100.toArray(new Transfer[0])
        );
        bh.consume(result);
    }

    /**
     * Expected results:
     * - Single transfer: 50,000+ ops/sec
     * - Batch 10 transfers: 5,000+ batches/sec (50,000 transfers/sec)
     * - Batch 100 transfers: 500+ batches/sec (50,000 transfers/sec)
     */
}

// ============ LONG-LIVED TRACE MEMORY BENCHMARK ============

package com.betrace.benchmarks;

import com.betrace.model.Span;
import com.betrace.services.TenantSessionManager;
import com.betrace.test.fixtures.TestFixtureGenerator;
import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.infra.Blackhole;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Benchmark for long-lived trace memory management
 * Measures memory usage and cleanup performance
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
@Warmup(iterations = 3, time = 5)
@Measurement(iterations = 5, time = 10)
@Fork(1)
public class LongLivedTraceMemoryBench {

    @State(Scope.Benchmark)
    public static class BenchmarkState {
        TenantSessionManager sessionManager;
        TestFixtureGenerator fixtures;
        UUID tenantId;

        @Setup(Level.Trial)
        public void setup() {
            sessionManager = new TenantSessionManager();
            fixtures = new TestFixtureGenerator();
            tenantId = UUID.randomUUID();
        }
    }

    @Benchmark
    public void ingestAndCleanup_1000Traces(BenchmarkState state, Blackhole bh) {
        // Simulate ingesting 1000 long-lived traces
        for (int i = 0; i < 1000; i++) {
            String traceId = UUID.randomUUID().toString();
            List<Span> spans = state.fixtures.createTestTrace(50); // 50 spans per trace

            // Ingest spans
            state.sessionManager.addSpansToTrace(state.tenantId, traceId, spans);
        }

        // Measure cleanup performance
        long startMemory = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();

        state.sessionManager.cleanupExpiredTraces(state.tenantId, 3600000); // 1 hour TTL

        long endMemory = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
        long memoryFreed = startMemory - endMemory;

        bh.consume(memoryFreed);
    }

    @Benchmark
    public void lookup_ActiveTrace(BenchmarkState state, Blackhole bh) {
        // Add trace
        String traceId = UUID.randomUUID().toString();
        List<Span> spans = state.fixtures.createTestTrace(50);
        state.sessionManager.addSpansToTrace(state.tenantId, traceId, spans);

        // Measure lookup performance
        List<Span> retrieved = state.sessionManager.getTraceSpans(state.tenantId, traceId);
        bh.consume(retrieved);
    }

    /**
     * Expected results:
     * - Ingest and cleanup 1000 traces: <100ms
     * - Lookup active trace: <1ms
     */
}

// ============ DUCKDB QUERY BENCHMARK ============

package com.betrace.benchmarks;

import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.infra.Blackhole;

import java.sql.*;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Benchmark for DuckDB query performance
 * Measures query throughput for signals, spans, rules
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
@Warmup(iterations = 3, time = 5)
@Measurement(iterations = 5, time = 10)
@Fork(1)
public class DuckDBQueryBench {

    @State(Scope.Benchmark)
    public static class BenchmarkState {
        Connection conn;
        UUID tenantId;

        @Setup(Level.Trial)
        public void setup() throws Exception {
            // Connect to DuckDB test database
            conn = DriverManager.getConnection("jdbc:duckdb:test.duckdb");
            tenantId = UUID.randomUUID();

            // Insert test data
            insertTestData();
        }

        @TearDown(Level.Trial)
        public void teardown() throws Exception {
            conn.close();
        }

        private void insertTestData() throws Exception {
            // Insert 10,000 signals
            String insertSql = "INSERT INTO signals VALUES (?, ?, ?, ?, ?, ?)";
            try (PreparedStatement stmt = conn.prepareStatement(insertSql)) {
                for (int i = 0; i < 10000; i++) {
                    stmt.setObject(1, UUID.randomUUID());
                    stmt.setObject(2, tenantId);
                    stmt.setObject(3, UUID.randomUUID());
                    stmt.setString(4, "trace_" + i);
                    stmt.setString(5, i % 4 == 0 ? "critical" : "high");
                    stmt.setTimestamp(6, new Timestamp(System.currentTimeMillis()));
                    stmt.executeUpdate();
                }
            }
        }
    }

    @Benchmark
    public void querySignalsByTenant(BenchmarkState state, Blackhole bh) throws Exception {
        String sql = "SELECT * FROM signals WHERE tenant_id = ?";
        try (PreparedStatement stmt = state.conn.prepareStatement(sql)) {
            stmt.setObject(1, state.tenantId);
            try (ResultSet rs = stmt.executeQuery()) {
                int count = 0;
                while (rs.next()) {
                    count++;
                }
                bh.consume(count);
            }
        }
    }

    @Benchmark
    public void querySignalsBySeverity(BenchmarkState state, Blackhole bh) throws Exception {
        String sql = "SELECT * FROM signals WHERE tenant_id = ? AND severity = 'critical'";
        try (PreparedStatement stmt = state.conn.prepareStatement(sql)) {
            stmt.setObject(1, state.tenantId);
            try (ResultSet rs = stmt.executeQuery()) {
                int count = 0;
                while (rs.next()) {
                    count++;
                }
                bh.consume(count);
            }
        }
    }

    /**
     * Expected results:
     * - Query signals by tenant: 5,000+ ops/sec
     * - Query signals by severity: 10,000+ ops/sec (smaller result set)
     */
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Benchmarks measure TigerBeetle write performance
**ADR-013 (Camel-First):** Benchmarks measure route processor performance
**ADR-014 (Named Processors):** Benchmarks measure individual processor performance
**ADR-015 (Tiered Storage):** Benchmarks measure query performance across tiers

## Performance Targets

**Rule Evaluation (Drools):**
- Simple rule + 10 spans: 10,000+ ops/sec
- Simple rule + 100 spans: 1,000+ ops/sec
- Complex rules + 100 spans: 500+ ops/sec

**TigerBeetle Writes:**
- Single transfer: 50,000+ ops/sec
- Batch 100 transfers: 50,000+ transfers/sec

**Long-Lived Traces:**
- Cleanup 1000 traces: <100ms
- Lookup active trace: <1ms

**DuckDB Queries:**
- Query signals by tenant: 5,000+ ops/sec
- Query signals by severity: 10,000+ ops/sec

## Maven Configuration

```xml
<!-- pom.xml -->
<dependencies>
    <dependency>
        <groupId>org.openjdk.jmh</groupId>
        <artifactId>jmh-core</artifactId>
        <version>1.37</version>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>org.openjdk.jmh</groupId>
        <artifactId>jmh-generator-annprocess</artifactId>
        <version>1.37</version>
        <scope>test</scope>
    </dependency>
</dependencies>

<profiles>
    <profile>
        <id>benchmark</id>
        <build>
            <plugins>
                <plugin>
                    <groupId>org.codehaus.mojo</groupId>
                    <artifactId>exec-maven-plugin</artifactId>
                    <executions>
                        <execution>
                            <goals>
                                <goal>java</goal>
                            </goals>
                        </execution>
                    </executions>
                    <configuration>
                        <mainClass>org.openjdk.jmh.Main</mainClass>
                    </configuration>
                </plugin>
            </plugins>
        </build>
    </profile>
</profiles>
```

## Test Requirements (QA Expert)

**Benchmarks:**
- DroolsRuleEvaluationBench - rule evaluation throughput
- TigerBeetleWriteBench - transfer write throughput
- LongLivedTraceMemoryBench - memory management performance
- DuckDBQueryBench - query performance

**Execution:**
```bash
mvn test -Pbenchmark
```

**Test Coverage:** Not applicable (performance benchmarks)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Performance test DOS - mitigate with isolated benchmark environment
- Resource exhaustion - mitigate with controlled test data

**Compliance:**
- SOC2 CC7.2 (System Monitoring) - performance benchmarks track system health

## Success Criteria

- [ ] Drools rule evaluation benchmarks (simple + complex rules)
- [ ] TigerBeetle write benchmarks (single + batch)
- [ ] Long-lived trace memory benchmarks
- [ ] DuckDB query benchmarks
- [ ] All benchmarks meet performance targets
- [ ] Benchmark results integrated into CI/CD
- [ ] Performance regression detection enabled
