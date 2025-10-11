# FLUO Trace-Level Rules DSL

## Overview

FLUO's DSL allows SREs, developers, and compliance operators to define **invariants** that should always hold true across distributed traces. The DSL is designed to feel natural and ubiquitous - reading like assertions you'd say during an incident.

## Design Philosophy

**Simple, readable invariant assertions:**
- No unnecessary quotes (identifiers don't need quotes)
- Natural operators (`and`, `or`, `not`)
- Clear separation: `has()` checks existence, `where()` filters attributes
- Powered by Drools Fusion under the hood (users never see Drools)

## Core Syntax

### Operators

```javascript
and    // conjunction - both conditions must be true
or     // disjunction - either condition must be true
not    // negation - condition must be false
```

### Functions

```javascript
// Check if trace contains a span with given operation name
trace.has(operation_name)

// Filter spans by attribute conditions
trace.has(operation_name).where(attribute comparison value)

// Count spans matching pattern
trace.count(operation_pattern)
```

### Comparison Operators

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

## Examples

### Basic Existence Checks

```javascript
// Payment must have fraud check
trace.has(payment.charge_card) and trace.has(payment.fraud_check)

// PII access must have audit log
trace.has(database.query_pii) and trace.has(audit.log)

// API requests need authentication
trace.has(api.request) and trace.has(auth.validate)
```

### Attribute Filtering

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

### Multiple Conditions

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

### Negation (Absence Detection)

```javascript
// Detect missing fraud check
trace.has(payment.charge_card) and not trace.has(payment.fraud_check)

// Ensure no errors occurred
trace.has(transaction.complete) and not trace.has(error)
```

### Span Counting

```javascript
// Too many retries
trace.count(http.retry) > 3

// Request/response mismatch
trace.count(http.request) != trace.count(http.response)
```

## Rule Definition Format

Rules are defined in YAML for familiarity (like Prometheus alerts):

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

  - id: admin-endpoints-require-auth
    name: "Admin endpoints need admin authorization"
    severity: critical
    condition: |
      trace.has(api.request).where(endpoint matches "/api/v1/admin/.*")
      and trace.has(auth.check_admin)
```

## Grammar

```
rule := condition

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

## Implementation Architecture

```
┌─────────────────────────────────────┐
│  FLUO DSL (User-facing)             │
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

## Translation Example

**FLUO DSL:**
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

## Use Cases by Role

### SRE: Undocumented Invariant Discovery
Capture invariants discovered during incidents:
```javascript
// "We had an incident where payments were processed without fraud checks"
trace.has(payment.charge_card) and trace.has(payment.fraud_check)
```

### Developer: Contract Violation Detection
Define API contracts that must be honored:
```javascript
// "Clients must validate API keys before accessing PII"
trace.has(database.query_pii) and trace.has(api.validate_key)
```

### Compliance: Control Effectiveness Validation
Prove compliance controls work in production:
```javascript
// "SOC2 CC6.7: PII access must be logged"
trace.has(pii.access) and trace.has(audit.log)
```

## Next Steps

1. Implement DSL parser (ANTLR or hand-written)
2. Build Drools DRL generator
3. Create TenantSessionManager for per-tenant KieSessions
4. Integrate with span ingestion pipeline
5. Add Signal generation when rules fire
