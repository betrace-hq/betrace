package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Collections;
import java.util.Map;

/**
 * Stub implementations for routes referenced by REST endpoints.
 * These provide minimal implementations to make the endpoints work.
 */
@ApplicationScoped
public class StubRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Rule route stubs
        from("direct:createRule")
            .setBody(constant("{\"id\":\"stub-rule\",\"message\":\"Rule creation not implemented\"}"));

        from("direct:listRules")
            .setBody(constant("[]"));

        from("direct:getRule")
            .setBody(constant("null"));

        from("direct:updateRule")
            .setBody(constant("{\"message\":\"Rule update not implemented\"}"));

        from("direct:deleteRule")
            .setBody(constant("{\"deleted\":false}"));

        from("direct:validateRule")
            .setBody(constant("{\"valid\":true,\"message\":\"Stub validation\"}"));

        from("direct:testRule")
            .setBody(constant("{\"result\":\"Test not implemented\"}"));

        // Signal route stubs
        from("direct:createSignal")
            .setBody(constant("{\"id\":\"stub-signal\",\"message\":\"Signal creation not implemented\"}"));

        from("direct:listSignals")
            .setBody(constant("[]"));

        from("direct:getSignal")
            .setBody(constant("null"));

        from("direct:evaluateSignal")
            .setBody(constant("{\"evaluated\":false}"));

        from("direct:updateSignalStatus")
            .setBody(constant("{\"status\":\"unchanged\"}"));
    }
}