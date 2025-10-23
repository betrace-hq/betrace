package com.fluo.processors.security;

import com.fluo.dto.InjectionAttemptResponse;
import com.fluo.exceptions.InjectionAttemptException;
import com.fluo.services.MetricsService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.jboss.logging.Logger;

import java.util.UUID;

/**
 * Error processor for injection attempt exceptions.
 *
 * PRD-007 Unit D: Request Sanitization & Injection Prevention
 *
 * Responsibilities:
 * - Convert InjectionAttemptException to HTTP 400 response
 * - Record security metrics for injection attempts
 * - Log security events for audit trail
 *
 * Architecture:
 * - ADR-014 compliant (Named CDI bean for testability)
 */
@Named("injectionAttemptErrorProcessor")
@ApplicationScoped
public class InjectionAttemptErrorProcessor implements Processor {

    private static final Logger LOG = Logger.getLogger(InjectionAttemptErrorProcessor.class);

    @Inject
    MetricsService metricsService;

    @Override
    public void process(Exchange exchange) throws Exception {
        Throwable cause = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Throwable.class);

        if (cause instanceof InjectionAttemptException iae) {
            UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
            String userId = exchange.getIn().getHeader("userId", String.class);
            String injectionType = iae.getInjectionType();

            // Record security event metrics
            metricsService.recordInjectionAttempt(
                tenantId,
                userId,
                injectionType
            );

            // Log security event for audit trail
            LOG.warnf("Injection attempt blocked - tenant=%s, user=%s, type=%s, message=%s",
                tenantId, userId, injectionType, iae.getMessage());

            // Return HTTP 400 with security error message
            InjectionAttemptResponse response = InjectionAttemptResponse.of(injectionType);
            exchange.getIn().setBody(response);
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 400);
        }
    }
}
