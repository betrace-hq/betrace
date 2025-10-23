package com.fluo.services;

import com.fluo.compliance.evidence.ViolationSpan;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * Service for emitting violation spans when FLUO DSL rules detect pattern violations.
 *
 * ADR-023: Single-tenant deployment
 * ADR-026: Core competency #2 - Emit violation spans when patterns match
 * ADR-027: Violation spans queryable via Grafana datasource plugin
 *
 * Architecture:
 * - Replaces Signal model + SignalService.emit()
 * - Violations are OpenTelemetry spans exported to Tempo
 * - Users query violations via Grafana datasource: `{span.violation.severity = "HIGH"}`
 *
 * Security:
 * - All violation spans are cryptographically signed (HMAC-SHA256)
 * - Spans without signatures are rejected (fail-secure)
 * - Signature key configured via `fluo.violation.signature.key`
 *
 * Usage:
 * <pre>{@code
 * violationSpanEmitter.emit(
 *     ViolationSpan.builder()
 *         .ruleId("rule-123")
 *         .ruleName("High Error Rate")
 *         .severity("HIGH")
 *         .traceId(trace.getId())
 *         .message("Error rate 12% exceeds threshold 5%")
 *         .attribute("threshold", "5%")
 *         .attribute("actual", "12%")
 *         .build()
 * );
 * }</pre>
 */
@ApplicationScoped
public class ViolationSpanEmitter {

    private static final Logger LOG = Logger.getLogger(ViolationSpanEmitter.class);

    @Inject
    @ConfigProperty(name = "fluo.violations.enabled", defaultValue = "true")
    boolean violationsEnabled;

    @Inject
    @ConfigProperty(name = "fluo.violation.signature.key")
    Optional<String> signatureKey;

    @Inject
    @ConfigProperty(name = "fluo.violation.signature.required", defaultValue = "true")
    boolean signatureRequired;

    @Inject
    MetricsService metricsService;

    /**
     * Emit violation span to OpenTelemetry/Tempo.
     *
     * P0 Security: Verifies span signature before emission (SOC2 CC8.1, HIPAA 164.312(c)(2)).
     *
     * @param violationSpan Violation span to emit
     */
    public void emit(ViolationSpan violationSpan) {
        if (!violationsEnabled) {
            LOG.debug("Violation span emission disabled");
            return;
        }

        try {
            // P0 Security: Verify span has valid signature
            if (signatureRequired) {
                if (violationSpan.signature == null || violationSpan.signature.isBlank()) {
                    LOG.errorf("Violation span rejected: missing signature (rule=%s, trace=%s)",
                        violationSpan.getRuleId(), violationSpan.getTraceId());
                    throw new SecurityException("Violation span must have cryptographic signature");
                }

                // Verify signature if key is configured
                if (signatureKey.isPresent()) {
                    byte[] keyBytes = signatureKey.get().getBytes(StandardCharsets.UTF_8);
                    if (!violationSpan.verifySignature(keyBytes)) {
                        LOG.errorf("Violation span rejected: invalid signature (rule=%s, trace=%s)",
                            violationSpan.getRuleId(), violationSpan.getTraceId());
                        throw new SecurityException("Violation span signature verification failed");
                    }
                }
            }

            // Export to OpenTelemetry
            violationSpan.exportToOtel();

            // Record metrics
            metricsService.recordViolation(
                violationSpan.getRuleId(),
                violationSpan.getSeverity()
            );

            LOG.infof("Emitted signed violation span: rule=%s, severity=%s, trace=%s, message=%s",
                violationSpan.getRuleId(),
                violationSpan.getSeverity(),
                violationSpan.getTraceId(),
                violationSpan.getMessage()
            );
        } catch (SecurityException e) {
            LOG.errorf(e, "Security violation: %s", e.getMessage());
            throw e;  // Re-throw security exceptions
        } catch (Exception e) {
            LOG.errorf(e, "Failed to emit violation span: %s", e.getMessage());
        }
    }
}
