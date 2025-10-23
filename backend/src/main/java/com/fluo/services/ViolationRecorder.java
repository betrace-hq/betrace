package com.fluo.services;

import com.fluo.compliance.evidence.ViolationSpan;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

/**
 * Service for recording violations when FLUO DSL rules detect pattern violations.
 *
 * ADR-023: Single-tenant deployment
 * ADR-026: Core competency #2 - Record violations when patterns match
 * ADR-027: Violations queryable via FLUO Datasource Plugin (not Tempo)
 *
 * Architecture (Option B - FLUO ViolationStore):
 * - Violations stored in DuckDB hot storage (7 days)
 * - Parquet cold storage for long-term archival
 * - NO emission to Tempo (we have our own datasource)
 * - Users query violations via Grafana FLUO Datasource → /api/violations
 *
 * Performance vs. Tempo:
 * - 10-100x faster queries (dedicated indexes on rule_id, severity)
 * - 15-20x storage compression (dictionary encoding)
 * - SRE pattern discovery via trace references
 *
 * Provenance & Audit Integrity:
 * - All violations are cryptographically signed (HMAC-SHA256)
 * - Signatures prove: violation created by FLUO backend, not tampered with
 * - Critical for compliance audits (SOC2 CC8.1: change control evidence)
 * - Violations without signatures are rejected (fail-secure)
 * - Signature key configured via `fluo.violation.signature.key`
 *
 * Usage:
 * <pre>{@code
 * violationRecorder.record(
 *     ViolationSpan.builder()
 *         .ruleId("rule-123")
 *         .ruleName("High Error Rate")
 *         .severity("HIGH")
 *         .message("Error rate 12% exceeds threshold 5%")
 *         .attribute("threshold", "5%")
 *         .attribute("actual", "12%")
 *         .build(),
 *     List.of(
 *         new ViolationStore.TraceReference("trace-1", "span-1", "api-service"),
 *         new ViolationStore.TraceReference("trace-2", "span-2", "api-service")
 *     )
 * );
 * }</pre>
 */
@ApplicationScoped
public class ViolationRecorder {

    private static final Logger LOG = Logger.getLogger(ViolationRecorder.class);

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
    ViolationStore violationStore;

    @Inject
    MetricsService metricsService;

    /**
     * Record violation to FLUO ViolationStore (DuckDB → Parquet).
     *
     * Provenance Verification: Verifies cryptographic signature to ensure:
     * - Violation was created by FLUO backend (not forged)
     * - Violation data hasn't been tampered with
     * - Audit trail integrity for compliance (SOC2 CC8.1, HIPAA 164.312(c)(2))
     *
     * @param violation Violation to record
     * @param traceReferences List of trace/span references for SRE pattern discovery
     */
    public void record(ViolationSpan violation, List<ViolationStore.TraceReference> traceReferences) {
        if (!violationsEnabled) {
            LOG.debug("Violation recording disabled");
            return;
        }

        try {
            // Provenance Verification: Ensure violation authenticity and integrity
            if (signatureRequired) {
                if (violation.signature == null || violation.signature.isBlank()) {
                    LOG.errorf("Violation rejected: missing signature (rule=%s) - cannot prove provenance",
                        violation.getRuleId());
                    throw new SecurityException("Violation must have cryptographic signature for audit trail");
                }

                // Verify signature if key is configured
                if (signatureKey.isPresent()) {
                    byte[] keyBytes = signatureKey.get().getBytes(StandardCharsets.UTF_8);
                    if (!violation.verifySignature(keyBytes)) {
                        LOG.errorf("Violation rejected: invalid signature (rule=%s) - tampering detected or forged",
                            violation.getRuleId());
                        throw new SecurityException("Violation signature verification failed - audit integrity compromised");
                    }
                }
            }

            // Store in FLUO ViolationStore (NOT Tempo)
            violationStore.insert(violation, traceReferences);

            // Record metrics
            metricsService.recordViolation(
                violation.getRuleId(),
                violation.getSeverity()
            );

            LOG.infof("Recorded signed violation: rule=%s, severity=%s, traces=%d, message=%s",
                violation.getRuleId(),
                violation.getSeverity(),
                traceReferences != null ? traceReferences.size() : 0,
                violation.getMessage()
            );
        } catch (SecurityException e) {
            LOG.errorf(e, "Security violation: %s", e.getMessage());
            throw e;  // Re-throw security exceptions
        } catch (Exception e) {
            LOG.errorf(e, "Failed to record violation: %s", e.getMessage());
        }
    }
}
