package com.fluo.services;

import com.fluo.compliance.evidence.SecurityEventSpan;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Service for emitting compliance evidence spans as OpenTelemetry traces.
 *
 * PRD-007 Unit E: Compliance Audit Logging
 *
 * Responsibilities:
 * - Emit SecurityEventSpan instances as OpenTelemetry spans
 * - Enable/disable compliance span emission via configuration
 * - Log compliance events for audit trail
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

    /**
     * Emit compliance span as OpenTelemetry span.
     *
     * Spans are exported to configured OTLP endpoint (Grafana/Tempo).
     *
     * @param complianceSpan Security event span to emit
     */
    public void emit(SecurityEventSpan complianceSpan) {
        if (!complianceEnabled) {
            LOG.debug("Compliance span emission disabled");
            return;
        }

        try {
            // Export to OpenTelemetry
            complianceSpan.exportToOtel();

            LOG.infof("Emitted compliance span: framework=%s, control=%s, event=%s, tenant=%s",
                complianceSpan.framework,
                complianceSpan.control,
                complianceSpan.attributes.get("event_type"),
                complianceSpan.getTenantId()
            );
        } catch (Exception e) {
            LOG.errorf(e, "Failed to emit compliance span: %s", e.getMessage());
        }
    }
}
