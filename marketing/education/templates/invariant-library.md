# Invariant Template Library

**Last Updated:** October 2025

---

## Overview

This library contains 80 copy-paste invariant templates organized by category. Each template includes:

1. **Invariant name and description**
2. **BeTrace DSL code** (ready to use)
3. **When to use** (scenarios)
4. **Common violations** (what to watch for)
5. **Example span instrumentation** (OpenTelemetry)

**Usage:** Copy template, customize for your use case, deploy as BeTrace rule.

---

## Categories

- [Authentication & Authorization](#authentication--authorization) (10 templates)
- [Data Access & Privacy](#data-access--privacy) (10 templates)
- [Payment & Transactions](#payment--transactions) (10 templates)
- [Multi-Tenant Isolation](#multi-tenant-isolation) (10 templates)
- [Compliance & Audit](#compliance--audit) (10 templates)
- [AI Agent Behavior](#ai-agent-behavior) (10 templates)
- [Resource Management](#resource-management) (10 templates)
- [Error Handling & Retry Logic](#error-handling--retry-logic) (10 templates)

---

## Authentication & Authorization

### 1. Protected Endpoint Authentication

**Description:** Protected endpoints require authentication

**BeTrace DSL:**
```javascript
trace.has(api.request).where(endpoint matches "/api/v1/.*")
  and trace.has(auth.validated)
```

**When to use:**
- REST APIs with authentication
- Microservices requiring token validation
- Public endpoints with access control

**Common violations:**
- Forgot to add auth middleware
- Authentication bypass in caching layer
- Test environment without auth

**Instrumentation:**
```python
def protected_endpoint(request):
    with tracer.start_span("auth.validated") as span:
        token = request.headers.get("Authorization")
        user = validate_token(token)
        span.set_attribute("user.id", user.id)

    with tracer.start_span("api.request") as span:
        span.set_attribute("endpoint", request.path)
        return process_request(request)
```

---

### 2. Admin Role Authorization

**Description:** Admin endpoints require admin role check

**BeTrace DSL:**
```javascript
trace.has(api.request).where(endpoint matches "/api/v1/admin/.*")
  and trace.has(auth.check_admin_role)
```

**When to use:**
- Admin panels
- Privileged operations
- System configuration endpoints

**Common violations:**
- Role check missing in new admin feature
- Authorization bypassed by URL manipulation
- Test user with admin access in production

---

### 3. Resource Ownership Validation

**Description:** Users can only access their own resources

**BeTrace DSL:**
```javascript
trace.has(resource.access)
  and trace.has(ownership.validated)
```

**When to use:**
- User-specific data access
- Multi-user systems
- Privacy-sensitive operations

---

### 4. Session Validation

**Description:** Requests require valid session

**BeTrace DSL:**
```javascript
trace.has(api.request).where(requires_session == true)
  and trace.has(session.validated)
```

---

### 5. MFA for High-Risk Operations

**Description:** High-risk operations require MFA

**BeTrace DSL:**
```javascript
trace.has(operation.high_risk)
  and trace.has(mfa.verified)
```

---

### 6. Token Expiration Check

**Description:** Expired tokens should be rejected

**BeTrace DSL:**
```javascript
trace.has(auth.validated).where(token_expired == true)
```

---

### 7. Permission Boundary Enforcement

**Description:** Operations respect permission boundaries

**BeTrace DSL:**
```javascript
trace.has(operation.execute)
  and trace.has(permission.checked)
```

---

### 8. API Key Validation

**Description:** API endpoints require valid API key

**BeTrace DSL:**
```javascript
trace.has(api.request).where(requires_api_key == true)
  and trace.has(api_key.validated)
```

---

### 9. OAuth Scope Validation

**Description:** OAuth operations require correct scope

**BeTrace DSL:**
```javascript
trace.has(operation.execute)
  and trace.has(oauth.scope_validated)
```

---

### 10. Service Account Authorization

**Description:** Service-to-service calls require authorization

**BeTrace DSL:**
```javascript
trace.has(service.call).where(service_to_service == true)
  and trace.has(service_auth.validated)
```

---

## Data Access & Privacy

### 11. PII Access Requires Permission

**Description:** PII access requires special permission

**BeTrace DSL:**
```javascript
trace.has(database.query).where(data_type == pii)
  and trace.has(auth.check_pii_permission)
```

**When to use:**
- Healthcare applications (PHI)
- Financial services (SSN, account numbers)
- HR systems (employee data)

**Common violations:**
- New query path missing PII check
- Bulk export bypasses permission
- Debug logs containing PII

**Instrumentation:**
```python
def access_user_pii(user_id, requesting_user_id):
    with tracer.start_span("auth.check_pii_permission") as span:
        span.set_attribute("requesting_user.id", requesting_user_id)
        span.set_attribute("target_user.id", user_id)
        check_pii_permission(requesting_user_id)

    with tracer.start_span("database.query") as span:
        span.set_attribute("data_type", "pii")
        span.set_attribute("user.id", user_id)
        return fetch_pii(user_id)
```

---

### 12. Data Export Requires Approval

**Description:** Bulk data exports require approval

**BeTrace DSL:**
```javascript
trace.has(data.export).where(record_count > 100)
  and trace.has(export.approved)
```

---

### 13. Data Anonymization Before Export

**Description:** Exported data should be anonymized

**BeTrace DSL:**
```javascript
trace.has(data.export).where(contains_pii == true)
  and trace.has(data.anonymized)
```

---

### 14. Read-Only User Restrictions

**Description:** Read-only users cannot write data

**BeTrace DSL:**
```javascript
trace.has(database.write).where(user_role == read_only)
```

---

### 15. Data Retention Enforcement

**Description:** Old data should be deleted per retention policy

**BeTrace DSL:**
```javascript
trace.has(data.query).where(age_days > retention_days)
```

---

### 16. Cross-Region Data Transfer

**Description:** Cross-region transfers require authorization

**BeTrace DSL:**
```javascript
trace.has(data.transfer).where(cross_region == true)
  and trace.has(transfer.authorized)
```

---

### 17. Data Classification Enforcement

**Description:** Data access respects classification

**BeTrace DSL:**
```javascript
trace.has(data.access).where(classification == confidential)
  and trace.has(clearance.validated)
```

---

### 18. Data Masking

**Description:** Sensitive fields should be masked

**BeTrace DSL:**
```javascript
trace.has(data.display).where(contains_sensitive == true)
  and trace.has(data.masked)
```

---

### 19. Data Encryption at Rest

**Description:** Sensitive data should be encrypted

**BeTrace DSL:**
```javascript
trace.has(database.write).where(sensitive == true)
  and trace.has(encryption.at_rest)
```

---

### 20. Data Encryption in Transit

**Description:** Sensitive data transmissions use TLS

**BeTrace DSL:**
```javascript
trace.has(data.transmit).where(sensitive == true)
  and trace.has(encryption.tls)
```

---

## Payment & Transactions

### 21. Payment Requires Inventory

**Description:** Payment charges require inventory reservation

**BeTrace DSL:**
```javascript
trace.has(payment.charge)
  and trace.has(inventory.reserve)
```

**When to use:**
- E-commerce checkout
- Reservation systems
- Limited inventory scenarios

**Common violations:**
- Race condition: payment before inventory check
- Inventory reservation timeout
- Distributed transaction failure

**Instrumentation:**
```python
def checkout(cart, payment_method):
    with tracer.start_span("inventory.reserve") as span:
        span.set_attribute("cart.id", cart.id)
        span.set_attribute("item.count", len(cart.items))
        reserve_inventory(cart.items)

    with tracer.start_span("payment.charge") as span:
        span.set_attribute("amount", cart.total)
        charge_payment(cart.total, payment_method)
```

---

### 22. Payment Idempotency

**Description:** Payment retries reuse payment_intent_id

**BeTrace DSL:**
```javascript
trace.has(payment.charge).where(attempt > 1)
  and trace.count(payment.charge).where(payment_intent_id == unique) == 1
```

---

### 23. Fraud Check for High-Value Payments

**Description:** High-value payments require fraud check

**BeTrace DSL:**
```javascript
trace.has(payment.charge).where(amount > 1000)
  and trace.has(payment.fraud_check)
```

---

### 24. Refund Requires Original Payment

**Description:** Refunds must reference original payment

**BeTrace DSL:**
```javascript
trace.has(payment.refund)
  and trace.has(payment.charge)
```

---

### 25. Payment Authorization

**Description:** Payments require authorization

**BeTrace DSL:**
```javascript
trace.has(payment.charge)
  and trace.has(payment.authorized)
```

---

### 26. Transaction Reconciliation

**Description:** Transactions must reconcile daily

**BeTrace DSL:**
```javascript
trace.has(day.end)
  and trace.has(reconciliation.complete)
```

---

### 27. Chargeback Documentation

**Description:** Chargebacks require documentation

**BeTrace DSL:**
```javascript
trace.has(chargeback.received)
  and trace.has(documentation.attached)
```

---

### 28. Payment Confirmation Email

**Description:** Successful payments send confirmation

**BeTrace DSL:**
```javascript
trace.has(payment.success)
  and trace.has(email.confirmation_sent)
```

---

### 29. Currency Conversion Validation

**Description:** International payments validate exchange rate

**BeTrace DSL:**
```javascript
trace.has(payment.charge).where(currency_conversion == true)
  and trace.has(exchange_rate.validated)
```

---

### 30. Payment Timeout Handling

**Description:** Timed-out payments should be handled

**BeTrace DSL:**
```javascript
trace.has(payment.timeout)
  and trace.has(timeout.handled)
```

---

## Multi-Tenant Isolation

### 31. Tenant Filtering in Queries

**Description:** Tenant data queries must filter by tenant

**BeTrace DSL:**
```javascript
trace.has(database.query).where(table contains "tenant_data")
  and trace.has(database.query).where(tenant_filter == true)
```

**When to use:**
- Multi-tenant SaaS
- Shared database architecture
- Row-level security

**Common violations:**
- Missing WHERE tenant_id clause
- Bulk operations bypass filter
- Admin queries without tenant scope

**Instrumentation:**
```python
def query_tenant_data(tenant_id, query_params):
    with tracer.start_span("tenant.context_loaded") as span:
        span.set_attribute("tenant.id", tenant_id)
        load_tenant_context(tenant_id)

    with tracer.start_span("database.query") as span:
        span.set_attribute("table", "tenant_data")
        span.set_attribute("tenant.id", tenant_id)
        span.set_attribute("tenant_filter", True)
        return db.query(f"SELECT * FROM data WHERE tenant_id = {tenant_id}")
```

---

### 32. Cross-Tenant Access Prevention

**Description:** Tenant A cannot access Tenant B data

**BeTrace DSL:**
```javascript
trace.has(api.request).where(tenant_id == tenant_a)
  and not trace.has(database.query).where(tenant_id == tenant_b)
```

---

### 33. Tenant Context Validation

**Description:** Operations require tenant context

**BeTrace DSL:**
```javascript
trace.has(operation.execute)
  and trace.has(tenant.context_loaded)
```

---

### 34. Tenant Resource Quotas

**Description:** Tenants respect resource quotas

**BeTrace DSL:**
```javascript
trace.has(resource.allocate).where(usage > quota)
```

---

### 35. Tenant Data Export

**Description:** Tenant exports only include their data

**BeTrace DSL:**
```javascript
trace.has(data.export).where(tenant_id == X)
  and trace.has(export.tenant_validated)
```

---

### 36. Tenant Billing Isolation

**Description:** Billing operations respect tenant boundaries

**BeTrace DSL:**
```javascript
trace.has(billing.charge)
  and trace.has(tenant.validated)
```

---

### 37. Tenant Admin Restrictions

**Description:** Tenant admins only manage their tenant

**BeTrace DSL:**
```javascript
trace.has(admin.action).where(scope == tenant)
  and trace.has(tenant.validated)
```

---

### 38. Tenant Backup Isolation

**Description:** Backups are tenant-specific

**BeTrace DSL:**
```javascript
trace.has(backup.create)
  and trace.has(tenant.scoped)
```

---

### 39. Tenant Search Isolation

**Description:** Search results filtered by tenant

**BeTrace DSL:**
```javascript
trace.has(search.execute)
  and trace.has(tenant.filter_applied)
```

---

### 40. Tenant Feature Flags

**Description:** Feature flags respect tenant settings

**BeTrace DSL:**
```javascript
trace.has(feature.enabled)
  and trace.has(tenant.feature_checked)
```

---

## Compliance & Audit

### 41. HIPAA: PHI Access Audit

**Description:** PHI access requires audit log

**BeTrace DSL:**
```javascript
trace.has(phi.access)
  and trace.has(audit.log)
```

**When to use:**
- Healthcare applications
- HIPAA compliance (164.312(b))
- Patient records systems

**Common violations:**
- New PHI access path missing audit
- Bulk queries not logged
- Debug access bypasses audit

**Instrumentation:**
```python
@compliance(framework="HIPAA", control="164.312(b)")
def access_patient_record(user_id, patient_id):
    with tracer.start_span("phi.access") as span:
        span.set_attribute("user.id", user_id)
        span.set_attribute("patient.id", patient_id)
        span.set_attribute("data_type", "phi")
        record = fetch_patient(patient_id)

    with tracer.start_span("audit.log") as span:
        span.set_attribute("action", "phi_access")
        span.set_attribute("user.id", user_id)
        span.set_attribute("patient.id", patient_id)
        log_phi_access(user_id, patient_id)

    return record
```

---

### 42. SOC2: Admin Action Audit

**Description:** Admin actions require audit log

**BeTrace DSL:**
```javascript
trace.has(admin.action)
  and trace.has(audit.log)
```

---

### 43. GDPR: Consent Validation

**Description:** Data processing requires consent

**BeTrace DSL:**
```javascript
trace.has(data.process)
  and trace.has(consent.verified)
```

---

### 44. GDPR: Data Deletion Timeline

**Description:** Deletion requests complete within 30 days

**BeTrace DSL:**
```javascript
trace.has(deletion.complete).where(days_since_request > 30)
```

---

### 45. PCI-DSS: Cardholder Data Logging

**Description:** Credit card access requires audit log

**BeTrace DSL:**
```javascript
trace.has(cardholder_data.access)
  and trace.has(audit.log)
```

---

### 46. Access Control List Enforcement

**Description:** ACL checks before data access

**BeTrace DSL:**
```javascript
trace.has(data.access)
  and trace.has(acl.checked)
```

---

### 47. Change Management Logging

**Description:** System changes require approval and log

**BeTrace DSL:**
```javascript
trace.has(system.change)
  and trace.has(change.approved)
  and trace.has(audit.log)
```

---

### 48. Security Event Logging

**Description:** Security events must be logged

**BeTrace DSL:**
```javascript
trace.has(security.event)
  and trace.has(audit.log)
```

---

### 49. Data Breach Notification

**Description:** Breaches trigger notification workflow

**BeTrace DSL:**
```javascript
trace.has(breach.detected)
  and trace.has(notification.sent)
```

---

### 50. Compliance Report Generation

**Description:** Compliance activities generate reports

**BeTrace DSL:**
```javascript
trace.has(compliance.activity)
  and trace.has(report.generated)
```

---

## AI Agent Behavior

### 51. LLM Content Moderation

**Description:** LLM outputs require content moderation

**BeTrace DSL:**
```javascript
trace.has(llm.generate)
  and trace.has(content.moderate)
```

**When to use:**
- Customer-facing AI chatbots
- Content generation systems
- AI assistants

**Common violations:**
- Streaming responses bypass moderation
- Cached responses skip check
- Test mode without moderation

**Instrumentation:**
```python
def generate_ai_response(user_prompt):
    with tracer.start_span("llm.generate") as span:
        span.set_attribute("model", "gpt-4")
        span.set_attribute("prompt_length", len(user_prompt))
        response = llm.generate(user_prompt)

    with tracer.start_span("content.moderate") as span:
        span.set_attribute("response_length", len(response))
        moderation = moderate_content(response)
        span.set_attribute("flagged", moderation.flagged)

    return response
```

---

### 52. Prompt Injection Detection

**Description:** User prompts checked for injections

**BeTrace DSL:**
```javascript
trace.has(llm.generate)
  and trace.has(prompt.injection_check)
```

---

### 53. RAG Source Attribution

**Description:** RAG responses cite sources

**BeTrace DSL:**
```javascript
trace.has(llm.generate).where(rag_enabled == true)
  and trace.has(rag.cite_sources)
```

---

### 54. AI Agent Human Approval

**Description:** Destructive actions require approval

**BeTrace DSL:**
```javascript
trace.has(agent.action).where(destructive == true)
  and trace.has(human.approval)
```

---

### 55. Token Limit Enforcement

**Description:** LLM requests respect token limits

**BeTrace DSL:**
```javascript
trace.has(llm.generate).where(token_count > max_tokens)
```

---

### 56. Model Version Tracking

**Description:** LLM calls specify model version

**BeTrace DSL:**
```javascript
trace.has(llm.generate)
  and trace.has(model.version_specified)
```

---

### 57. AI Cost Tracking

**Description:** LLM calls track costs

**BeTrace DSL:**
```javascript
trace.has(llm.generate)
  and trace.has(cost.calculated)
```

---

### 58. Hallucination Detection

**Description:** RAG responses verified against sources

**BeTrace DSL:**
```javascript
trace.has(llm.generate).where(rag_enabled == true)
  and trace.has(rag.fact_check)
```

---

### 59. PII Redaction in Prompts

**Description:** User prompts redact PII

**BeTrace DSL:**
```javascript
trace.has(llm.generate)
  and trace.has(pii.redacted)
```

---

### 60. Agent Goal Validation

**Description:** Agent actions align with user goal

**BeTrace DSL:**
```javascript
trace.has(agent.action)
  and trace.has(goal.validated)
```

---

## Resource Management

### 61. Cache-First Pattern

**Description:** Database queries check cache first

**BeTrace DSL:**
```javascript
trace.has(database.query)
  and trace.has(cache.check)
```

**When to use:**
- High-traffic read operations
- Performance optimization
- Cost reduction

**Common violations:**
- New query path bypasses cache
- Cache key collision
- Cache invalidation missing

---

### 62. Connection Pool Limits

**Description:** Connection pools respect max size

**BeTrace DSL:**
```javascript
trace.has(database.connection).where(pool_size > max_pool_size)
```

---

### 63. Rate Limiting Enforcement

**Description:** API requests respect rate limits

**BeTrace DSL:**
```javascript
trace.count(api.request).where(user_id == X and time_window == 1m) > 100
  and trace.has(rate_limit.applied)
```

---

### 64. Circuit Breaker Activation

**Description:** Failures trigger circuit breaker

**BeTrace DSL:**
```javascript
trace.count(api.call).where(status >= 500) > 5
  and trace.has(circuit_breaker.open)
```

---

### 65. Load Shedding

**Description:** High load triggers request rejection

**BeTrace DSL:**
```javascript
trace.has(http.request).where(load > threshold)
  and trace.has(load_shedding.activated)
```

---

### 66. Resource Quota Enforcement

**Description:** Users respect resource quotas

**BeTrace DSL:**
```javascript
trace.has(resource.allocate).where(usage > quota)
```

---

### 67. Batch Job Scheduling

**Description:** Batch jobs run during off-peak hours

**BeTrace DSL:**
```javascript
trace.has(batch.job_start).where(hour >= 9 and hour <= 17)
```

---

### 68. Memory Limit Enforcement

**Description:** Operations respect memory limits

**BeTrace DSL:**
```javascript
trace.has(operation.execute).where(memory_mb > limit_mb)
```

---

### 69. Timeout Enforcement

**Description:** Long-running requests timeout

**BeTrace DSL:**
```javascript
trace.has(http.request).where(duration_ms > timeout_ms)
  and trace.has(timeout.triggered)
```

---

### 70. Graceful Degradation

**Description:** Service failures trigger fallback

**BeTrace DSL:**
```javascript
trace.has(service.failure).where(critical == false)
  and trace.has(fallback.executed)
```

---

## Error Handling & Retry Logic

### 71. Retry with Exponential Backoff

**Description:** Retries use exponential backoff

**BeTrace DSL:**
```javascript
trace.has(http.retry).where(attempt == 1 and delay_ms < 1000)
  and trace.has(http.retry).where(attempt == 2 and delay_ms >= 1000)
```

**When to use:**
- External API calls
- Database connection retries
- Distributed system operations

**Common violations:**
- Fixed retry delay (overwhelms downstream)
- Unlimited retries (resource exhaustion)
- No jitter (thundering herd)

---

### 72. Max Retry Limit

**Description:** Retries respect maximum attempts

**BeTrace DSL:**
```javascript
trace.count(http.retry) > 5
```

---

### 73. Error Logging

**Description:** Errors must be logged

**BeTrace DSL:**
```javascript
trace.has(error.occurred)
  and trace.has(error.logged)
```

---

### 74. Error Alerting

**Description:** Critical errors trigger alerts

**BeTrace DSL:**
```javascript
trace.has(error.occurred).where(severity == critical)
  and trace.has(alert.sent)
```

---

### 75. Transaction Rollback

**Description:** Failed transactions rollback

**BeTrace DSL:**
```javascript
trace.has(transaction.failed)
  and trace.has(transaction.rollback)
```

---

### 76. Partial Failure Handling

**Description:** Partial failures have fallback

**BeTrace DSL:**
```javascript
trace.has(operation.partial_failure)
  and trace.has(fallback.executed)
```

---

### 77. Dead Letter Queue

**Description:** Failed messages move to DLQ

**BeTrace DSL:**
```javascript
trace.has(message.processing_failed)
  and trace.has(dlq.enqueued)
```

---

### 78. Health Check Response

**Description:** Health checks reflect service state

**BeTrace DSL:**
```javascript
trace.has(health_check.request)
  and trace.has(health_check.response)
```

---

### 79. Idempotency Key Usage

**Description:** Operations use idempotency keys

**BeTrace DSL:**
```javascript
trace.has(operation.execute).where(idempotent == true)
  and trace.has(idempotency_key.generated)
```

---

### 80. Compensation Transaction

**Description:** Failed distributed transactions compensate

**BeTrace DSL:**
```javascript
trace.has(distributed_transaction.failed)
  and trace.has(compensation.executed)
```

---

## Usage Guide

### 1. Find Relevant Template

Search by category or use case

### 2. Copy BeTrace DSL

Copy template code to your rules file

### 3. Customize

Adjust attributes, thresholds to your system

**Example customization:**
```javascript
// Template
trace.has(payment.charge).where(amount > 1000)
  and trace.has(payment.fraud_check)

// Customized for your system
trace.has(payment.charge).where(amount > 500 and currency == USD)
  and trace.has(fraud.stripe_radar_check)
```

### 4. Add Instrumentation

Copy instrumentation example, adapt to your language/framework

### 5. Deploy and Test

Deploy rule, verify in staging, then production

---

## Next Steps

**Learn more:**
- [Understanding Invariants](../understanding-invariants.md)
- [Invariant-Driven Development](../invariant-driven-development.md)
- [Domain-Specific Playbooks](../playbooks/README.md)

**Try BeTrace:**
- [Quick Start Guide](../../../docs/QUICK_START.md)
- [BeTrace DSL Reference](../../../docs/technical/trace-rules-dsl.md)

---

**Questions?**
- [GitHub Issues](https://github.com/betracehq/fluo/issues)
- Email: hello@fluo.com
