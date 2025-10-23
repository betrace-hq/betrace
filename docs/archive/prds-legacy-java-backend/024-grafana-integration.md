# PRD-024: Grafana Integration

**Priority:** P2 (Polish & Scale - Post-MVP)
**Complexity:** Medium
**Personas:** SRE, Developer (investigating signals)
**Dependencies:**
- PRD-008 (Signal Management System) - Signal data model
- PRD-011 (Signal Investigation Workflow) - Signal detail page
- PRD-009 (Trace Ingestion Pipeline) - Trace ID correlation

## Problem

**Current State:**
SREs investigating signals in BeTrace must manually context-switch to Grafana to view trace details:
1. See signal in BeTrace with trace ID `abc123`
2. Copy trace ID to clipboard
3. Open Grafana in another tab
4. Navigate to Explore > Tempo
5. Manually paste trace ID and search
6. Wait for trace to load, then investigate

**Pain Points:**
- **Broken Investigation Flow**: Context switching breaks investigation momentum
- **Manual Trace Lookup**: Copy-paste is error-prone and slow
- **No Deep Linking**: Can't bookmark specific traces from BeTrace
- **Time Wasted**: 30-60 seconds per signal lookup (adds up across 100+ signals/day)
- **Lost Context**: Switching tabs loses BeTrace signal context

**User Story:**
> "As an SRE investigating a slow database query signal, I want to click one button to see the full trace in Grafana, so I can understand the performance bottleneck without manually searching for the trace ID."

**Impact:**
- SREs spend 10-20 minutes/day manually copying trace IDs
- Investigation workflow interrupted by tool switching
- Risk of investigating wrong trace (copy-paste errors)
- Reduced signal investigation velocity

## Solution

Add **"View in Grafana"** deep link buttons throughout BeTrace UI that generate Grafana Explore URLs pre-populated with:
- Trace ID from signal
- Tempo datasource
- Time range based on trace timestamp
- Optional: Specific span highlighting

**User Experience:**
```
BeTrace Signal → Click "View in Grafana" → Grafana Explore opens with trace loaded
```

**Architecture:**
1. **Backend Service**: `GrafanaLinkService` generates Tempo deep link URLs
2. **Configuration**: Consumer-configurable Grafana URL + Tempo datasource name
3. **Frontend Component**: `ViewInGrafanaButton` opens deep links in new tab
4. **API Endpoint**: `GET /api/signals/{id}/grafana-link` returns formatted URL

**Key Constraints (ADR-011):**
- ❌ BeTrace does NOT bundle Grafana or Tempo
- ❌ BeTrace does NOT deploy observability stack
- ✅ BeTrace generates deep links to CONSUMER's Grafana instance
- ✅ Consumers configure their own Grafana URL in `application.properties`

## Architecture Integration

**ADR-011 Compliance (Pure Application Framework):**
- Grafana URL is **consumer-configured** (not bundled)
- BeTrace provides link generation logic only
- Deployment-agnostic: Works with Grafana Cloud, self-hosted, etc.

**ADR-013 Compliance (Camel-First):**
- Link generation implemented as Camel route: `direct:generateGrafanaLink`
- Uses named processors for testability

**ADR-014 Compliance (Named Processors):**
- `ExtractSignalProcessor` - Fetch signal from storage
- `GenerateGrafanaLinkProcessor` - Format Tempo URL
- `ValidateConfigurationProcessor` - Ensure Grafana URL configured

**Configuration Management:**
```properties
# Consumer configures their Grafana instance
grafana.url=https://grafana.example.com
grafana.tempo.datasource=tempo
grafana.org-id=1
grafana.enabled=true  # Disable if Grafana not available
```

## Grafana Tempo Deep Link Format

### Standard Tempo Query URL
Grafana Tempo uses the Explore interface with JSON-encoded query parameters:

```
https://{grafana-url}/explore?
  orgId={org-id}
  &left={
    "datasource": "{tempo-datasource}",
    "queries": [
      {
        "refId": "A",
        "queryType": "traceql",
        "query": "{trace-id}"
      }
    ],
    "range": {
      "from": "{start-time}",
      "to": "{end-time}"
    }
  }
```

### URL Encoding Requirements
- **Base URL**: No encoding required
- **Query Parameters**: Standard URL encoding (`%20` for space, `%22` for quotes)
- **JSON Structure**: Must be URL-encoded after JSON serialization
- **Trace ID Format**: Typically 32-character hex (OpenTelemetry standard)

### Example Generated URL

**Input:**
- Grafana URL: `https://grafana.example.com`
- Trace ID: `4bf92f3577b34da6a3ce929d0e0e4736`
- Timestamp: `2025-01-15T10:30:00Z`
- Datasource: `tempo`
- Org ID: `1`

**Output:**
```
https://grafana.example.com/explore?orgId=1&left=%7B%22datasource%22%3A%22tempo%22%2C%22queries%22%3A%5B%7B%22refId%22%3A%22A%22%2C%22queryType%22%3A%22traceql%22%2C%22query%22%3A%224bf92f3577b34da6a3ce929d0e0e4736%22%7D%5D%2C%22range%22%3A%7B%22from%22%3A%221736937000000%22%2C%22to%22%3A%221736937600000%22%7D%7D
```

### Time Range Calculation
```
Start Time = Trace Timestamp - 5 minutes (buffer before trace)
End Time = Trace Timestamp + 10 minutes (buffer after trace)
```

**Why?** Traces may have spans before/after the triggering span. Buffer ensures full trace visibility.

### Span Highlighting (Optional Enhancement)
Some Grafana versions support span ID parameters for highlighting:

```
&spanId={span-id}
```

**Note:** This is version-dependent and should be configurable.

## Implementation Details

### Backend Components

#### 1. Configuration Service

**File:** `backend/src/main/java/com/fluo/config/GrafanaConfig.java`

```java
package com.fluo.config;

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

#### 2. Grafana Link Service

**File:** `backend/src/main/java/com/fluo/services/GrafanaLinkService.java`

```java
package com.fluo.services;

import com.fluo.config.GrafanaConfig;
import com.fluo.model.Signal;
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

#### 3. Camel Processors (ADR-014)

**File:** `backend/src/main/java/com/fluo/processors/grafana/GenerateGrafanaLinkProcessor.java`

```java
package com.fluo.processors.grafana;

import com.fluo.model.Signal;
import com.fluo.services.GrafanaLinkService;
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

**File:** `backend/src/main/java/com/fluo/processors/grafana/ValidateGrafanaConfigProcessor.java`

```java
package com.fluo.processors.grafana;

import com.fluo.config.GrafanaConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Validates Grafana configuration before generating links.
 *
 * Per ADR-014: Named processor for testability.
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

#### 4. API Route (ADR-013)

**File:** `backend/src/main/java/com/fluo/routes/GrafanaApiRoute.java`

```java
package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import com.fluo.processors.grafana.GenerateGrafanaLinkProcessor;
import com.fluo.processors.grafana.ValidateGrafanaConfigProcessor;

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

### Frontend Components

#### 1. View in Grafana Button

**File:** `bff/src/components/signals/view-in-grafana-button.tsx`

```tsx
import { Button } from '@/components/ui/button'
import { ExternalLink, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

interface ViewInGrafanaButtonProps {
  signalId: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showLabel?: boolean
}

/**
 * Button to open signal's trace in Grafana.
 * Fetches Grafana deep link from backend and opens in new tab.
 *
 * Gracefully handles Grafana not being configured.
 */
export function ViewInGrafanaButton({
  signalId,
  variant = 'outline',
  size = 'default',
  showLabel = true
}: ViewInGrafanaButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleClick = async () => {
    setLoading(true)

    try {
      // Fetch Grafana link from backend
      const response = await fetch(`/api/signals/${signalId}/grafana-link`)

      if (response.status === 501) {
        // Grafana not configured - show helpful message
        toast({
          title: 'Grafana Not Configured',
          description: 'Contact your administrator to enable Grafana integration.',
          variant: 'default',
        })
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to get Grafana link: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.configured) {
        toast({
          title: 'Grafana Not Available',
          description: 'Grafana integration is not configured for this deployment.',
          variant: 'default',
        })
        return
      }

      // Open Grafana in new tab
      window.open(data.grafanaLink, '_blank', 'noopener,noreferrer')

      toast({
        title: 'Opening Grafana',
        description: 'Trace viewer opened in new tab',
      })

    } catch (error) {
      console.error('Error fetching Grafana link:', error)
      toast({
        title: 'Error',
        description: 'Failed to open Grafana trace viewer',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className="gap-2"
    >
      <ExternalLink className="h-4 w-4" />
      {showLabel && (loading ? 'Loading...' : 'View in Grafana')}
    </Button>
  )
}
```

#### 2. Integration into Signal Detail Page

**File:** `bff/src/components/signals/signal-detail-page.tsx` (modification)

Add ViewInGrafanaButton to the signal actions section:

```tsx
import { ViewInGrafanaButton } from './view-in-grafana-button'

// Inside SignalDetailPage component, in the actions section:
<div className="flex gap-2">
  {/* Existing action buttons */}
  <Button onClick={handleInvestigate}>Mark as Investigating</Button>
  <Button onClick={handleResolve}>Resolve</Button>
  <Button onClick={handleFalsePositive}>False Positive</Button>

  {/* NEW: Grafana integration */}
  <ViewInGrafanaButton signalId={signal.id} />
</div>
```

#### 3. Integration into Signals Table

**File:** `bff/src/components/signals/signals-table.tsx` (modification)

Add Grafana link to table actions column:

```tsx
import { ViewInGrafanaButton } from './view-in-grafana-button'

// In table columns definition:
{
  id: 'actions',
  cell: ({ row }) => (
    <div className="flex gap-1">
      <Button size="sm" onClick={() => navigate(`/signals/${row.original.id}`)}>
        View
      </Button>
      <ViewInGrafanaButton
        signalId={row.original.id}
        size="sm"
        showLabel={false}
      />
    </div>
  )
}
```

#### 4. Grafana Configuration Status Hook

**File:** `bff/src/lib/hooks/use-grafana-config.ts`

```tsx
import { useQuery } from '@tanstack/react-query'

interface GrafanaConfig {
  configured: boolean
  available: boolean
  message?: string
}

/**
 * Hook to check if Grafana integration is configured.
 * Used to conditionally show/hide Grafana buttons.
 */
export function useGrafanaConfig() {
  return useQuery<GrafanaConfig>({
    queryKey: ['grafana', 'config'],
    queryFn: async () => {
      const response = await fetch('/api/grafana/config')
      if (!response.ok) {
        throw new Error('Failed to fetch Grafana config')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Don't retry much - configuration doesn't change often
  })
}
```

**Usage in components:**

```tsx
import { useGrafanaConfig } from '@/lib/hooks/use-grafana-config'

function SignalActions({ signalId }: { signalId: string }) {
  const { data: grafanaConfig } = useGrafanaConfig()

  return (
    <div className="flex gap-2">
      {/* Only show Grafana button if configured */}
      {grafanaConfig?.configured && (
        <ViewInGrafanaButton signalId={signalId} />
      )}
    </div>
  )
}
```

## Configuration Examples

### Self-Hosted Grafana

**`application.properties`:**
```properties
# Self-hosted Grafana on-premise
grafana.url=https://grafana.internal.company.com
grafana.tempo.datasource=tempo
grafana.org-id=1
grafana.enabled=true
grafana.time-buffer-before-minutes=5
grafana.time-buffer-after-minutes=10
grafana.span-highlighting.enabled=false
```

### Grafana Cloud

**`application.properties`:**
```properties
# Grafana Cloud SaaS
grafana.url=https://mycompany.grafana.net
grafana.tempo.datasource=grafanacloud-traces
grafana.org-id=123456
grafana.enabled=true
grafana.time-buffer-before-minutes=5
grafana.time-buffer-after-minutes=10
grafana.span-highlighting.enabled=true
```

### Grafana Disabled (No Integration)

**`application.properties`:**
```properties
# Grafana integration disabled
grafana.enabled=false
```

**Result:** ViewInGrafanaButton will not appear in UI.

### Local Development with docker-compose

**`docker-compose.yml` (consumer-managed):**
```yaml
version: '3.8'

services:
  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3001:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - grafana-data:/var/lib/grafana

  tempo:
    image: grafana/tempo:2.3.0
    ports:
      - "3200:3200"  # Tempo API
      - "4317:4317"  # OTLP gRPC
      - "4318:4318"  # OTLP HTTP
    command: [ "-config.file=/etc/tempo.yaml" ]
    volumes:
      - ./tempo-config.yaml:/etc/tempo.yaml
      - tempo-data:/var/tempo

  fluo-backend:
    image: fluo-backend:latest
    environment:
      - GRAFANA_URL=http://localhost:3001
      - GRAFANA_TEMPO_DATASOURCE=tempo
      - GRAFANA_ENABLED=true
    ports:
      - "8080:8080"

volumes:
  grafana-data:
  tempo-data:
```

**`application.properties` for local dev:**
```properties
grafana.url=http://localhost:3001
grafana.tempo.datasource=tempo
grafana.org-id=1
grafana.enabled=true
```

## Success Criteria

**Functional Requirements:**
- [ ] Generate valid Grafana Tempo deep links for signals
- [ ] Open Grafana in new tab with trace pre-loaded
- [ ] Support consumer-configured Grafana URLs (self-hosted, cloud)
- [ ] Handle missing Grafana configuration gracefully
- [ ] Display "View in Grafana" button on signal detail page
- [ ] Display Grafana icon in signals table
- [ ] Hide Grafana buttons when integration disabled

**Performance Requirements:**
- [ ] Link generation completes in <50ms
- [ ] No blocking calls on UI (async link fetch)
- [ ] Grafana URL opens in <200ms after button click

**Reliability Requirements:**
- [ ] Graceful degradation when Grafana unavailable
- [ ] Error messages guide users to enable integration
- [ ] Works with Grafana versions 9.x, 10.x, 11.x
- [ ] Supports both Grafana Cloud and self-hosted

**Testing Requirements:**
- [ ] Unit tests for URL encoding (special characters, Unicode)
- [ ] Unit tests for time range calculation
- [ ] Integration tests with mock Grafana API
- [ ] Frontend tests for button click behavior
- [ ] E2E tests for full link generation flow
- [ ] Test coverage >90% per ADR-014

## Testing Requirements

### Backend Unit Tests

**File:** `backend/src/test/java/com/fluo/services/GrafanaLinkServiceTest.java`

```java
package com.fluo.services;

import com.fluo.config.GrafanaConfig;
import com.fluo.model.Signal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class GrafanaLinkServiceTest {

    private GrafanaLinkService service;

    @Mock
    private GrafanaConfig config;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = new GrafanaLinkService();
        service.config = config;
    }

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
            "rule-1",
            "v1",
            "span-123",
            "trace-456",
            Signal.SignalSeverity.HIGH,
            "Test signal",
            null,
            "test",
            "tenant-1"
        );

        // When
        String link = service.generateTraceLink(signal);

        // Then
        assertThat(link).startsWith("https://grafana.example.com/explore?orgId=1&left=");
        assertThat(link).contains("trace-456");
        assertThat(link).contains("tempo");
    }

    @Test
    void testGenerateTraceLink_urlEncoding() {
        // Given
        when(config.isConfigured()).thenReturn(true);
        when(config.getGrafanaUrl()).thenReturn("https://grafana.example.com");
        when(config.getTempoDatasource()).thenReturn("tempo");
        when(config.getOrgId()).thenReturn(1);
        when(config.getTimeBufferBeforeMinutes()).thenReturn(5);
        when(config.getTimeBufferAfterMinutes()).thenReturn(10);

        Instant timestamp = Instant.parse("2025-01-15T10:30:00Z");

        // When
        String link = service.generateTraceLink("abc123", timestamp, Optional.empty());

        // Then
        // Verify JSON is URL-encoded (no raw { } " characters)
        assertThat(link).doesNotContain("{");
        assertThat(link).doesNotContain("}");
        assertThat(link).doesNotContain("\"");
        assertThat(link).contains("%22"); // Encoded quote
    }

    @Test
    void testGenerateTraceLink_notConfigured() {
        // Given
        when(config.isConfigured()).thenReturn(false);

        Signal signal = Signal.create(
            "rule-1", "v1", "span-123", "trace-456",
            Signal.SignalSeverity.HIGH, "Test", null, "test", "tenant-1"
        );

        // When / Then
        assertThatThrownBy(() -> service.generateTraceLink(signal))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Grafana integration not configured");
    }

    @Test
    void testGenerateTraceLink_withSpanHighlighting() {
        // Given
        when(config.isConfigured()).thenReturn(true);
        when(config.getGrafanaUrl()).thenReturn("https://grafana.example.com");
        when(config.getTempoDatasource()).thenReturn("tempo");
        when(config.getOrgId()).thenReturn(1);
        when(config.getTimeBufferBeforeMinutes()).thenReturn(5);
        when(config.getTimeBufferAfterMinutes()).thenReturn(10);
        when(config.isSpanHighlightingEnabled()).thenReturn(true);

        Instant timestamp = Instant.parse("2025-01-15T10:30:00Z");

        // When
        String link = service.generateTraceLink("trace-123", timestamp, Optional.of("span-456"));

        // Then
        assertThat(link).contains("&spanId=span-456");
    }

    @Test
    void testGenerateTraceLink_timeRangeCalculation() {
        // Given
        when(config.isConfigured()).thenReturn(true);
        when(config.getGrafanaUrl()).thenReturn("https://grafana.example.com");
        when(config.getTempoDatasource()).thenReturn("tempo");
        when(config.getOrgId()).thenReturn(1);
        when(config.getTimeBufferBeforeMinutes()).thenReturn(5);
        when(config.getTimeBufferAfterMinutes()).thenReturn(10);

        // Timestamp: 2025-01-15T10:30:00Z = 1736937000000 ms
        Instant traceTime = Instant.parse("2025-01-15T10:30:00Z");

        // When
        String link = service.generateTraceLink("trace-123", traceTime, Optional.empty());

        // Then
        // Start time should be 5 minutes before: 1736936700000
        // End time should be 10 minutes after: 1736937600000
        assertThat(link).contains("1736936700000"); // 5 min before
        assertThat(link).contains("1736937600000"); // 10 min after
    }

    @Test
    void testIsAvailable_configured() {
        // Given
        when(config.isConfigured()).thenReturn(true);

        // When / Then
        assertThat(service.isAvailable()).isTrue();
    }

    @Test
    void testIsAvailable_notConfigured() {
        // Given
        when(config.isConfigured()).thenReturn(false);

        // When / Then
        assertThat(service.isAvailable()).isFalse();
    }
}
```

**File:** `backend/src/test/java/com/fluo/processors/grafana/GenerateGrafanaLinkProcessorTest.java`

```java
package com.fluo.processors.grafana;

import com.fluo.model.Signal;
import com.fluo.services.GrafanaLinkService;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class GenerateGrafanaLinkProcessorTest {

    private GenerateGrafanaLinkProcessor processor;
    private CamelContext context;

    @Mock
    private GrafanaLinkService linkService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        processor = new GenerateGrafanaLinkProcessor();
        processor.linkService = linkService;
        context = new DefaultCamelContext();
    }

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

    @Test
    void testProcess_grafanaNotConfigured() throws Exception {
        // Given
        Signal signal = Signal.create(
            "rule-1", "v1", "span-123", "trace-456",
            Signal.SignalSeverity.HIGH, "Test", null, "test", "tenant-1"
        );

        when(linkService.generateTraceLink(signal))
            .thenThrow(new IllegalStateException("Grafana not configured"));

        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setBody(signal);

        // When
        processor.process(exchange);

        // Then
        assertThat(exchange.getIn().getHeader("grafanaLink")).isNull();

        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertThat(body).containsEntry("error", "Grafana integration not configured");
        assertThat(body).containsEntry("configured", false);
    }

    @Test
    void testProcess_missingSignal() {
        // Given
        Exchange exchange = new DefaultExchange(context);
        exchange.getIn().setBody(null);

        // When / Then
        assertThatThrownBy(() -> processor.process(exchange))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Signal required");
    }
}
```

### Frontend Unit Tests

**File:** `bff/src/components/signals/__tests__/view-in-grafana-button.test.tsx`

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ViewInGrafanaButton } from '../view-in-grafana-button'
import { vi } from 'vitest'

describe('ViewInGrafanaButton', () => {
  beforeEach(() => {
    // Mock window.open
    global.window.open = vi.fn()
  })

  it('renders button with label', () => {
    render(<ViewInGrafanaButton signalId="sig-123" />)
    expect(screen.getByText('View in Grafana')).toBeInTheDocument()
  })

  it('renders button without label when showLabel=false', () => {
    render(<ViewInGrafanaButton signalId="sig-123" showLabel={false} />)
    expect(screen.queryByText('View in Grafana')).not.toBeInTheDocument()
  })

  it('fetches Grafana link and opens new tab on click', async () => {
    // Mock successful API response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        grafanaLink: 'https://grafana.example.com/explore?...',
        configured: true,
      }),
    })

    render(<ViewInGrafanaButton signalId="sig-123" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/signals/sig-123/grafana-link')
      expect(window.open).toHaveBeenCalledWith(
        'https://grafana.example.com/explore?...',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  it('shows toast when Grafana not configured', async () => {
    // Mock 501 Not Implemented response
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 501,
      json: async () => ({
        error: 'Grafana integration not configured',
        configured: false,
      }),
    })

    render(<ViewInGrafanaButton signalId="sig-123" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(window.open).not.toHaveBeenCalled()
      // Toast library would show message
    })
  })

  it('shows error toast on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    render(<ViewInGrafanaButton signalId="sig-123" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(window.open).not.toHaveBeenCalled()
    })
  })

  it('disables button while loading', async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<ViewInGrafanaButton signalId="sig-123" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toBeDisabled()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })
})
```

### Integration Test Scenarios

**Test Cases:**
1. **URL Encoding Edge Cases**
   - Trace ID with special characters
   - Grafana URL with path prefix
   - Tempo datasource with spaces
   - Unicode in configuration values

2. **Different Grafana Versions**
   - Grafana 9.x (basic Tempo support)
   - Grafana 10.x (enhanced TraceQL)
   - Grafana 11.x (span highlighting)
   - Grafana Cloud (different URL structure)

3. **Time Range Calculations**
   - Traces at Unix epoch
   - Traces in far future (2038+ timestamps)
   - Very short traces (<1 second)
   - Long-lived traces (hours)

4. **Configuration Variations**
   - No Grafana URL configured
   - Grafana enabled but URL empty
   - Invalid URL format
   - Custom time buffers (0 minutes, 60 minutes)

5. **Concurrent Requests**
   - Multiple users clicking Grafana links simultaneously
   - Thread safety of link generation service

## Security Considerations

**Threat Model:**

1. **URL Injection Attacks**
   - **Threat:** Malicious trace IDs could inject JavaScript in Grafana URL
   - **Mitigation:** URL encoding all query parameters, no raw user input in URLs
   - **Validation:** Trace IDs validated against hex format (32 chars, 0-9a-f only)

2. **Information Disclosure**
   - **Threat:** Grafana URL in config might expose internal infrastructure
   - **Mitigation:** Grafana URL not exposed to frontend, only backend generates links
   - **Note:** Frontend receives final URL, not configuration values

3. **Server-Side Request Forgery (SSRF)**
   - **Threat:** Attacker could trick BeTrace to generate links to internal services
   - **Mitigation:** Grafana URL validated against allowlist, no user-provided URLs
   - **Note:** Configuration is deployment-time only, not runtime

4. **Cross-Tenant Data Leakage**
   - **Threat:** Tenant A clicks link, sees Tenant B's traces in Grafana
   - **Mitigation:** Tenant isolation enforced in Grafana (external system)
   - **Note:** BeTrace only generates links, doesn't control Grafana access

5. **Configuration Exposure**
   - **Threat:** Attacker queries `/api/grafana/config` to learn infrastructure
   - **Mitigation:** Endpoint returns only boolean flags, not URLs or datasource names
   - **Response:** `{"configured": true/false, "available": true/false}`

**Security Best Practices:**
- ✅ URL encoding prevents injection
- ✅ No user input in configuration
- ✅ Read-only operation (no side effects)
- ✅ Graceful degradation on errors
- ✅ No sensitive data in frontend

## Unit PRD Breakdown (Optional)

This PRD can be implemented as a single unit (estimated 400 lines total), but could be decomposed if needed:

### PRD-024a: Backend Link Generation Service (~150 lines)
- `GrafanaConfig.java` - Configuration management
- `GrafanaLinkService.java` - URL generation logic
- Unit tests for URL encoding, time ranges

### PRD-024b: Camel Processors and API Routes (~100 lines)
- `GenerateGrafanaLinkProcessor.java` - Named processor
- `ValidateGrafanaConfigProcessor.java` - Config validation
- `GrafanaApiRoute.java` - REST endpoints
- Integration tests for Camel routes

### PRD-024c: Frontend Components (~150 lines)
- `ViewInGrafanaButton.tsx` - React component
- `use-grafana-config.ts` - Status hook
- Integration into signal detail page and table
- Frontend unit tests

**Recommendation:** Implement as single unit PRD-024 (not complex enough to warrant decomposition).

## Files to Create

**Backend:**
- `backend/src/main/java/com/fluo/config/GrafanaConfig.java`
- `backend/src/main/java/com/fluo/services/GrafanaLinkService.java`
- `backend/src/main/java/com/fluo/processors/grafana/GenerateGrafanaLinkProcessor.java`
- `backend/src/main/java/com/fluo/processors/grafana/ValidateGrafanaConfigProcessor.java`
- `backend/src/main/java/com/fluo/routes/GrafanaApiRoute.java`

**Backend Tests:**
- `backend/src/test/java/com/fluo/services/GrafanaLinkServiceTest.java`
- `backend/src/test/java/com/fluo/processors/grafana/GenerateGrafanaLinkProcessorTest.java`
- `backend/src/test/java/com/fluo/routes/GrafanaApiRouteTest.java`

**Frontend:**
- `bff/src/components/signals/view-in-grafana-button.tsx`
- `bff/src/lib/hooks/use-grafana-config.ts`

**Frontend Tests:**
- `bff/src/components/signals/__tests__/view-in-grafana-button.test.tsx`

**Configuration:**
- `backend/src/main/resources/application.properties` (update with Grafana config)

**Documentation:**
- Update `docs/deployment-guide.md` with Grafana configuration examples

## Files to Modify

**Backend:**
- `backend/src/main/resources/application.properties` - Add Grafana config properties

**Frontend:**
- `bff/src/components/signals/signal-detail-page.tsx` - Add ViewInGrafanaButton
- `bff/src/components/signals/signals-table.tsx` - Add Grafana icon to table

## Integration Examples

### Example 1: Grafana Cloud with BeTrace SaaS

**Customer Setup:**
```properties
# Customer's application.properties
grafana.url=https://mycompany.grafana.net
grafana.tempo.datasource=grafanacloud-mycompany-traces
grafana.org-id=654321
grafana.enabled=true
```

**Generated Link:**
```
https://mycompany.grafana.net/explore?orgId=654321&left=%7B%22datasource%22%3A%22grafanacloud-mycompany-traces%22%2C%22queries%22%3A%5B%7B%22refId%22%3A%22A%22%2C%22queryType%22%3A%22traceql%22%2C%22query%22%3A%224bf92f3577b34da6a3ce929d0e0e4736%22%7D%5D%2C%22range%22%3A%7B%22from%22%3A%221736936700000%22%2C%22to%22%3A%221736937600000%22%7D%7D
```

### Example 2: Self-Hosted Grafana with Kubernetes

**Customer's Kubernetes Deployment:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluo-backend-config
data:
  application.properties: |
    grafana.url=https://grafana.internal.k8s.cluster
    grafana.tempo.datasource=tempo
    grafana.org-id=1
    grafana.enabled=true
```

**BeTrace Backend Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fluo-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        image: fluo-backend:latest
        volumeMounts:
        - name: config
          mountPath: /app/config
      volumes:
      - name: config
        configMap:
          name: fluo-backend-config
```

### Example 3: Local Development with Docker Compose

**Developer's `docker-compose.yml`:**
```yaml
version: '3.8'
services:
  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3001:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true

  tempo:
    image: grafana/tempo:2.3.0
    ports:
      - "3200:3200"
      - "4317:4317"

  fluo-backend:
    build: ./backend
    environment:
      GRAFANA_URL: "http://localhost:3001"
      GRAFANA_TEMPO_DATASOURCE: "tempo"
      GRAFANA_ENABLED: "true"
    ports:
      - "8080:8080"

  fluo-frontend:
    build: ./bff
    ports:
      - "3000:3000"
```

**Start Development Stack:**
```bash
docker-compose up -d
# Visit http://localhost:3000 for BeTrace UI
# Click "View in Grafana" → Opens http://localhost:3001/explore?...
```

## Performance Considerations

**URL Generation Performance:**
- Link generation is pure computation (no I/O)
- Expected performance: <10ms per link
- No caching needed (stateless operation)

**Frontend Performance:**
- Async fetch prevents UI blocking
- Button disabled during loading
- Optimistic UI (assume success, handle errors)

**Scalability:**
- Stateless service (horizontally scalable)
- No shared state or locking
- Thread-safe (uses immutable Signal objects)

## Monitoring and Observability

**Metrics to Track:**
- `grafana_links_generated_total` - Counter of links generated
- `grafana_links_failed_total` - Counter of generation failures
- `grafana_links_opened_total` - Counter of frontend button clicks
- `grafana_config_status` - Gauge (1=configured, 0=not configured)

**Logs to Record:**
- Link generation events (DEBUG level)
- Configuration errors (WARN level)
- URL encoding failures (ERROR level)

**Alerts to Configure:**
- Alert if Grafana link generation fails >10% of requests
- Alert if Grafana configuration becomes invalid

## Future Enhancements

**Post-MVP Improvements:**
1. **Deep Link to Specific Spans**
   - Highlight the exact span that triggered the rule
   - Requires Grafana version detection

2. **Grafana Dashboard Links**
   - Link to custom BeTrace dashboard in Grafana
   - Show signal metrics, rule performance

3. **Embedded Trace Viewer**
   - Embed Grafana trace viewer in BeTrace UI (iframe)
   - Requires CORS configuration on Grafana side

4. **Multiple Observability Tools**
   - Support Jaeger, Zipkin, Honeycomb deep links
   - Pluggable link generator architecture

5. **Link Shortening**
   - Shorten long Grafana URLs for easier sharing
   - Store short codes in database

6. **Clipboard Copy**
   - Copy Grafana link to clipboard (alternative to opening tab)
   - Useful for sharing with team

## User Documentation

**Admin Guide (Deployment):**

**Title:** Configuring Grafana Integration

BeTrace can generate deep links to your Grafana instance for fast trace investigation. This is an optional feature that requires configuration.

**Prerequisites:**
- Grafana instance (self-hosted or cloud)
- Tempo datasource configured in Grafana
- BeTrace backend deployed

**Configuration Steps:**

1. Add Grafana configuration to `application.properties`:
   ```properties
   grafana.url=https://your-grafana-instance.com
   grafana.tempo.datasource=tempo
   grafana.org-id=1
   grafana.enabled=true
   ```

2. Restart BeTrace backend:
   ```bash
   kubectl rollout restart deployment/fluo-backend
   ```

3. Verify configuration:
   ```bash
   curl http://fluo-backend:8080/api/grafana/config
   # Expected: {"configured": true, "available": true}
   ```

4. Test deep link:
   - Open BeTrace UI
   - Navigate to any signal
   - Click "View in Grafana"
   - Verify Grafana opens with trace loaded

**Troubleshooting:**

| Issue | Cause | Solution |
|-------|-------|----------|
| "Grafana Not Configured" message | `grafana.enabled=false` | Set `grafana.enabled=true` |
| 501 error on link click | Missing `grafana.url` | Add `grafana.url` property |
| Grafana opens but no trace | Wrong datasource name | Verify `grafana.tempo.datasource` matches Grafana |
| Trace not found in Grafana | Time range too narrow | Increase `grafana.time-buffer-*-minutes` |

**User Guide (SRE Workflow):**

**Title:** Investigating Signals with Grafana

When investigating a signal, you can view the full trace in Grafana for deeper analysis.

**Steps:**
1. Open signal detail page
2. Click "View in Grafana" button (top-right actions)
3. Grafana opens in new tab with trace pre-loaded
4. Investigate spans, timings, attributes
5. Return to BeTrace to update signal status

**Tips:**
- Keep BeTrace and Grafana tabs side-by-side
- Use Grafana's span search to find specific operations
- Check trace duration and error spans
- Look for slow database queries or external API calls

## Compliance Benefits

**SOC2 CC7.1 (System Monitoring):**
- Evidence: Grafana link clicks prove SREs investigate signals
- Evidence: Trace investigation time tracked (timestamp of link generation)
- Demonstrates effective incident response workflow

**SOC2 CC7.2 (Change Detection):**
- Evidence: Links to trace data document what changed in system behavior
- Provides audit trail of investigation activities

**Audit Trail:**
- When: Link generated timestamp
- Who: User ID from session
- What: Signal ID + Trace ID in logs
- Result: Link opened (tracked via metrics)

## Conclusion

PRD-024 provides a seamless integration between BeTrace and Grafana, dramatically improving SRE investigation workflow. The implementation is:

- **Deployment-Agnostic:** Works with any Grafana deployment (ADR-011)
- **Configurable:** Consumer-managed Grafana URL
- **Resilient:** Graceful degradation when Grafana unavailable
- **Testable:** 90%+ coverage per ADR-014
- **Secure:** URL encoding, no injection risks
- **Fast:** <50ms link generation, <200ms UI response

**Estimated Implementation Time:** 2-3 days
- Backend: 1 day (service, processors, tests)
- Frontend: 0.5 day (button, hook, integration)
- Testing: 0.5 day (integration tests, E2E)
- Documentation: 0.5 day (user guide, deployment guide)

**Post-MVP Priority:** P2 (Nice to Have)
- Not required for MVP launch
- High value for SRE persona
- Low implementation risk
- Can be added incrementally after core features stabilize
