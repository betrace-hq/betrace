package com.fluo.processors.storage;

import com.fluo.model.Trace;
import com.fluo.services.DuckDBService;
import com.fluo.services.MetricsService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.UUID;

/**
 * Stores a trace in DuckDB hot storage.
 *
 * Input: Trace model
 * Output: Same trace (for chaining)
 * Header: tenantId (UUID)
 *
 * Handles:
 * - Storing trace in per-tenant DuckDB file
 * - Emitting storage metrics
 * - Error handling with logging
 */
@Named("storeTraceInDuckDBProcessor")
@ApplicationScoped
public class StoreTraceInDuckDBProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(StoreTraceInDuckDBProcessor.class);

    @Inject
    DuckDBService duckdb;

    @Inject
    MetricsService metricsService;

    @Override
    public void process(Exchange exchange) throws Exception {
        Trace trace = exchange.getIn().getBody(Trace.class);

        if (trace == null) {
            log.warn("No trace in exchange body, skipping storage");
            return;
        }

        UUID tenantId = trace.tenantId();

        try {
            long startTime = System.currentTimeMillis();

            duckdb.insertTrace(tenantId, trace);

            long elapsed = System.currentTimeMillis() - startTime;

            // Emit metrics
            metricsService.recordTraceStored(tenantId, trace.spans().size(), elapsed);

            log.debug("Stored trace {} for tenant {} ({} spans, {}ms)",
                trace.traceId(), tenantId, trace.spans().size(), elapsed);

        } catch (Exception e) {
            log.error("Failed to store trace {} for tenant {}: {}",
                trace.traceId(), tenantId, e.getMessage(), e);

            metricsService.recordTraceStorageError(tenantId);

            // Re-throw to trigger error handling
            throw e;
        }

        // Pass trace through for further processing
        exchange.getIn().setBody(trace);
    }
}
