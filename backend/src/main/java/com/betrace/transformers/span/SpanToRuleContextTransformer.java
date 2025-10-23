package com.fluo.transformers.span;

import com.fluo.model.Span;
import org.apache.camel.Message;
import org.apache.camel.spi.DataType;
import org.apache.camel.spi.Transformer;

import java.util.Map;

/**
 * Transformer to convert Span to rule evaluation context.
 */
public class SpanToRuleContextTransformer extends Transformer {

    @Override
    public void transform(Message message, DataType fromType, DataType toType) throws Exception {
        Span span = message.getBody(Span.class);
        if (span == null) {
            throw new IllegalArgumentException("Span input cannot be null");
        }

        Map<String, Object> ruleContext = span.toRuleContext();

        message.setBody(ruleContext);
    }
}