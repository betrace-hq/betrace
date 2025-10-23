package com.betrace.processors.storage;

import com.betrace.model.Trace;
import com.betrace.services.DuckDBService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;
import java.util.UUID;

/**
 * Gets a trace by ID from DuckDB.
 *
 * Input headers:
 * - tenantId (UUID): Tenant that owns the trace
 * - traceId (String): Trace ID to retrieve
 *
 * Output: Trace or null if not found
 * Response code: 404 if trace not found
 */
@Named("getTraceByIdProcessor")
@ApplicationScoped
public class GetTraceByIdProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(GetTraceByIdProcessor.class);

    @Inject
    DuckDBService duckdb;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Extract parameters from headers
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        String traceId = exchange.getIn().getHeader("traceId", String.class);

        // Validate required parameters
        if (tenantId == null) {
            throw new IllegalArgumentException("Missing required header: tenantId");
        }
        if (traceId == null || traceId.isEmpty()) {
            throw new IllegalArgumentException("Missing required header: traceId");
        }

        // Get trace
        Optional<Trace> trace = duckdb.getTraceById(tenantId, traceId);

        if (trace.isPresent()) {
            exchange.getIn().setBody(trace.get());
            log.debug("Retrieved trace {} for tenant {}", traceId, tenantId);
        } else {
            exchange.getIn().setBody(null);
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 404);
            log.debug("Trace {} not found for tenant {}", traceId, tenantId);
        }
    }
}
