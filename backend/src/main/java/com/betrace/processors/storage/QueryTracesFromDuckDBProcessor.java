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

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Queries traces from DuckDB by time range.
 *
 * Input headers:
 * - tenantId (UUID): Tenant to query
 * - start (Instant): Start time
 * - end (Instant): End time
 * - limit (Integer): Max results (default 100)
 *
 * Output: List<Trace>
 */
@Named("queryTracesFromDuckDBProcessor")
@ApplicationScoped
public class QueryTracesFromDuckDBProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(QueryTracesFromDuckDBProcessor.class);

    @Inject
    DuckDBService duckdb;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Extract query parameters from headers
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        Instant start = exchange.getIn().getHeader("start", Instant.class);
        Instant end = exchange.getIn().getHeader("end", Instant.class);
        Integer limit = exchange.getIn().getHeader("limit", Integer.class);

        // Validate required parameters
        if (tenantId == null) {
            throw new IllegalArgumentException("Missing required header: tenantId");
        }
        if (start == null) {
            throw new IllegalArgumentException("Missing required header: start");
        }
        if (end == null) {
            throw new IllegalArgumentException("Missing required header: end");
        }

        // Default limit
        if (limit == null) {
            limit = 100;
        }

        // Query traces
        List<Trace> traces = duckdb.queryTraces(tenantId, start, end, limit);

        exchange.getIn().setBody(traces);

        log.debug("Queried {} traces for tenant {} in range {} to {}",
            traces.size(), tenantId, start, end);
    }
}
