package com.betrace.security;

import com.betrace.security.agent.SandboxContext;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * Initializes sandbox performance monitoring at application startup.
 *
 * PRD-006 Unit 1: Performance Monitoring
 *
 * Responsibilities:
 * - Inject CDI MeterRegistry into static SandboxContext
 * - Enable Prometheus metrics export for sandbox operations
 * - Log initialization status
 *
 * Metrics Exported:
 * - sandbox.invocations.total (by operation, tenant)
 * - sandbox.violations.total (by violation_type, tenant)
 * - sandbox.execution.duration (by tenant)
 *
 * Integration:
 * - Called automatically by Quarkus on StartupEvent
 * - MeterRegistry injected via CDI
 * - Works with quarkus-micrometer-registry-prometheus extension
 *
 * @see SandboxContext
 * @see io.micrometer.core.instrument.MeterRegistry
 */
@ApplicationScoped
public class SandboxMetricsInitializer {

    private static final Logger LOG = Logger.getLogger(SandboxMetricsInitializer.class);

    @Inject
    MeterRegistry meterRegistry;

    /**
     * Initialize sandbox metrics on application startup.
     *
     * @param event Quarkus startup event
     */
    void onStart(@Observes StartupEvent event) {
        LOG.info("Initializing sandbox performance monitoring (PRD-006 Unit 1)");

        // Inject CDI MeterRegistry into static SandboxContext
        SandboxContext.setMeterRegistry(meterRegistry);

        LOG.info("Sandbox metrics enabled:");
        LOG.info("  - sandbox.invocations.total (by operation, tenant)");
        LOG.info("  - sandbox.violations.total (by violation_type, tenant)");
        LOG.info("  - sandbox.execution.duration (by tenant)");
        LOG.info("  - Prometheus endpoint: /q/metrics");
    }
}
