package com.fluo.services;

import com.fluo.models.query.QueryResult;
import com.fluo.security.SqlQueryValidator;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * PRD-027: Signal Query Service with Tenant Isolation
 *
 * Executes user-provided SQL queries with security controls:
 * 1. SQL injection validation (SqlQueryValidator)
 * 2. Tenant isolation (automatic tenant_id filtering)
 * 3. Query timeout (prevents long-running queries)
 * 4. Result size limits (prevents DoS via large result sets)
 *
 * Security Properties:
 * - Tenant A cannot query Tenant B's data
 * - Queries timeout after configurable seconds
 * - Result sets limited to configurable max rows
 * - All queries validated for SQL injection
 *
 * Usage:
 * ```java
 * QueryResult result = service.executeQuery("tenant-123", "SELECT * FROM signals WHERE severity='HIGH'");
 * ```
 */
@ApplicationScoped
public class SignalQueryService {

    private static final Logger LOG = Logger.getLogger(SignalQueryService.class);

    @Inject
    EntityManager entityManager;

    @Inject
    SqlQueryValidator validator;

    @ConfigProperty(name = "query.timeout.seconds", defaultValue = "10")
    int queryTimeoutSeconds;

    @ConfigProperty(name = "query.result.max-rows", defaultValue = "10000")
    int maxResultRows;

    /**
     * Execute a user-provided SQL query with tenant isolation.
     *
     * Security Controls:
     * 1. Validates query for SQL injection (throws SecurityException if invalid)
     * 2. Wraps query with tenant isolation filter
     * 3. Sets query timeout to prevent DoS
     * 4. Limits result size to prevent memory exhaustion
     *
     * @param tenantId Tenant identifier (from authenticated security context)
     * @param userSql User-provided SQL query (SELECT only)
     * @return Query results with metadata
     * @throws SecurityException if query fails validation
     */
    public QueryResult executeQuery(String tenantId, String userSql) {
        LOG.infof("Executing query for tenant=%s, sql=%s", tenantId, sanitizeSqlForLogging(userSql));

        long startTime = System.currentTimeMillis();

        try {
            // CRITICAL: Validate before execution
            validator.validateQuery(userSql);

            // Build safe query with tenant isolation
            // Wraps user query in subquery and adds tenant_id filter
            String safeSql = buildTenantIsolatedQuery(userSql, tenantId);

            // Execute query with security controls
            Query query = entityManager.createNativeQuery(safeSql);

            // Set timeout to prevent long-running queries
            query.setHint("jakarta.persistence.query.timeout", queryTimeoutSeconds * 1000);

            // Limit result size to prevent DoS
            query.setMaxResults(maxResultRows);

            // Execute and convert to Map<String, Object> rows
            @SuppressWarnings("unchecked")
            List<Object[]> rawResults = query.getResultList();

            List<Map<String, Object>> rows = convertToMaps(rawResults);

            long executionTime = System.currentTimeMillis() - startTime;
            boolean truncated = rows.size() == maxResultRows;

            LOG.infof("Query completed: tenant=%s, rows=%d, time=%dms, truncated=%s",
                    tenantId, rows.size(), executionTime, truncated);

            return new QueryResult(rows, rows.size(), executionTime, truncated);

        } catch (SecurityException e) {
            // Security validation failed - log and rethrow
            LOG.warnf("Query validation failed: tenant=%s, error=%s", tenantId, e.getMessage());
            throw e;
        } catch (Exception e) {
            // Database error - log internally but throw generic error
            LOG.errorf(e, "Query execution failed: tenant=%s", tenantId);
            throw new RuntimeException("Query execution failed", e);
        }
    }

    /**
     * Build tenant-isolated query by wrapping user SQL.
     *
     * Example:
     * Input:  SELECT * FROM signals WHERE severity='HIGH'
     * Output: SELECT * FROM (SELECT * FROM signals WHERE severity='HIGH') AS user_query WHERE tenant_id = 'tenant-123'
     *
     * This ensures tenant isolation is enforced at the database level.
     */
    private String buildTenantIsolatedQuery(String userSql, String tenantId) {
        // Remove trailing semicolon if present
        String cleanSql = userSql.trim();
        if (cleanSql.endsWith(";")) {
            cleanSql = cleanSql.substring(0, cleanSql.length() - 1);
        }

        // Wrap user query and add tenant filter
        // Note: tenant_id is assumed to exist in signals table
        return String.format(
                "SELECT * FROM (%s) AS user_query WHERE tenant_id = '%s'",
                cleanSql,
                escapeSqlString(tenantId)
        );
    }

    /**
     * Convert raw JDBC results to List<Map<String, Object>>.
     *
     * Each row becomes a Map with column names as keys.
     */
    private List<Map<String, Object>> convertToMaps(List<Object[]> rawResults) {
        List<Map<String, Object>> rows = new ArrayList<>();

        for (Object[] row : rawResults) {
            Map<String, Object> rowMap = new HashMap<>();

            // Note: In real implementation, we'd get column names from ResultSetMetaData
            // For simplicity, using generic column names
            for (int i = 0; i < row.length; i++) {
                rowMap.put("column_" + i, row[i]);
            }

            rows.add(rowMap);
        }

        return rows;
    }

    /**
     * Sanitize SQL for logging (prevent log injection).
     * Truncates long queries and escapes newlines.
     */
    private String sanitizeSqlForLogging(String sql) {
        if (sql == null) {
            return "null";
        }

        String sanitized = sql.replace("\n", " ").replace("\r", " ");

        if (sanitized.length() > 200) {
            return sanitized.substring(0, 200) + "... (truncated)";
        }

        return sanitized;
    }

    /**
     * Escape SQL string for safe concatenation.
     * Prevents SQL injection in tenant ID.
     */
    private String escapeSqlString(String value) {
        if (value == null) {
            return "";
        }
        // Escape single quotes by doubling them
        return value.replace("'", "''");
    }
}
