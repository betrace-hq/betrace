# BeTrace DSL Error Messages Guide

## Design Philosophy

BeTrace's error messages are designed to be **helpful, not just correct**. Every error should tell you:
1. **What went wrong** - clear error description
2. **Where it went wrong** - line/column with visual pointer
3. **How to fix it** - actionable suggestion

## Error Layers

### 1. Lexical Errors (Tokenization)
Caught by the Lexer when input can't be tokenized.

**Example: Invalid character**
```
Parse error at line 1, column 25:
  Unexpected character '@' in expression

  trace.has(payment.charge)@trace.has(fraud.check)
                           ^

  Suggestion: Use 'and' or 'or' to combine expressions
```

### 2. Syntax Errors (Parsing)
Caught by the Parser when tokens don't form valid grammar.

**Example: Missing closing parenthesis**
```
Parse error at line 1, column 28:
  Expected ')' but found 'and'

  trace.has(payment.charge_card and trace.has(fraud.check)
                              ^

  Suggestion: Add ')' to close the function call
```

**Example: Missing operation name**
```
Parse error at line 1, column 12:
  Expected operation name

  trace.has()
            ^

  Suggestion: Provide a span operation name like 'payment.charge_card'
```

**Example: Invalid operator**
```
Parse error at line 1, column 45:
  Invalid operator '==='

  trace.has(payment.charge).where(amount === 1000)
                                            ^

  Suggestion: Valid operators: ==, !=, >, >=, <, <=, in, matches
```

### 3. Semantic Errors (Validation)
Caught by the Validator after successful parsing.

**Example: Operation name too short**
```
Validation failed with 1 error(s):

[ERROR] Operation name 'ab' is too short
  💡 Suggestion: Use descriptive names like 'payment.charge_card' or 'database.query'
```

**Example: Non-conventional naming**
```
Validation failed with 0 error(s):

Warnings:
  - Operation name 'paymentcharge' doesn't follow convention. Consider using 'service.operation' format.
```

**Example: Unknown attribute**
```
Validation failed with 0 error(s):

Warnings:
  - Attribute 'unknown_attr' is not commonly used. Make sure it's emitted by your spans.
```

**Example: Fragile comparison**
```
Validation failed with 0 error(s):

Warnings:
  - Exact amount comparison (==) is fragile. Consider using ranges (>, <) instead.
```

### 4. Drools Compilation Errors
Caught when generated DRL doesn't compile.

**Example: Invalid DRL syntax**
```
Drools DRL validation failed:
  ❌ Generated DRL doesn't contain a rule definition
  ❌ Generated DRL is missing 'when' or 'then' clause

Generated DRL:
  [shows the generated DRL for debugging]
```

## Example Error Scenarios

### Scenario 1: Typo in operator

**Input:**
```javascript
trace.has(payment.charge).where(amount >> 1000)
```

**Error:**
```
Parse error at line 1, column 41:
  Invalid operator '>>'

  trace.has(payment.charge).where(amount >> 1000)
                                          ^

  Suggestion: Valid operators: ==, !=, >, >=, <, <=, in, matches
  Did you mean: '>' or '>='?
```

### Scenario 2: Forgot closing parenthesis

**Input:**
```javascript
trace.has(payment.charge_card and trace.has(fraud.check)
```

**Error:**
```
Parse error at line 1, column 31:
  Expected ')' after operation name

  trace.has(payment.charge_card and trace.has(fraud.check)
                                ^

  Suggestion: Add ')' before 'and'
```

### Scenario 3: Multi-line expression with error

**Input:**
```javascript
trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check
  and trace.has(audit.log)
```

**Error:**
```
Parse error at line 2, column 37:
  Expected ')' but found 'and'

  and trace.has(payment.fraud_check
                                    ^

  Suggestion: Add ')' to close the function call
```

### Scenario 4: Semantic validation warning

**Input:**
```javascript
trace.has(payment.charge).where(amount == 999.99)
```

**Error:**
```
Validation passed with warnings:

Warnings:
  - Exact amount comparison (==) is fragile. Consider using ranges (>, <) instead.
  - Comparing floating point with == may cause precision issues
```

### Scenario 5: Combined errors

**Input:**
```javascript
trace.has(x).where(unknown_attr == 100) and trace.has(
```

**Errors:**
```
Parse error at line 1, column 56:
  Unexpected end of expression

  trace.has(x).where(unknown_attr == 100) and trace.has(
                                                         ^

  Suggestion: Complete the expression or remove trailing operators

---

Validation also found issues:

[ERROR] Operation name 'x' is too short
  💡 Suggestion: Use descriptive names like 'payment.charge_card' or 'database.query'

[WARNING] Attribute 'unknown_attr' is not commonly used. Make sure it's emitted by your spans.
```

## Testing Error Messages

Run the error message tests:
```bash
cd backend
mvn test -Dtest=ErrorMessagesTest
mvn test -Dtest=BeTraceDslParserTest
mvn test -Dtest=RuleValidatorTest
```

## Developer Tips

When writing rules:
1. **Start simple** - Test `trace.has(X)` before adding `and` conditions
2. **Use descriptive names** - `payment.charge_card` not `pay`
3. **Check as you go** - Parser will catch errors immediately
4. **Read the suggestions** - They're designed to help you fix issues quickly
5. **Test with fake data** - Use SpanGenerator to emit test spans

## API Integration

When rules are created via API, errors are returned as JSON:

```json
{
  "valid": false,
  "errors": [
    {
      "line": 1,
      "column": 25,
      "message": "Expected ')' but found 'and'",
      "suggestion": "Add ')' to close the function call",
      "type": "SYNTAX_ERROR"
    }
  ],
  "warnings": [
    {
      "message": "Attribute 'unknown_attr' is not commonly used",
      "severity": "WARNING"
    }
  ]
}
```

This allows frontends to show inline error highlighting in code editors.
