# Expression Refactoring: Functions on Both Sides

## Problem

The original grammar only allowed **literal values** on the right side of comparison operators:

```go
// Before - WRONG
type Comparison struct {
    Operator string `@( "==" | "!=" | ... )`
    Value    *Value `@@`  // Only literals!
}
```

This prevented natural expressions like:
- ❌ `count(http_request) != count(http_response)`
- ❌ `payment.refund_amount > payment.charge_amount`
- ❌ `count(errors) > count(successes)`

## Root Cause

**Scoping insight**: Both sides of a comparison are **functions that return values**:
- `count(http_request)` → returns an integer
- `payment.amount` → returns a numeric value
- `1000` → returns a literal value

There's no fundamental difference - they're all **expressions** that evaluate to values. The grammar should allow **any expression** on both sides.

## Solution

Introduced a unified `Expression` type that can represent:
1. **Literal values** (strings, numbers, booleans, identifiers, lists)
2. **Count expressions** (`count(operation_name)`)
3. **Attribute paths** (for future: cross-attribute comparisons)

```go
// After - CORRECT
type Expression struct {
    Value *Value       `  @@`                        // Literals
    Count *CountExpr   `| @@`                        // count(op)
    Path  []string     `| @Ident ( "." @Ident )*`    // Attribute refs
}

type Comparison struct {
    Operator string      `@( "==" | "!=" | ... )`
    Right    *Expression `@@`  // Any expression!
}
```

## Changes Made

### 1. Grammar Refactoring

**Before** (3 separate types):
- `Comparison.Value` - literal only
- `WhereComparison.Value` - literal only
- `CountCheck.Value` + `CountCheck.OtherCount` - special case hack

**After** (unified):
- `Comparison.Right` - any Expression
- `WhereComparison.Right` - any Expression
- `CountCheck.Right` - any Expression

### 2. New Types

```go
// Unified expression type
type Expression struct {
    Value *Value       // Literals (int, float, string, bool, ident, list)
    Count *CountExpr   // count(operation_name)
    Path  []string     // Attribute references (future)
}

// Count as an expression
type CountExpr struct {
    OpName []string `"count" "(" @Ident ( "." @Ident )* ")"`
}
```

### 3. Updated Types

```go
// Removed OtherCount - now just Expression
type CountCheck struct {
    OpName   []string    `@Ident ( "." @Ident )* ")"`
    Operator string      `@( ">" | ">=" | ... )`
    Right    *Expression `@@`  // Was: Value *int + OtherCount
}
```

## What Now Works

### Count-to-Count Comparisons

```javascript
// Detect request/response mismatch
when { count(http_request) != count(http_response) }

// More errors than successes
when { count(error) > count(success) }

// Triple comparison
when { count(a) > count(b) and count(b) > count(c) }
```

### Count in Complex Conditions

```javascript
// Count in always clause
when { payment }
always { count(fraud_check) > 0 }

// Count in never clause
when { payment }
never { count(bypass) > 0 }

// Multiple counts
when { count(retry) > 3 and count(error) > count(success) }
always { alert }
```

### All Expression Types

1. **Literal integers**: `amount > 1000`
2. **Literal floats**: `score > 0.95`
3. **Literal strings**: `currency == "USD"`
4. **Literal booleans**: `verified == true`
5. **Identifiers (enum-like)**: `status == approved`
6. **Lists**: `processor in ["stripe", "square"]`
7. **Count expressions**: `count(retry) > 3`
8. **Count-to-count**: `count(a) != count(b)`

## Test Coverage

### New Tests (`expression_test.go`)

- **TestExpressionOnBothSides**: 9 test cases
  - Count-to-count (==, !=, >)
  - Count-to-literal
  - Attribute-to-literal (string, number, identifier)
  - Mixed expressions in complex conditions

- **TestExpressionTypes**: 8 test cases
  - All value types (int, float, string, bool, ident, list)
  - Count expressions
  - Count-to-count comparisons

- **TestExpressionEdgeCases**: 5 test cases
  - Triple count comparisons
  - Dotted operation names
  - Nested boolean with counts
  - Counts in always/never clauses

### Existing Tests

All existing tests still pass:
- ✅ Unit tests (14 cases)
- ✅ Fuzzing (34,800+ rules)
- ✅ Real-world patterns (29 production cases)
- ✅ Security robustness (14 attack scenarios)

## Future Enhancements

### Attribute-to-Attribute Comparisons

The `Path` field in `Expression` is reserved for future support:

```javascript
// Future: compare attributes from same span
when { payment.where(refund_amount > charge_amount) }

// Future: compare attributes across spans
when { payment.amount > fraud_score.threshold }
```

**Requires**: More complex evaluation context to resolve attribute paths.

### Arithmetic Expressions

Could extend `Expression` to support:

```javascript
// Future: arithmetic
when { payment.where(amount - refund > 1000) }
when { count(retry) + count(timeout) > 5 }
```

**Requires**: Adding arithmetic operator support to grammar.

## Benefits

1. **Consistency**: One way to represent all value-producing expressions
2. **Extensibility**: Easy to add new expression types (arithmetic, functions)
3. **Simplicity**: Removed special-case hacks (OtherCount)
4. **Correctness**: Matches semantic reality - both sides are functions

## Backward Compatibility

✅ **Fully backward compatible** - all existing DSL syntax still works:
- Literal comparisons: `amount > 1000`
- Count comparisons: `count(retry) > 3`
- Complex conditions: `payment.where(amount > 1000 and currency == "USD")`

✨ **New capability unlocked**: count-to-count and future expression-to-expression comparisons.

## Conclusion

This refactoring addresses the fundamental issue: **the DSL should allow functions on both sides of comparisons**, not just literals on the right.

The solution is elegant - introduce a unified `Expression` type that represents **any value-producing computation**, whether it's a literal, a count, or (in the future) an attribute reference or arithmetic expression.

**Result**: More consistent, more extensible, more correct.
