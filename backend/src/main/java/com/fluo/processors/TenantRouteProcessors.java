package com.fluo.processors;

import com.fluo.model.Tenant;
import com.fluo.model.TenantContext;
import org.apache.camel.AggregationStrategy;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.util.Map;
import java.util.UUID;

/**
 * Processors for tenant route operations.
 * Contains all exchange processing logic extracted from TenantRoute.
 */
@ApplicationScoped
public class TenantRouteProcessors {

    @Named("initializeDefaultTenantProcessor")
    @ApplicationScoped
    public static class InitializeDefaultTenantProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            Tenant defaultTenant = new Tenant("default", "Default Tenant");
            defaultTenant.getConfiguration().put("tier", "standard");
            defaultTenant.getConfiguration().put("maxUsers", 100);
            exchange.getIn().setBody(defaultTenant);
        }
    }

    @Named("generateTenantIdProcessor")
    @ApplicationScoped
    public static class GenerateTenantIdProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            Map<String, Object> data = exchange.getIn().getBody(Map.class);
            if (!data.containsKey("id")) {
                data.put("id", UUID.randomUUID().toString());
            }
            exchange.getIn().setHeader("tenantId", data.get("id"));
        }
    }

    @Named("createTenantObjectProcessor")
    @ApplicationScoped
    public static class CreateTenantObjectProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            Map<String, Object> data = exchange.getIn().getHeader("originalBody", Map.class);
            if (data == null) {
                data = exchange.getIn().getBody(Map.class);
            }

            Tenant tenant = new Tenant();
            tenant.setId((String) data.get("id"));
            tenant.setName((String) data.getOrDefault("name", "Tenant-" + data.get("id")));

            if (data.containsKey("status")) {
                tenant.setStatus(Tenant.TenantStatus.valueOf((String) data.get("status")));
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> config = (Map<String, Object>) data.get("configuration");
            if (config != null) {
                tenant.getConfiguration().putAll(config);
            }

            exchange.getIn().setBody(tenant);
        }
    }

    @Named("createTenantContextProcessor")
    @ApplicationScoped
    public static class CreateTenantContextProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            Tenant tenant = exchange.getIn().getBody(Tenant.class);
            TenantContext context = new TenantContext(
                exchange.getIn().getHeader("tenantId", String.class),
                tenant
            );
            exchange.getIn().setBody(context);
        }
    }

    @Named("tenantUpdateEnricher")
    @ApplicationScoped
    public static class TenantUpdateEnricher implements AggregationStrategy {
        @Override
        public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
            Tenant existing = newExchange.getIn().getBody(Tenant.class);
            if (existing == null) {
                throw new IllegalArgumentException("Tenant not found");
            }

            Map<String, Object> updates = oldExchange.getIn().getBody(Map.class);

            // Apply updates
            if (updates.containsKey("name")) {
                existing.setName((String) updates.get("name"));
            }
            if (updates.containsKey("status")) {
                existing.setStatus(Tenant.TenantStatus.valueOf((String) updates.get("status")));
            }
            if (updates.containsKey("configuration")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> config = (Map<String, Object>) updates.get("configuration");
                existing.getConfiguration().putAll(config);
            }

            existing.setUpdatedAt(Long.toString(System.currentTimeMillis()));
            oldExchange.getIn().setBody(existing);
            return oldExchange;
        }
    }

    @Named("tenantBatchAggregator")
    @ApplicationScoped
    public static class TenantBatchAggregator implements AggregationStrategy {
        @Override
        public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
            if (oldExchange == null) {
                return newExchange;
            }
            // Aggregate results - could be enhanced to collect all created tenants
            return oldExchange;
        }
    }
}