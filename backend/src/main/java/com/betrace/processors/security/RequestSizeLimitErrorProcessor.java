package com.betrace.processors.security;

import com.betrace.dto.RequestSizeLimitResponse;
import com.betrace.exceptions.RequestEntityTooLargeException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.jboss.logging.Logger;

/**
 * Error processor for request size limit exceptions.
 *
 * PRD-007 Unit D: Request Sanitization & Injection Prevention
 *
 * Responsibilities:
 * - Convert RequestEntityTooLargeException to HTTP 413 response
 * - Log oversized request attempts
 *
 * Architecture:
 * - ADR-014 compliant (Named CDI bean for testability)
 */
@Named("requestSizeLimitErrorProcessor")
@ApplicationScoped
public class RequestSizeLimitErrorProcessor implements Processor {

    private static final Logger LOG = Logger.getLogger(RequestSizeLimitErrorProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        Throwable cause = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Throwable.class);

        if (cause instanceof RequestEntityTooLargeException rte) {
            LOG.warnf("Oversized request blocked - size=%d, max=%d",
                rte.getRequestSize(), rte.getMaxSize());

            RequestSizeLimitResponse response = RequestSizeLimitResponse.of(rte.getMaxSize());
            exchange.getIn().setBody(response);
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 413);
        }
    }
}
