package com.fluo.routes;

import com.fluo.compliance.demo.ComplianceEvidenceGenerator;
import com.fluo.compliance.processors.ComplianceTrackingProcessor;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.dataformat.JsonLibrary;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * Apache Camel routes for compliance evidence generation and reporting
 */
@ApplicationScoped
public class ComplianceRoute extends RouteBuilder {

    @Inject
    ComplianceEvidenceGenerator evidenceGenerator;

    @Override
    public void configure() throws Exception {

        // REST endpoints for compliance operations
        rest("/api/compliance")
            .produces("application/json")

            // Generate compliance evidence
            .get("/evidence/generate")
                .to("direct:generateEvidence")

            // Get control mappings
            .get("/controls")
                .to("direct:getControlMappings")

            // Trigger audit report
            .post("/audit")
                .to("direct:generateAuditReport");

        // Generate compliance evidence with full tracking
        from("direct:generateEvidence")
            .routeId("generate-compliance-evidence")
            .log("Generating compliance evidence...")
            // Add compliance tracking for the evidence generation itself
            .process(ComplianceTrackingProcessor.builder()
                .withSOC2("CC2.3", "CC7.1")  // External Communication, System Monitoring
                .withHIPAA("164.312(b)")      // Audit Controls
                .withFedRAMP("moderate", "AU-6", "CA-2")  // Audit Review, Security Assessments
                .withISO27001("A.5.31", "A.5.36")  // Legal compliance, Compliance with policies
                .withMetadata("operation", "evidence_generation")
                .withMetadata("report_type", "comprehensive")
                .build())
            .bean(evidenceGenerator, "generateComplianceEvidence")
            .marshal().json(JsonLibrary.Jackson, true);

        // Get control mappings for documentation
        from("direct:getControlMappings")
            .routeId("get-control-mappings")
            .log("Fetching control mappings...")
            .transform().constant("""
                {
                  "frameworks": {
                    "SOC2": {
                      "name": "Service Organization Control 2",
                      "controls": {
                        "CC6.1": "Logical and Physical Access Controls",
                        "CC6.3": "Data Isolation and Segregation",
                        "CC6.7": "Data Transmission and Encryption",
                        "CC7.1": "System Operations Monitoring",
                        "CC8.1": "Change Management Process"
                      }
                    },
                    "HIPAA": {
                      "name": "Health Insurance Portability and Accountability Act",
                      "safeguards": {
                        "164.312(a)": "Access Control",
                        "164.312(b)": "Audit Controls",
                        "164.312(a)(2)(iv)": "Encryption and Decryption",
                        "164.312(e)(2)(ii)": "Transmission Security"
                      }
                    },
                    "FedRAMP": {
                      "name": "Federal Risk and Authorization Management Program",
                      "baseline": "Moderate",
                      "controls": {
                        "AC-2": "Account Management",
                        "AC-3": "Access Enforcement",
                        "AU-2": "Event Logging",
                        "SC-13": "Cryptographic Protection"
                      }
                    },
                    "ISO27001": {
                      "name": "ISO/IEC 27001:2022",
                      "controls": {
                        "A.5.15": "Access Control",
                        "A.8.24": "Use of Cryptography",
                        "A.8.32": "Change Management"
                      }
                    },
                    "PCI-DSS": {
                      "name": "Payment Card Industry Data Security Standard",
                      "version": "4.0",
                      "requirements": {
                        "3.4": "Render PAN unreadable",
                        "3.6": "Key Management Processes",
                        "10.1": "Audit Trail Implementation"
                      }
                    }
                  }
                }
                """)
            .setHeader("Content-Type", constant("application/json"));

        // Generate audit report
        from("direct:generateAuditReport")
            .routeId("generate-audit-report")
            .log("Generating audit report...")
            .process(exchange -> {
                // In a real implementation, this would query the audit log
                // and generate a comprehensive report
                exchange.getMessage().setBody("""
                    {
                      "report": "Comprehensive Audit Report",
                      "timestamp": "%s",
                      "events": "View compliance evidence at /api/compliance/evidence/generate"
                    }
                    """.formatted(java.time.Instant.now()));
            })
            .marshal().json(JsonLibrary.Jackson, true);
    }
}