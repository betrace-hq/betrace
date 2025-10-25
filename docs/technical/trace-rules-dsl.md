# BeTrace Trace-Level Rules DSL

## Overview

BeTrace's DSL allows SREs, developers, and compliance operators to define **invariants** that should always hold true across distributed traces. The DSL is designed to feel natural and ubiquitous - reading like assertions you'd say during an incident.

## Design Philosophy

**Simple, readable invariant assertions:**
- No unnecessary quotes (identifiers don't need quotes)
- Natural operators (`and`, `or`, `not`)
- Clear separation: `has()` checks existence, `where()` filters attributes
- Powered by Drools Fusion under the hood (users never see Drools)

## Core Syntax

### Rule Types

BeTrace supports two types of rules:

1. **Simple Conditions**: Direct trace invariant checks (backward compatible)
2. **Conditional Invariants**: When-then-always-never patterns (new)

### Simple Conditions

#### Operators

```javascript
and    // conjunction - both conditions must be true
or     // disjunction - either condition must be true
not    // negation - condition must be false
```

#### Functions

```javascript
// Check if trace contains a span with given operation name
trace.has(operation_name)

// Filter spans by attribute conditions
trace.has(operation_name).where(attribute comparison value)

// Count spans matching pattern
trace.count(operation_pattern)
```

#### Comparison Operators

```javascript
==     // equal
!=     // not equal
>      // greater than
>=     // greater than or equal
<      // less than
<=     // less than or equal
in     // in list
matches // regex match (value must be quoted)
```

### Conditional Invariants (When-Always-Never)

For expressing "when this condition is true, these things must always happen and these things must never happen":

```javascript
when { condition }
always { condition }  // optional, must be true when 'when' clause matches
never { condition }   // optional, must be false when 'when' clause matches
```

**Rules:**
- At least one of `always` or `never` must be present
- Both can be present together
- Conditions inside braces can use full DSL syntax (`and`, `or`, `not`)
- Braces `{ }` delimit when/always/never blocks
- Parentheses `( )` group conditions for precedence control

### Grouping with Parentheses

Use parentheses to control precedence and group conditions (just like math and programming):

```javascript
// Without parens: AND has higher precedence than OR
trace.has(a) or trace.has(b) and trace.has(c)
// Equivalent to: trace.has(a) or (trace.has(b) and trace.has(c))

// With parens: override precedence
(trace.has(a) or trace.has(b)) and trace.has(c)

// Nested grouping
((trace.has(a) or trace.has(b)) and trace.has(c)) or trace.has(d)

// NOT with grouping
not (trace.has(bypass) or trace.has(skip))

// In conditional invariants
when {
  trace.has(payment).where(amount > 1000) and
  (trace.has(customer.new) or not trace.has(customer.verified))
}
always {
  trace.has(fraud.check) and
  (trace.has(fraud.score).where(score < 0.3) or trace.has(manual.review))
}
```

## Examples

### Simple Condition Examples

#### Basic Existence Checks

```javascript
// Payment must have fraud check
trace.has(payment.charge_card) and trace.has(payment.fraud_check)

// PII access must have audit log
trace.has(database.query_pii) and trace.has(audit.log)

// API requests need authentication
trace.has(api.request) and trace.has(auth.validate)
```

#### Attribute Filtering

```javascript
// High-value payments require fraud check
trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)

// PII database queries need validation
trace.has(database.query).where(data.contains_pii == true)
  and trace.has(api.validate_key)

// Failed responses need error logging
trace.has(http.response).where(status >= 500)
  and trace.has(error.logged)

// Specific processors need extra validation
trace.has(payment.charge).where(processor in [stripe, square])
  and trace.has(payment.validate_merchant)

// Admin endpoints require admin check
trace.has(api.request).where(endpoint matches "/api/v1/admin/.*")
  and trace.has(auth.check_admin)
```

#### Multiple Conditions

```javascript
// Chain multiple where clauses on same span
trace.has(payment.charge_card)
  .where(amount > 1000)
  .where(currency == USD)
  and trace.has(payment.fraud_check)

// Multiple span checks
trace.has(database.query).where(data.contains_pii == true)
  and trace.has(api.validate_key)
  and trace.has(audit.log)
```

#### Negation (Absence Detection)

```javascript
// Detect missing fraud check
trace.has(payment.charge_card) and not trace.has(payment.fraud_check)

// Ensure no errors occurred
trace.has(transaction.complete) and not trace.has(error)
```

#### Span Counting

```javascript
// Too many retries
trace.count(http.retry) > 3

// Request/response mismatch
trace.count(http.request) != trace.count(http.response)
```

### Conditional Invariant Examples

#### Basic When-Always-Never

```javascript
// High-value payments must have fraud check and never bypass validation
when { trace.has(payment.charge_card).where(amount > 1000) }
always { trace.has(payment.fraud_check) }
never { trace.has(payment.bypass_validation) }

// PII access requires audit and auth, no external export
when { trace.has(database.query).where(data.contains_pii == true) }
always { trace.has(audit.log) and trace.has(auth.validate) }
never { trace.has(database.export_external) }

// Admin operations must have admin check, never bypass
when { trace.has(api.request).where(endpoint matches "/api/v1/admin/.*") }
always { trace.has(auth.check_admin) }
never { trace.has(auth.bypass) }
```

#### Always-Only (No Never Clause)

```javascript
// Transactions over $0 must always be audited
when { trace.has(transaction.commit).where(amount > 0) }
always { trace.has(transaction.audit_log) }

// Production deployments require approval and smoke test
when { trace.has(deployment.initiated).where(environment == production) }
always {
  trace.has(deployment.approval) and
  trace.has(deployment.smoke_test)
}
```

#### Never-Only (No Always Clause)

```javascript
// Free tier customers cannot access premium features
when { trace.has(api.request).where(customer.type == free_tier) }
never { trace.has(feature.premium_access) }

// Test environments should never process real payments
when { trace.has(payment.charge_card).where(environment == test) }
never { trace.has(payment.real_charge) }
```

#### Complex Multi-Condition Examples

```javascript
// Production deployments with full safety checks
when { trace.has(deployment.initiated).where(environment == production) }
always {
  trace.has(deployment.approval) and
  trace.has(deployment.smoke_test) and
  trace.has(deployment.backup_complete) and
  trace.has(deployment.rollback_plan)
}
never {
  trace.has(deployment.skip_validation) or
  trace.has(deployment.force_push) or
  trace.has(deployment.bypass_approval)
}

// Critical payment processing controls
when {
  trace.has(payment.charge_card)
    .where(amount > 10000)
    .where(customer.verification_level == unverified)
}
always {
  trace.has(payment.fraud_check) and
  trace.has(payment.manual_review) and
  trace.has(payment.risk_assessment)
}
never {
  trace.has(payment.auto_approve) or
  trace.has(payment.skip_verification)
}
```

## Rule Definition Format

Rules are defined in YAML for familiarity (like Prometheus alerts):

### Simple Condition Rules

```yaml
rules:
  - id: payment-fraud-check-required
    name: "Payment must include fraud check"
    description: "All payment charges over $1000 require fraud validation"
    severity: critical
    condition: |
      trace.has(payment.charge_card).where(amount > 1000)
      and trace.has(payment.fraud_check)

  - id: pii-access-requires-audit
    name: "PII access must be audited"
    description: "Database queries accessing PII must have corresponding audit logs"
    severity: high
    condition: |
      trace.has(database.query).where(data.contains_pii == true)
      and trace.has(audit.log_access)
```

### Conditional Invariant Rules

```yaml
rules:
  - id: high-value-payment-controls
    name: "High-value payment controls"
    description: "Payments over $1000 must have fraud check and never bypass validation"
    severity: critical
    condition: |
      when { trace.has(payment.charge_card).where(amount > 1000) }
      always { trace.has(payment.fraud_check) }
      never { trace.has(payment.bypass_validation) }

  - id: pii-access-controls
    name: "PII access requires audit and auth, no external export"
    severity: high
    condition: |
      when { trace.has(database.query).where(data.contains_pii == true) }
      always {
        trace.has(audit.log) and trace.has(auth.validate)
      }
      never {
        trace.has(database.export_external)
      }

  - id: production-deployment-safety
    name: "Production deployments require full safety checks"
    severity: critical
    condition: |
      when { trace.has(deployment.initiated).where(environment == production) }
      always {
        trace.has(deployment.approval) and
        trace.has(deployment.smoke_test) and
        trace.has(deployment.backup_complete)
      }
      never {
        trace.has(deployment.skip_validation) or
        trace.has(deployment.force_push)
      }

  - id: free-tier-restrictions
    name: "Free tier cannot access premium features"
    severity: medium
    condition: |
      when { trace.has(api.request).where(customer.type == free_tier) }
      never { trace.has(feature.premium_access) }
```

## Grammar

```
rule := conditional_invariant | condition  // backward compatible

conditional_invariant := when_clause always_clause? never_clause?
                       | when_clause never_clause? always_clause?
                       // At least one of always_clause or never_clause must be present

when_clause := "when" "{" condition "}"

always_clause := "always" "{" condition "}"

never_clause := "never" "{" condition "}"

condition := term (("and" | "or") term)*

term := "not"? span_check

span_check := "trace.has(" identifier ")" where_clause*
            | "trace.count(" identifier ")" comparison_op value

where_clause := ".where(" attribute_name comparison_op value ")"

comparison_op := "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "matches"

attribute_name := identifier

identifier := [a-zA-Z_][a-zA-Z0-9_.]*

value := identifier | number | boolean | string | list

string := '"' .* '"'  // Only for regex patterns and string literals

list := "[" identifier ("," identifier)* "]"

boolean := "true" | "false"

number := [0-9]+ ("." [0-9]+)?
```

### Semantic Validation Rules

The parser must enforce:

1. **At least one clause required**: Conditional invariants must have at least one `always` or `never` clause
2. **Both clauses allowed**: Can have both `always` and `never` together
3. **Order flexible**: `always` can come before or after `never`

```javascript
// ✅ Valid: has always
when { trace.has(payment) }
always { trace.has(fraud_check) }

// ✅ Valid: has never
when { trace.has(payment) }
never { trace.has(bypass) }

// ✅ Valid: has both (always first)
when { trace.has(payment) }
always { trace.has(fraud_check) }
never { trace.has(bypass) }

// ✅ Valid: has both (never first)
when { trace.has(payment) }
never { trace.has(bypass) }
always { trace.has(fraud_check) }

// ❌ Invalid: missing both always and never
when { trace.has(payment) }
// ERROR: Must have at least one 'always' or 'never' clause

// ❌ Invalid: when without braces
when trace.has(payment)
always { trace.has(fraud_check) }
// ERROR: 'when' clause must have braces

// ❌ Invalid: always without braces
when { trace.has(payment) }
always trace.has(fraud_check)
// ERROR: 'always' clause must have braces
```

## Implementation Architecture

```
┌─────────────────────────────────────┐
│  BeTrace DSL (User-facing)             │
│  trace.has(X) and trace.has(Y)      │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  DSL Parser & Validator             │
│  Parse → Validate → Optimize        │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Drools DRL Generator               │
│  Generate Drools rules from AST     │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Drools Fusion Engine               │
│  Pattern matching + State mgmt      │
│  (per-tenant KieSession)            │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Signal Generation                  │
│  Create Signal when rule fires      │
└─────────────────────────────────────┘
```

## Translation Examples

### Simple Condition Translation

**BeTrace DSL:**
```javascript
trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)
```

**Generated Drools DRL:**
```java
rule "payment-fraud-check-required"
when
    $charge: Span(
        operationName == "payment.charge_card",
        attributes["amount"] > 1000,
        $traceId: traceId
    )
    not Span(
        operationName == "payment.fraud_check",
        traceId == $traceId
    )
then
    signalService.createSignal(
        $charge,
        "payment-fraud-check-required",
        "Payment charged without fraud check"
    );
end
```

### Conditional Invariant Translation

**BeTrace DSL:**
```javascript
when { trace.has(payment.charge_card).where(amount > 1000) }
always { trace.has(payment.fraud_check) }
never { trace.has(payment.bypass_validation) }
```

**Generated Drools DRL:**
```java
rule "high-value-payment-controls"
when
    // Triggering condition (when clause)
    $trigger: Span(
        operationName == "payment.charge_card",
        attributes["amount"] > 1000,
        $traceId: traceId
    )

    // Violation exists if ANY of these are true:
    (
        // ALWAYS violation: required span is missing
        not Span(
            operationName == "payment.fraud_check",
            traceId == $traceId
        )
    ) or (
        // NEVER violation: forbidden span exists
        exists Span(
            operationName == "payment.bypass_validation",
            traceId == $traceId
        )
    )
then
    String violationType = "";
    if (!$trigger.getTrace().hasSpan("payment.fraud_check")) {
        violationType = "Missing required span: payment.fraud_check";
    }
    if ($trigger.getTrace().hasSpan("payment.bypass_validation")) {
        if (!violationType.isEmpty()) violationType += " AND ";
        violationType += "Forbidden span present: payment.bypass_validation";
    }

    signalService.createSignal(
        $trigger,
        "high-value-payment-controls",
        violationType
    );
end
```

### Complex Multi-Clause Translation

**BeTrace DSL:**
```javascript
when { trace.has(deployment.initiated).where(environment == production) }
always {
  trace.has(deployment.approval) and
  trace.has(deployment.smoke_test)
}
never {
  trace.has(deployment.skip_validation) or
  trace.has(deployment.force_push)
}
```

**Generated Drools DRL:**
```java
rule "production-deployment-safety"
when
    $trigger: Span(
        operationName == "deployment.initiated",
        attributes["environment"] == "production",
        $traceId: traceId
    )

    // Violation if any always condition is missing OR any never condition exists
    (
        // ALWAYS violations
        not Span(
            operationName == "deployment.approval",
            traceId == $traceId
        )
        or
        not Span(
            operationName == "deployment.smoke_test",
            traceId == $traceId
        )
    ) or (
        // NEVER violations
        exists Span(
            operationName == "deployment.skip_validation",
            traceId == $traceId
        )
        or
        exists Span(
            operationName == "deployment.force_push",
            traceId == $traceId
        )
    )
then
    List<String> violations = new ArrayList<>();

    if (!$trigger.getTrace().hasSpan("deployment.approval")) {
        violations.add("Missing: deployment.approval");
    }
    if (!$trigger.getTrace().hasSpan("deployment.smoke_test")) {
        violations.add("Missing: deployment.smoke_test");
    }
    if ($trigger.getTrace().hasSpan("deployment.skip_validation")) {
        violations.add("Forbidden: deployment.skip_validation");
    }
    if ($trigger.getTrace().hasSpan("deployment.force_push")) {
        violations.add("Forbidden: deployment.force_push");
    }

    signalService.createSignal(
        $trigger,
        "production-deployment-safety",
        String.join(", ", violations)
    );
end
```

## Use Cases by Role

### SRE: Undocumented Invariant Discovery

**Simple Conditions** - Capture invariants discovered during incidents:
```javascript
// "We had an incident where payments were processed without fraud checks"
trace.has(payment.charge_card) and trace.has(payment.fraud_check)
```

**Conditional Invariants** - Express complex operational requirements:
```javascript
// "During the incident, we found high-value payments bypassed fraud checks"
when { trace.has(payment.charge_card).where(amount > 1000) }
always { trace.has(payment.fraud_check) }
never { trace.has(payment.bypass_validation) }
```

### Developer: Contract Violation Detection

**Simple Conditions** - Define API contracts:
```javascript
// "Clients must validate API keys before accessing PII"
trace.has(database.query_pii) and trace.has(api.validate_key)
```

**Conditional Invariants** - Express context-dependent requirements:
```javascript
// "Admin endpoints require admin authorization, never allow bypass"
when { trace.has(api.request).where(endpoint matches "/api/v1/admin/.*") }
always { trace.has(auth.check_admin) }
never { trace.has(auth.bypass) }
```

### Compliance: Control Effectiveness Validation

**Simple Conditions** - Prove basic compliance controls:
```javascript
// "SOC2 CC6.7: PII access must be logged"
trace.has(pii.access) and trace.has(audit.log)
```

**Conditional Invariants** - Express regulatory requirements:
```javascript
// "GDPR Article 32: PII processing requires specific controls"
when { trace.has(database.query).where(data.contains_pii == true) }
always {
  trace.has(audit.log) and
  trace.has(auth.validate) and
  trace.has(encryption.verify)
}
never {
  trace.has(database.export_external) or
  trace.has(processing.unencrypted)
}
```

## Key Benefits of Conditional Invariants

### 1. Clearer Intent
```javascript
// Before (implicit context in condition)
trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)

// After (explicit context separation)
when { trace.has(payment.charge_card).where(amount > 1000) }
always { trace.has(payment.fraud_check) }
```

### 2. Express Prohibitions
```javascript
// Hard to express with simple conditions - requires double negation
// Simple: "if high-value payment, then NOT (has charge AND NOT has fraud check)"

// Easy with conditional invariants - direct expression
when { trace.has(payment.charge_card).where(amount > 1000) }
never { trace.has(payment.bypass_validation) }
```

### 3. Multi-Requirement Clarity
```javascript
// Before (long conjunction, hard to parse)
trace.has(deployment).where(env == production)
  and trace.has(approval)
  and trace.has(smoke_test)
  and not trace.has(skip_validation)
  and not trace.has(force_push)

// After (grouped by semantic meaning)
when { trace.has(deployment).where(env == production) }
always {
  trace.has(approval) and
  trace.has(smoke_test)
}
never {
  trace.has(skip_validation) or
  trace.has(force_push)
}
```

### 4. Better Error Messages
When a conditional invariant fires, the signal can include:
- **Triggering context**: "High-value payment detected (amount: $5000)"
- **Missing always**: "Missing required spans: fraud_check, manual_review"
- **Present never**: "Forbidden spans detected: bypass_validation"

## Next Steps

1. Implement DSL parser with conditional invariant support (ANTLR or hand-written)
2. Extend Drools DRL generator for when-always-never patterns
3. Add semantic validation (at least one always/never required)
4. Create TenantSessionManager for per-tenant KieSessions
5. Integrate with span ingestion pipeline
6. Enhance Signal generation with detailed violation messages
