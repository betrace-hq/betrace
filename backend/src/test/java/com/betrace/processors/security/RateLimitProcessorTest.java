package com.fluo.processors.security;

import com.fluo.exceptions.RateLimitExceededException;
import com.fluo.model.TenantContext;
import com.fluo.models.RateLimitResult;
import com.fluo.services.MetricsService;
import com.fluo.services.RateLimiter;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for RateLimitProcessor (PRD-007 Unit C).
 * Tests Camel processor integration for rate limiting enforcement.
 */
@DisplayName("RateLimitProcessor Unit Tests")
class RateLimitProcessorTest {

    @Mock
    private RateLimiter rateLimiter;

    @Mock
    private MetricsService metricsService;

    @Mock
    private TenantContext tenantContext;

    @InjectMocks
    private RateLimitProcessor processor;

    private Exchange exchange;
    private UUID testTenantId;
    private String testUserId;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        exchange = new DefaultExchange(new DefaultCamelContext());
        testTenantId = UUID.randomUUID();
        testUserId = "user-123";
    }

    @Test
    @DisplayName("Should allow authenticated request when both tenant and user limits available")
    void testAuthenticatedRequest_WithinLimits() throws Exception {
        when(tenantContext.isAuthenticated()).thenReturn(true);
        when(tenantContext.getTenantId()).thenReturn(testTenantId.toString());
        when(tenantContext.getUserId()).thenReturn(testUserId);
        when(rateLimiter.checkTenantLimit(testTenantId))
            .thenReturn(new RateLimitResult(true, 0));
        when(rateLimiter.checkUserLimit(testTenantId, testUserId))
            .thenReturn(new RateLimitResult(true, 0));

        processor.process(exchange);

        verify(rateLimiter).checkTenantLimit(testTenantId);
        verify(rateLimiter).checkUserLimit(testTenantId, testUserId);
        verify(metricsService).recordAllowedRequest(testTenantId, testUserId);
    }

    @Test
    @DisplayName("Should throw exception when tenant limit exceeded")
    void testAuthenticatedRequest_TenantLimitExceeded() {
        when(tenantContext.isAuthenticated()).thenReturn(true);
        when(tenantContext.getTenantId()).thenReturn(testTenantId.toString());
        when(rateLimiter.checkTenantLimit(testTenantId))
            .thenReturn(new RateLimitResult(false, 60));

        RateLimitExceededException exception = assertThrows(
            RateLimitExceededException.class,
            () -> processor.process(exchange)
        );

        assertTrue(exception.getMessage().contains("Tenant rate limit exceeded"));
        assertEquals(60, exception.getRetryAfterSeconds());
        verify(metricsService).recordRateLimitViolation(testTenantId, "tenant", 60L);
    }
}
