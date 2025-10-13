package com.fluo.repository;

import com.fluo.model.Signal;
import com.fluo.services.TigerBeetleService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.List;
import java.util.UUID;

/**
 * Repository for Signal persistence (PRD-002a).
 *
 * <p>Provides a clean domain-layer interface for signal operations,
 * delegating to TigerBeetleService for actual persistence.</p>
 *
 * <p><b>Immutability:</b> Signals are WORM (Write Once Read Many) -
 * no update or delete operations are provided.</p>
 *
 * @see TigerBeetleService
 * @see Signal
 */
@ApplicationScoped
public class SignalRepository {

    @Inject
    TigerBeetleService tigerBeetle;

    /**
     * Create a new signal (immutable WORM).
     *
     * @param signal Signal to persist
     * @return Generated signal UUID
     */
    public UUID create(Signal signal) {
        return tigerBeetle.createSignal(
            UUID.fromString(signal.tenantId()),
            UUID.fromString(signal.ruleId()),
            signal.traceId(),
            signal.spanId(),
            signal.severity(),
            signal.status()
        );
    }

    /**
     * Find signals by tenant (limited query).
     *
     * @param tenantId Tenant UUID
     * @param limit Maximum number of signals to return
     * @return List of signals for this tenant
     */
    public List<Signal> findByTenant(UUID tenantId, int limit) {
        return tigerBeetle.getSignalsByTenant(tenantId, limit);
    }

    /**
     * Find recent signals by tenant (last 100).
     *
     * @param tenantId Tenant UUID
     * @return List of recent signals
     */
    public List<Signal> findRecentByTenant(UUID tenantId) {
        return findByTenant(tenantId, 100);
    }
}
