# PRD-021C: Health & Observability

**Priority:** P2 (Medium - Operational)
**Complexity:** Low
**Personas:** SRE, Platform
**Dependencies:** PRD-021A (circuit breakers), PRD-021B (backpressure)
**Implements:** /health endpoint, graceful shutdown, degraded mode visibility

## Problem

BeTrace lacks operational visibility during degraded states:
- **No health endpoint**: Load balancers cannot detect degraded state
- **Binary health**: Service is "up" or "down", no degraded mode visibility
- **No graceful shutdown**: SIGTERM kills process immediately → data loss
- **Hidden failures**: Circuit breakers open, but frontend shows "healthy"

**Impact:**
- Load balancers route traffic to degraded instances
- Rolling deployments lose in-flight spans
- SREs discover issues via user reports, not monitoring
- No compliance evidence of system health (SOC2 CC7.2)

## Solution

### Health Check Endpoint

**MicroProfile Health API:**
```java
@ApplicationScoped
@Liveness
public class BeTraceLivenessCheck implements HealthCheck {
    @Override
    public HealthCheckResponse call() {
        // Liveness: Process is running (no deadlocks, OOM)
        return HealthCheckResponse.up("betrace-liveness");
    }
}

@ApplicationScoped
@Readiness
public class BeTraceReadinessCheck implements HealthCheck {
    @Inject TenantCircuitBreakerManager breakerManager;
    @Inject SpanIngestionQueue queue;
    @Inject DuckDBHealthCheck duckdb;
    @Inject TigerBeetleHealthCheck tigerbeetle;

    @Override
    public HealthCheckResponse call() {
        HealthCheckResponseBuilder builder = HealthCheckResponse.named("betrace-readiness");

        // Check dependencies
        boolean duckdbHealthy = duckdb.isHealthy();
        boolean tigerbeetleHealthy = tigerbeetle.isHealthy();
        int queueUsage = queue.getQueueUsage();

        // Overall status
        if (!tigerbeetleHealthy) {
            // Critical dependency down
            return builder.down()
                .withData("tigerbeetle", "DOWN")
                .withData("reason", "Signal persistence unavailable")
                .build();
        }

        if (!duckdbHealthy || queueUsage > 80) {
            // Degraded but operational
            return builder.up()
                .withData("status", "DEGRADED")
                .withData("duckdb", duckdbHealthy ? "UP" : "DOWN")
                .withData("tigerbeetle", "UP")
                .withData("queue_usage_percent", queueUsage)
                .withData("degraded_modes", getDegradedModes())
                .build();
        }

        // Fully healthy
        return builder.up()
            .withData("duckdb", "UP")
            .withData("tigerbeetle", "UP")
            .withData("queue_usage_percent", queueUsage)
            .build();
    }

    private List<String> getDegradedModes() {
        List<String> modes = new ArrayList<>();

        if (!duckdb.isHealthy()) {
            modes.add("trace_analytics_disabled");
        }

        if (queue.getQueueUsage() > 80) {
            modes.add("backpressure_active");
        }

        return modes;
    }
}
```

**Public vs. Admin Health Endpoints:**
```java
@Path("/health")
@ApplicationScoped
public class HealthEndpoint {
    @GET
    @Path("/public")
    @Produces(MediaType.APPLICATION_JSON)
    public Response publicHealth() {
        // Public health: minimal info for load balancers
        String status = healthService.getOverallStatus(); // "UP" | "DEGRADED" | "DOWN"
        return Response.ok(Map.of("status", status)).build();
    }

    @GET
    @Path("/detailed")
    @RolesAllowed("admin") // P0 Security: Require authentication
    @Produces(MediaType.APPLICATION_JSON)
    public Response detailedHealth(@Context SecurityContext ctx) {
        // Admin health: full diagnostics
        return Response.ok(Map.of(
            "status", healthService.getOverallStatus(),
            "checks", healthService.getAllChecks(),
            "degraded_modes", healthService.getDegradedModes(),
            "backpressure", Map.of(
                "span_queue_usage", queue.getQueueUsage(),
                "signal_queue_usage", signalQueue.getQueueUsage()
            ),
            "circuit_breakers", healthService.getCircuitBreakerStates(ctx.getUserPrincipal().getName())
        )).build();
    }
}
```

### Graceful Shutdown

**Shutdown Manager:**
```java
@ApplicationScoped
public class GracefulShutdownManager {
    @Inject SpanIngestionQueue spanQueue;
    @Inject SignalQueue signalQueue;
    @Inject HttpServer server;

    @ConfigProperty(name = "shutdown.graceful.timeout", defaultValue = "120s")
    Duration shutdownTimeout;

    @PreDestroy
    public void shutdown() {
        log.info("Graceful shutdown initiated");
        Instant deadline = Instant.now().plus(shutdownTimeout);

        try {
            // Step 1: Stop accepting new requests (return 503)
            server.stopAcceptingRequests();
            log.info("HTTP server stopped accepting requests");

            // Step 2: Drain span queue
            log.info("Draining span queue: {} spans", spanQueue.size());
            while (!spanQueue.isEmpty() && Instant.now().isBefore(deadline)) {
                SpanBatch batch = spanQueue.poll(100, TimeUnit.MILLISECONDS);
                if (batch != null) {
                    processSpanBatch(batch);
                }
            }

            // Step 3: Flush signal queue
            log.info("Flushing signal queue: {} signals", signalQueue.size());
            while (!signalQueue.isEmpty() && Instant.now().isBefore(deadline)) {
                Signal signal = signalQueue.poll(100, TimeUnit.MILLISECONDS);
                if (signal != null) {
                    persistSignal(signal);
                }
            }

            // Step 4: Verify clean shutdown
            int spansLost = spanQueue.size();
            int signalsLost = signalQueue.size();

            if (spansLost > 0 || signalsLost > 0) {
                log.error("Shutdown timeout: {} spans lost, {} signals lost", spansLost, signalsLost);
                metrics.record("shutdown.data_loss", "spans", spansLost, "signals", signalsLost);

                // P1 Security: Spillover to emergency storage
                spilloverStorage.save(spanQueue.drain(), signalQueue.drain());
            } else {
                log.info("Graceful shutdown complete: no data loss");
                metrics.record("shutdown.graceful", "success", true);
            }

        } catch (InterruptedException e) {
            log.error("Shutdown interrupted", e);
            Thread.currentThread().interrupt();
        } finally {
            server.close();
        }
    }
}
```

**Spillover Storage (Emergency Backup):**
```java
@ApplicationScoped
public class SpilloverStorage {
    @ConfigProperty(name = "spillover.s3.bucket")
    Optional<String> s3Bucket;

    public void save(List<SpanBatch> spans, List<Signal> signals) {
        if (s3Bucket.isEmpty()) {
            log.warn("No spillover storage configured, data lost");
            return;
        }

        String timestamp = Instant.now().toString();
        String spanFile = "spillover/" + timestamp + "/spans.json";
        String signalFile = "spillover/" + timestamp + "/signals.json";

        try {
            s3Client.putObject(s3Bucket.get(), spanFile, Json.encode(spans));
            s3Client.putObject(s3Bucket.get(), signalFile, Json.encode(signals));

            log.info("Spillover saved: {} spans, {} signals", spans.size(), signals.size());
            metrics.record("spillover.saved", "spans", spans.size(), "signals", signals.size());
        } catch (Exception e) {
            log.error("Failed to save spillover", e);
        }
    }
}
```

### Degraded Mode WebSocket Broadcast

**Real-time Degradation Notifications:**
```java
@ApplicationScoped
public class DegradedModeNotifier {
    @Inject WebSocketManager wsManager;

    private Set<String> activeModes = ConcurrentHashMap.newKeySet();

    public void activateDegradedMode(String mode) {
        if (activeModes.add(mode)) {
            log.warnf("Degraded mode activated: %s", mode);
            metrics.record("degraded_mode.active", "mode", mode, "value", 1);

            // Broadcast to all connected WebSocket clients
            wsManager.broadcast(Map.of(
                "type", "degraded_mode_activated",
                "mode", mode,
                "timestamp", Instant.now().toString()
            ));
        }
    }

    public void deactivateDegradedMode(String mode) {
        if (activeModes.remove(mode)) {
            log.infof("Degraded mode deactivated: %s", mode);
            metrics.record("degraded_mode.active", "mode", mode, "value", 0);

            wsManager.broadcast(Map.of(
                "type", "degraded_mode_deactivated",
                "mode", mode,
                "timestamp", Instant.now().toString()
            ));
        }
    }

    public Set<String> getActiveModes() {
        return Collections.unmodifiableSet(activeModes);
    }
}
```

**Frontend Handling:**
```typescript
// bff/src/lib/api/websocket.ts
socket.on('degraded_mode_activated', (data) => {
  toast.warning(`System degraded: ${data.mode}`, {
    description: 'Some features may be unavailable',
    duration: 0, // Persistent toast
  });

  // Update UI state
  setSystemStatus('degraded');
  setDegradedModes((prev) => [...prev, data.mode]);
});

socket.on('degraded_mode_deactivated', (data) => {
  toast.success(`System recovered: ${data.mode}`);

  // Update UI state
  setDegradedModes((prev) => prev.filter((m) => m !== data.mode));
  if (getDegradedModes().length === 0) {
    setSystemStatus('healthy');
  }
});
```

## Configuration

**File:** `application.properties`

```properties
# Health Checks
quarkus.smallrye-health.enabled=true
quarkus.smallrye-health.liveness.enabled=true
quarkus.smallrye-health.readiness.enabled=true

# Graceful Shutdown
shutdown.graceful.timeout=120s
shutdown.spillover.enabled=true
shutdown.spillover.s3.bucket=betrace-spillover

# Degraded Mode Thresholds
degraded.queue.threshold=80  # Queue usage percentage
degraded.circuit-breaker.threshold=3  # Number of open breakers
```

## Security Requirements

### P0 (Blocking)

**1. Health Endpoint Authentication**
- `/health/public` MUST be unauthenticated (for load balancers)
- `/health/detailed` MUST require admin role
- Implementation:
```java
@GET
@Path("/detailed")
@RolesAllowed("admin")
public Response detailedHealth(@Context SecurityContext ctx) {
    auditLog.log("HEALTH_CHECK_ACCESS", ctx.getUserPrincipal().getName());
    return Response.ok(healthData()).build();
}
```

**2. Sanitized Error Messages**
- Health check errors MUST NOT leak internal details
- Sanitize: stack traces, IP addresses, SQL fragments
```java
private String sanitizeError(String error) {
    return error
        .replaceAll("\\d+\\.\\d+\\.\\d+\\.\\d+", "REDACTED")
        .replaceAll("SQL.*", "Database error")
        .replaceAll("Exception.*\\n.*", "Internal error");
}
```

**3. Rate Limiting on Health Checks**
- `/health/detailed` rate limited to 10 req/min per admin
- Implementation: Guava `RateLimiter` with admin principal as key

### P1 (High Priority)

**4. Audit Logging**
- All `/health/detailed` accesses logged
- Log format:
```json
{
  "event": "health_check_access",
  "admin_id": "admin@example.com",
  "timestamp": "2025-10-11T10:23:45.123Z",
  "response_status": 200
}
```

**5. Spillover Encryption**
- Spillover storage (S3) MUST use encryption at rest
- Configuration: `spillover.s3.encryption=AES256`

## Acceptance Criteria

### Functional Requirements

**Health Endpoint:**
```gherkin
Scenario: Public health returns minimal info
  Given system is healthy
  When GET /health/public
  Then response is 200 OK
  And response body is {"status": "UP"}
  And response does NOT contain dependency details

Scenario: Detailed health requires authentication
  Given unauthenticated request
  When GET /health/detailed
  Then response is 401 Unauthorized

Scenario: Detailed health shows degraded state
  Given DuckDB circuit breaker is OPEN
  When GET /health/detailed with admin token
  Then response is 200 OK
  And response contains:
    - "status": "DEGRADED"
    - "checks.duckdb.status": "DOWN"
    - "degraded_modes": ["trace_analytics_disabled"]
```

**Graceful Shutdown:**
```gherkin
Scenario: Shutdown drains span queue
  Given span queue has 1000 spans
  When SIGTERM received
  Then HTTP server stops accepting requests (503)
  And span queue drains (all 1000 spans processed)
  And process exits within 120s
  And metric "shutdown.graceful{success=true}" == 1

Scenario: Shutdown timeout saves spillover
  Given span queue has 100,000 spans (cannot drain in 120s)
  When SIGTERM received
  Then process waits 120s
  And remaining spans saved to S3 spillover
  And metric "spillover.saved{spans=X}" recorded
  And process exits

Scenario: Shutdown with no data loss
  Given no spans or signals queued
  When SIGTERM received
  Then process exits immediately
  And metric "shutdown.graceful{success=true}" == 1
```

**Degraded Mode Notifications:**
```gherkin
Scenario: WebSocket notifies on degraded mode
  Given WebSocket client connected
  When DuckDB circuit breaker opens
  Then WebSocket message sent:
    - type: "degraded_mode_activated"
    - mode: "trace_analytics_disabled"
  And frontend displays warning toast

Scenario: WebSocket notifies on recovery
  Given degraded mode "trace_analytics_disabled" active
  When DuckDB circuit breaker closes
  Then WebSocket message sent:
    - type: "degraded_mode_deactivated"
    - mode: "trace_analytics_disabled"
  And frontend displays success toast
```

### Security Requirements

```gherkin
Scenario: Health check detailed endpoint requires admin role
  Given user with role "viewer"
  When GET /health/detailed
  Then response is 403 Forbidden

Scenario: Health check errors are sanitized
  Given DuckDB throws SQLException with stack trace
  When GET /health/detailed as admin
  Then response does NOT contain stack trace
  And response does NOT contain IP addresses
  And error message is sanitized

Scenario: Health check access is audited
  Given admin user "admin@example.com"
  When GET /health/detailed
  Then audit log contains:
    - event: "health_check_access"
    - admin_id: "admin@example.com"
    - timestamp: <ISO8601>
```

## Testing Strategy

### Unit Tests

**Health Check Logic:**
```java
@Test
void healthCheck_degradedWhenDuckDBDown() {
    when(duckdb.isHealthy()).thenReturn(false);
    when(tigerbeetle.isHealthy()).thenReturn(true);
    when(queue.getQueueUsage()).thenReturn(50);

    HealthCheckResponse response = readinessCheck.call();

    assertThat(response.getStatus()).isEqualTo(HealthCheckResponse.Status.UP);
    assertThat(response.getData().get("status")).isEqualTo("DEGRADED");
    assertThat(response.getData().get("degraded_modes")).asList()
        .contains("trace_analytics_disabled");
}
```

**Graceful Shutdown:**
```java
@Test
void shutdown_drainsQueue() {
    spanQueue.offer("tenant1", batch(100));
    spanQueue.offer("tenant2", batch(200));

    shutdownManager.shutdown();

    assertThat(spanQueue.size()).isZero();
    assertThat(processedSpans).hasSize(300);
}

@Test
void shutdown_timeoutSavesSpillover() {
    // Fill queue beyond drain capacity
    for (int i = 0; i < 100_000; i++) {
        spanQueue.offer("tenant1", span(i));
    }

    shutdownManager.shutdown();

    assertThat(spilloverStorage.getSavedSpans()).isGreaterThan(0);
}
```

### Integration Tests

**Testcontainers:**
```java
@QuarkusTest
class HealthEndpointTest {
    @Test
    void detailedHealth_requiresAuth() {
        given()
            .when().get("/health/detailed")
            .then().statusCode(401);
    }

    @Test
    void detailedHealth_showsDegradedState() {
        // Stop DuckDB container
        duckDBContainer.stop();

        given()
            .auth().oauth2(adminToken())
            .when().get("/health/detailed")
            .then()
            .statusCode(200)
            .body("status", equalTo("DEGRADED"))
            .body("checks.duckdb.status", equalTo("DOWN"));
    }
}
```

### End-to-End Tests

**Graceful Shutdown Test:**
```bash
#!/bin/bash
# Start BeTrace
nix run .#backend &
PID=$!

# Send 1000 spans
for i in {1..1000}; do
  curl -X POST http://localhost:8080/api/spans \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"traceId": "'$i'", "spanId": "test"}'
done

# Trigger graceful shutdown
kill -TERM $PID

# Wait for process to exit
wait $PID

# Verify no data loss
SPANS_LOST=$(curl http://localhost:9090/api/v1/query?query=shutdown_data_loss_spans | jq '.data.result[0].value[1]')
if [ "$SPANS_LOST" != "0" ]; then
  echo "FAIL: $SPANS_LOST spans lost"
  exit 1
fi

echo "PASS: Graceful shutdown with no data loss"
```

## Files to Create/Modify

**New Files:**
- `backend/src/main/java/com/betrace/health/BeTraceReadinessCheck.java`
- `backend/src/main/java/com/betrace/health/BeTraceLivenessCheck.java`
- `backend/src/main/java/com/betrace/health/HealthEndpoint.java`
- `backend/src/main/java/com/betrace/shutdown/GracefulShutdownManager.java`
- `backend/src/main/java/com/betrace/shutdown/SpilloverStorage.java`
- `backend/src/main/java/com/betrace/resilience/DegradedModeNotifier.java`
- `backend/src/test/java/com/betrace/health/HealthCheckTest.java`
- `backend/src/test/java/com/betrace/shutdown/GracefulShutdownTest.java`
- `bff/src/lib/api/degraded-mode-handler.ts`

**Modified Files:**
- `backend/src/main/resources/application.properties`
- `backend/pom.xml` (add SmallRye Health)
- `bff/src/lib/api/websocket.ts` (add degraded mode handlers)

## Dependencies

**Maven:**
```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-smallrye-health</artifactId>
</dependency>
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-amazon-s3</artifactId>
</dependency>
```

## Success Criteria

- [ ] `/health/public` endpoint (unauthenticated, minimal info)
- [ ] `/health/detailed` endpoint (admin-only, full diagnostics)
- [ ] Graceful shutdown drains queues (120s timeout)
- [ ] Spillover storage to S3 on shutdown timeout
- [ ] WebSocket broadcast on degraded mode activation/deactivation
- [ ] Frontend toast notifications for degraded states
- [ ] Health check errors sanitized (no stack traces, IPs)
- [ ] Rate limiting on `/health/detailed` (10 req/min)
- [ ] Audit logging for health check accesses
- [ ] Test coverage >90%
- [ ] E2E graceful shutdown test passes
