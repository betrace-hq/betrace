# From Incidents to Invariants: The BeTrace Method

**Last Updated:** October 2025

---

## What This Guide Covers

The BeTrace Method is a systematic approach to:
1. **Extract invariants from production incidents**
2. **Define invariants as executable rules (BeTrace DSL)**
3. **Replay rules against historical traces**
4. **Validate continuously in production**

**Target audience:** SREs, DevOps engineers, engineering managers

**Time to read:** 25 minutes

---

## The Traditional Incident Response Cycle

### Standard Post-Mortem Flow

1. **Incident occurs** → Customer reports issue
2. **Incident response** → On-call engineer investigates
3. **Root cause analysis** → Find what broke
4. **Fix deployed** → Stop the bleeding
5. **Post-mortem meeting** → Document learnings
6. **Action items** → "We should monitor X", "We should document Y"
7. **Hope** → Hope it doesn't happen again

### The Problem

**Learnings are documented, not enforced.**

**Example post-mortem action items:**
- "Document payment idempotency requirements" ✅ (done)
- "Add code comment about tenant filtering" ✅ (done)
- "Update runbook with retry best practices" ✅ (done)

**6 months later:**
- New developer joins
- Doesn't read documentation
- Makes same mistake
- **Incident repeats**

**Root cause:** Knowledge documented, but not validated continuously.

---

## The BeTrace Method: Incidents → Invariants → Rules → Replay

### Overview

```
Incident → Extract Invariant → Define Rule (BeTrace DSL) → Rule Replay → Continuous Validation
```

### Key Difference

**Traditional:** Incident → Document → Hope
**BeTrace:** Incident → Extract → Validate → Enforce

**Result:** Invariants become **executable checks**, not just documentation.

---

## Step 1: Extract Invariants from Incidents

### Method: "What Pattern Was Violated?"

**For every incident, ask:**
1. "What assumption was violated to cause this incident?"
2. "What should have been true, but wasn't?"
3. "What pattern was missing from the trace?"

---

### Example 1: Payment Incident

**Incident summary:**
- Customer charged twice for same order
- Root cause: Retry logic generated new `payment_intent_id`

**Extract invariant:**
- **Question:** "What should have been true?"
- **Answer:** "Same payment_intent_id should be used for retries"
- **Invariant:** "Payment retries must reuse payment_intent_id"

---

### Example 2: Data Breach

**Incident summary:**
- Tenant A saw Tenant B's data
- Root cause: SQL query missing `WHERE tenant_id = ?`

**Extract invariant:**
- **Question:** "What should have been true?"
- **Answer:** "Database queries should always filter by tenant_id"
- **Invariant:** "Cross-tenant data access should never occur"

---

### Example 3: Compliance Failure

**Incident summary:**
- Admin action (bulk user deactivation) had no audit log
- Root cause: Developer forgot to add logging

**Extract invariant:**
- **Question:** "What should have been true?"
- **Answer:** "Admin actions should always generate audit logs"
- **Invariant:** "Admin actions require audit logs (SOC2 CC7.2)"

---

### Exercise: Extract from Your Last Incident

**Template:**
```
Incident: [One-sentence summary]
Root cause: [What broke]
Invariant: [What should have been true]
```

**Example:**
```
Incident: API returned 500 errors for 2 hours
Root cause: Database connection pool exhausted
Invariant: API should fail fast when database unavailable (circuit breaker)
```

---

## Step 2: Define Invariants as BeTrace DSL Rules

### The BeTrace DSL Pattern

**Structure:**
```javascript
// What should exist in the trace
trace.has(operation_name)
  and trace.has(prerequisite_operation)
```

**With attribute filtering:**
```javascript
// What should exist, with conditions
trace.has(operation).where(attribute == value)
  and trace.has(prerequisite)
```

---

### Example 1: Payment Idempotency

**Invariant:** "Payment retries must reuse payment_intent_id"

**BeTrace DSL:**
```javascript
// Payment retries use same payment_intent_id
trace.has(payment.charge).where(attempt > 1)
  and trace.count(payment.charge).where(payment_intent_id == unique) == 1
```

**What this checks:**
- If a payment has attempt > 1 (retry)
- Then all charges in trace should have same payment_intent_id

---

### Example 2: Cross-Tenant Isolation

**Invariant:** "Tenant A should never access Tenant B data"

**BeTrace DSL:**
```javascript
// Cross-tenant isolation
trace.has(database.query).where(table contains "tenant_data")
  and trace.has(database.query).where(tenant_filter == true)
```

**What this checks:**
- If database query accesses tenant_data table
- Then query must have tenant filter applied

---

### Example 3: Admin Audit Logging

**Invariant:** "Admin actions require audit logs (SOC2 CC7.2)"

**BeTrace DSL:**
```javascript
// Admin actions require audit logs
trace.has(admin.action)
  and trace.has(audit.log)
```

**What this checks:**
- If admin action span exists
- Then audit log span must also exist

---

### Translation Guide: Invariant → BeTrace DSL

**Pattern 1: "X should always be preceded by Y"**
```javascript
trace.has(X) and trace.has(Y)
```

**Pattern 2: "X should never happen"**
```javascript
not trace.has(X)
```

**Pattern 3: "If X, then Y must also occur"**
```javascript
trace.has(X) and trace.has(Y)
```

**Pattern 4: "X should happen at most N times"**
```javascript
trace.count(X) <= N
```

**Pattern 5: "X should only happen when condition C"**
```javascript
trace.has(X).where(condition == C)
```

---

## Step 3: Rule Replay (Find Historical Violations)

### What is Rule Replay?

**Traditional approach:**
- Day 30: Define rule (after incident)
- Day 31+: Rule validates forward (detects new violations)
- Days 1-29: Unknown (were there past violations?)

**BeTrace Rule Replay:**
- Day 30: Define rule (after incident)
- **Replay:** Apply rule to Days 1-29 traces (seconds)
- **Discovery:** Find all historical violations

**The power:** Retroactive pattern detection without reprocessing.

---

### Example: Payment Idempotency Replay

**Scenario:**
- **Day 30:** Customer reports double-charge
- **Investigation:** Retry logic bug (new payment_intent_id)
- **Fix:** Deploy fix immediately

**Question:** "Were other customers affected?"

**Traditional approach:**
- Grep logs for "payment_intent_id" (hours)
- Manual analysis of millions of log lines
- Probably miss some cases

**BeTrace Replay:**
```javascript
// Define invariant
trace.has(payment.charge).where(attempt > 1)
  and trace.count(payment.charge).where(payment_intent_id == unique) == 1

// Replay against Days 1-29
fluo replay --rule payment-idempotency --from Day1 --to Day29
```

**Result (2 minutes later):**
```
Day 5: 3 violations (customer-A, customer-B, customer-C)
Day 12: 7 violations (customer-D, ..., customer-J)
Day 18: 2 violations (customer-K, customer-L)
Total: 12 historical violations
```

**Outcome:**
- Proactively refund 12 customers (before they notice)
- Avoid 12 support tickets
- Demonstrate care (customer trust++)

**Cost savings:**
- 12 customers × $200 refund = $2,400
- 12 support tickets × $50 = $600
- **Total:** $3,000 cost, but customer trust preserved

---

### Example: Cross-Tenant Isolation Replay

**Scenario:**
- **Month 12:** Customer A reports seeing Customer B's data
- **Investigation:** SQL query missing tenant filter
- **Fix:** Add WHERE tenant_id = ? filter

**Question:** "How many times did this happen? Which customers were affected?"

**BeTrace Replay:**
```javascript
// Define invariant
trace.has(database.query).where(table contains "tenant_data")
  and trace.has(database.query).where(tenant_filter == true)

// Replay against Month 1-11
fluo replay --rule cross-tenant-isolation --from Month1 --to Month11
```

**Result (5 minutes later):**
```
Month 3: 2 violations (Tenant C accessed Tenant D data)
Month 7: 1 violation (Tenant E accessed Tenant F data)
Month 11: 1 violation (Tenant A accessed Tenant B data - reported)
Total: 4 violations (3 unreported)
```

**Outcome:**
- Proactive breach notification (HIPAA/GDPR)
- Report to 3 additional customers
- Forensic analysis: exactly which records accessed
- Compliance: demonstrate thorough investigation

**Regulatory benefit:**
- Proactive disclosure (vs auditor discovery)
- Shows due diligence (reduces fines)
- Demonstrates monitoring capability

---

### When to Use Rule Replay

**Scenario 1: Post-Incident Investigation**
- Incident occurs Day 30
- Define rule
- Replay Days 1-29
- **Goal:** Find past occurrences

---

**Scenario 2: Compliance Audit Preparation**
- Auditor requests evidence for Q4 controls
- Rules defined in Q1
- Replay against Q4 traces
- **Goal:** Generate audit evidence

---

**Scenario 3: Code Deployment Validation**
- Deploy new code Day 1
- Define rule (expected behavior)
- Replay Days 2-7
- **Goal:** Verify code works as expected

---

**Scenario 4: Inherited Codebase**
- New team takes over service
- Define invariants from documentation
- Replay last 90 days
- **Goal:** Discover violations before making changes

---

## Step 4: Continuous Validation (Always-On)

### From One-Time Fix → Always-On Validation

**Traditional post-mortem:**
- Fix deployed → Incident resolved → Hope it doesn't happen again

**BeTrace Method:**
- Fix deployed → Rule defined → **Validation always-on**

---

### Example: Payment Idempotency (Continuous)

**Day 30:** Incident occurs, fix deployed, rule defined

**Day 31+:** BeTrace validates **every payment trace** against rule

**Day 45:** New developer adds retry logic (different service)
- **30 seconds later:** BeTrace detects violation (new payment_intent_id)
- Alert fires immediately
- Engineer fixes before customers affected

**Result:** Same bug in different service → caught instantly

---

### Continuous Validation Benefits

**1. Catch regressions**
- New code accidentally violates invariant
- Alert fires immediately
- Fix before customers affected

**2. Catch edge cases**
- Production has scenarios tests didn't cover
- Invariant violated in rare case
- Alert fires, edge case discovered

**3. Catch distributed system issues**
- Service A assumes Service B behavior
- Service B changes implementation
- Invariant violated
- Alert fires, integration issue discovered

---

## Real-World Example: Complete BeTrace Method

### Background

**Company:** E-commerce platform (B2C)
**System:** Checkout flow
**Incident:** Orders shipped without payment (lost revenue)

---

### Step 1: Extract Invariant

**Post-mortem findings:**
- **Incident:** 23 orders shipped without payment
- **Root cause:** Race condition in checkout service
- **Sequence violation:** Shipment initiated before payment confirmed

**Extract invariant:**
- **What should have been true:** "Order shipment should always be preceded by payment confirmation"

---

### Step 2: Define BeTrace DSL Rule

```javascript
// Shipment requires payment confirmation
trace.has(shipment.initiate)
  and trace.has(payment.confirm)
```

**Rule definition (YAML):**
```yaml
rules:
  - id: shipment-requires-payment
    name: "Shipment requires payment confirmation"
    description: "Order shipment should always be preceded by payment confirmation"
    severity: critical
    condition: |
      trace.has(shipment.initiate)
        and trace.has(payment.confirm)
```

---

### Step 3: Rule Replay

**Question:** "Were there past occurrences we didn't catch?"

**Replay command:**
```bash
fluo replay --rule shipment-requires-payment --from Day1 --to Day29
```

**Result:**
```
Day 3: 2 violations (order-001, order-002)
Day 8: 5 violations (order-003 ... order-007)
Day 15: 4 violations (order-008 ... order-011)
Day 22: 7 violations (order-012 ... order-018)
Day 29: 5 violations (order-019 ... order-023 - discovered)
Total: 23 violations over 29 days
```

**Discovery:**
- Incident discovered on Day 29 (5 orders)
- Rule replay found **18 additional orders** (Days 3-22)
- Total financial impact: 23 orders × $150 avg = **$3,450 lost revenue**

**Action:**
- Contact 18 additional customers (charge retroactively or write off)
- Forensic analysis: race condition existed for 29 days
- Fix verified: replay Days 30-37 → 0 violations

---

### Step 4: Continuous Validation

**Deployment:**
- Rule deployed to production (Day 30)
- Validates every checkout trace (24/7)

**Day 67:** Different developer adds "express shipping" feature
- Feature works correctly in tests
- Production deployment
- **2 hours later:** BeTrace detects violation (express shipment without payment)
- Alert fires
- Investigation: express shipping logic skipped payment check
- Fix deployed in 4 hours

**Outcome:**
- Violation caught after 2 hours (not 29 days)
- **0 customers affected** (caught before customer impact)
- Cost: $600 (4 engineer hours)
- Cost avoided: $3,450+ (another month of violations)

---

### ROI Calculation

**Investment:**
- Extract invariant: 1 hour ($150)
- Define BeTrace rule: 1 hour ($150)
- Rule replay: 2 minutes (negligible)
- Continuous validation: Automated
- **Total investment: $300**

**Return:**
- Day 1-29: $3,450 lost revenue (already occurred)
- Day 67: Violation caught in 2 hours (0 customer impact)
- Next 12 months: Estimated 3 similar incidents avoided
- **Estimated return: 3 × $3,450 = $10,350**

**ROI: 34.5x** (first year)

---

## BeTrace Method Playbook

### Phase 1: Incident Response (Day 0)

**Activities:**
1. Resolve incident (stop the bleeding)
2. Communicate with customers
3. Deploy fix

**Time:** 2-8 hours

---

### Phase 2: Post-Mortem (Day 1-2)

**Activities:**
1. Root cause analysis
2. **Extract invariant** (new step!)
3. Document learnings
4. Action items

**Template:**
```
Incident: [Summary]
Root Cause: [What broke]
Invariant Violated: [What should have been true]
BeTrace DSL: [How to validate continuously]
```

**Time:** 2-4 hours

---

### Phase 3: Rule Definition (Day 2-3)

**Activities:**
1. Instrument code (emit spans)
2. Define BeTrace DSL rule
3. Test in staging
4. Review with team

**Example:**
```javascript
// Invariant: Payment requires inventory reservation
trace.has(payment.charge)
  and trace.has(inventory.reserve)
```

**Time:** 2-4 hours

---

### Phase 4: Rule Replay (Day 3)

**Activities:**
1. Run replay command
2. Analyze results
3. Identify affected customers
4. Take remediation actions

**Example:**
```bash
fluo replay --rule payment-inventory --from Day1 --to Day29
```

**Time:** 30 minutes

---

### Phase 5: Continuous Validation (Day 3+)

**Activities:**
1. Deploy rule to production
2. Monitor alerts
3. Respond to violations (15-60 minutes)
4. Measure: Time to detect, time to fix

**Alert configuration:**
```yaml
alerts:
  - rule_id: payment-inventory
    severity: critical
    notification: pagerduty
    channels:
      - slack: #incidents
      - email: oncall@company.com
```

**Time:** Automated (alerts only)

---

### Phase 6: Continuous Improvement (Ongoing)

**Monthly review:**
1. Review incidents: Which invariants would have prevented?
2. Add new invariants (from incidents)
3. Refine existing invariants (reduce false positives)
4. Measure ROI (incidents avoided)

**Metrics to track:**
- Invariants defined: 20 → 50 → 150
- Violations detected: 10/month → 5/month → 2/month
- Time to detect: 4 hours → 30 minutes → 2 minutes
- Incidents avoided: Estimated based on replay findings

---

## Common Challenges and Solutions

### Challenge 1: "Too many false positives"

**Problem:** Rule too strict, alerts fire for expected behavior

**Example:**
```javascript
// Too strict: Alerts on read-only transactions
trace.has(database.query)
  and trace.has(transaction.begin)
```

**Solution:** Refine rule with attribute filtering
```javascript
// More specific: Only write operations require transactions
trace.has(database.query).where(operation == write)
  and trace.has(transaction.begin)
```

---

### Challenge 2: "How do I instrument code?"

**Problem:** Code doesn't emit relevant spans

**Solution:** Add OpenTelemetry instrumentation
```python
# Before (no instrumentation)
def checkout(cart):
    reserve_inventory(cart)
    charge_payment(cart)

# After (instrumented)
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def checkout(cart):
    with tracer.start_span("inventory.reserve") as span:
        span.set_attribute("cart.id", cart.id)
        reserve_inventory(cart)

    with tracer.start_span("payment.charge") as span:
        span.set_attribute("amount", cart.total)
        charge_payment(cart)
```

---

### Challenge 3: "Rule replay is too slow"

**Problem:** Millions of traces, replay takes hours

**Solution:** Index optimization
- BeTrace indexes span operation names
- Replay queries index (not full scan)
- **Result:** Millions of traces → seconds (not hours)

**Example performance:**
- 10M traces/day × 30 days = 300M traces
- Rule replay: 30 seconds (indexed query)

---

### Challenge 4: "How do I prioritize invariants?"

**Problem:** Hundreds of potential invariants, where to start?

**Solution:** Prioritize by impact
1. **Critical (P0):** Security, compliance, financial
2. **High (P1):** Customer experience, data integrity
3. **Medium (P2):** Performance, reliability
4. **Low (P3):** Developer experience, debugging

**Start with P0/P1**, expand to P2/P3 over time.

---

## Metrics and KPIs

### Incident Metrics

**Before BeTrace:**
- Time to detect: 4 hours (customer reports issue)
- Time to fix: 8 hours (investigation + deploy)
- Total incident duration: 12 hours

**After BeTrace:**
- Time to detect: 2 minutes (BeTrace alert fires)
- Time to fix: 30 minutes (alert → investigation → deploy)
- Total incident duration: 32 minutes

**Improvement:** 22.5x faster resolution

---

### Coverage Metrics

**Track:**
- Invariants defined: 20 → 50 → 150 (growth)
- Code coverage: % of services with invariants
- Critical invariants: 100% coverage (P0/P1)

**Goal:** Cover all critical paths within 6 months

---

### ROI Metrics

**Track:**
- Incidents avoided: Estimated via rule replay
- Cost per incident: Average $50K-$150K
- Violations detected: 10/month → 5/month (improvement)

**Calculate:**
```
ROI = (Incidents Avoided × Avg Cost) / BeTrace Investment
```

**Example:**
- Incidents avoided: 12/year × $100K = $1.2M
- BeTrace investment: $60K/year
- **ROI:** 20x

---

## Summary

### The BeTrace Method (5 Steps)

1. **Extract:** Identify invariant from incident
2. **Define:** Write invariant as BeTrace DSL rule
3. **Replay:** Apply rule to historical traces
4. **Validate:** Continuous validation in production
5. **Improve:** Refine rules based on feedback

---

### Key Benefits

**1. Proactive detection**
- Violations caught in minutes (not hours/days)

**2. Historical analysis**
- Rule replay finds past violations

**3. Continuous validation**
- Always-on checks (not one-time fixes)

**4. Measurable ROI**
- Incidents avoided × cost per incident

---

### Next Steps

**Learn more:**
- [Understanding Invariants: A Complete Guide](./understanding-invariants.md)
- [The Hidden Cost of Violated Invariants](./hidden-cost-of-violated-invariants.md)
- [Domain-Specific Playbooks](./playbooks/README.md)

**Try BeTrace:**
- [Quick Start Guide](../../docs/QUICK_START.md)
- [BeTrace DSL Reference](../../docs/technical/trace-rules-dsl.md)
- [GitHub Repository](https://github.com/betracehq/fluo)

---

**Questions?**
- [GitHub Issues](https://github.com/betracehq/fluo/issues)
- Email: hello@fluo.com

**Share your story:**
- How did you extract invariants from your incidents?
- What violations did rule replay discover?
- Tweet @betracehq with #BeTraceMethod
