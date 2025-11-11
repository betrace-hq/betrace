# DSL Parser Fuzzing & Security Testing

## Overview

The BeTraceDSL parser includes comprehensive **deterministic simulation testing (DST)** with fuzzing to validate correctness and security robustness.

## Test Coverage

### 1. Deterministic Fuzzing (`fuzz_test.go`)

**Tests**: 4 test functions
- `TestFuzzDSLParser` - Main fuzzing campaign (100 valid + 50 invalid rules)
- `TestFuzzDSLDeterminism` - Verifies same seed = same output
- `TestFuzzDSLVariety` - Ensures diverse rule generation (>80% unique)
- `TestFuzzDSLComplexCases` - Validates pattern coverage

**Generated Patterns**:
- ✅ `.where()` clauses (87% of samples)
- ✅ Direct attribute comparisons (10% of samples)
- ✅ `count()` checks (44% of samples)
- ✅ Grouping with parentheses (89% of samples)
- ✅ Negation (38% of samples)
- ✅ Boolean combinations (and/or)
- ✅ Nested expressions (maxDepth=2)

**Results**: 232 seeds tested (100 seconds), **0 failures**, 34,800+ rules validated

### 2. Security Robustness (`security_test.go`)

**Tests**: 3 test functions, 14 security scenarios

**Validated Attack Vectors**:
- ✅ SQL injection in strings (`"1' OR '1'='1"`) - Safe (just literals)
- ✅ Unicode/emoji in strings (`"日本語"`, `"💰🔒"`) - Allowed
- ✅ Null bytes (`\u0000`) - Handled safely
- ✅ Very long identifiers (10KB, 100KB) - Parses in <10ms
- ✅ Deep nesting (100 levels) - Parses in <1ms
- ✅ Large string literals (1MB) - Parses in <50ms
- ✅ No panics across 200 random inputs
- ✅ Memory bounds tested (1000 operations)

**Performance**:
- Normal rules: <100µs
- 10KB identifier: <500µs
- 100-level nesting: <1ms
- 1MB string: <50ms

### 3. Unit Tests (`parser_test.go`)

**Tests**: 12 hand-crafted test cases
- Basic syntax (when/always/never)
- Grouping and boolean operators
- `.where()` clauses
- Direct attribute comparisons
- `count()` checks
- Complex real-world examples

## Usage

### Run All Tests
```bash
go test ./internal/dsl/... -v
```

### Run Specific Seed
```bash
DSL_FUZZ_SEED=99999 go test ./internal/dsl/... -run TestFuzzDSLParser -v
```

### Run Fuzzing Campaign (1000 seeds)
```bash
bash backend/scripts/dsl-fuzzer.sh
```

### Run Security Tests Only
```bash
go test ./internal/dsl/... -run TestSecurity -v
```

## Fuzzer Implementation

### Valid DSL Generation (`nextGoodDSL`)

Generates syntactically correct rules with:
- Random `when` conditions (always present)
- Optional `always` clause (70% probability)
- Optional `never` clause (50% probability)
- Nested boolean expressions (maxDepth=2)
- Mixed span checks (existence, comparisons, where clauses, count)

**Semantic Limitation**: Generated rules are syntactically valid but may be semantically nonsensical (e.g., comparing status to numbers). This is intentional - semantic validation happens at runtime, not parse time.

### Invalid DSL Generation (`nextBadDSL`)

Generates malformed syntax:
- Missing braces, clauses, or operators
- Invalid tokens (&&, >>, etc.)
- Empty conditions
- Unmatched parentheses
- Invalid attribute names (starting with numbers)
- Dangling operators

### Security Testing

Separate `nextMaliciousDSL` (currently aliases `nextBadDSL`) for future expansion of adversarial inputs.

## Current Limitations

### What's NOT Tested

1. **Semantic Correctness**
   - Type checking (amount vs strings)
   - Attribute existence validation
   - Operation name validation

2. **Real-World Patterns**
   - Compliance use cases
   - Security monitoring patterns
   - SRE best practices

3. **Advanced Attacks**
   - Regex DoS (when `matches` operator is implemented)
   - Resource exhaustion at scale
   - Timing attacks

### Why These Are OK

- **Parse-time testing** validates syntax only
- **Runtime validation** handles semantics
- **Separate integration tests** cover real-world usage

## Fuzzer Effectiveness

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Syntax coverage | **9/10** | Excellent variety, fast execution |
| Grammar regression | **10/10** | Catches parser bugs immediately |
| Security robustness | **8/10** | Validates safe handling of adversarial inputs |
| Semantic realism | **3/10** | Random, not representative (by design) |
| Real-world patterns | **4/10** | Would need pattern library |

## Future Improvements

1. **Weighted complexity** - More simple rules (like real usage)
2. **Pattern library** - Real compliance/security/SRE templates
3. **Coverage-guided fuzzing** - Use Go 1.18+ fuzzing
4. **Mutation-based fuzzing** - Start with real rules, apply mutations
5. **Semantic validators** - Type-aware generation

## References

- [FUZZER_ANALYSIS.md](FUZZER_ANALYSIS.md) - Detailed gap analysis
- [DST pattern](../simulation/) - Backend simulation testing approach
- [Parser implementation](parser.go) - PEG grammar using Participle
