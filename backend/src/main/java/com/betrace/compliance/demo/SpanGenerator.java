package com.fluo.compliance.demo;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.util.Random;

/**
 * Demo span generator for FLUO behavioral assurance testing.
 * Generates realistic trace data demonstrating FLUO's three core use cases:
 *
 * 1. SRE: Undocumented invariant discovery (payment fraud-check before charge)
 * 2. Developer: Contract violation detection (API key validation before data access)
 * 3. Compliance: Control effectiveness validation (SOC2, HIPAA, etc.)
 *
 * Each scenario intentionally includes invariant violations to demonstrate
 * FLUO's ability to detect behavioral patterns and anomalies in traces.
 *
 * Note: Triggered automatically by DemoSpanRoute (Camel timer every 30s)
 */
@ApplicationScoped
public class SpanGenerator {

    private static final Logger LOG = Logger.getLogger(SpanGenerator.class);
    private final Random random = new Random();

    @Inject
    OpenTelemetry openTelemetry;

    private Tracer tracer;

    @jakarta.annotation.PostConstruct
    void init() {
        this.tracer = openTelemetry.getTracer("fluo-demo-span-generator", "1.0.0");
        LOG.info("Demo Span Generator initialized (triggered by DemoSpanRoute)");
    }

    /**
     * Generate demo spans - called by DemoSpanRoute Camel timer
     */
    public void generateDemoSpans() {
        try {
            // Randomly choose a scenario
            int scenario = random.nextInt(5);
            switch (scenario) {
                case 0 -> generateUserAuthenticationFlow();
                case 1 -> generateDataProcessingFlow();
                case 2 -> generateComplianceValidationFlow();
                case 3 -> generatePaymentProcessingFlow();
                case 4 -> generateApiAccessPatternFlow();
            }
        } catch (Exception e) {
            LOG.error("Error generating demo spans", e);
        }
    }

    /**
     * Simulates a user authentication flow with multiple steps
     */
    private void generateUserAuthenticationFlow() {
        Span parentSpan = tracer.spanBuilder("user.authentication")
                .setSpanKind(SpanKind.SERVER)
                .setAttribute("user.id", "user-" + random.nextInt(1000))
                .setAttribute("auth.method", "jwt")
                .setAttribute("demo.scenario", "authentication")
                .startSpan();

        try (Scope scope = parentSpan.makeCurrent()) {
            simulateWork(10, 30);

            // Validate credentials
            Span validateSpan = tracer.spanBuilder("auth.validate_credentials")
                    .setSpanKind(SpanKind.INTERNAL)
                    .startSpan();
            try (Scope validateScope = validateSpan.makeCurrent()) {
                simulateWork(20, 50);
                validateSpan.setAttribute("credentials.valid", true);
            } finally {
                validateSpan.end();
            }

            // Check permissions
            Span permissionsSpan = tracer.spanBuilder("auth.check_permissions")
                    .setSpanKind(SpanKind.INTERNAL)
                    .startSpan();
            try (Scope permScope = permissionsSpan.makeCurrent()) {
                simulateWork(15, 40);
                permissionsSpan.setAttribute("permissions.count", random.nextInt(10) + 1);
            } finally {
                permissionsSpan.end();
            }

            parentSpan.setAttribute("auth.success", true);
        } finally {
            parentSpan.end();
        }
    }

    /**
     * Simulates a data processing pipeline
     */
    private void generateDataProcessingFlow() {
        Span parentSpan = tracer.spanBuilder("data.processing_pipeline")
                .setSpanKind(SpanKind.SERVER)
                .setAttribute("pipeline.id", "pipeline-" + random.nextInt(100))
                .setAttribute("demo.scenario", "data_processing")
                .startSpan();

        try (Scope scope = parentSpan.makeCurrent()) {
            int recordCount = random.nextInt(1000) + 100;

            // Ingest data
            Span ingestSpan = tracer.spanBuilder("data.ingest")
                    .setSpanKind(SpanKind.INTERNAL)
                    .startSpan();
            try (Scope ingestScope = ingestSpan.makeCurrent()) {
                simulateWork(50, 100);
                ingestSpan.setAttribute("records.count", recordCount);
                ingestSpan.setAttribute("source.type", "stream");
            } finally {
                ingestSpan.end();
            }

            // Transform data
            Span transformSpan = tracer.spanBuilder("data.transform")
                    .setSpanKind(SpanKind.INTERNAL)
                    .startSpan();
            try (Scope transformScope = transformSpan.makeCurrent()) {
                simulateWork(100, 200);
                transformSpan.setAttribute("transformations.applied", 5);
            } finally {
                transformSpan.end();
            }

            // Store data
            Span storeSpan = tracer.spanBuilder("data.store")
                    .setSpanKind(SpanKind.CLIENT)
                    .startSpan();
            try (Scope storeScope = storeSpan.makeCurrent()) {
                simulateWork(30, 80);
                storeSpan.setAttribute("storage.backend", "tigerbeetle");
                storeSpan.setAttribute("records.stored", recordCount);
            } finally {
                storeSpan.end();
            }

            parentSpan.setAttribute("processing.success", true);
        } finally {
            parentSpan.end();
        }
    }

    /**
     * Simulates compliance validation checking
     */
    private void generateComplianceValidationFlow() {
        Span parentSpan = tracer.spanBuilder("compliance.validation")
                .setSpanKind(SpanKind.SERVER)
                .setAttribute("validation.framework", "SOC2")
                .setAttribute("demo.scenario", "compliance")
                .startSpan();

        try (Scope scope = parentSpan.makeCurrent()) {
            String[] controls = {"CC6.1", "CC6.7", "CC7.1", "CC7.2", "CC8.1"};

            for (String control : controls) {
                Span controlSpan = tracer.spanBuilder("compliance.check_control")
                        .setSpanKind(SpanKind.INTERNAL)
                        .setAttribute("control.id", control)
                        .startSpan();

                try (Scope controlScope = controlSpan.makeCurrent()) {
                    simulateWork(20, 60);
                    boolean passed = random.nextBoolean();
                    controlSpan.setAttribute("control.passed", passed);

                    if (passed) {
                        controlSpan.addEvent("Control validation passed");
                    } else {
                        controlSpan.addEvent("Control validation failed - remediation required");
                    }
                } finally {
                    controlSpan.end();
                }
            }

            parentSpan.setAttribute("controls.checked", controls.length);
        } finally {
            parentSpan.end();
        }
    }

    /**
     * Simulates payment processing flow
     * FLUO Use Case: SRE detecting "payment.fraud_check must occur before payment.charge_card in same trace"
     *
     * FLUO rule would detect: trace contains payment.charge_card but missing prior payment.fraud_check span
     */
    private void generatePaymentProcessingFlow() {
        Span parentSpan = tracer.spanBuilder("payment.process")
                .setSpanKind(SpanKind.SERVER)
                .setAttribute("payment.id", "pay-" + random.nextInt(100000))
                .setAttribute("payment.amount", random.nextDouble() * 1000)
                .setAttribute("payment.currency", "USD")
                .setAttribute("customer.id", "cust-" + random.nextInt(1000))
                .startSpan();

        try (Scope scope = parentSpan.makeCurrent()) {
            // Validate payment request
            Span validateSpan = tracer.spanBuilder("payment.validate_request")
                    .setSpanKind(SpanKind.INTERNAL)
                    .setAttribute("validation.checks", "amount,currency,customer")
                    .startSpan();
            try (Scope validateScope = validateSpan.makeCurrent()) {
                simulateWork(10, 30);
                validateSpan.setAttribute("validation.result", "passed");
            } finally {
                validateSpan.end();
            }

            // Sometimes skip fraud check (10% of cases)
            // FLUO will detect this pattern as an invariant violation
            if (random.nextInt(10) != 0) {
                Span fraudCheckSpan = tracer.spanBuilder("payment.fraud_check")
                        .setSpanKind(SpanKind.INTERNAL)
                        .setAttribute("fraud.service", "stripe-radar")
                        .setAttribute("fraud.risk_score", random.nextDouble())
                        .startSpan();
                try (Scope fraudScope = fraudCheckSpan.makeCurrent()) {
                    simulateWork(50, 100);
                    fraudCheckSpan.setAttribute("fraud.result", "passed");
                    fraudCheckSpan.setAttribute("fraud.rules_matched", random.nextInt(5));
                } finally {
                    fraudCheckSpan.end();
                }
            }

            // Charge card - happens regardless of fraud check
            // Application doesn't know this is wrong; FLUO detects the pattern
            Span chargeSpan = tracer.spanBuilder("payment.charge_card")
                    .setSpanKind(SpanKind.CLIENT)
                    .setAttribute("payment.processor", "stripe")
                    .setAttribute("card.brand", "visa")
                    .setAttribute("card.last4", "4242")
                    .setAttribute("card.exp_month", 12)
                    .setAttribute("card.exp_year", 2025)
                    .startSpan();
            try (Scope chargeScope = chargeSpan.makeCurrent()) {
                simulateWork(30, 80);
                chargeSpan.setAttribute("charge.status", "succeeded");
                chargeSpan.setAttribute("charge.id", "ch-" + random.nextInt(1000000));
            } finally {
                chargeSpan.end();
            }

            parentSpan.setAttribute("payment.status", "completed");
        } finally {
            parentSpan.end();
        }
    }

    /**
     * Simulates API data access flow
     * FLUO Use Case: Developer detecting "api.validate_key must occur before database.query_pii in same trace"
     *
     * FLUO rule would detect: trace contains database.query_pii with data.contains_pii=true but missing prior api.validate_key span
     */
    private void generateApiAccessPatternFlow() {
        Span parentSpan = tracer.spanBuilder("api.request")
                .setSpanKind(SpanKind.SERVER)
                .setAttribute("http.method", "GET")
                .setAttribute("http.route", "/api/v1/customers/{id}/profile")
                .setAttribute("http.target", "/api/v1/customers/12345/profile")
                .setAttribute("client.ip", "203.0.113." + random.nextInt(255))
                .startSpan();

        try (Scope scope = parentSpan.makeCurrent()) {
            // Sometimes skip API key validation (12.5% of cases)
            // FLUO will detect when PII is accessed without prior validation
            if (random.nextInt(8) != 0) {
                Span validateKeySpan = tracer.spanBuilder("api.validate_key")
                        .setSpanKind(SpanKind.INTERNAL)
                        .setAttribute("api_key.prefix", "sk_live_")
                        .setAttribute("api_key.hash", "sha256-" + random.nextInt(10000))
                        .startSpan();
                try (Scope keyScope = validateKeySpan.makeCurrent()) {
                    simulateWork(20, 50);
                    validateKeySpan.setAttribute("validation.result", "valid");
                    validateKeySpan.setAttribute("key.scopes", "customers:read,customers:write");
                } finally {
                    validateKeySpan.end();
                }

                // Check rate limits
                Span rateLimitSpan = tracer.spanBuilder("api.check_rate_limit")
                        .setSpanKind(SpanKind.INTERNAL)
                        .setAttribute("rate_limit.window", "1m")
                        .startSpan();
                try (Scope rateScope = rateLimitSpan.makeCurrent()) {
                    simulateWork(10, 20);
                    rateLimitSpan.setAttribute("rate_limit.remaining", random.nextInt(1000));
                    rateLimitSpan.setAttribute("rate_limit.limit", 1000);
                } finally {
                    rateLimitSpan.end();
                }
            }

            // Query database for PII - happens regardless of validation
            Span dbQuerySpan = tracer.spanBuilder("database.query_pii")
                    .setSpanKind(SpanKind.CLIENT)
                    .setAttribute("db.system", "postgresql")
                    .setAttribute("db.name", "customers")
                    .setAttribute("db.statement", "SELECT * FROM customer_profiles WHERE id = $1")
                    .setAttribute("data.contains_pii", true)
                    .setAttribute("data.pii_types", "email,phone,ssn")
                    .startSpan();
            try (Scope dbScope = dbQuerySpan.makeCurrent()) {
                simulateWork(40, 100);
                dbQuerySpan.setAttribute("db.rows_returned", 1);
                dbQuerySpan.setAttribute("customer.id", "12345");
            } finally {
                dbQuerySpan.end();
            }

            // Audit log (compliance requirement)
            Span auditLogSpan = tracer.spanBuilder("audit.log_pii_access")
                    .setSpanKind(SpanKind.INTERNAL)
                    .setAttribute("audit.action", "customer_profile_read")
                    .setAttribute("audit.resource", "customer:12345")
                    .startSpan();
            try (Scope auditScope = auditLogSpan.makeCurrent()) {
                simulateWork(5, 15);
                auditLogSpan.setAttribute("audit.timestamp", System.currentTimeMillis());
            } finally {
                auditLogSpan.end();
            }

            parentSpan.setAttribute("http.status_code", 200);
        } finally {
            parentSpan.end();
        }
    }

    /**
     * Simulate work by sleeping for a random duration
     */
    private void simulateWork(int minMs, int maxMs) {
        try {
            int duration = random.nextInt(maxMs - minMs) + minMs;
            Thread.sleep(duration);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
