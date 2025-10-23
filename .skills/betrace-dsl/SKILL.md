---
name: FLUO DSL Expert
description: Write, validate, and debug FLUO trace-level rules DSL for behavioral assurance patterns
---

# FLUO DSL Expert Skill

## Purpose

Write invariant rules using FLUO's trace-level DSL to match patterns in OpenTelemetry traces. Rules detect broken invariants (violations) that indicate:
- Missing security controls (PII access without audit logs)
- Undocumented system assumptions (payment without fraud check)
- API contract violations (client skips required validation)
- Compliance control failures (SOC2/HIPAA evidence missing)
- AI safety issues (agent goal deviation, hallucinations, bias)

## When to Use This Skill

**Load this skill when:**
- Writing new FLUO DSL rules for trace pattern matching
- Debugging validation errors in DSL syntax
- Optimizing rule performance or readability
- Understanding security limits (input size, recursion depth)
- Translating business requirements to DSL patterns
- Debugging Drools DRL generation issues

**Examples triggering this skill:**
- "Write a rule to detect payments without fraud checks"
- "Why is my DSL rule failing validation?"
- "How do I match spans with specific attributes?"
- "Create a compliance rule for SOC2 CC6.1"
- "Optimize this slow-running rule"

## Quick Reference

### Core Syntax

```javascript
// Basic pattern matching
trace.has(operation_name)

// Attribute filtering
trace.has(operation_name).where(attribute comparison value)

// Span counting
trace.count(operation_pattern) comparison value

// Logical operators
and    // both conditions must be true
or     // either condition must be true
not    // condition must be false
```

### Comparison Operators

```javascript
==     // equal
!=     // not equal
>      // greater than
>=     // greater than or equal
<      // less than
<=     // less than or equal
in     // in list [value1, value2, ...]
matches // regex match (pattern must be quoted)
```

### Common Patterns

```javascript
// Existence check: A requires B
trace.has(payment.charge_card) and trace.has(payment.fraud_check)

// Attribute filtering: High-value payments require fraud check
trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)

// Negation: Detect missing audit log
trace.has(database.query_pii) and not trace.has(audit.log)

// Counting: Too many retries
trace.count(http.retry) > 3

// Regex matching: Admin endpoints require admin auth
trace.has(api.request).where(endpoint matches "/api/v1/admin/.*")
  and trace.has(auth.check_admin)

// Multiple conditions: Chain where clauses
trace.has(payment.charge)
  .where(amount > 1000)
  .where(currency == USD)
  and trace.has(payment.fraud_check)
```

## Use Cases by Role

### SRE: Undocumented Invariants
Capture invariants discovered during incidents:

```javascript
// "We had an incident where retries exhausted connection pool"
trace.count(database.retry) > 10

// "Circuit breaker should have triggered but didn't"
trace.has(external_api.call).where(latency > 5000)
  and not trace.has(circuit_breaker.open)
```

### Developer: API Contract Enforcement
Define contracts that clients must honor:

```javascript
// "Clients must validate API keys before accessing PII"
trace.has(database.query).where(contains_pii == true)
  and trace.has(api.validate_key)

// "File uploads require virus scanning"
trace.has(file.upload) and trace.has(security.virus_scan)
```

### Compliance: Control Effectiveness
Prove compliance controls work in production:

```javascript
// SOC2 CC6.1: Authorization before data access
trace.has(data.access) and trace.has(auth.check)

// HIPAA 164.312(b): ePHI access must be audited
trace.has(ephi.access) and trace.has(audit.log)
```

### AI Safety: Behavioral Monitoring
Monitor AI system behavior in production:

```javascript
// Agent goal deviation detection
trace.has(agent.plan.created) and trace.has(agent.plan.executed)
  and trace.has(agent.goal_deviation).where(score > 0.7)

// Hallucination detection: Medical diagnosis requires citations
trace.has(medical.diagnosis) and not trace.has(source_citation)

// Bias detection: Approval rate statistical anomaly
trace.has(loan.approval_decision)
  and trace.has(bias.detected).where(confidence > 0.95)
```

## Security Limits (Why Rules Fail Validation)

FLUO enforces strict security limits to prevent DoS attacks:

| Limit | Value | Reason | Error Message |
|-------|-------|--------|---------------|
| **Total DSL size** | 64KB | Prevent memory exhaustion | "DSL expression exceeds maximum size" |
| **String literals** | 10KB | Prevent ReDoS attacks | "String literal exceeds maximum length" |
| **Identifiers** | 100 chars | Prevent abuse | "Identifier exceeds maximum length" |
| **Recursion depth** | 50 levels | Prevent stack overflow | "maximum nesting depth exceeded" |

**Common validation failures:**

```javascript
// ❌ String too long (> 10KB)
trace.has(x).where(data == "a".repeat(10001))

// ❌ Identifier too long (> 100 chars)
trace.has(very_long_identifier_that_exceeds_100_characters...)

// ❌ Too deeply nested (> 50 levels)
not not not not ... (51+ times) trace.has(x)

// ❌ DSL too large (> 64KB)
trace.has(x) and trace.has(y) and ... (thousands of conditions)
```

## Performance Expectations

| Input Size | Expected Parse Time (p95) |
|------------|---------------------------|
| < 1KB (typical) | < 1ms |
| 10KB (complex) | < 10ms |
| 64KB (max) | < 50ms |

**Slow rules indicate:**
- Excessive nesting (simplify with AND/OR instead of parentheses)
- Very long string literals (extract to separate where clauses)
- Complex regex patterns (simplify or use prefix matching)

## Integration with OpenTelemetry

Rules match against **span operation names** and **span attributes**:

```javascript
// Span structure (simplified):
{
  "name": "payment.charge_card",      // Operation name
  "traceId": "abc123...",             // Trace ID
  "attributes": {                     // Span attributes
    "amount": 1500,
    "currency": "USD",
    "processor": "stripe"
  }
}

// DSL rule:
trace.has(payment.charge_card)        // Matches span.name
  .where(amount > 1000)               // Matches span.attributes.amount
  .where(currency == USD)             // Matches span.attributes.currency
```

**Key insight**: `trace.has(X)` matches spans with `operationName == "X"`, NOT trace IDs or span IDs.

## Progressive Disclosure

For detailed information, consult supporting documentation:

- **@.skills/fluo-dsl/syntax-reference.md** - Complete grammar, all operators, data types
- **@.skills/fluo-dsl/pattern-library.md** - 50+ real-world patterns organized by use case
- **@.skills/fluo-dsl/validation-guide.md** - All validation errors with fixes
- **@.skills/fluo-dsl/translation-guide.md** - How DSL translates to Drools DRL

## Quick Debugging

### "Unexpected token" errors

```javascript
// ❌ Missing operator
trace.has(x) trace.has(y)
// ✅ Fixed
trace.has(x) and trace.has(y)

// ❌ Missing closing parenthesis
trace.has(x).where(amount > 1000
// ✅ Fixed
trace.has(x).where(amount > 1000)
```

### "Unknown function" errors

```javascript
// ❌ Wrong function name
trace.contains(x)
// ✅ Fixed (only has/count supported)
trace.has(x)

// ❌ Missing 'trace.' prefix
has(payment.charge)
// ✅ Fixed
trace.has(payment.charge)
```

### Validation passed but rule doesn't fire

**Common causes:**
1. **Span name mismatch** - Check actual OpenTelemetry span names
2. **Attribute name mismatch** - Verify attribute keys exist
3. **Type mismatch** - `amount == "1000"` (string) vs `amount == 1000` (number)
4. **Trace correlation issue** - Spans from different traces won't match

**Debug approach:**
```javascript
// Start simple, verify spans exist
trace.has(payment.charge_card)

// Add attribute filtering incrementally
trace.has(payment.charge_card).where(amount > 1000)

// Add second span check
trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)
```

## Best Practices

1. **Start simple** - Verify basic existence before adding attribute filters
2. **Use meaningful identifiers** - `payment.charge_card` not `op1`
3. **Chain where clauses** - `.where(x > 1).where(y == 2)` more readable than `.where(x > 1 and y == 2)` (latter not supported)
4. **Avoid deep nesting** - Use `and`/`or` instead of excessive parentheses
5. **Document intent** - Add comments in YAML rule definition explaining "why"

## Example: Complete Rule Definition

```yaml
rules:
  - id: payment-fraud-check-required
    name: "High-value payments require fraud check"
    description: |
      All credit card payments over $1000 must include fraud validation.
      Discovered during incident PID-2024-03 where $50K fraudulent charge succeeded.
    severity: critical
    enabled: true
    condition: |
      trace.has(payment.charge_card).where(amount > 1000)
        and trace.has(payment.fraud_check)
```

## Integration with FLUO's Purpose

FLUO's behavioral assurance system uses DSL rules to:

1. **SREs**: Discover undocumented invariants during incident investigation
2. **Developers**: Enforce API contracts and service assumptions
3. **Compliance**: Validate controls work in production (SOC2, HIPAA)
4. **AI Safety**: Monitor AI agent behavior, detect hallucinations/bias

Rules are **not alerts** - they define expected behavior. Violations generate **signals** for investigation.

## Summary

**FLUO DSL = Invariant Assertions for Distributed Traces**

- **Syntax**: Natural, readable (`trace.has(X) and trace.has(Y)`)
- **Purpose**: Detect broken invariants in production
- **Security**: Strict limits prevent DoS (64KB DSL, 10KB strings, 50-level nesting)
- **Performance**: < 10ms typical, < 50ms worst-case
- **Use Cases**: SRE incidents, API contracts, compliance, AI safety

When in doubt, start with the simplest rule that could work, then iterate based on actual trace data.
