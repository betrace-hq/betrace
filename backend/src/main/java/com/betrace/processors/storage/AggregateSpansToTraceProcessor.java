package com.betrace.processors.storage;

import com.betrace.model.Span;
import com.betrace.model.Trace;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregates individual spans into a complete trace.
 *
 * Input: List<Span> (all spans for a trace)
 * Output: Trace (aggregated trace with metadata)
 *
 * Algorithm:
 * 1. Group spans by trace ID
 * 2. Find root span (no parent)
 * 3. Calculate trace duration
 * 4. Extract service name from root span
 * 5. Aggregate resource attributes
 */
@Named("aggregateSpansToTraceProcessor")
@ApplicationScoped
public class AggregateSpansToTraceProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(AggregateSpansToTraceProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        Object body = exchange.getIn().getBody();

        // Handle both single span and list of spans
        List<Span> spans = body instanceof List<?> list
            ? list.stream()
                .filter(obj -> obj instanceof Span)
                .map(obj -> (Span) obj)
                .collect(Collectors.toList())
            : Collections.singletonList(exchange.getIn().getBody(Span.class));

        if (spans.isEmpty()) {
            log.warn("No spans to aggregate, skipping trace creation");
            exchange.getIn().setBody(null);
            return;
        }

        // Group spans by trace ID (in case we received mixed traces)
        Map<String, List<Span>> traceGroups = spans.stream()
            .collect(Collectors.groupingBy(Span::traceId));

        if (traceGroups.size() > 1) {
            log.warn("Received spans from {} different traces, processing each separately",
                traceGroups.size());
        }

        // For now, process the first trace (or single trace)
        Map.Entry<String, List<Span>> firstTrace = traceGroups.entrySet().iterator().next();
        String traceId = firstTrace.getKey();
        List<Span> traceSpans = firstTrace.getValue();

        Trace trace = aggregateTrace(traceId, traceSpans);
        exchange.getIn().setBody(trace);

        log.debug("Aggregated {} spans into trace {}", traceSpans.size(), traceId);
    }

    /**
     * Aggregate spans into a trace model.
     */
    private Trace aggregateTrace(String traceId, List<Span> spans) {
        // Find root span (no parent)
        Span rootSpan = spans.stream()
            .filter(span -> span.parentSpanId() == null || span.parentSpanId().isEmpty())
            .findFirst()
            .orElse(spans.get(0)); // Fallback to first span if no root found

        // Get tenant ID from first span (all spans in trace should have same tenant)
        UUID tenantId = UUID.fromString("default");

        // Calculate trace timestamp (earliest span start time)
        Instant timestamp = spans.stream()
            .map(Span::startTime)
            .min(Instant::compareTo)
            .orElse(Instant.now());

        // Calculate trace duration
        long durationMs = Trace.calculateDuration(spans);

        // Extract service name from root span
        String serviceName = rootSpan.serviceName();

        // Aggregate resource attributes from all spans
        Map<String, Object> resourceAttributes = new HashMap<>();
        spans.forEach(span -> {
            if (span.resourceAttributes() != null) {
                resourceAttributes.putAll(span.resourceAttributes());
            }
        });

        return new Trace(
            traceId,
            tenantId,
            timestamp,
            rootSpan.operationName(),
            durationMs,
            serviceName,
            spans,
            resourceAttributes
        );
    }
}
