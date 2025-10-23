# PRD-024b: Camel Processors and API Routes

**Parent PRD:** PRD-024 (Grafana Integration)
**Unit:** B (API Layer)
**Priority:** P2
**Dependencies:** Unit A (GrafanaLinkService)

## Scope

Implement the Camel-based API layer for Grafana integration. This unit provides:

1. **Named Processors** (ADR-014) - Testable, single-responsibility processors
2. **Camel REST DSL Routes** (ADR-013) - API endpoints for frontend consumption
3. **Integration with Unit A** - Calls `GrafanaLinkService` from processors

This unit exposes the link generation service via RESTful API endpoints.

## Architecture Compliance

**ADR-013 (Camel-First Architecture):**
- API implemented as Camel routes, not JAX-RS
- REST DSL for endpoint definitions
- Direct routes for orchestration

**ADR-014 (Named Processors):**
- Processors annotated with `@Named` for CDI lookup
- Single responsibility per processor
- 90% test coverage requirement
- Clear exchange contracts documented

**ADR-011 (Pure Application Framework):**
- Graceful degradation when Grafana not configured
- Returns 501 Not Implemented if integration disabled

## Implementation

### File 1: Generate Grafana Link Processor

**File:** `backend/src/main/java/com/betrace/processors/grafana/GenerateGrafanaLinkProcessor.java`

```java
package com.betrace.processors.grafana;

import com.betrace.model.Signal;
import com.betrace.services.GrafanaLinkService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * Processor to generate Grafana deep link for a signal.
 *
 * Per ADR-014: Named processor for testability.
 *
 * Exchange Contract:
 * - Input: Body contains Signal object
 * - Output: Header "grafanaLink" contains URL string
 * - On Failure: Body contains error response with message
 */
@Named("generateGrafanaLinkProcessor")
@ApplicationScoped
public class GenerateGrafanaLinkProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(GenerateGrafanaLinkProcessor.class);

    @Inject
    GrafanaLinkService linkService;

    @Override
    public void process(Exchange exchange) throws Exception {
        Signal signal = exchange.getIn().getBody(Signal.class);

        if (signal == null) {
            log.warn("No signal in exchange body");
            throw new IllegalArgumentException("Signal required in exchange body");
        }

        try {
            // Generate Grafana link
            String grafanaLink = linkService.generateTraceLink(signal);

            // Store in exchange header
            exchange.getIn().setHeader("grafanaLink", grafanaLink);

            log.debug("Generated Grafana link for signal {}: {}", signal.id(), grafanaLink);

        } catch (IllegalStateException e) {
            // Grafana not configured - return graceful error
            log.debug("Grafana integration not configured: {}", e.getMessage());

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Grafana integration not configured");
            errorResponse.put("configured", false);
            errorResponse.put("message", "Configure grafana.url in application.properties");

            exchange.getIn().setBody(errorResponse);
            exchange.getIn().setHeader("grafanaLink", null);
        }
    }
}
```

### File 2: Validate Grafana Configuration Processor

**File:** `backend/src/main/java/com/betrace/processors/grafana/ValidateGrafanaConfigProcessor.java`

```java
package com.betrace.processors.grafana;

import com.betrace.config.GrafanaConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Validates Grafana configuration before generating links.
 *
 * Per ADR-014: Named processor for testability.
 *
 * Exchange Contract:
 * - Input: None
 * - Output: Header "grafanaConfigured" = true/false
 * - Output: Header "grafanaError" = error message (if not configured)
 */
@Named("validateGrafanaConfigProcessor")
@ApplicationScoped
public class ValidateGrafanaConfigProcessor implements Processor {

    @Inject
    GrafanaConfig config;

    @Override
    public void process(Exchange exchange) throws Exception {
        boolean configured = config.isConfigured();
        exchange.getIn().setHeader("grafanaConfigured", configured);

        if (!configured) {
            exchange.getIn().setHeader("grafanaError", "Grafana integration not configured");
        }
    }
}
```

### File 3: API Routes

**File:** `backend/src/main/java/com/betrace/routes/GrafanaApiRoute.java`

```java
package com.betrace.routes;

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import com.betrace.processors.grafana.GenerateGrafanaLinkProcessor;
import com.betrace.processors.grafana.ValidateGrafanaConfigProcessor;

/**
 * Camel routes for Grafana integration API.
 *
 * Per ADR-013: API implemented as Camel routes.
 */
@ApplicationScoped
public class GrafanaApiRoute extends RouteBuilder {

    @Inject
    GenerateGrafanaLinkProcessor generateGrafanaLinkProcessor;

    @Inject
    ValidateGrafanaConfigProcessor validateGrafanaConfigProcessor;

    @Override
    public void configure() throws Exception {

        // REST endpoint for Grafana link generation
        rest("/api/signals")
            .get("/{id}/grafana-link")
                .produces("application/json")
                .to("direct:getGrafanaLink");

        // REST endpoint for Grafana configuration status
        rest("/api/grafana")
            .get("/config")
                .produces("application/json")
                .to("direct:getGrafanaConfig");

        // Get Grafana link for signal
        from("direct:getGrafanaLink")
            .routeId("getGrafanaLink")
            .log("Getting Grafana link for signal: ${header.id}")
            // 1. Validate Grafana is configured
            .process(validateGrafanaConfigProcessor)
            .choice()
                .when(header("grafanaConfigured").isEqualTo(false))
                    // Return 501 Not Implemented if Grafana not configured
                    .setHeader("CamelHttpResponseCode", constant(501))
                    .setBody(simple("{\"error\": \"Grafana integration not configured\", \"configured\": false}"))
                .otherwise()
                    // 2. Fetch signal by ID (would integrate with SignalService)
                    .to("direct:getSignal")
                    // 3. Generate Grafana link
                    .process(generateGrafanaLinkProcessor)
                    // 4. Return link in response
                    .setBody(simple("{\"grafanaLink\": \"${header.grafanaLink}\", \"configured\": true}"))
            .end();

        // Get Grafana configuration status
        from("direct:getGrafanaConfig")
            .routeId("getGrafanaConfig")
            .process(validateGrafanaConfigProcessor)
            .choice()
                .when(header("grafanaConfigured").isEqualTo(true))
                    .setBody(constant("{\"configured\": true, \"available\": true}"))
                .otherwise()
                    .setBody(constant("{\"configured\": false, \"available\": false, \"message\": \"Configure grafana.url in application.properties\"}"))
            .end();
    }
}
```

## Success Criteria

**Functional:**
- [ ] `GET /api/signals/{id}/grafana-link` returns Grafana URL for valid signal
- [ ] `GET /api/signals/{id}/grafana-link` returns 501 when Grafana not configured
- [ ] `GET /api/grafana/config` returns configuration status
- [ ] Processors follow exchange contracts (headers set correctly)
- [ ] Graceful error handling when Grafana unavailable

**Quality:**
- [ ] 90% instruction coverage (ADR-014)
- [ ] 80% branch coverage
- [ ] All processors have dedicated test classes

**Performance:**
- [ ] API response time <50ms (excluding signal lookup)
- [ ] Processors are stateless and thread-safe

## Testing Requirements

### Processor Unit Tests

**File 1:** `backend/src/test/java/com/betrace/processors/grafana/GenerateGrafanaLinkProcessorTest.java`

**Test Cases:**

1. **Valid Signal Processing**
   - Given: Signal in exchange body, Grafana configured
   - When: `process(exchange)` called
   - Then: Header `grafanaLink` contains valid URL

2. **Grafana Not Configured**
   - Given: Signal in exchange body, Grafana disabled
   - When: `process(exchange)` called
   - Then: Body contains error map, header `grafanaLink` is null

3. **Missing Signal in Body**
   - Given: Exchange body is null
   - When: `process(exchange)` called
   - Then: Throws `IllegalArgumentException`

**File 2:** `backend/src/test/java/com/betrace/processors/grafana/ValidateGrafanaConfigProcessorTest.java`

**Test Cases:**

1. **Grafana Configured**
   - Given: `grafana.enabled=true`, URL present
   - When: `process(exchange)` called
   - Then: Header `grafanaConfigured` = true

2. **Grafana Not Configured**
   - Given: `grafana.enabled=false`
   - When: `process(exchange)` called
   - Then: Header `grafanaConfigured` = false, header `grafanaError` set

### Route Integration Tests

**File:** `backend/src/test/java/com/betrace/routes/GrafanaApiRouteTest.java`

**Test Cases:**

1. **GET /api/signals/{id}/grafana-link - Success**
   - Given: Valid signal ID, Grafana configured
   - When: GET request sent
   - Then: 200 OK, JSON contains `grafanaLink` field

2. **GET /api/signals/{id}/grafana-link - Not Configured**
   - Given: Valid signal ID, Grafana disabled
   - When: GET request sent
   - Then: 501 Not Implemented, JSON contains `configured: false`

3. **GET /api/grafana/config - Configured**
   - Given: Grafana enabled
   - When: GET request sent
   - Then: 200 OK, JSON contains `configured: true, available: true`

4. **GET /api/grafana/config - Not Configured**
   - Given: Grafana disabled
   - When: GET request sent
   - Then: 200 OK, JSON contains `configured: false, available: false`

### Test Coverage Targets (ADR-014)

- **Instruction Coverage:** 90% minimum
- **Branch Coverage:** 80% minimum
- **Processor Coverage:** 95% (critical path)

### Example Test

```java
@Test
void testProcess_validSignal() throws Exception {
    // Given
    Signal signal = Signal.create(
        "rule-1", "v1", "span-123", "trace-456",
        Signal.SignalSeverity.HIGH, "Test", null, "test", "tenant-1"
    );

    String expectedLink = "https://grafana.example.com/explore?...";
    when(linkService.generateTraceLink(signal)).thenReturn(expectedLink);

    Exchange exchange = new DefaultExchange(context);
    exchange.getIn().setBody(signal);

    // When
    processor.process(exchange);

    // Then
    assertThat(exchange.getIn().getHeader("grafanaLink", String.class))
        .isEqualTo(expectedLink);
    verify(linkService).generateTraceLink(signal);
}
```

## Files to Create

**Processors:**
- `backend/src/main/java/com/betrace/processors/grafana/GenerateGrafanaLinkProcessor.java` (~60 lines)
- `backend/src/main/java/com/betrace/processors/grafana/ValidateGrafanaConfigProcessor.java` (~30 lines)

**Routes:**
- `backend/src/main/java/com/betrace/routes/GrafanaApiRoute.java` (~80 lines)

**Tests:**
- `backend/src/test/java/com/betrace/processors/grafana/GenerateGrafanaLinkProcessorTest.java` (~150 lines)
- `backend/src/test/java/com/betrace/processors/grafana/ValidateGrafanaConfigProcessorTest.java` (~80 lines)
- `backend/src/test/java/com/betrace/routes/GrafanaApiRouteTest.java` (~200 lines)

**Total:** ~600 lines (170 lines implementation, 430 lines tests)

## Files to Modify

None - This unit only creates new files.

## API Specification

### Endpoint 1: Get Grafana Link for Signal

**Request:**
```http
GET /api/signals/{id}/grafana-link
Accept: application/json
```

**Response (Success - Grafana Configured):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "grafanaLink": "https://grafana.example.com/explore?orgId=1&left=%7B...",
  "configured": true
}
```

**Response (Grafana Not Configured):**
```http
HTTP/1.1 501 Not Implemented
Content-Type: application/json

{
  "error": "Grafana integration not configured",
  "configured": false
}
```

### Endpoint 2: Get Grafana Configuration Status

**Request:**
```http
GET /api/grafana/config
Accept: application/json
```

**Response (Configured):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "configured": true,
  "available": true
}
```

**Response (Not Configured):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "configured": false,
  "available": false,
  "message": "Configure grafana.url in application.properties"
}
```

## Dependencies

**Depends On:**
- **Unit A:** `GrafanaLinkService` - Called by `GenerateGrafanaLinkProcessor`
- **Unit A:** `GrafanaConfig` - Used by `ValidateGrafanaConfigProcessor`
- **Existing:** `SignalService` - Route integrates with `direct:getSignal`

**Provides For:**
- **Unit C:** API endpoints for frontend consumption

## Integration Points

### Integration with Existing Routes

The route `direct:getGrafanaLink` calls `direct:getSignal` to fetch the signal. This assumes an existing route:

```java
from("direct:getSignal")
    .routeId("getSignal")
    .setBody(simple("${bean:signalService.findById(${header.id})}"));
```

If this route doesn't exist, Unit B implementation should coordinate with Signal Management (PRD-008) team.

## Estimated Implementation Time

**Total:** ~4 hours (0.5 days)
- Processors: 1 hour
- Routes: 1 hour
- Unit tests: 1.5 hours
- Integration tests: 30 minutes

## Security Considerations

**API Security:**
- Endpoints should be protected by existing authentication (assumed from PRD-008)
- No tenant ID validation in this unit (deferred to `direct:getSignal` route)
- Configuration endpoint returns only boolean flags (no sensitive data)

**Error Handling:**
- 501 Not Implemented for disabled integration (semantic HTTP status)
- Detailed error messages guide consumers on configuration

## Post-Implementation Checklist

- [ ] All processor tests pass with 90%+ coverage
- [ ] Route integration tests verify API contracts
- [ ] Endpoints callable via `curl` or Postman
- [ ] Integration with `direct:getSignal` verified
- [ ] Ready for Unit C integration (frontend)
- [ ] API documented in OpenAPI spec (if applicable)

## Camel Route Orchestration

### Route Flow: Get Grafana Link

```
GET /api/signals/{id}/grafana-link
    ↓
direct:getGrafanaLink
    ↓
ValidateGrafanaConfigProcessor → Set header "grafanaConfigured"
    ↓
Choice:
    ├─ If grafanaConfigured = false
    │   ↓
    │   Return 501 with error message
    │
    └─ Otherwise
        ↓
        direct:getSignal → Fetch Signal by ID
        ↓
        GenerateGrafanaLinkProcessor → Set header "grafanaLink"
        ↓
        Return 200 with Grafana URL
```

### Route Flow: Get Config Status

```
GET /api/grafana/config
    ↓
direct:getGrafanaConfig
    ↓
ValidateGrafanaConfigProcessor → Set header "grafanaConfigured"
    ↓
Choice:
    ├─ If grafanaConfigured = true
    │   ↓
    │   Return {"configured": true, "available": true}
    │
    └─ Otherwise
        ↓
        Return {"configured": false, "available": false}
```

## Notes

**ADR-013 Compliance:**
- Uses Camel REST DSL (not JAX-RS)
- Orchestration via direct routes
- Processors injected via CDI

**ADR-014 Compliance:**
- Processors annotated with `@Named`
- Single responsibility per processor
- Clear exchange contracts documented
- 90% test coverage enforced
