# Content Brief: Compliance Evidence with FLUO

**Topic:** How FLUO Generates Compliance Evidence from Trace Patterns
**Target Audience:** Compliance Officers, Security Engineers, SREs
**Word Count:** 800-1200 words
**Tone:** Technical, BRUTALLY HONEST about limitations

---

## Required Reading for AI Agents

**Primary Sources (MUST READ):**
1. [compliance-status.md](../../../docs/compliance-status.md) - **CRITICAL:** Current reality, what's NOT certified
2. [compliance.md](../../../docs/compliance.md) - How the system works
3. [ai-content-guidelines.md](../ai-content-guidelines.md) - Compliance claims rules
4. [CLAUDE.md](../../../CLAUDE.md) - Core workflow

**Supplementary Sources:**
- [trace-rules-dsl.md](../../../docs/technical/trace-rules-dsl.md) - DSL for compliance rules

---

## CRITICAL: What to Say vs NOT Say

### ✅ ACCEPTABLE CLAIMS
- "FLUO provides compliance evidence collection primitives"
- "Built with SOC2/HIPAA controls in mind"
- "Compliance-ready architecture for behavioral assurance"
- "Compliance evidence generation (NOT certification)"

### ❌ NEVER CLAIM
- "SOC2 certified" (NOT TRUE - requires external audit)
- "HIPAA compliant" (NOT TRUE - requires BAAs, policies)
- "Automated compliance" (evidence ≠ certification)
- "Production-ready for compliance" (NOT TRUE - see compliance-status.md)

### 🚨 IF ASKED ABOUT CERTIFICATION
"FLUO is NOT certified for any framework. Certification requires external auditor, 12-18 months, and $10-25K. FLUO provides evidence collection primitives only."

---

## Documented Facts (Current Reality)

### Implemented (Production Ready)
- ✅ Compliance span integrity (HMAC-SHA256 signatures)
- ✅ PII redaction enforcement (whitelist-based validation)
- ✅ Rule engine sandboxing (9.5/10 security rating)
- ✅ Input sanitization (XSS, SQL, LDAP, command injection)
- ✅ Compliance audit logging (SOC2 spans for security events)

### NOT Implemented (Be Honest!)
- ❌ NOT certified for any framework (SOC2, HIPAA, FedRAMP, etc.)
- ⏸️ Per-tenant KMS encryption keys (P1, not blocking)
- ⏸️ Evidence export API for auditors (P2)
- ⏸️ Compliance rule templates (P2)

---

## Article Structure

### Section 1: The Problem (150 words)
**What to cover:**
- Compliance audits require evidence of controls
- Manual evidence collection is time-consuming
- Need to prove controls work in production, not just documented

**Sources:**
- compliance.md (overview)
- compliance-status.md (current challenges)

**DO NOT CLAIM:**
- ❌ "Compliance is automated" (false!)
- ❌ "FLUO replaces auditors" (false!)

### Section 2: How FLUO Generates Evidence (300 words)
**What to cover:**
- FLUO emits compliance spans during normal operations
- Spans are cryptographically signed (HMAC-SHA256)
- Immutable, timestamped audit trail via OpenTelemetry
- Spans are queryable for auditor review

**Sources:**
- compliance.md (how it works)
- compliance-status.md (implemented features)

**Example (from compliance.md):**
```java
@SOC2(controls = {CC6_1}, notes = "User authorization check")
public boolean authorizeUser(String userId, String resource) {
    // Emits compliance span with:
    // - framework: "soc2"
    // - control: "CC6_1"
    // - evidenceType: "audit_trail"
    return authService.check(userId, resource);
}
```

### Section 3: FLUO DSL for Compliance Validation (300 words)
**What to cover:**
- Rules verify compliance patterns exist in traces
- Example: PII access requires audit log
- Violations generate signals (broken invariants = missing evidence)

**Sources:**
- trace-rules-dsl.md (DSL syntax)
- compliance.md (compliance examples)

**Real Example (from compliance.md):**
```javascript
// SOC2 CC7_2: PII access requires audit logging
trace.has(span => span.attributes['data.contains_pii'] === true)
  .and(trace.has(span => span.name === 'audit.log'))
```

**DO NOT INVENT:**
- ❌ No fictional controls or frameworks
- ❌ No invented compliance rules
- ❌ No client stories unless from docs

### Section 4: Supported Frameworks (200 words)
**What to cover:**
- SOC2 Trust Service Criteria (CC6.1, CC6.2, CC7.1, CC7.2, CC8.1)
- HIPAA Technical Safeguards (164.312(a), 164.312(b))
- Extensible to ISO27001, FedRAMP, PCI-DSS

**Sources:**
- compliance.md (framework support section)

**CRITICAL:** Must state this clearly:
> "FLUO provides evidence generation for these frameworks but is NOT CERTIFIED. Certification requires external auditor."

### Section 5: Path to Certification (200 words)
**What to cover (from compliance-status.md):**
1. Fix P0 security gaps: ✅ DONE
2. Implement compliance rule templates: ⏸️ Planned
3. Deploy FLUO with annotations: ⏸️ Customer responsibility
4. Run for audit period: ⏸️ 6-12 months minimum
5. External audit: ⏸️ $10-25K, 2-3 months
6. **Total timeline:** 12-18 months from today

**Sources:**
- compliance-status.md ("Path to Certification" section)

**BE HONEST:**
- Costs: $10,000-25,000 for SOC2 Type II
- Timeline: 12-18 months minimum
- Requires: External auditor (CPA for SOC2, 3PAO for FedRAMP)

### Section 6: Current Status & Limitations (150 words)
**What to cover:**
- What's implemented vs planned
- What FLUO does NOT provide (policies, BAAs, documentation)
- What organizations still need to do

**Sources:**
- compliance-status.md ("What FLUO Does NOT Provide")

**Example from docs:**
> "FLUO generates technical evidence, not documentation. Organizations must maintain security policies, procedures, and documentation separately."

---

## Critical Constraints (AI Must Follow)

### ✅ MUST DO
1. State upfront: "FLUO is NOT certified for any framework"
2. Cite compliance-status.md for all claims
3. Provide realistic timeline (12-18 months) and costs ($10-25K)
4. Acknowledge gaps: "No evidence export API yet"

### ❌ MUST NOT DO
1. Claim SOC2/HIPAA certification (false!)
2. Say "automated compliance" (misleading!)
3. Imply FLUO replaces auditors (false!)
4. Invent compliance controls or examples

### 🚨 IF YOU NEED COMPLIANCE EXAMPLES NOT IN DOCS
Write: `[COMPLIANCE EXAMPLE NEEDED: describe control]`

**DO NOT INVENT COMPLIANCE CLAIMS!**

---

## Success Criteria

**Article succeeds if:**
1. States upfront: "NOT certified"
2. Provides realistic timeline and costs
3. Cites compliance-status.md extensively
4. Honestly acknowledges gaps
5. Distinguishes evidence generation from certification

**Article fails if:**
1. Claims SOC2/HIPAA certification
2. Says "automated compliance"
3. Omits costs or timeline
4. Invents controls or examples
5. Misleads about what FLUO provides

---

## Compliance-Specific Review Checklist

Before publishing, verify:
- [ ] Article states "NOT certified" in first 100 words
- [ ] All compliance claims cite compliance-status.md
- [ ] Realistic timeline provided (12-18 months)
- [ ] Realistic costs provided ($10-25K)
- [ ] Gaps acknowledged (no evidence export API, no rule templates)
- [ ] Distinguishes evidence generation from certification
- [ ] No "automated compliance" language
- [ ] No claims FLUO replaces auditors

---

## Target Keywords (Use Naturally)

- "compliance evidence generation"
- "SOC2 evidence collection" (NOT "SOC2 certified")
- "behavioral assurance"
- "OpenTelemetry compliance spans"
- "immutable audit trail"
- "trace pattern validation"

**AVOID:**
- "SOC2 certification" (false!)
- "automated compliance" (misleading!)
- "compliance platform" (too broad)
