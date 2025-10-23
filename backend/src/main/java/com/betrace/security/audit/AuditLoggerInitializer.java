package com.betrace.security.audit;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * PRD-006 Unit 3: AuditLogger Singleton Initialization
 *
 * Initializes the AuditLogger singleton on Quarkus startup to enable
 * static method access from bytecode-injected calls.
 *
 * Why Needed:
 * - SandboxTransformer injects static method calls (AuditLogger.logViolation)
 * - Static methods cannot use CDI directly
 * - Solution: Inject CDI instance into static holder on startup
 *
 * Lifecycle:
 * 1. Quarkus starts
 * 2. CDI creates AuditLogger bean
 * 3. onStart() observes StartupEvent
 * 4. Sets static INSTANCE in AuditLogger
 * 5. Bytecode-injected calls can now use static methods
 */
@ApplicationScoped
public class AuditLoggerInitializer {

    private static final Logger LOG = Logger.getLogger(AuditLoggerInitializer.class);

    @Inject
    AuditLogger auditLogger;

    void onStart(@Observes StartupEvent event) {
        LOG.info("Initializing AuditLogger for sandbox violation tracking (PRD-006 Unit 3)");

        // Inject CDI instance into static holder
        AuditLogger.setInstance(auditLogger);

        LOG.info("AuditLogger enabled:");
        LOG.info("  - OpenTelemetry span emission for violations");
        LOG.info("  - Compliance evidence: SOC2 CC7.2, HIPAA 164.312(b)");
        LOG.info("  - Tenant isolation with DDoS detection");
        LOG.info("  - Searchable in Grafana Loki");
    }
}
