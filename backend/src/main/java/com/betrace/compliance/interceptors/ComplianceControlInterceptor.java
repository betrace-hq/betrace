package com.betrace.compliance.interceptors;

import com.betrace.compliance.annotations.ComplianceControl;
import jakarta.annotation.Priority;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InvocationContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.*;

/**
 * CDI Interceptor for automatic compliance tracking
 * Intercepts methods annotated with @ComplianceControl
 */
@Interceptor
@ComplianceControl
@Priority(Interceptor.Priority.APPLICATION)
public class ComplianceControlInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(ComplianceControlInterceptor.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

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

        // Generate tracking ID
        String trackingId = UUID.randomUUID().toString();
        Instant startTime = Instant.now();

        // Extract compliance metadata
        ComplianceEvent event = buildComplianceEvent(annotation, method, context.getParameters(), trackingId);

        // Log before execution
        logComplianceStart(event);

        Object result = null;
        Exception thrownException = null;
        boolean success = false;

        try {
            // Execute the actual method
            result = context.proceed();
            success = true;
            return result;
        } catch (Exception e) {
            thrownException = e;
            throw e;
        } finally {
            // Calculate execution time
            long duration = Instant.now().toEpochMilli() - startTime.toEpochMilli();

            // Update event with results
            event.setDuration(duration);
            event.setSuccess(success);
            if (thrownException != null) {
                event.setError(thrownException.getMessage());
            }

            // Store evidence
            storeComplianceEvidence(event);

            // Log completion
            logComplianceEnd(event);

            // Alert on critical failures
            if (!success && annotation.priority() == ComplianceControl.Priority.CRITICAL) {
                alertCriticalFailure(event, thrownException);
            }
        }
    }

    private ComplianceEvent buildComplianceEvent(ComplianceControl annotation, Method method,
                                                  Object[] parameters, String trackingId) {
        ComplianceEvent event = new ComplianceEvent();
        event.setTrackingId(trackingId);
        event.setTimestamp(Instant.now());
        event.setMethodName(method.getDeclaringClass().getSimpleName() + "." + method.getName());

        // Extract all compliance controls
        List<String> controls = new ArrayList<>();

        // SOC 2 controls
        for (String control : annotation.soc2()) {
            controls.add("SOC2." + control);
        }

        // HIPAA safeguards
        for (String safeguard : annotation.hipaa()) {
            controls.add("HIPAA." + safeguard);
        }

        // FedRAMP controls
        for (String control : annotation.fedramp()) {
            controls.add("FedRAMP." + annotation.fedrampLevel() + "." + control);
        }

        // ISO 27001 controls
        for (String control : annotation.iso27001()) {
            controls.add("ISO27001." + control);
        }

        // PCI-DSS requirements
        for (String requirement : annotation.pcidss()) {
            controls.add("PCI-DSS." + requirement);
        }

        event.setControls(controls);
        event.setPriority(annotation.priority().toString());
        event.setSensitiveData(annotation.sensitiveData());
        event.setRetentionDays(annotation.retentionDays());

        // Extract contextual information
        Map<String, Object> context = extractContext(parameters);
        event.setContext(context);

        return event;
    }

    private Map<String, Object> extractContext(Object[] parameters) {
        Map<String, Object> context = new HashMap<>();

        // Extract user ID if present
        for (Object param : parameters) {
            if (param != null) {
                String paramStr = param.toString();
                if (paramStr.contains("user") || paramStr.contains("User")) {
                    context.put("userId", paramStr);
                } else if (paramStr.contains("tenant") || paramStr.contains("Tenant")) {
                    context.put("tenantId", paramStr);
                }
            }
        }

        // Add system context
        context.put("thread", Thread.currentThread().getName());
        context.put("timestamp", Instant.now().toString());

        return context;
    }

    private void storeComplianceEvidence(ComplianceEvent event) {
        try {
            // In production, this would store in an immutable audit log
            // For now, we'll log it as JSON
            String evidenceJson = objectMapper.writeValueAsString(event);
            logger.info("COMPLIANCE_EVIDENCE: {}", evidenceJson);

            // Store in evidence vault based on retention requirements
            if (event.getRetentionDays() > 0) {
                // Would integrate with evidence storage system
                logger.debug("Storing evidence with retention: {} days", event.getRetentionDays());
            }
        } catch (Exception e) {
            logger.error("Failed to store compliance evidence", e);
        }
    }

    private void logComplianceStart(ComplianceEvent event) {
        logger.info("COMPLIANCE_START: Method {} invoked with controls: {} - TrackingId: {}",
            event.getMethodName(),
            String.join(", ", event.getControls()),
            event.getTrackingId());
    }

    private void logComplianceEnd(ComplianceEvent event) {
        if (event.isSuccess()) {
            logger.info("COMPLIANCE_SUCCESS: Method {} completed in {}ms - TrackingId: {}",
                event.getMethodName(),
                event.getDuration(),
                event.getTrackingId());
        } else {
            logger.error("COMPLIANCE_FAILURE: Method {} failed after {}ms - TrackingId: {} - Error: {}",
                event.getMethodName(),
                event.getDuration(),
                event.getTrackingId(),
                event.getError());
        }
    }

    private void alertCriticalFailure(ComplianceEvent event, Exception exception) {
        logger.error("COMPLIANCE_CRITICAL_ALERT: Critical compliance control failure in {} - Controls: {} - Error: {}",
            event.getMethodName(),
            String.join(", ", event.getControls()),
            exception != null ? exception.getMessage() : "Unknown error");

        // In production, this would trigger immediate alerts
        // - Send to SIEM
        // - Page on-call team
        // - Create incident ticket
    }

    /**
     * Compliance event data structure
     */
    public static class ComplianceEvent {
        private String trackingId;
        private Instant timestamp;
        private String methodName;
        private List<String> controls;
        private String priority;
        private boolean sensitiveData;
        private int retentionDays;
        private Map<String, Object> context;
        private long duration;
        private boolean success;
        private String error;

        // Getters and setters
        public String getTrackingId() { return trackingId; }
        public void setTrackingId(String trackingId) { this.trackingId = trackingId; }

        public Instant getTimestamp() { return timestamp; }
        public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

        public String getMethodName() { return methodName; }
        public void setMethodName(String methodName) { this.methodName = methodName; }

        public List<String> getControls() { return controls; }
        public void setControls(List<String> controls) { this.controls = controls; }

        public String getPriority() { return priority; }
        public void setPriority(String priority) { this.priority = priority; }

        public boolean isSensitiveData() { return sensitiveData; }
        public void setSensitiveData(boolean sensitiveData) { this.sensitiveData = sensitiveData; }

        public int getRetentionDays() { return retentionDays; }
        public void setRetentionDays(int retentionDays) { this.retentionDays = retentionDays; }

        public Map<String, Object> getContext() { return context; }
        public void setContext(Map<String, Object> context) { this.context = context; }

        public long getDuration() { return duration; }
        public void setDuration(long duration) { this.duration = duration; }

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }

        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
    }
}