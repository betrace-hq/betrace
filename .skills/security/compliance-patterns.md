# Compliance Security Patterns

Security patterns specific to SOC2 and HIPAA compliance.

## SOC2 Trust Service Criteria

### CC6: Logical and Physical Access Controls

#### CC6.1 - Authorization
**Control**: Restrict logical access through authorization mechanisms

**Implementation**:
```java
@SOC2(controls = {CC6_1}, notes = "User authorization check")
public boolean authorizeUser(String userId, String resource) {
    // Emits compliance span:
    // - framework: "soc2"
    // - control: "CC6_1"
    // - evidenceType: "audit_trail"
    return authService.check(userId, resource);
}
```

**Evidence Generated**:
- Compliance span with authorization decision
- User ID and resource accessed
- Timestamp of authorization check
- Outcome (allowed/denied)

#### CC6.2 - User Access Provisioning
**Control**: Manage user access provisioning and de-provisioning

**Implementation**:
```java
@SOC2(controls = {CC6_2}, notes = "User provisioning")
public void provisionUser(String userId, Set<String> roles) {
    // Log user creation event
    // Emit compliance span
    userRepository.createUser(userId, roles);
}

@SOC2(controls = {CC6_2}, notes = "User de-provisioning")
public void deprovisionUser(String userId) {
    // Log user deletion event
    // Emit compliance span
    userRepository.deleteUser(userId);
}
```

#### CC6.3 - Data Isolation (Multi-Tenancy)
**Control**: Isolate tenant data to prevent unauthorized cross-tenant access

**Implementation**:
```java
@SOC2(controls = {CC6_3}, notes = "Tenant data isolation")
public List<Trace> getTraces(String tenantId) {
    // All queries scoped by tenant ID
    return traceRepository.findByTenantId(tenantId);
}
```

**FLUO DSL Rule**:
```javascript
// Validate tenant isolation exists in traces
trace.has(database.query) and trace.has(tenant_id)
```

#### CC6.6 - Encryption at Rest
**Control**: Encrypt sensitive data stored in databases

**Implementation**:
```java
@SOC2(controls = {CC6_6}, notes = "Encryption at rest")
public void storeEncryptedData(String tenantId, byte[] data) {
    byte[] encrypted = encryptionService.encrypt(data, tenantId);
    dataRepository.save(tenantId, encrypted);
}
```

#### CC6.7 - Encryption in Transit
**Control**: Use TLS for data transmission

**Configuration**:
```properties
# Quarkus TLS configuration
quarkus.http.ssl.certificate.file=/path/to/cert.pem
quarkus.http.ssl.certificate.key-file=/path/to/key.pem
quarkus.http.ssl-port=8443
quarkus.http.insecure-requests=disabled
```

### CC7: System Operations

#### CC7.1 - Detection of Security Events
**Control**: Detect and respond to security events

**Implementation**:
```java
@SOC2(controls = {CC7_1}, notes = "Security event detection")
public void detectUnauthorizedAccess(String userId, String resource) {
    if (!authService.check(userId, resource)) {
        // Emit security violation signal
        signalService.emit("UNAUTHORIZED_ACCESS", userId, resource);
    }
}
```

**FLUO DSL Rule**:
```javascript
// Detect repeated authorization failures
trace.has(auth.failure)
  and trace.count(auth.failure) > 5
  and trace.timeWindow(5.minutes)
```

#### CC7.2 - System Monitoring
**Control**: Monitor system performance and availability

**Implementation**:
```java
@SOC2(controls = {CC7_2}, notes = "Audit logging")
@WithSpan(value = "audit.log")
public void logDataAccess(String userId, String resource) {
    Span span = Span.current();
    span.setAttribute("audit.user_id", userId);
    span.setAttribute("audit.resource", resource);
    span.setAttribute("audit.timestamp", Instant.now().toString());
}
```

### CC8: Change Management

#### CC8.1 - Manage Changes
**Control**: Track and approve system changes

**Implementation**:
```java
@SOC2(controls = {CC8_1}, notes = "Configuration change tracking")
public void updateRuleConfiguration(String tenantId, String ruleId, String newConfig) {
    // Log configuration change
    auditLog.logChange(tenantId, ruleId, getCurrentConfig(ruleId), newConfig);

    // Emit compliance span
    ruleRepository.updateConfig(ruleId, newConfig);
}
```

## HIPAA Technical Safeguards

### 164.312(a) - Access Control

#### 164.312(a)(1) - Unique User Identification
**Safeguard**: Assign unique identifier to each user

**Implementation**:
```java
@HIPAA(safeguards = {"164.312(a)(2)(i)"}, notes = "Unique user identification")
public String createUser(String email, String password) {
    String userId = UUID.randomUUID().toString();  // Unique ID
    userRepository.save(userId, email, hashPassword(password));
    return userId;
}
```

#### 164.312(a)(2)(i) - Unique User Identification
**Safeguard**: Assign unique name and/or number for identifying and tracking user identity

**Implementation**: See above

#### 164.312(a)(2)(iv) - Encryption and Decryption
**Safeguard**: Encrypt and decrypt ePHI

**Implementation**:
```java
@HIPAA(safeguards = {"164.312(a)(2)(iv)"}, notes = "ePHI encryption")
public void storePatientData(String patientId, HealthRecord record) {
    byte[] encrypted = encryptionService.encrypt(
        serialize(record),
        getPatientKey(patientId)
    );
    healthRepository.save(patientId, encrypted);
}
```

### 164.312(b) - Audit Controls

**Safeguard**: Implement hardware, software, and/or procedural mechanisms to record and examine activity

**Implementation**:
```java
@HIPAA(safeguards = {"164.312(b)"}, notes = "Audit controls for ePHI access")
@WithSpan(value = "hipaa.audit")
public HealthRecord getPatientData(String userId, String patientId) {
    // Audit log automatically created via span
    Span span = Span.current();
    span.setAttribute("hipaa.user_id", userId);
    span.setAttribute("hipaa.patient_id", patientId);
    span.setAttribute("hipaa.action", "read");
    span.setAttribute("hipaa.timestamp", Instant.now().toString());

    return healthRepository.findByPatientId(patientId);
}
```

**FLUO DSL Rule**:
```javascript
// HIPAA: All ePHI access must be audited
trace.has(ephi.access) and trace.has(audit.log)
```

### 164.312(e)(2)(ii) - Transmission Security

**Safeguard**: Encrypt ePHI during transmission

**Implementation**: Same as SOC2 CC6.7 (TLS configuration)

## Compliance Span Integrity

### Cryptographic Signing
All compliance spans are signed to ensure tamper-evidence:

```java
// Automatic in ComplianceSpan.Builder
ComplianceSpan span = ComplianceSpan.builder()
    .framework("soc2")
    .control("CC6_1")
    .evidenceType("audit_trail")
    .tenantId(tenantId)
    .outcome("success")
    .build();  // Signed automatically with HMAC-SHA256
```

### Signature Verification
Signatures verified before export to OpenTelemetry:

```java
// ComplianceSpanEmitter validates signatures
if (!signatureValid(span)) {
    throw new SecurityException("Compliance span signature invalid");
}
```

## PII Redaction Enforcement

### Annotation-Based Redaction
```java
public class UserData {
    @Redact(strategy = RedactionStrategy.HASH)
    private String emailAddress;

    @Redact(strategy = RedactionStrategy.MASK)
    private String phoneNumber;

    @Redact(strategy = RedactionStrategy.FULL)
    private String ssn;
}
```

### Validation Before Export
```java
// RedactionEnforcer.validateAndRedact()
public void validateBeforeExport(ComplianceSpan span) {
    if (containsUnredactedPII(span)) {
        throw new PIILeakageException("PII detected in compliance span");
    }
}
```

## Compliance Evidence Queries

### TraceQL (Grafana)
```
// All SOC2 CC6.1 authorization checks
{span.compliance.framework = "soc2" && span.compliance.control = "CC6_1"}

// HIPAA audit logs for specific patient
{span.compliance.framework = "hipaa" && span.hipaa.patient_id = "patient-123"}

// Failed authorization attempts (security monitoring)
{span.compliance.framework = "soc2" && span.compliance.outcome = "denied"}
```

### Prometheus (Span Metrics)
```
// SOC2 compliance span rate by control
sum by (compliance_control) (
  rate(traces_spanmetrics_calls_total{compliance_framework="soc2"}[5m])
)

// HIPAA audit event count
count(traces_spanmetrics_calls_total{compliance_framework="hipaa"})
```

## Common Compliance Patterns

### Pattern 1: Authorization with Audit Trail
```java
@SOC2(controls = {CC6_1, CC7_2})
@HIPAA(safeguards = {"164.312(a)(1)", "164.312(b)"})
public boolean authorizeDataAccess(String userId, String resourceId) {
    // Single annotation emits multiple compliance spans
    // Auditable via TraceQL
    return authService.authorize(userId, resourceId);
}
```

### Pattern 2: Encryption with Compliance Evidence
```java
@SOC2(controls = {CC6_6})
@HIPAA(safeguards = {"164.312(a)(2)(iv)"})
public void encryptAndStore(String data) {
    byte[] encrypted = encryptionService.encrypt(data.getBytes());
    repository.save(encrypted);
}
```

### Pattern 3: Change Tracking
```java
@SOC2(controls = {CC8_1})
public void updateConfiguration(String key, String oldValue, String newValue) {
    // Compliance span contains before/after values
    configRepository.update(key, newValue);
}
```

## Security + Compliance Integration

### Combined Security and Compliance Review
When reviewing code:
1. **Security**: OWASP checklist (injection, auth, crypto)
2. **Compliance**: SOC2/HIPAA controls (audit, encryption, access)
3. **Integrity**: Compliance span signatures
4. **Privacy**: PII redaction enforcement

### Example Review
```java
// Security: ✅ Parameterized query (no SQL injection)
// Compliance: ✅ @SOC2 audit trail
// Integrity: ✅ Span automatically signed
// Privacy: ✅ PII redacted via @Redact
@SOC2(controls = {CC6_1, CC7_2})
public User getUser(String userId) {
    return userRepository.findById(userId);  // Parameterized
}
```

## References

- **SOC2 Trust Service Criteria**: AICPA TSC 2017
- **HIPAA Security Rule**: 45 CFR Part 164, Subpart C
- **Compliance Status**: @docs/compliance-status.md
- **Compliance Integration Guide**: @backend/COMPLIANCE_INTEGRATION.md
