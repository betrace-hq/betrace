# PRD-001h: Auth Compliance Span Processor

**Priority:** P0
**Complexity:** Medium
**Unit:** `GenerateAuthComplianceSpanProcessor.java`
**Dependencies:** PRD-001d (tenant extraction), PRD-003 (compliance signing)

## Problem

BeTrace must generate cryptographically signed compliance evidence for every authentication and authorization event to prove SOC2 CC6.1 controls are functioning. Auditors require tamper-proof spans showing access control decisions with full context.

## Architecture Integration

**ADR Compliance:**
- **ADR-013:** Implement as Camel processor in authentication interceptor chain (runs after auth decision)
- **ADR-014:** Named processor with 90% test coverage requirement
- **ADR-015:** Compliance spans stored in append-only log (OpenTelemetry backend)

**SOC2 CC6.1: Logical and Physical Access Controls**
- Control ID: CC6.1
- Framework: SOC2 Trust Services Criteria
- Category: Logical Access - Authorization
- Risk Level: High
- Requirements: Implement RBAC, enforce least privilege, maintain audit trail

**Compliance Span Schema:**
```
Span {
  name: "auth.{event_type}"        // e.g., auth.access.granted
  kind: INTERNAL
  attributes: {
    // Compliance metadata
    "compliance.framework": "SOC2",
    "compliance.control": "CC6.1",
    "compliance.control.name": "Logical Access - Authorization",
    "compliance.evidence.id": "EVD-{timestamp}-{uuid}",

    // Auth context
    "auth.userId": UUID,
    "auth.userEmail": string,
    "auth.tenantId": UUID,
    "auth.route": string,           // Camel route ID
    "auth.method": string,          // HTTP method
    "auth.authorized": boolean,     // Access granted or denied
    "auth.timestamp": ISO8601,

    // Security context (if denial)
    "auth.denial.reason": string,   // e.g., "insufficient_permissions"
    "auth.user.roles": string[],    // Roles user has
    "auth.required.roles": string[], // Roles required for route

    // Audit trail linkage
    "auth.event.id": UUID,          // Links to TigerBeetle event (PRD-001g)
    "auth.session.id": string       // Session identifier from JWT
  },
  events: [
    {
      name: "access_decision",
      attributes: {
        "decision": "granted|denied",
        "policy": "rbac",
        "evaluated_at": timestamp
      }
    }
  ],
  status: OK | ERROR,
  signature: Ed25519                // Cryptographic signature (PRD-003)
}
```

**Span Types:**
- `auth.login.success` - Successful WorkOS OAuth login
- `auth.login.failed` - Failed login attempt (invalid credentials)
- `auth.access.granted` - Route access granted (RBAC passed)
- `auth.access.denied` - Route access denied (RBAC failed)
- `auth.logout` - User logout event

## Implementation

```java
package com.betrace.processors.auth;

import com.betrace.compliance.annotations.SOC2Controls;
import com.betrace.compliance.telemetry.ComplianceSpanProcessor;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.common.Attributes;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Generates SOC2 CC6.1 compliance spans for all authentication
 * and authorization events.
 *
 * Every access control decision (success or failure) produces
 * a signed compliance span for audit trail.
 */
@Named("generateAuthComplianceSpanProcessor")
@ApplicationScoped
public class GenerateAuthComplianceSpanProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(GenerateAuthComplianceSpanProcessor.class);

    @Inject
    ComplianceSpanProcessor complianceSpanProcessor;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Extract auth context from exchange
        UUID userId = exchange.getIn().getHeader("userId", UUID.class);
        String userEmail = exchange.getIn().getHeader("userEmail", String.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        Boolean authorized = exchange.getIn().getHeader("authorized", Boolean.class);
        String routeId = exchange.getFromRouteId();
        String method = exchange.getIn().getHeader(Exchange.HTTP_METHOD, String.class);
        List<String> userRoles = exchange.getProperty("authenticatedUserRoles", List.class);
        UUID authEventId = exchange.getIn().getHeader("authEventId", UUID.class);
        String sessionId = exchange.getIn().getHeader("sessionId", String.class);

        // Determine span name based on auth outcome and route
        String spanName = determineSpanName(routeId, authorized);

        try {
            // Start compliance span with SOC2 CC6.1 control
            ComplianceSpanProcessor.ComplianceSpan complianceSpan =
                complianceSpanProcessor.startComplianceSpan(
                    spanName,
                    SOC2Controls.CC6_1.class
                );

            Span span = complianceSpan.getSpan();

            // Add SOC2 CC6.1 specific attributes
            span.setAttribute("compliance.framework", "SOC2");
            span.setAttribute("compliance.control", "CC6.1");
            span.setAttribute("compliance.control.name", "Logical Access - Authorization");
            span.setAttribute("compliance.evidence.id", generateEvidenceId());

            // Add auth context attributes
            if (userId != null) {
                span.setAttribute("auth.userId", userId.toString());
            }
            if (userEmail != null) {
                span.setAttribute("auth.userEmail", userEmail);
            }
            if (tenantId != null) {
                span.setAttribute("auth.tenantId", tenantId.toString());
            }
            span.setAttribute("auth.route", routeId);
            span.setAttribute("auth.method", method != null ? method : "UNKNOWN");
            span.setAttribute("auth.authorized", authorized != null ? authorized : false);
            span.setAttribute("auth.timestamp", Instant.now().toString());

            // Link to TigerBeetle audit event
            if (authEventId != null) {
                span.setAttribute("auth.event.id", authEventId.toString());
            }
            if (sessionId != null) {
                span.setAttribute("auth.session.id", sessionId);
            }

            // Add role information
            if (userRoles != null && !userRoles.isEmpty()) {
                span.setAttribute("auth.user.roles", String.join(",", userRoles));
            }

            // If access denied, add denial context
            if (authorized != null && !authorized) {
                addDenialContext(span, exchange);
            }

            // Add span event for access decision
            span.addEvent("access_decision",
                Attributes.builder()
                    .put("decision", authorized != null && authorized ? "granted" : "denied")
                    .put("policy", "rbac")
                    .put("evaluated_at", Instant.now().toString())
                    .build()
            );

            // Set span status
            if (authorized != null && authorized) {
                span.setStatus(StatusCode.OK, "Access granted");
            } else {
                span.setStatus(StatusCode.ERROR, "Access denied");
            }

            // Close span (triggers signing via PRD-003)
            complianceSpan.close();

            log.debug("Generated compliance span {} for user {} on route {} (authorized: {})",
                spanName, userId, routeId, authorized);

        } catch (Exception e) {
            // Compliance span generation failure should NOT block the request
            // Log error and continue (auth decision and audit event already recorded)
            log.error("Failed to generate compliance span for route {}: {}",
                routeId, e.getMessage(), e);
        }
    }

    /**
     * Determine span name based on route and auth outcome.
     */
    private String determineSpanName(String routeId, Boolean authorized) {
        // Special handling for auth routes
        if (routeId != null) {
            if (routeId.equals("workosLogin") || routeId.equals("workosCallback")) {
                return authorized != null && authorized
                    ? "auth.login.success"
                    : "auth.login.failed";
            }
            if (routeId.equals("workosLogout")) {
                return "auth.logout";
            }
        }

        // Standard route access spans
        return authorized != null && authorized
            ? "auth.access.granted"
            : "auth.access.denied";
    }

    /**
     * Add denial-specific context to span.
     */
    private void addDenialContext(Span span, Exchange exchange) {
        String denialReason = exchange.getIn().getHeader("authDenialReason", String.class);
        if (denialReason == null) {
            denialReason = "insufficient_permissions";
        }
        span.setAttribute("auth.denial.reason", denialReason);

        // Add required roles for route (if available from RBAC check)
        String requiredRoles = exchange.getIn().getHeader("requiredRoles", String.class);
        if (requiredRoles != null) {
            span.setAttribute("auth.required.roles", requiredRoles);
        }

        // Add security event
        span.addEvent("access_denied",
            Attributes.builder()
                .put("security.event", "unauthorized_access_attempt")
                .put("security.severity", "medium")
                .put("reason", denialReason)
                .build()
        );
    }

    /**
     * Generate unique evidence ID for this span.
     */
    private String generateEvidenceId() {
        return "EVD-" + System.currentTimeMillis() + "-" +
            UUID.randomUUID().toString().substring(0, 8);
    }
}
```

## Testing Requirements (QA - 90% Coverage)

**Unit Tests:**
- `testComplianceSpanGeneratedForSuccess()` - Span created with auth.access.granted when authorized=true
- `testComplianceSpanGeneratedForDenial()` - Span created with auth.access.denied when authorized=false
- `testSpanAttributesComplete()` - All required attributes present (userId, tenantId, route, authorized, timestamp)
- `testSpanLinksToTigerBeetleEvent()` - auth.event.id matches authEventId from RecordAuthEventProcessor
- `testAllAuthEventTypes()` - Verify login.success, login.failed, access.granted, access.denied, logout spans
- `testDenialContextIncluded()` - Denial spans include reason, required roles, security event
- `testSpanStatusCodeCorrect()` - OK for granted, ERROR for denied
- `testSpanEventRecorded()` - access_decision event with policy=rbac
- `testComplianceFrameworkAttributes()` - compliance.framework=SOC2, compliance.control=CC6.1
- `testEvidenceIdGenerated()` - compliance.evidence.id present and unique
- `testAnonymousUserHandling()` - Span generated even when userId is null
- `testSpanSigningTriggered()` - Span.close() invokes PRD-003 signing (integration test)
- `testGenerationFailureDoesNotBlockRequest()` - Exception logged, exchange continues

## Security Considerations (Security Expert)

**Threat Model:**
- **Evidence Forgery:** Cryptographic signatures (Ed25519) prevent span tampering - auditors can verify authenticity
- **Missing Failure Spans:** Processor runs on both success and failure paths - captures all access attempts
- **Span Tampering:** OpenTelemetry spans stored in append-only backend (Tempo) - immutable after write
- **Incomplete Context:** All critical attributes (userId, tenantId, route, timestamp) are required - validation in tests
- **Signature Key Compromise:** Key rotation mechanism needed (PRD-003 dependency)

## Success Criteria

- [ ] Compliance span emitted for every auth event (success AND failure)
- [ ] Span includes all SOC2 CC6.1 required attributes
- [ ] Span cryptographically signed via PRD-003 integration
- [ ] Denial spans include failure reason and required roles
- [ ] Span links to TigerBeetle audit event (authEventId)
- [ ] 90% unit test coverage
- [ ] Integration test validates signed span in OpenTelemetry backend

## Files to Create

- `backend/src/main/java/com/betrace/processors/auth/GenerateAuthComplianceSpanProcessor.java`
- `backend/src/test/java/com/betrace/processors/auth/GenerateAuthComplianceSpanProcessorTest.java`

## Dependencies

**Requires:**
- PRD-001d: ExtractTenantAndRolesProcessor (provides tenantId/userId/roles)
- PRD-001g: RecordAuthEventProcessor (provides authEventId for linkage)
- PRD-003: Compliance span signing (cryptographic signatures)
