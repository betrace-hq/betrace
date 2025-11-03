# BeTrace Trace-Level Rules DSL

## Overview

BeTrace's DSL allows SREs, developers, and compliance operators to define **invariants** that should always hold true across distributed traces. The DSL is designed to feel natural and ubiquitous - reading like assertions you'd say during an incident.

## Design Philosophy

**Simple, readable invariant assertions:**
- No unnecessary quotes (identifiers don't need quotes)
- Natural operators (`and`, `or`, `not`)
- Clear separation: `has()` checks existence, `where()` filters attributes
- Compiled to AST and evaluated in Go backend (< 1ms per trace)

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
// Check if trace contains a span with given operation name (implicit has)
operation_name

// Filter spans by attribute conditions
operation_name.where(attribute comparison value)

// Count spans matching pattern
count(operation_pattern)
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
a or b and c
// Equivalent to: a or (b and c)

// With parens: override precedence
(a or b) and c

// Nested grouping
((a or b) and c) or d

// NOT with grouping
not (bypass or skip)

// In conditional invariants
when {
  payment.where(amount > 1000) and
  (customer.new or not customer.verified)
}
always {
  fraud.check and
  (fraud.score.where(score < 0.3) or manual.review)
}
```

## Examples

### Simple Condition Examples

#### Basic Existence Checks

```javascript
// Payment must have fraud check
payment.charge_card and payment.fraud_check

// PII access must have audit log
database.query_pii and audit.log

// API requests need authentication
api.request and auth.validate
```

#### Attribute Filtering

```javascript
// High-value payments require fraud check
payment.charge_card.where(amount > 1000) and payment.fraud_check

// PII database queries need validation
database.query.where(data.contains_pii == true) and api.validate_key

// Failed responses need error logging
http.response.where(status >= 500) and error.logged

// Specific processors need extra validation
payment.charge.where(processor in [stripe, square]) and payment.validate_merchant

// Admin endpoints require admin check
api.request.where(endpoint matches "/api/v1/admin/.*") and auth.check_admin
```

#### Multiple Conditions

```javascript
// Chain multiple where clauses on same span
payment.charge_card.where(amount > 1000).where(currency == USD)
  and payment.fraud_check

// Multiple span checks
database.query.where(data.contains_pii == true)
  and api.validate_key
  and audit.log
```

#### Negation (Absence Detection)

```javascript
// Detect missing fraud check
payment.charge_card and not payment.fraud_check

// Ensure no errors occurred
transaction.complete and not error
```

#### Span Counting

```javascript
// Too many retries
count(http.retry) > 3

// Request/response mismatch
count(http.request) != count(http.response)
```

### Conditional Invariant Examples

#### Basic When-Always-Never

```javascript
// High-value payments must have fraud check and never bypass validation
when { payment.charge_card.where(amount > 1000) }
always { payment.fraud_check }
never { payment.bypass_validation }

// PII access requires audit and auth, no external export
when { database.query.where(data.contains_pii == true) }
always { audit.log and auth.validate }
never { database.export_external }

// Admin operations must have admin check, never bypass
when { api.request.where(endpoint matches "/api/v1/admin/.*") }
always { auth.check_admin }
never { auth.bypass }
```

#### Always-Only (No Never Clause)

```javascript
// Transactions over $0 must always be audited
when { transaction.commit.where(amount > 0) }
always { transaction.audit_log }

// Production deployments require approval and smoke test
when { deployment.initiated.where(environment == production) }
always {
  deployment.approval and
  deployment.smoke_test
}
```

#### Never-Only (No Always Clause)

```javascript
// Free tier customers cannot access premium features
when { api.request.where(customer.type == free_tier) }
never { feature.premium_access }

// Test environments should never process real payments
when { payment.charge_card.where(environment == test) }
never { payment.real_charge }
```

#### Complex Multi-Condition Examples

```javascript
// Production deployments with full safety checks
when { deployment.initiated.where(environment == production) }
always {
  deployment.approval and
  deployment.smoke_test and
  deployment.backup_complete and
  deployment.rollback_plan
}
never {
  deployment.skip_validation or
  deployment.force_push or
  deployment.bypass_approval
}

// Critical payment processing controls
when {
  payment.charge_card
    .where(amount > 10000)
    .where(customer.verification_level == unverified)
}
always {
  payment.fraud_check and
  payment.manual_review and
  payment.risk_assessment
}
never {
  payment.auto_approve or
  payment.skip_verification
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
      payment.charge_card.where(amount > 1000)
      and payment.fraud_check

  - id: pii-access-requires-audit
    name: "PII access must be audited"
    description: "Database queries accessing PII must have corresponding audit logs"
    severity: high
    condition: |
      database.query.where(data.contains_pii == true)
      and audit.log_access
```

### Conditional Invariant Rules

```yaml
rules:
  - id: high-value-payment-controls
    name: "High-value payment controls"
    description: "Payments over $1000 must have fraud check and never bypass validation"
    severity: critical
    condition: |
      when { payment.charge_card.where(amount > 1000) }
      always { payment.fraud_check }
      never { payment.bypass_validation }

  - id: pii-access-controls
    name: "PII access requires audit and auth, no external export"
    severity: high
    condition: |
      when { database.query.where(data.contains_pii == true) }
      always {
        audit.log and auth.validate
      }
      never {
        database.export_external
      }

  - id: production-deployment-safety
    name: "Production deployments require full safety checks"
    severity: critical
    condition: |
      when { deployment.initiated.where(environment == production) }
      always {
        deployment.approval and
        deployment.smoke_test and
        deployment.backup_complete
      }
      never {
        deployment.skip_validation or
        deployment.force_push
      }

  - id: free-tier-restrictions
    name: "Free tier cannot access premium features"
    severity: medium
    condition: |
      when { api.request.where(customer.type == free_tier) }
      never { feature.premium_access }
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

span_check := "" identifier "" where_clause*
            | "count(" identifier ")" comparison_op value

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
when { payment }
always { fraud_check }

// ✅ Valid: has never
when { payment }
never { bypass }

// ✅ Valid: has both (always first)
when { payment }
always { fraud_check }
never { bypass }

// ✅ Valid: has both (never first)
when { payment }
never { bypass }
always { fraud_check }

// ❌ Invalid: missing both always and never
when { payment }
// ERROR: Must have at least one 'always' or 'never' clause

// ❌ Invalid: when without braces
when payment
always { fraud_check }
// ERROR: 'when' clause must have braces

// ❌ Invalid: always without braces
when { payment }
always fraud_check
// ERROR: 'always' clause must have braces
```

## Implementation Architecture

```
┌─────────────────────────────────────┐
│  BeTrace DSL (User-facing)          │
│  X and Y      │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  DSL Parser (Participle)            │
│  Parse → Build AST → Validate       │
│  backend/internal/dsl/parser.go     │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Rule Engine (Go)                   │
│  Compile → Cache AST                │
│  backend/internal/rules/engine.go   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Trace Evaluation                   │
│  Match spans against AST            │
│  < 1ms per trace evaluation         │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Violation Span Generation          │
│  Emit to Tempo when rule fires      │
└─────────────────────────────────────┘
```

## Implementation Details

### Parser (Participle)

The DSL is parsed using [Participle](https://github.com/alecthomas/participle), a parser library for Go:

```go
// backend/internal/dsl/parser.go
type Rule struct {
    When   *Condition `"when" "{" @@ "}"`
    Always *Condition `"always" "{" @@ "}"`
    Never  *Condition `("never" "{" @@ "}")?`
}

type Condition struct {
    Or []*AndExpr `@@ ("or" @@)*`
}
```

**Parser Performance:**
- Simple rules: 16μs
- Complex rules: 68μs
- Enterprise rules: 251μs
- Cached AST reused for all traces

payment.charge_card and payment.fraud_check
```

**Conditional Invariants** - Express complex operational requirements:
```javascript
// "During the incident, we found high-value payments bypassed fraud checks"
when { payment.charge_card.where(amount > 1000) }
always { payment.fraud_check }
never { payment.bypass_validation }
```

### Developer: Contract Violation Detection

**Simple Conditions** - Define API contracts:
```javascript
// "Clients must validate API keys before accessing PII"
database.query_pii and api.validate_key
```

**Conditional Invariants** - Express context-dependent requirements:
```javascript
// "Admin endpoints require admin authorization, never allow bypass"
when { api.request.where(endpoint matches "/api/v1/admin/.*") }
always { auth.check_admin }
never { auth.bypass }
```

### Compliance: Control Effectiveness Validation

**Simple Conditions** - Prove basic compliance controls:
```javascript
// "SOC2 CC6.7: PII access must be logged"
pii.access and audit.log
```

**Conditional Invariants** - Express regulatory requirements:
```javascript
// "GDPR Article 32: PII processing requires specific controls"
when { database.query.where(data.contains_pii == true) }
always {
  audit.log and
  auth.validate and
  encryption.verify
}
never {
  database.export_external or
  processing.unencrypted
}
```

## Key Benefits of Conditional Invariants

### 1. Clearer Intent
```javascript
// Before (implicit context in condition)
payment.charge_card.where(amount > 1000)
  and payment.fraud_check

// After (explicit context separation)
when { payment.charge_card.where(amount > 1000) }
always { payment.fraud_check }
```

### 2. Express Prohibitions
```javascript
// Hard to express with simple conditions - requires double negation
// Simple: "if high-value payment, then NOT (has charge AND NOT has fraud check)"

// Easy with conditional invariants - direct expression
when { payment.charge_card.where(amount > 1000) }
never { payment.bypass_validation }
```

### 3. Multi-Requirement Clarity
```javascript
// Before (long conjunction, hard to parse)
deployment.where(env == production)
  and approval
  and smoke_test
  and not skip_validation
  and not force_push

// After (grouped by semantic meaning)
when { deployment.where(env == production) }
always {
  approval and
  smoke_test
}
never {
  skip_validation or
  force_push
}
```

### 4. Better Error Messages
When a conditional invariant fires, the signal can include:
- **Triggering context**: "High-value payment detected (amount: $5000)"
- **Missing always**: "Missing required spans: fraud_check, manual_review"
- **Present never**: "Forbidden spans detected: bypass_validation"

## Next Steps

1. ✅ DSL parser with conditional invariants (Participle-based)
2. ✅ Rule engine evaluation (Go AST evaluator)
3. ⏸️ OTLP trace ingestion pipeline
4. ⏸️ Integrate rule evaluation with trace ingestion
5. ⏸️ Violation span emission to Tempo
6. ⏸️ Grafana alerting integration for violations
