# PRD-012c: Team Member Management

**Parent PRD:** PRD-012 (Tenant Management System)
**Unit:** C
**Priority:** P0
**Dependencies:** PRD-012a (Tenant Onboarding), PRD-001 (Authentication)

## Scope

Implement team member management: invite users via email, assign roles (admin, developer, sre, compliance-viewer), revoke access, list team members. User invitations create pending accounts in TigerBeetle. Emit SOC2 CC6.2 compliance spans for access provisioning/de-provisioning. Frontend team management UI with role assignment.

## Architecture

```
POST /api/tenants/{tenantId}/members/invite (authenticated, admin only)
        ↓
   InviteTeamMemberProcessor
        ├── Verify requester is admin (PRD-001 RBAC)
        ├── Create pending user account in TigerBeetle (code=11)
        ├── Send email invitation via WorkOS (optional for MVP)
        ├── Record invitation transfer (code=9, op_type=3)
        ├── Emit SOC2 CC6.2 compliance span (access provisioning)
        └── Return invitationId, email, role, status: "pending"
        ↓
GET /api/tenants/{tenantId}/members
        ↓
   ListTeamMembersProcessor
        ├── Query TigerBeetle accounts (code=11, ledger=tenantId)
        ├── Unpack user metadata (email, role, status)
        └── Return list of members
        ↓
DELETE /api/tenants/{tenantId}/members/{userId} (authenticated, admin only)
        ↓
   RevokeTeamMemberProcessor
        ├── Verify requester is admin
        ├── Mark user account as revoked (status=3)
        ├── Record revocation transfer (code=9, op_type=4)
        ├── Emit SOC2 CC6.2 compliance span (access removal)
        └── Return success
```

## TigerBeetle Schema (ADR-011 Compliance)

**Team Member Account (code=11):**
```java
Account teamMember = new Account(
    id: UUID (user ID from WorkOS or generated),
    code: 11,  // Team member
    userData128: pack(
        role: 8 bits (1=admin, 2=developer, 3=sre, 4=compliance-viewer),
        status: 8 bits (1=pending, 2=active, 3=revoked),
        invited_at: 64 bits (Unix timestamp ms),
        invited_by: 48 bits (first 48 bits of admin UUID)
    ),
    userData64: email_hash (SHA-256 first 64 bits),
    ledger: tenantToLedgerId(tenantId),
    reserved: [unused]
);
```

**Team Member Operation Transfer (code=9, op_type=3/4):**
```java
Transfer memberOperation = new Transfer(
    id: UUID (event ID),
    debitAccountId: tenantAccount (code=9),
    creditAccountId: teamMemberAccount (code=11),
    amount: 1,  // Operation count
    code: 9,  // Tenant operation
    userData128: pack(
        op_type: 8 bits (3=invite, 4=revoke, 5=role_change),
        role: 8 bits (new role if op_type=5),
        reason_code: 8 bits (revocation reason),
        reserved: 104 bits
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

## Role Definitions (from PRD-001)

| Role | Code | Permissions |
|------|------|-------------|
| admin | 1 | Full access: tenant settings, team management, rules, signals |
| developer | 2 | Create/edit rules, view signals (no team management) |
| sre | 3 | View signals, investigate (no rule modification) |
| compliance-viewer | 4 | Read-only compliance evidence and audit reports |

## Implementation

### Backend Files

**Route:**
```java
// backend/src/main/java/com/fluo/routes/TeamMemberRoute.java
@ApplicationScoped
public class TeamMemberRoute extends RouteBuilder {
    @Override
    public void configure() {
        rest("/api/tenants/{tenantId}/members")
            .get()
            .produces("application/json")
            .to("direct:listTeamMembers")

            .post("/invite")
            .consumes("application/json")
            .produces("application/json")
            .to("direct:inviteTeamMember")

            .delete("/{userId}")
            .to("direct:revokeTeamMember");

        from("direct:listTeamMembers")
            .process("listTeamMembersProcessor")
            .marshal().json();

        from("direct:inviteTeamMember")
            .process("inviteTeamMemberProcessor")
            .marshal().json();

        from("direct:revokeTeamMember")
            .process("revokeTeamMemberProcessor")
            .marshal().json();
    }
}
```

**Processors:**
```java
// backend/src/main/java/com/fluo/processors/TeamMemberProcessors.java
@ApplicationScoped
public class TeamMemberProcessors {

    @Named("inviteTeamMemberProcessor")
    public static class InviteProcessor implements Processor {
        @Inject
        TigerBeetleClient client;

        @Inject
        RBACService rbacService;

        @Override
        @SOC2(controls = {CC6_2}, notes = "User access provisioning")
        public void process(Exchange exchange) throws Exception {
            String tenantId = exchange.getProperty("tenantId", String.class);
            String authTenantId = exchange.getProperty("authTenantId", String.class);
            String adminUserId = exchange.getProperty("userId", String.class);
            List<String> roles = exchange.getProperty("userRoles", List.class);

            // Enforce tenant isolation
            if (!tenantId.equals(authTenantId)) {
                throw new SecurityException("Cannot invite to other tenant");
            }

            // Verify admin permission
            if (!roles.contains("admin")) {
                throw new SecurityException("Only admins can invite team members");
            }

            // Parse request
            TeamMemberInviteRequest request = exchange.getIn().getBody(TeamMemberInviteRequest.class);
            validateInviteRequest(request);

            // Generate user ID (or look up if email exists in WorkOS)
            UUID userId = UUID.randomUUID();

            // Check if already invited
            if (client.getAccount(userId) != null) {
                throw new IllegalArgumentException("User already invited");
            }

            // Create team member account (code=11, status=pending)
            Account memberAccount = buildTeamMemberAccount(
                userId,
                request.email,
                request.role,
                1,  // status: pending
                adminUserId,
                tenantId
            );
            client.createAccount(memberAccount);

            // Record invitation transfer
            Transfer inviteEvent = buildInviteTransfer(tenantId, userId, request.role);
            client.createTransfer(inviteEvent);

            // Emit compliance span
            emitProvisioningSpan(tenantId, userId, request.email, request.role, adminUserId);

            // TODO: Send email invitation via WorkOS (optional for MVP)

            // Return response
            TeamMemberResponse response = new TeamMemberResponse(
                userId.toString(),
                request.email,
                request.role,
                "pending",
                Instant.now()
            );
            exchange.getMessage().setBody(response);
        }

        private void validateInviteRequest(TeamMemberInviteRequest request) {
            if (request.email == null || !isValidEmail(request.email)) {
                throw new IllegalArgumentException("Invalid email");
            }
            if (request.role == null || !isValidRole(request.role)) {
                throw new IllegalArgumentException("Invalid role: must be admin, developer, sre, or compliance-viewer");
            }
        }

        private boolean isValidRole(String role) {
            return List.of("admin", "developer", "sre", "compliance-viewer").contains(role);
        }

        private Account buildTeamMemberAccount(UUID userId, String email, String role, byte status, String invitedBy, String tenantId) {
            byte roleCode = roleToCode(role);
            long invitedAt = Instant.now().toEpochMilli();
            long invitedByBits = UUIDToLong48(UUID.fromString(invitedBy));

            return new Account(
                userId,
                11,  // code: team member
                packUserData128(roleCode, status, invitedAt, invitedByBits),
                hashEmail(email),
                tenantToLedgerId(tenantId),
                new byte[48]
            );
        }

        private byte roleToCode(String role) {
            return switch (role) {
                case "admin" -> 1;
                case "developer" -> 2;
                case "sre" -> 3;
                case "compliance-viewer" -> 4;
                default -> throw new IllegalArgumentException("Unknown role");
            };
        }

        private Transfer buildInviteTransfer(String tenantId, UUID userId, String role) {
            byte opType = 3;  // invite
            byte roleCode = roleToCode(role);

            return new Transfer(
                UUID.randomUUID(),
                UUID.fromString(tenantId),  // tenant account
                userId,  // team member account
                1,
                9,  // code: tenant operation
                packOperationUserData128(opType, roleCode, (byte) 0),
                Instant.now().toEpochMilli(),
                tenantToLedgerId(tenantId)
            );
        }

        private void emitProvisioningSpan(String tenantId, UUID userId, String email, String role, String adminUserId) {
            Span span = Span.current();
            span.setAttribute("compliance.framework", "soc2");
            span.setAttribute("compliance.control", "CC6_2");
            span.setAttribute("compliance.evidenceType", "access_provisioning");
            span.setAttribute("tenant.id", tenantId);
            span.setAttribute("user.id", userId.toString());
            span.setAttribute("user.email", email);
            span.setAttribute("user.role", role);
            span.setAttribute("admin.userId", adminUserId);
            span.addEvent("team.member.invited");
        }
    }

    @Named("listTeamMembersProcessor")
    public static class ListProcessor implements Processor {
        @Inject
        TigerBeetleClient client;

        @Override
        public void process(Exchange exchange) throws Exception {
            String tenantId = exchange.getProperty("tenantId", String.class);
            String authTenantId = exchange.getProperty("authTenantId", String.class);

            // Enforce tenant isolation
            if (!tenantId.equals(authTenantId)) {
                throw new SecurityException("Cannot list other tenant's members");
            }

            // Query all team member accounts for tenant (code=11, ledger=tenantId)
            List<Account> memberAccounts = client.queryAccountsByCodeAndLedger(11, tenantToLedgerId(tenantId));

            // Unpack and build response
            List<TeamMemberResponse> members = memberAccounts.stream()
                .map(this::unpackTeamMember)
                .collect(Collectors.toList());

            exchange.getMessage().setBody(members);
        }

        private TeamMemberResponse unpackTeamMember(Account account) {
            // Unpack userData128: role (8), status (8), invitedAt (64), invitedBy (48)
            byte[] userData = account.userData128;
            byte roleCode = userData[0];
            byte statusCode = userData[1];
            long invitedAt = extractInvitedAt(userData);

            String role = codeToRole(roleCode);
            String status = codeToStatus(statusCode);

            // Reconstruct email from recent transfers (TODO: or cache in separate lookup table)
            String email = lookupEmailByUserId(account.id);

            return new TeamMemberResponse(
                account.id.toString(),
                email,
                role,
                status,
                Instant.ofEpochMilli(invitedAt)
            );
        }

        private String codeToRole(byte code) {
            return switch (code) {
                case 1 -> "admin";
                case 2 -> "developer";
                case 3 -> "sre";
                case 4 -> "compliance-viewer";
                default -> "unknown";
            };
        }

        private String codeToStatus(byte code) {
            return switch (code) {
                case 1 -> "pending";
                case 2 -> "active";
                case 3 -> "revoked";
                default -> "unknown";
            };
        }
    }

    @Named("revokeTeamMemberProcessor")
    public static class RevokeProcessor implements Processor {
        @Inject
        TigerBeetleClient client;

        @Override
        @SOC2(controls = {CC6_2}, notes = "User access removal")
        public void process(Exchange exchange) throws Exception {
            String tenantId = exchange.getProperty("tenantId", String.class);
            String authTenantId = exchange.getProperty("authTenantId", String.class);
            String adminUserId = exchange.getProperty("userId", String.class);
            List<String> roles = exchange.getProperty("userRoles", List.class);
            String userIdToRevoke = exchange.getIn().getHeader("userId", String.class);

            // Enforce tenant isolation
            if (!tenantId.equals(authTenantId)) {
                throw new SecurityException("Cannot revoke from other tenant");
            }

            // Verify admin permission
            if (!roles.contains("admin")) {
                throw new SecurityException("Only admins can revoke team members");
            }

            // Cannot revoke self
            if (userIdToRevoke.equals(adminUserId)) {
                throw new IllegalArgumentException("Cannot revoke your own access");
            }

            // Get member account
            UUID userId = UUID.fromString(userIdToRevoke);
            Account memberAccount = client.getAccount(userId);
            if (memberAccount == null) {
                throw new IllegalArgumentException("User not found");
            }

            // Update status to revoked (status=3)
            Account updated = memberAccount.withUpdatedStatus((byte) 3);
            client.updateAccount(updated);

            // Record revocation transfer
            Transfer revokeEvent = buildRevokeTransfer(tenantId, userId, (byte) 1 /* reason: admin revocation */);
            client.createTransfer(revokeEvent);

            // Emit compliance span
            emitRevocationSpan(tenantId, userId, adminUserId);

            exchange.getMessage().setBody(Map.of("success", true));
        }

        private Transfer buildRevokeTransfer(String tenantId, UUID userId, byte reasonCode) {
            byte opType = 4;  // revoke

            return new Transfer(
                UUID.randomUUID(),
                UUID.fromString(tenantId),
                userId,
                1,
                9,
                packOperationUserData128(opType, (byte) 0, reasonCode),
                Instant.now().toEpochMilli(),
                tenantToLedgerId(tenantId)
            );
        }

        private void emitRevocationSpan(String tenantId, UUID userId, String adminUserId) {
            Span span = Span.current();
            span.setAttribute("compliance.framework", "soc2");
            span.setAttribute("compliance.control", "CC6_2");
            span.setAttribute("compliance.evidenceType", "access_removal");
            span.setAttribute("tenant.id", tenantId);
            span.setAttribute("user.id", userId.toString());
            span.setAttribute("admin.userId", adminUserId);
            span.addEvent("team.member.revoked");
        }
    }
}
```

**Models:**
```java
// backend/src/main/java/com/fluo/model/TeamMemberInviteRequest.java
public record TeamMemberInviteRequest(
    String email,
    String role  // admin, developer, sre, compliance-viewer
) {}

// backend/src/main/java/com/fluo/model/TeamMemberResponse.java
public record TeamMemberResponse(
    String userId,
    String email,
    String role,
    String status,  // pending, active, revoked
    Instant invitedAt
) {}
```

### Frontend Files

**Team Management Page:**
```tsx
// bff/src/components/settings/team-members.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

export function TeamMembers() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('developer');

  const { data: members, isLoading } = useQuery({
    queryKey: ['tenant', tenantId, 'members'],
    queryFn: () => api.listTeamMembers(tenantId),
  });

  const inviteMutation = useMutation({
    mutationFn: (data) => api.inviteTeamMember(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenant', tenantId, 'members']);
      setInviteEmail('');
      toast.success('Invitation sent');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (userId) => api.revokeTeamMember(tenantId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenant', tenantId, 'members']);
      toast.success('Access revoked');
    },
  });

  const handleInvite = (e) => {
    e.preventDefault();
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Team Members</h2>

        <form onSubmit={handleInvite} className="flex gap-2 mb-6">
          <Input
            type="email"
            placeholder="user@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <option value="admin">Admin</option>
            <option value="developer">Developer</option>
            <option value="sre">SRE</option>
            <option value="compliance-viewer">Compliance Viewer</option>
          </Select>
          <Button type="submit" disabled={inviteMutation.isPending}>
            Invite
          </Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((member) => (
              <TableRow key={member.userId}>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{member.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={member.status === 'active' ? 'success' : member.status === 'pending' ? 'warning' : 'destructive'}
                  >
                    {member.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(member.invitedAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeMutation.mutate(member.userId)}
                    disabled={revokeMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
```

## Success Criteria

**Functional:**
- [ ] POST /api/tenants/{tenantId}/members/invite creates pending user
- [ ] GET /api/tenants/{tenantId}/members lists all team members
- [ ] DELETE /api/tenants/{tenantId}/members/{userId} revokes access
- [ ] Only admins can invite/revoke (enforced via PRD-001 RBAC)
- [ ] Tenant isolation enforced (cannot invite to other tenant)
- [ ] Cannot revoke self
- [ ] SOC2 CC6.2 compliance spans emitted

**Performance:**
- [ ] List members <100ms for 50 members
- [ ] Invite completes <500ms

**Security:**
- [ ] Admin-only operations enforced
- [ ] Tenant ID from JWT validated
- [ ] Email addresses hashed in TigerBeetle

## Testing Requirements

**Unit Tests (90% coverage):**
```java
@Test
void testInviteTeamMember_Success() {
    // Admin invites developer
    // Verify account created (code=11, status=pending)
    // Verify transfer recorded (op_type=3)
    // Verify compliance span emitted
}

@Test
void testInviteTeamMember_NonAdminDenied() {
    // Developer tries to invite
    // Verify SecurityException thrown
}

@Test
void testInviteTeamMember_InvalidRole() {
    // Invalid role in request
    // Verify IllegalArgumentException
}

@Test
void testListTeamMembers_TenantIsolation() {
    // Tenant A lists members
    // Verify only sees own members (ledger isolation)
}

@Test
void testRevokeTeamMember_CannotRevokeSelf() {
    // Admin tries to revoke self
    // Verify IllegalArgumentException
}
```

## Files to Create

**Backend:**
- `backend/src/main/java/com/fluo/routes/TeamMemberRoute.java`
- `backend/src/main/java/com/fluo/processors/TeamMemberProcessors.java`
- `backend/src/main/java/com/fluo/model/TeamMemberInviteRequest.java`
- `backend/src/main/java/com/fluo/model/TeamMemberResponse.java`
- `backend/src/test/java/com/fluo/processors/TeamMemberProcessorsTest.java`

**Frontend:**
- `bff/src/components/settings/team-members.tsx`
- `bff/src/lib/api/team-client.ts`
- `bff/src/stories/TeamMembers.stories.tsx`

## Files to Modify

**Backend:**
- None (standalone routes/processors)

**Frontend:**
- `bff/src/routes/settings/index.tsx` - Add team members tab

## Integration Points

**Depends On:**
- **PRD-012a:** Tenant must exist
- **PRD-001:** JWT provides userId, roles for RBAC enforcement
- **PRD-002:** TigerBeetle client

**Consumed By:**
- **PRD-012f:** Frontend displays team member count in settings

## ADR Compliance

- **ADR-011 (TigerBeetle-First):** Team members in TigerBeetle accounts (code=11)
- **ADR-012 (Mathematical Tenant Isolation):** Per-tenant ledger, authTenantId validation
- **ADR-013 (Camel-First):** Implemented as Camel routes
- **ADR-014 (Named Processors):** All logic in named CDI processors
- **ADR-015 (Workflow Standards):** 90% test coverage

## Compliance Benefits

**SOC2 CC6.2 (Access Provisioning/Removal):**
- All invitations and revocations recorded in TigerBeetle
- Compliance spans emitted for audit
- Immutable audit trail (who invited whom, when, with what role)
