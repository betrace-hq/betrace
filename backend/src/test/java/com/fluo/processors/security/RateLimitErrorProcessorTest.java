package com.fluo.processors.security;

import com.fluo.exceptions.RateLimitExceededException;
import com.fluo.models.RateLimitErrorResponse;
import org.apache.camel.Exchange;
import org.apache.camel.Message;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for RateLimitErrorProcessor (PRD-007 Unit C).
 * Tests HTTP 429 response generation.
 */
@DisplayName("RateLimitErrorProcessor Unit Tests")
class RateLimitErrorProcessorTest {

    private RateLimitErrorProcessor processor;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        processor = new RateLimitErrorProcessor();
        exchange = new DefaultExchange(new DefaultCamelContext());
    }

    @Test
    @DisplayName("Should generate HTTP 429 response with all required headers")
    void testRateLimitErrorResponse_CompleteResponse() throws Exception {
        RateLimitExceededException exception = new RateLimitExceededException(
            "Tenant rate limit exceeded. Retry after 60 seconds",
            60
        );
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);

        processor.process(exchange);

        Message message = exchange.getMessage();
        assertEquals(429, message.getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertEquals("application/json", message.getHeader(Exchange.CONTENT_TYPE));
        assertEquals("60", message.getHeader("Retry-After"));

        RateLimitErrorResponse response = (RateLimitErrorResponse) message.getBody();
        assertEquals("Rate limit exceeded", response.error());
        assertEquals(60, response.retryAfter());
    }
}
