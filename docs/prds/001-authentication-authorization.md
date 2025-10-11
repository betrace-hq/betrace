# PRD-001: Authentication & Authorization System

**Priority:** P0 (Foundation)
**Complexity:** Complex (System)
**Type:** System Overview
**Dependencies:** None (blocks all other PRDs)

## Problem

FLUO currently has no authentication or authorization system. Anyone can access any tenant's data, create/delete rules, and view signals. This is a critical security and compliance gap preventing production deployment.

## Solution Overview

Implement WorkOS-based OAuth authentication with Camel interceptor-driven authorization. Every HTTP request passes through a processor chain that validates JWT tokens, extracts tenant context, enforces RBAC permissions, records audit events in TigerBeetle, and generates SOC2 compliance evidence. The system is built as 8 independent processors following ADR-014 standards.

## System Architecture

```
HTTP Request (with Authorization: Bearer <jwt>)
        ↓
   [AuthInterceptor - Camel Interceptor on rest:*]
        ↓
   PRD-001a: ExtractJwtTokenProcessor
        ├── Extract "Bearer {token}" from Authorization header
        ├── Store as "jwtToken" in exchange header
        └── Reject if missing (401)
        ↓
   PRD-001b: WorkOSAuthService (Injectable Service)
        ├── Validate JWT signature with WorkOS API
        ├── Verify expiration, issuer, audience
        └── Return AuthenticatedUser(userId, email, tenantId, roles)
        ↓
   PRD-001c: ValidateWorkOSTokenProcessor
        ├── Call WorkOSAuthService with jwtToken
        ├── Store userId, tenantId, userRoles in exchange headers
        ├── Set "authenticated" = true
        └── Reject if invalid (401, stop route)
        ↓
   PRD-001d: ExtractTenantAndRolesProcessor
        ├── Extract tenantId from exchange headers
        ├── Extract userRoles from exchange headers
        ├── Store as exchange properties (for downstream processors)
        └── Used by all subsequent route handlers
        ↓
   PRD-001e: RBACService (Injectable Service)
        ├── Map routes to required roles
        ├── Example: createRule → [admin, developer]
        └── Return boolean: checkRoutePermission(routeId, userRoles)
        ↓
   PRD-001f: CheckRoutePermissionsProcessor
        ├── Get routeId from exchange
        ├── Call RBACService.checkRoutePermission(routeId, userRoles)
        ├── Set "authorized" = true if allowed
        └── Reject if forbidden (403, stop route)
        ↓
   PRD-001g: RecordAuthEventProcessor
        ├── Create TigerBeetle transfer (code=5)
        ├── debitAccountId: userId, creditAccountId: tenantId
        ├── userData128: routeId, method, timestamp
        ├── userData64: authorized (true/false), reason_code
        └── Immutable audit trail (WORM semantics)
        ↓
   PRD-001h: GenerateAuthComplianceSpanProcessor
        ├── Start OpenTelemetry span (name: auth.access.granted/denied)
        ├── Add SOC2 CC6.1 attributes (framework, control, evidence ID)
        ├── Add auth context (userId, tenantId, route, authorized)
        ├── Add span event: access_decision (policy: rbac)
        ├── Set status (OK if granted, ERROR if denied)
        └── Close span → triggers signing (PRD-003)
        ↓
   Route Handler (if authorized)
        ├── Access tenantId from exchange property
        ├── Enforce tenant isolation in data queries
        └── Return response
```

## Unit PRD References

| PRD | Unit | Purpose | Dependencies |
|-----|------|---------|--------------|
| 001a | ExtractJwtTokenProcessor | Extract Bearer token from Authorization header | None |
| 001b | WorkOSAuthService | Validate JWT with WorkOS API, return user profile | None |
| 001c | ValidateWorkOSTokenProcessor | Validate token and populate exchange headers | 001a, 001b |
| 001d | ExtractTenantAndRolesProcessor | Extract tenant ID and roles from headers | 001c |
| 001e | RBACService | Define route-to-role permission mappings | None |
| 001f | CheckRoutePermissionsProcessor | Enforce RBAC on route access | 001d, 001e |
| 001g | RecordAuthEventProcessor | Record auth event in TigerBeetle (audit trail) | 001d, PRD-002 |
| 001h | GenerateAuthComplianceSpanProcessor | Generate SOC2 CC6.1 compliance evidence | 001d, 001g, PRD-003 |

## ADR Compliance Summary

- **ADR-011 (Pure Application Framework):** No SQL tables for auth events - use TigerBeetle transfers (code=5)
- **ADR-012 (Mathematical Tenant Isolation):** Tenant ID extracted from JWT and enforced on every query
- **ADR-013 (Camel-First Architecture):** Authentication implemented as Camel interceptor with processor chain
- **ADR-014 (Testing Standards):** All processors are @Named beans with 90% test coverage requirement
- **ADR-015 (Tiered Storage):** Auth events stored in TigerBeetle (hot tier) and append-only log (cold tier)

## Success Criteria (System-Level)

- [ ] End-to-end authentication flow works (WorkOS login → token validation → route access)
- [ ] RBAC enforced on all protected routes (admin, developer, sre, compliance-viewer roles)
- [ ] Auth events recorded in TigerBeetle for every request (success and failure)
- [ ] Compliance spans generated for every auth event with SOC2 CC6.1 attributes
- [ ] Tenant isolation enforced (users cannot access other tenant's data)
- [ ] Invalid/expired tokens return 401, insufficient permissions return 403
- [ ] Both frontend and backend integration complete
- [ ] All 8 processors pass unit tests with 90% coverage

## Integration Testing

**End-to-End Scenarios:**

1. **Successful Authentication Flow:**
   - User clicks "Login" in frontend → redirects to WorkOS OAuth
   - WorkOS returns auth code → backend exchanges for JWT
   - Frontend stores JWT → sends with Authorization header
   - Backend validates token → extracts tenant + roles → checks permissions → records audit event → generates compliance span → allows access

2. **Authorization Denial:**
   - User with "viewer" role attempts POST /api/rules (requires "developer")
   - Auth succeeds (401) but RBAC fails (403)
   - Audit event recorded with authorized=false, reason_code=3
   - Compliance span generated with auth.access.denied

3. **Tenant Isolation Enforcement:**
   - User in tenant A attempts GET /api/signals?tenantId=B
   - Auth succeeds, RBAC passes, but query filtered by authenticated tenantId (A)
   - Returns empty results (tenant B data not visible)

4. **Token Expiration:**
   - User's JWT expires mid-session
   - Next request returns 401 with "TOKEN_EXPIRED"
   - Frontend redirects to login
   - Failed auth event recorded in TigerBeetle

## Related PRDs

- **PRD-002:** TigerBeetle Persistence Layer (provides auth event storage)
- **PRD-003:** Compliance Span Signing (cryptographic signatures for evidence)
- **PRD-004:** Tenant Management (tenant creation, user-to-tenant mapping)
- **PRD-005:** Rule Management (requires auth for CRUD operations)

## RBAC Role Definitions

- **admin:** Full access to all features (tenant management, user management, rules, signals, compliance)
- **developer:** Can create/update/delete rules, view signals (no tenant/user management)
- **sre:** Can view and investigate signals, cannot modify rules
- **compliance-viewer:** Read-only access to compliance evidence and audit reports

## Configuration

**Environment Variables (backend):**
```properties
workos.api.key=${WORKOS_API_KEY}
workos.client.id=${WORKOS_CLIENT_ID}
workos.redirect.uri=${WORKOS_REDIRECT_URI}
```

**Frontend Environment Variables:**
```bash
VITE_WORKOS_CLIENT_ID=client_...
VITE_WORKOS_API_HOSTNAME=api.workos.com
```

## Files to Create

**Backend:**
- See individual PRDs (001a-001h) for processor files
- `backend/src/main/java/com/fluo/routes/AuthInterceptor.java`
- `backend/src/main/java/com/fluo/model/AuthenticatedUser.java`

**Frontend:**
- `bff/src/lib/auth/workos-provider.tsx`
- `bff/src/components/auth/require-auth.tsx`
- `bff/src/lib/api/auth-client.ts`

## Files to Modify

**Backend:**
- `backend/pom.xml` - Add WorkOS SDK dependency
- `backend/src/main/resources/application.properties` - Add WorkOS config

**Frontend:**
- `bff/package.json` - Add @workos-inc/authkit-react
- `bff/src/main.tsx` - Wrap app with WorkOSProvider
- `bff/src/routes/` - Wrap protected routes with RequireAuth

## Public Examples

### 1. Auth0 with Spring Security
**URL:** https://auth0.com/docs/quickstart/backend/java-spring-security

**Relevance:** Demonstrates JWT validation, RBAC authorization, and OAuth flow implementation similar to FLUO's WorkOS integration. Shows how to extract claims from JWT tokens, validate signatures, and enforce role-based permissions.

**Key Patterns:**
- JWT token validation with signature verification
- Role extraction from token claims
- Request interceptor pattern for authorization
- Audit logging of authentication events

### 2. Keycloak Integration
**URL:** https://www.keycloak.org/docs/latest/securing_apps/

**Relevance:** Open-source identity provider with comprehensive documentation on OAuth/OIDC flows, JWT handling, and multi-tenant authorization. Particularly relevant for understanding tenant isolation in authentication systems.

**Key Patterns:**
- Multi-tenant authentication with realm isolation
- JWT token structure and validation
- RBAC with role mappings
- Session management and token refresh

### 3. WorkOS Authentication SDK
**URL:** https://workos.com/docs/sso/guide

**Relevance:** Direct implementation guide for WorkOS OAuth integration. This is FLUO's chosen authentication provider, making this the authoritative reference for implementation details.

**Key Patterns:**
- WorkOS OAuth flow (authorization code grant)
- JWT validation with WorkOS API
- User profile extraction
- Organization/tenant mapping
