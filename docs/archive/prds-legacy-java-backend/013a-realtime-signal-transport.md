# PRD-013a: Real-time Signal Transport

**Status:** Draft
**Created:** 2025-10-10
**Dependencies:** None
**Depended By:** PRD-013b (SRE Dashboard UI)

## Problem Statement

SREs need real-time visibility into signals as they're created. Current polling-based refresh is insufficient:

- **Incident Detection Delays**: 5-30 second polling intervals hide active incidents
- **Resource Waste**: Constant polling consumes bandwidth and backend CPU
- **Missed Critical Alerts**: No notification mechanism when high-severity signals appear
- **Scale Limitations**: Polling doesn't scale beyond 50-100 concurrent SRE dashboards

**Business Impact:**
- Mean time to detection (MTTD) increases by 15-30 seconds
- Wasted backend resources handling empty poll responses
- SREs miss critical signals during incident response

## Solution

### WebSocket-Based Signal Streaming

Implement bidirectional WebSocket transport for push-based signal delivery:

```java
@ServerEndpoint("/api/v1/ws/signals")
@Authenticated
public class SignalWebSocketEndpoint {

    @Inject SignalBroadcastService broadcastService;
    @Inject SecurityContext securityContext;
    @Inject MetricsService metrics;

    private static final Map<String, Set<Session>> tenantSessions = new ConcurrentHashMap<>();
    private static final Map<String, String> sessionToTenant = new ConcurrentHashMap<>();

    @OnOpen
    public void onOpen(Session session, @PathParam("token") String jwtToken) {
        try {
            // Extract and validate tenant from JWT
            String tenantId = validateTokenAndExtractTenant(jwtToken);

            // Register session for tenant-scoped broadcasts
            tenantSessions.computeIfAbsent(tenantId, k -> ConcurrentHashMap.newKeySet())
                .add(session);
            sessionToTenant.put(session.getId(), tenantId);

            log.info("WebSocket opened for tenant {}: session {}", tenantId, session.getId());
            metrics.incrementCounter("websocket.connections.opened", "tenant", tenantId);

            // Send initial state (last 50 signals)
            sendInitialState(session, tenantId);

        } catch (AuthenticationException e) {
            log.warn("WebSocket authentication failed: {}", e.getMessage());
            try {
                session.close(new CloseReason(
                    CloseReason.CloseCodes.CANNOT_ACCEPT,
                    "Authentication failed: " + e.getMessage()
                ));
            } catch (IOException closeEx) {
                log.error("Failed to close unauthenticated session", closeEx);
            }
        }
    }

    @OnClose
    public void onClose(Session session, CloseReason reason) {
        String tenantId = sessionToTenant.remove(session.getId());
        if (tenantId != null) {
            Set<Session> sessions = tenantSessions.get(tenantId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    tenantSessions.remove(tenantId);
                }
            }

            log.info("WebSocket closed: session {} for tenant {} (reason: {})",
                    session.getId(), tenantId, reason);
            metrics.incrementCounter("websocket.connections.closed",
                                    "tenant", tenantId,
                                    "reason", reason.getCloseCode().toString());
        }
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        String tenantId = sessionToTenant.get(session.getId());
        if (tenantId == null) {
            log.warn("Received message from unregistered session: {}", session.getId());
            return;
        }

        // Heartbeat mechanism
        if ("ping".equals(message)) {
            session.getAsyncRemote().sendText("pong");
            metrics.incrementCounter("websocket.heartbeat", "tenant", tenantId);
            return;
        }

        log.warn("Unexpected client message: {} from session {}", message, session.getId());
    }

    @OnError
    public void onError(Session session, Throwable error) {
        String tenantId = sessionToTenant.get(session.getId());
        log.error("WebSocket error for session {} (tenant: {})",
                 session.getId(), tenantId, error);

        onClose(session, new CloseReason(
            CloseReason.CloseCodes.UNEXPECTED_CONDITION,
            "Internal error"
        ));

        if (tenantId != null) {
            metrics.incrementCounter("websocket.errors", "tenant", tenantId);
        }
    }
}
```

### Message Format Specification

#### Signal Created Event
```json
{
  "type": "signal.created",
  "timestamp": "2025-10-10T12:34:56.789Z",
  "payload": {
    "id": "sig_01HQXYZ123",
    "tenantId": "tenant_456",
    "ruleId": "rule_789",
    "ruleName": "PII Access Without Audit",
    "traceId": "abc123def456",
    "severity": "HIGH",
    "status": "OPEN",
    "title": "PII Access Without Audit Log",
    "description": "Trace contains PII access without corresponding audit event",
    "createdAt": "2025-10-10T12:34:56.789Z"
  }
}
```

#### Signal Updated Event
```json
{
  "type": "signal.updated",
  "timestamp": "2025-10-10T12:35:00.000Z",
  "payload": {
    "id": "sig_01HQXYZ123",
    "status": "INVESTIGATING",
    "updatedAt": "2025-10-10T12:35:00.000Z",
    "updatedBy": "user_abc"
  }
}
```

#### Stats Updated Event
```json
{
  "type": "stats.updated",
  "timestamp": "2025-10-10T12:34:57.000Z",
  "payload": {
    "openSignals": 42,
    "criticalSignals": 3,
    "signalsLast24h": 156,
    "meanTimeToResolution": 3600
  }
}
```

## Acceptance Criteria

### Connection Management
- **AC1**: WebSocket connection requires valid JWT token (401 if missing/invalid)
- **AC2**: Tenant ID extracted from JWT, never from client message
- **AC3**: Client receives initial state (last 50 signals) within 500ms
- **AC4**: Connection closed on JWT expiry
- **AC5**: Heartbeat ping/pong every 30 seconds

### Message Delivery
- **AC6**: Signal created event delivered within 500ms (p95)
- **AC7**: Message order preserved per tenant (FIFO)
- **AC8**: Failed sends logged with session ID
- **AC9**: Broadcast to 100 sessions completes in < 100ms

### Tenant Isolation
- **AC10**: Tenant A never receives Tenant B signals
- **AC11**: Stats updates scoped to single tenant
- **AC12**: Cross-tenant leakage tests pass

### Security
- **AC13**: JWT validated on every connection
- **AC14**: Rate limit: 10 messages/sec per client
- **AC15**: Message size limit: 1MB max
- **AC16**: Connection limit: 10 concurrent per tenant

## Security Requirements

- **Authentication**: JWT token in WebSocket URL
- **Authorization**: Tenant ID from JWT claim only
- **Rate Limiting**: 10 msg/sec per client
- **Audit Logging**: Connection events, auth failures

## Performance Requirements

- **Latency**: < 500ms message delivery (p95)
- **Throughput**: 1K signals/sec broadcast
- **Connections**: 1K concurrent connections
- **Memory**: 1KB per session

## Test Requirements

- **Unit Tests**: 20 tests (lifecycle, JWT, rate limiting)
- **Integration Tests**: 15 tests (end-to-end, reconnection)
- **Load Tests**: 5 tests (1K connections, 1K signals/sec)
- **Security Tests**: 8 tests (tenant isolation, token validation)

## Dependencies

- Quarkus WebSocket extension
- JWT authentication service
- Signal repository
- Metrics service
