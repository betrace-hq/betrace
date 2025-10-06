package com.fluo.transformers.signal;

import com.fluo.model.Signal;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.camel.Message;
import org.apache.camel.spi.DataType;
import org.apache.camel.spi.Transformer;

import java.util.Map;

/**
 * Transformer to convert JSON to Signal domain object.
 */
public class JsonToSignalTransformer extends Transformer {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void transform(Message message, DataType fromType, DataType toType) throws Exception {
        String json = message.getBody(String.class);
        if (json == null || json.trim().isEmpty()) {
            throw new IllegalArgumentException("JSON input cannot be null or empty");
        }

        com.fasterxml.jackson.databind.JsonNode jsonNode = objectMapper.readTree(json);

        // Extract severity with default
        String severityStr = jsonNode.path("severity").asText("MEDIUM");
        Signal.SignalSeverity severity = Signal.SignalSeverity.MEDIUM;
        try {
            severity = Signal.SignalSeverity.valueOf(severityStr);
        } catch (IllegalArgumentException e) {
            // Use default
        }

        // Extract attributes, handling null/missing gracefully
        Map<String, Object> attributes = null;
        if (jsonNode.has("attributes") && !jsonNode.get("attributes").isNull()) {
            attributes = objectMapper.convertValue(jsonNode.get("attributes"), Map.class);
        }
        if (attributes == null) {
            attributes = new java.util.HashMap<>();
        }

        Signal signal = Signal.create(
            jsonNode.path("ruleId").asText(),
            jsonNode.path("ruleVersion").asText("1.0"),
            jsonNode.path("spanId").asText(),
            jsonNode.path("traceId").asText(),
            severity,
            jsonNode.path("message").asText(),
            attributes,
            jsonNode.path("source").asText(),
            jsonNode.path("tenantId").asText()
        );

        message.setBody(signal);
    }
}