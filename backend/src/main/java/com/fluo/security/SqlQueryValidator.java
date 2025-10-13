package com.fluo.security;

import jakarta.enterprise.context.ApplicationScoped;
import net.sf.jsqlparser.JSQLParserException;
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.select.Select;
import net.sf.jsqlparser.util.TablesNamesFinder;

import java.util.List;
import java.util.Set;

/**
 * PRD-027: SQL Query Validator for SQL Injection Prevention
 *
 * Validates user-provided SQL queries to prevent SQL injection attacks.
 *
 * Security Controls:
 * 1. Only SELECT statements allowed (no INSERT/UPDATE/DELETE/DROP)
 * 2. Reject multiple statements (semicolon attacks)
 * 3. Reject SQL comments (-- or /* */) to prevent bypass attempts
 * 4. Allowlist tables only (prevent access to users, credentials, etc.)
 * 5. Reject UNION attacks (prevent data exfiltration)
 *
 * Usage:
 * ```java
 * @Inject
 * SqlQueryValidator validator;
 *
 * public QueryResult executeQuery(String sql) {
 *     validator.validateQuery(sql);  // Throws SecurityException if invalid
 *     return executeValidatedQuery(sql);
 * }
 * ```
 *
 * Compliance:
 * - OWASP A03:2021 - Injection Prevention
 * - SOC2 CC6.1 - Logical Access Controls
 */
@ApplicationScoped
public class SqlQueryValidator {

    /**
     * Allowed tables for query execution.
     * Only 'signals' table is accessible to users.
     * All other tables (users, credentials, etc.) are blocked.
     */
    private static final Set<String> ALLOWED_TABLES = Set.of("signals");

    /**
     * Validate a SQL query for security risks.
     *
     * @param sql User-provided SQL query
     * @throws SecurityException if query contains security violations
     */
    public void validateQuery(String sql) throws SecurityException {
        if (sql == null || sql.trim().isEmpty()) {
            throw new SecurityException("SQL query cannot be empty");
        }

        try {
            // Parse SQL to AST (Abstract Syntax Tree)
            Statement stmt = CCJSqlParserUtil.parse(sql);

            // 1. Only allow SELECT statements
            if (!(stmt instanceof Select)) {
                throw new SecurityException("Only SELECT queries are allowed");
            }

            // 2. Reject multiple statements (semicolon attacks)
            // Example attack: "SELECT * FROM signals; DROP TABLE users; --"
            String trimmed = sql.trim();
            if (sql.contains(";") && !trimmed.endsWith(";")) {
                throw new SecurityException("Multiple statements not allowed");
            }

            // Also check for multiple semicolons (even if at end)
            long semicolonCount = sql.chars().filter(ch -> ch == ';').count();
            if (semicolonCount > 1) {
                throw new SecurityException("Multiple statements not allowed");
            }

            // 3. Reject SQL comments (-- or /* */)
            // Comments can be used to bypass WHERE clauses
            // Example: "SELECT * FROM signals -- WHERE tenant_id = ?"
            if (sql.contains("--") || sql.contains("/*") || sql.contains("*/")) {
                throw new SecurityException("SQL comments not allowed");
            }

            // 4. Allowlist tables only (prevent joins to users, etc.)
            TablesNamesFinder tablesNamesFinder = new TablesNamesFinder();
            List<String> tableList = tablesNamesFinder.getTableList(stmt);

            for (String table : tableList) {
                if (!ALLOWED_TABLES.contains(table.toLowerCase())) {
                    throw new SecurityException(
                        "Access denied to table: " + table + ". Only 'signals' table is allowed."
                    );
                }
            }

            // 5. Reject UNION attacks
            // UNION can be used to exfiltrate data from other tables
            // Example: "SELECT * FROM signals UNION SELECT * FROM users"
            String upperSql = sql.toUpperCase();
            if (upperSql.contains("UNION")) {
                throw new SecurityException("UNION queries not allowed");
            }

            // 6. Reject INTO OUTFILE attacks (MySQL file write)
            if (upperSql.contains("INTO OUTFILE") || upperSql.contains("INTO DUMPFILE")) {
                throw new SecurityException("File operations not allowed");
            }

            // 7. Reject LOAD DATA attacks (MySQL file read)
            if (upperSql.contains("LOAD DATA")) {
                throw new SecurityException("File operations not allowed");
            }

            // 8. Reject xp_cmdshell attacks (SQL Server command execution)
            if (upperSql.contains("XP_CMDSHELL") || upperSql.contains("XP_")) {
                throw new SecurityException("System commands not allowed");
            }

        } catch (JSQLParserException e) {
            // Invalid SQL syntax - reject it
            throw new SecurityException("Invalid SQL syntax: " + e.getMessage(), e);
        }
    }

    /**
     * Get list of allowed tables.
     * Useful for error messages and documentation.
     */
    public Set<String> getAllowedTables() {
        return Set.copyOf(ALLOWED_TABLES);
    }
}
