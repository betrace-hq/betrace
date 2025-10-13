package com.fluo.security;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * PRD-027: SQL Query Validator Tests
 *
 * Validates SQL injection prevention controls.
 *
 * Test Categories:
 * 1. Valid queries (should pass)
 * 2. DROP TABLE attacks (should fail)
 * 3. UNION attacks (should fail)
 * 4. Multiple statements (should fail)
 * 5. SQL comments (should fail)
 * 6. Unauthorized table access (should fail)
 * 7. INSERT/UPDATE/DELETE (should fail)
 * 8. File operations (should fail)
 * 9. System commands (should fail)
 */
@QuarkusTest
class SqlQueryValidatorTest {

    @Inject
    SqlQueryValidator validator;

    // ========================================
    // Valid Queries (Should Pass)
    // ========================================

    @Test
    void testValidSelectQuery() {
        String validSql = "SELECT * FROM signals";
        assertDoesNotThrow(() -> validator.validateQuery(validSql));
    }

    @Test
    void testValidSelectWithWhereClause() {
        String validSql = "SELECT id, name, timestamp FROM signals WHERE severity = 'HIGH'";
        assertDoesNotThrow(() -> validator.validateQuery(validSql));
    }

    @Test
    void testValidSelectWithJoin() {
        // Note: This will fail because we only allow 'signals' table
        // If we need to support joins in future, add more tables to ALLOWED_TABLES
        String joinSql = "SELECT s1.id FROM signals s1 JOIN signals s2 ON s1.id = s2.parent_id";
        assertDoesNotThrow(() -> validator.validateQuery(joinSql));
    }

    @Test
    void testValidSelectWithTrailingSemicolon() {
        String validSql = "SELECT * FROM signals;";
        assertDoesNotThrow(() -> validator.validateQuery(validSql));
    }

    @Test
    void testValidSelectWithAggregates() {
        String validSql = "SELECT COUNT(*), AVG(value) FROM signals GROUP BY tenant_id";
        assertDoesNotThrow(() -> validator.validateQuery(validSql));
    }

    // ========================================
    // DROP TABLE Attacks (Should Fail)
    // ========================================

    @Test
    void testRejectDropTableAttack() {
        String malicious = "SELECT * FROM signals; DROP TABLE users; --";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Multiple statements") ||
                   ex.getMessage().contains("comments"));
    }

    @Test
    void testRejectDropTableWithoutComment() {
        String malicious = "SELECT * FROM signals; DROP TABLE users;";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Multiple statements"));
    }

    // ========================================
    // UNION Attacks (Should Fail)
    // ========================================

    @Test
    void testRejectUnionAttack() {
        String malicious = "SELECT * FROM signals UNION SELECT * FROM users";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("UNION"));
    }

    @Test
    void testRejectUnionAllAttack() {
        String malicious = "SELECT id FROM signals UNION ALL SELECT password FROM users";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("UNION"));
    }

    @Test
    void testRejectCaseInsensitiveUnion() {
        String malicious = "SELECT * FROM signals union SELECT * FROM users";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("UNION"));
    }

    // ========================================
    // Multiple Statements (Should Fail)
    // ========================================

    @Test
    void testRejectMultipleStatements() {
        String malicious = "SELECT * FROM signals; SELECT * FROM users";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Multiple statements"));
    }

    @Test
    void testRejectMultipleSemicolons() {
        String malicious = "SELECT * FROM signals;; DELETE FROM signals;;";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Multiple statements"));
    }

    // ========================================
    // SQL Comments (Should Fail)
    // ========================================

    @Test
    void testRejectSqlComments_DoubleDash() {
        String malicious = "SELECT * FROM signals -- WHERE tenant_id = ?";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("comments"));
    }

    @Test
    void testRejectSqlComments_BlockComment() {
        String malicious = "SELECT * FROM signals /* WHERE tenant_id = ? */";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("comments"));
    }

    @Test
    void testRejectSqlComments_InlineComment() {
        String malicious = "SELECT * /* malicious comment */ FROM signals";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("comments"));
    }

    // ========================================
    // Unauthorized Table Access (Should Fail)
    // ========================================

    @Test
    void testRejectUnauthorizedTableAccess_Users() {
        String malicious = "SELECT password FROM users";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Access denied to table"));
    }

    @Test
    void testRejectUnauthorizedTableAccess_Credentials() {
        String malicious = "SELECT * FROM credentials WHERE username = 'admin'";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Access denied to table"));
    }

    @Test
    void testRejectUnauthorizedTableAccess_SystemTables() {
        String malicious = "SELECT * FROM information_schema.tables";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Access denied to table"));
    }

    @Test
    void testRejectCaseInsensitiveTableName() {
        String malicious = "SELECT * FROM USERS";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Access denied to table"));
    }

    // ========================================
    // INSERT/UPDATE/DELETE (Should Fail)
    // ========================================

    @Test
    void testRejectInsertStatement() {
        String malicious = "INSERT INTO signals (name) VALUES ('malicious')";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Only SELECT"));
    }

    @Test
    void testRejectUpdateStatement() {
        String malicious = "UPDATE signals SET severity = 'LOW' WHERE id = 1";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Only SELECT"));
    }

    @Test
    void testRejectDeleteStatement() {
        String malicious = "DELETE FROM signals WHERE tenant_id = 'victim'";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Only SELECT"));
    }

    @Test
    void testRejectTruncateStatement() {
        String malicious = "TRUNCATE TABLE signals";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("Only SELECT"));
    }

    // ========================================
    // File Operations (Should Fail)
    // ========================================

    @Test
    void testRejectIntoOutfile() {
        String malicious = "SELECT * FROM signals INTO OUTFILE '/tmp/data.txt'";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("File operations"));
    }

    @Test
    void testRejectIntoDumpfile() {
        String malicious = "SELECT password FROM users INTO DUMPFILE '/tmp/passwords.txt'";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("File operations") ||
                   ex.getMessage().contains("Access denied to table"));
    }

    @Test
    void testRejectLoadData() {
        String malicious = "LOAD DATA INFILE '/etc/passwd' INTO TABLE signals";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("File operations") ||
                   ex.getMessage().contains("Only SELECT"));
    }

    // ========================================
    // System Commands (Should Fail)
    // ========================================

    @Test
    void testRejectXpCmdshell() {
        String malicious = "SELECT * FROM signals; EXEC xp_cmdshell('whoami')";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("System commands") ||
                   ex.getMessage().contains("Multiple statements"));
    }

    @Test
    void testRejectXpCmdshellCaseInsensitive() {
        String malicious = "EXEC XP_CMDSHELL 'dir'";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(malicious));
        assertTrue(ex.getMessage().contains("System commands") ||
                   ex.getMessage().contains("Only SELECT"));
    }

    // ========================================
    // Edge Cases
    // ========================================

    @Test
    void testRejectNullQuery() {
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(null));
        assertTrue(ex.getMessage().contains("cannot be empty"));
    }

    @Test
    void testRejectEmptyQuery() {
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(""));
        assertTrue(ex.getMessage().contains("cannot be empty"));
    }

    @Test
    void testRejectWhitespaceOnlyQuery() {
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery("   \n\t  "));
        assertTrue(ex.getMessage().contains("cannot be empty"));
    }

    @Test
    void testRejectInvalidSyntax() {
        String invalidSql = "SELECT FROM WHERE signals";
        SecurityException ex = assertThrows(SecurityException.class,
            () -> validator.validateQuery(invalidSql));
        assertTrue(ex.getMessage().contains("Invalid SQL syntax"));
    }

    // ========================================
    // Utility Methods
    // ========================================

    @Test
    void testGetAllowedTables() {
        var allowedTables = validator.getAllowedTables();
        assertEquals(1, allowedTables.size());
        assertTrue(allowedTables.contains("signals"));
    }
}
