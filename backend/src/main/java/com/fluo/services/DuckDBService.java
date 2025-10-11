package com.fluo.services;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DuckDB service for persistent state storage.
 *
 * TODO: Implement full DuckDB integration (PRD-002b: Hot Trace Storage)
 * This is a stub for PRD-007c rate limiting implementation.
 */
@ApplicationScoped
public class DuckDBService {

    /**
     * Execute SQL statement on shared metadata database.
     * Used for rate limiting tables and notification configs.
     */
    public void executeOnSharedDb(String sql, Object... params) {
        // TODO: Implement DuckDB execution
        throw new UnsupportedOperationException("DuckDB not yet implemented - see PRD-002b");
    }

    /**
     * Query shared metadata database and return results as list of maps.
     */
    public List<Map<String, Object>> queryOnSharedDb(String sql, Object... params) {
        // TODO: Implement DuckDB query
        throw new UnsupportedOperationException("DuckDB not yet implemented - see PRD-002b");
    }

    /**
     * Execute SQL statement on per-tenant database.
     */
    public int execute(UUID tenantId, String sql, Object... params) {
        // TODO: Implement per-tenant DuckDB execution
        throw new UnsupportedOperationException("DuckDB not yet implemented - see PRD-002b");
    }

    /**
     * Query per-tenant database and return results.
     */
    public List<Map<String, Object>> executeQuery(UUID tenantId, String sql, Object... params) {
        // TODO: Implement per-tenant DuckDB query
        throw new UnsupportedOperationException("DuckDB not yet implemented - see PRD-002b");
    }
}
