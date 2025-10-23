# PRD-012: Tenant Management System

**Priority:** P0 (Core Feature)
**Complexity:** Medium
**Personas:** Admin
**Dependencies:** PRD-002 (Persistence), PRD-006 (KMS)

## Problem

No tenant management:
- Tenants created manually
- No onboarding flow
- No tenant settings
- No usage quotas
- No billing integration

## Solution

### Tenant Onboarding

1. User signs up via WorkOS
2. System creates tenant record
3. Generate KMS keys for tenant
4. Initialize Drools session
5. Create default rules (optional)

### Tenant Admin UI

- Tenant settings (name, logo, timezone)
- Usage dashboard (API calls, signals, rules)
- Team management (invite users, assign roles)
- Billing info (plan, usage limits)
- API keys for CI/CD integration

## Success Criteria

- [ ] Tenant onboarding flow
- [ ] Tenant settings CRUD
- [ ] Team member management
- [ ] Usage tracking
- [ ] API key generation
- [ ] Test coverage: Onboarding, settings, team management

## Files to Create

- `backend/src/main/java/com/betrace/routes/TenantApiRoute.java`
- `backend/src/main/java/com/betrace/services/TenantOnboardingService.java`
- `bff/src/routes/settings/tenant.tsx`
- `bff/src/components/settings/team-members.tsx`

## Public Examples

### 1. Auth0 Organizations
**URL:** https://auth0.com/docs/manage-users/organizations

**Relevance:** Multi-tenant identity management platform demonstrating organization-level RBAC, SSO configuration, and user provisioning. Provides proven patterns for tenant isolation and team member management.

**Key Patterns:**
- Organization entity model (tenant → organization mapping)
- Organization-scoped roles and permissions
- Invitation flow for team members
- Organization metadata and branding
- SSO connections per organization

**BeTrace Alignment:** Auth0's organization model directly maps to BeTrace's tenant concept. Organization invitations inform BeTrace's team member management.

### 2. Stripe Customer Management
**URL:** https://stripe.com/docs/api/customers

**Relevance:** Multi-tenant subscription and usage metering platform. Demonstrates quota management, usage tracking, and billing integration patterns applicable to BeTrace's tenant quotas.

**Key Patterns:**
- Customer entity (tenant) with metadata
- Usage-based billing with metering
- Subscription plans and limits
- Invoice generation
- Webhook events for usage thresholds

**BeTrace Implementation:** Stripe's usage metering patterns inform BeTrace's API call tracking, signal quotas, and usage dashboard.

### 3. AWS Organizations
**URL:** https://docs.aws.amazon.com/organizations/

**Relevance:** Hierarchical multi-account (multi-tenant) management system. While more complex than BeTrace's needs, demonstrates organizational boundaries, service control policies, and consolidated billing.

**Key Patterns:**
- Organizational units (hierarchy)
- Service Control Policies (SCPs) for resource limits
- Consolidated billing across accounts
- Tag-based resource organization
- Cross-account access controls

**BeTrace Adaptation:** AWS Organizations' resource quotas and policy enforcement patterns inform BeTrace's tenant isolation and quota management. BeTrace's simpler single-level tenant model avoids AWS's hierarchical complexity.
