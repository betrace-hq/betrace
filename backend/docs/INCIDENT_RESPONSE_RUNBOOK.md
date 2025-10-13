# Sandbox Violation Incident Response Runbook

**PRD-006 Unit 3:** Standard operating procedures for responding to sandbox violations.

## Overview

This runbook provides step-by-step procedures for security engineers responding to sandbox violations detected by FLUO's rule engine security system.

**When to Use This Runbook:**
- Sandbox violation alert triggered (Grafana/PagerDuty)
- High violation rate detected (>10 violations/tenant)
- Customer reports suspicious rule behavior
- Security audit identifies violation patterns

---

## Severity Levels

| Level | Violations | Response Time | Escalation |
|-------|-----------|---------------|------------|
| **P3 - Low** | 1-2 violations | 24 hours | Security Team (email) |
| **P2 - Medium** | 3-10 violations | 4 hours | Security Lead (Slack) |
| **P1 - High** | >10 violations/tenant | 15 minutes | On-Call Engineer (PagerDuty) |
| **P0 - Critical** | Multi-tenant attack | 5 minutes | Incident Commander (Phone) |

---

## P3: Single Violation (Low Priority)

**Symptoms:**
- 1-2 violations from a single tenant
- No repeat violations within 1 hour
- Isolated incident, not part of pattern

### Response Procedure

#### Step 1: Log the Violation
```bash
# Grafana Loki Query
{app="fluo-backend"} |= "Sandbox violation detected" | tenant="<TENANT_ID>"
```

Record:
- Tenant ID
- Rule ID
- Operation attempted
- Timestamp
- Stack trace

#### Step 2: Review Rule Source Code
```bash
# Retrieve rule from storage
aws s3 cp s3://fluo-rules/<TENANT_ID>/<RULE_ID>.java .
```

Inspect code for:
- Forbidden API usage (Runtime.exec, System.exit, etc.)
- Developer intent (malicious vs. accidental)
- Code complexity (simple mistake vs. obfuscated backdoor)

#### Step 3: Document Findings

Create ticket in incident tracking system:
```
Title: [P3] Sandbox Violation - Tenant <TENANT_ID> Rule <RULE_ID>
Priority: Low
Description:
  - Violation: <OPERATION>
  - Class: <CLASS_NAME>
  - Timestamp: <TIMESTAMP>
  - Intent: [Malicious / Accidental / Unknown]
  - Action Taken: [Logged / Monitored / No Action]
```

#### Step 4: Monitor for Repeat Violations

Set up 7-day watch:
```logql
{app="fluo-backend"} |= "tenant=<TENANT_ID>" |= "rule=<RULE_ID>"
```

If repeat violations occur → **Escalate to P2**

---

## P2: Repeated Violations (Medium Priority)

**Symptoms:**
- 3-10 violations from same tenant/rule
- Violations occur within 1-hour window
- Potential intentional misuse

### Response Procedure

#### Step 1: Disable Rule (Immediate)
```bash
# REST API call to disable rule
curl -X PATCH https://api.fluo.io/v1/tenants/<TENANT_ID>/rules/<RULE_ID> \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false, "reason": "Security violation"}'
```

**Result:** Rule immediately stops executing, prevents further violations

#### Step 2: Notify Tenant

Send email to tenant's security contact:
```
Subject: [Action Required] Security Violation in FLUO Rule <RULE_ID>

Dear <TENANT_NAME>,

We've detected repeated security violations from your FLUO rule <RULE_ID>:

Violation Details:
- Operation: <OPERATION>
- Occurrences: <COUNT>
- First Detected: <TIMESTAMP>
- Rule Status: DISABLED

The FLUO sandbox prevents unauthorized operations like:
- File system access
- Network I/O
- Process execution
- Reflection API abuse

Action Required:
1. Review rule source code for forbidden operations
2. Update rule to use approved APIs only
3. Request re-enablement after code review

For API alternatives, see: https://docs.fluo.io/security/sandbox

Security Team
security@fluo.io
```

#### Step 3: Deep Forensic Analysis

Collect evidence:
```bash
# Export violation logs
curl -X POST "https://grafana.fluo.io/loki/api/v1/query_range" \
  -d "query={app=\"fluo-backend\"} |= \"tenant=<TENANT_ID>\"" \
  -d "start=$(date -u -d '24 hours ago' +%s)" \
  -d "end=$(date -u +%s)" \
  > /tmp/violations-<TENANT_ID>.json

# Export OpenTelemetry spans
curl -X GET "https://tempo.fluo.io/api/search" \
  -d "q={tenant.id=\"<TENANT_ID>\"}" \
  > /tmp/spans-<TENANT_ID>.json
```

Review:
- Stack traces for obfuscation attempts
- Rule complexity (lines of code, nesting depth)
- Other rules from same tenant (pattern of abuse?)
- Tenant's historical violations

#### Step 4: Determine Intent

**Accidental:**
- Simple coding error (e.g., forgot API restrictions)
- Developer testing forbidden API
- No obfuscation or evasion attempts

**Action:** Educate tenant, provide API alternatives, re-enable after fix

**Malicious:**
- Obfuscated code (base64 encoding, reflection tricks)
- Multiple violation types (trying different exploits)
- Repeated attempts after first block

**Action:** Permanent rule ban, escalate to P1, notify security team

#### Step 5: Document Incident

Update ticket:
```
Status: Resolved
Resolution:
  - Rule disabled: <RULE_ID>
  - Tenant notified: <DATE>
  - Intent: [Malicious / Accidental]
  - Re-enablement: [Approved / Denied / Pending Review]
Post-Mortem: <LINK>
```

---

## P1: High Violation Rate (High Priority)

**Symptoms:**
- >10 violations per tenant within 5 minutes
- `HIGH VIOLATION RATE detected` log message
- Possible DDoS or brute-force attack

### Response Procedure (15-Minute SLA)

#### Step 1: Acknowledge Alert
```bash
# PagerDuty acknowledgment
curl -X PUT "https://api.pagerduty.com/incidents/<INCIDENT_ID>" \
  -H "Authorization: Token $PAGERDUTY_TOKEN" \
  -d '{"incident": {"status": "acknowledged"}}'
```

#### Step 2: Disable All Tenant Rules (Immediate)
```bash
# Emergency rule disable (all rules for tenant)
curl -X POST https://api.fluo.io/v1/tenants/<TENANT_ID>/rules/disable-all \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "High violation rate - possible attack"}'
```

**Impact:** Tenant's rules stop executing immediately

#### Step 3: Alert Security Team

Post to #security-incidents Slack channel:
```
@here P1 INCIDENT: High sandbox violation rate

Tenant: <TENANT_ID>
Violations: <COUNT> in 5 minutes
Status: All rules disabled
Investigating: @<YOUR_USERNAME>

Grafana: <LINK>
PagerDuty: <LINK>
```

#### Step 4: Forensic Investigation

Check for attack patterns:
```logql
# All violations from tenant (last hour)
{app="fluo-backend"} |= "tenant=<TENANT_ID>" |= "Sandbox violation" [1h]

# Violation rate timeline
sum by (rule) (
  count_over_time(
    {app="fluo-backend"} |= "tenant=<TENANT_ID>" [5m]
  )
)
```

Identify:
- **Single rule attack:** One rule repeatedly violating (coding error)
- **Multi-rule attack:** Many rules violating (coordinated attack)
- **Brute force:** Trying different forbidden APIs systematically

#### Step 5: Determine Attack Type

##### Attack Type A: Accidental DDoS
**Indicators:**
- Single rule causing all violations
- Same operation attempted repeatedly
- Started suddenly (recent rule deployment)

**Root Cause:** Developer deployed buggy rule with infinite loop

**Action:**
1. Disable offending rule only
2. Contact tenant, explain issue
3. Provide rule debugging guidance
4. Re-enable other rules after confirmation

##### Attack Type B: Malicious Exploit Attempt
**Indicators:**
- Multiple rules from tenant violating
- Different forbidden operations tried
- Obfuscated code in rules

**Root Cause:** Intentional attempt to bypass sandbox

**Action:**
1. Keep all rules disabled
2. Escalate to P0 (potential supply chain compromise)
3. Review tenant's account for compromise
4. Contact tenant security team
5. Require security audit before re-enablement

##### Attack Type C: Compromised Tenant Account
**Indicators:**
- Violations from rules not written by tenant
- Recent suspicious login activity
- Rules deployed from unknown IP addresses

**Root Cause:** Tenant account credentials stolen

**Action:**
1. Lock tenant account immediately
2. Force password reset
3. Invalidate all API tokens
4. Contact tenant via phone (not email)
5. Review audit logs for unauthorized access

#### Step 6: Post-Incident Review

Schedule within 24 hours:
- Root cause analysis
- Timeline reconstruction
- Security controls evaluation
- Lessons learned documentation

---

## P0: Multi-Tenant Attack (Critical)

**Symptoms:**
- Violations from multiple tenants simultaneously
- Coordinated attack pattern
- Possible supply chain compromise

### Response Procedure (5-Minute SLA)

#### Step 1: Page Incident Commander (Immediate)
```bash
# Escalate to Incident Commander
curl -X POST "https://api.pagerduty.com/incidents" \
  -H "Authorization: Token $PAGERDUTY_TOKEN" \
  -d '{
    "incident": {
      "type": "incident",
      "title": "P0: Multi-Tenant Sandbox Violation Attack",
      "service": {"id": "<SERVICE_ID>", "type": "service_reference"},
      "urgency": "high",
      "escalation_policy": {"id": "<INCIDENT_COMMANDER_POLICY>"}
    }
  }'
```

#### Step 2: Enable Emergency Read-Only Mode
```bash
# Global read-only mode (stops all rule execution)
curl -X POST https://api.fluo.io/v1/system/emergency/readonly \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -d '{"reason": "P0 incident - multi-tenant attack"}'
```

**Impact:** ALL tenants' rules stop executing (entire platform in read-only)

#### Step 3: Assemble Incident Response Team

Notify:
- **Incident Commander** (PagerDuty escalation)
- **Security Lead** (phone call)
- **VP Engineering** (phone call)
- **Customer Success** (prepare customer communication)

Create war room:
- Zoom call: https://zoom.us/j/<INCIDENT_ROOM>
- Slack channel: #incident-YYYYMMDD-HHMM

#### Step 4: Identify Attack Vector

Check for:

##### Vector 1: Malicious Dependency
```bash
# Check recent dependency updates
git log --since="24 hours ago" -- backend/pom.xml bff/package.json

# Compare checksums
mvn dependency:tree | grep -v "SNAPSHOT"
npm audit
```

##### Vector 2: Compromised CI/CD
```bash
# Review recent deployments
gh api /repos/fluo/fluo/actions/runs --jq '.workflow_runs[] | select(.created_at > "'$(date -u -d '24 hours ago' --iso-8601=seconds)'")'

# Check for unauthorized commits
git log --since="24 hours ago" --all
```

##### Vector 3: Zero-Day in Sandbox
```bash
# Check if violations are from same exploit
{app="fluo-backend"} |= "Sandbox violation" | regexp "operation=(?P<op>[^,]+)" | count by (op)

# If all violations use same operation → possible bypass found
```

#### Step 5: Immediate Containment

Based on attack vector:

**If Malicious Dependency:**
```bash
# Rollback to last known good version
git revert <BAD_COMMIT>
nix flake update --rollback
nix build .#all
```

**If Compromised CI/CD:**
```bash
# Disable CI/CD pipelines
gh api /repos/fluo/fluo/actions/workflows/<ID>/disable -X PUT

# Rotate all CI/CD secrets
# (GitHub Actions secrets, AWS credentials, etc.)
```

**If Sandbox Zero-Day:**
```bash
# Emergency sandbox patch (disable affected operations)
# Deploy hotfix immediately
```

#### Step 6: Customer Communication

Draft customer notification (approve with VP Eng):
```
Subject: [URGENT] FLUO Platform Security Incident

Dear FLUO Customers,

We've detected and contained a security incident affecting the FLUO platform at <TIMESTAMP>.

Current Status:
- All rule execution temporarily paused
- No customer data compromised
- Investigation underway

Timeline:
- <TIME>: Incident detected
- <TIME>: Platform placed in read-only mode
- <TIME>: Attack vector identified
- <TIME>: Containment measures deployed

Expected Resolution: <ETA>

We will provide updates every 30 minutes until resolved.

For questions: security@fluo.io

FLUO Security Team
```

#### Step 7: Post-Incident (After Containment)

1. **Root Cause Analysis** (RCA) within 48 hours
2. **Security Review** of all code changes (last 30 days)
3. **Dependency Audit** (all npm/Maven packages)
4. **CI/CD Security Audit** (secrets, permissions, workflows)
5. **Customer Notification** (final incident report)
6. **Regulatory Notifications** (if data breach occurred)

---

## Escalation Contacts

| Role | Name | Contact | Timezone |
|------|------|---------|----------|
| Security Lead | TBD | security-lead@fluo.io | US Pacific |
| Incident Commander | TBD | incident-commander@fluo.io | US Pacific |
| VP Engineering | TBD | vp-eng@fluo.io | US Pacific |
| On-Call Engineer | (Rotates) | PagerDuty | 24/7 |

---

## Post-Incident Review Template

### Incident Summary
- **Date/Time:** <TIMESTAMP>
- **Duration:** <DURATION>
- **Severity:** P0/P1/P2/P3
- **Tenant(s) Affected:** <LIST>
- **Operations Blocked:** <LIST>

### Timeline
| Time | Event | Action Taken |
|------|-------|--------------|
| T+0 | Violation detected | Alert triggered |
| T+5 | Engineer acknowledged | Started investigation |
| T+15 | Root cause identified | Applied mitigation |
| T+30 | Incident resolved | Rules re-enabled |

### Root Cause
- **Technical Cause:** <DESCRIPTION>
- **Contributing Factors:** <LIST>

### Impact Assessment
- **Customer Impact:** <DESCRIPTION>
- **Data Exposure:** None / <DESCRIPTION>
- **Financial Impact:** <ESTIMATE>

### Lessons Learned
1. What went well?
2. What could be improved?
3. What should we change?

### Action Items
| Task | Owner | Due Date | Priority |
|------|-------|----------|----------|
| | | | |

---

## Compliance Requirements

### SOC2 CC7.2 (System Monitoring)
**Requirement:** Incident response procedures must be documented and tested

**Evidence:**
- This runbook (documented procedures)
- Post-incident review tickets (proof of execution)
- Tabletop exercises (quarterly testing)

### HIPAA 164.308(a)(6) (Security Incident Procedures)
**Requirement:** Identify and respond to suspected security incidents

**Evidence:**
- Incident detection (Grafana alerts)
- Response procedures (this runbook)
- Mitigation documentation (post-incident reviews)

---

## Testing and Maintenance

### Quarterly Runbook Testing

Conduct tabletop exercises:
1. Simulate P2 violation scenario
2. Walk through response steps
3. Time each action (verify SLAs)
4. Update runbook based on findings

### Annual Runbook Review

Review and update:
- Escalation contacts
- Tools and access (Grafana, PagerDuty)
- Response procedures (based on lessons learned)
- Compliance requirements

---

## References

- **PRD-006:** Sandbox Monitoring and Hardening (Unit 3)
- **VIOLATION_FORENSICS.md:** Grafana queries for investigation
- **SECURITY.md:** Sandbox security threat model
- **SOC2 CC7.2:** System Monitoring Control
- **HIPAA 164.308(a)(6):** Security Incident Procedures
