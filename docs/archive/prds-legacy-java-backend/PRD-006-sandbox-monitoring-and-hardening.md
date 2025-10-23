# PRD-006: Sandbox Monitoring and Hardening

**Status:** Draft
**Priority:** P1
**Estimated Effort:** 1 week
**Security Impact:** +0.5 (9.5/10 → 10/10)

## Context

PRD-005 Phase 1 achieved **9.5/10 security rating** with full production readiness. The remaining **-0.5 deduction** is for minor P1 improvements that enhance operational visibility and further harden the sandbox.

**Current State:**
- ✅ Bytecode-level sandbox (Java Instrumentation)
- ✅ Thread-safe tenant isolation
- ✅ CI/CD security testing
- ✅ JVM flag validation
- ⚠️ No performance metrics for sandbox operations
- ⚠️ Agent JAR not cryptographically signed
- ⚠️ Limited operational visibility into sandbox violations

**Security Expert Feedback (9.5/10 review):**
> "Minor P1 improvements: performance monitoring, JAR signing, enhanced audit logging"

---

## Problem Statement

While PRD-005 Phase 1 provides robust security, production operations lack:

1. **Performance Visibility:** No metrics on sandbox overhead or invocation patterns
2. **Operational Assurance:** Agent JAR integrity not cryptographically verified
3. **Security Forensics:** Limited audit trail for sandbox violation investigations

**Impact:**
- Operators cannot measure sandbox performance impact
- Security teams lack detailed forensic data for incident response
- JAR tampering could go undetected (low probability, high impact)

---

## Goals

### Primary Goal
Achieve **10/10 security rating** by addressing all remaining P1 improvements.

### Success Metrics
- **Performance:** Sandbox overhead < 1% of total request time
- **Observability:** 100% of sandbox violations logged with full context
- **Integrity:** Agent JAR cryptographically signed with verified chain of trust

---

## Requirements

### 1. Performance Monitoring (P1)

**What:**
Add Micrometer metrics for sandbox operations.

**Metrics:**
```java
// Invocation counters
sandbox.invocations.total (by operation, tenant)
sandbox.violations.total (by violation_type, tenant)

// Performance timers
sandbox.transformation.duration (class load overhead)
sandbox.check.duration (runtime check overhead)
```

**Implementation:**
```java
// SandboxContext.java
@Timed("sandbox.check.duration")
public static void enterRuleExecution() {
    inRuleExecution.set(true);
    meterRegistry.counter("sandbox.invocations.total",
        "operation", "enter",
        "tenant", getCurrentTenant()
    ).increment();
}
```

**Acceptance Criteria:**
- [ ] Metrics exported to Prometheus
- [ ] Grafana dashboard shows sandbox overhead per tenant
- [ ] Alerts configured for violation rate spikes

---

### 2. Agent JAR Signing (P1)

**What:**
Cryptographically sign agent JAR to prevent tampering.

**Implementation:**
```xml
<!-- pom.xml -->
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-jarsigner-plugin</artifactId>
    <version>3.0.0</version>
    <executions>
        <execution>
            <id>sign-agent</id>
            <goals><goal>sign</goal></goals>
            <configuration>
                <keystore>${project.basedir}/security/keystore.jks</keystore>
                <alias>betrace-agent</alias>
                <storepass>${agent.keystore.password}</storepass>
            </configuration>
        </execution>
        <execution>
            <id>verify-agent</id>
            <goals><goal>verify</goal></goals>
        </execution>
    </executions>
</plugin>
```

**Acceptance Criteria:**
- [ ] Agent JAR signed with RSA 4096-bit key
- [ ] Signature verification in CI/CD pipeline
- [ ] Runtime validation: JVM rejects unsigned agent (optional policy)

---

### 3. Enhanced Audit Logging (P1)

**What:**
Emit detailed audit logs for all sandbox violations with full context.

**Implementation:**
```java
// SandboxTransformer.java
private void injectViolationLogging(MethodVisitor mv, String operation, String className) {
    // Before throwing SecurityException, emit audit log:
    mv.visitLdcInsn(operation);
    mv.visitLdcInsn(className);
    mv.visitMethodInsn(INVOKESTATIC,
        "com/betrace/security/audit/AuditLogger",
        "logViolation",
        "(Ljava/lang/String;Ljava/lang/String;)V",
        false);
}
```

**Audit Log Format:**
```json
{
  "timestamp": "2025-10-12T17:30:00Z",
  "event": "sandbox.violation",
  "tenant": "tenant-123",
  "operation": "Runtime.exec",
  "className": "com.example.MaliciousRule",
  "method": "executeCommand",
  "stackTrace": ["..."],
  "ruleId": "rule-456",
  "spanId": "span-789"
}
```

**Acceptance Criteria:**
- [ ] All violations logged to OpenTelemetry with compliance span
- [ ] Logs include full stack trace for forensics
- [ ] Searchable in Grafana Loki by tenant/rule/operation
- [ ] Alerts configured for repeated violations (DDoS detection)

---

## Implementation Plan

### Phase 1: Performance Monitoring (2 days)
1. Add Micrometer dependencies to `pom.xml`
2. Instrument `SandboxContext` with counters/timers
3. Create Grafana dashboard for sandbox metrics
4. Configure alerts for violation rate anomalies

### Phase 2: Agent Signing (2 days)
1. Generate signing keystore: `keytool -genkeypair -keystore security/keystore.jks`
2. Add `maven-jarsigner-plugin` to build
3. Update CI/CD to inject keystore password from secrets
4. Add signature verification to deployment scripts

### Phase 3: Enhanced Audit Logging (3 days)
1. Create `AuditLogger` class with OpenTelemetry integration
2. Update `SandboxTransformer` to inject audit calls before SecurityException
3. Configure compliance span emission for violations
4. Create Grafana Loki queries for violation forensics
5. Add runbook for incident response

---

## Security Properties

### After PRD-006 Completion

**10/10 Security Rating:**
- ✅ Bytecode-level sandbox (PRD-005)
- ✅ Thread-safe tenant isolation (PRD-005)
- ✅ JVM flag validation (PRD-005)
- ✅ Performance monitoring (PRD-006)
- ✅ Agent integrity verification (PRD-006)
- ✅ Comprehensive audit logging (PRD-006)

**Operational Benefits:**
- Real-time visibility into sandbox overhead
- Forensic audit trail for security incidents
- Cryptographic assurance of agent integrity
- Early detection of attack patterns (violation rate spikes)

---

## Testing

### Performance Tests
```java
@Test
void testSandboxOverhead() {
    // Measure baseline rule execution time
    long baseline = executeRulesWithoutSandbox();

    // Measure with sandbox enabled
    long withSandbox = executeRulesWithSandbox();

    // Assert overhead < 1%
    assertThat(withSandbox - baseline).isLessThan(baseline * 0.01);
}
```

### Signature Verification Tests
```java
@Test
void testAgentSignatureValid() {
    Path agentJar = Paths.get("target/betrace-backend-1.0.0-SNAPSHOT-agent.jar");
    assertTrue(JarVerifier.isSignatureValid(agentJar));
}
```

### Audit Logging Tests
```java
@Test
void testViolationLogging() {
    SandboxContext.enterRuleExecution();

    // Attempt forbidden operation
    assertThrows(SecurityException.class, () -> {
        Runtime.getRuntime().exec("whoami");
    });

    // Verify audit log emitted
    List<AuditLog> logs = auditLogger.getRecentLogs();
    assertThat(logs).hasSize(1);
    assertThat(logs.get(0).getOperation()).isEqualTo("Runtime.exec");
}
```

---

## Compliance Impact

### SOC2 Evidence
- **CC7.1 (System Monitoring):** Performance metrics demonstrate sandbox effectiveness
- **CC7.2 (System Monitoring):** Audit logs provide forensic evidence
- **CC8.1 (Change Management):** Agent signing ensures integrity

### HIPAA Technical Safeguards
- **164.312(b) (Audit Controls):** Enhanced audit logging for PHI access
- **164.312(c)(1) (Integrity):** JAR signing ensures system integrity

---

## Risks and Mitigations

### Risk 1: Performance Overhead
**Mitigation:** Micrometer metrics use lock-free counters (negligible overhead)

### Risk 2: Key Management
**Mitigation:** Use CI/CD secret management (GitHub Actions secrets, Vault)

### Risk 3: Log Volume
**Mitigation:** Sample violations at 1% for high-volume tenants (configurable)

---

## Success Criteria

### Must Have
- [ ] Performance metrics exported to Prometheus
- [ ] Agent JAR signed with RSA 4096-bit key
- [ ] All violations logged to OpenTelemetry

### Should Have
- [ ] Grafana dashboard for sandbox operations
- [ ] Alerts for violation rate anomalies
- [ ] Incident response runbook

### Nice to Have
- [ ] ML-based anomaly detection for violation patterns
- [ ] Automated violation reports for security teams
- [ ] Integration with SIEM (Splunk, Datadog)

---

## Post-Implementation

After PRD-006 completion:
1. Security Expert re-review (expected: 10/10)
2. Load testing with performance validation
3. Production deployment with monitoring
4. Proceed to **PRD-005 Phase 2** (bytecode validation, resource limits)

---

## References

- **PRD-005:** Rule Engine Sandboxing (Phase 1 complete, 9.5/10)
- **Security Expert Review:** 9.5/10 (commit 9e45e8e)
- **ADR-017:** Capability-Based Rule Engine Security
- **Micrometer Docs:** https://micrometer.io/docs
- **Maven Jarsigner Plugin:** https://maven.apache.org/plugins/maven-jarsigner-plugin/

---

**Estimated Timeline:** 1 week
**Dependencies:** PRD-005 Phase 1 complete
**Next PRD:** PRD-005 Phase 2 (bytecode validation, resource limits)
