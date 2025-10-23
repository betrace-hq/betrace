package com.betrace.compliance.interceptors;

import com.betrace.compliance.annotations.ComplianceControl;
import com.betrace.compliance.telemetry.ComplianceSpanProcessor;
import com.betrace.compliance.telemetry.ComplianceSpanProcessor.ComplianceSpan;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.common.Attributes;
import jakarta.annotation.Priority;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InvocationContext;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Method;
import java.util.*;

/**
 * CDI Interceptor that creates OpenTelemetry spans for compliance tracking
 * Integrates with Grafana Tempo and other OTEL-compatible tools
 */
@Interceptor
@ComplianceControl
@Priority(Interceptor.Priority.APPLICATION)
public class ComplianceOtelInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(ComplianceOtelInterceptor.class);

    @Inject
    ComplianceSpanProcessor spanProcessor;

    @AroundInvoke
    public Object interceptComplianceControl(InvocationContext context) throws Exception {
        Method method = context.getMethod();
        ComplianceControl annotation = method.getAnnotation(ComplianceControl.class);

        if (annotation == null) {
            // Check class-level annotation
            annotation = context.getTarget().getClass().getAnnotation(ComplianceControl.class);
        }

        if (annotation == null) {
            // No annotation found, proceed normally
            return context.proceed();
        }

        // Build operation name
        String operationName = String.format("%s.%s",
            method.getDeclaringClass().getSimpleName(),
            method.getName());

        // Start compliance span
        ComplianceSpan complianceSpan = spanProcessor.startComplianceSpan(operationName, annotation);
        Span span = complianceSpan.getSpan();

        // Extract context from parameters
        extractParameterContext(span, method, context.getParameters());

        Object result = null;
        Exception thrownException = null;
        boolean success = false;

        try (complianceSpan) {  // Auto-close the span
            // Add event for method start
            span.addEvent("Method execution started",
                Attributes.builder()
                    .put("method.name", method.getName())
                    .put("method.class", method.getDeclaringClass().getName())
                    .build());

            // Execute the actual method
            result = context.proceed();
            success = true;

            // Add success event
            span.addEvent("Method execution completed",
                Attributes.builder()
                    .put("execution.success", true)
                    .build());

            return result;
        } catch (Exception e) {
            thrownException = e;

            // Add error event
            span.addEvent("Method execution failed",
                Attributes.builder()
                    .put("exception.type", e.getClass().getName())
                    .put("exception.message", e.getMessage() != null ? e.getMessage() : "No message")
                    .put("execution.success", false)
                    .build());

            throw e;
        } finally {
            // Complete the span with outcome
            Map<String, Object> additionalData = new HashMap<>();
            additionalData.put("execution_time_ms", System.currentTimeMillis());
            additionalData.put("thread_name", Thread.currentThread().getName());

            String outcome = success ? "Operation completed successfully" :
                "Operation failed: " + (thrownException != null ? thrownException.getMessage() : "Unknown error");

            spanProcessor.completeComplianceSpan(complianceSpan, success, outcome, additionalData);

            // Log summary for local debugging
            if (logger.isDebugEnabled()) {
                logger.debug("Compliance tracking completed for {} - Success: {} - Priority: {}",
                    operationName, success, annotation.priority());
            }
        }
    }

    /**
     * Extract context from method parameters and add to span
     */
    private void extractParameterContext(Span span, Method method, Object[] parameters) {
        // Extract user ID if present
        String userId = extractUserId(parameters);
        if (userId != null) {
            span.setAttribute(ComplianceSpanProcessor.COMPLIANCE_USER_ID, userId);
        }

        // Extract tenant ID if present
        String tenantId = extractTenantId(parameters);
        if (tenantId != null) {
            span.setAttribute(ComplianceSpanProcessor.COMPLIANCE_TENANT_ID, tenantId);
        }

        // Add parameter types as attributes
        Class<?>[] paramTypes = method.getParameterTypes();
        for (int i = 0; i < paramTypes.length && i < parameters.length; i++) {
            String paramKey = String.format("param.%d.type", i);
            span.setAttribute(paramKey, paramTypes[i].getSimpleName());

            // Add specific values for important types (without sensitive data)
            if (parameters[i] != null) {
                if (paramTypes[i].getSimpleName().contains("Signal")) {
                    span.setAttribute(String.format("param.%d.signal_id", i),
                        extractFieldValue(parameters[i], "id"));
                } else if (paramTypes[i].getSimpleName().contains("Rule")) {
                    span.setAttribute(String.format("param.%d.rule_id", i),
                        extractFieldValue(parameters[i], "id"));
                } else if (paramTypes[i].getSimpleName().contains("Tenant")) {
                    span.setAttribute(String.format("param.%d.tenant_id", i),
                        extractFieldValue(parameters[i], "tenantId"));
                }
            }
        }
    }

    /**
     * Extract user ID from parameters
     */
    private String extractUserId(Object[] parameters) {
        for (Object param : parameters) {
            if (param instanceof String) {
                String str = (String) param;
                if (str.contains("user") || str.contains("User")) {
                    return str;
                }
            }
        }
        return null;
    }

    /**
     * Extract tenant ID from parameters
     */
    private String extractTenantId(Object[] parameters) {
        for (Object param : parameters) {
            if (param instanceof String) {
                String str = (String) param;
                if (str.contains("tenant") || str.contains("Tenant")) {
                    return str;
                }
            } else if (param != null) {
                // Try to extract from object
                String tenantId = extractFieldValue(param, "tenantId");
                if (tenantId != null) {
                    return tenantId;
                }
            }
        }
        return null;
    }

    /**
     * Extract field value from object using reflection
     */
    private String extractFieldValue(Object obj, String fieldName) {
        try {
            // Try getter method
            String getterName = "get" + fieldName.substring(0, 1).toUpperCase() + fieldName.substring(1);
            Method getter = obj.getClass().getMethod(getterName);
            Object value = getter.invoke(obj);
            return value != null ? value.toString() : null;
        } catch (Exception e1) {
            try {
                // Try direct field access
                java.lang.reflect.Field field = obj.getClass().getDeclaredField(fieldName);
                field.setAccessible(true);
                Object value = field.get(obj);
                return value != null ? value.toString() : null;
            } catch (Exception e2) {
                // Unable to extract
                return null;
            }
        }
    }
}