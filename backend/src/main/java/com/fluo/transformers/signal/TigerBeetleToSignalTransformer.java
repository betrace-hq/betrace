package com.fluo.transformers.signal;

import com.fluo.model.Signal;
import org.apache.camel.Message;
import org.apache.camel.spi.DataType;
import org.apache.camel.spi.Transformer;

import java.time.Instant;
import java.util.Map;

/**
 * Transformer to convert TigerBeetle result back to Signal.
 */
public class TigerBeetleToSignalTransformer extends Transformer {

    @Override
    public void transform(Message message, DataType fromType, DataType toType) throws Exception {
        Map<String, Object> result = message.getBody(Map.class);
        if (result == null) {
            throw new IllegalArgumentException("TigerBeetle result cannot be null");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> userData = (Map<String, Object>) result.get("userData");

        if (userData == null) {
            throw new IllegalArgumentException("No userData in TigerBeetle result");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> attributes = (Map<String, Object>) userData.get("attributes");
        if (attributes == null) {
            attributes = Map.of();
        }

        Signal signal = new Signal(
            (String) userData.get("signalId"),
            (String) userData.get("ruleId"),
            (String) userData.get("ruleVersion"),
            (String) userData.get("spanId"),
            (String) userData.get("traceId"),
            Instant.ofEpochMilli((Long) result.get("timestamp")),
            Signal.SignalSeverity.valueOf((String) userData.get("severity")),
            (String) userData.get("message"),
            attributes,
            (String) userData.get("source"),
            (String) userData.get("tenantId"),
            Signal.SignalStatus.valueOf((String) userData.get("status"))
        );

        message.setBody(signal);
    }
}