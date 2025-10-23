# Team Consensus: Rank-Ordered Action List

**Date:** 2025-10-16
**Participants:** Architecture Guardian, Security Expert, QA Expert, Implementation Specialist, Product Analyst

---

## 🚨 IMMEDIATE ACTIONS (Do First - Blocking)

### 1. **DELETE AI Agent Monitoring Code** (All agents agree: Out of scope)

**Consensus:**
- **Product Analyst:** "Should NOT be a BeTrace feature - zero customer demand, conflicts with product vision"
- **Implementation Specialist:** "No PRD exists, violates BeTrace purpose (not a security detection system)"
- **Architecture Guardian:** "No ADR defining its place in system"
- **Security Expert:** "Unreviewed code with HIGH injection risk"
- **QA Expert:** "Tests in wrong location, unclear if production or fixture code"

**Action:**
```bash
# Remove all AI agent monitoring code
rm -rf backend/src/main/java/com/fluo/agents/
rm -rf backend/src/test/java/com/fluo/agents/
rm -f backend/src/main/resources/rules/*agent*.drl

# Archive related whitepapers (do not publish)
mkdir -p marketing/archive/speculative/
mv marketing/whitepapers/enterprise-ai-safety-guide.md marketing/archive/speculative/
```

**Why First:** All 5 agents agree this work should not proceed. Removing it unblocks architectural clarity.

---

### 2. **Validate Test Infrastructure** (QA Expert P1, blocks all other work)

**Consensus:**
- **QA Expert:** "test-runner.nix modified - could break entire test pipeline"
- **Implementation Specialist:** "Cannot proceed with any implementation without working tests"
- **Architecture Guardian:** "Modified files need test validation per ADR-015"

**Action:**
```bash
# Verify test infrastructure works
nix run .#test

# Check coverage thresholds enforced
nix run .#validate-coverage

# Interactive inspection
nix run .#test-tui
```

**Success Criteria:**
- ✅ All tests pass (100%)
- ✅ Coverage thresholds met (90% instruction, 80% branch)
- ✅ Zero skipped tests (per commit 4a2680b goal)

**Why Second:** Cannot proceed with any quality work if test infrastructure is broken.

---

## 📋 HIGH PRIORITY (Do This Week)

### 3. **Create ADR-019: Marketing Directory Boundaries** (Architecture Guardian P0)

**Consensus:**
- **Architecture Guardian:** "Marketing violates ADR-011 (application logic without flake/tests)"
- **Product Analyst:** "Marketing should consume BeTrace, not implement features - spin out as separate product"
- **Implementation Specialist:** "Separation of concerns violated"

**Action:**
```bash
# Create architectural decision record
cat > docs/adrs/019-marketing-content-architecture.md <<EOF
# ADR-019: Marketing Content Generation Boundaries

## Decision
Marketing content generation is EXTERNAL TOOLING (separate repository).

## Rationale
- Violates ADR-011: Pure Application Framework (has TypeScript workflows, databases)
- Product Analyst: "Marketing should consume BeTrace, not implement features"
- Creates confusion: Is BeTrace a telemetry platform or content automation platform?

## Consequences
- Move marketing automation to separate repo: fluo-marketing-automation
- Marketing directory contains ONLY: markdown documentation, images, PDFs
- If marketing needs BeTrace features, consume via published packages

## Migration
1. Create fluo-marketing-automation repo
2. Move src/, scripts/, *.duckdb to new repo
3. Keep whitepapers/, education/, competitors/ (documentation only)
EOF

# Execute migration
mkdir -p ../fluo-marketing-automation
mv marketing/src/ ../fluo-marketing-automation/
mv marketing/scripts/ ../fluo-marketing-automation/
mv marketing/*.duckdb* ../fluo-marketing-automation/
mv marketing/package*.json ../fluo-marketing-automation/
```

**Why Third:** Architectural clarity before proceeding with any product work.

---

### 4. **Audit Whitepapers vs Shipped Features** (Product Analyst P0)

**Consensus:**
- **Product Analyst:** "238KB documentation promising features not built - creates unfunded mandates"
- **Security Expert:** "Whitepapers claim security features not validated"
- **Architecture Guardian:** "Documentation without implementation ADRs creates confusion"

**Action:**
```bash
# Create audit checklist
cat > marketing/whitepapers/SHIPPED-FEATURES-AUDIT.md <<EOF
# Whitepaper vs Shipped Features Audit

| Whitepaper | Core Feature | Implementation Status | Publish? |
|-----------|-------------|---------------------|---------|
| Economics of Observability | Rule replay on 100% traces | ✅ Shipped | ✅ YES |
| Hidden Cost Invariants | Pattern matching, rule replay | ✅ Shipped | ✅ YES |
| Chaos to Confidence | Invariant validation during chaos | ⚠️ Partial (manual integration) | ⚠️ MAYBE |
| Compliance Evidence | @SOC2 spans, pattern validation | ⚠️ Partial (no export API) | ⚠️ MAYBE |
| Multi-Tenant Security | Tenant isolation rules | ⚠️ Partial (basic patterns) | ⚠️ MAYBE |
| Incident Response | Rule replay for investigation | ✅ Shipped | ✅ YES |
| Platform Engineering | Platform standard validation | ⚠️ Partial (rules exist, no platform integration) | ❌ NO |
| API Gateway | Gateway policy validation | ⚠️ Partial (rules exist, no gateway integration) | ❌ NO |
| Enterprise AI Safety | AI agent monitoring | ❌ NOT IMPLEMENTED (out of scope) | ❌ NO (archive) |

**Decision:**
- ✅ Publish: 3 whitepapers (Economics, Invariants, Incident Response)
- ⚠️ Review: 3 whitepapers (Chaos, Compliance, Multi-Tenant) - add disclaimers about integration
- ❌ Archive: 3 whitepapers (Platform, API Gateway, AI Safety) - not ready for publication
EOF

# Move unready whitepapers to archive
mkdir -p marketing/archive/pending-implementation/
mv marketing/whitepapers/platform-engineering-maturity.md marketing/archive/pending-implementation/
mv marketing/whitepapers/api-gateway-patterns.md marketing/archive/pending-implementation/
```

**Why Fourth:** Prevents market confusion and unfunded mandates from speculative documentation.

---

## 🔨 IMPLEMENTATION PRIORITY (Next 2-4 Weeks)

### 5. **Complete PRD-005 Phase 2: Rule Engine Sandboxing** (Implementation Specialist P1, Security Expert P1)

**Consensus:**
- **Implementation Specialist:** "Has PRD, aligns with purpose, security-critical"
- **Security Expert:** "9.5/10 rating, Phase 2 brings to 10/10"
- **Product Analyst:** "High demand signal, enterprise-blocking issue"
- **Architecture Guardian:** "Completes existing ADR-017 work"

**Action:**
```bash
# Review PRD-005 Phase 2 acceptance criteria
cat docs/prds/PRD-005-rule-engine-sandboxing.md

# Implement Phase 2 tasks
# 1. Bytecode-level sandbox enforcement
# 2. Additional reflection/file-IO prevention
# 3. Integration tests for sandbox violations

# Run security validation
nix run .#test | grep Sandbox
nix run .#validate-coverage
```

**Success Criteria:**
- [ ] Bytecode agent blocks DRL reflection attacks
- [ ] File I/O prevention validated
- [ ] Security rating: 10/10 (per Security Expert review)
- [ ] Test coverage: 95%+ for sandbox code

**Why Fifth:** Approved work with PRD, aligns with product vision, security-critical for enterprise.

---

### 6. **Create PRD for Compliance Evidence Export API** (Product Analyst P2)

**Consensus:**
- **Product Analyst:** "High demand signal, aligns with core product vision"
- **Security Expert:** "Compliance whitepapers make claims not yet supported by API"
- **Implementation Specialist:** "Natural extension of existing @SOC2 span work"

**Action:**
```bash
# Create PRD draft
cat > docs/prds/PRD-XXX-compliance-evidence-export.md <<EOF
# PRD-XXX: Compliance Evidence Export API

## Problem
Auditors need to export compliance spans for SOC2/HIPAA/ISO27001 certification.
Current state: Spans emitted but no API for auditor access.

## Solution
REST API endpoint: GET /api/compliance/export
- Query params: framework, control, start_date, end_date, format
- Returns: CSV/JSON with compliance spans
- Cryptographic signatures verify span integrity

## Success Criteria
- [ ] 3 beta customers validate auditor workflow
- [ ] Auditor can export 12 months of spans in <5 minutes
- [ ] Supports SOC2, HIPAA, ISO27001 frameworks

## Customer Validation
- [ ] Interview 3 customers with upcoming audits
- [ ] Validate demand before implementation
EOF

# Customer discovery
# (Product Analyst schedules interviews)
```

**Why Sixth:** High demand but requires customer validation before implementation.

---

## 🧹 CLEANUP TASKS (Background Work)

### 7. **Remove Marketing Application Code** (per ADR-019)

**Already covered in Action #3 above.**

---

### 8. **Create Missing ADRs** (Architecture Guardian backlog)

**Consensus:**
- **Architecture Guardian:** "Referenced ADRs not created: ADR-016, ADR-017, ADR-018"
- **Security Expert:** "Security model documentation incomplete"

**Action:**
```bash
# Create placeholder ADRs
touch docs/adrs/016-compliance-evidence-integrity.md
touch docs/adrs/017-rule-engine-security-model.md
touch docs/adrs/018-multi-tenant-cryptographic-isolation.md

# Schedule writing (lower priority than PRD-005 Phase 2)
```

**Why Later:** Documentation debt, not blocking current work.

---

## 📊 PRODUCT STRATEGY (Ongoing)

### 9. **Customer Discovery for Roadmap Validation** (Product Analyst, ongoing)

**Action:**
```bash
# Interview 10 potential users
# Questions:
# 1. What problems does BeTrace solve for you?
# 2. Compliance evidence export - would you use it?
# 3. Chaos engineering integration - would you use it?
# 4. AI agent monitoring - would you use it?
# 5. What's missing from BeTrace today?

# Demand signal threshold: 3+ customers = valid feature
# <3 customers = kill feature
```

**Why Ongoing:** Ensures product-market fit, prevents building unwanted features.

---

## ❌ DO NOT DO (Explicitly Rejected)

### 1. **AI Agent Monitoring** (Product Analyst verdict: OUT OF SCOPE)
- Zero customer demand
- Conflicts with product vision (BeTrace is NOT a security detection system)
- Code should be DELETED per Action #1

### 2. **Chaos Engineering Deep Integration** (Product Analyst: VALIDATE FIRST)
- No PRD, no customer validation
- Whitepaper should be ARCHIVED until demand validated

### 3. **Platform Engineering Standards Validation** (Product Analyst: VALIDATE FIRST)
- No PRD, no customer validation
- Whitepaper should be ARCHIVED until demand validated

---

## Team Consensus Summary

### ✅ UNANIMOUS DECISIONS:

1. **Delete AI agent monitoring code** (all 5 agents agree)
2. **Validate test infrastructure first** (QA Expert blocking, others support)
3. **Separate marketing automation** (Architecture + Product agree)
4. **Complete PRD-005 Phase 2** (Implementation + Security + Product agree)

### ⚠️ CONDITIONAL DECISIONS:

5. **Compliance export API** - IF customer demand validated (Product Analyst requirement)
6. **Chaos engineering** - IF 3+ customers request it (Product Analyst threshold)

### ❌ REJECTED DECISIONS:

7. **AI agent monitoring** - Out of scope (Product Analyst verdict, all others agree)
8. **Speculative whitepapers** - Archive until features ship (Product Analyst requirement)

---

## Execution Timeline

**This Week (40 hours):**
- [ ] Delete agent code (1 hour)
- [ ] Validate test infrastructure (2 hours)
- [ ] Create ADR-019 (marketing boundaries) (4 hours)
- [ ] Audit whitepapers, archive unready ones (4 hours)
- [ ] Start PRD-005 Phase 2 implementation (29 hours)

**Next Week (40 hours):**
- [ ] Complete PRD-005 Phase 2 (32 hours)
- [ ] Security review + testing (8 hours)

**Week 3-4 (80 hours):**
- [ ] Customer discovery interviews (20 hours)
- [ ] Create PRD for compliance export API (12 hours)
- [ ] Implement compliance export API (40 hours)
- [ ] Create missing ADRs (8 hours)

---

## Success Metrics (30 Days)

- [ ] AI agent code removed ✅
- [ ] Test infrastructure validated ✅
- [ ] ADR-019 approved ✅
- [ ] Only 3-6 whitepapers published (shipped features only) ✅
- [ ] PRD-005 Phase 2 complete (10/10 security rating) ✅
- [ ] 10 customer interviews completed ✅
- [ ] Compliance export PRD approved with demand validation ✅
- [ ] Zero code committed without PRD ✅

---

**Final Recommendation:** Execute actions 1-6 in order. Do not skip ahead. Each action unblocks the next.
