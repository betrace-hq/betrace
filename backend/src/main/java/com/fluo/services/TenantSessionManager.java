package com.fluo.services;

import com.fluo.rules.RuleContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;
import org.kie.api.KieServices;
import org.kie.api.builder.KieBuilder;
import org.kie.api.builder.KieFileSystem;
import org.kie.api.builder.Message;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.concurrent.atomic.AtomicInteger;
import org.kie.api.event.rule.AfterMatchFiredEvent;
import org.kie.api.event.rule.DefaultAgendaEventListener;

/**
 * Manages per-tenant Drools KieSessions for trace rule evaluation.
 *
 * <p>Each tenant gets:</p>
 * <ul>
 *   <li>One KieContainer (compiled rules)</li>
 *   <li>One active KieSession (runtime state)</li>
 *   <li>One sandboxed RuleContext (no service access)</li>
 * </ul>
 *
 * <p><b>Security Model:</b></p>
 * <ul>
 *   <li>Rules receive read-only RuleContext, not service references</li>
 *   <li>Rules record violations as facts, not via service calls</li>
 *   <li>Prevents malicious rules from bypassing tenant isolation</li>
 * </ul>
 *
 * Thread-safe for concurrent access and rule updates.
 */
@ApplicationScoped
public class TenantSessionManager {

    private static final Logger LOG = Logger.getLogger(TenantSessionManager.class);
    private static final KieServices kieServices = KieServices.Factory.get();

    @Inject
    MetricsService metricsService;

    // Per-tenant compiled rules
    private final Map<String, KieContainer> tenantContainers = new ConcurrentHashMap<>();

    // Per-tenant runtime sessions
    private final Map<String, KieSession> tenantSessions = new ConcurrentHashMap<>();

    // Per-tenant locks for rule updates
    private final Map<String, ReadWriteLock> tenantLocks = new ConcurrentHashMap<>();

    // Per-tenant active trace counts for metrics
    private final Map<String, AtomicInteger> tenantActiveTraces = new ConcurrentHashMap<>();

    // Per-tenant sandboxed rule contexts (read-only, no service access)
    private final Map<String, RuleContext> tenantContexts = new ConcurrentHashMap<>();

    /**
     * Get or create KieSession for a tenant
     */
    public KieSession getSession(String tenantId) {
        return tenantSessions.computeIfAbsent(tenantId, tid -> {
            LOG.infof("Creating new KieSession for tenant: %s", tid);
            KieContainer container = getContainer(tid);
            KieSession session = container.newKieSession();

            // Security: Provide sandboxed RuleContext instead of service references
            RuleContext context = RuleContext.forTenant(tid);
            tenantContexts.put(tid, context);
            session.setGlobal("ruleContext", context);

            // Register metrics gauges for this tenant
            tenantActiveTraces.putIfAbsent(tid, new AtomicInteger(0));
            metricsService.registerSessionMemoryGauge(tid, () -> getSessionMemory(session));
            metricsService.registerActiveTracesGauge(tid, () -> tenantActiveTraces.get(tid).get());

            // Add agenda event listener to track rule firings
            session.addEventListener(new DefaultAgendaEventListener() {
                @Override
                public void afterMatchFired(AfterMatchFiredEvent event) {
                    String ruleName = event.getMatch().getRule().getName();
                    String rulePackage = event.getMatch().getRule().getPackageName();
                    String ruleId = rulePackage + "." + ruleName;

                    LOG.debugf("Rule fired: %s for tenant: %s", ruleName, tid);
                    metricsService.recordRuleFired(tid, ruleId, ruleName);
                }
            });

            return session;
        });
    }

    /**
     * Get or create KieContainer for a tenant
     */
    private KieContainer getContainer(String tenantId) {
        return tenantContainers.computeIfAbsent(tenantId, tid -> {
            LOG.infof("Creating new KieContainer for tenant: %s", tid);
            // Start with empty container, rules will be added via updateRules()
            return buildContainer(tid, List.of());
        });
    }

    /**
     * Update rules for a tenant (hot-reload)
     *
     * @param tenantId Tenant ID
     * @param drlRules List of DRL rule strings
     * @return true if successful, false if compilation failed
     */
    public boolean updateRules(String tenantId, List<String> drlRules) {
        ReadWriteLock lock = tenantLocks.computeIfAbsent(tenantId, tid -> new ReentrantReadWriteLock());

        lock.writeLock().lock();
        try {
            LOG.infof("Updating %d rules for tenant: %s", drlRules.size(), tenantId);

            // Build new container
            KieContainer newContainer = buildContainer(tenantId, drlRules);
            if (newContainer == null) {
                LOG.errorf("Failed to compile rules for tenant: %s", tenantId);
                return false;
            }

            // Dispose old session
            KieSession oldSession = tenantSessions.remove(tenantId);
            if (oldSession != null) {
                oldSession.dispose();
            }

            // Dispose old container
            KieContainer oldContainer = tenantContainers.put(tenantId, newContainer);
            if (oldContainer != null) {
                oldContainer.dispose();
            }

            // Create new session with updated rules
            KieSession newSession = newContainer.newKieSession();

            // Security: Provide sandboxed RuleContext instead of service references
            RuleContext context = RuleContext.forTenant(tenantId);
            tenantContexts.put(tenantId, context);
            newSession.setGlobal("ruleContext", context);

            tenantSessions.put(tenantId, newSession);

            LOG.infof("Successfully updated rules for tenant: %s", tenantId);
            return true;

        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Build KieContainer from DRL rules
     */
    private KieContainer buildContainer(String tenantId, List<String> drlRules) {
        try {
            KieFileSystem kfs = kieServices.newKieFileSystem();

            // Add each rule as a separate file
            for (int i = 0; i < drlRules.size(); i++) {
                String drl = drlRules.get(i);
                kfs.write("src/main/resources/rules/" + tenantId + "/rule" + i + ".drl", drl);
            }

            KieBuilder kieBuilder = kieServices.newKieBuilder(kfs);
            kieBuilder.buildAll();

            if (kieBuilder.getResults().hasMessages(Message.Level.ERROR)) {
                LOG.errorf("Rule compilation errors for tenant %s: %s",
                        tenantId, kieBuilder.getResults().toString());
                return null;
            }

            return kieServices.newKieContainer(kieBuilder.getKieModule().getReleaseId());

        } catch (Exception e) {
            LOG.errorf(e, "Exception building KieContainer for tenant: %s", tenantId);
            return null;
        }
    }

    /**
     * Get the RuleContext for a tenant (for collecting violations after evaluation).
     *
     * @param tenantId Tenant ID
     * @return RuleContext with recorded violations
     */
    public RuleContext getRuleContext(String tenantId) {
        return tenantContexts.get(tenantId);
    }

    /**
     * Remove tenant session and free resources
     */
    public void removeTenant(String tenantId) {
        ReadWriteLock lock = tenantLocks.get(tenantId);
        if (lock != null) {
            lock.writeLock().lock();
        }

        try {
            LOG.infof("Removing tenant: %s", tenantId);

            KieSession session = tenantSessions.remove(tenantId);
            if (session != null) {
                session.dispose();
            }

            KieContainer container = tenantContainers.remove(tenantId);
            if (container != null) {
                container.dispose();
            }

            tenantLocks.remove(tenantId);
            tenantContexts.remove(tenantId);

        } finally {
            if (lock != null) {
                lock.writeLock().unlock();
            }
        }
    }

    /**
     * Get session with read lock (for span evaluation)
     */
    public KieSession getSessionForEvaluation(String tenantId) {
        ReadWriteLock lock = tenantLocks.computeIfAbsent(tenantId, tid -> new ReentrantReadWriteLock());
        lock.readLock().lock();

        try {
            return getSession(tenantId);
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Release read lock after evaluation
     */
    public void releaseSession(String tenantId) {
        ReadWriteLock lock = tenantLocks.get(tenantId);
        if (lock != null) {
            lock.readLock().unlock();
        }
    }

    /**
     * Get statistics for monitoring
     */
    public Map<String, Object> getStats() {
        return Map.of(
            "activeTenants", tenantSessions.size(),
            "totalContainers", tenantContainers.size()
        );
    }

    /**
     * Estimate memory usage of a KieSession
     */
    private long getSessionMemory(KieSession session) {
        // Get number of facts (spans) in session
        long factCount = session.getFactCount();

        // Rough estimate: 1KB per span (conservative)
        // This can be improved with actual JVM memory instrumentation
        return factCount * 1024;
    }

    /**
     * Increment active trace count for a tenant
     */
    public void incrementActiveTraces(String tenantId) {
        tenantActiveTraces.computeIfAbsent(tenantId, k -> new AtomicInteger(0)).incrementAndGet();
    }

    /**
     * Decrement active trace count for a tenant
     */
    public void decrementActiveTraces(String tenantId) {
        AtomicInteger counter = tenantActiveTraces.get(tenantId);
        if (counter != null) {
            counter.decrementAndGet();
        }
    }
}
