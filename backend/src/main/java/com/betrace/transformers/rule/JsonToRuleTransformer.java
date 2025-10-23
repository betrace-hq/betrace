package com.betrace.transformers.rule;

import com.betrace.model.Rule;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.camel.Message;
import org.apache.camel.spi.DataType;
import org.apache.camel.spi.Transformer;

/**
 * Transformer to convert JSON to Rule domain object.
 */
public class JsonToRuleTransformer extends Transformer {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void transform(Message message, DataType fromType, DataType toType) throws Exception {
        String json = message.getBody(String.class);
        if (json == null || json.trim().isEmpty()) {
            throw new IllegalArgumentException("JSON input cannot be null or empty");
        }

        com.fasterxml.jackson.databind.JsonNode jsonNode = objectMapper.readTree(json);

        // Extract rule type with default
        String typeStr = jsonNode.path("type").asText("OGNL");
        Rule.RuleType ruleType = Rule.RuleType.OGNL;
        try {
            ruleType = Rule.RuleType.valueOf(typeStr);
        } catch (IllegalArgumentException e) {
            // Use default
        }

        Rule rule = Rule.create(
            jsonNode.path("id").asText(),
            jsonNode.path("name").asText(),
            jsonNode.path("version").asText("1.0"),
            jsonNode.path("expression").asText(),
            ruleType
        );

        message.setBody(rule);
    }
}