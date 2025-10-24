# BeTraceDSL Example Rules Library

This directory contains comprehensive example rules demonstrating BeTrace's behavioral pattern matching capabilities across three core use cases:

## Files

### 1. [ai-agent-safety.yaml](./ai-agent-safety.yaml)
**Purpose**: Enterprise AI safety monitoring based on the International AI Safety Report (January 2025)

**Key Rules**:
- **AI Agent Monitoring** (13 rules)
  - Goal deviation detection (`ai-agent-goal-deviation`)
  - Prompt injection detection (`ai-agent-prompt-injection`)
  - Unauthorized tool use (`ai-agent-unauthorized-tool-use`)
  - Delegation boundary violations (`ai-agent-delegation-boundary`)

- **Hallucination Detection** (3 rules)
  - Medical diagnosis requires citations (`ai-hallucination-medical-citation`)
  - Low confidence claims need disclosure (`ai-hallucination-low-confidence`)
  - Financial advice requires verification (`ai-financial-advice-verification`)

- **Bias Detection** (1 rule)
  - Statistical anomaly detection in hiring (`ai-bias-hiring-decision`)

- **Loss of Control Precursors** (2 rules)
  - Unauthorized access attempts (`ai-loss-of-control-unauthorized-access`)
  - Oversight evasion detection (`ai-oversight-evasion`)

- **Dual-Use Capability Detection** (2 rules)
  - Cyber reconnaissance (`ai-dual-use-cyber-recon`)
  - Dangerous synthesis queries (`ai-dual-use-dangerous-synthesis`)

**Use Cases**:
- Healthcare clinical decision support
- Financial services loan approval AI
- Legal research agents
- Customer service agents

### 2. [compliance-evidence.yaml](./compliance-evidence.yaml)
**Purpose**: Compliance framework evidence generation and validation

**Frameworks Covered**:
- **SOC2** (6 rules) - Trust Service Criteria (CC6.1, CC6.6, CC7.2, CC8.1)
- **HIPAA** (4 rules) - Technical Safeguards (164.312(a), 164.312(b), encryption)
- **FedRAMP** (2 rules) - Access Control (AC-2), Audit Events (AU-2)
- **PCI-DSS** (2 rules) - Access Control (7.1), Audit Trail (10.2)
- **GDPR** (2 rules) - Security of Processing (Article 32), Automated Decisions (Article 22)
- **ISO27001** (1 rule) - User Registration (A.9.2.1)
- **BeTrace Security** (1 rule) - Compliance span signature verification

**Key Rules**:
- PII access requires authorization (`soc2-cc6-1-pii-access-authorization`)
- PHI access must be audited (`hipaa-164-312-b-audit-controls`)
- Encryption at rest for sensitive data (`soc2-cc6-6-encryption-at-rest`)
- Change management controls (`soc2-cc8-1-change-management`)
- Cardholder data access control (`pci-dss-7-1-access-control`)

**Use Cases**:
- Healthcare systems (HIPAA)
- Financial services (PCI-DSS, SOC2)
- Government systems (FedRAMP)
- SaaS platforms (SOC2, GDPR)

### 3. [reliability-sre.yaml](./reliability-sre.yaml)
**Purpose**: SRE best practices and operational reliability

**Categories**:
- **Business Logic Invariants** (2 rules)
  - Payment fraud checks (`payment-fraud-check-required`)
  - API key validation (`api-key-validation-missing`)

- **Error Detection** (2 rules)
  - HTTP 5xx error logging (`http-500-error-logging`)
  - Cascading failure detection (`cascading-failure-detection`)

- **Performance Monitoring** (5 rules)
  - Database query timeout (`database-query-timeout`)
  - Latency SLA violations (`latency-sla-violation`)
  - Cross-region latency (`multi-region-latency`)
  - Connection pool exhaustion (`connection-pool-exhaustion`)
  - Memory leak detection (`memory-leak-detection`)

- **Failure Detection** (8 rules)
  - Excessive API retries (`api-excessive-retries`)
  - Request/response mismatch (`request-response-mismatch`)
  - Circuit breaker tripped (`circuit-breaker-tripped`)
  - Cache stampede (`cache-stampede-detection`)
  - Deadlock detection (`deadlock-detection`)
  - Queue depth overflow (`queue-depth-overflow`)

- **Security** (2 rules)
  - Admin endpoint authorization (`admin-endpoint-authorization`)
  - Rate limit exceeded (`rate-limit-exceeded`)

**Use Cases**:
- E-commerce payment processing
- High-throughput API services
- Microservices architectures
- Real-time trading platforms

## Rule Format

Each rule follows this structure:

```yaml
rules:
  - id: unique-rule-identifier
    name: "Human-Readable Rule Name"
    description: |
      Multi-line description including:
      - What the rule detects
      - Why it matters (incident context, compliance requirement)
      - Reference to standards/reports if applicable
    severity: critical | high | medium | low
    compliance_frameworks:
      - Framework1
      - Framework2
    condition: |
      # BeTraceDSL expression
      trace.has(operation_name).where(attribute comparison value)
        and trace.has(required_operation)

    example_violation:
      description: "Concrete example of what triggers this rule"
      trace:
        - span: operation_name
          attributes:
            key: value
        # Additional spans showing violation pattern
```

## BeTraceDSL Syntax Quick Reference

### Basic Operators
```javascript
and    // Both conditions must be true
or     // Either condition must be true
not    // Condition must be false
```

### Functions
```javascript
trace.has(operation_name)                    // Check span exists
trace.has(operation).where(attr == value)    // Filter by attributes
trace.count(operation_pattern)               // Count matching spans
```

### Comparison Operators
```javascript
==     // Equal
!=     // Not equal
>      // Greater than
>=     // Greater than or equal
<      // Less than
<=     // Less than or equal
in     // In list: processor in [stripe, square]
matches // Regex match: endpoint matches "/api/v1/admin/.*"
```

### Example Patterns

**Existence Check**:
```javascript
trace.has(payment.charge) and trace.has(payment.fraud_check)
```

**Attribute Filtering**:
```javascript
trace.has(database.query).where(data.contains_pii == true)
  and trace.has(audit.log)
```

**Negation (Absence)**:
```javascript
trace.has(payment.charge) and not trace.has(payment.fraud_check)
```

**Counting**:
```javascript
trace.count(http.retry) > 3
```

**Multiple Conditions**:
```javascript
trace.has(payment.charge)
  .where(amount > 1000)
  .where(currency == USD)
  and trace.has(payment.fraud_check)
```

## Using These Rules

### 1. In BeTrace Backend

Rules can be loaded into BeTrace via:

```bash
# Using BeTrace CLI (future)
betrace rules import ai-agent-safety.yaml

# Or via API
curl -X POST http://localhost:12011/api/rules \
  -H "Content-Type: application/yaml" \
  --data-binary @ai-agent-safety.yaml
```

### 2. In Grafana Plugin

1. Navigate to **BeTrace > Rules**
2. Click **"Create Rule"**
3. Copy/paste rule condition from example files
4. Set name, description, severity
5. Click **"Save"**

### 3. Customizing Rules

**Adjust Thresholds**:
```javascript
# Original
trace.has(payment.charge).where(amount > 1000)

# Customize for your SLA
trace.has(payment.charge).where(amount > 500)
```

**Add Multiple Conditions**:
```javascript
# Original
trace.has(database.query).where(data.contains_pii == true)

# Add time-based filtering
trace.has(database.query)
  .where(data.contains_pii == true)
  .where(query_duration_ms > 100)
```

**Combine Multiple Rules**:
```javascript
# Payment + Compliance
trace.has(payment.charge).where(amount > 1000)
  and trace.has(payment.fraud_check)
  and trace.has(audit.log)  # Add compliance requirement
```

## Rule Statistics

| Category | Total Rules | Critical | High | Medium |
|----------|-------------|----------|------|--------|
| AI Agent Safety | 13 | 10 | 3 | 0 |
| Compliance Evidence | 17 | 9 | 7 | 1 |
| Reliability/SRE | 18 | 5 | 8 | 5 |
| **Total** | **48** | **24** | **18** | **6** |

## Implementation Status

✅ **DSL Syntax Defined** - All rules use valid BeTraceDSL syntax
✅ **Example Violations** - Each rule includes trace example showing violation
✅ **Compliance Mapping** - Rules mapped to SOC2, HIPAA, FedRAMP, etc.
⏸️ **Rule Engine Integration** - Requires Drools Fusion backend (PRD-005)
⏸️ **Grafana Plugin Loading** - Requires Rules page backend integration

## References

- **BeTraceDSL Reference**: [/docs/technical/trace-rules-dsl.md](/docs/technical/trace-rules-dsl.md)
- **AI Safety Report**: International Scientific Report on the Safety of Advanced AI (January 2025)
- **Compliance Frameworks**: [/docs/compliance.md](/docs/compliance.md)
- **SRE Best Practices**: Google SRE Book, DORA Metrics

## Contributing

When adding new rules:

1. **Choose category** - AI Safety, Compliance, or Reliability
2. **Follow format** - Include id, name, description, severity, condition, example_violation
3. **Add compliance mapping** - Link to specific framework controls
4. **Test DSL syntax** - Validate against [trace-rules-dsl.md](/docs/technical/trace-rules-dsl.md)
5. **Include real-world context** - Why does this rule matter? What incident/requirement drove it?

## Questions?

- **DSL Syntax Help**: See [trace-rules-dsl.md](/docs/technical/trace-rules-dsl.md)
- **Compliance Questions**: See [compliance-status.md](/docs/compliance-status.md)
- **AI Safety Context**: See [AI-SAFETY-FOR-ENTERPRISE.md](/marketing/docs/AI-SAFETY-FOR-ENTERPRISE.md)
