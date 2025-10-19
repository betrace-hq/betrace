# FLUO DSL Pattern Library

Real-world rule templates organized by use case. Copy, adapt, and deploy these patterns to match your OpenTelemetry traces.

## Table of Contents

- [SRE Patterns](#sre-patterns) - Undocumented invariants, incident prevention
- [Developer Patterns](#developer-patterns) - API contracts, service assumptions
- [Compliance Patterns](#compliance-patterns) - SOC2, HIPAA, regulatory evidence
- [AI Safety Patterns](#ai-safety-patterns) - Agent monitoring, hallucinations, bias
- [Security Patterns](#security-patterns) - Authorization, encryption, audit trails
- [Performance Patterns](#performance-patterns) - Latency, throughput, resource usage
- [Reliability Patterns](#reliability-patterns) - Retries, circuit breakers, timeouts

---

## SRE Patterns

### Pattern: Undocumented Retry Limit

**Use Case:** "We had an incident where a service retried infinitely and exhausted the connection pool."

```javascript
trace.count(database.retry) > 10
```

**Adaptation:**
- Change `10` to your retry threshold
- Change `database.retry` to match your span name

---

### Pattern: Missing Circuit Breaker

**Use Case:** "External API calls should have circuit breaker protection."

```javascript
trace.has(external_api.call).where(latency > 5000)
  and not trace.has(circuit_breaker.open)
```

**Adaptation:**
- Change `5000` to your timeout threshold (milliseconds)
- Change `external_api.call` to your external service span name
- Change `circuit_breaker.open` to your circuit breaker span name

---

### Pattern: Cascading Timeout Failures

**Use Case:** "Timeouts propagate through the call chain causing cascading failures."

```javascript
trace.has(http.request).where(status == timeout)
  and trace.count(http.request).where(status == timeout) > 3
```

**Adaptation:**
- Change `3` to your cascade threshold
- Change `status == timeout` to match your timeout indicator

---

### Pattern: Missing Error Logging

**Use Case:** "We had an incident where errors occurred but weren't logged."

```javascript
trace.has(http.response).where(status >= 500)
  and not trace.has(error.logged)
```

**Adaptation:**
- Change `500` to your error threshold
- Change `error.logged` to your logging span name

---

### Pattern: Database Connection Leak

**Use Case:** "Connection pool exhaustion due to unclosed connections."

```javascript
trace.has(database.connection_acquired)
  and not trace.has(database.connection_released)
```

**Adaptation:**
- Change span names to match your connection management

---

### Pattern: Request/Response Mismatch

**Use Case:** "HTTP requests without corresponding responses indicate stuck connections."

```javascript
trace.count(http.request) != trace.count(http.response)
```

---

### Pattern: Missing Health Check

**Use Case:** "Services should emit health check spans on startup."

```javascript
trace.has(service.started)
  and not trace.has(service.health_check)
```

---

### Pattern: Excessive Memory Allocation

**Use Case:** "Memory spikes during high-volume processing."

```javascript
trace.has(batch.process).where(records > 10000)
  and trace.has(memory.allocated).where(bytes > 1000000000)
```

**Adaptation:**
- Change `10000` to your batch size threshold
- Change `1000000000` (1GB) to your memory threshold

---

### Pattern: Missing Metrics Emission

**Use Case:** "Critical operations must emit metrics for observability."

```javascript
trace.has(payment.processed)
  and not trace.has(metrics.payment_success)
```

---

### Pattern: Slow Distributed Lock

**Use Case:** "Distributed locks held for too long block other services."

```javascript
trace.has(distributed_lock.acquired).where(duration > 5000)
```

**Adaptation:**
- Change `5000` to your lock timeout threshold (milliseconds)

---

## Developer Patterns

### Pattern: API Key Validation Required

**Use Case:** "All API requests must validate API keys before accessing data."

```javascript
trace.has(api.request)
  and trace.has(data.access)
  and not trace.has(api.validate_key)
```

---

### Pattern: PII Access Without Validation

**Use Case:** "Database queries accessing PII must validate authorization first."

```javascript
trace.has(database.query).where(contains_pii == true)
  and not trace.has(auth.validate)
```

---

### Pattern: File Upload Without Virus Scan

**Use Case:** "All file uploads require virus scanning before storage."

```javascript
trace.has(file.upload)
  and not trace.has(security.virus_scan)
```

---

### Pattern: Cache Miss Without Fallback

**Use Case:** "Cache misses should fall back to database, not fail."

```javascript
trace.has(cache.miss)
  and not trace.has(database.query)
  and not trace.has(error)
```

---

### Pattern: Unvalidated Input

**Use Case:** "User input must be validated before processing."

```javascript
trace.has(api.receive_input)
  and trace.has(business_logic.process)
  and not trace.has(validation.input)
```

---

### Pattern: Missing Rate Limiting

**Use Case:** "Expensive operations must have rate limiting."

```javascript
trace.has(api.expensive_operation)
  and not trace.has(rate_limit.check)
```

---

### Pattern: Database Transaction Without Rollback

**Use Case:** "Failed transactions must attempt rollback."

```javascript
trace.has(database.transaction_start)
  and trace.has(error)
  and not trace.has(database.transaction_rollback)
```

---

### Pattern: Missing Content-Type Validation

**Use Case:** "API endpoints must validate Content-Type header."

```javascript
trace.has(api.request).where(method == POST)
  and not trace.has(validation.content_type)
```

---

### Pattern: Async Task Without Confirmation

**Use Case:** "Async tasks should confirm receipt before processing."

```javascript
trace.has(async_task.queued)
  and trace.has(async_task.processing)
  and not trace.has(async_task.confirmed)
```

---

### Pattern: Missing CORS Validation

**Use Case:** "Cross-origin requests must validate CORS headers."

```javascript
trace.has(api.request).where(origin_header_present == true)
  and not trace.has(cors.validate)
```

---

## Compliance Patterns

### Pattern: SOC2 CC6.1 - Authorization Before Access

**Use Case:** "SOC2 Trust Service Criteria - Logical access controls."

```javascript
trace.has(data.access)
  and not trace.has(auth.check)
```

**Compliance Mapping:** SOC2 CC6.1

---

### Pattern: SOC2 CC6.7 - Encryption in Transit

**Use Case:** "SOC2 Trust Service Criteria - Data transmission security."

```javascript
trace.has(data.transmitted)
  and not trace.has(encryption.tls)
```

**Compliance Mapping:** SOC2 CC6.7

---

### Pattern: SOC2 CC7.2 - Audit Logging

**Use Case:** "SOC2 Trust Service Criteria - System monitoring."

```javascript
trace.has(pii.access)
  and not trace.has(audit.log)
```

**Compliance Mapping:** SOC2 CC7.2

---

### Pattern: HIPAA 164.312(a) - Access Control

**Use Case:** "HIPAA Technical Safeguards - Unique user identification."

```javascript
trace.has(ephi.access)
  and not trace.has(user.authenticated)
```

**Compliance Mapping:** HIPAA 164.312(a)(2)(i)

---

### Pattern: HIPAA 164.312(b) - Audit Controls

**Use Case:** "HIPAA Technical Safeguards - Record and examine activity."

```javascript
trace.has(ephi.access)
  and not trace.has(audit.log)
```

**Compliance Mapping:** HIPAA 164.312(b)

---

### Pattern: HIPAA 164.312(e) - Transmission Security

**Use Case:** "HIPAA Technical Safeguards - Encryption in transit."

```javascript
trace.has(ephi.transmitted)
  and not trace.has(encryption.tls)
```

**Compliance Mapping:** HIPAA 164.312(e)(2)(ii)

---

### Pattern: GDPR Article 32 - Encryption at Rest

**Use Case:** "GDPR Security of Processing - Pseudonymisation and encryption."

```javascript
trace.has(personal_data.stored)
  and not trace.has(encryption.at_rest)
```

**Compliance Mapping:** GDPR Article 32(1)(a)

---

### Pattern: PCI-DSS 7.1 - Need-to-Know Access

**Use Case:** "PCI-DSS Requirement 7 - Restrict access to cardholder data."

```javascript
trace.has(cardholder_data.access)
  and not trace.has(auth.role_check)
```

**Compliance Mapping:** PCI-DSS 7.1

---

### Pattern: PCI-DSS 10.2 - Audit Trail

**Use Case:** "PCI-DSS Requirement 10 - Track and monitor all access."

```javascript
trace.has(cardholder_data.access)
  and not trace.has(audit.log)
```

**Compliance Mapping:** PCI-DSS 10.2

---

### Pattern: Tenant Isolation Validation

**Use Case:** "Multi-tenant systems must validate tenant boundaries."

```javascript
trace.has(database.query)
  and not trace.has(tenant.validate)
```

---

## AI Safety Patterns

### Pattern: Agent Goal Deviation Detection

**Use Case:** "AI agents must stay aligned with original goal."

```javascript
trace.has(agent.plan.created)
  and trace.has(agent.plan.executed)
  and trace.has(agent.goal_deviation).where(score > 0.7)
```

**AI Safety Principle:** Alignment

---

### Pattern: Agent Prompt Injection Detection

**Use Case:** "Detect unauthorized instruction sources (prompt hijacking)."

```javascript
trace.has(agent.instruction_received)
  and trace.has(agent.instruction_source).where(source not in [authorized_system, user_interface])
```

**AI Safety Principle:** Input Validation

---

### Pattern: Agent Tool Use Without Approval

**Use Case:** "AI agents must request approval for sensitive operations."

```javascript
trace.has(agent.tool_use).where(requires_approval == true)
  and not trace.has(human.approval_granted)
```

**AI Safety Principle:** Human Oversight

---

### Pattern: Agent Delegation Boundary Violation

**Use Case:** "AI agents must only delegate to approved sub-agents."

```javascript
trace.has(agent.delegation)
  and trace.has(agent.delegate_to).where(delegate not in [approved_agent_1, approved_agent_2])
```

**AI Safety Principle:** Containment

---

### Pattern: Medical Diagnosis Without Citations

**Use Case:** "Medical AI must cite sources for all diagnoses (hallucination prevention)."

```javascript
trace.has(medical.diagnosis)
  and not trace.has(source_citation)
```

**AI Safety Principle:** Reliability

---

### Pattern: Low-Confidence Claim Without Disclosure

**Use Case:** "AI must disclose uncertainty when confidence is low."

```javascript
trace.has(factual_claim).where(confidence < 0.7)
  and not trace.has(uncertainty_disclosure)
```

**AI Safety Principle:** Transparency

---

### Pattern: Financial Advice Without Data Source

**Use Case:** "Financial AI must cite data sources for recommendations."

```javascript
trace.has(financial.advice)
  and not trace.has(data_source.verified)
```

**AI Safety Principle:** Accountability

---

### Pattern: Hiring Decision Bias Detection

**Use Case:** "Detect statistical anomalies in hiring decisions by demographic."

```javascript
trace.has(hiring.decision)
  and trace.has(bias.statistical_anomaly).where(confidence > 0.95)
```

**AI Safety Principle:** Fairness

**Note:** Requires aggregate analysis over traces, not single-trace matching.

---

### Pattern: Loan Approval Bias Detection

**Use Case:** "Detect disparate impact in lending decisions."

```javascript
trace.has(loan.approval_decision)
  and trace.has(bias.detected).where(protected_class == gender).where(significance > 0.95)
```

**AI Safety Principle:** Fairness

---

### Pattern: AI Self-Modification Attempt

**Use Case:** "Detect AI attempting to modify its own code/weights."

```javascript
trace.has(ai.self_modification_attempt)
```

**AI Safety Principle:** Containment

---

## Security Patterns

### Pattern: Admin Endpoint Without Admin Check

**Use Case:** "Admin endpoints must verify admin role."

```javascript
trace.has(api.request).where(endpoint matches "/api/v1/admin/.*")
  and not trace.has(auth.check_admin)
```

---

### Pattern: Password Change Without Re-Authentication

**Use Case:** "Password changes require re-authentication."

```javascript
trace.has(user.password_change)
  and not trace.has(auth.reauthenticate)
```

---

### Pattern: Sensitive Data Exposure in Logs

**Use Case:** "Ensure PII is redacted before logging."

```javascript
trace.has(log.write).where(contains_pii == true)
  and not trace.has(redaction.applied)
```

---

### Pattern: Unencrypted Data at Rest

**Use Case:** "Sensitive data must be encrypted before storage."

```javascript
trace.has(storage.write).where(sensitive == true)
  and not trace.has(encryption.at_rest)
```

---

### Pattern: Missing CSRF Protection

**Use Case:** "State-changing requests must have CSRF tokens."

```javascript
trace.has(api.request).where(method in [POST, PUT, DELETE])
  and not trace.has(csrf.validate)
```

---

### Pattern: SQL Injection Risk

**Use Case:** "User input must be sanitized before SQL execution."

```javascript
trace.has(database.query).where(user_input_present == true)
  and not trace.has(input.sanitized)
```

---

### Pattern: Missing MFA for Privileged Access

**Use Case:** "Privileged operations require multi-factor authentication."

```javascript
trace.has(privileged.operation)
  and not trace.has(auth.mfa_verified)
```

---

### Pattern: Session Fixation Vulnerability

**Use Case:** "Sessions must be regenerated after authentication."

```javascript
trace.has(auth.login_success)
  and not trace.has(session.regenerated)
```

---

### Pattern: Repeated Auth Failures (Brute Force)

**Use Case:** "Detect brute force attacks via repeated auth failures."

```javascript
trace.count(auth.failure) > 5
```

---

### Pattern: Missing Security Headers

**Use Case:** "HTTP responses must include security headers."

```javascript
trace.has(http.response)
  and not trace.has(security_headers.set)
```

---

## Performance Patterns

### Pattern: Slow Database Query

**Use Case:** "Database queries exceeding 1 second need optimization."

```javascript
trace.has(database.query).where(duration > 1000)
```

**Adaptation:**
- Change `1000` to your latency threshold (milliseconds)

---

### Pattern: N+1 Query Problem

**Use Case:** "Detect excessive database queries in a trace."

```javascript
trace.count(database.query) > 50
```

**Adaptation:**
- Change `50` to your threshold

---

### Pattern: Large Payload Without Compression

**Use Case:** "Large HTTP responses should be compressed."

```javascript
trace.has(http.response).where(size > 1000000)
  and not trace.has(compression.applied)
```

**Adaptation:**
- Change `1000000` (1MB) to your size threshold

---

### Pattern: Missing Cache Hit

**Use Case:** "Frequently accessed data should use caching."

```javascript
trace.has(data.access).where(access_frequency == high)
  and not trace.has(cache.hit)
```

---

### Pattern: Synchronous Processing of Async Work

**Use Case:** "Long-running tasks should be async."

```javascript
trace.has(api.request)
  and trace.has(long_running_task).where(duration > 10000)
  and not trace.has(async_task.queued)
```

**Adaptation:**
- Change `10000` to your async threshold (milliseconds)

---

### Pattern: Missing Index (Full Table Scan)

**Use Case:** "Database queries should use indexes."

```javascript
trace.has(database.query).where(scan_type == full_table)
```

---

### Pattern: Excessive API Calls

**Use Case:** "Detect API call storms."

```javascript
trace.count(api.call) > 100
```

---

### Pattern: Missing Connection Pooling

**Use Case:** "Database connections should use pooling."

```javascript
trace.has(database.connection_created)
  and not trace.has(connection_pool.retrieved)
```

---

### Pattern: Unbounded Result Sets

**Use Case:** "Queries should limit result set size."

```javascript
trace.has(database.query).where(limit_clause == false)
  and trace.has(database.result).where(row_count > 1000)
```

---

### Pattern: Missing CDN for Static Assets

**Use Case:** "Static assets should be served via CDN."

```javascript
trace.has(http.request).where(path matches ".*\\.(js|css|jpg|png)")
  and not trace.has(cdn.served)
```

---

## Reliability Patterns

### Pattern: Missing Dead Letter Queue

**Use Case:** "Failed async tasks should go to DLQ."

```javascript
trace.has(async_task.failed)
  and not trace.has(dlq.enqueued)
```

---

### Pattern: Missing Idempotency Check

**Use Case:** "Retryable operations must be idempotent."

```javascript
trace.has(payment.charge)
  and trace.has(retry.attempt)
  and not trace.has(idempotency.check)
```

---

### Pattern: Missing Health Check Failure

**Use Case:** "Unhealthy services should fail health checks."

```javascript
trace.has(service.degraded)
  and not trace.has(health_check.failed)
```

---

### Pattern: Missing Graceful Degradation

**Use Case:** "Fallback logic when dependency unavailable."

```javascript
trace.has(dependency.unavailable)
  and trace.has(error)
  and not trace.has(fallback.executed)
```

---

### Pattern: Missing Backpressure

**Use Case:** "High load should trigger backpressure."

```javascript
trace.has(queue.size).where(size > 10000)
  and not trace.has(backpressure.applied)
```

---

### Pattern: Missing Bulkhead Isolation

**Use Case:** "Critical services should have resource isolation."

```javascript
trace.has(critical_service.call)
  and trace.has(resource_exhaustion)
  and not trace.has(bulkhead.isolated)
```

---

### Pattern: Missing Chaos Engineering Marker

**Use Case:** "Production chaos experiments should be marked."

```javascript
trace.has(chaos.experiment_running)
  and not trace.has(chaos.marker)
```

---

### Pattern: Missing SLO Breach Alert

**Use Case:** "SLO breaches should trigger alerts."

```javascript
trace.has(slo.breach)
  and not trace.has(alert.sent)
```

---

### Pattern: Missing Load Shedding

**Use Case:** "Overloaded services should shed low-priority requests."

```javascript
trace.has(service.overloaded)
  and trace.has(low_priority.request)
  and not trace.has(load_shedding.applied)
```

---

### Pattern: Missing Retry Backoff

**Use Case:** "Retries should use exponential backoff."

```javascript
trace.has(retry.attempt).where(attempt_number > 1)
  and not trace.has(backoff.applied)
```

---

## Summary

**50+ Patterns Provided:**
- **10 SRE Patterns** - Incident-driven invariants
- **10 Developer Patterns** - API contract enforcement
- **10 Compliance Patterns** - SOC2, HIPAA, GDPR, PCI-DSS
- **10 AI Safety Patterns** - Agent monitoring, hallucinations, bias
- **10 Security Patterns** - Authorization, encryption, attack detection
- **10 Performance Patterns** - Latency, caching, optimization
- **10 Reliability Patterns** - Retries, fallbacks, resilience

**Usage Tips:**
1. Copy pattern closest to your use case
2. Adapt span names to match your OpenTelemetry instrumentation
3. Adjust thresholds (amounts, counts, durations) to your requirements
4. Test with sample traces before production deployment
5. Add meaningful descriptions in rule YAML for future maintainers

**Missing a Pattern?**
- Search FLUO knowledge base for domain-specific patterns
- Use `.skills/fluo-dsl/syntax-reference.md` to write custom rules
- Contribute new patterns to this library for community benefit
