# Speculative Whitepapers Archive

**Purpose:** This directory contains whitepapers describing FLUO features that are **not yet implemented**.

## Why Archive Instead of Delete?

These whitepapers represent valid product vision and potential future features. They're archived (not deleted) to:

1. **Preserve research**: Significant effort went into these whitepapers
2. **Document product vision**: Shows potential evolution paths
3. **Enable future revival**: If features ship, un-archive and publish
4. **Maintain honesty**: We don't publish whitepapers promising unshipped features

## Archived Whitepapers

### 1. Platform Engineering Maturity Model (6.7KB)
**Archived:** 2025-10-16

**Why Archived:**
- Describes maturity scoring algorithm (not implemented)
- Platform standards dashboard (not implemented)
- Service mesh integration (not implemented)
- Too short (6.7KB vs 30-40KB flagship papers)

**What's Shipped:**
- ✅ FLUO DSL can detect platform patterns (generic pattern matching)

**What's Missing:**
- ❌ Maturity scoring system
- ❌ Pre-built platform pattern library
- ❌ Service mesh connectors

**Un-archive When:**
- Maturity model algorithm is implemented
- Platform pattern library exists (>20 patterns)
- Whitepaper expanded to 20-30KB with case studies

---

### 2. API Gateway Behavioral Patterns (11KB)
**Archived:** 2025-10-16

**Why Archived:**
- Promises "50+ pre-built API gateway patterns" (none exist)
- Describes gateway-specific DSL helpers (not implemented)
- GraphQL query cost analysis (not implemented)
- Too short (11KB vs 30-40KB flagship papers)

**What's Shipped:**
- ✅ FLUO DSL can detect API trace patterns (generic pattern matching)

**What's Missing:**
- ❌ Pre-built API gateway pattern library
- ❌ Gateway-specific DSL syntax
- ❌ GraphQL integration

**Un-archive When:**
- API gateway pattern library exists (>20 patterns)
- Gateway integration guide is written
- Whitepaper expanded to 25-30KB with real case studies

---

### 3. Incident Response Automation (13KB)
**Archived:** 2025-10-16

**Why Archived:**
- Describes PagerDuty integration (not implemented)
- Promises Jira ticket automation (not implemented)
- Runbook automation workflow (not implemented)
- Claims "zero-touch incident triage" (currently manual)

**What's Shipped:**
- ✅ Signal generation on broken invariants
- ✅ Signal model with severity, context, metadata

**What's Missing:**
- ❌ PagerDuty/Jira connectors
- ❌ Automated ticket creation
- ❌ Runbook execution integration

**Un-archive When:**
- PagerDuty integration ships (PRD required)
- Ticket automation implemented
- Case study shows real automated workflow

---

### 4. Enterprise AI Safety Guide (43KB) - DIFFERENT REASON
**Archived:** 2025-10-16

**Why Archived:**
- AI agent monitoring is OUT OF SCOPE for FLUO
- Conflicts with product vision (FLUO is NOT a security detection system)
- Team consensus: DELETE agent monitoring code (all 5 agents agreed)
- Zero customer demand for this feature

**What Was Implemented (Now Deleted):**
- ~~AgentDelegationMonitor.java~~ (deleted per team consensus)
- ~~PromptInjectionDetector.java~~ (deleted per team consensus)
- ~~Agent-specific Drools rules~~ (deleted per team consensus)

**Un-archive When:**
- NEVER - This is not a FLUO feature
- If demand emerges, create separate product (not FLUO extension)

---

## Publication-Ready Whitepapers

These 4 whitepapers describe **shipped FLUO features** and are publication-ready:

1. ✅ **Economics of Observability** (26KB, 10/10 score)
   - Rule replay: ✅ Shipped
   - DSL pattern matching: ✅ Shipped
   - OpenTelemetry integration: ✅ Shipped

2. ✅ **Hidden Cost of Undocumented Invariants** (32KB, 9/10 score)
   - Invariant discovery: ✅ Shipped
   - Retroactive analysis: ✅ Shipped
   - Signal generation: ✅ Shipped

3. ✅ **Multi-Tenant Security Architecture** (34KB, 8/10 score)
   - Tenant isolation: ✅ Shipped
   - Rule sandboxing: ✅ Shipped (PRD-005 Phase 1)
   - Compliance spans: ✅ Shipped
   - Minor gap: KMS integration (P1, documented as future)

4. ✅ **Compliance Evidence Automation** (38KB, 8/10 score)
   - @SOC2/@HIPAA annotations: ✅ Shipped
   - Compliance span emission: ✅ Shipped
   - HMAC signatures: ✅ Shipped
   - Minor gap: Evidence export API (manual via Grafana, documented)

## Needs Revision

1. ⚠️ **Chaos Engineering Integration** (41KB, 9/10 score)
   - **Issue:** Describes automated chaos tool integration (not implemented)
   - **Fix Required:** Remove automation claims, focus on manual workflow
   - **Action:** Revise lines 450-520, reframe Black Friday case study

## Process for Un-archiving

When features ship that enable a whitepaper to be published:

1. **Verify implementation**: Check that all core claims are now true
2. **Update content**: Add real case studies, remove speculative language
3. **Expand if needed**: Match 25-40KB length of flagship papers
4. **Get team review**: Architecture Guardian + Product Analyst approval
5. **Move to whitepapers/**: `git mv archive/speculative/X.md whitepapers/X.md`
6. **Update README.md**: Add to publication-ready list

## Related Documents

- [WHITEPAPER-FEATURE-AUDIT.md](../../WHITEPAPER-FEATURE-AUDIT.md) - Full audit results
- [WHITEPAPER-REVIEW.md](../../whitepapers/WHITEPAPER-REVIEW.md) - Quality scores
- [TEAM-CONSENSUS-ACTIONS.md](../../../TEAM-CONSENSUS-ACTIONS.md) - Team recommendations
- [compliance-status.md](../../../docs/compliance-status.md) - What's really shipped
