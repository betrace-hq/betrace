package com.fluo.transformers.signal;

import com.fluo.model.Signal;
import org.apache.camel.Message;
import org.apache.camel.spi.DataType;
import org.apache.camel.spi.Transformer;

import java.util.HashMap;
import java.util.Map;

/**
 * Transformer to convert Signal to TigerBeetle transfer format.
 */
public class SignalToTigerBeetleTransformer extends Transformer {

    @Override
    public void transform(Message message, DataType fromType, DataType toType) throws Exception {
        Signal signal = message.getBody(Signal.class);
        if (signal == null) {
            throw new IllegalArgumentException("Signal input cannot be null");
        }

        Map<String, Object> transfer = new HashMap<>();
        transfer.put("id", signal.id());
        transfer.put("timestamp", signal.timestamp().toEpochMilli());
        transfer.put("ledger", 1); // Default ledger
        transfer.put("code", computeHashCode(signal.ruleId())); // Rule ID as code

        // Encode signal data as TigerBeetle user data
        Map<String, Object> userData = new HashMap<>();
        userData.put("signalId", signal.id());
        userData.put("ruleId", signal.ruleId());
        userData.put("ruleVersion", signal.ruleVersion());
        userData.put("spanId", signal.spanId());
        userData.put("traceId", signal.traceId());
        userData.put("severity", signal.severity().name());
        userData.put("message", signal.message());
        userData.put("attributes", signal.attributes());
        userData.put("source", signal.source());
        userData.put("tenantId", signal.tenantId());
        userData.put("status", signal.status().name());

        transfer.put("userData", userData);
        transfer.put("flags", 0); // No special flags

        // Set debit and credit accounts based on tenant
        long tenantAccount = computeHashCode(signal.tenantId());
        transfer.put("debitAccountId", tenantAccount);
        transfer.put("creditAccountId", tenantAccount + 1); // Signal storage account

        // Amount represents signal priority (for sorting/filtering)
        transfer.put("amount", signal.severity().ordinal());

        message.setBody(transfer);
    }

    private long computeHashCode(String value) {
        if (value == null) return 0;
        return Math.abs(value.hashCode());
    }
}