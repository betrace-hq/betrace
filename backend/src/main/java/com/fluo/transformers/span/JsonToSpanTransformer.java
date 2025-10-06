package com.fluo.transformers.span;

import com.fluo.model.Span;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.camel.Message;
import org.apache.camel.spi.DataType;
import org.apache.camel.spi.Transformer;

import java.time.Instant;
import java.util.Map;

/**
 * Transformer to convert JSON to Span domain object.
 */
public class JsonToSpanTransformer extends Transformer {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void transform(Message message, DataType fromType, DataType toType) throws Exception {
        String json = message.getBody(String.class);
        if (json == null || json.trim().isEmpty()) {
            throw new IllegalArgumentException("JSON input cannot be null or empty");
        }

        com.fasterxml.jackson.databind.JsonNode jsonNode = objectMapper.readTree(json);

        // Extract attributes, handling null/missing gracefully
        Map<String, Object> attributes = null;
        if (jsonNode.has("attributes") && !jsonNode.get("attributes").isNull()) {
            attributes = objectMapper.convertValue(jsonNode.get("attributes"), Map.class);
        }
        if (attributes == null) {
            attributes = new java.util.HashMap<>();
        }

        Span span = Span.create(
            jsonNode.path("spanId").asText(),
            jsonNode.path("traceId").asText(),
            jsonNode.path("operationName").asText(),
            jsonNode.path("serviceName").asText(),
            Instant.ofEpochMilli(jsonNode.path("startTime").asLong()),
            Instant.ofEpochMilli(jsonNode.path("endTime").asLong()),
            attributes,
            jsonNode.path("tenantId").asText()
        );

        message.setBody(span);
    }
}