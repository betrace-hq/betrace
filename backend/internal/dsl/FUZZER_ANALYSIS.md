# DSL Fuzzer Analysis

## Current Coverage Assessment

### What the Fuzzer Tests Well ✅

1. **Syntactic Variety**
   - Boolean combinations (and/or/not)
   - Nested grouping with parentheses
   - Direct attribute comparisons
   - `.where()` clauses with complex predicates
   - `count()` checks with various operators

2. **Edge Cases Covered**
   - Empty conditions (tested in bad rules)
   - Multiple negations
   - Deep nesting (maxDepth=2)
   - Mixed operators (==, !=, <, <=, >, >=)

3. **Error Detection**
   - Found keyword conflict ("count" as attribute name)
   - Validates parser rejects malformed syntax
   - Tests 150 rules per seed (100 valid + 50 invalid)

### Gaps in Current Fuzzer ⚠️

#### 1. **Semantic Realism**
Current rules are **syntactically valid but semantically nonsensical**:
- ❌ `payment.where(status > true)` - comparing status to boolean
- ❌ `customer.role < premium` - comparing role to enum without quotes
- ❌ `token.where(user_id >= bronze)` - mixing numeric field with currency
- ❌ `audit_log.request_id < 524.76` - comparing ID to float

**Real user rules would be:**
```
when { payment.where(amount > 1000 and currency == "USD") }
always { fraud_check and manual_review }
never { skip_validation }
```

#### 2. **Missing Attack Vectors**
Current bad rules are too simple. Real attackers would try:

**Not Tested:**
- ❌ SQL injection attempts: `payment.where(user_id == "1' OR '1'='1")`
- ❌ Buffer overflow: 10KB+ attribute names, deeply nested expressions
- ❌ Regex DoS: `payment.name matches "(.+)+$"` (catastrophic backtracking)
- ❌ Logic bombs: `when { true } always { true } never { true }`
- ❌ Resource exhaustion: 1000+ operations in single rule
- ❌ Unicode/encoding attacks: `payment.where(name == "日本語\u0000")`
- ❌ Operator precedence confusion: ambiguous expressions

**Current bad rules only test:**
- ✅ Syntax errors (missing braces, invalid tokens)
- ✅ Grammar violations (empty conditions)

#### 3. **Real-World Patterns Missing**

**Compliance use cases:**
```
when { pii_access and not audit_log }
always { violation_span }

when { encryption.algorithm == "AES-256" }
always { key_rotation.within_90_days }
```

**Security monitoring:**
```
when { auth.failed and count(auth.failed) > 5 }
always { account_lockout }

when { payment.where(amount > 10000 and country == "high_risk") }
always { manual_review and fraud_score.where(score < 0.5) }
```

**SRE patterns:**
```
when { db_query.where(duration > 1000) and not cache_hit }
always { slow_query_log }

when { count(retry) > 3 }
always { circuit_breaker_open }
```

#### 4. **Complexity Distribution**

Current fuzzer generates **uniformly random** complexity, but real usage follows:
- 70% simple rules (1-2 conditions)
- 25% medium complexity (3-5 conditions)
- 5% complex rules (6+ conditions)

Fuzzer currently: ~50% complex due to maxDepth=2 and random combinations.

## Recommendations

### Short-term Improvements

1. **Add semantic type checking to fuzzer**
   ```go
   // Ensure amount compared to numbers, status to strings, etc.
   randomNumericAttr() // amount, duration, score
   randomStringAttr()  // currency, status, region
   randomBoolAttr()    // verified, active
   ```

2. **Add attack vector tests**
   ```go
   nextMaliciousDSL() // injection, DoS, buffer overflow attempts
   ```

3. **Weight complexity distribution**
   ```go
   // 70% simple, 25% medium, 5% complex
   complexity := weightedChoice([]int{1, 2, 5}, []float64{0.7, 0.25, 0.05})
   ```

4. **Add real-world pattern library**
   ```go
   realWorldTemplates := []string{
       "when { %s.where(amount > %d) } always { fraud_check }",
       "when { count(%s) > %d } always { rate_limit }",
   }
   ```

### Long-term Goals

1. **Property-based testing** - Define invariants the parser must maintain
2. **Differential fuzzing** - Compare against reference implementation
3. **Coverage-guided fuzzing** - Use Go's fuzzing support to maximize code paths
4. **Mutation-based fuzzing** - Start with real rules, apply mutations

## Current Effectiveness Rating

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Syntax coverage | 8/10 | Good variety, missing extreme cases |
| Semantic realism | 3/10 | Valid syntax but nonsensical comparisons |
| Attack vectors | 2/10 | Only tests basic syntax errors |
| Real-world patterns | 4/10 | Random, not representative of actual usage |
| Complexity distribution | 6/10 | Too uniform, needs weighting |
| **Overall** | **5/10** | Validates parser correctness, weak on realism |

## Conclusion

The current fuzzer is **excellent for syntax validation** but **weak on realism and security**.

**Use it for:**
- ✅ Parser correctness testing
- ✅ Grammar regression detection
- ✅ Crash/panic detection

**Don't rely on it for:**
- ❌ Security vulnerability discovery
- ❌ Real-world usage validation
- ❌ Performance/DoS testing
- ❌ Semantic correctness
