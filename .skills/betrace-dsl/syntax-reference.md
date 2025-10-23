# BeTrace DSL Syntax Reference

Complete grammar specification for BeTrace's trace-level rules DSL.

## Grammar (EBNF)

```ebnf
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

## Operators

### Logical Operators

#### AND (conjunction)

**Syntax:** `condition1 and condition2`

**Semantics:** Both conditions must be true within the same trace.

**Examples:**

```javascript
// Both spans must exist in the trace
trace.has(payment.charge) and trace.has(payment.fraud_check)

// Three spans must exist
trace.has(auth.check) and trace.has(data.access) and trace.has(audit.log)

// Mix has() and count()
trace.has(payment.charge) and trace.count(http.retry) < 3
```

**Common Mistakes:**

```javascript
// ❌ Missing 'and' keyword
trace.has(x) trace.has(y)

// ✅ Correct
trace.has(x) and trace.has(y)

// ❌ Using && instead of 'and'
trace.has(x) && trace.has(y)

// ✅ Correct
trace.has(x) and trace.has(y)
```

#### OR (disjunction)

**Syntax:** `condition1 or condition2`

**Semantics:** At least one condition must be true.

**Examples:**

```javascript
// Trace has either error or timeout
trace.has(http.error) or trace.has(http.timeout)

// Payment succeeded via any processor
trace.has(payment.stripe_success) or
trace.has(payment.square_success) or
trace.has(payment.paypal_success)
```

**Common Mistakes:**

```javascript
// ❌ Using || instead of 'or'
trace.has(x) || trace.has(y)

// ✅ Correct
trace.has(x) or trace.has(y)
```

#### NOT (negation)

**Syntax:** `not condition`

**Semantics:** Condition must be false (span must NOT exist in trace).

**Examples:**

```javascript
// Payment without fraud check (violation)
trace.has(payment.charge) and not trace.has(payment.fraud_check)

// Successful transaction without error
trace.has(transaction.complete) and not trace.has(error)

// Double negation (allowed but discouraged)
not not trace.has(x)  // Same as trace.has(x)
```

**Common Mistakes:**

```javascript
// ❌ Using ! instead of 'not'
!trace.has(x)

// ✅ Correct
not trace.has(x)

// ❌ Negating where clause (not supported)
trace.has(x).where(not amount > 1000)

// ✅ Correct (use opposite operator)
trace.has(x).where(amount <= 1000)
```

**Operator Precedence:**
1. `not` (highest)
2. `and`
3. `or` (lowest)

```javascript
// Parsed as: (A and B) or C
trace.has(A) and trace.has(B) or trace.has(C)

// Use parentheses for clarity (optional):
(trace.has(A) and trace.has(B)) or trace.has(C)

// Parsed as: A or (B and C)
trace.has(A) or trace.has(B) and trace.has(C)
```

## Functions

### trace.has(operation_name)

**Purpose:** Check if trace contains span with given operation name.

**Syntax:** `trace.has(identifier)`

**Returns:** Boolean (true if span exists)

**Examples:**

```javascript
// Simple existence check
trace.has(payment.charge_card)

// Dotted identifiers supported
trace.has(api.v1.user.login)

// Underscores supported
trace.has(database.query_pii)
```

**Common Mistakes:**

```javascript
// ❌ Quotes around identifier
trace.has("payment.charge")

// ✅ Correct (no quotes)
trace.has(payment.charge)

// ❌ Missing 'trace.' prefix
has(payment.charge)

// ✅ Correct
trace.has(payment.charge)

// ❌ Spaces in identifier
trace.has(payment charge)

// ✅ Correct (use underscore or dot)
trace.has(payment_charge)
trace.has(payment.charge)
```

### .where(attribute comparison value)

**Purpose:** Filter spans by attribute values.

**Syntax:** `.where(attribute_name comparison_op value)`

**Chainable:** Multiple `.where()` clauses allowed.

**Examples:**

```javascript
// Single attribute filter
trace.has(payment.charge).where(amount > 1000)

// Multiple filters (chained)
trace.has(payment.charge)
  .where(amount > 1000)
  .where(currency == USD)

// Boolean attribute
trace.has(database.query).where(contains_pii == true)

// String attribute (identifier, not quoted)
trace.has(payment.charge).where(processor == stripe)

// Numeric comparison
trace.has(http.response).where(status_code >= 500)
```

**Common Mistakes:**

```javascript
// ❌ Multiple conditions in one where()
trace.has(x).where(amount > 1000 and currency == USD)

// ✅ Correct (chain where clauses)
trace.has(x).where(amount > 1000).where(currency == USD)

// ❌ Quotes around non-string identifiers
trace.has(x).where(currency == "USD")

// ✅ Correct (USD is identifier, not string)
trace.has(x).where(currency == USD)

// ❌ Using where() without has()
trace.where(amount > 1000)

// ✅ Correct (where() must follow has())
trace.has(payment.charge).where(amount > 1000)
```

### trace.count(operation_pattern)

**Purpose:** Count spans matching pattern in trace.

**Syntax:** `trace.count(identifier) comparison_op value`

**Returns:** Number (count of matching spans)

**Examples:**

```javascript
// Too many retries
trace.count(http.retry) > 3

// Request/response mismatch
trace.count(http.request) != trace.count(http.response)

// No errors occurred
trace.count(error) == 0

// At least one success
trace.count(payment.success) >= 1
```

**Common Mistakes:**

```javascript
// ❌ Using count() in has()
trace.has(trace.count(x) > 3)

// ✅ Correct (count() is standalone)
trace.count(x) > 3

// ❌ Missing comparison operator
trace.count(x)

// ✅ Correct (must compare to value)
trace.count(x) > 0

// ❌ Combining count() with where()
trace.count(x).where(y == 1)

// ✅ Correct (count() doesn't support where())
trace.count(x) > 0 and trace.has(x).where(y == 1)
```

## Comparison Operators

### Equality: == (equal), != (not equal)

**Syntax:** `attribute == value` or `attribute != value`

**Supported Types:** Numbers, booleans, identifiers

**Examples:**

```javascript
// Numeric equality
trace.has(payment.charge).where(amount == 1000)

// Boolean equality
trace.has(database.query).where(contains_pii == true)

// Identifier equality
trace.has(payment.charge).where(processor == stripe)

// Inequality
trace.has(http.response).where(status != 200)
```

**Type Coercion:** None. Must match exact types.

```javascript
// ❌ Type mismatch (string vs number)
trace.has(x).where(amount == "1000")

// ✅ Correct (number)
trace.has(x).where(amount == 1000)

// ❌ Type mismatch (identifier vs string)
trace.has(x).where(currency == "USD")

// ✅ Correct (identifier)
trace.has(x).where(currency == USD)
```

### Relational: >, >=, <, <=

**Syntax:** `attribute comparison value`

**Supported Types:** Numbers only

**Examples:**

```javascript
// Greater than
trace.has(payment.charge).where(amount > 1000)

// Greater than or equal
trace.has(http.response).where(status_code >= 500)

// Less than
trace.has(http.request).where(latency < 100)

// Less than or equal
trace.has(database.query).where(rows_returned <= 1000)
```

**Common Mistakes:**

```javascript
// ❌ Using relational ops on non-numbers
trace.has(x).where(currency > USD)

// ✅ Correct (use == for identifiers)
trace.has(x).where(currency == USD)

// ❌ Using relational ops on booleans
trace.has(x).where(contains_pii > true)

// ✅ Correct (use == for booleans)
trace.has(x).where(contains_pii == true)
```

### List Membership: in

**Syntax:** `attribute in [value1, value2, ...]`

**Supported Types:** Identifiers in list

**Examples:**

```javascript
// Payment processor in list
trace.has(payment.charge).where(processor in [stripe, square, paypal])

// HTTP status in error range
trace.has(http.response).where(status in [400, 401, 403, 404])

// Service name in list
trace.has(api.request).where(service in [auth_service, user_service])
```

**Common Mistakes:**

```javascript
// ❌ Quotes around list values
trace.has(x).where(processor in ["stripe", "square"])

// ✅ Correct (identifiers, not strings)
trace.has(x).where(processor in [stripe, square])

// ❌ Single value (use == instead)
trace.has(x).where(processor in [stripe])

// ✅ Correct (use == for single value)
trace.has(x).where(processor == stripe)

// ❌ Empty list
trace.has(x).where(processor in [])

// ✅ Correct (at least one value)
trace.has(x).where(processor in [stripe])
```

### Pattern Matching: matches

**Syntax:** `attribute matches "regex_pattern"`

**Supported Types:** String patterns (must be quoted)

**Purpose:** Match attribute values against regex patterns.

**Examples:**

```javascript
// Admin endpoints
trace.has(api.request).where(endpoint matches "/api/v1/admin/.*")

// File extensions
trace.has(file.upload).where(filename matches ".*\\.(jpg|png|gif)")

// Email validation
trace.has(user.registration).where(email matches ".*@example\\.com")

// IP address range
trace.has(network.request).where(source_ip matches "192\\.168\\..*")
```

**Regex Syntax:** Standard Java regex (Drools backend uses Java Pattern class).

**Common Mistakes:**

```javascript
// ❌ Missing quotes around pattern
trace.has(x).where(endpoint matches /api/v1/.*)

// ✅ Correct (pattern must be quoted)
trace.has(x).where(endpoint matches "/api/v1/.*")

// ❌ Unescaped special characters
trace.has(x).where(endpoint matches "/api/v1/admin.")

// ✅ Correct (escape dots)
trace.has(x).where(endpoint matches "/api/v1/admin\\.")

// ❌ Using matches for exact match
trace.has(x).where(endpoint matches "/api/v1/users")

// ✅ Correct (use == for exact match)
trace.has(x).where(endpoint == "/api/v1/users")
```

**Regex Performance:** Complex patterns can be slow. Prefer prefix/suffix matching:

```javascript
// ✅ Fast (prefix match)
trace.has(x).where(endpoint matches "/api/v1/admin/.*")

// ⚠️ Slower (complex pattern)
trace.has(x).where(endpoint matches ".*/(admin|superuser)/.*")

// ✅ Alternative (use OR)
trace.has(x).where(endpoint matches "/api/v1/admin/.*") or
trace.has(x).where(endpoint matches "/api/v1/superuser/.*")
```

## Data Types

### Identifiers

**Syntax:** `[a-zA-Z_][a-zA-Z0-9_.]*`

**Max Length:** 100 characters

**Usage:** Span names, attribute names, attribute values (when not numbers/booleans)

**Examples:**

```javascript
// Valid identifiers
payment.charge_card
api_v1
user123
_private
service.name

// Dotted notation (namespacing)
payment.charge.card
database.query.user_table
```

**Invalid:**

```javascript
// ❌ Starts with number
1payment

// ❌ Contains hyphens
payment-charge

// ❌ Contains spaces
payment charge

// ❌ Too long (> 100 chars)
very_long_identifier_that_exceeds_one_hundred_characters_and_will_be_rejected_by_the_parser...
```

### Numbers

**Syntax:** `[0-9]+ ("." [0-9]+)?`

**Supported:** Integers and decimals

**Examples:**

```javascript
// Integers
trace.has(x).where(count == 5)
trace.has(x).where(status == 200)

// Decimals
trace.has(x).where(amount == 99.99)
trace.has(x).where(latency == 0.5)

// Negative numbers (via comparison)
trace.has(x).where(balance < 0)
```

**Invalid:**

```javascript
// ❌ Scientific notation (not supported)
trace.has(x).where(value == 1.5e10)

// ❌ Hexadecimal (not supported)
trace.has(x).where(flags == 0xFF)

// ❌ Negative literals (use comparison instead)
trace.has(x).where(amount == -100)
```

### Booleans

**Syntax:** `true` | `false`

**Case-Sensitive:** Must be lowercase

**Examples:**

```javascript
// Valid
trace.has(x).where(contains_pii == true)
trace.has(x).where(is_admin == false)

// Invalid
trace.has(x).where(flag == TRUE)   // ❌ Uppercase
trace.has(x).where(flag == True)   // ❌ Capitalized
trace.has(x).where(flag == 1)      // ❌ Numeric (use true/false)
```

### Strings

**Syntax:** `".*"` (double quotes only)

**Max Length:** 10,000 characters (10KB)

**Usage:** Regex patterns for `matches` operator

**Escape Sequences:**

| Sequence | Meaning |
|----------|---------|
| `\n` | Newline |
| `\t` | Tab |
| `\r` | Carriage return |
| `\\` | Backslash |
| `\"` | Double quote |

**Examples:**

```javascript
// Regex pattern (only use for matches)
trace.has(x).where(path matches "/api/v1/.*")

// Escaped characters
trace.has(x).where(path matches "\"quoted\"")
trace.has(x).where(path matches "C:\\\\Windows\\\\System32")

// Multi-line pattern (using \n)
trace.has(x).where(log matches "ERROR.*\nStack trace:")
```

**Common Mistakes:**

```javascript
// ❌ String literals for attribute values
trace.has(x).where(currency == "USD")

// ✅ Correct (use identifier)
trace.has(x).where(currency == USD)

// ❌ Single quotes
trace.has(x).where(path matches '/api/.*')

// ✅ Correct (double quotes only)
trace.has(x).where(path matches "/api/.*")
```

### Lists

**Syntax:** `[identifier, identifier, ...]`

**Usage:** Only with `in` operator

**Elements:** Identifiers only (no strings, numbers, or booleans)

**Examples:**

```javascript
// Valid
trace.has(x).where(processor in [stripe, square, paypal])
trace.has(x).where(status in [pending, processing, complete])

// Invalid
trace.has(x).where(amount in [100, 200, 300])     // ❌ Numbers not supported
trace.has(x).where(flag in [true, false])         // ❌ Booleans not supported
trace.has(x).where(name in ["alice", "bob"])      // ❌ Strings not supported
```

**Workaround for numbers/booleans:**

```javascript
// Instead of: amount in [100, 200, 300]
trace.has(x).where(amount == 100) or
trace.has(x).where(amount == 200) or
trace.has(x).where(amount == 300)

// Or use range:
trace.has(x).where(amount >= 100).where(amount <= 300)
```

## Complete Examples

### Example 1: Payment Fraud Check

```javascript
// Business requirement: All credit card payments over $1000 require fraud validation

trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)
```

**Translation:**
- Find span with `operationName == "payment.charge_card"` AND `attributes.amount > 1000`
- Check if same trace has span with `operationName == "payment.fraud_check"`
- If fraud check missing → generate signal (violation)

### Example 2: PII Access Audit

```javascript
// Compliance requirement: All database queries accessing PII must be audited

trace.has(database.query).where(contains_pii == true)
  and trace.has(audit.log_access)
```

**Translation:**
- Find span with `operationName == "database.query"` AND `attributes.contains_pii == true`
- Check if same trace has span with `operationName == "audit.log_access"`
- If audit log missing → generate signal (SOC2/HIPAA violation)

### Example 3: Admin Endpoint Authorization

```javascript
// Security requirement: Admin endpoints require admin role check

trace.has(api.request).where(endpoint matches "/api/v1/admin/.*")
  and trace.has(auth.check_admin)
```

**Translation:**
- Find span with `operationName == "api.request"` AND `attributes.endpoint` matches regex `/api/v1/admin/.*`
- Check if same trace has span with `operationName == "auth.check_admin"`
- If admin check missing → generate signal (authorization bypass)

### Example 4: Retry Storm Detection

```javascript
// SRE incident: Connection pool exhausted due to excessive retries

trace.count(database.retry) > 10
```

**Translation:**
- Count spans with `operationName == "database.retry"` in trace
- If count > 10 → generate signal (retry storm)

### Example 5: Missing Circuit Breaker

```javascript
// SRE invariant: External API calls exceeding 5s should trigger circuit breaker

trace.has(external_api.call).where(latency > 5000)
  and not trace.has(circuit_breaker.open)
```

**Translation:**
- Find span with `operationName == "external_api.call"` AND `attributes.latency > 5000`
- Check if same trace does NOT have span with `operationName == "circuit_breaker.open"`
- If circuit breaker didn't open → generate signal (resilience violation)

## Summary

**Key Takeaways:**

1. **Identifiers never quoted** - `trace.has(payment.charge)` not `trace.has("payment.charge")`
2. **Strings only for regex** - `matches "/api/.*"` requires quotes
3. **Chain where() clauses** - `.where(x > 1).where(y == 2)` not `.where(x > 1 and y == 2)`
4. **AND/OR/NOT keywords** - Not symbols (`and` not `&&`, `or` not `||`, `not` not `!`)
5. **Security limits enforced** - 64KB DSL, 10KB strings, 100-char identifiers, 50-level nesting

For real-world patterns, see **@.skills/betrace-dsl/pattern-library.md**.
