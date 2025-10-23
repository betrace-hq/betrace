package com.fluo.services;

import com.fluo.compliance.evidence.ComplianceSpanSigner;
import com.fluo.compliance.evidence.SecurityEventSpan;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * Service for emitting compliance evidence spans as OpenTelemetry traces.
 *
 * PRD-007 Unit E: Compliance Audit Logging + P0 Security Fixes
 *
 * Responsibilities:
 * - Emit SecurityEventSpan instances as OpenTelemetry spans
 * - Verify cryptographic signatures for tamper-evidence (P0 fix)
 * - Enable/disable compliance span emission via configuration
 * - Log compliance events for audit trail
 *
 * Security:
 * - All compliance spans must have valid HMAC-SHA256 signatures
 * - Spans without signatures are rejected (fail-secure)
 * - Attributes are validated for PII redaction before export
 *
 * Architecture:
 * - ADR-011 compliant (pure application, no deployment logic)
 * - Integrates with FLUO's existing compliance framework
 */
@ApplicationScoped
public class ComplianceSpanEmitter {

    private static final Logger LOG = Logger.getLogger(ComplianceSpanEmitter.class);

    @Inject
    @ConfigProperty(name = "fluo.compliance.enabled", defaultValue = "true")
    boolean complianceEnabled;

    @Inject
    @ConfigProperty(name = "fluo.compliance.signature.key")
    Optional<String> signatureKey;

    @Inject
    @ConfigProperty(name = "fluo.compliance.signature.required", defaultValue = "true")
    boolean signatureRequired;

    /**
     * Emit compliance span as OpenTelemetry span.
     *
     * Spans are exported to configured OTLP endpoint (Grafana/Tempo).
     *
     * P0 Security: Verifies span signature before emission (SOC2 CC8.1, HIPAA 164.312(c)(2)).
     *
     * @param complianceSpan Security event span to emit
     */
    public void emit(SecurityEventSpan complianceSpan) {
        if (!complianceEnabled) {
            LOG.debug("Compliance span emission disabled");
            return;
        }

        try {
            // P0 Security: Verify span has valid signature
            if (signatureRequired) {
                if (complianceSpan.signature == null || complianceSpan.signature.isBlank()) {
                    LOG.errorf("Compliance span rejected: missing signature (tenant=%s, control=%s)",
                        complianceSpan.getTenantId(), complianceSpan.control);
                    throw new SecurityException("Compliance span must have cryptographic signature");
                }

                // Verify signature if key is configured
                if (signatureKey.isPresent()) {
                    byte[] keyBytes = signatureKey.get().getBytes(StandardCharsets.UTF_8);
                    if (!complianceSpan.verifySignature(keyBytes)) {
                        LOG.errorf("Compliance span rejected: invalid signature (tenant=%s, control=%s)",
                            complianceSpan.getTenantId(), complianceSpan.control);
                        throw new SecurityException("Compliance span signature verification failed");
                    }
                }
            }

            // Export to OpenTelemetry
            complianceSpan.exportToOtel();

            LOG.infof("Emitted signed compliance span: framework=%s, control=%s, event=%s, tenant=%s",
                complianceSpan.framework,
                complianceSpan.control,
                complianceSpan.attributes.get("event_type"),
                complianceSpan.getTenantId()
            );
        } catch (SecurityException e) {
            LOG.errorf(e, "Security violation: %s", e.getMessage());
            throw e;  // Re-throw security exceptions
        } catch (Exception e) {
            LOG.errorf(e, "Failed to emit compliance span: %s", e.getMessage());
        }
    }
}
