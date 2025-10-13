# PRD-027 Backend Security Requirements

**Status:** REQUIRED FOR PRODUCTION
**Priority:** P0 (BLOCKING)
**Related PRDs:** PRD-027a (Core Query Infrastructure), PRD-027b (Saved Queries Backend)

## Context

The Frontend Query UI (PRD-027c) has been implemented and is production-ready from a frontend security perspective. However, the backend API implementation (Units A and B) MUST implement the following security controls before the feature can be deployed.

**Security Expert Review Score:** 6/10 (Backend) - Blocking P0 Issues Identified

## Critical P0 Security Requirements (BLOCKING)

### 1. SQL Injection Prevention

**Requirement:** Validate and sanitize all user-provided SQL queries before execution.

**Implementation Required:**

```java
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.select.Select;

public class SqlQueryValidator {

    private static final Set<String> ALLOWED_TABLES = Set.of("signals");

    public void validateQuery(String sql) throws SecurityException {
        try {
            // Parse SQL to AST
            Statement stmt = CCJSqlParserUtil.parse(sql);

            // 1. Only allow SELECT statements
            if (!(stmt instanceof Select)) {
                throw new SecurityException("Only SELECT queries are allowed");
            }

            // 2. Reject multiple statements (semicolon attacks)
            if (sql.contains(";") && !sql.trim().endsWith(";")) {
                throw new SecurityException("Multiple statements not allowed");
            }

            // 3. Reject SQL comments (-- or /* */)
            if (sql.contains("--") || sql.contains("/*")) {
                throw new SecurityException("SQL comments not allowed");
            }

            // 4. Allowlist tables only (prevent joins to users, etc.)
            TablesNamesFinder tablesNamesFinder = new TablesNamesFinder();
            List<String> tableList = tablesNamesFinder.getTableList(stmt);

            for (String table : tableList) {
                if (!ALLOWED_TABLES.contains(table.toLowerCase())) {
                    throw new SecurityException(
                        "Access denied to table: " + table
                    );
                }
            }

            // 5. Reject UNION attacks
            if (sql.toUpperCase().contains("UNION")) {
                throw new SecurityException("UNION queries not allowed");
            }

        } catch (JSQLParserException e) {
            throw new SecurityException("Invalid SQL syntax", e);
        }
    }
}
```

**Usage in Service:**

```java
@ApplicationScoped
public class SignalQueryService {

    @Inject
    SqlQueryValidator validator;

    public QueryResult executeQuery(String tenantId, String userSql) {
        // CRITICAL: Validate before execution
        validator.validateQuery(userSql);

        // Build safe query with tenant isolation
        String safeSql = String.format(
            "SELECT * FROM (%s) AS user_query WHERE tenant_id = ?",
            userSql
        );

        return entityManager
            .createNativeQuery(safeSql, SignalQueryResult.class)
            .setParameter(1, tenantId)
            .getResultList();
    }
}
```

**Security Tests Required:**

```java
@Test
void shouldRejectDropTableAttack() {
    String malicious = "SELECT * FROM signals; DROP TABLE users; --";
    assertThrows(SecurityException.class,
        () -> validator.validateQuery(malicious));
}

@Test
void shouldRejectUnionAttack() {
    String malicious = "SELECT * FROM signals UNION SELECT * FROM users";
    assertThrows(SecurityException.class,
        () -> validator.validateQuery(malicious));
}

@Test
void shouldRejectUnauthorizedTableAccess() {
    String malicious = "SELECT password FROM users";
    assertThrows(SecurityException.class,
        () -> validator.validateQuery(malicious));
}

@Test
void shouldRejectMultipleStatements() {
    String malicious = "SELECT * FROM signals; SELECT * FROM users";
    assertThrows(SecurityException.class,
        () -> validator.validateQuery(malicious));
}

@Test
void shouldRejectSqlComments() {
    String malicious = "SELECT * FROM signals -- WHERE tenant_id = ?";
    assertThrows(SecurityException.class,
        () -> validator.validateQuery(malicious));
}
```

---

### 2. Authentication & Authorization

**Requirement:** All query endpoints must require authentication and enforce tenant isolation.

**Implementation Required:**

```java
@Path("/api/signals/query")
@Authenticated  // ✅ Require authentication
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SignalQueryResource {

    @Inject
    SecurityContext securityContext;

    @Inject
    SignalQueryService service;

    @POST
    @Path("/execute")
    @RolesAllowed("USER")  // ✅ Require USER role
    public QueryResult executeQuery(ExecuteQueryRequest request) {
        // ✅ Extract tenantId from authenticated security context
        String tenantId = extractTenantFromAuth();

        return service.executeQuery(tenantId, request.getSqlQuery());
    }

    @GET
    @Path("/saved")
    @RolesAllowed("USER")
    public List<SavedQuery> listSavedQueries() {
        String tenantId = extractTenantFromAuth();
        return service.listSavedQueries(tenantId);
    }

    @POST
    @Path("/saved")
    @RolesAllowed("USER")
    public SavedQuery saveQuery(@Valid SaveQueryRequest request) {
        String tenantId = extractTenantFromAuth();
        String userId = extractUserIdFromAuth();

        return service.saveQuery(tenantId, userId, request);
    }

    @DELETE
    @Path("/saved/{queryId}")
    @RolesAllowed("USER")
    public void deleteSavedQuery(@PathParam("queryId") String queryId) {
        String tenantId = extractTenantFromAuth();

        // Verify query belongs to user's tenant
        service.deleteSavedQuery(tenantId, queryId);
    }

    private String extractTenantFromAuth() {
        // Extract from JWT claims or security context
        return securityContext.getUserPrincipal().getName(); // Adjust based on auth system
    }

    private String extractUserIdFromAuth() {
        // Extract user ID from JWT claims
        return ((JsonWebToken) securityContext.getUserPrincipal()).getSubject();
    }
}
```

**Security Tests Required:**

```java
@Test
@TestSecurity(user = "testuser", roles = "USER")
void shouldAllowAuthenticatedUserToExecuteQuery() {
    given()
        .contentType(ContentType.JSON)
        .body(new ExecuteQueryRequest("SELECT * FROM signals"))
    .when()
        .post("/api/signals/query/execute")
    .then()
        .statusCode(200);
}

@Test
void shouldRejectUnauthenticatedRequests() {
    given()
        .contentType(ContentType.JSON)
        .body(new ExecuteQueryRequest("SELECT * FROM signals"))
    .when()
        .post("/api/signals/query/execute")
    .then()
        .statusCode(401);  // Unauthorized
}

@Test
@TestSecurity(user = "attacker", roles = "USER")
void shouldEnforceTenantIsolation() {
    // Create query as victim user
    String victimQueryId = createQueryAsUser("victim-tenant", "victim-user");

    // Try to access as attacker (different tenant)
    given()
    .when()
        .delete("/api/signals/query/saved/" + victimQueryId)
    .then()
        .statusCode(403);  // Forbidden
}
```

---

### 3. Error Message Sanitization

**Requirement:** Never expose internal system details in error responses.

**Implementation Required:**

```java
@Provider
public class SecurityExceptionMapper implements ExceptionMapper<Exception> {

    private static final Logger LOG = Logger.getLogger(SecurityExceptionMapper.class);

    @Override
    public Response toResponse(Exception exception) {
        // Log full exception details internally
        LOG.error("Query execution error", exception);

        // Return sanitized error to client
        String userMessage;
        int statusCode;

        if (exception instanceof SecurityException) {
            userMessage = exception.getMessage(); // Our custom messages are safe
            statusCode = 400;
        } else if (exception instanceof SQLSyntaxErrorException) {
            userMessage = "Invalid SQL syntax"; // Don't leak schema details
            statusCode = 400;
        } else if (exception instanceof PersistenceException) {
            userMessage = "Database error occurred"; // Don't leak DB details
            statusCode = 500;
        } else {
            userMessage = "Query execution failed"; // Generic fallback
            statusCode = 500;
        }

        return Response
            .status(statusCode)
            .entity(Map.of("error", userMessage))
            .build();
    }
}
```

**Security Tests Required:**

```java
@Test
void shouldNotLeakDatabaseSchemaInErrors() {
    String invalidSql = "SELECT nonexistent_column FROM signals";

    Response response = given()
        .contentType(ContentType.JSON)
        .body(new ExecuteQueryRequest(invalidSql))
    .when()
        .post("/api/signals/query/execute")
    .then()
        .statusCode(400)
        .extract().response();

    String errorMessage = response.jsonPath().getString("error");

    // Error should NOT contain table/column names
    assertFalse(errorMessage.contains("nonexistent_column"));
    assertFalse(errorMessage.contains("signals"));
    assertTrue(errorMessage.contains("Invalid SQL") ||
               errorMessage.contains("syntax"));
}

@Test
void shouldNotLeakStackTracesInProduction() {
    // Trigger internal server error
    String errorProneQuery = "..."; // Query that causes exception

    Response response = given()
        .contentType(ContentType.JSON)
        .body(new ExecuteQueryRequest(errorProneQuery))
    .when()
        .post("/api/signals/query/execute")
    .then()
        .statusCode(500)
        .extract().response();

    String errorMessage = response.jsonPath().getString("error");

    // Should not contain stack trace elements
    assertFalse(errorMessage.contains("at com.fluo"));
    assertFalse(errorMessage.contains("java.lang"));
    assertFalse(errorMessage.contains("Exception in thread"));
}
```

---

## P1 Security Requirements (Important)

### 4. Query Complexity Limits

**Requirement:** Prevent DoS via expensive queries.

```java
@ConfigProperty(name = "query.timeout.seconds", defaultValue = "10")
int queryTimeoutSeconds;

@ConfigProperty(name = "query.result.max-rows", defaultValue = "10000")
int maxResultRows;

public QueryResult executeQuery(String tenantId, String sql) {
    validator.validateQuery(sql);

    Query query = entityManager.createNativeQuery(wrapWithTenantFilter(sql));

    // Set timeout to prevent long-running queries
    query.setHint("javax.persistence.query.timeout", queryTimeoutSeconds * 1000);

    // Limit result size
    query.setMaxResults(maxResultRows);

    return query.getResultList();
}
```

---

### 5. Input Validation with Bean Validation

**Requirement:** Validate all input fields.

```java
public class SaveQueryRequest {
    @NotBlank(message = "Query name is required")
    @Size(min = 1, max = 100, message = "Name must be 1-100 characters")
    private String name;

    @Size(max = 500, message = "Description must be under 500 characters")
    private String description;

    @NotBlank(message = "SQL query is required")
    @Size(min = 10, max = 10000, message = "Query must be 10-10000 characters")
    private String sqlQuery;
}

@POST
@Path("/saved")
public SavedQuery saveQuery(@Valid SaveQueryRequest request) {
    // Bean Validation automatically validates
    // Throws ConstraintViolationException if invalid
}
```

---

### 6. CSRF Protection

**Requirement:** Protect state-changing operations from CSRF attacks.

```java
// In application.properties:
quarkus.http.csrf.policy=all

// Or selectively:
@POST
@Path("/execute")
@CSRF  // Quarkus CSRF annotation
public QueryResult executeQuery(ExecuteQueryRequest request) {
    // ...
}
```

**Frontend Implementation:**

```typescript
// Fetch CSRF token from cookie or meta tag
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

const response = await fetch('/api/signals/query/execute', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,  // Include CSRF token
    },
    body: JSON.stringify(request),
});
```

---

## P2 Security Enhancements (Nice-to-Have)

### 7. Audit Logging with SOC2 Compliance

```java
@SOC2(controls = {CC7_2}, notes = "Audit trail for query execution")
public QueryResult executeQuery(String tenantId, String sql) {
    LOG.info("Query executed: tenant={}, user={}, sql={}",
        tenantId, getCurrentUserId(), sanitizeSqlForLogging(sql));

    // Emit compliance span
    Span span = tracer.spanBuilder("query.execute")
        .setAttribute("tenant.id", tenantId)
        .setAttribute("query.hash", hashSql(sql))
        .startSpan();

    try {
        return doExecuteQuery(tenantId, sql);
    } finally {
        span.end();
    }
}
```

---

### 8. Rate Limiting

```java
@RateLimit(value = 10, window = "1m")  // 10 queries per minute
@POST
@Path("/execute")
public QueryResult executeQuery(ExecuteQueryRequest request) {
    // ...
}
```

---

### 9. Content Security Policy Headers

```java
@Provider
public class SecurityHeadersFilter implements ContainerResponseFilter {
    @Override
    public void filter(ContainerRequestContext request,
                      ContainerResponseContext response) {
        response.getHeaders().add(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
        );
    }
}
```

---

## Testing Checklist

Before deploying backend API, ensure ALL of these tests pass:

### SQL Injection Tests
- [ ] Reject DROP TABLE attacks
- [ ] Reject UNION attacks
- [ ] Reject multiple statements (semicolons)
- [ ] Reject SQL comments (-- and /* */)
- [ ] Reject unauthorized table access
- [ ] Reject INSERT/UPDATE/DELETE statements
- [ ] Allow only SELECT on 'signals' table

### Authentication Tests
- [ ] Reject unauthenticated requests (401)
- [ ] Require USER role for all endpoints
- [ ] Extract tenantId from SecurityContext, not request params
- [ ] Enforce tenant isolation on queries
- [ ] Enforce tenant isolation on saved query CRUD

### Error Handling Tests
- [ ] Don't leak database schema in errors
- [ ] Don't leak table/column names
- [ ] Don't expose stack traces
- [ ] Log full errors internally
- [ ] Return generic messages to clients

### Input Validation Tests
- [ ] Reject empty query names
- [ ] Reject overly long names/descriptions
- [ ] Reject null SQL queries
- [ ] Enforce max query length

### Performance Tests
- [ ] Query timeout after 10 seconds
- [ ] Max 10,000 rows per query
- [ ] Rate limit: 10 queries/minute per user

---

## Dependencies

**Required Libraries:**

```xml
<!-- pom.xml -->
<dependencies>
    <!-- SQL Parser for validation -->
    <dependency>
        <groupId>com.github.jsqlparser</groupId>
        <artifactId>jsqlparser</artifactId>
        <version>4.6</version>
    </dependency>

    <!-- Security annotations -->
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-security</artifactId>
    </dependency>

    <!-- Bean Validation -->
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-hibernate-validator</artifactId>
    </dependency>

    <!-- CSRF Protection -->
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-csrf-reactive</artifactId>
    </dependency>
</dependencies>
```

---

## Acceptance Criteria

Backend implementation is APPROVED for production when:

1. ✅ All P0 security requirements implemented
2. ✅ All security tests passing (15+ tests)
3. ✅ Security expert review scores ≥9/10
4. ✅ No OWASP Top 10 vulnerabilities present
5. ✅ Audit logging operational
6. ✅ Integration tests with frontend passing

---

## Timeline Estimate

**P0 Security Fixes:** 8-12 hours
- SQL validation: 4 hours
- Authentication/authorization: 3 hours
- Error sanitization: 1 hour
- Security tests: 2-4 hours

**Total:** 1-2 days for production-ready backend

---

## References

- OWASP SQL Injection Prevention Cheat Sheet
- OWASP Authentication Cheat Sheet
- Quarkus Security Guide
- JSqlParser Documentation
- SOC2 CC7.2 (System Monitoring)

---

## Status

**Current State:** Frontend complete (PRD-027c), backend not implemented
**Blocker:** Backend Units A and B required with above security controls
**Next Steps:** Implement PRD-027a (Core Query Infrastructure) with P0 security
