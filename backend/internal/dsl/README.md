# BeTrace DSL Implementation

This package implements the BeTrace Domain-Specific Language (DSL) for defining trace-level behavioral invariants.

## Components

### Lexer (`lexer.go`)
- Tokenizes DSL input into lexical tokens
- Handles keywords: `when`, `always`, `never`, `trace`, `has`, `where`, `count`, `and`, `or`, `not`, `in`, `matches`, `true`, `false`
- Supports identifiers with dots (e.g., `payment.charge_card`)
- Handles operators: `==`, `!=`, `<`, `<=`, `>`, `>=`
- Supports strings (quoted), numbers (int/float), booleans, and lists

### Parser (`parser.go`)
- Parses tokens into an Abstract Syntax Tree (AST)
- Supports two rule types:
  1. **Simple Rules**: Direct invariant checks (backward compatible)
  2. **Conditional Invariants**: When-Always-Never patterns (new)

### AST (`ast.go`)
- Defines node types for the syntax tree:
  - `SimpleRule`: Traditional condition-based rules
  - `ConditionalInvariant`: When-Always-Never structured rules
  - `BinaryCondition`: AND/OR operations
  - `NotCondition`: Negation
  - `HasCheck`: `trace.has(operation).where(...)`
  - `CountCheck`: `trace.count(operation) > N`
  - Various value types: Ident, Number, String, Bool, List

### Tokens (`token.go`)
- Defines all token types
- Maps keywords to token types
- Provides string representation for debugging

## Usage

### Simple Rule Example

```go
import "github.com/betracehq/betrace/backend/internal/dsl"

input := `trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)`

parser := dsl.NewParser(input)
rule, err := parser.Parse()
if err != nil {
    // Handle error
}

// rule is a *SimpleRule
```

### Conditional Invariant Example

```go
input := `when { trace.has(payment.charge_card).where(amount > 1000) }
always { trace.has(payment.fraud_check) }
never { trace.has(payment.bypass_validation) }`

parser := dsl.NewParser(input)
rule, err := parser.Parse()
if err != nil {
    // Handle error
}

// rule is a *ConditionalInvariant
```

## Syntax

### Simple Conditions

```javascript
// Basic has check
trace.has(operation_name)

// With attribute filtering
trace.has(operation_name).where(attribute == value)

// Multiple where clauses
trace.has(payment.charge).where(amount > 1000).where(currency == USD)

// Logical operators
trace.has(a) and trace.has(b)
trace.has(a) or trace.has(b)
not trace.has(bypass)

// Count checks
trace.count(http.retry) > 3
```

### Conditional Invariants

```javascript
// When-Always-Never pattern
when { condition }
always { condition }  // optional
never { condition }   // optional

// At least one of 'always' or 'never' required
```

## Grammar

```
rule := conditional_invariant | condition

conditional_invariant := when_clause always_clause? never_clause?
                       | when_clause never_clause? always_clause?

when_clause := "when" "{" condition "}"
always_clause := "always" "{" condition "}"
never_clause := "never" "{" condition "}"

condition := term (("and" | "or") term)*
term := "not"? span_check

span_check := "trace.has(" identifier ")" where_clause*
            | "trace.count(" identifier ")" comparison_op value

where_clause := ".where(" attribute_name comparison_op value ")"
comparison_op := "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "matches"

identifier := [a-zA-Z_][a-zA-Z0-9_.]*
value := identifier | number | boolean | string | list
```

## Testing

Run tests:
```bash
go test -mod=mod ./internal/dsl/... -v
```

## Status

**Implemented**:
- ✅ Complete lexer with keyword recognition
- ✅ Token types and definitions
- ✅ AST node types
- ✅ Parser for simple rules
- ✅ Parser for conditional invariants
- ✅ Semantic validation (always/never requirement)
- ✅ Comprehensive test coverage

**Next Steps**:
- Fix remaining parser edge cases (see failing tests)
- Add DRL (Drools Rule Language) code generation
- Integrate with rules engine
- Add validation for operation names and attributes
- Performance optimization for large rule sets

## References

- [DSL Documentation](../../../docs/technical/trace-rules-dsl.md)
- [Architecture Decision Records](../../../docs/adrs/)
