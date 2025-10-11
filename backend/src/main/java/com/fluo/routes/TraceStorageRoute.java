package com.fluo.routes;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestParamType;

/**
 * Trace storage and query routes.
 *
 * Provides:
 * - Direct route for storing traces after rule evaluation
 * - REST API for querying traces by time range
 * - REST API for getting trace by ID
 *
 * Integration points:
 * - direct:store-trace: Called after Drools rule evaluation
 * - /api/traces: Query and retrieve trace endpoints
 */
@ApplicationScoped
public class TraceStorageRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // ===================================================================
        // Direct Route: Store Trace in DuckDB
        // ===================================================================
        // Called after rule evaluation to persist trace
        //
        // Input: List<Span> or single Span
        // Output: Trace (stored)
        //
        from("direct:store-trace")
            .routeId("storeTrace")
            .description("Aggregate spans and store trace in DuckDB")
            .log("Storing trace with ${body.class}")
            .process("aggregateSpansToTraceProcessor")  // List<Span> -> Trace
            .choice()
                .when(body().isNull())
                    .log("No trace to store, skipping")
                    .stop()
            .end()
            .process("storeTraceInDuckDBProcessor")  // Store in DuckDB
            .log("Trace ${body.traceId} stored successfully");

        // ===================================================================
        // REST API: Query Traces
        // ===================================================================
        // GET /api/traces?start=<instant>&end=<instant>&limit=<int>
        //
        // Returns list of traces in time range
        //
        rest("/api/traces")
            .get("/")
                .description("Query traces by time range")
                .produces("application/json")
                .param()
                    .name("start")
                    .type(RestParamType.query)
                    .dataType("string")
                    .required(true)
                    .description("Start time (ISO-8601 instant)")
                .endParam()
                .param()
                    .name("end")
                    .type(RestParamType.query)
                    .dataType("string")
                    .required(true)
                    .description("End time (ISO-8601 instant)")
                .endParam()
                .param()
                    .name("limit")
                    .type(RestParamType.query)
                    .dataType("integer")
                    .required(false)
                    .defaultValue("100")
                    .description("Maximum number of traces to return")
                .endParam()
                .to("direct:query-traces");

        from("direct:query-traces")
            .routeId("queryTraces")
            .description("Query traces from DuckDB by time range")
            .process(exchange -> {
                // Parse query parameters
                String startStr = exchange.getIn().getHeader("start", String.class);
                String endStr = exchange.getIn().getHeader("end", String.class);
                String limitStr = exchange.getIn().getHeader("limit", String.class);

                // Convert to proper types
                java.time.Instant start = java.time.Instant.parse(startStr);
                java.time.Instant end = java.time.Instant.parse(endStr);
                Integer limit = limitStr != null ? Integer.parseInt(limitStr) : 100;

                // Set typed headers for processor
                exchange.getIn().setHeader("start", start);
                exchange.getIn().setHeader("end", end);
                exchange.getIn().setHeader("limit", limit);
            })
            .process("queryTracesFromDuckDBProcessor")  // Query DuckDB
            .marshal().json();  // Convert to JSON

        // ===================================================================
        // REST API: Get Trace by ID
        // ===================================================================
        // GET /api/traces/{traceId}
        //
        // Returns single trace or 404
        //
        rest("/api/traces")
            .get("/{traceId}")
                .description("Get trace by ID")
                .produces("application/json")
                .param()
                    .name("traceId")
                    .type(RestParamType.path)
                    .dataType("string")
                    .required(true)
                    .description("Trace ID (32 character hex)")
                .endParam()
                .to("direct:get-trace");

        from("direct:get-trace")
            .routeId("getTrace")
            .description("Get trace by ID from DuckDB")
            .process("getTraceByIdProcessor")  // Query DuckDB
            .choice()
                .when(body().isNull())
                    .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(404))
                    .setHeader(Exchange.CONTENT_TYPE, constant("application/json"))
                    .setBody(constant("{\"error\": \"Trace not found\"}"))
                .otherwise()
                    .marshal().json()
            .end();
    }
}
