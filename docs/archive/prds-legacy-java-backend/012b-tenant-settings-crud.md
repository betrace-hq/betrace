# PRD-012b: Tenant Settings CRUD

**Parent PRD:** PRD-012 (Tenant Management System)
**Unit:** B
**Priority:** P0
**Dependencies:** PRD-012a (Tenant Onboarding)

## Scope

Implement tenant settings management: update tenant name, logo URL, timezone, and retention policies. Settings stored in TigerBeetle as transfers (NOT SQL per ADR-011). Emit SOC2 CC8.1 compliance spans for change management audit. Frontend settings page with form validation.

## Architecture

```
PUT /api/tenants/{tenantId}/settings (authenticated)
        ↓
   TenantSettingsRoute (Camel REST DSL)
        ↓
   UpdateTenantSettingsProcessor (Named processor)
        ├── Validate tenantId matches authenticated user's tenant (PRD-001)
        ├── Validate settings payload (name, logo, timezone, retentionDays)
        ├── Create TigerBeetle transfer (code=9, op_type=2, settings hash)
        ├── Store settings in TigerBeetle account userData (code=10)
        ├── Emit SOC2 CC8.1 compliance span
        └── Return updated settings
        ↓
GET /api/tenants/{tenantId}/settings
        ↓
   GetTenantSettingsProcessor (Named processor)
        ├── Query TigerBeetle account (code=10)
        ├── Unpack settings from userData128/userData64
        └── Return settings JSON
```

## TigerBeetle Schema (ADR-011 Compliance)

**Tenant Settings Account (code=10):**
```java
Account tenantSettings = new Account(
    id: UUID (tenantId + "-settings"),
    code: 10,  // Tenant settings
    userData128: pack(
        retention_days: 16 bits (1-365),
        timezone_offset: 16 bits (minutes from UTC, -720 to 720),
        logo_url_hash: 96 bits (SHA-256 first 96 bits)
    ),
    userData64: name_hash (SHA-256 first 64 bits),
    ledger: tenantToLedgerId(tenantId),
    reserved: [unused]
);
```

**Settings Update Transfer (code=9, op_type=2):**
```java
Transfer settingsUpdate = new Transfer(
    id: UUID (event ID),
    debitAccountId: tenantAccount (code=9),
    creditAccountId: tenantSettings (code=10),
    amount: 1,  // Update count
    code: 9,  // Tenant operation
    userData128: pack(
        op_type: 8 bits (2=update),
        field_mask: 8 bits (bit flags: 0=name, 1=logo, 2=timezone, 3=retention),
        old_hash: 112 bits (SHA-256 of old settings)
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

## Implementation

### Backend Files

**Route:**
```java
// backend/src/main/java/com/betrace/routes/TenantSettingsRoute.java
@ApplicationScoped
public class TenantSettingsRoute extends RouteBuilder {
    @Override
    public void configure() {
        rest("/api/tenants/{tenantId}/settings")
            .get()
            .produces("application/json")
            .to("direct:getTenantSettings")

            .put()
            .consumes("application/json")
            .produces("application/json")
            .to("direct:updateTenantSettings");

        from("direct:getTenantSettings")
            .process("getTenantSettingsProcessor")
            .marshal().json();

        from("direct:updateTenantSettings")
            .process("updateTenantSettingsProcessor")
            .marshal().json();
    }
}
```

**Processors:**
```java
// backend/src/main/java/com/betrace/processors/TenantSettingsProcessors.java
@ApplicationScoped
public class TenantSettingsProcessors {

    @Inject
    TigerBeetleClient tigerBeetleClient;

    @Named("getTenantSettingsProcessor")
    public static class GetProcessor implements Processor {
        @Inject
        TigerBeetleClient client;

        @Override
        public void process(Exchange exchange) throws Exception {
            String tenantId = exchange.getProperty("tenantId", String.class);
            String authTenantId = exchange.getProperty("authTenantId", String.class);

            // Enforce tenant isolation (ADR-012)
            if (!tenantId.equals(authTenantId)) {
                throw new SecurityException("Cannot access other tenant's settings");
            }

            // Query TigerBeetle account (code=10)
            UUID settingsId = UUID.nameUUIDFromBytes((tenantId + "-settings").getBytes());
            Account settingsAccount = client.getAccount(settingsId);

            if (settingsAccount == null) {
                // Return defaults if no settings stored
                exchange.getMessage().setBody(getDefaultSettings());
                return;
            }

            // Unpack settings from userData
            TenantSettings settings = unpackSettings(settingsAccount);
            exchange.getMessage().setBody(settings);
        }

        private TenantSettings unpackSettings(Account account) {
            // Unpack userData128: retentionDays (16), timezoneOffset (16), logoUrlHash (96)
            // Unpack userData64: nameHash
            // Query recent transfers to reconstruct full logo URL and name
            return new TenantSettings(/* ... */);
        }

        private TenantSettings getDefaultSettings() {
            return new TenantSettings(
                "My Organization",
                null,  // No logo
                "UTC",
                90  // 90 days retention
            );
        }
    }

    @Named("updateTenantSettingsProcessor")
    public static class UpdateProcessor implements Processor {
        @Inject
        TigerBeetleClient client;

        @Override
        @SOC2(controls = {CC8_1}, notes = "Tenant settings change management")
        public void process(Exchange exchange) throws Exception {
            String tenantId = exchange.getProperty("tenantId", String.class);
            String authTenantId = exchange.getProperty("authTenantId", String.class);
            String userId = exchange.getProperty("userId", String.class);

            // Enforce tenant isolation
            if (!tenantId.equals(authTenantId)) {
                throw new SecurityException("Cannot modify other tenant's settings");
            }

            // Parse request body
            TenantSettingsRequest request = exchange.getIn().getBody(TenantSettingsRequest.class);
            validateSettings(request);

            // Get existing settings
            UUID settingsId = UUID.nameUUIDFromBytes((tenantId + "-settings").getBytes());
            Account existingSettings = client.getAccount(settingsId);

            // Create or update settings account
            if (existingSettings == null) {
                createSettingsAccount(tenantId, request);
            } else {
                updateSettingsAccount(existingSettings, request);
            }

            // Record change in transfer (code=9, op_type=2)
            byte fieldMask = calculateFieldMask(existingSettings, request);
            Transfer changeEvent = buildSettingsUpdateTransfer(tenantId, fieldMask);
            client.createTransfer(changeEvent);

            // Emit SOC2 CC8.1 compliance span
            emitComplianceSpan(tenantId, userId, request, fieldMask);

            // Return updated settings
            TenantSettings updated = new TenantSettings(
                request.name,
                request.logoUrl,
                request.timezone,
                request.retentionDays
            );
            exchange.getMessage().setBody(updated);
        }

        private void validateSettings(TenantSettingsRequest request) {
            if (request.name == null || request.name.trim().isEmpty()) {
                throw new IllegalArgumentException("Tenant name cannot be empty");
            }
            if (request.retentionDays < 1 || request.retentionDays > 365) {
                throw new IllegalArgumentException("Retention days must be 1-365");
            }
            if (request.logoUrl != null && !isValidUrl(request.logoUrl)) {
                throw new IllegalArgumentException("Invalid logo URL");
            }
            // Validate timezone
            try {
                ZoneId.of(request.timezone);
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid timezone: " + request.timezone);
            }
        }

        private byte calculateFieldMask(Account existing, TenantSettingsRequest request) {
            byte mask = 0;
            if (existing == null) return 0b00001111;  // All fields (new settings)

            // Compare and set bits: 0=name, 1=logo, 2=timezone, 3=retention
            TenantSettings old = unpackSettings(existing);
            if (!old.name.equals(request.name)) mask |= 0b00000001;
            if (!Objects.equals(old.logoUrl, request.logoUrl)) mask |= 0b00000010;
            if (!old.timezone.equals(request.timezone)) mask |= 0b00000100;
            if (old.retentionDays != request.retentionDays) mask |= 0b00001000;

            return mask;
        }

        private void emitComplianceSpan(String tenantId, String userId, TenantSettingsRequest request, byte fieldMask) {
            Span span = Span.current();
            span.setAttribute("compliance.framework", "soc2");
            span.setAttribute("compliance.control", "CC8_1");
            span.setAttribute("compliance.evidenceType", "change_management");
            span.setAttribute("tenant.id", tenantId);
            span.setAttribute("user.id", userId);
            span.setAttribute("change.fieldMask", String.format("0x%02X", fieldMask));
            span.addEvent("tenant.settings.updated");
        }
    }
}
```

**Model:**
```java
// backend/src/main/java/com/betrace/model/TenantSettings.java
public record TenantSettings(
    String name,
    String logoUrl,
    String timezone,
    int retentionDays
) {}

// backend/src/main/java/com/betrace/model/TenantSettingsRequest.java
public record TenantSettingsRequest(
    String name,
    String logoUrl,
    String timezone,
    int retentionDays
) {}
```

### Frontend Files

**Settings Page:**
```tsx
// bff/src/routes/settings/tenant.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useState } from 'react';

export const Route = createFileRoute('/settings/tenant')({
  component: TenantSettingsPage,
});

function TenantSettingsPage() {
  const tenantId = useTenantId();  // From auth context (PRD-001)
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant', tenantId, 'settings'],
    queryFn: () => api.getTenantSettings(tenantId),
  });

  const [formData, setFormData] = useState({
    name: settings?.name || '',
    logoUrl: settings?.logoUrl || '',
    timezone: settings?.timezone || 'UTC',
    retentionDays: settings?.retentionDays || 90,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.updateTenantSettings(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenant', tenantId, 'settings']);
      toast.success('Settings updated successfully');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Tenant Settings</h1>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              type="url"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => setFormData({ ...formData, timezone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="retention">Data Retention (days)</Label>
            <Input
              id="retention"
              type="number"
              min="1"
              max="365"
              value={formData.retentionDays}
              onChange={(e) => setFormData({ ...formData, retentionDays: parseInt(e.target.value) })}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              How long to retain signals and traces (1-365 days)
            </p>
          </div>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

**API Client:**
```typescript
// bff/src/lib/api/tenant-client.ts
export const api = {
  getTenantSettings: async (tenantId: string) => {
    const response = await fetch(`/api/tenants/${tenantId}/settings`, {
      headers: { Authorization: `Bearer ${getJwt()}` },
    });
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  },

  updateTenantSettings: async (tenantId: string, settings: TenantSettings) => {
    const response = await fetch(`/api/tenants/${tenantId}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getJwt()}`,
      },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return response.json();
  },
};
```

## Success Criteria

**Functional:**
- [ ] GET /api/tenants/{tenantId}/settings returns settings
- [ ] PUT /api/tenants/{tenantId}/settings updates settings
- [ ] Tenant isolation enforced (cannot read/write other tenant's settings)
- [ ] Settings stored in TigerBeetle (code=10)
- [ ] Change events recorded as transfers (code=9, op_type=2)
- [ ] SOC2 CC8.1 compliance span emitted
- [ ] Frontend form validates input
- [ ] Frontend displays success/error messages

**Performance:**
- [ ] Settings retrieval <50ms (p95)
- [ ] Settings update <200ms (p95)

**Security:**
- [ ] Tenant ID from JWT enforced (cannot modify other tenant)
- [ ] Logo URL validated (must be HTTPS)
- [ ] Timezone validated (valid ZoneId)
- [ ] Retention days validated (1-365)

## Testing Requirements

**Unit Tests (90% coverage):**
```java
@Test
void testGetTenantSettings_Success() {
    // Mock TigerBeetle account with settings
    // Verify settings unpacked correctly
}

@Test
void testGetTenantSettings_NoSettings() {
    // No TigerBeetle account found
    // Verify default settings returned
}

@Test
void testUpdateTenantSettings_Success() {
    // Valid settings request
    // Verify TigerBeetle account created/updated
    // Verify transfer recorded
    // Verify compliance span emitted
}

@Test
void testUpdateTenantSettings_TenantIsolationViolation() {
    // authTenantId != tenantId
    // Verify SecurityException thrown
}

@Test
void testUpdateTenantSettings_InvalidTimezone() {
    // Invalid timezone in request
    // Verify IllegalArgumentException thrown
}

@Test
void testFieldMaskCalculation() {
    // Test each field change sets correct bit
    // Test multiple field changes combine bits
}
```

**Integration Tests:**
```java
@Test
void testEndToEndSettingsUpdate() {
    // Create tenant (PRD-012a)
    // PUT /api/tenants/{id}/settings
    // GET /api/tenants/{id}/settings
    // Verify settings match
    // Query TigerBeetle for transfer
}
```

## Files to Create

**Backend:**
- `backend/src/main/java/com/betrace/routes/TenantSettingsRoute.java`
- `backend/src/main/java/com/betrace/processors/TenantSettingsProcessors.java`
- `backend/src/main/java/com/betrace/model/TenantSettings.java`
- `backend/src/main/java/com/betrace/model/TenantSettingsRequest.java`
- `backend/src/test/java/com/betrace/processors/TenantSettingsProcessorsTest.java`
- `backend/src/test/java/com/betrace/integration/TenantSettingsIntegrationTest.java`

**Frontend:**
- `bff/src/routes/settings/tenant.tsx`
- `bff/src/lib/api/tenant-client.ts`
- `bff/src/stories/TenantSettings.stories.tsx`

## Files to Modify

**Backend:**
- None (standalone routes/processors)

**Frontend:**
- `bff/src/routes/settings/index.tsx` - Add link to tenant settings

## Integration Points

**Depends On:**
- **PRD-012a:** Tenant must exist before settings can be updated
- **PRD-001:** JWT provides authTenantId for isolation enforcement
- **PRD-002:** TigerBeetle client for account/transfer operations

**Consumed By:**
- **PRD-012d:** Usage tracking respects retentionDays setting
- **PRD-012f:** Frontend displays tenant name/logo in header

## ADR Compliance

- **ADR-011 (TigerBeetle-First):** Settings in TigerBeetle accounts (code=10), NOT SQL
- **ADR-012 (Mathematical Tenant Isolation):** authTenantId validation, per-tenant ledger
- **ADR-013 (Camel-First):** Implemented as Camel routes
- **ADR-014 (Named Processors):** All logic in named CDI processors
- **ADR-015 (Workflow Standards):** 90% test coverage, conventional commits

## Compliance Benefits

**SOC2 CC8.1 (Change Management):**
- All settings changes recorded in TigerBeetle transfers
- Compliance spans emitted for audit trail
- Field-level change tracking (fieldMask)

**Audit Trail:**
1. Query transfers (code=9, op_type=2) for tenant
2. Inspect fieldMask to see what changed
3. Reconstruct full change history from userData128
