# DSL Comparison Analysis: TraceQL, LogQL, Datadog Trace Queries vs BeTraceDSL

**Date**: 2025-11-02
**Purpose**: Identify features missing from BeTraceDSL for behavioral pattern matching on OpenTelemetry traces

---

## Executive Summary

This analysis compares BeTraceDSL against three established query languages for observability:
- **Grafana Tempo's TraceQL** - Distributed trace query language
- **Grafana Loki's LogQL** - Log query language with metric aggregation
- **Datadog Trace Queries** - Trace-level analysis with service relationships

**Key Findings:**
1. BeTraceDSL has strong fundamentals for behavioral assertions but is missing critical features for production-grade trace analysis
2. All three comparison languages support multi-scope attribute queries (span, resource, event, link)
3. Aggregation functions are essential for pattern detection (avg, sum, min, max, quantiles)
4. Structural operators (parent/child/descendant/sibling relationships) enable complex trace topology queries
5. Pipeline operators and transformations are standard for multi-stage filtering

---

## Feature Comparison Matrix

| Feature Category | TraceQL | LogQL | Datadog | BeTraceDSL | Gap Priority |
|------------------|---------|-------|---------|------------|--------------|
| **Attribute Scopes** |
| Span attributes | ✅ `span.attr` | ✅ (labels) | ✅ `@attr` | ✅ `span.attr` | None |
| Resource attributes | ✅ `resource.attr` | ✅ (labels) | ✅ `@attr` | ❌ | **HIGH** |
| Event attributes | ✅ `event.attr` | N/A | ✅ | ❌ | **MEDIUM** |
| Link attributes | ✅ `link.attr` | N/A | ✅ (span links) | ❌ | **LOW** |
| Instrumentation scope | ✅ `instrumentation.attr` | N/A | ✅ | ❌ | **LOW** |
| **Intrinsics** |
| Span duration | ✅ `duration` | N/A | ✅ `@duration` | ❌ | **HIGH** |
| Span status | ✅ `status` (error/ok/unset) | N/A | ✅ `@status` | ❌ | **MEDIUM** |
| Span name | ✅ `name` | N/A | ✅ `service` | ✅ (implicit) | None |
| Trace ID | ✅ `trace:id` | N/A | ✅ | ❌ | **LOW** |
| Root span name | ✅ `trace:rootName` | N/A | ✅ | ❌ | **MEDIUM** |
| Trace duration | ✅ `trace:duration` | N/A | ✅ | ❌ | **HIGH** |
| **Comparison Operators** |
| Equality | ✅ `=` | ✅ `==` | ✅ `:` | ✅ `==` | None |
| Inequality | ✅ `!=` | ✅ `!=` | ✅ `-:` | ✅ `!=` | None |
| Numeric comparisons | ✅ `>`, `>=`, `<`, `<=` | ✅ | ✅ | ✅ | None |
| Regex match | ✅ `=~` | ✅ `=~` | ✅ regex | ✅ `matches` | None |
| Negated regex | ✅ `!~` | ✅ `!~` | ✅ | ❌ | **LOW** |
| Contains | ❌ | ✅ `\|=`, `!=` | ✅ | ✅ | None |
| In list | ✅ `in` | N/A | ✅ | ✅ | None |
| **Structural Operators** |
| Direct child | ✅ `>` | N/A | ✅ (implicit) | ❌ | **HIGH** |
| Direct parent | ✅ `<` | N/A | ✅ (implicit) | ❌ | **HIGH** |
| Descendant | ✅ `>>` | N/A | ✅ (implicit) | ❌ | **CRITICAL** |
| Ancestor | ✅ `<<` | N/A | ✅ (implicit) | ❌ | **CRITICAL** |
| Sibling | ✅ `~` | N/A | ✅ (implicit) | ❌ | **MEDIUM** |
| Negated structural | ✅ `!>>`, `!<<` (exp) | N/A | ❌ | ❌ | **LOW** |
| **Aggregation Functions** |
| Count | ✅ `count()` | ✅ `count_over_time()` | ✅ | ✅ `count()` | None |
| Average | ✅ `avg()` | ✅ `avg()` | ✅ | ❌ | **HIGH** |
| Min/Max | ✅ `min()`, `max()` | ✅ | ✅ | ❌ | **HIGH** |
| Sum | ✅ `sum()` | ✅ `sum()` | ✅ | ❌ | **HIGH** |
| Rate | ❌ | ✅ `rate()` | ✅ | ❌ | **MEDIUM** |
| Quantiles | ✅ `quantile_over_time()` | ✅ | ✅ | ❌ | **MEDIUM** |
| TopK/BottomK | ❌ | ✅ `topk()`, `bottomk()` | ✅ | ❌ | **MEDIUM** |
| Standard deviation | ❌ | ✅ `stddev()` | ✅ | ❌ | **LOW** |
| **Grouping & Selection** |
| Group by | ✅ `by()` | ✅ `by()` | ✅ `group by` | ❌ | **HIGH** |
| Field selection | ✅ `select()` | N/A | ✅ | ❌ | **MEDIUM** |
| **Pipeline Operations** |
| Pipeline operator | ✅ `\|` | ✅ `\|` | N/A | ❌ | **MEDIUM** |
| Chained filtering | ✅ | ✅ | ✅ | ✅ (limited) | Partial |
| **Time/Duration** |
| Duration literals | ✅ `10s`, `5m`, `1h` | ✅ | ✅ | ❌ | **HIGH** |
| Time range queries | ✅ `[5m]` | ✅ | ✅ | ❌ | **LOW** |
| Duration arithmetic | ✅ | ✅ | ✅ | ❌ | **MEDIUM** |
| **Data Types** |
| String | ✅ | ✅ | ✅ | ✅ | None |
| Number | ✅ | ✅ | ✅ | ✅ | None |
| Float | ✅ | ✅ | ✅ | ✅ | None |
| Boolean | ✅ | ✅ | ✅ | ✅ | None |
| Duration | ✅ | ✅ `duration()` | ✅ | ❌ | **HIGH** |
| Status enum | ✅ (error/ok/unset) | N/A | ✅ | ❌ | **MEDIUM** |
| Bytes | ❌ | ✅ `bytes()` | ✅ | ❌ | **LOW** |
| **Boolean Logic** |
| AND | ✅ `&&` | ✅ `and` | ✅ `AND` | ✅ `and` | None |
| OR | ✅ `\|\|` | ✅ `or` | ✅ `OR` | ✅ `or` | None |
| NOT | ✅ `!` | ✅ `unless` | ✅ `NOT` | ✅ `not` | None |
| Parenthetical grouping | ✅ | ✅ | ✅ | ✅ | None |
| **Parsing (Log-specific)** |
| JSON parser | N/A | ✅ `\| json` | N/A | N/A | N/A |
| Logfmt parser | N/A | ✅ `\| logfmt` | N/A | N/A | N/A |
| Pattern parser | N/A | ✅ `\| pattern` | N/A | N/A | N/A |
| Regex parser | N/A | ✅ `\| regexp` | N/A | N/A | N/A |
| **Advanced Features** |
| Arithmetic operations | ✅ `+`, `-`, `*`, `/`, `%`, `^` | ✅ | ✅ | ❌ | **MEDIUM** |
| Label/attribute extraction | ✅ | ✅ | ✅ | ❌ | **LOW** |
| Unwrapping | N/A | ✅ `\| unwrap` | N/A | N/A | N/A |
| Formatting | N/A | ✅ `\| label_format` | N/A | N/A | N/A |
| Comments | ❌ | ✅ `#` | ❌ | ✅ `//` | None |

---

## Detailed Feature Analysis

### 1. Attribute Scopes

**What They Have:**

**TraceQL** provides five distinct attribute scopes:
```traceql
{ span.http.status_code = 200 }           // Span attributes
{ resource.service.name = "frontend" }    // Resource attributes
{ event.exception.type = "NullPointer" }  // Event attributes
{ link.trace_id = "abc123" }              // Link attributes
{ instrumentation.name = "opentelemetry" } // Instrumentation scope
```

**LogQL** treats all extracted labels equally (no formal scoping), but achieves similar functionality through parsers:
```logql
{container="app"} | json | http_status="200"
```

**Datadog** uses `@` prefix for custom attributes and supports peer attributes for external dependencies:
```datadog
@peer.db.name:users @peer.db.system:postgres
```

**What BeTraceDSL Has:**

```javascript
// Span name + span attributes only
payment.charge_card.where(amount > 1000)
```

**Gap Analysis:**

BeTraceDSL only supports span-level attributes. Missing:
- **Resource attributes** (service name, namespace, cluster) - **CRITICAL** for multi-service traces
- **Event attributes** (exceptions, logs) - **MEDIUM** priority for debugging
- **Link attributes** (cross-trace relationships) - **LOW** priority initially
- **Instrumentation scope** - **LOW** priority

**Impact:** Cannot filter by service name, namespace, or other resource-level attributes that are essential for multi-service pattern matching.

**Recommendation:** Add `resource.`, `event.`, `link.`, and `instrumentation.` scope prefixes.

---

### 2. Intrinsic Fields

**What They Have:**

**TraceQL** provides intrinsics for fundamental span/trace properties:
```traceql
{ duration > 5s }                    // Span duration
{ status = error }                   // Span status (error/ok/unset)
{ name = "POST /api/orders" }        // Span operation name
{ trace:id = "abc123" }              // Trace ID
{ trace:rootName = "frontend" }      // Root span name
{ trace:duration > 1s }              // Total trace duration
```

**Datadog** supports similar intrinsics:
```datadog
@duration:>5s @status:error
```

**What BeTraceDSL Has:**

```javascript
// Only span name (implicit)
payment.charge_card

// No duration, status, or trace-level intrinsics
```

**Gap Analysis:**

Missing critical intrinsics:
- **Span duration** - **CRITICAL** for latency-based patterns
- **Trace duration** - **HIGH** for end-to-end performance
- **Span status** - **MEDIUM** for error detection
- **Root span name** - **MEDIUM** for entry-point filtering
- **Trace ID** - **LOW** for debugging

**Impact:** Cannot detect latency-based anomalies (e.g., "payment took > 5s") or error conditions without custom attributes.

**Recommendation:** Add `span.duration`, `span.status`, `trace.duration`, `trace.rootName`, `trace.id` intrinsics.

---

### 3. Structural Operators

**What They Have:**

**TraceQL** provides structural operators for trace topology queries:
```traceql
// Direct child
{ resource.service.name = "frontend" } > { span.http.method = "POST" }

// Descendant (anywhere downstream)
{ resource.service.name = "frontend" } >> { span.db.system = "postgres" }

// Direct parent
{ span.db.system = "postgres" } < { resource.service.name = "backend" }

// Ancestor (anywhere upstream)
{ span.db.system = "postgres" } << { resource.service.name = "frontend" }

// Sibling (same parent)
{ span.http.method = "GET" } ~ { span.cache.hit = true }

// Negated structural (experimental)
{ span.http.method = "POST" } !>> { span.db.system = "postgres" } // No DB downstream
```

**Datadog** supports structural queries through trace-level relationships:
```datadog
// Query traces where span A (web-store) has error and span B (payments-go) exists
a: service:web-store status:error
b: service:payments-go
// Traces matching: a AND b
```

**What BeTraceDSL Has:**

```javascript
// Only flat AND/OR logic - no parent/child relationships
payment.charge_card and payment.fraud_check
```

**Gap Analysis:**

Missing all structural operators:
- **Descendant `>>`** - **CRITICAL** for "payment must call fraud_check downstream"
- **Ancestor `<<`** - **CRITICAL** for "DB query must have auth upstream"
- **Direct child `>`** - **HIGH** for immediate parent/child assertions
- **Direct parent `<`** - **HIGH** for reverse relationships
- **Sibling `~`** - **MEDIUM** for parallel operations
- **Negated structural** - **LOW** (experimental feature)

**Impact:** Cannot express trace topology patterns like "payment must have fraud_check as descendant" or "DB access must have auth as ancestor". This is a **CRITICAL** gap for behavioral assurance.

**Recommendation:** Implement structural operators as **top priority**. Start with descendant (`>>`) and ancestor (`<<`), then add direct parent/child.

---

### 4. Aggregation Functions

**What They Have:**

**TraceQL** supports aggregation functions for metrics:
```traceql
{ status = error } | count() > 3          // Count errors
{ span.http.method = "POST" } | avg(duration) > 100ms
{ resource.service.name = "db" } | max(duration) by (resource.cluster)
{ span.http.status_code >= 500 } | sum(span.http.response_size)
{ duration > 1s } | quantile_over_time(duration, 0.99)
```

**LogQL** provides comprehensive aggregation:
```logql
sum(rate({job="mysql"} |= "error" [5m])) by (host)
avg(count_over_time({app="frontend"}[1m]))
max by (service) (rate({app="backend"}[5m]))
topk(5, sum by (endpoint) (rate({job="api"}[5m])))
bottomk(3, avg by (region) (count_over_time({app="worker"}[1m])))
stddev(rate({app="db"}[5m]))
```

**Datadog** supports aggregations in trace queries:
```datadog
avg:@duration by service
p99:@duration by endpoint
count by @http.status_code
```

**What BeTraceDSL Has:**

```javascript
// Only count()
count(retry) > 3
```

**Gap Analysis:**

Missing critical aggregation functions:
- **avg()** - **HIGH** for latency analysis ("avg payment duration > 5s")
- **min()/max()** - **HIGH** for outlier detection
- **sum()** - **HIGH** for volume analysis
- **rate()** - **MEDIUM** for throughput patterns
- **quantile_over_time()** - **MEDIUM** for p95/p99 latency
- **topk()/bottomk()** - **MEDIUM** for ranking
- **stddev()** - **LOW** for variance detection

**Impact:** Cannot express patterns like "average retry duration exceeds threshold" or "p99 latency spike detected".

**Recommendation:** Implement `avg()`, `min()`, `max()`, `sum()` as **high priority**.

---

### 5. Grouping & Selection

**What They Have:**

**TraceQL** supports grouping and field selection:
```traceql
// Group by attribute
{ status = error } | count() by (resource.service.name)

// Select specific fields
{ span.http.method = "POST" } | select(span.http.status_code, duration)
```

**LogQL** provides grouping modifiers:
```logql
sum by (host) (rate({app="frontend"}[5m]))
avg without (instance) (count_over_time({app="backend"}[1m]))
```

**Datadog** supports grouping in trace queries:
```datadog
@http.status_code:200 group by @service.name
```

**What BeTraceDSL Has:**

```javascript
// No grouping or selection
count(retry) > 3
```

**Gap Analysis:**

Missing:
- **Group by** - **HIGH** for multi-dimensional analysis ("count errors by service")
- **Field selection** - **MEDIUM** for performance optimization

**Impact:** Cannot aggregate violations by dimensions (service, endpoint, region).

**Recommendation:** Implement `by()` clause for grouping: `count(error) by (service.name) > 10`.

---

### 6. Duration & Time Handling

**What They Have:**

**TraceQL** supports duration literals and arithmetic:
```traceql
{ duration > 5s }                  // 5 seconds
{ duration > 100ms }               // 100 milliseconds
{ trace:duration > 1m }            // 1 minute
{ duration > 1h }                  // 1 hour
```

**LogQL** supports duration literals and range queries:
```logql
rate({app="frontend"}[5m])         // 5-minute range
count_over_time({app="backend"}[1h])
duration > 10s and throughput_mb < 500
```

**Datadog** supports duration queries:
```datadog
@duration:>5s @duration:<100ms
```

**What BeTraceDSL Has:**

```javascript
// No duration support - only numbers
payment.where(latency_ms > 5000)  // Must use milliseconds as number
```

**Gap Analysis:**

Missing:
- **Duration literals** - **HIGH** for readability (`5s` vs `5000`)
- **Duration intrinsics** - **CRITICAL** (see section 2)
- **Duration arithmetic** - **MEDIUM** for complex conditions
- **Time range queries** - **LOW** for historical analysis

**Impact:** Poor readability and no native duration comparisons.

**Recommendation:** Implement duration literals (`5s`, `100ms`, `1m`, `1h`) and `span.duration` intrinsic.

---

### 7. Pipeline Operators

**What They Have:**

**TraceQL** uses pipeline operators for multi-stage processing:
```traceql
{ status = error }
  | count() > 3
  | avg(duration) > 100ms
```

**LogQL** extensively uses pipelines:
```logql
{container="app"}
  | json                          // Parse JSON
  | line_format "{{.message}}"   // Format output
  | http_status >= 500           // Filter
  | rate([5m])                   // Aggregate
```

**What BeTraceDSL Has:**

```javascript
// Limited chaining with .where()
payment.where(amount > 1000).where(currency == USD)
```

**Gap Analysis:**

Missing:
- **Pipeline operator `|`** - **MEDIUM** for readability
- **Multi-stage filtering** - **MEDIUM** (partially addressed by chained `.where()`)

**Impact:** Less readable for complex multi-stage filters.

**Recommendation:** Consider pipeline operator for future enhancement, but not critical given chained `.where()` support.

---

### 8. Arithmetic Operations

**What They Have:**

**TraceQL** supports arithmetic:
```traceql
{ span.http.response_size * span.http.request_count > 1000000 }
```

**LogQL** supports arithmetic:
```logql
sum(rate({app="frontend"}[5m])) * 100
```

**Datadog** supports arithmetic in queries.

**What BeTraceDSL Has:**

```javascript
// No arithmetic operations
payment.where(amount > 1000)
```

**Gap Analysis:**

Missing:
- **Arithmetic operators** - **MEDIUM** for computed conditions (`+`, `-`, `*`, `/`, `%`, `^`)

**Impact:** Cannot express patterns like "retry_count * latency > threshold" or compute ratios.

**Recommendation:** Implement arithmetic as **medium priority**.

---

## Priority-Ranked Feature Gaps

### CRITICAL Priority (Blocking Production Use)

1. **Structural Operators (Descendant/Ancestor)**
   - **Why Critical:** Core to behavioral pattern matching (e.g., "payment must have fraud_check downstream")
   - **Syntax Proposal:** `payment >> fraud_check` (descendant), `db_query << auth_check` (ancestor)
   - **Effort:** High (requires trace topology analysis)

2. **Resource Attributes**
   - **Why Critical:** Essential for multi-service traces (filter by service name, namespace, cluster)
   - **Syntax Proposal:** `resource.service.name == "frontend"`
   - **Effort:** Medium (extend scope system)

3. **Span Duration Intrinsic**
   - **Why Critical:** Latency-based patterns are fundamental (e.g., "payment.duration > 5s")
   - **Syntax Proposal:** `span.duration > 5s` or `payment.where(duration > 5s)`
   - **Effort:** Medium (add intrinsic + duration parsing)

### HIGH Priority (Essential for Completeness)

4. **Trace Duration Intrinsic**
   - **Why High:** End-to-end latency patterns
   - **Syntax Proposal:** `trace.duration > 10s`
   - **Effort:** Low (similar to span.duration)

5. **Aggregation Functions (avg, min, max, sum)**
   - **Why High:** Statistical analysis of patterns
   - **Syntax Proposal:** `avg(payment.duration) > 5s by service.name`
   - **Effort:** Medium (implement aggregation engine)

6. **Group By Clause**
   - **Why High:** Multi-dimensional analysis
   - **Syntax Proposal:** `count(error) by (service.name, endpoint) > 10`
   - **Effort:** Medium (implement grouping)

7. **Direct Parent/Child Operators**
   - **Why High:** Immediate structural relationships
   - **Syntax Proposal:** `parent > child` (direct child), `child < parent` (direct parent)
   - **Effort:** Medium (extend structural operators)

8. **Duration Literals**
   - **Why High:** Readability and consistency
   - **Syntax Proposal:** `5s`, `100ms`, `1m`, `1h`
   - **Effort:** Low (lexer + parser update)

### MEDIUM Priority (Nice to Have)

9. **Event Attributes Scope**
   - **Why Medium:** Debugging with span events (exceptions)
   - **Syntax Proposal:** `event.exception.type == "NullPointer"`
   - **Effort:** Medium

10. **Span Status Intrinsic**
    - **Why Medium:** Error detection patterns
    - **Syntax Proposal:** `span.status == error` (enum: error/ok/unset)
    - **Effort:** Low

11. **Root Span Name Intrinsic**
    - **Why Medium:** Entry-point filtering
    - **Syntax Proposal:** `trace.rootName == "frontend"`
    - **Effort:** Low

12. **Sibling Operator**
    - **Why Medium:** Parallel operation patterns
    - **Syntax Proposal:** `cache_lookup ~ db_query` (siblings)
    - **Effort:** Medium

13. **Rate Aggregation**
    - **Why Medium:** Throughput patterns
    - **Syntax Proposal:** `rate(error) > 10 per minute`
    - **Effort:** Medium

14. **Quantile Aggregation**
    - **Why Medium:** p95/p99 latency patterns
    - **Syntax Proposal:** `quantile(payment.duration, 0.99) > 5s`
    - **Effort:** Medium

15. **TopK/BottomK Aggregation**
    - **Why Medium:** Ranking patterns
    - **Syntax Proposal:** `topk(5, count(error) by service)`
    - **Effort:** Medium

16. **Arithmetic Operations**
    - **Why Medium:** Computed conditions
    - **Syntax Proposal:** `retry_count * latency > 1000`
    - **Effort:** Medium

17. **Field Selection**
    - **Why Medium:** Performance optimization
    - **Syntax Proposal:** `select(service.name, duration)`
    - **Effort:** Low

18. **Pipeline Operator**
    - **Why Medium:** Readability (already have chained `.where()`)
    - **Syntax Proposal:** `payment | where(amount > 1000) | where(currency == USD)`
    - **Effort:** Low

### LOW Priority (Future Enhancements)

19. **Link Attributes Scope**
20. **Instrumentation Scope**
21. **Trace ID Intrinsic**
22. **Negated Regex**
23. **Negated Structural Operators**
24. **Standard Deviation Aggregation**
25. **Time Range Queries**
26. **Label/Attribute Extraction**
27. **Bytes Data Type**

---

## Unique Features of Comparison Languages (Not Relevant to BeTrace)

### LogQL-Specific (Log Parsing)
- JSON/Logfmt/Pattern/Regexp parsers - **N/A** (BeTrace uses structured OTel spans)
- Unwrap operator - **N/A**
- Label formatting - **N/A**
- Line filters (`|=`, `!=`) - **N/A**

### Datadog-Specific
- Peer attributes (`@peer.db.name`) - **MAYBE** useful for external dependencies
- Flow Map visualization - **N/A** (UI feature)
- Span links visualization - **N/A** (UI feature)

---

## Syntax Comparison Examples

### Example 1: High-Value Payment Without Fraud Check

**TraceQL:**
```traceql
{ resource.service.name = "payment" && span.http.method = "POST" && span.amount > 1000 }
  >> { resource.service.name = "fraud-detector" }
```

**LogQL:**
N/A (log-based, not trace topology)

**Datadog:**
```datadog
a: service:payment @http.method:POST @amount:>1000
b: service:fraud-detector
// Traces matching: a AND b (implicit descendant)
```

**BeTraceDSL (Current):**
```javascript
// Cannot express descendant relationship!
payment.charge_card.where(amount > 1000) and fraud_check
// This only checks if BOTH spans exist, not if fraud_check is downstream of payment
```

**BeTraceDSL (Proposed):**
```javascript
payment.charge_card.where(amount > 1000) >> fraud_check
```

---

### Example 2: Average Payment Latency Exceeds Threshold

**TraceQL:**
```traceql
{ resource.service.name = "payment" && span.http.method = "POST" }
  | avg(duration) by (span.http.endpoint) > 5s
```

**LogQL:**
```logql
avg by (endpoint) (rate({service="payment", http_method="POST"}[5m])) > 5
```

**Datadog:**
```datadog
service:payment @http.method:POST
avg:@duration by @http.endpoint > 5000
```

**BeTraceDSL (Current):**
```javascript
// Cannot express average duration!
// Only: payment.charge_card
```

**BeTraceDSL (Proposed):**
```javascript
avg(payment.charge_card.duration) by (endpoint) > 5s
```

---

### Example 3: Database Query Without Auth Ancestor

**TraceQL:**
```traceql
{ span.db.system = "postgres" && span.db.operation = "SELECT" }
  !<< { resource.service.name = "auth" }
```

**LogQL:**
N/A (log-based)

**Datadog:**
```datadog
a: @db.system:postgres @db.operation:SELECT
b: service:auth
// Traces matching: a NOT b (implicit NOT ancestor)
```

**BeTraceDSL (Current):**
```javascript
// Cannot express ancestor relationship!
database.query_pii and not auth.check
// This checks if auth span doesn't exist, not if it's missing as ancestor
```

**BeTraceDSL (Proposed):**
```javascript
database.query.where(operation == SELECT) and not (<< auth.check)
// Or: database.query.where(operation == SELECT) !<< auth.check
```

---

### Example 4: Error Rate by Service Exceeds Threshold

**TraceQL:**
```traceql
{ status = error }
  | count() by (resource.service.name) > 10
```

**LogQL:**
```logql
sum by (service) (rate({job="app", level="error"}[5m])) > 10
```

**Datadog:**
```datadog
status:error
count by @service.name > 10
```

**BeTraceDSL (Current):**
```javascript
// Cannot group by service!
count(error) > 10
```

**BeTraceDSL (Proposed):**
```javascript
count(span.where(status == error)) by (resource.service.name) > 10
```

---

### Example 5: Multi-Scope Attribute Query

**TraceQL:**
```traceql
{ resource.service.name = "frontend" }  // Resource scope
  >> { span.http.method = "POST" }       // Span scope
  >> { event.exception.type = "NullPointer" }  // Event scope
```

**LogQL:**
N/A (no formal scoping)

**Datadog:**
```datadog
service:frontend @http.method:POST @exception.type:NullPointer
```

**BeTraceDSL (Current):**
```javascript
// No resource or event scopes!
frontend and http_request.where(method == POST)
```

**BeTraceDSL (Proposed):**
```javascript
resource.service.name == "frontend"
  >> span.http.method == POST
  >> event.exception.type == "NullPointer"
```

---

## Recommendations for BeTraceDSL

### Phase 1: Critical Gaps (MVP for Production)

1. **Implement Structural Operators**
   - Descendant (`>>`) and ancestor (`<<`) operators
   - Enable trace topology queries
   - **Estimated effort:** 2-3 weeks

2. **Add Resource Attributes Scope**
   - `resource.service.name`, `resource.namespace`, `resource.cluster`
   - Essential for multi-service patterns
   - **Estimated effort:** 1 week

3. **Implement Span Duration Intrinsic**
   - `span.duration > 5s` or `payment.where(duration > 5s)`
   - Add duration literals (`5s`, `100ms`, `1m`, `1h`)
   - **Estimated effort:** 1 week

### Phase 2: High Priority (Production-Grade)

4. **Add Aggregation Functions**
   - `avg()`, `min()`, `max()`, `sum()`
   - **Estimated effort:** 2 weeks

5. **Implement Group By**
   - `count(error) by (service.name) > 10`
   - **Estimated effort:** 1 week

6. **Add Trace Duration Intrinsic**
   - `trace.duration > 10s`
   - **Estimated effort:** 3 days

7. **Implement Direct Parent/Child Operators**
   - `parent > child` (direct child), `child < parent` (direct parent)
   - **Estimated effort:** 1 week

### Phase 3: Medium Priority (Feature Completeness)

8. **Add Event Attributes Scope**
   - `event.exception.type`, `event.log.message`
   - **Estimated effort:** 1 week

9. **Implement Span Status Intrinsic**
   - `span.status == error` (enum: error/ok/unset)
   - **Estimated effort:** 3 days

10. **Add Additional Aggregations**
    - `rate()`, `quantile()`, `topk()`, `bottomk()`
    - **Estimated effort:** 2 weeks

11. **Implement Sibling Operator**
    - `cache_lookup ~ db_query`
    - **Estimated effort:** 1 week

12. **Add Arithmetic Operations**
    - `retry_count * latency > 1000`
    - **Estimated effort:** 1 week

### Phase 4: Low Priority (Future Enhancements)

- Link attributes scope
- Instrumentation scope
- Trace ID intrinsic
- Negated structural operators
- Time range queries
- Label extraction

---

## Conclusion

BeTraceDSL has a solid foundation for behavioral pattern matching but is missing **critical features** for production-grade trace analysis:

**Must-Have (Blocking):**
1. Structural operators (descendant/ancestor) - **Can't do trace topology without these**
2. Resource attributes scope - **Can't filter multi-service traces**
3. Span duration intrinsic - **Can't detect latency patterns**

**Should-Have (Essential):**
4. Aggregation functions (avg/min/max/sum)
5. Group by clause
6. Trace duration intrinsic
7. Direct parent/child operators

**Nice-to-Have (Completeness):**
8. Event attributes scope
9. Span status intrinsic
10. Rate/quantile aggregations
11. Arithmetic operations

**Total estimated effort for MVP (Phase 1):** 4-5 weeks
**Total estimated effort for Production-Grade (Phase 1+2):** 8-10 weeks

---

## Appendix: Reference Documentation

- **TraceQL**: https://grafana.com/docs/tempo/latest/traceql/
- **LogQL**: https://grafana.com/docs/loki/latest/query/
- **Datadog Trace Queries**: https://docs.datadoghq.com/tracing/trace_explorer/trace_queries/
- **BeTraceDSL**: /Users/sscoble/Projects/betrace/docs/DSL_SYNTAX_FINAL.md
