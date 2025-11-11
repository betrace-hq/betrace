# DSL New Features

## Summary

Added three high-priority features to the BeTraceDSL parser:

1. ✅ **Chained `.where()` clauses**
2. ✅ **`contains` operator** for string matching
3. ✅ **Negation inside `.where()` clauses**

## 1. Chained Where Clauses

### Syntax

```javascript
payment.where(amount > 1000).where(currency == "USD")
```

### Why

Improves readability by separating concerns:

**Before:**
```javascript
// All conditions in one where clause
payment.where(amount > 1000 and currency == "USD" and verified == true)
```

**After:**
```javascript
// Logical grouping with chaining
payment
  .where(amount > 1000)
  .where(currency == "USD")
  .where(verified == true)
```

### Implementation

```go
type OpWithWhere struct {
    OpName        string         `@Ident "." "where"`
    Where         *WhereFilter   `"(" @@ ")"`
    ChainedWhere  []*WhereFilter `( "." "where" "(" @@ ")" )*`  // New!
}
```

### Examples

**Simple chaining:**
```javascript
when { payment.where(amount > 1000).where(currency == "USD") }
always { fraud_check }
```

**Triple chain:**
```javascript
when {
  payment
    .where(amount > 1000)
    .where(currency in ["USD", "EUR"])
    .where(verified == true)
}
```

**Multiple operations chained:**
```javascript
when {
  payment.where(amount > 1000).where(currency == "USD") and
  customer.where(verified == false).where(new == true)
}
always { fraud_check }
```

### Semantic Meaning

Chained `.where()` clauses are implicitly **AND**ed together:

```javascript
payment.where(a > 1).where(b == 2)
// Equivalent to:
payment.where(a > 1 and b == 2)
```

## 2. Contains Operator

### Syntax

```javascript
payment.where(description contains "fraud")
```

### Why

Common use case for string pattern matching without regex complexity:

**Before** (must use regex):
```javascript
payment.where(description matches ".*fraud.*")
```

**After** (simpler):
```javascript
payment.where(description contains "fraud")
```

### Implementation

Added `contains` to:
1. **Lexer keywords**: `\b(... |contains| ...)\b`
2. **Comparison operators**: `@( ... | "contains" )`
3. **WhereComparison operators**: same

### Examples

**String contains:**
```javascript
when { payment.where(description contains "fraud") }
```

**Multiple contains (OR):**
```javascript
when {
  payment.where(
    description contains "fraud" or
    notes contains "suspicious"
  )
}
```

**Contains vs matches:**
```javascript
when {
  // Simple substring match
  api_request.where(path contains "/admin")

  or

  // Complex pattern matching
  api_request.where(path matches "/api/v[0-9]+/admin/.*")
}
```

**Direct comparison (outside where):**
```javascript
when { payment.description contains "suspicious" }
```

### Semantics

- `contains` is **case-sensitive** substring match
- For case-insensitive: use `matches` with `(?i)` regex flag
- `contains` works on string attributes only (runtime enforcement)

## 3. Negation Inside Where

### Syntax

```javascript
payment.where(not verified)
```

### Why

More natural boolean logic inside `.where()` clauses:

**Before:**
```javascript
// Had to use outer negation
not payment.where(verified)

// Or inequality
payment.where(verified != true)
```

**After:**
```javascript
// Direct negation inside where
payment.where(not verified)
```

### Implementation

Added `BoolIdent` alternative to `WhereAtomicTerm`:

```go
type WhereAtomicTerm struct {
    Not        bool              `@"not"?`
    Grouped    *WhereCondition   `(  "(" @@ ")"`
    Comparison *WhereComparison  `| @@`
    SpanRef    *WhereSpanRef     `| @@`
    BoolIdent  *string           `| @Ident )`  // New! Bare boolean
}
```

### Examples

**Simple negation:**
```javascript
when { payment.where(not verified) }
```

**Negation with other conditions:**
```javascript
when { payment.where(amount > 1000 and not verified) }
```

**Multiple negations:**
```javascript
when { payment.where(not verified and not approved) }
```

**Grouped negation:**
```javascript
when { payment.where(not (verified and approved)) }
```

**Negation of span reference:**
```javascript
when { payment.where(not fraud_check.completed) }
```

### Semantics

- `not verified` treats `verified` as a boolean attribute
- Equivalent to `verified == false` at runtime
- Works with any identifier (not just "verified", "approved", etc.)

## Combined Features

All features work together:

```javascript
when {
  payment
    .where(description contains "suspicious" or notes contains "fraud")
    .where(not verified)
    .where(amount > 10000)
}
always {
  fraud_check.where(score < 0.3).where(not bypassed) and
  manual_review
}
never {
  auto_approve or skip_validation
}
```

## Test Coverage

### New Tests (`new_features_test.go`)

1. **TestChainedWhere** - 5 test cases
   - Single chain
   - Triple chain
   - Complex conditions
   - Chain in always clause
   - Multiple chained operations

2. **TestContainsOperator** - 6 test cases
   - String contains in where
   - Contains with string literal
   - Direct comparison
   - Contains with identifier
   - Multiple contains
   - Contains vs matches

3. **TestNegationInWhere** - 6 test cases
   - Simple boolean negation
   - Negation in complex condition
   - Multiple negations
   - Negation with comparison
   - Grouped negation
   - Negation of span reference

4. **TestCombinedNewFeatures** - 5 test cases
   - Chained where with contains
   - Chained where with negation
   - Contains with negation
   - All features combined
   - Complex real-world example

**Total**: 22 new test cases, all passing ✅

### Updated Tests

- `TestPotentiallyMissingFeatures` now shows 4 missing features (down from 7)
- All existing tests still pass (backward compatible)

## Remaining Limitations

After implementing these features, only **4 limitations** remain:

1. **Arithmetic expressions** - `amount - refund > 1000` (rare use case)
2. **Cross-span attribute comparison** - `payment.amount > fraud_score.threshold` (complex)
3. **Empty when clause** - `when { }` (semantically questionable)
4. **Case-insensitive matching** - Use `matches "(?i)pattern"` instead

These are all **low priority** - either rare use cases, workaroundable, or edge cases.

## Backward Compatibility

✅ **100% backward compatible** - all existing DSL syntax still works.

The new features are **additive only** - no breaking changes to existing grammar or semantics.

## Summary Statistics

**Before this PR:**
- Missing features: 7
- Implemented: 6

**After this PR:**
- Missing features: 4
- Implemented: 9

**Features added:**
- Chained where clauses
- Contains operator
- Negation in where

**Lines changed:**
- `parser.go`: ~20 lines
- Test files: +220 lines (comprehensive coverage)

**Impact**: Major improvement in DSL expressiveness with minimal code changes.
