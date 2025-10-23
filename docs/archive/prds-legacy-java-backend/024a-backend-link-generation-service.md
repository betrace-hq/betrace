# PRD-024a: Backend Link Generation Service

**Parent PRD:** PRD-024 (Grafana Integration)
**Unit:** A (Foundation)
**Priority:** P2
**Dependencies:** None (foundation unit)

## Scope

Implement the core backend service layer for generating Grafana Tempo deep links. This unit provides:

1. **Configuration Management** (`GrafanaConfig`) - Consumer-configurable Grafana URL, datasource, and time buffers
2. **Link Generation Logic** (`GrafanaLinkService`) - URL encoding, time range calculation, JSON formatting

This is a **pure service layer** with no API exposure or Camel integration. Other units will consume this service.

## Architecture Compliance

**ADR-011 (Pure Application Framework):**
- Grafana URL is **consumer-configured** via `application.properties`
- BeTrace does NOT bundle or deploy Grafana
- Service generates links to consumer's existing Grafana instance

**ADR-014 (Named Processors):**
- Service layer follows single responsibility principle
- Pure business logic (no infrastructure concerns)
- 90% test coverage requirement

## Implementation

### File 1: Configuration Service

**File:** `backend/src/main/java/com/betrace/config/GrafanaConfig.java`

```java
package com.betrace.config;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.util.Optional;

/**
 * Configuration for Grafana integration.
 * Consumer-configured per ADR-011 (deployment-agnostic).
 */
@ApplicationScoped
public class GrafanaConfig {

    @ConfigProperty(name = "grafana.url")
    Optional<String> grafanaUrl;

    @ConfigProperty(name = "grafana.tempo.datasource", defaultValue = "tempo")
    String tempoDatasource;

    @ConfigProperty(name = "grafana.org-id", defaultValue = "1")
    Integer orgId;

    @ConfigProperty(name = "grafana.enabled", defaultValue = "false")
    Boolean enabled;

    @ConfigProperty(name = "grafana.time-buffer-before-minutes", defaultValue = "5")
    Integer timeBufferBeforeMinutes;

    @ConfigProperty(name = "grafana.time-buffer-after-minutes", defaultValue = "10")
    Integer timeBufferAfterMinutes;

    @ConfigProperty(name = "grafana.span-highlighting.enabled", defaultValue = "false")
    Boolean spanHighlightingEnabled;

    public boolean isConfigured() {
        return enabled && grafanaUrl.isPresent();
    }

    public String getGrafanaUrl() {
        return grafanaUrl.orElseThrow(() ->
            new IllegalStateException("Grafana URL not configured")
        );
    }

    public String getTempoDatasource() {
        return tempoDatasource;
    }

    public Integer getOrgId() {
        return orgId;
    }

    public Integer getTimeBufferBeforeMinutes() {
        return timeBufferBeforeMinutes;
    }

    public Integer getTimeBufferAfterMinutes() {
        return timeBufferAfterMinutes;
    }

    public boolean isSpanHighlightingEnabled() {
        return spanHighlightingEnabled;
    }
}
```

### File 2: Link Generation Service

**File:** `backend/src/main/java/com/betrace/services/GrafanaLinkService.java`

```java
package com.betrace.services;

import com.betrace.config.GrafanaConfig;
import com.betrace.model.Signal;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/**
 * Generates Grafana Tempo deep links for trace investigation.
 *
 * Per ADR-011: Grafana URL is consumer-configured, not bundled.
 * This service only generates URLs - deployment is external.
 */
@ApplicationScoped
public class GrafanaLinkService {

    private static final Logger log = LoggerFactory.getLogger(GrafanaLinkService.class);

    @Inject
    GrafanaConfig config;

    /**
     * Generate Grafana Explore URL for a signal's trace.
     *
     * @param signal Signal containing trace ID and timestamp
     * @return Grafana deep link URL
     * @throws IllegalStateException if Grafana not configured
     */
    public String generateTraceLink(Signal signal) {
        if (!config.isConfigured()) {
            throw new IllegalStateException(
                "Grafana integration not configured. Set grafana.url and grafana.enabled=true"
            );
        }

        String traceId = signal.traceId();
        Instant traceTime = signal.timestamp();

        return generateTraceLink(traceId, traceTime, Optional.ofNullable(signal.spanId()));
    }

    /**
     * Generate Grafana Explore URL for a trace ID.
     *
     * @param traceId OpenTelemetry trace ID
     * @param traceTime Approximate trace timestamp
     * @param spanId Optional span ID for highlighting
     * @return Grafana deep link URL
     */
    public String generateTraceLink(String traceId, Instant traceTime, Optional<String> spanId) {
        if (!config.isConfigured()) {
            throw new IllegalStateException("Grafana integration not configured");
        }

        // Calculate time range with buffer
        Instant startTime = traceTime.minus(config.getTimeBufferBeforeMinutes(), ChronoUnit.MINUTES);
        Instant endTime = traceTime.plus(config.getTimeBufferAfterMinutes(), ChronoUnit.MINUTES);

        // Build Tempo query JSON
        String queryJson = buildTempoQueryJson(traceId, startTime, endTime);

        // URL encode the JSON
        String encodedQuery = urlEncode(queryJson);

        // Build full Grafana URL
        StringBuilder url = new StringBuilder(config.getGrafanaUrl());
        url.append("/explore?orgId=").append(config.getOrgId());
        url.append("&left=").append(encodedQuery);

        // Add span highlighting if enabled and span ID provided
        if (config.isSpanHighlightingEnabled() && spanId.isPresent()) {
            url.append("&spanId=").append(urlEncode(spanId.get()));
        }

        log.debug("Generated Grafana link for trace {}: {}", traceId, url);
        return url.toString();
    }

    /**
     * Build Tempo query JSON structure.
     */
    private String buildTempoQueryJson(String traceId, Instant startTime, Instant endTime) {
        // Convert to epoch milliseconds for Grafana
        long startMs = startTime.toEpochMilli();
        long endMs = endTime.toEpochMilli();

        // Build JSON manually (simple structure, avoids Jackson dependency)
        return String.format(
            "{\"datasource\":\"%s\",\"queries\":[{\"refId\":\"A\",\"queryType\":\"traceql\",\"query\":\"%s\"}],\"range\":{\"from\":\"%d\",\"to\":\"%d\"}}",
            config.getTempoDatasource(),
            traceId,
            startMs,
            endMs
        );
    }

    /**
     * URL encode a string for query parameters.
     */
    private String urlEncode(String value) {
        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8.toString());
        } catch (UnsupportedEncodingException e) {
            // UTF-8 is always supported
            throw new RuntimeException("UTF-8 encoding not supported", e);
        }
    }

    /**
     * Check if Grafana integration is available.
     */
    public boolean isAvailable() {
        return config.isConfigured();
    }
}
```

## Success Criteria

**Functional:**
- [ ] `GrafanaConfig` loads configuration from `application.properties`
- [ ] `GrafanaLinkService.generateTraceLink()` generates valid Grafana URLs
- [ ] URL encoding prevents special character injection
- [ ] Time range calculation includes before/after buffers
- [ ] Span highlighting appended when enabled
- [ ] Service throws `IllegalStateException` when Grafana not configured

**Quality:**
- [ ] 90% instruction coverage (ADR-014)
- [ ] 80% branch coverage
- [ ] All edge cases tested (see Testing Requirements)

**Performance:**
- [ ] Link generation completes in <10ms (pure computation)
- [ ] Thread-safe (stateless service)

## Testing Requirements

### Unit Tests

**File:** `backend/src/test/java/com/betrace/services/GrafanaLinkServiceTest.java`

**Test Cases:**

1. **Valid Link Generation**
   - Given: Configured Grafana, valid signal
   - When: `generateTraceLink(signal)` called
   - Then: Returns valid URL with trace ID, time range, datasource

2. **URL Encoding**
   - Given: Trace ID with special characters (hypothetical edge case)
   - When: `generateTraceLink()` called
   - Then: URL is properly encoded (no raw `{`, `}`, `"`)

3. **Not Configured Exception**
   - Given: `grafana.enabled=false`
   - When: `generateTraceLink()` called
   - Then: Throws `IllegalStateException` with helpful message

4. **Span Highlighting Enabled**
   - Given: `span-highlighting.enabled=true`, signal has span ID
   - When: `generateTraceLink()` called
   - Then: URL contains `&spanId={span-id}`

5. **Span Highlighting Disabled**
   - Given: `span-highlighting.enabled=false`
   - When: `generateTraceLink()` called
   - Then: URL does NOT contain `&spanId=`

6. **Time Range Calculation**
   - Given: Trace timestamp `2025-01-15T10:30:00Z`, buffers 5 min before / 10 min after
   - When: `generateTraceLink()` called
   - Then: URL contains `from=1736936700000`, `to=1736937600000`

7. **Configuration Status**
   - Given: Grafana enabled and URL present
   - When: `isAvailable()` called
   - Then: Returns `true`

8. **Configuration Status - Not Configured**
   - Given: Grafana disabled or URL missing
   - When: `isAvailable()` called
   - Then: Returns `false`

### Test Coverage Targets (ADR-014)

- **Instruction Coverage:** 90% minimum
- **Branch Coverage:** 80% minimum
- **Critical Path:** 95% coverage (link generation, URL encoding)

### Example Test

```java
@Test
void testGenerateTraceLink_validSignal() {
    // Given
    when(config.isConfigured()).thenReturn(true);
    when(config.getGrafanaUrl()).thenReturn("https://grafana.example.com");
    when(config.getTempoDatasource()).thenReturn("tempo");
    when(config.getOrgId()).thenReturn(1);
    when(config.getTimeBufferBeforeMinutes()).thenReturn(5);
    when(config.getTimeBufferAfterMinutes()).thenReturn(10);

    Signal signal = Signal.create(
        "rule-1", "v1", "span-123", "trace-456",
        Signal.SignalSeverity.HIGH, "Test signal", null, "test", "tenant-1"
    );

    // When
    String link = service.generateTraceLink(signal);

    // Then
    assertThat(link).startsWith("https://grafana.example.com/explore?orgId=1&left=");
    assertThat(link).contains("trace-456");
    assertThat(link).contains("tempo");
    // Verify JSON is URL-encoded
    assertThat(link).doesNotContain("{");
    assertThat(link).contains("%22"); // Encoded quote
}
```

## Files to Create

**Source Files:**
- `backend/src/main/java/com/betrace/config/GrafanaConfig.java` (~60 lines)
- `backend/src/main/java/com/betrace/services/GrafanaLinkService.java` (~100 lines)

**Test Files:**
- `backend/src/test/java/com/betrace/services/GrafanaLinkServiceTest.java` (~200 lines)
- `backend/src/test/java/com/betrace/config/GrafanaConfigTest.java` (~50 lines)

**Total:** ~410 lines (150 lines implementation, 260 lines tests)

## Files to Modify

**Configuration:**
- `backend/src/main/resources/application.properties` - Add Grafana properties

```properties
# Grafana Integration (optional, consumer-configured per ADR-011)
grafana.url=
grafana.tempo.datasource=tempo
grafana.org-id=1
grafana.enabled=false
grafana.time-buffer-before-minutes=5
grafana.time-buffer-after-minutes=10
grafana.span-highlighting.enabled=false
```

## Configuration Examples

### Self-Hosted Grafana
```properties
grafana.url=https://grafana.internal.company.com
grafana.tempo.datasource=tempo
grafana.org-id=1
grafana.enabled=true
```

### Grafana Cloud
```properties
grafana.url=https://mycompany.grafana.net
grafana.tempo.datasource=grafanacloud-traces
grafana.org-id=123456
grafana.enabled=true
```

### Disabled (Default)
```properties
grafana.enabled=false
```

## Dependencies for Next Units

**Unit B (Camel Processors)** will depend on:
- `GrafanaLinkService.generateTraceLink(Signal)` - Called by processors
- `GrafanaLinkService.isAvailable()` - Validation in routes

**Unit C (Frontend)** will depend on:
- Unit B's API endpoints (not directly on this service)

## Estimated Implementation Time

**Total:** ~4 hours (0.5 days)
- Configuration class: 30 minutes
- Link service implementation: 1.5 hours
- Unit tests: 2 hours

## Security Considerations

**URL Injection Prevention:**
- All query parameters URL-encoded via `URLEncoder.encode()`
- Trace IDs validated against OpenTelemetry hex format (inherited from Signal validation)
- No raw user input in configuration (deployment-time only)

**Configuration Security:**
- Grafana URL not exposed to frontend (backend-only)
- Configuration is read-only after deployment
- No runtime modification of Grafana URL

## Post-Implementation Checklist

- [ ] All tests pass with 90%+ coverage
- [ ] Configuration properties documented
- [ ] Service callable from other components
- [ ] Error messages guide consumers on configuration
- [ ] Ready for Unit B integration (processors)
