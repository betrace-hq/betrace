# BeTraceDSL Syntax Reference

**Last Updated**: 2025-11-02
**Status**: ✅ VERIFIED - All examples tested and working

---

## Quick Reference

### Syntax Forms

```javascript
// 1. Span existence
payment

// 2. Direct attribute comparison
payment.amount > 1000

// 3. Attribute filter with .where()
payment.where(amount > 1000)

// 4. Counting spans
count(retry) > 3

// 5. Combining with and/or/not
payment.amount > 1000 and fraud_check
```

---

## Core Concepts

### Two Scoping Contexts

**Outside `.where()` - Global Scope (Span Names)**:
```javascript
payment              // Check if "payment" span exists
payment.amount > 1000   // Check "payment" span AND filter by amount
fraud_check          // Check if "fraud_check" span exists
```

**Inside `.where()` - Local Scope (Span Attributes)**:
```javascript
payment.where(amount > 1000)
//            ^^^^^^ - attribute of payment span (scoped)
```

### Key Insight

- `payment.amount > 1000` → "payment" is span name, "amount" is attribute
- `payment.where(amount > 1000)` → "payment" is span name, "amount" is attribute (scoped)
- Inside `.where()`, attributes refer to the parent span automatically

---

## Supported Syntax

### 1. Span Existence Check

```javascript
payment
fraud_check
database.query_pii
api.request
```

**Use case**: Verify a span exists in the trace.

### 2. Direct Attribute Comparison

```javascript
payment.amount > 1000
customer.tier == gold
http.status >= 500
endpoint matches "/admin/.*"
```

**Use case**: Check span exists AND filter by single attribute.

**Operators**: `==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `matches`

### 3. .where() Clause (Single Condition)

```javascript
payment.where(amount > 1000)
customer.where(tier == gold)
request.where(endpoint matches "/api/.*")
```

**Use case**: Same as direct comparison, alternative syntax.

**Current limitation**: Only single condition supported inside `.where()`.
**Planned**: Complex boolean expressions like `payment.where(amount > 1000 and currency == USD)`

###Human: I'm saying payment.where(x) should be thought of as payment.where(payment => payment.x)