package com.betrace.compliance.demo;

import io.quarkus.scheduler.Scheduled;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.logging.Logger;

import java.util.concurrent.TimeUnit;

/**
 * REST endpoint and auto-trigger for demo span generation
 */
@Path("/api/demo")
public class DemoResource {

    private static final Logger LOG = Logger.getLogger(DemoResource.class);

    @Inject
    SpanGenerator spanGenerator;

    /**
     * Automatically generate demo spans every 30 seconds
     * Disabled during tests to prevent hanging
     */
    @Scheduled(every = "30s", delay = 5, delayUnit = TimeUnit.SECONDS, skipExecutionIf = Scheduled.Never.class)
    void autoGenerateSpans() {
        // Skip in test profile
        if (isTestProfile()) {
            return;
        }

        LOG.debug("Auto-generating demo span");
        try {
            spanGenerator.generateDemoSpans();
        } catch (Exception e) {
            LOG.error("Error auto-generating demo span", e);
        }
    }

    private boolean isTestProfile() {
        // Check multiple ways to detect test environment
        String profile = System.getProperty("quarkus.profile");
        if ("test".equals(profile)) {
            return true;
        }

        // Check for maven test execution
        String mavenTest = System.getProperty("surefire.real.class.path");
        if (mavenTest != null) {
            return true;
        }

        // Check for JUnit test execution
        try {
            Class.forName("org.junit.jupiter.api.Test");
            StackTraceElement[] stackTrace = Thread.currentThread().getStackTrace();
            for (StackTraceElement element : stackTrace) {
                if (element.getClassName().contains("junit") ||
                    element.getClassName().contains("surefire")) {
                    return true;
                }
            }
        } catch (ClassNotFoundException e) {
            // JUnit not in classpath, not in test
        }

        return false;
    }

    /**
     * Manual trigger endpoint
     */
    @GET
    @Path("/generate-spans")
    @Produces(MediaType.TEXT_PLAIN)
    public String generateSpans() {
        LOG.info("Manual demo span generation triggered");

        // Generate 5 demo spans (one of each type)
        try {
            for (int i = 0; i < 5; i++) {
                spanGenerator.generateDemoSpans();
                Thread.sleep(100); // Small delay between spans
            }
            return "Generated 5 demo trace scenarios";
        } catch (Exception e) {
            LOG.error("Error generating demo spans", e);
            return "Error: " + e.getMessage();
        }
    }
}
