# OWASP Security Checklist

Comprehensive security review checklist based on OWASP Top 10 (2021) and ASVS.

## A01:2021 – Broken Access Control

### Authorization Checks
- [ ] Authorization verified before every sensitive operation
- [ ] Tenant ID validated on all API requests
- [ ] Cannot access other tenant's data by changing IDs
- [ ] Role-based access control (RBAC) enforced
- [ ] Principle of least privilege applied

### Examples
```java
// ✅ Correct
@SOC2(controls = {CC6_1})
public Trace getTrace(String tenantId, String traceId) {
    validateTenantAccess(tenantId);  // Explicit check
    return traceRepository.findByTenantAndId(tenantId, traceId);
}

// ❌ Vulnerable
public Trace getTrace(String traceId) {
    return traceRepository.findById(traceId);  // No tenant check!
}
```

## A02:2021 – Cryptographic Failures

### Encryption Standards
- [ ] AES-256 for symmetric encryption
- [ ] RSA-2048 or RSA-4096 for asymmetric encryption
- [ ] TLS 1.2+ for data in transit
- [ ] No MD5, SHA-1, DES, 3DES, RC4

### Key Management
- [ ] No hardcoded keys in source code
- [ ] Keys stored in KMS or secure vault
- [ ] Key rotation mechanism implemented
- [ ] Separate keys per tenant (future enhancement)

### Sensitive Data Protection
- [ ] `@Redact` annotation on PII fields
- [ ] RedactionEnforcer validates before telemetry export
- [ ] Database columns encrypted at rest
- [ ] No secrets in logs, traces, or error messages

### Examples
```java
// ✅ Correct
@Redact(strategy = RedactionStrategy.HASH)
private String emailAddress;

@Redact(strategy = RedactionStrategy.MASK)
private String creditCardNumber;

// ❌ Vulnerable
span.setAttribute("user.email", user.getEmail());  // PII leak!
```

## A03:2021 – Injection

### SQL Injection Prevention
- [ ] Always use parameterized queries
- [ ] Never concatenate user input into SQL
- [ ] Use ORM/query builder (JPA, Hibernate)
- [ ] Input validation before database operations

### Examples
```java
// ✅ Correct (parameterized)
String query = "SELECT * FROM traces WHERE tenant_id = ? AND trace_id = ?";
stmt = conn.prepareStatement(query);
stmt.setString(1, tenantId);
stmt.setString(2, traceId);

// ❌ Vulnerable (concatenation)
String query = "SELECT * FROM traces WHERE trace_id = '" + traceId + "'";
```

### Command Injection Prevention
- [ ] Avoid `Runtime.exec()` and `ProcessBuilder` with user input
- [ ] If unavoidable, whitelist allowed commands
- [ ] Validate and sanitize all arguments

### LDAP Injection Prevention
- [ ] Escape special characters: `*`, `(`, `)`, `\`, `/`, `NUL`
- [ ] Use LDAP libraries with safe APIs
- [ ] Validate DN and filter inputs

### XSS Prevention (Frontend)
- [ ] Escape HTML output: `<`, `>`, `&`, `"`, `'`
- [ ] Use React's `{variable}` syntax (auto-escapes)
- [ ] Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- [ ] Content Security Policy (CSP) headers configured

## A04:2021 – Insecure Design

### Threat Modeling
- [ ] Threat model exists for new features
- [ ] Attack surface minimized
- [ ] Defense in depth implemented
- [ ] Fail-secure (not fail-open)

### Secure Defaults
- [ ] Authentication required by default
- [ ] Least privilege by default
- [ ] Encryption enabled by default
- [ ] Secure session configuration

### Rate Limiting
- [ ] Rate limits on authentication endpoints
- [ ] Rate limits on API endpoints
- [ ] DDoS protection considerations

## A05:2021 – Security Misconfiguration

### Configuration Hardening
- [ ] No default credentials
- [ ] Minimal permissions/privileges
- [ ] Unnecessary features disabled
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)

### Environment Separation
- [ ] Development environment separate from production
- [ ] Secrets not committed to version control
- [ ] Environment-specific configuration files

### Error Handling
- [ ] No stack traces exposed to users
- [ ] Generic error messages for users
- [ ] Detailed logs for debugging (internal only)
- [ ] No sensitive data in error responses

## A06:2021 – Vulnerable and Outdated Components

### Dependency Management
- [ ] Nix flake locks all dependencies with cryptographic hashes
- [ ] Regular dependency updates
- [ ] Known vulnerabilities checked (CVE databases)
- [ ] License compliance verified

### Supply Chain Security
- [ ] Dependencies from trusted sources only
- [ ] No unverified binary downloads
- [ ] Build reproducibility (Nix ensures this)

## A07:2021 – Identification and Authentication Failures

### Authentication
- [ ] MFA enforced for privileged accounts
- [ ] Password complexity requirements
- [ ] Passwords hashed with bcrypt or argon2
- [ ] No plaintext password storage

### Session Management
- [ ] Secure session cookies (HttpOnly, Secure, SameSite)
- [ ] Session timeout configured
- [ ] Session regeneration after login
- [ ] Logout invalidates session

### Brute Force Protection
- [ ] Account lockout after failed attempts
- [ ] CAPTCHA on login forms
- [ ] Rate limiting on authentication endpoints

## A08:2021 – Software and Data Integrity Failures

### Compliance Span Integrity
- [ ] Cryptographic signatures (HMAC-SHA256) on spans
- [ ] Signature verification before OTel export
- [ ] Tamper-evident audit trail

### Build Integrity
- [ ] Nix flake locks ensure reproducible builds
- [ ] Dependency hashes verified
- [ ] No unverified code execution

### Examples
```java
// ✅ Correct (automatic signing)
@SOC2(controls = {CC7_2})
public void logSecurityEvent() {
    // ComplianceSpan automatically signed
    // Signature verified in ComplianceSpanEmitter
}
```

## A09:2021 – Security Logging and Monitoring Failures

### Security Event Logging
- [ ] Authentication attempts logged
- [ ] Authorization failures logged
- [ ] Data access logged
- [ ] Configuration changes logged
- [ ] Security exceptions logged

### Compliance Spans
- [ ] `@SOC2` / `@HIPAA` annotations emit spans
- [ ] Compliance spans contain audit evidence
- [ ] Spans queryable by auditors

### Monitoring
- [ ] Alerts for suspicious patterns
- [ ] Failed authentication spike detection
- [ ] Unusual data access patterns
- [ ] Rule violations generate signals

### Examples
```java
@SOC2(controls = {CC6_1, CC7_2}, notes = "Authorization with audit trail")
@HIPAA(safeguards = {"164.312(b)"}, notes = "Audit controls")
public void authorizeDataAccess(String tenantId, String userId) {
    // Compliance span automatically emitted
    // Queryable by auditors via OpenTelemetry
}
```

## A10:2021 – Server-Side Request Forgery (SSRF)

### URL Validation
- [ ] Validate URLs before fetching external resources
- [ ] Whitelist allowed domains
- [ ] Block private IP ranges (127.0.0.1, 10.0.0.0/8, etc.)
- [ ] No user-controlled redirect targets

### Examples
```java
// ✅ Correct
private static final Set<String> ALLOWED_DOMAINS = Set.of(
    "api.example.com",
    "telemetry.example.com"
);

public void fetchExternalResource(String url) {
    URI uri = new URI(url);
    if (!ALLOWED_DOMAINS.contains(uri.getHost())) {
        throw new SecurityException("Domain not allowed");
    }
    // Proceed with fetch
}

// ❌ Vulnerable
public void fetchExternalResource(String url) {
    HttpClient.newHttpClient().send(
        HttpRequest.newBuilder(URI.create(url)).build(),  // No validation!
        HttpResponse.BodyHandlers.ofString()
    );
}
```

## Additional Security Best Practices

### PII Handling
- [ ] PII annotated with `@Redact`
- [ ] RedactionEnforcer validates before export
- [ ] Compliance with GDPR, CCPA, HIPAA

### Multi-Tenant Isolation
- [ ] Tenant ID on all database queries
- [ ] Per-tenant rule engine isolation
- [ ] No cross-tenant data access

### Rule Engine Sandboxing
- [ ] DSL cannot access service layer
- [ ] Capability-based security
- [ ] Bytecode-level sandbox enforced

### API Security
- [ ] Authentication required (Bearer tokens, API keys)
- [ ] Rate limiting per tenant
- [ ] Input validation on all endpoints
- [ ] Output encoding to prevent injection

## Review Process

1. **Identify sensitive operations**: Authentication, data access, external API calls
2. **Map to OWASP categories**: Which Top 10 vulnerabilities apply?
3. **Apply checklist items**: Review each relevant item
4. **Test security controls**: Verify protections work
5. **Document findings**: Security review results, remediation plan
