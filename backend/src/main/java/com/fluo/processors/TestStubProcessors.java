package com.fluo.processors;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.util.Map;
import java.util.UUID;
import java.util.HashMap;

/**
 * Processors for test stub routes.
 * Contains all exchange processing logic extracted from TestStubRoutes.
 */
@ApplicationScoped
public class TestStubProcessors {

    @Named("createRuleProcessor")
    @ApplicationScoped
    public static class CreateRuleProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            Map<String, Object> body = exchange.getIn().getBody(Map.class);
            Map<String, Object> response = new HashMap<>();
            if (body != null) {
                response.putAll(body);
            }
            response.put("id", body != null ? body.getOrDefault("id", UUID.randomUUID().toString()) : UUID.randomUUID().toString());
            response.put("active", true);
            response.put("createdAt", java.time.Instant.now().toString());
            exchange.getIn().setBody(response);
        }
    }

    @Named("createSignalProcessor")
    @ApplicationScoped
    public static class CreateSignalProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            Map<String, Object> body = exchange.getIn().getBody(Map.class);
            Map<String, Object> response = new HashMap<>();
            if (body != null) {
                response.putAll(body);
            }
            response.put("id", UUID.randomUUID().toString());
            response.put("status", "STORED");
            response.put("createdAt", java.time.Instant.now().toString());
            exchange.getIn().setBody(response);
        }
    }

    @Named("validateRuleProcessor")
    @ApplicationScoped
    public static class ValidateRuleProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            Map<String, Object> body = exchange.getIn().getBody(Map.class);
            String expression = body != null ? (String) body.get("expression") : null;
            boolean valid = expression != null && !expression.contains(">>>");
            Map<String, Object> response = Map.of(
                "valid", valid,
                "message", valid ? "Expression is valid" : "Invalid expression syntax"
            );
            exchange.getIn().setBody(response);
        }
    }

    @Named("getSignalProcessor")
    @ApplicationScoped
    public static class GetSignalProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            String id = exchange.getIn().getHeader("id", String.class);
            Map<String, Object> response = new HashMap<>();
            response.put("id", id);
            response.put("status", "STORED");
            response.put("ruleId", "test-rule");
            response.put("message", "Test signal");
            response.put("severity", "MEDIUM");
            exchange.getIn().setBody(response);
        }
    }

    @Named("getRuleProcessor")
    @ApplicationScoped
    public static class GetRuleProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            String id = exchange.getIn().getHeader("id", String.class);
            Map<String, Object> response = new HashMap<>();
            response.put("id", id);
            response.put("name", "Test Rule");
            response.put("expression", "temperature > 90");
            response.put("active", true);
            exchange.getIn().setBody(response);
        }
    }
}