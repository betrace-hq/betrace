package com.betrace.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.component.caffeine.CaffeineConstants;

/**
 * Caching routes for high-performance data access.
 *
 * Implements caching for:
 * - Rules (frequently accessed, rarely changed)
 * - Rule validation results (OGNL compilation cache)
 * - Session data (authentication and authorization)
 *
 * Expected performance improvements:
 * - Rule retrieval: 70-90% response time reduction
 * - Rule validation: 80-95% response time reduction
 * - Session lookups: 60-80% response time reduction
 */
@ApplicationScoped
public class CacheRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Rule caching - frequently accessed, rarely changed
        from("direct:getRule")
            .setHeader(CaffeineConstants.ACTION, constant(CaffeineConstants.ACTION_GET))
            .setHeader(CaffeineConstants.KEY, simple("rule-${header.id}-${header.X-Tenant-ID}"))
            .to("caffeine-cache://rules?maximumSize={{fluo.cache.rules.max-size:1000}}&expireAfterWrite={{fluo.cache.rules.expire-after-write:1h}}&expireAfterAccess={{fluo.cache.rules.expire-after-access:30m}}")
            .choice()
                .when(body().isNull())
                    // Cache miss - fetch from data source
                    .log("Cache miss for rule ${header.id}")
                    .to("direct:fetchRuleFromDataSource")
                    .setHeader(CaffeineConstants.ACTION, constant(CaffeineConstants.ACTION_PUT))
                    .setHeader(CaffeineConstants.KEY, simple("rule-${header.id}-${header.X-Tenant-ID}"))
                    .to("caffeine-cache://rules")
                .otherwise()
                    // Cache hit
                    .log("Cache hit for rule ${header.id}");

        // Rule validation caching - OGNL compilation results
        from("direct:validateRule")
            .setHeader(CaffeineConstants.ACTION, constant(CaffeineConstants.ACTION_GET))
            .setHeader(CaffeineConstants.KEY, simple("validation-${header.ruleExpression.hashCode()}"))
            .to("caffeine-cache://rule-validation?maximumSize={{fluo.cache.rule-validation.max-size:500}}&expireAfterWrite={{fluo.cache.rule-validation.expire-after-write:6h}}&expireAfterAccess={{fluo.cache.rule-validation.expire-after-access:1h}}")
            .choice()
                .when(body().isNull())
                    // Cache miss - perform validation
                    .log("Cache miss for rule validation")
                    .to("direct:performRuleValidation")
                    .setHeader(CaffeineConstants.ACTION, constant(CaffeineConstants.ACTION_PUT))
                    .setHeader(CaffeineConstants.KEY, simple("validation-${header.ruleExpression.hashCode()}"))
                    .to("caffeine-cache://rule-validation")
                .otherwise()
                    // Cache hit
                    .log("Cache hit for rule validation");

        // Session caching - authentication and authorization data
        from("direct:getSession")
            .setHeader(CaffeineConstants.ACTION, constant(CaffeineConstants.ACTION_GET))
            .setHeader(CaffeineConstants.KEY, simple("session-${header.sessionId}"))
            .to("caffeine-cache://sessions?maximumSize={{fluo.cache.sessions.max-size:10000}}&expireAfterWrite={{fluo.cache.sessions.expire-after-write:24h}}&expireAfterAccess={{fluo.cache.sessions.expire-after-access:2h}}")
            .choice()
                .when(body().isNull())
                    // Cache miss - fetch session data
                    .log("Cache miss for session ${header.sessionId}")
                    .to("direct:fetchSessionFromDataSource")
                    .setHeader(CaffeineConstants.ACTION, constant(CaffeineConstants.ACTION_PUT))
                    .setHeader(CaffeineConstants.KEY, simple("session-${header.sessionId}"))
                    .to("caffeine-cache://sessions")
                .otherwise()
                    // Cache hit
                    .log("Cache hit for session ${header.sessionId}");

        // Cache invalidation routes
        from("direct:invalidateRuleCache")
            .setHeader(CaffeineConstants.ACTION, constant(CaffeineConstants.ACTION_INVALIDATE))
            .setHeader(CaffeineConstants.KEY, simple("rule-${header.id}-${header.X-Tenant-ID}"))
            .to("caffeine-cache://rules")
            .log("Invalidated cache for rule ${header.id}");

        from("direct:invalidateSessionCache")
            .setHeader(CaffeineConstants.ACTION, constant(CaffeineConstants.ACTION_INVALIDATE))
            .setHeader(CaffeineConstants.KEY, simple("session-${header.sessionId}"))
            .to("caffeine-cache://sessions")
            .log("Invalidated cache for session ${header.sessionId}");

        // Cache statistics and monitoring
        from("direct:cacheStats")
            .setBody(constant("{}"))
            .setHeader("Cache-Rules-Stats", simple("{{caffeine-cache:stats:rules}}"))
            .setHeader("Cache-Sessions-Stats", simple("{{caffeine-cache:stats:sessions}}"))
            .setHeader("Cache-Validation-Stats", simple("{{caffeine-cache:stats:rule-validation}}"))
            .log("Cache statistics requested");

        // Placeholder routes for actual data source operations
        // These would be implemented to connect to the actual data stores
        from("direct:fetchRuleFromDataSource")
            .log("Fetching rule ${header.id} from data source")
            .setBody(constant("{\"id\": \"${header.id}\", \"name\": \"Sample Rule\", \"expression\": \"span.duration > 1000\", \"status\": \"active\"}"));

        from("direct:performRuleValidation")
            .log("Performing rule validation for expression: ${header.ruleExpression}")
            .setBody(constant("{\"valid\": true, \"compiledExpression\": \"cached-compiled-form\"}"));

        from("direct:fetchSessionFromDataSource")
            .log("Fetching session ${header.sessionId} from data source")
            .setBody(constant("{\"sessionId\": \"${header.sessionId}\", \"userId\": \"user123\", \"roles\": [\"signal:read\", \"rule:read\"]}"));
    }
}