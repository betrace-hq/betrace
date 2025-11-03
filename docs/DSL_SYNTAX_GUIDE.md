# BeTraceDSL Syntax Guide

**Last Updated**: 2025-11-02
**Status**: ✅ AUTHORITATIVE - Reflects current parser implementation

This guide explains BeTraceDSL syntax, including when to use direct comparisons vs `.where()` clauses.

---

## Core Syntax Forms

### 1. Simple Existence Check

Check if a span with a given operation name exists in the trace.

```javascript
payment
fraud_check
database.query_pii
```

**When to use**: Verifying that a specific operation occurred.

**Examples**:
```javascript
// Payment requires fraud check
when { payment }
always { fraud_check }

// PII access requires audit
when { database.query_pii }
always { audit.log }
```

---

### 2. Direct Attribute Comparison

Compare an attribute value directly using dotted path syntax.

```javascript
payment.amount > 1000
customer.tier == gold
http.status >= 500
processor in [stripe, square]
endpoint matches "/admin/.*"
```

**When to use**: Single attribute comparison on a span.

**Supported operators**: `==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `matches`

**Examples**:
```javascript
// High-value payments need extra checks
when { payment.amount > 1000 }
always { fraud_check and manual_review }

// Failed requests need error logging
when { http.response.status >= 500 }
always { error.logged }

// Admin endpoints require admin auth
when { api.request.endpoint matches "/api/v1/admin/.*" }
always { auth.check_admin }
```

**Limitations**:
- Only ONE direct comparison per span check
- Cannot chain multiple attribute comparisons with `and`/`or`

```javascript
// ❌ INVALID: Multiple direct comparisons
payment.amount > 1000 and payment.currency == USD  // Parser error!

// ✅ VALID: Use .where() for complex predicates (future enhancement)
// OR separate into multiple span checks
payment.amount > 1000 and approved_payment
```

---

### 3. .where() Clause (Complex Predicates)

Use `.where()` when you need complex predicates on span attributes.

**Current Status**: `.where()` supports single comparisons (same as direct syntax).

**Future Enhancement**: Will support complex boolean expressions inside where clause.

```javascript
// Current (single condition)
payment.where(amount > 1000)

// Future (complex predicates)
payment.where(amount > 1000 and currency == USD)
payment.where((amount > 1000 or vip_customer) and country != US)
```

**When to use**: Reserved for future complex attribute logic.

**Current recommendation**: Use direct comparison syntax for now.

---

### 4. Counting Spans

Count how many spans matching a pattern exist in the trace.

```javascript
count(operation_name) > N
count(operation_name) == N
count(operation_name) <= N
```

**Examples**:
```javascript
// Too many retries
when { payment }
always { count(http.retry) <= 3 }

// Request/response balance
count(http.request) == count(http.response)

// At least one fraud check
count(fraud_check) > 0
```

---

## Logical Operators

### AND (conjunction)

Both conditions must be true.

```javascript
payment and fraud_check
payment.amount > 1000 and fraud_check
api.request and auth.validate
```

### OR (disjunction)

Either condition must be true.

```javascript
payment or refund
auth.admin or auth.superuser
```

### NOT (negation)

Condition must be false (span must NOT exist).

```javascript
not bypass_validation
payment and not fraud_check
not test_environment
```

### Grouping with Parentheses

Control precedence with parentheses.

```javascript
(a or b) and c
not (bypass or skip)
(payment.amount > 1000 or vip_customer) and fraud_check
```

**Operator precedence** (highest to lowest):
1. Parentheses `()`
2. NOT
3. AND
4. OR

---

## When-Always-Never Pattern

Express conditional invariants: "When X happens, Y must always occur and Z must never occur."

```javascript
when { condition }
always { required_condition }
never { forbidden_condition }
```

**Rules**:
- `when` clause is required
- At least one of `always` or `never` must be present
- Both `always` and `never` can be present together
- Order of `always`/`never` doesn't matter

**Examples**:

### Always-only (no never clause)
```javascript
when { deployment.env == production }
always { approval and smoke_test }
```

### Never-only (no always clause)
```javascript
when { customer.tier == free }
never { premium_feature }
```

### Both always and never
```javascript
when { payment.amount > 1000 }
always { fraud_check }
never { bypass_validation }
```

---

## Syntax Decision Tree

**"How do I express my rule?"**

```
Do you need to check if a span exists?
├─ YES → Use operation name: `payment`
│
├─ Do you need to filter by ONE attribute?
│  ├─ YES → Use direct comparison: `payment.amount > 1000`
│  │
│  └─ Do you need to combine MULTIPLE attribute checks on SAME span?
│     └─ Future: Use .where() (not yet supported)
│        Current workaround: Split into separate rules or use span naming
│
└─ Do you need to check MULTIPLE different spans?
   └─ YES → Use and/or: `payment and fraud_check`
```

---

## Complete Examples

### SRE: Incident Prevention

```javascript
// Retry circuit breaker
when { external_api.call.latency > 5000 }
always { count(retry) <= 3 }
never { circuit_breaker.bypassed }
```

### Compliance: Control Validation

```javascript
// GDPR: PII access requires audit and auth
when { database.query.contains_pii == true }
always { audit.log and auth.validate }
never { export_external }
```

### Security: Authorization Enforcement

```javascript
// Admin operations require admin check, never bypass
when { api.request.endpoint matches "/admin/.*" }
always { auth.check_admin }
never { auth.bypass or role.override }
```

### Developer: API Contract

```javascript
// High-value payments need multi-step validation
when { payment.amount > 10000 }
always {
  fraud_check and
  risk_assessment and
  (fraud_score.score < 0.3 or manual_review)
}
never {
  auto_approve or
  skip_verification
}
```

---

## Common Patterns

### Pattern: "A requires B"

```javascript
when { A }
always { B }
```

### Pattern: "A must not have B"

```javascript
when { A }
never { B }
```

### Pattern: "High-risk operation needs safeguards"

```javascript
when { risky_operation.where(risk_level > threshold) }
always { safeguard1 and safeguard2 }
never { bypass or override }
```

### Pattern: "Counting violations"

```javascript
// No more than N failures
count(operation.failed) <= N

// Balanced operations
count(lock_acquired) == count(lock_released)
```

### Pattern: "Conditional on attribute value"

```javascript
when { request.endpoint matches "/api/.*" }
always { rate_limit_check }

when { user.account_type == premium }
always { feature_access }
```

---

## Syntax Limitations & Workarounds

### Limitation 1: Multiple Attribute Comparisons on Same Span

**Problem**: Cannot do `payment.amount > 1000 and payment.currency == USD`

**Why**: Parser greedily consumes dotted identifiers before checking for comparison operators.

**Workarounds**:
1. **Wait for .where() enhancement** (coming soon):
   ```javascript
   payment.where(amount > 1000 and currency == USD)
   ```

2. **Use span naming in instrumentation**:
   ```javascript
   // Instrument: emit span "payment.high_value_usd" when both conditions true
   when { payment.high_value_usd }
   always { fraud_check }
   ```

3. **Chain with existence checks**:
   ```javascript
   // Check amount, then verify currency via separate span
   when { payment.amount > 1000 and payment_currency_usd }
   always { fraud_check }
   ```

### Limitation 2: Complex Predicates in .where()

**Problem**: `.where()` currently only supports single comparisons.

**Why**: WhereFilter struct doesn't yet support nested boolean expressions.

**Workaround**: Use top-level `and`/`or` to combine multiple span checks:
```javascript
// Instead of: payment.where(amount > 1000 and status == pending)
// Do:
payment.amount > 1000 and payment_pending
```

---

## Grammar Reference

```
rule := when_clause always_clause? never_clause?

when_clause := "when" "{" condition "}"
always_clause := "always" "{" condition "}"
never_clause := "never" "{" condition "}"

condition := or_term ("or" or_term)*
or_term := and_term ("and" and_term)*
and_term := "not"? term
term := "(" condition ")" | span_check

span_check := count_check | has_check

count_check := "count" "(" operation_name ")" comparison_op value

has_check := operation_name (direct_comparison | where_clause)?

operation_name := ident ("." ident)*
direct_comparison := comparison_op value
where_clause := "." "where" "(" attribute comparison_op value ")"

comparison_op := "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "matches"

attribute := ident ("." ident)*
value := number | string | boolean | ident | list
```

---

## Best Practices

1. **Start simple**: Verify span exists before adding attribute filters
   ```javascript
   // Step 1: Verify span exists
   payment

   // Step 2: Add attribute filter
   payment.amount > 1000

   // Step 3: Add requirements
   when { payment.amount > 1000 }
   always { fraud_check }
   ```

2. **Use meaningful operation names**: Instrument spans with descriptive names
   ```javascript
   // Good: Semantic operation names
   payment.charge_card
   database.query_pii
   auth.check_admin

   // Bad: Generic names
   operation1
   api_call
   db_query
   ```

3. **Prefer direct comparison over .where()** (for now):
   ```javascript
   // Preferred
   payment.amount > 1000

   // Also valid, but more verbose
   payment.where(amount > 1000)
   ```

4. **Document intent**: Add comments in YAML rule definitions
   ```yaml
   rules:
     - id: payment-fraud-check
       name: "High-value payments require fraud check"
       description: |
         Discovered during incident PID-2024-03 where $50K
         fraudulent charge succeeded without fraud validation.
       condition: |
         when { payment.amount > 1000 }
         always { fraud_check }
   ```

---

## Future Enhancements

**Planned features** (not yet implemented):

1. **Complex predicates in .where()**:
   ```javascript
   payment.where(amount > 1000 and (currency == USD or currency == EUR))
   ```

2. **Attribute path references**:
   ```javascript
   request.user_id == response.user_id  // Cross-span attribute comparison
   ```

3. **Temporal ordering**:
   ```javascript
   payment before fraud_check  // Temporal relationship
   ```

4. **Duration constraints**:
   ```javascript
   payment.duration > 5000  // Milliseconds
   ```

---

## Reference Documentation

- **Technical DSL docs**: [docs/technical/trace-rules-dsl.md](technical/trace-rules-dsl.md)
- **DSL skill guide**: [.skills/betrace-dsl/SKILL.md](../.skills/betrace-dsl/SKILL.md)
- **How to explain BeTrace**: [docs/HOW_TO_EXPLAIN_BETRACE.md](HOW_TO_EXPLAIN_BETRACE.md)
- **Parser implementation**: [backend/internal/dsl/parser.go](../backend/internal/dsl/parser.go)

---

**Last Updated**: 2025-11-02
**Next Review**: When `.where()` complex predicates are implemented
