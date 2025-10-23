---
name: Security Review Expert
description: Reviews code for security vulnerabilities, validates compliance controls, assesses cryptographic implementations, and ensures OWASP best practices
---

# Security Review Expert Skill

## Purpose

This skill provides expertise in security review for BeTrace's behavioral assurance system, with focus on:
- OWASP Top 10 vulnerabilities
- Compliance frameworks (SOC2, HIPAA)
- Cryptographic integrity (span signatures, PII redaction)
- Rule engine sandboxing
- Multi-tenant isolation

## When to Use This Skill

Load this skill when:
- Reviewing code that touches sensitive data or user input
- Implementing authentication or authorization
- Adding cryptographic operations
- Evaluating compliance annotation usage
- Assessing tenant isolation boundaries
- Reviewing external API integrations

## Security Priorities

### P0 (Critical - Must Fix Before Production)
1. **Compliance Span Integrity**: Cryptographic signatures prevent tampering
2. **PII Leakage Prevention**: Redaction enforcement before telemetry export
3. **Rule Engine Sandboxing**: Prevent DSL code from accessing service layer
4. **Input Sanitization**: XSS, SQL injection, command injection prevention

### P1 (Important - Recommended for Enterprise)
1. **Tenant Cryptographic Isolation**: Per-tenant KMS encryption keys
2. **Authentication Chain Integrity**: Cryptographic signing of auth events
3. **Audit Logging**: Complete security event trail

## Security Review Checklist

### Input Validation
- [ ] All user input validated and sanitized
- [ ] No SQL injection vulnerabilities (use parameterized queries)
- [ ] No XSS vulnerabilities (escape HTML output)
- [ ] No command injection (avoid `Runtime.exec()` with user input)
- [ ] No LDAP injection
- [ ] File upload restrictions (type, size, content validation)

### Authentication & Authorization
- [ ] Authentication required for sensitive operations
- [ ] Authorization checks before data access
- [ ] Session management secure (timeouts, regeneration)
- [ ] Password handling follows best practices (bcrypt/argon2, no plaintext)
- [ ] MFA enforced for privileged accounts

### Cryptography
- [ ] Strong algorithms (AES-256, RSA-2048+, SHA-256+)
- [ ] No hardcoded keys or secrets
- [ ] Proper key rotation mechanisms
- [ ] Cryptographic signatures for tamper-evidence
- [ ] Secure random number generation

### PII & Data Protection
- [ ] `@Redact` annotations on PII fields
- [ ] PII validation before telemetry export
- [ ] Encryption at rest for sensitive data
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Data retention policies enforced

### Multi-Tenant Isolation
- [ ] Tenant ID validated on all requests
- [ ] Database queries scoped to tenant
- [ ] Rule engine isolation (per-tenant KieSession)
- [ ] No cross-tenant data leakage
- [ ] Resource quotas enforced

### Compliance Controls
- [ ] `@SOC2` / `@HIPAA` annotations present
- [ ] Compliance spans emit appropriate evidence
- [ ] Audit logs for security events
- [ ] Access control logs
- [ ] Change management logs

## OWASP Top 10 Coverage

### A01:2021 – Broken Access Control
- Verify authorization before resource access
- Enforce principle of least privilege
- Tenant isolation boundary checks

### A02:2021 – Cryptographic Failures
- Strong algorithms (see cryptography checklist)
- Proper key management
- No sensitive data in logs/spans without redaction

### A03:2021 – Injection
- Parameterized queries (SQL, LDAP)
- Input validation and sanitization
- Command injection prevention

### A04:2021 – Insecure Design
- Threat modeling for new features
- Secure defaults
- Defense in depth

### A05:2021 – Security Misconfiguration
- No default credentials
- Minimal permissions
- Security headers configured

### A06:2021 – Vulnerable and Outdated Components
- Dependency scanning (Nix flake locks)
- Timely security updates
- License compliance

### A07:2021 – Identification and Authentication Failures
- MFA for privileged accounts
- Secure session management
- Rate limiting on auth endpoints

### A08:2021 – Software and Data Integrity Failures
- Cryptographic span signatures
- Dependency hash verification (Nix)
- Code signing

### A09:2021 – Security Logging and Monitoring Failures
- Security events logged
- Compliance spans emitted
- Monitoring for suspicious patterns

### A10:2021 – Server-Side Request Forgery (SSRF)
- Validate URLs before fetching
- Whitelist allowed domains
- No user-controlled redirect targets

## BeTrace-Specific Security Patterns

### Compliance Span Integrity
```java
@SOC2(controls = {CC6_1}, notes = "Authorization check")
public void sensitiveOperation() {
    // Span automatically signed with HMAC-SHA256
    // Signature verified before OTel export
}
```

### PII Redaction
```java
@Redact(strategy = RedactionStrategy.HASH)
private String emailAddress;

// RedactionEnforcer validates before span export
// Throws PIILeakageException if unredacted
```

### Rule Engine Sandboxing
- DSL rules cannot access service layer
- Bytecode-level sandbox via Java agent
- Capability-based security (ImmutableSpanWrapper)

### Tenant Isolation
- Per-tenant KieSession
- Database queries scoped by tenant ID
- Future: Per-tenant KMS encryption keys

## Progressive Disclosure

This SKILL.md provides high-level guidance. For detailed security context:
1. Review `owasp-checklist.md` for vulnerability-specific patterns
2. Check `compliance-patterns.md` for SOC2/HIPAA controls
3. Consult `threat-models/` for attack scenario analysis
4. See `cryptography-guide.md` for implementation details

## Common Vulnerabilities to Flag

1. **Hardcoded Secrets**: API keys, passwords, encryption keys in code
2. **Missing Input Validation**: User input used without sanitization
3. **Weak Cryptography**: MD5, SHA-1, DES, small key sizes
4. **Missing Authorization**: Data access without permission checks
5. **PII Leakage**: Sensitive data in logs, traces, or error messages
6. **Insufficient Logging**: Security events not audited
7. **Tenant Leakage**: Cross-tenant data access
8. **SQL Injection**: String concatenation instead of parameterized queries
9. **XSS**: Unescaped user input in HTML output
10. **Insecure Defaults**: Permissive configurations, weak passwords

## Reference Documentation

- OWASP Top 10: https://owasp.org/Top10/
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- SOC2 Trust Service Criteria: See `compliance-patterns.md`
- HIPAA Security Rule: See `compliance-patterns.md`
