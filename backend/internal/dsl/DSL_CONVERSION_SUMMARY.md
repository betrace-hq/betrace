# DSL Conversion Summary

**Date**: 2025-11-11
**Task**: Convert 45 example YAML rules from old `trace.has()` syntax to new when-always-never syntax

## Conversion Results

### Files Converted

1. **examples/rules/ai-agent-safety.yaml**
   - Rules converted: 12
   - Manual review needed: 6 rules
   - Original backed up to: `ai-agent-safety.yaml.old`

2. **examples/rules/compliance-evidence.yaml**
   - Rules converted: 15
   - Manual review needed: 5 rules
   - Original backed up to: `compliance-evidence.yaml.old`

3. **examples/rules/reliability-sre.yaml**
   - Rules converted: 18
   - Manual review needed: 12 rules
   - Original backed up to: `reliability-sre.yaml.old`

**Total**: 45 rules converted, 23 rules need manual review (51%)

## Conversion Patterns Applied

### Pattern 1: Simple Always Assertion
**Old Syntax**:
```yaml
trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)
```

**New Syntax**:
```yaml
when { payment.charge_card.where(amount > 1000) }
always { payment.fraud_check }
```

**Semantics**: When high-value payment exists, fraud check must also exist (else violation).

---

### Pattern 2: Never Assertion
**Old Syntax**:
```yaml
trace.has(agent.tool_use).where(tool_requires_approval == true)
  and not trace.has(human.approval_granted)
```

**New Syntax**:
```yaml
when { agent.tool_use.where(tool_requires_approval == true) }
never { human.approval_granted }
```

**Semantics**: When tool requiring approval is used, approval must NOT exist (else violation).

---

### Pattern 3: Multi-Condition When Clause
**Old Syntax**:
```yaml
trace.has(agent.plan.created)
  and trace.has(agent.plan.executed)
  and trace.has(agent.action).where(goal_deviation_score > 0.3)
```

**New Syntax**:
```yaml
when { agent.plan.created and agent.plan.executed }
always { agent.action.where(goal_deviation_score > 0.3) }
```

**Semantics**: When plan is created and executed, action with high deviation score must exist (violation indicator).

---

### Pattern 4: Count Comparisons
**Old Syntax**:
```yaml
trace.count(http.request) != trace.count(http.response)
```

**New Syntax**:
```yaml
# TODO: Add always/never clause
when { count(http.request) != count(http.response) }
```

**Manual Review Needed**: Original rule didn't have explicit always/never clause. Consider adding appropriate assertion (e.g., `never { orphaned_request }`).

---

### Pattern 5: Simple Count Threshold
**Old Syntax**:
```yaml
trace.count(http.retry) > 3
```

**New Syntax**:
```yaml
# TODO: Add always/never clause (e.g., always { alert })
when { count(http.retry) > 3 }
```

**Manual Review Needed**: Original rule is a simple threshold check. Add appropriate assertion based on intended behavior.

## Known Limitations (Manual Review Required)

### 1. `in` and `not in` Operators Not Supported

**Issue**: DSL grammar only supports: `>`, `<`, `>=`, `<=`, `==`, `!=`, `contains`

**Example**:
```yaml
# Original
where(source not in [system, user, authorized_api])

# Converted (needs manual fix)
# TODO: DSL doesn't support 'in' operator - convert to multiple != checks
where(source not in [system, user, authorized_api])
```

**Manual Fix Options**:
1. Convert to multiple OR comparisons: `where(source == external_attacker)`
2. Use different attribute: `where(authorized == false)`
3. Redesign rule to avoid `in` operator

---

### 2. Rules Without Explicit Always/Never

**Issue**: New DSL requires at least one of `always` or `never` clause.

**Affected Rules**:
- Count-based thresholds (e.g., `count(X) > N`)
- Single existence checks (e.g., `trace.has(circuit_breaker.opened)`)

**Manual Fix**: Add appropriate always/never clause based on rule intent:
- For violation indicators: Consider implicit always clause
- For alert generation: `always { alert }` or `always { violation_logged }`

---

### 3. Complex Boolean Logic

**Issue**: Some rules have complex `and`/`or` combinations that may need restructuring.

**Example**:
```yaml
# Complex condition that may need manual review
(A and B) or (C and D)
```

**Manual Fix**: Review semantics and potentially split into multiple rules.

## Verification Steps

### 1. Parse All Converted Rules

```bash
cd backend
for file in ../examples/rules/*.yaml; do
  echo "Testing: $file"
  # Extract and test each condition (custom script needed)
done
```

### 2. Compare Semantics

For each converted rule:
1. Read original YAML condition
2. Read converted when-always-never condition
3. Verify semantic equivalence with example violations
4. Test with real trace data if available

### 3. Address TODO Comments

Search for TODO comments:
```bash
grep -r "# TODO" ../examples/rules/*.yaml
```

Fix each TODO:
- Convert `not in [...]` to alternative syntax
- Add missing always/never clauses
- Simplify complex boolean expressions

## Next Steps

1. ✅ **Automated conversion complete** (45 rules)
2. ⏸️ **Manual review needed** (23 rules with TODO comments)
3. ⏸️ **Parse validation** - Test each converted rule with DSL parser
4. ⏸️ **Semantic testing** - Verify rules behave as expected with test traces
5. ⏸️ **Remove `.old` backups** - After validation

## Conversion Tool

Script: `backend/scripts/convert-yaml-dsl.py`

Usage:
```bash
python3 backend/scripts/convert-yaml-dsl.py input.yaml output.yaml
```

Features:
- Regex-based pattern matching for common structures
- Automatic TODO comment insertion for unsupported syntax
- Preserves YAML structure and metadata
- Conversion statistics reporting

## Statistics

| Metric | Count | Percentage |
|--------|-------|------------|
| Total rules | 45 | 100% |
| Fully converted | 22 | 49% |
| Needs manual review | 23 | 51% |
| Uses `in`/`not in` operator | 6 | 13% |
| Missing always/never | 17 | 38% |

## Conclusion

The automated conversion successfully transformed all 45 rules to the new when-always-never syntax. However, **51% of rules require manual review** due to:
- Unsupported `in`/`not in` operators (6 rules)
- Missing explicit always/never clauses (17 rules)

**Recommendation**: Prioritize manual review of critical severity rules (AI safety, compliance) before production deployment.

---

**Generated**: 2025-11-11
**Conversion Tool**: `backend/scripts/convert-yaml-dsl.py`
**Backup Location**: `examples/rules/*.yaml.old`
