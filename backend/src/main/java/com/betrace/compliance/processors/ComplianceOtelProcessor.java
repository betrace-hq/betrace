package com.fluo.compliance.processors;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import io.opentelemetry.context.Scope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.*;

/**
 * Apache Camel processor that creates OpenTelemetry spans for compliance tracking
 * Use this in Camel routes to add compliance telemetry
 */
public class ComplianceOtelProcessor implements Processor {

    private static final Logger logger = LoggerFactory.getLogger(ComplianceOtelProcessor.class);

    // OpenTelemetry components
    private final Tracer tracer;
    private final Meter meter;
    private final LongCounter routeComplianceCounter;

    // Compliance configuration
    private final String operationName;
    private final Map<String, List<String>> frameworkControls = new HashMap<>();
    private final Map<String, Object> metadata = new HashMap<>();
    private final String priority;
    private final boolean tracksSensitiveData;

    // Attribute keys
    private static final AttributeKey<String> ROUTE_ID = AttributeKey.stringKey("camel.route.id");
    private static final AttributeKey<String> EXCHANGE_ID = AttributeKey.stringKey("camel.exchange.id");
    private static final AttributeKey<String> ENDPOINT_URI = AttributeKey.stringKey("camel.endpoint.uri");
    private static final AttributeKey<String> HTTP_METHOD = AttributeKey.stringKey("http.method");
    private static final AttributeKey<String> HTTP_PATH = AttributeKey.stringKey("http.path");
    private static final AttributeKey<Long> HTTP_STATUS = AttributeKey.longKey("http.status_code");

    private ComplianceOtelProcessor(Builder builder) {
        this.operationName = builder.operationName;
        this.frameworkControls.putAll(builder.frameworkControls);
        this.metadata.putAll(builder.metadata);
        this.priority = builder.priority;
        this.tracksSensitiveData = builder.tracksSensitiveData;

        // Initialize OpenTelemetry
        this.tracer = GlobalOpenTelemetry.getTracer("fluo-camel-compliance", "1.0.0");
        this.meter = GlobalOpenTelemetry.getMeter("fluo-camel-compliance");

        // Initialize metrics
        this.routeComplianceCounter = meter.counterBuilder("compliance.route.events")
            .setDescription("Compliance events from Camel routes")
            .setUnit("events")
            .build();
    }

    @Override
    public void process(Exchange exchange) throws Exception {
        // Create compliance span for this route processing
        Span span = tracer.spanBuilder("camel.compliance." + operationName)
            .setSpanKind(SpanKind.SERVER)
            .setAttribute("compliance.operation", operationName)
            .setAttribute("compliance.priority", priority)
            .setAttribute("compliance.sensitive_data", tracksSensitiveData)
            .setAttribute(ROUTE_ID, exchange.getFromRouteId() != null ? exchange.getFromRouteId() : "unknown")
            .setAttribute(EXCHANGE_ID, exchange.getExchangeId())
            .startSpan();

        try (Scope scope = span.makeCurrent()) {
            // Add route context
            addRouteContext(span, exchange);

            // Add framework controls as span events
            for (Map.Entry<String, List<String>> entry : frameworkControls.entrySet()) {
                String framework = entry.getKey();
                List<String> controls = entry.getValue();

                io.opentelemetry.api.common.AttributesBuilder attrs = Attributes.builder()
                    .put("compliance.framework", framework)
                    .put("compliance.controls", String.join(",", controls));

                // Add framework-specific attributes
                addFrameworkAttributes(attrs, framework, controls);

                span.addEvent("Compliance controls applied", attrs.build());
            }

            // Add metadata as span attributes
            for (Map.Entry<String, Object> entry : metadata.entrySet()) {
                span.setAttribute("compliance.metadata." + entry.getKey(), String.valueOf(entry.getValue()));
            }

            // Increment metrics
            routeComplianceCounter.add(1,
                Attributes.builder()
                    .put("route", exchange.getFromRouteId() != null ? exchange.getFromRouteId() : "unknown")
                    .put("operation", operationName)
                    .put("priority", priority)
                    .build());

            // Add compliance headers to the exchange for downstream processing
            exchange.getMessage().setHeader("X-Compliance-Trace-Id", span.getSpanContext().getTraceId());
            exchange.getMessage().setHeader("X-Compliance-Span-Id", span.getSpanContext().getSpanId());
            exchange.getMessage().setHeader("X-Compliance-Operation", operationName);
            exchange.getMessage().setHeader("X-Compliance-Timestamp", Instant.now().toString());

            // Log for local debugging
            logger.debug("Compliance span created for route: {} - Operation: {} - TraceId: {}",
                exchange.getFromRouteId(), operationName, span.getSpanContext().getTraceId());

            span.setStatus(StatusCode.OK, "Compliance tracking applied successfully");
        } finally {
            span.end();
        }
    }

    /**
     * Add Camel route context to the span
     */
    private void addRouteContext(Span span, Exchange exchange) {
        // Add endpoint information
        if (exchange.getFromEndpoint() != null) {
            span.setAttribute(ENDPOINT_URI, exchange.getFromEndpoint().getEndpointUri());
        }

        // Add HTTP context if available
        String httpMethod = exchange.getIn().getHeader(Exchange.HTTP_METHOD, String.class);
        if (httpMethod != null) {
            span.setAttribute(HTTP_METHOD, httpMethod);
        }

        String httpPath = exchange.getIn().getHeader(Exchange.HTTP_PATH, String.class);
        if (httpPath != null) {
            span.setAttribute(HTTP_PATH, httpPath);
        }

        Integer httpStatus = exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE, Integer.class);
        if (httpStatus != null) {
            span.setAttribute(HTTP_STATUS, httpStatus.longValue());
        }

        // Add user context
        String userId = exchange.getIn().getHeader("X-User-Id", String.class);
        if (userId != null) {
            span.setAttribute("compliance.user.id", userId);
        }

        // Add tenant context
        String tenantId = exchange.getIn().getHeader("X-Tenant-Id", String.class);
        if (tenantId != null) {
            span.setAttribute("compliance.tenant.id", tenantId);
        }

        // Add correlation ID if present
        String correlationId = exchange.getIn().getHeader("X-Correlation-Id", String.class);
        if (correlationId != null) {
            span.setAttribute("correlation.id", correlationId);
        }
    }

    /**
     * Add framework-specific attributes
     */
    private void addFrameworkAttributes(io.opentelemetry.api.common.AttributesBuilder attrs, String framework, List<String> controls) {
        switch (framework) {
            case "SOC2":
                attrs.put("soc2.type", "Type II");
                attrs.put("soc2.trust_services", determineTrustServices(controls));
                break;
            case "HIPAA":
                attrs.put("hipaa.safeguard_category", determineSafeguardCategory(controls));
                attrs.put("hipaa.phi_involved", tracksSensitiveData);
                break;
            case "FedRAMP":
                String level = metadata.getOrDefault("fedramp_level", "moderate").toString();
                attrs.put("fedramp.impact_level", level);
                attrs.put("fedramp.control_baseline", level.toUpperCase());
                break;
            case "ISO27001":
                attrs.put("iso27001.version", "2022");
                attrs.put("iso27001.annex_a", true);
                break;
            case "PCI-DSS":
                attrs.put("pcidss.version", "4.0");
                attrs.put("pcidss.cardholder_data", tracksSensitiveData);
                break;
        }
    }

    private String determineTrustServices(List<String> controls) {
        Set<String> services = new HashSet<>();
        for (String control : controls) {
            if (control.startsWith("CC1") || control.startsWith("CC2")) services.add("Security");
            if (control.startsWith("CC3") || control.startsWith("CC4")) services.add("Availability");
            if (control.startsWith("CC5") || control.startsWith("CC6")) services.add("Processing Integrity");
            if (control.startsWith("CC7") || control.startsWith("CC8")) services.add("Confidentiality");
            if (control.startsWith("CC9")) services.add("Privacy");
        }
        return String.join(",", services);
    }

    private String determineSafeguardCategory(List<String> controls) {
        Set<String> categories = new HashSet<>();
        for (String control : controls) {
            if (control.contains("164.308")) categories.add("Administrative");
            if (control.contains("164.310")) categories.add("Physical");
            if (control.contains("164.312")) categories.add("Technical");
        }
        return String.join(",", categories);
    }

    /**
     * Builder for creating compliance processors
     */
    public static class Builder {
        private String operationName = "compliance-check";
        private Map<String, List<String>> frameworkControls = new HashMap<>();
        private Map<String, Object> metadata = new HashMap<>();
        private String priority = "NORMAL";
        private boolean tracksSensitiveData = false;

        public Builder() {}

        public Builder withOperation(String operationName) {
            this.operationName = operationName;
            return this;
        }

        public Builder withSOC2(String... controls) {
            frameworkControls.put("SOC2", Arrays.asList(controls));
            return this;
        }

        public Builder withHIPAA(String... safeguards) {
            frameworkControls.put("HIPAA", Arrays.asList(safeguards));
            metadata.put("hipaa_enabled", true);
            return this;
        }

        public Builder withFedRAMP(String level, String... controls) {
            frameworkControls.put("FedRAMP", Arrays.asList(controls));
            metadata.put("fedramp_level", level);
            return this;
        }

        public Builder withISO27001(String... controls) {
            frameworkControls.put("ISO27001", Arrays.asList(controls));
            return this;
        }

        public Builder withPCIDSS(String... requirements) {
            frameworkControls.put("PCI-DSS", Arrays.asList(requirements));
            metadata.put("pcidss_enabled", true);
            return this;
        }

        public Builder withMetadata(String key, Object value) {
            metadata.put(key, value);
            return this;
        }

        public Builder withPriority(String priority) {
            this.priority = priority;
            return this;
        }

        public Builder tracksSensitiveData(boolean tracks) {
            this.tracksSensitiveData = tracks;
            return this;
        }

        public ComplianceOtelProcessor build() {
            return new ComplianceOtelProcessor(this);
        }
    }

    public static Builder builder() {
        return new Builder();
    }
}