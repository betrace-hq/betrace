package com.betrace.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Map;
import java.util.UUID;
import java.util.HashMap;

/**
 * Stub routes for testing when actual components are not available.
 * These routes provide minimal responses to allow REST endpoint testing.
 */
@ApplicationScoped
public class TestStubRoutes extends RouteBuilder {

    @ConfigProperty(name = "test.stub.routes.enabled", defaultValue = "false")
    boolean stubRoutesEnabled;

    @Override
    public void configure() throws Exception {
        // Only configure stub routes if enabled (for testing)
        if (!stubRoutesEnabled) {
            return;
        }

        // Stub for rule creation
        from("direct:createRule")
            .process("createRuleProcessor");

        // Stub for signal creation
        from("direct:createSignal")
            .process("createSignalProcessor");

        // Stub for rule validation
        from("direct:validateRule")
            .process("validateRuleProcessor");

        // Stub for signal retrieval
        from("direct:getSignal")
            .process("getSignalProcessor");

        // Stub for rule retrieval
        from("direct:getRule")
            .process("getRuleProcessor");
    }
}