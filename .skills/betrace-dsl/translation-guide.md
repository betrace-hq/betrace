# BeTrace DSL to Drools DRL Translation Guide

How BeTrace DSL translates to Drools DRL for pattern matching execution.

## Translation Architecture

```
┌─────────────────────────────────────┐
│  BeTrace DSL (User-facing)             │
│  trace.has(X) and trace.has(Y)      │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Lexer (Tokenization)               │
│  "trace" "." "has" "(" "X" ")" ...  │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Parser (AST Construction)          │
│  BinaryExpression(                  │
│    AND,                             │
│    HasExpression(X),                │
│    HasExpression(Y)                 │
│  )                                  │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  DroolsGenerator (DRL Generation)   │
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

## Component Responsibilities

### Lexer (Tokenization)
- **Input:** Raw BeTrace DSL string
- **Output:** Token stream
- **Role:** Break input into tokens (identifiers, operators, keywords)

### Parser (AST Construction)
- **Input:** Token stream
- **Output:** Abstract Syntax Tree (AST)
- **Role:** Build tree representation of rule logic

### DroolsGenerator (DRL Generation)
- **Input:** AST
- **Output:** Drools DRL (rule definition)
- **Role:** Translate AST to Drools pattern matching syntax

### Drools Fusion Engine
- **Input:** DRL + OpenTelemetry spans
- **Output:** Signal when rule matches
- **Role:** Execute pattern matching, maintain per-tenant state

---

## Translation Examples

### Example 1: Simple Existence Check

**BeTrace DSL:**
```javascript
trace.has(payment.charge)
```

**AST:**
```javascript
HasExpression {
  spanName: "payment.charge",
  whereClauses: []
}
```

**Generated Drools DRL:**
```java
rule "payment-charge-exists"
when
    $span0: SpanCapability(
        operationName == "payment.charge"
    )
then
    sandbox.createSignal(
        $span0,
        "payment-charge-exists",
        "Span payment.charge found"
    );
end
```

**Key Concepts:**
- `SpanCapability` - Sandbox wrapper around Span (PRD-005 security)
- `$span0` - Variable binding for matched span
- `sandbox.createSignal()` - Sandboxed signal generation

---

### Example 2: Existence with Attribute Filtering

**BeTrace DSL:**
```javascript
trace.has(payment.charge).where(amount > 1000)
```

**AST:**
```javascript
HasExpression {
  spanName: "payment.charge",
  whereClauses: [
    WhereClause {
      attribute: "amount",
      operator: ">",
      value: 1000
    }
  ]
}
```

**Generated Drools DRL:**
```java
rule "high-value-payment"
when
    $span0: SpanCapability(
        operationName == "payment.charge",
        attributes["amount"] > 1000
    )
then
    sandbox.createSignal(
        $span0,
        "high-value-payment",
        "High-value payment detected"
    );
end
```

**Key Concepts:**
- `attributes["amount"]` - Span attribute access via map
- Attribute comparisons inlined in Span pattern

---

### Example 3: Two Spans in Same Trace (AND)

**BeTrace DSL:**
```javascript
trace.has(payment.charge) and trace.has(payment.fraud_check)
```

**AST:**
```javascript
BinaryExpression {
  operator: "AND",
  left: HasExpression { spanName: "payment.charge" },
  right: HasExpression { spanName: "payment.fraud_check" }
}
```

**Generated Drools DRL:**
```java
rule "payment-with-fraud-check"
when
    $span0: SpanCapability(
        operationName == "payment.charge",
        $traceId: traceId
    )
    $span1: SpanCapability(
        operationName == "payment.fraud_check",
        traceId == $traceId
    )
then
    sandbox.createSignal(
        $span0,
        "payment-with-fraud-check",
        "Payment with fraud check completed"
    );
end
```

**Key Concepts:**
- `$traceId: traceId` - Extract traceId from first span
- `traceId == $traceId` - Correlate second span to same trace
- **Trace Correlation**: Both spans must have same traceId

---

### Example 4: Missing Span (NOT)

**BeTrace DSL:**
```javascript
trace.has(payment.charge) and not trace.has(payment.fraud_check)
```

**AST:**
```javascript
BinaryExpression {
  operator: "AND",
  left: HasExpression { spanName: "payment.charge" },
  right: NotExpression {
    expression: HasExpression { spanName: "payment.fraud_check" }
  }
}
```

**Generated Drools DRL:**
```java
rule "payment-without-fraud-check"
when
    $span0: SpanCapability(
        operationName == "payment.charge",
        $traceId: traceId
    )
    not SpanCapability(
        operationName == "payment.fraud_check",
        traceId == $traceId
    )
then
    sandbox.createSignal(
        $span0,
        "payment-without-fraud-check",
        "Payment charged without fraud check (VIOLATION)"
    );
end
```

**Key Concepts:**
- `not SpanCapability(...)` - Drools NOT pattern
- Signal generated when fraud check span MISSING
- **Violation Detection**: Missing expected behavior

---

### Example 5: Span Counting

**BeTrace DSL:**
```javascript
trace.count(http.retry) > 3
```

**AST:**
```javascript
CountExpression {
  spanName: "http.retry",
  operator: ">",
  value: 3
}
```

**Generated Drools DRL:**
```java
rule "excessive-retries"
when
    $count: Number(intValue > 3) from accumulate(
        $span: SpanCapability(
            operationName matches "http.retry"
        ),
        count(1)
    )
then
    sandbox.createSignal(
        null,  // No single span to reference
        "excessive-retries",
        "Trace has " + $count + " retries"
    );
end
```

**Key Concepts:**
- `accumulate()` - Drools aggregation function
- `count(1)` - Count matching spans
- `from` - Bind aggregation result to `$count`
- `eval($count > 3)` - Threshold check

---

### Example 6: Multiple Where Clauses (Chained)

**BeTrace DSL:**
```javascript
trace.has(payment.charge).where(amount > 1000).where(currency == USD)
```

**AST:**
```javascript
HasExpression {
  spanName: "payment.charge",
  whereClauses: [
    WhereClause { attribute: "amount", operator: ">", value: 1000 },
    WhereClause { attribute: "currency", operator: "==", value: "USD" }
  ]
}
```

**Generated Drools DRL:**
```java
rule "high-value-usd-payment"
when
    $span0: SpanCapability(
        operationName == "payment.charge",
        attributes["amount"] > 1000,
        attributes["currency"] == "USD"
    )
then
    sandbox.createSignal(
        $span0,
        "high-value-usd-payment",
        "High-value USD payment detected"
    );
end
```

**Key Concepts:**
- Multiple where clauses → Multiple attribute constraints
- All constraints ANDed together in same Span pattern

---

### Example 7: Regex Pattern Matching

**BeTrace DSL:**
```javascript
trace.has(api.request).where(endpoint matches "/api/v1/admin/.*")
```

**AST:**
```javascript
HasExpression {
  spanName: "api.request",
  whereClauses: [
    WhereClause {
      attribute: "endpoint",
      operator: "matches",
      value: "/api/v1/admin/.*"
    }
  ]
}
```

**Generated Drools DRL:**
```java
rule "admin-endpoint-access"
when
    $span0: SpanCapability(
        operationName == "api.request",
        attributes["endpoint"] matches "/api/v1/admin/.*"
    )
then
    sandbox.createSignal(
        $span0,
        "admin-endpoint-access",
        "Admin endpoint accessed"
    );
end
```

**Key Concepts:**
- `matches` operator → Drools regex matching
- Regex pattern passed directly to Drools (Java Pattern class)

---

### Example 8: List Membership (IN)

**BeTrace DSL:**
```javascript
trace.has(payment.charge).where(processor in [stripe, square, paypal])
```

**AST:**
```javascript
HasExpression {
  spanName: "payment.charge",
  whereClauses: [
    WhereClause {
      attribute: "processor",
      operator: "in",
      value: ["stripe", "square", "paypal"]
    }
  ]
}
```

**Generated Drools DRL:**
```java
rule "payment-processor-whitelist"
when
    $span0: SpanCapability(
        operationName == "payment.charge",
        attributes["processor"] in ("stripe", "square", "paypal")
    )
then
    sandbox.createSignal(
        $span0,
        "payment-processor-whitelist",
        "Payment via approved processor"
    );
end
```

**Key Concepts:**
- `in` operator → Drools list membership check
- List expanded inline in DRL

---

## Sandbox Security Model (PRD-005)

### Why Sandboxing?

**Problem:** Drools rules execute arbitrary Java code in `then` clause.

**Risk:** Malicious DSL could access service layer, mutate state, or exfiltrate data.

**Solution:** Capability-based security + bytecode instrumentation.

### Sandbox Components

#### 1. SpanCapability (Immutable Wrapper)

**Purpose:** Prevent rule from mutating span data.

```java
// Generated DRL uses SpanCapability, not Span
$span: SpanCapability(operationName == "payment.charge")

// SpanCapability provides read-only access:
String name = $span.getOperationName();      // ✅ Allowed
Map<String, Object> attrs = $span.getAttributes();  // ✅ Read-only
$span.setOperationName("hacked");            // ❌ Compile error (no setter)
```

#### 2. SandboxedGlobals (Restricted API)

**Purpose:** Limit what `then` clause can do.

```java
// Generated DRL uses sandbox.createSignal(), not direct service access
then
    sandbox.createSignal($span, ruleId, message);  // ✅ Allowed
    signalService.createSignal(...);               // ❌ Blocked (not in scope)
end
```

#### 3. SandboxAgent (Bytecode Instrumentation)

**Purpose:** Prevent reflection, file I/O, network access.

```java
// Drools rules CANNOT:
Class.forName("com.fluo.services.DatabaseService");  // ❌ Blocked
new FileInputStream("/etc/passwd");                  // ❌ Blocked
new Socket("attacker.com", 443);                     // ❌ Blocked
System.exit(0);                                      // ❌ Blocked
```

### Sandbox Verification

**Test:** DroolsGeneratorTest ensures all generated DRL uses sandbox:

```java
@Test
void testSandboxPatterns() {
    String drl = generator.generate(ast);

    // Verify sandbox usage
    assertTrue(drl.contains("SpanCapability"));
    assertTrue(drl.contains("sandbox.createSignal"));

    // Verify no direct service access
    assertFalse(drl.contains("SignalService"));
    assertFalse(drl.contains("@Inject"));
}
```

---

## Per-Tenant Isolation

### Why Per-Tenant KieSessions?

**Problem:** Shared Drools session allows tenants to see each other's data.

**Risk:** Tenant A's rule could match Tenant B's spans (data leak).

**Solution:** Separate KieSession per tenant.

### TenantSessionManager

```java
public class TenantSessionManager {
    private final Map<String, KieSession> sessions = new ConcurrentHashMap<>();

    public KieSession getSession(String tenantId) {
        return sessions.computeIfAbsent(tenantId, this::createSession);
    }

    private KieSession createSession(String tenantId) {
        KieSession session = kieBase.newKieSession();
        session.setGlobal("sandbox", new SandboxedGlobals(tenantId));
        return session;
    }
}
```

**Key Concepts:**
- Each tenant gets isolated KieSession
- Spans only match rules within same tenant's session
- SandboxedGlobals scoped to tenant

---

## Variable Naming Strategy

### Unique Variable Names

**Problem:** Multiple spans in rule need unique variable names.

**Solution:** Auto-increment counter.

```java
// DroolsGenerator maintains counter
private int spanCounter = 0;

private String nextSpanVariable() {
    return "$span" + (spanCounter++);
}
```

**Generated DRL:**
```java
rule "multi-span-rule"
when
    $span0: SpanCapability(operationName == "span1")
    $span1: SpanCapability(operationName == "span2")
    $span2: SpanCapability(operationName == "span3")
then
    sandbox.createSignal($span0, ...);  // First span used for signal
end
```

---

## Trace Correlation Strategy

### Binding traceId from First Span

**Pattern:** Extract `$traceId` from first span, require subsequent spans match.

```java
// First span: Bind traceId
$span0: SpanCapability(
    operationName == "payment.charge",
    $traceId: traceId              // Bind traceId to variable
)

// Second span: Match same traceId
$span1: SpanCapability(
    operationName == "fraud.check",
    traceId == $traceId            // Correlate to same trace
)
```

**Why This Works:**
- Drools creates one rule activation per trace
- All spans in rule must belong to same trace
- Prevents cross-trace matching

---

## Signal Generation

### Signal Structure

```java
public class Signal {
    private String id;            // Auto-generated UUID
    private String ruleId;        // From rule definition
    private String message;       // Human-readable description
    private String tenantId;      // Tenant who owns the signal
    private String traceId;       // Trace that triggered violation
    private String spanId;        // Span that triggered (if single-span rule)
    private Instant timestamp;    // When signal generated
}
```

### Signal Creation in DRL

```java
then
    sandbox.createSignal(
        $span0,                    // Span that triggered (or null for count rules)
        "payment-fraud-check",     // ruleId
        "Payment without fraud check"  // message
    );
end
```

### Sandbox Implementation

```java
public class SandboxedGlobals {
    private final String tenantId;
    private final SignalService signalService;

    public void createSignal(SpanCapability span, String ruleId, String message) {
        Signal signal = Signal.builder()
            .ruleId(ruleId)
            .message(message)
            .tenantId(this.tenantId)
            .traceId(span != null ? span.getTraceId() : null)
            .spanId(span != null ? span.getSpanId() : null)
            .timestamp(Instant.now())
            .build();

        signalService.createSignal(signal);  // Persist to database
    }
}
```

---

## Debugging Translation Issues

### Issue 1: Rule Never Fires

**Symptom:** DRL generated, but no signals created.

**Debug Steps:**
1. **Verify span names match** - Check actual OpenTelemetry spans
2. **Check traceId correlation** - Ensure spans have same traceId
3. **Test with simple rule** - Start with `trace.has(X)` only

---

### Issue 2: Drools Compilation Error

**Symptom:** DRL fails to compile in Drools engine.

**Debug Steps:**
1. **Check generated DRL** - Inspect DroolsGenerator output
2. **Verify syntax** - Ensure valid Drools DRL syntax
3. **Test escaping** - Check string/regex escaping

---

### Issue 3: Sandbox Violations

**Symptom:** SecurityException thrown during rule execution.

**Debug Steps:**
1. **Check SpanCapability usage** - Ensure no direct Span access
2. **Verify SandboxedGlobals** - Only allowed APIs used
3. **Check bytecode agent** - Ensure SandboxAgent loaded

---

## Performance Considerations

### DRL Compilation Cost

**Problem:** Drools compilation is expensive (100-500ms per rule).

**Solution:** Compile once, reuse KieSession.

```java
// ✅ Good: Compile once per tenant
KieSession session = kieBase.newKieSession();  // Reused for all spans

// ❌ Bad: Recompile for every span
for (Span span : spans) {
    KieSession session = kieBase.newKieSession();  // Expensive!
}
```

---

### Span Insertion Cost

**Problem:** Inserting many spans into Drools is expensive.

**Solution:** Batch span insertion.

```java
// ✅ Good: Batch insert
List<Span> batch = collectSpans();  // 100 spans
for (Span span : batch) {
    session.insert(new SpanCapability(span));
}
session.fireAllRules();  // Fire once for entire batch

// ❌ Bad: Insert + fire for each span
for (Span span : spans) {
    session.insert(new SpanCapability(span));
    session.fireAllRules();  // Fire 100 times!
}
```

---

### Pattern Matching Cost

**Problem:** Complex patterns (many spans, many attributes) are slow.

**Optimization:**
- Use attribute indexes in Drools
- Minimize regex patterns (use prefix matching instead)
- Avoid excessive `not` patterns

---

## Summary

**Translation Flow:**
1. **Lexer** - Tokenize BeTrace DSL
2. **Parser** - Build AST
3. **DroolsGenerator** - Translate AST to DRL
4. **Drools Fusion** - Execute pattern matching
5. **SandboxedGlobals** - Generate signals securely

**Key Concepts:**
- **SpanCapability** - Immutable wrapper (security)
- **SandboxedGlobals** - Restricted API (security)
- **Per-Tenant KieSessions** - Isolation (security)
- **Trace Correlation** - `$traceId` binding
- **Variable Naming** - Auto-increment `$span0`, `$span1`, ...

**Security Model:**
- Capability-based (SpanCapability)
- Bytecode instrumentation (SandboxAgent)
- Per-tenant isolation (KieSession)

For DSL syntax, see **@.skills/betrace-dsl/syntax-reference.md**.
For security details, see **@.skills/security/compliance-patterns.md**.
