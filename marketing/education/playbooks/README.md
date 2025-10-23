# Domain-Specific Invariant Playbooks

**Last Updated:** October 2025

---

## Overview

This directory contains pre-built invariant playbooks for different domains. Each playbook provides:

1. **10-15 copy-paste invariant templates** (BeTrace DSL)
2. **Instrumentation examples** (OpenTelemetry)
3. **Common violations** and how to detect them
4. **ROI estimates** for each invariant category

**Target audience:** SREs, developers, architects implementing behavioral assurance

---

## Available Playbooks

| Playbook | Invariants | Primary Use Cases | Est. ROI |
|----------|-----------|-------------------|----------|
| [SRE Playbook](#sre-playbook) | 15 | Reliability, performance, availability | 10-30x |
| [Security Playbook](#security-playbook) | 15 | Authentication, authorization, isolation | 20-50x |
| [Compliance Playbook](#compliance-playbook) | 15 | HIPAA, SOC2, GDPR | 30-100x |
| [AI Safety Playbook](#ai-safety-playbook) | 12 | LLM guardrails, agent behavior | 15-40x |
| [E-Commerce Playbook](#e-commerce-playbook) | 15 | Checkout, payment, inventory | 25-75x |
| [Financial Services Playbook](#financial-services-playbook) | 15 | Transactions, audit trails | 40-120x |

---

## SRE Playbook

### Focus: Reliability, Performance, Availability

### 1. Circuit Breaker Pattern

**Invariant:** API failures should trigger circuit breaker

```javascript
// After N failures, circuit breaker should open
trace.count(api.call).where(status >= 500) > 5
  and trace.has(circuit_breaker.open)
```

**Instrumentation:**
```python
def call_external_api(endpoint):
    try:
        with tracer.start_span("api.call") as span:
            span.set_attribute("endpoint", endpoint)
            response = requests.get(endpoint)
            span.set_attribute("status", response.status_code)
            return response
    except Exception as e:
        with tracer.start_span("circuit_breaker.open") as cb_span:
            cb_span.set_attribute("reason", "failure_threshold")
            circuit_breaker.open()
        raise
```

**Common violations:**
- Circuit breaker not triggered (cascading failures)
- Circuit breaker opens too early (false positives)

**ROI:** Prevents cascading failures ($50K-$200K/incident)

---

### 2. Retry with Exponential Backoff

**Invariant:** Retries should use exponential backoff

```javascript
// Retry delay should increase exponentially
trace.has(http.retry).where(attempt == 1 and delay_ms < 1000)
  and trace.has(http.retry).where(attempt == 2 and delay_ms >= 1000)
```

**Common violations:**
- Fixed retry delay (overwhelms downstream)
- Unlimited retries (resource exhaustion)

---

### 3. Database Connection Pool Limits

**Invariant:** Connection pool should never exceed max size

```javascript
trace.has(database.connection).where(pool_size > max_pool_size)
```

---

### 4. Cache-First Pattern

**Invariant:** Database queries should check cache first

```javascript
trace.has(database.query)
  and trace.has(cache.check)
```

---

### 5. Graceful Degradation

**Invariant:** Service failures should trigger fallback

```javascript
trace.has(service.failure).where(critical == false)
  and trace.has(fallback.executed)
```

---

### 6. Load Shedding

**Invariant:** High load should trigger request rejection

```javascript
trace.has(http.request).where(load > threshold)
  and trace.has(load_shedding.activated)
```

---

### 7. Health Check Validation

**Invariant:** Unhealthy services should not receive traffic

```javascript
trace.has(http.request).where(service == service_a)
  and trace.has(health_check.healthy).where(service == service_a)
```

---

### 8. Timeout Enforcement

**Invariant:** Long-running requests should timeout

```javascript
trace.has(http.request).where(duration_ms > timeout_ms)
  and trace.has(timeout.triggered)
```

---

### 9. Bulkhead Pattern

**Invariant:** Thread pools should be isolated per service

```javascript
trace.has(service.call).where(service == service_a)
  and trace.has(thread_pool.assigned).where(pool == service_a_pool)
```

---

### 10. Rate Limiting

**Invariant:** High-frequency requests should be rate-limited

```javascript
trace.count(api.request).where(user_id == X and time_window == 1m) > 100
  and trace.has(rate_limit.applied)
```

---

### 11-15. Additional SRE Invariants

- **Metric Collection:** Critical operations should emit metrics
- **Distributed Tracing:** Cross-service calls should propagate trace context
- **Alerting:** Critical errors should trigger alerts
- **Capacity Planning:** Resource usage should be monitored
- **Incident Response:** On-call should be paged for critical failures

---

## Security Playbook

### Focus: Authentication, Authorization, Isolation

### 1. Authentication Required

**Invariant:** Protected endpoints require authentication

```javascript
trace.has(api.request).where(endpoint matches "/api/v1/.*")
  and trace.has(auth.validated)
```

**Instrumentation:**
```python
def protected_endpoint(request):
    with tracer.start_span("auth.validated") as span:
        token = request.headers.get("Authorization")
        span.set_attribute("token_type", "Bearer")
        user = validate_token(token)
        span.set_attribute("user.id", user.id)

    with tracer.start_span("api.request") as span:
        span.set_attribute("endpoint", request.path)
        return process_request(request)
```

**ROI:** Prevents unauthorized access ($200K-$2M/incident)

---

### 2. Authorization Check

**Invariant:** Admin endpoints require admin role

```javascript
trace.has(api.request).where(endpoint matches "/api/v1/admin/.*")
  and trace.has(auth.check_admin_role)
```

---

### 3. Cross-Tenant Isolation

**Invariant:** Tenant data queries must filter by tenant

```javascript
trace.has(database.query).where(table contains "tenant_data")
  and trace.has(database.query).where(tenant_filter == true)
```

---

### 4. PII Access Control

**Invariant:** PII access requires special permission

```javascript
trace.has(database.query).where(data_type == pii)
  and trace.has(auth.check_pii_permission)
```

---

### 5. Rate Limiting by User

**Invariant:** Per-user rate limits enforced

```javascript
trace.count(api.request).where(user_id == X and time_window == 1m) > 100
  and trace.has(rate_limit.user_throttled)
```

---

### 6. Input Validation

**Invariant:** User input should be sanitized

```javascript
trace.has(api.request).where(has_user_input == true)
  and trace.has(input.sanitized)
```

---

### 7. SQL Injection Prevention

**Invariant:** Database queries should use prepared statements

```javascript
trace.has(database.query).where(has_user_input == true)
  and trace.has(query.prepared_statement)
```

---

### 8. XSS Prevention

**Invariant:** User-generated content should be escaped

```javascript
trace.has(html.render).where(contains_user_content == true)
  and trace.has(content.escaped)
```

---

### 9. CSRF Protection

**Invariant:** State-changing requests require CSRF token

```javascript
trace.has(api.request).where(method in [POST, PUT, DELETE])
  and trace.has(csrf.validated)
```

---

### 10. Session Management

**Invariant:** Sessions should expire after inactivity

```javascript
trace.has(session.accessed).where(last_activity > 30m)
  and trace.has(session.expired)
```

---

### 11-15. Additional Security Invariants

- **Password Hashing:** Passwords should be hashed (never plaintext)
- **Encryption in Transit:** Sensitive data should use TLS
- **Encryption at Rest:** PII should be encrypted in database
- **Audit Logging:** Security events should be logged
- **MFA Enforcement:** High-value actions require MFA

---

## Compliance Playbook

### Focus: HIPAA, SOC2, GDPR

### 1. HIPAA: PHI Access Requires Authentication

**Invariant:** PHI access requires user authentication (164.312(a))

```javascript
trace.has(phi.access)
  and trace.has(auth.user_authenticated)
```

**Instrumentation:**
```python
@compliance(framework="HIPAA", control="164.312(a)")
def access_patient_record(user_id, patient_id):
    with tracer.start_span("auth.user_authenticated") as span:
        span.set_attribute("user.id", user_id)
        span.set_attribute("compliance.framework", "HIPAA")
        span.set_attribute("compliance.control", "164.312(a)")
        authenticate_user(user_id)

    with tracer.start_span("phi.access") as span:
        span.set_attribute("patient.id", patient_id)
        span.set_attribute("data_type", "phi")
        return fetch_patient_record(patient_id)
```

**ROI:** Avoids HIPAA fines ($50K-$1.5M/violation)

---

### 2. HIPAA: PHI Access Requires Audit Log

**Invariant:** PHI access requires audit log (164.312(b))

```javascript
trace.has(phi.access)
  and trace.has(audit.log)
```

---

### 3. SOC2: Authorization Before Data Access

**Invariant:** Data access requires authorization (CC6.1)

```javascript
trace.has(data.access)
  and trace.has(auth.check)
```

---

### 4. SOC2: Admin Actions Require Audit Log

**Invariant:** Admin actions require audit log (CC7.2)

```javascript
trace.has(admin.action)
  and trace.has(audit.log)
```

---

### 5. GDPR: Data Deletion Within 30 Days

**Invariant:** Deletion requests complete within 30 days (Article 17)

```javascript
trace.has(deletion.complete).where(days_since_request > 30)
```

---

### 6. GDPR: Data Export Within 30 Days

**Invariant:** Data export requests complete within 30 days (Article 15)

```javascript
trace.has(export.complete).where(days_since_request > 30)
```

---

### 7. GDPR: Consent Required for Processing

**Invariant:** Data processing requires user consent (Article 6)

```javascript
trace.has(data.process)
  and trace.has(consent.verified)
```

---

### 8. SOC2: Encryption in Transit

**Invariant:** Sensitive data transmission requires TLS (CC6.7)

```javascript
trace.has(data.transmit).where(sensitive == true)
  and trace.has(encryption.tls)
```

---

### 9. SOC2: Encryption at Rest

**Invariant:** Sensitive data storage requires encryption (CC6.6)

```javascript
trace.has(database.write).where(sensitive == true)
  and trace.has(encryption.at_rest)
```

---

### 10. PCI-DSS: Cardholder Data Access Logging

**Invariant:** Credit card data access requires audit log (10.2)

```javascript
trace.has(cardholder_data.access)
  and trace.has(audit.log)
```

---

### 11-15. Additional Compliance Invariants

- **Access Control Lists:** ACL checks before data access
- **Data Retention:** Data deleted after retention period
- **Breach Notification:** Security incidents logged
- **Third-Party Data Sharing:** User consent required
- **Right to Rectification:** User data updates logged

---

## AI Safety Playbook

### Focus: LLM Guardrails, Agent Behavior

### 1. Content Moderation Required

**Invariant:** LLM outputs require content moderation

```javascript
trace.has(llm.generate)
  and trace.has(content.moderate)
```

**Instrumentation:**
```python
def generate_ai_response(user_prompt):
    with tracer.start_span("llm.generate") as span:
        span.set_attribute("model", "gpt-4")
        span.set_attribute("prompt_length", len(user_prompt))
        response = llm.generate(user_prompt)

    with tracer.start_span("content.moderate") as span:
        span.set_attribute("response_length", len(response))
        moderation_result = moderate_content(response)
        span.set_attribute("flagged", moderation_result.flagged)

    return response
```

**ROI:** Prevents harmful content ($50K-$500K/incident)

---

### 2. Prompt Injection Detection

**Invariant:** User prompts should be checked for injections

```javascript
trace.has(llm.generate)
  and trace.has(prompt.injection_check)
```

---

### 3. RAG Source Attribution

**Invariant:** RAG responses must cite sources

```javascript
trace.has(llm.generate).where(rag_enabled == true)
  and trace.has(rag.cite_sources)
```

---

### 4. AI Agent Human Approval

**Invariant:** Destructive agent actions require human approval

```javascript
trace.has(agent.action).where(destructive == true)
  and trace.has(human.approval)
```

---

### 5. Token Limit Enforcement

**Invariant:** LLM requests should respect token limits

```javascript
trace.has(llm.generate).where(token_count > max_tokens)
```

---

### 6. Model Version Tracking

**Invariant:** LLM calls should specify model version

```javascript
trace.has(llm.generate)
  and trace.has(model.version_specified)
```

---

### 7. AI Cost Tracking

**Invariant:** LLM calls should track costs

```javascript
trace.has(llm.generate)
  and trace.has(cost.calculated)
```

---

### 8. Hallucination Detection

**Invariant:** RAG responses should verify against sources

```javascript
trace.has(llm.generate).where(rag_enabled == true)
  and trace.has(rag.fact_check)
```

---

### 9. PII Redaction in Prompts

**Invariant:** User prompts should redact PII

```javascript
trace.has(llm.generate)
  and trace.has(pii.redacted)
```

---

### 10. Agent Goal Alignment

**Invariant:** Agent actions should align with user goal

```javascript
trace.has(agent.action)
  and trace.has(goal.validated)
```

---

### 11-12. Additional AI Safety Invariants

- **Rate Limiting:** Per-user LLM request limits
- **Fallback Responses:** LLM failures should have fallback

---

## E-Commerce Playbook

### Focus: Checkout, Payment, Inventory

### 1. Payment Requires Inventory

**Invariant:** Payment charge requires inventory reservation

```javascript
trace.has(payment.charge)
  and trace.has(inventory.reserve)
```

**ROI:** Prevents overselling ($50K-$500K/incident)

---

### 2. Payment Idempotency

**Invariant:** Payment retries must reuse payment_intent_id

```javascript
trace.has(payment.charge).where(attempt > 1)
  and trace.count(payment.charge).where(payment_intent_id == unique) == 1
```

---

### 3. Fraud Check for High-Value Orders

**Invariant:** High-value payments require fraud check

```javascript
trace.has(payment.charge).where(amount > 1000)
  and trace.has(payment.fraud_check)
```

---

### 4. Refund Requires Original Payment

**Invariant:** Refunds must reference original payment

```javascript
trace.has(payment.refund)
  and trace.has(payment.charge)
```

---

### 5. Cart Validation Before Checkout

**Invariant:** Checkout requires cart validation

```javascript
trace.has(checkout.initiate)
  and trace.has(cart.validated)
```

---

### 6. Shipping After Payment

**Invariant:** Shipment requires payment confirmation

```javascript
trace.has(shipment.initiate)
  and trace.has(payment.confirm)
```

---

### 7. Inventory Deduction After Payment

**Invariant:** Inventory deduction requires payment success

```javascript
trace.has(inventory.deduct)
  and trace.has(payment.confirm)
```

---

### 8. Order Confirmation Email

**Invariant:** Completed orders should send confirmation

```javascript
trace.has(order.complete)
  and trace.has(email.confirmation_sent)
```

---

### 9-15. Additional E-Commerce Invariants

- **Discount Validation:** Promo codes validated before application
- **Tax Calculation:** Orders include tax calculation
- **Currency Conversion:** International orders use correct exchange rate
- **Abandoned Cart Recovery:** Abandoned carts tracked
- **Return Authorization:** Returns require authorization
- **Gift Card Balance:** Gift cards validated before use
- **Loyalty Points:** Points awarded after payment

---

## Financial Services Playbook

### Focus: Transactions, Audit Trails

### 1. Transaction Authorization

**Invariant:** Transactions require authorization

```javascript
trace.has(transaction.execute)
  and trace.has(auth.check)
```

**ROI:** Prevents unauthorized transactions ($100K-$5M/incident)

---

### 2. Transaction Audit Log

**Invariant:** Transactions must be logged

```javascript
trace.has(transaction.execute)
  and trace.has(audit.log)
```

---

### 3. Dual Approval for Large Transfers

**Invariant:** Large transfers require two approvals

```javascript
trace.has(transfer.execute).where(amount > 10000)
  and trace.count(approval.received) >= 2
```

---

### 4. KYC Check Before Account Opening

**Invariant:** Account creation requires KYC verification

```javascript
trace.has(account.create)
  and trace.has(kyc.verified)
```

---

### 5. AML Screening

**Invariant:** Transactions require AML screening

```javascript
trace.has(transaction.execute)
  and trace.has(aml.screened)
```

---

### 6. Balance Validation

**Invariant:** Withdrawals require sufficient balance

```javascript
trace.has(withdrawal.execute)
  and trace.has(balance.validated).where(sufficient == true)
```

---

### 7. Transaction Limits

**Invariant:** Transactions respect account limits

```javascript
trace.has(transaction.execute).where(amount > account_limit)
```

---

### 8. Reconciliation

**Invariant:** Daily transactions must reconcile

```javascript
trace.has(day.end)
  and trace.has(reconciliation.complete)
```

---

### 9-15. Additional Financial Invariants

- **Fraud Detection:** Suspicious transactions flagged
- **Regulatory Reporting:** Transactions reported to regulators
- **Statement Generation:** Monthly statements generated
- **Interest Calculation:** Interest calculated correctly
- **Fee Assessment:** Fees calculated and applied
- **Wire Transfer Approval:** Wire transfers require approval
- **Account Closure:** Closed accounts cannot transact

---

## Usage Guide

### Step 1: Choose Relevant Playbook

Identify which playbook matches your domain:
- SRE → Reliability, performance
- Security → Authentication, authorization
- Compliance → Regulatory requirements
- AI Safety → LLM applications
- E-Commerce → Payment, inventory
- Financial → Transactions, audit

---

### Step 2: Select Invariants

Choose 5-10 critical invariants from playbook

**Prioritization:**
1. P0: Security, compliance, financial
2. P1: Customer experience, data integrity
3. P2: Performance, reliability

---

### Step 3: Instrument Code

Add OpenTelemetry spans per playbook examples

**Template:**
```python
with tracer.start_span("operation.name") as span:
    span.set_attribute("key", value)
    perform_operation()
```

---

### Step 4: Define BeTrace Rules

Copy-paste BeTrace DSL from playbook

**Example YAML:**
```yaml
rules:
  - id: payment-requires-inventory
    name: "Payment requires inventory reservation"
    severity: critical
    condition: |
      trace.has(payment.charge)
        and trace.has(inventory.reserve)
```

---

### Step 5: Deploy and Monitor

Deploy rules to production, monitor alerts

**Refinement:**
- Week 1: High false positives (refine rules)
- Week 4: Stable (real violations only)

---

## Next Steps

**Learn more:**
- [Understanding Invariants](../understanding-invariants.md)
- [Invariant-Driven Development](../invariant-driven-development.md)
- [Invariant Template Library](../templates/invariant-library.md)

**Try BeTrace:**
- [Quick Start Guide](../../../docs/QUICK_START.md)
- [BeTrace DSL Reference](../../../docs/technical/trace-rules-dsl.md)

---

**Questions?**
- [GitHub Issues](https://github.com/betracehq/betrace/issues)
- Email: hello@betrace.com
