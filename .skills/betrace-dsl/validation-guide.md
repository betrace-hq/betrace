# FLUO DSL Validation Guide

Security limits, common validation errors, and debugging strategies for FLUO DSL rules.

## Security Limits

FLUO enforces strict security limits to prevent Denial-of-Service (DoS) attacks via malicious DSL input.

### Input Size Limits

| Limit | Value | Attack Prevented | Error Message |
|-------|-------|------------------|---------------|
| **Total DSL Length** | 64KB (65,536 bytes) | Memory exhaustion | "DSL expression exceeds maximum size of 65536 bytes" |
| **String Literal Length** | 10KB (10,000 chars) | ReDoS (Regex DoS) | "String literal exceeds maximum length of 10000 characters" |
| **Identifier Length** | 100 characters | Abuse / buffer overflow | "Identifier exceeds maximum length of 100 characters" |
| **Recursion Depth** | 50 levels | Stack overflow | "Expression too complex: maximum nesting depth of 50 exceeded" |

### Why These Limits Exist

**Total DSL Length (64KB)**
- **Attack:** Malicious users submit megabyte-sized DSL expressions
- **Impact:** Parser memory exhaustion, OOM (Out of Memory) errors
- **Defense:** Pre-parse size check rejects oversized input immediately

**String Literal Length (10KB)**
- **Attack:** Pathological regex patterns with excessive backtracking
- **Impact:** ReDoS (Regular expression Denial of Service), parser hangs
- **Defense:** Character counting during string parsing, early termination

**Identifier Length (100 chars)**
- **Attack:** Extremely long span names or attribute names
- **Impact:** Buffer overflow in Drools DRL generation, memory waste
- **Defense:** Character counting during identifier parsing

**Recursion Depth (50 levels)**
- **Attack:** Deeply nested expressions like `not not not ... trace.has(x)` (1000+ levels)
- **Impact:** Stack overflow, parser crash
- **Defense:** Global call depth tracking across all parser methods

### Performance Expectations

| Input Size | Expected Parse Time (p95) | Max Parse Time (p99) |
|------------|---------------------------|----------------------|
| < 1KB (typical) | < 1ms | < 5ms |
| 10KB (complex) | < 10ms | < 20ms |
| 64KB (maximum) | < 50ms | < 100ms |

**If parsing exceeds these times:**
- Check for excessive nesting (use AND/OR instead of parentheses)
- Check for very long string literals (extract to separate where clauses)
- Check for complex regex patterns (simplify or use prefix matching)

---

## Common Validation Errors

### 1. "Unexpected token" Errors

#### Missing Logical Operator

```javascript
// ❌ Error: Unexpected token 'trace'
trace.has(payment.charge) trace.has(fraud.check)

// ✅ Fixed: Add 'and' operator
trace.has(payment.charge) and trace.has(fraud.check)
```

#### Missing Parenthesis

```javascript
// ❌ Error: Unexpected token 'EOF' (End of File)
trace.has(payment.charge).where(amount > 1000

// ✅ Fixed: Close parenthesis
trace.has(payment.charge).where(amount > 1000)
```

#### Invalid Character

```javascript
// ❌ Error: Unexpected token '$'
trace.has($payment)

// ✅ Fixed: Remove invalid character
trace.has(payment)
```

---

### 2. "Unknown function" Errors

#### Wrong Function Name

```javascript
// ❌ Error: Unknown function: contains
trace.contains(payment.charge)

// ✅ Fixed: Use 'has' or 'count'
trace.has(payment.charge)
```

#### Missing 'trace.' Prefix

```javascript
// ❌ Error: Unexpected token 'has'
has(payment.charge)

// ✅ Fixed: Add 'trace.' prefix
trace.has(payment.charge)
```

---

### 3. "Unterminated string literal" Errors

#### Missing Closing Quote

```javascript
// ❌ Error: Unterminated string literal
trace.has(x).where(path matches "/api/v1/admin/.*

// ✅ Fixed: Add closing quote
trace.has(x).where(path matches "/api/v1/admin/.*")
```

#### Unescaped Quote in String

```javascript
// ❌ Error: Unterminated string literal
trace.has(x).where(message matches "User said "hello"")

// ✅ Fixed: Escape inner quotes
trace.has(x).where(message matches "User said \"hello\"")
```

---

### 4. "String literal exceeds maximum length" Errors

#### String Too Long (> 10KB)

```javascript
// ❌ Error: String literal exceeds maximum length of 10000 characters
trace.has(x).where(data matches "a".repeat(10001))

// ✅ Fixed: Shorten string or use alternative approach
trace.has(x).where(data matches "a{1,9999}")  // Regex repetition
```

---

### 5. "Identifier exceeds maximum length" Errors

#### Identifier Too Long (> 100 chars)

```javascript
// ❌ Error: Identifier exceeds maximum length of 100 characters
trace.has(very_long_span_name_that_exceeds_one_hundred_characters_and_will_be_rejected...)

// ✅ Fixed: Shorten identifier or refactor span naming
trace.has(long_span_name)
```

---

### 6. "Maximum nesting depth exceeded" Errors

#### Too Deeply Nested (> 50 levels)

```javascript
// ❌ Error: Expression too complex: maximum nesting depth of 50 exceeded
not not not not not not ... (51+ times) trace.has(x)

// ✅ Fixed: Simplify expression
trace.has(x)  // Double negation cancels out
```

#### Excessive Parentheses

```javascript
// ❌ Error: Expression too complex
(((((...(((((trace.has(x)))))...)))))  // 51+ levels

// ✅ Fixed: Remove unnecessary parentheses
trace.has(x)
```

---

### 7. "DSL expression exceeds maximum size" Errors

#### Total DSL Too Large (> 64KB)

```javascript
// ❌ Error: DSL expression exceeds maximum size of 65536 bytes
trace.has(x) and trace.has(y) and ... (thousands of conditions)

// ✅ Fixed: Split into multiple rules
// Rule 1:
trace.has(x) and trace.has(y) and ... (first 50 conditions)

// Rule 2:
trace.has(a) and trace.has(b) and ... (next 50 conditions)
```

---

### 8. Type Mismatch Errors

#### String vs. Identifier Confusion

```javascript
// ❌ Error: Unexpected token (or rule doesn't fire)
trace.has(x).where(currency == "USD")

// ✅ Fixed: Remove quotes (USD is identifier, not string)
trace.has(x).where(currency == USD)
```

#### Number vs. String Comparison

```javascript
// ❌ Error: Rule doesn't fire (type mismatch)
trace.has(x).where(amount == "1000")

// ✅ Fixed: Use number, not string
trace.has(x).where(amount == 1000)
```

---

### 9. "Expected X, got Y" Errors

#### Missing Comparison Operator

```javascript
// ❌ Error: Expected comparison operator, got ')'
trace.has(x).where(amount)

// ✅ Fixed: Add comparison operator
trace.has(x).where(amount > 0)
```

#### Invalid Comparison Operator

```javascript
// ❌ Error: Expected comparison operator, got 'equals'
trace.has(x).where(amount equals 1000)

// ✅ Fixed: Use '==' not 'equals'
trace.has(x).where(amount == 1000)
```

---

## Debugging Strategies

### Strategy 1: Simplify and Iterate

**Problem:** Complex rule fails validation or doesn't fire.

**Approach:**

```javascript
// Step 1: Simplify to basic existence check
trace.has(payment.charge)  // ✅ Validate this works first

// Step 2: Add attribute filtering incrementally
trace.has(payment.charge).where(amount > 1000)  // ✅ Add one condition

// Step 3: Add second span check
trace.has(payment.charge).where(amount > 1000)
  and trace.has(payment.fraud_check)  // ✅ Add second condition

// Step 4: Add additional complexity as needed
trace.has(payment.charge).where(amount > 1000).where(currency == USD)
  and trace.has(payment.fraud_check)
```

---

### Strategy 2: Verify Span Names Match

**Problem:** Rule passes validation but never fires.

**Cause:** Span name mismatch between DSL and actual OpenTelemetry spans.

**Debug Approach:**

1. **Query actual traces** in Grafana/FLUO UI
2. **Verify span operation names** match exactly
3. **Check for typos** (case-sensitive: `payment.charge` ≠ `Payment.Charge`)

```javascript
// ❌ Wrong: Span name in traces is "payment.charge_card"
trace.has(payment.charge)

// ✅ Correct: Match exact span name
trace.has(payment.charge_card)
```

---

### Strategy 3: Verify Attribute Names Match

**Problem:** Rule with `.where()` clauses doesn't fire.

**Cause:** Attribute name mismatch or attribute doesn't exist.

**Debug Approach:**

1. **Inspect span attributes** in actual traces
2. **Verify attribute keys** match exactly
3. **Check attribute types** (number vs. string vs. boolean)

```javascript
// ❌ Wrong: Attribute is "transaction_amount", not "amount"
trace.has(payment.charge).where(amount > 1000)

// ✅ Correct: Match exact attribute name
trace.has(payment.charge).where(transaction_amount > 1000)
```

---

### Strategy 4: Check Trace Correlation

**Problem:** Two `trace.has()` checks don't match in same trace.

**Cause:** Spans belong to different traces (not correlated).

**Debug Approach:**

1. **Verify both spans exist** in actual traces
2. **Check traceId correlation** - both spans must have same traceId
3. **Ensure parent-child relationship** if expected

```javascript
// Rule expects both spans in SAME trace:
trace.has(payment.charge) and trace.has(payment.fraud_check)

// Debug: Check if both spans have same traceId
// If different traceIds → spans won't match → rule won't fire
```

---

### Strategy 5: Use Browser DevTools for XSS Errors

**Problem:** Validation errors display `<script>` or HTML tags.

**Cause:** User input not sanitized before displaying in error messages.

**Expected Behavior:** FLUO sanitizes all error messages for HTML/JS contexts.

**If you see XSS:**

```javascript
// ❌ BAD: Error message shows raw HTML
"Unexpected token: <script>alert('XSS')</script>"

// ✅ EXPECTED: Error message sanitizes HTML
"Unexpected token: &lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;"
```

**This is a security bug** - report immediately if unsanitized HTML appears.

---

## Edge Cases and Gotchas

### Gotcha 1: AND/OR Precedence

**Problem:** Operator precedence causes unexpected rule behavior.

```javascript
// Parsed as: (A and B) or C
trace.has(A) and trace.has(B) or trace.has(C)

// If you want: A and (B or C)
// Use explicit parentheses:
trace.has(A) and (trace.has(B) or trace.has(C))
```

---

### Gotcha 2: NOT Applies to Entire Expression

**Problem:** `not` negates more than intended.

```javascript
// ❌ Incorrect: NOT only applies to first term
not trace.has(x) and trace.has(y)
// Parsed as: (not trace.has(x)) and trace.has(y)

// ✅ If you want: not (trace.has(x) and trace.has(y))
not (trace.has(x) and trace.has(y))
```

---

### Gotcha 3: Where Clauses Are ANDed

**Problem:** Multiple `.where()` clauses create AND logic.

```javascript
// Requires BOTH amount > 1000 AND currency == USD
trace.has(payment.charge)
  .where(amount > 1000)
  .where(currency == USD)

// If you want OR logic:
// Use separate rules or restructure
trace.has(payment.charge).where(amount > 1000) or
trace.has(payment.charge).where(currency == USD)
```

---

### Gotcha 4: Count() Cannot Use Where()

**Problem:** `.where()` not supported with `trace.count()`.

```javascript
// ❌ Invalid: count() doesn't support where()
trace.count(payment.charge).where(amount > 1000) > 5

// ✅ Alternative: Combine count() and has()
trace.count(payment.charge) > 5
  and trace.has(payment.charge).where(amount > 1000)
```

---

### Gotcha 5: Regex Patterns Must Be Quoted

**Problem:** Unquoted regex patterns fail.

```javascript
// ❌ Invalid: Regex pattern not quoted
trace.has(x).where(path matches /api/v1/.*)

// ✅ Correct: Regex pattern quoted
trace.has(x).where(path matches "/api/v1/.*")
```

---

### Gotcha 6: Identifiers Cannot Contain Hyphens

**Problem:** Hyphens in span names cause parse errors.

```javascript
// ❌ Invalid: Hyphen not allowed in identifier
trace.has(payment-charge)

// ✅ Workaround: Use underscore or dot
trace.has(payment_charge)
trace.has(payment.charge)
```

**Instrumentation Fix:** Change OpenTelemetry span names to use underscores or dots.

---

## Security Best Practices

### 1. Input Sanitization (XSS Prevention)

**FLUO automatically sanitizes error messages** for:
- HTML context (`<`, `>`, `&`, `"`, `'`, `/`)
- JavaScript context (`\`, `'`, `"`, newlines)
- JSON context (proper escaping)
- Markdown context (brackets, parentheses)

**Developer Responsibility:**
- Ensure FLUO frontend uses sanitization (already implemented)
- Do NOT bypass sanitization when displaying errors
- Report any XSS vulnerabilities immediately

---

### 2. Rate Limiting (DoS Prevention)

**FLUO should implement rate limiting** on validation endpoint:
- Max 10 validation requests per second per user
- Max 100 validation requests per minute per IP

**Developer Responsibility:**
- Implement rate limiting in backend API
- Return `429 Too Many Requests` when exceeded

---

### 3. Timeout Guards (Parser Hangs)

**FLUO parser enforces timeout guards**:
- Max 100ms parsing time for any input
- Parser aborts if timeout exceeded

**Developer Responsibility:**
- Monitor parser performance metrics
- Alert if parsing exceeds 50ms (p95)

---

## Validation Error Messages Reference

| Error Message | Cause | Fix |
|---------------|-------|-----|
| `Unexpected token 'X'` | Syntax error (missing operator, invalid character) | Check syntax, add missing operator |
| `Unknown function: X` | Invalid function name | Use `has` or `count` |
| `Unterminated string literal` | Missing closing quote | Add closing `"` |
| `String literal exceeds maximum length` | String > 10KB | Shorten string or use regex repetition |
| `Identifier exceeds maximum length` | Identifier > 100 chars | Shorten identifier |
| `Expression too complex: maximum nesting depth exceeded` | Recursion > 50 levels | Simplify expression |
| `DSL expression exceeds maximum size` | Total DSL > 64KB | Split into multiple rules |
| `Expected comparison operator, got 'X'` | Missing or invalid comparison operator | Use `==`, `!=`, `>`, `<`, `>=`, `<=`, `in`, `matches` |
| `Expected '.', got 'X'` | Missing dot after `trace` | Add `.` between `trace` and `has`/`count` |

---

## Summary

**Security Limits:**
- 64KB total DSL
- 10KB string literals
- 100-char identifiers
- 50-level recursion depth

**Common Errors:**
- Missing logical operators (`and`, `or`)
- Unquoted regex patterns
- Type mismatches (string vs. identifier)
- Span name mismatches

**Debugging Strategies:**
1. Simplify and iterate
2. Verify span names match
3. Verify attribute names match
4. Check trace correlation
5. Use browser DevTools for XSS errors

**Edge Cases:**
- AND/OR precedence
- NOT scope
- Where clauses are ANDed
- Count() cannot use where()
- Regex patterns must be quoted
- Identifiers cannot contain hyphens

For detailed syntax, see **@.skills/fluo-dsl/syntax-reference.md**.
