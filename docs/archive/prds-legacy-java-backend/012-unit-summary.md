# PRD-012 Unit Summary: Tenant Management System

## Overview

PRD-012 (Tenant Management System) has been split into 6 independently implementable units. Each unit can be developed, tested, and deployed separately, with clear dependency ordering.

## Unit PRDs

### PRD-012a: Tenant Onboarding Service
**Location:** `/Users/sscoble/Projects/betrace/docs/prds/012a-tenant-onboarding.md`
**Priority:** P0
**Dependencies:** None (foundation unit)

**Scope:**
- Create tenant record triggered by WorkOS OAuth
- Generate per-tenant KMS keys (Ed25519 signing, AES-256 encryption)
- Initialize Drools KieSession for tenant
- Store tenant metadata in TigerBeetle (code=9)
- Emit SOC2 CC6.2 compliance spans

**Key Files:**
- `backend/src/main/java/com/betrace/routes/TenantOnboardingRoute.java`
- `backend/src/main/java/com/betrace/processors/CreateTenantProcessor.java`

**Success Criteria:**
- POST /api/tenants creates tenant in TigerBeetle
- Generates Ed25519 and AES-256 keys via KMS
- Initializes Drools session
- Per-tenant ledger isolation enforced

---

### PRD-012b: Tenant Settings CRUD
**Location:** `/Users/sscoble/Projects/betrace/docs/prds/012b-tenant-settings-crud.md`
**Priority:** P0
**Dependencies:** PRD-012a (Tenant Onboarding)

**Scope:**
- Update tenant name, logo URL, timezone, retention policies
- Store settings in TigerBeetle accounts (code=10)
- Record changes as transfers (code=9, op_type=2)
- Emit SOC2 CC8.1 compliance spans (change management)
- Frontend settings form with validation

**Key Files:**
- `backend/src/main/java/com/betrace/routes/TenantSettingsRoute.java`
- `backend/src/main/java/com/betrace/processors/TenantSettingsProcessors.java`
- `bff/src/routes/settings/tenant.tsx`

**Success Criteria:**
- GET /api/tenants/{id}/settings returns settings
- PUT /api/tenants/{id}/settings updates settings
- Tenant isolation enforced
- Frontend validates input client-side

---

### PRD-012c: Team Member Management
**Location:** `/Users/sscoble/Projects/betrace/docs/prds/012c-team-member-management.md`
**Priority:** P0
**Dependencies:** PRD-012a (Tenant Onboarding), PRD-001 (Authentication)

**Scope:**
- Invite users via email with role assignment
- Store team members in TigerBeetle (code=11)
- Revoke access (mark as revoked)
- Emit SOC2 CC6.2 compliance spans (access provisioning/removal)
- Frontend team management UI

**Key Files:**
- `backend/src/main/java/com/betrace/routes/TeamMemberRoute.java`
- `backend/src/main/java/com/betrace/processors/TeamMemberProcessors.java`
- `bff/src/components/settings/team-members.tsx`

**Success Criteria:**
- POST /api/tenants/{id}/members/invite creates pending user
- DELETE /api/tenants/{id}/members/{userId} revokes access
- Only admins can invite/revoke
- Cannot revoke self

---

### PRD-012d: Usage Tracking and Quotas
**Location:** `/Users/sscoble/Projects/betrace/docs/prds/012d-usage-tracking-quotas.md`
**Priority:** P0
**Dependencies:** PRD-012a (Tenant Onboarding), PRD-012b (Tenant Settings)

**Scope:**
- Track usage (API calls, spans, rules, signals) in TigerBeetle (code=12)
- Enforce quotas by tenant tier (free, pro, enterprise)
- Return 429 when quota exceeded
- Monthly billing cycle reset
- Frontend usage dashboard with progress bars

**Key Files:**
- `backend/src/main/java/com/betrace/processors/UsageTrackingProcessor.java`
- `backend/src/main/java/com/betrace/processors/GetUsageDashboardProcessor.java`
- `bff/src/routes/settings/usage.tsx`

**Success Criteria:**
- Usage tracked for all resource types
- Quotas enforced (free: 10k API calls, pro: 1M, enterprise: unlimited)
- GET /api/tenants/{id}/usage returns dashboard data
- Frontend displays usage with warnings

---

### PRD-012e: API Key Management
**Location:** `/Users/sscoble/Projects/betrace/docs/prds/012e-api-key-management.md`
**Priority:** P0
**Dependencies:** PRD-012a (Tenant Onboarding), PRD-001 (Authentication)

**Scope:**
- Generate API keys for CI/CD (format: betrace_live_xxx)
- Store keys as bcrypt hashes in TigerBeetle (code=13)
- Validate keys via X-API-Key header (ApiKeyAuthProcessor)
- Revoke keys (mark as status=2)
- Emit SOC2 CC6.1/CC6.2 compliance spans

**Key Files:**
- `backend/src/main/java/com/betrace/processors/ApiKeyProcessors.java`
- `backend/src/main/java/com/betrace/routes/ApiKeyRoute.java`
- `bff/src/routes/settings/api-keys.tsx`

**Success Criteria:**
- POST /api/tenants/{id}/api-keys generates key
- Plaintext key returned only on creation
- X-API-Key header validates via bcrypt
- DELETE /api/tenants/{id}/api-keys/{keyId} revokes key

---

### PRD-012f: Frontend Tenant Admin UI
**Location:** `/Users/sscoble/Projects/betrace/docs/prds/012f-frontend-tenant-admin-ui.md`
**Priority:** P0
**Dependencies:** PRD-012a, PRD-012b, PRD-012c, PRD-012d, PRD-012e

**Scope:**
- Unified Settings page with tabbed navigation
- Tenant context provider (supplies tenantId to all components)
- Header with tenant logo and switcher (multi-tenant users)
- Dashboard usage widgets
- Storybook stories for all components

**Key Files:**
- `bff/src/routes/settings/index.tsx`
- `bff/src/lib/context/tenant-context.tsx`
- `bff/src/components/layout/header.tsx`
- `bff/src/stories/TenantAdmin.stories.tsx`

**Success Criteria:**
- Settings page with 4 tabs (Tenant, Team, Usage, API Keys)
- Tenant switcher for multi-tenant users
- Dashboard displays usage widgets
- Responsive design (mobile, tablet, desktop)
- Dark mode support

---

## Dependency Graph

```
┌─────────────────────┐
│   PRD-012a: Tenant  │ ◄── Foundation (no dependencies)
│     Onboarding      │
└──────────┬──────────┘
           │
           ├──► ┌─────────────────────┐
           │    │   PRD-012b: Tenant  │
           │    │   Settings CRUD     │
           │    └──────────┬──────────┘
           │               │
           ├──► ┌─────────────────────┐
           │    │   PRD-012c: Team    │
           │    │   Member Mgmt       │
           │    └──────────┬──────────┘
           │               │
           ├──► ┌─────────────────────┐
           │    │   PRD-012d: Usage   │
           │    │   Tracking & Quotas │
           │    └──────────┬──────────┘
           │               │
           ├──► ┌─────────────────────┐
           │    │   PRD-012e: API Key │
           │    │   Management        │
           │    └──────────┬──────────┘
           │               │
           └──────────────►┌─────────────────────┐
                           │   PRD-012f: Frontend│
                           │   Tenant Admin UI   │
                           └─────────────────────┘
```

## Implementation Order

**Phase 1: Foundation**
1. PRD-012a (Tenant Onboarding) - **MUST BE FIRST**

**Phase 2: Core Features (can be done in parallel)**
2. PRD-012b (Tenant Settings CRUD)
3. PRD-012c (Team Member Management)
4. PRD-012d (Usage Tracking)
5. PRD-012e (API Key Management)

**Phase 3: Integration**
6. PRD-012f (Frontend Tenant Admin UI) - Integrates all backend APIs

## TigerBeetle Schema Summary

| Code | Account Type | Purpose |
|------|-------------|---------|
| 9 | Tenant Account | Tenant metadata (status, tier, created_at) |
| 10 | Tenant Settings | Name, logo, timezone, retention policies |
| 11 | Team Member | User role, status (pending/active/revoked) |
| 12 | Usage Quota | Resource usage tracking (API calls, spans, rules, signals) |
| 13 | API Key | Bcrypt hash, status (active/revoked) |

**Transfer Operations (code=9):**
- op_type=1: create tenant
- op_type=2: update settings
- op_type=3: invite team member
- op_type=4: revoke team member
- op_type=5: role change
- op_type=6: generate API key
- op_type=7: revoke API key

## Testing Coverage by Unit

| Unit | Backend Tests | Frontend Tests | Integration Tests |
|------|--------------|----------------|-------------------|
| 012a | CreateTenantProcessor (90%+) | N/A | Tenant onboarding E2E |
| 012b | TenantSettingsProcessors (90%+) | TenantSettings.test.tsx | Settings update E2E |
| 012c | TeamMemberProcessors (90%+) | TeamMembers.test.tsx | Invite/revoke E2E |
| 012d | UsageTrackingProcessor (90%+) | UsageDashboard.test.tsx | Quota enforcement E2E |
| 012e | ApiKeyProcessors (90%+) | ApiKeys.test.tsx | Key validation E2E |
| 012f | N/A | Header.test.tsx, Settings.test.tsx | Full tenant admin E2E |

**Overall Target:** 90% instruction coverage, 80% branch coverage

## Compliance Benefits

Each unit emits SOC2 compliance spans:

- **PRD-012a:** CC6.2 (Access Provisioning) - Tenant creation
- **PRD-012b:** CC8.1 (Change Management) - Settings updates
- **PRD-012c:** CC6.2 (Access Provisioning/Removal) - Team invites/revocations
- **PRD-012d:** Audit trail for usage enforcement
- **PRD-012e:** CC6.1 (Logical Access), CC6.2 (Key Management) - API keys

**Audit Trail:**
All operations recorded as TigerBeetle transfers with immutable WORM semantics.

## ADR Compliance Summary

**All units comply with:**
- **ADR-011 (TigerBeetle-First):** No SQL tables - all data in TigerBeetle accounts/transfers
- **ADR-012 (Mathematical Tenant Isolation):** Per-tenant ledger IDs, KMS keys
- **ADR-013 (Camel-First):** All backend logic in Camel routes + named processors
- **ADR-014 (Named Processors):** All business logic in testable CDI beans (90% coverage)
- **ADR-015 (Workflow Standards):** Conventional commits, pre-commit checks

## Integration with Other PRDs

**PRD-001 (Authentication):**
- JWT provides userId, tenantId, roles for RBAC enforcement
- API keys (PRD-012e) provide alternative auth method

**PRD-006 (KMS Integration):**
- PRD-012a generates Ed25519 signing keys and AES-256 encryption keys per tenant

**PRD-002 (TigerBeetle Persistence):**
- All units use TigerBeetle client for account/transfer operations

## File Organization

```
docs/prds/
├── 012-tenant-management-system.md (PARENT - archived)
├── 012-unit-summary.md (THIS FILE)
├── 012a-tenant-onboarding.md
├── 012b-tenant-settings-crud.md
├── 012c-team-member-management.md
├── 012d-usage-tracking-quotas.md
├── 012e-api-key-management.md
└── 012f-frontend-tenant-admin-ui.md

backend/src/main/java/com/betrace/
├── routes/
│   ├── TenantOnboardingRoute.java (012a)
│   ├── TenantSettingsRoute.java (012b)
│   ├── TeamMemberRoute.java (012c)
│   ├── UsageRoute.java (012d)
│   └── ApiKeyRoute.java (012e)
├── processors/
│   ├── CreateTenantProcessor.java (012a)
│   ├── TenantSettingsProcessors.java (012b)
│   ├── TeamMemberProcessors.java (012c)
│   ├── UsageTrackingProcessor.java (012d)
│   └── ApiKeyProcessors.java (012e)

bff/src/
├── routes/settings/
│   ├── index.tsx (012f layout)
│   ├── tenant.tsx (012b)
│   ├── team.tsx (012c)
│   ├── usage.tsx (012d)
│   └── api-keys.tsx (012e)
├── lib/context/
│   └── tenant-context.tsx (012f)
└── components/layout/
    └── header.tsx (012f)
```

## Next Steps

1. **Review unit PRDs** with team for technical feasibility
2. **Prioritize implementation** (must start with PRD-012a)
3. **Assign units** to developers (can parallelize 012b-012e after 012a done)
4. **Create GitHub issues** for each unit PRD
5. **Track progress** using unit success criteria

## Questions for Review

- [ ] Is TigerBeetle schema optimal for query patterns?
- [ ] Should email lookup be cached separately or reconstructed from transfers?
- [ ] Do we need key rotation (PRD-012e enhancement) in MVP?
- [ ] Should usage tracking be async (message queue) to reduce latency?
- [ ] Frontend: Server-side rendering (SSR) or client-side only?

## Estimated Timeline

**Assumptions:** 1 developer per unit, 90% test coverage required

| Unit | Estimated Time | Parallel? |
|------|---------------|-----------|
| 012a | 2 weeks | No (foundation) |
| 012b | 1 week | Yes (after 012a) |
| 012c | 1.5 weeks | Yes (after 012a) |
| 012d | 1.5 weeks | Yes (after 012a) |
| 012e | 1.5 weeks | Yes (after 012a) |
| 012f | 2 weeks | No (needs all backend units) |

**Total Timeline:**
- Sequential: 9.5 weeks
- Parallel (4 devs): 5.5 weeks (012a → 012b-e parallel → 012f)

**Realistic with buffer:** 7-8 weeks (parallel strategy)
