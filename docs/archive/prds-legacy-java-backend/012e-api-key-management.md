# PRD-012e: API Key Management

**Parent PRD:** PRD-012 (Tenant Management System)
**Unit:** E
**Priority:** P0
**Dependencies:** PRD-012a (Tenant Onboarding), PRD-001 (Authentication)

## Scope

Implement API key management for CI/CD and programmatic access. Generate API keys with bcrypt hashing, store in TigerBeetle (NOT SQL per ADR-011), validate keys in Camel interceptor, support key rotation and revocation. Emit SOC2 CC6.1/CC6.2 compliance spans for key operations. Frontend UI for key generation and management.

## Architecture

```
POST /api/tenants/{tenantId}/api-keys (authenticated, admin only)
        ↓
   GenerateApiKeyProcessor
        ├── Verify requester is admin (PRD-001 RBAC)
        ├── Generate random API key (32 bytes base64)
        ├── Hash key with bcrypt (cost=12)
        ├── Create TigerBeetle account (code=13, API key metadata)
        ├── Record generation transfer (code=9, op_type=6)
        ├── Emit SOC2 CC6.2 compliance span
        └── Return { keyId, apiKey, name, createdAt } (plaintext key shown ONCE)
        ↓
X-API-Key: fluo_live_abc123... (API request header)
        ↓
   ApiKeyAuthProcessor (Camel interceptor alternative to JWT)
        ├── Extract X-API-Key header
        ├── Parse key prefix (fluo_live_ or fluo_test_)
        ├── Query TigerBeetle for key hash (code=13)
        ├── Verify bcrypt hash matches
        ├── Check key status (active, revoked)
        ├── Extract tenantId from key account
        ├── Set tenantId, userId in exchange properties
        ├── Record API key usage transfer (code=13)
        └── Continue route processing
        ↓
DELETE /api/tenants/{tenantId}/api-keys/{keyId} (authenticated, admin only)
        ↓
   RevokeApiKeyProcessor
        ├── Verify requester is admin
        ├── Mark key account as revoked (status=2)
        ├── Record revocation transfer (code=9, op_type=7)
        ├── Emit SOC2 CC6.2 compliance span
        └── Return success
```

## TigerBeetle Schema (ADR-011 Compliance)

**API Key Account (code=13):**
```java
Account apiKey = new Account(
    id: UUID (key ID),
    code: 13,  // API key
    userData128: pack(
        key_prefix: 64 bits (first 8 bytes of SHA-256(apiKey)),
        status: 8 bits (1=active, 2=revoked),
        created_at: 64 bits (Unix timestamp ms)
    ),
    userData64: tenant_id_hash (first 64 bits of tenant UUID),
    ledger: tenantToLedgerId(tenantId),
    reserved: bcrypt_hash (60 bytes, stored in reserved field)
);
```

**API Key Operation Transfer (code=13):**
```java
Transfer keyOperation = new Transfer(
    id: UUID (event ID),
    debitAccountId: apiKey (code=13),
    creditAccountId: tenantAccount (code=9),
    amount: 1,  // Operation count
    code: 13,  // API key operation
    userData128: pack(
        op_type: 8 bits (1=usage, 2=rotation),
        route_hash: 120 bits (SHA-256 of route ID)
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

**Key Generation Transfer (code=9, op_type=6):**
```java
Transfer keyGeneration = new Transfer(
    id: UUID (event ID),
    debitAccountId: tenantAccount (code=9),
    creditAccountId: apiKey (code=13),
    amount: 1,
    code: 9,  // Tenant operation
    userData128: pack(
        op_type: 8 bits (6=api_key_generated),
        name_hash: 120 bits (SHA-256 of key name)
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

## API Key Format

```
fluo_live_<32_bytes_base64url>
fluo_test_<32_bytes_base64url>

Examples:
fluo_live_A7bC9dEf1GhIjKlMnOpQrStUvWxYz012
fluo_test_Z9yX8wV7uT6sR5qP4oN3mL2kJ1iH0gFe
```

**Prefix:**
- `fluo_live_` - Production environment keys
- `fluo_test_` - Test environment keys (for development, not honored in production)

## Implementation

### Backend Files

**Processor:**
```java
// backend/src/main/java/com/fluo/processors/ApiKeyProcessors.java
@ApplicationScoped
public class ApiKeyProcessors {

    @Named("generateApiKeyProcessor")
    public static class GenerateProcessor implements Processor {
        @Inject
        TigerBeetleClient client;

        @Inject
        BCryptPasswordEncoder encoder;  // cost=12

        @Override
        @SOC2(controls = {CC6_2}, notes = "API key provisioning")
        public void process(Exchange exchange) throws Exception {
            String tenantId = exchange.getProperty("tenantId", String.class);
            String authTenantId = exchange.getProperty("authTenantId", String.class);
            String adminUserId = exchange.getProperty("userId", String.class);
            List<String> roles = exchange.getProperty("userRoles", List.class);

            // Enforce tenant isolation
            if (!tenantId.equals(authTenantId)) {
                throw new SecurityException("Cannot generate key for other tenant");
            }

            // Verify admin permission
            if (!roles.contains("admin")) {
                throw new SecurityException("Only admins can generate API keys");
            }

            // Parse request
            ApiKeyCreateRequest request = exchange.getIn().getBody(ApiKeyCreateRequest.class);
            validateKeyRequest(request);

            // Generate random API key
            byte[] keyBytes = new byte[32];
            new SecureRandom().nextBytes(keyBytes);
            String apiKey = "fluo_live_" + Base64.getUrlEncoder().withoutPadding().encodeToString(keyBytes);

            // Hash key with bcrypt
            String keyHash = encoder.encode(apiKey);

            // Generate key ID
            UUID keyId = UUID.randomUUID();

            // Create TigerBeetle account (code=13)
            Account keyAccount = buildApiKeyAccount(
                keyId,
                apiKey,
                keyHash,
                tenantId,
                1  // status: active
            );
            client.createAccount(keyAccount);

            // Record generation transfer
            Transfer genEvent = buildKeyGenerationTransfer(tenantId, keyId, request.name);
            client.createTransfer(genEvent);

            // Emit compliance span
            emitKeyGenerationSpan(tenantId, keyId, request.name, adminUserId);

            // Return response (plaintext key shown ONCE)
            ApiKeyResponse response = new ApiKeyResponse(
                keyId.toString(),
                apiKey,  // IMPORTANT: Only returned on creation
                request.name,
                "active",
                Instant.now()
            );
            exchange.getMessage().setBody(response);
        }

        private void validateKeyRequest(ApiKeyCreateRequest request) {
            if (request.name == null || request.name.trim().isEmpty()) {
                throw new IllegalArgumentException("API key name required");
            }
            if (request.name.length() > 50) {
                throw new IllegalArgumentException("API key name too long (max 50 chars)");
            }
        }

        private Account buildApiKeyAccount(UUID keyId, String apiKey, String keyHash, String tenantId, byte status) {
            // Extract key prefix (first 8 bytes of SHA-256)
            byte[] keyPrefixBytes = sha256(apiKey.getBytes()).slice(0, 8);
            long keyPrefix = bytesToLong(keyPrefixBytes);

            long createdAt = Instant.now().toEpochMilli();
            long tenantIdHash = UUIDToLong64(UUID.fromString(tenantId));

            // Store bcrypt hash in reserved field (60 bytes)
            byte[] reserved = new byte[48];
            System.arraycopy(keyHash.getBytes(), 0, reserved, 0, Math.min(60, keyHash.length()));

            return new Account(
                keyId,
                13,  // code: API key
                packUserData128(keyPrefix, status, createdAt),
                tenantIdHash,
                tenantToLedgerId(tenantId),
                reserved
            );
        }

        private Transfer buildKeyGenerationTransfer(String tenantId, UUID keyId, String name) {
            byte opType = 6;  // api_key_generated
            byte[] nameHash = sha256(name.getBytes()).slice(0, 15);  // 120 bits

            return new Transfer(
                UUID.randomUUID(),
                UUID.fromString(tenantId),
                keyId,
                1,
                9,  // code: tenant operation
                packOperationUserData128(opType, nameHash),
                Instant.now().toEpochMilli(),
                tenantToLedgerId(tenantId)
            );
        }

        private void emitKeyGenerationSpan(String tenantId, UUID keyId, String name, String adminUserId) {
            Span span = Span.current();
            span.setAttribute("compliance.framework", "soc2");
            span.setAttribute("compliance.control", "CC6_2");
            span.setAttribute("compliance.evidenceType", "api_key_provisioning");
            span.setAttribute("tenant.id", tenantId);
            span.setAttribute("key.id", keyId.toString());
            span.setAttribute("key.name", name);
            span.setAttribute("admin.userId", adminUserId);
            span.addEvent("api.key.generated");
        }
    }

    @Named("apiKeyAuthProcessor")
    public static class AuthProcessor implements Processor {
        @Inject
        TigerBeetleClient client;

        @Inject
        BCryptPasswordEncoder encoder;

        @Override
        public void process(Exchange exchange) throws Exception {
            String apiKey = exchange.getIn().getHeader("X-API-Key", String.class);

            if (apiKey == null || apiKey.isEmpty()) {
                throw new UnauthorizedException("Missing X-API-Key header");
            }

            // Validate key format
            if (!apiKey.startsWith("fluo_live_") && !apiKey.startsWith("fluo_test_")) {
                throw new UnauthorizedException("Invalid API key format");
            }

            // Extract key prefix for lookup
            byte[] keyPrefixBytes = sha256(apiKey.getBytes()).slice(0, 8);
            long keyPrefix = bytesToLong(keyPrefixBytes);

            // Query TigerBeetle for matching key account (code=13)
            List<Account> keyAccounts = client.queryAccountsByCodeAndUserData128Prefix(13, keyPrefix);

            Account matchedAccount = null;
            for (Account account : keyAccounts) {
                // Extract bcrypt hash from reserved field
                String storedHash = new String(account.reserved).substring(0, 60);

                // Verify bcrypt hash
                if (encoder.matches(apiKey, storedHash)) {
                    matchedAccount = account;
                    break;
                }
            }

            if (matchedAccount == null) {
                throw new UnauthorizedException("Invalid API key");
            }

            // Check key status
            byte status = extractStatus(matchedAccount);
            if (status != 1) {  // 1=active
                throw new UnauthorizedException("API key revoked");
            }

            // Extract tenant ID
            String tenantId = extractTenantId(matchedAccount);

            // Set exchange properties (for downstream processors)
            exchange.setProperty("tenantId", tenantId);
            exchange.setProperty("authTenantId", tenantId);
            exchange.setProperty("userId", matchedAccount.id.toString());  // Key ID as user ID
            exchange.setProperty("userRoles", List.of("api-client"));  // Limited role

            // Record key usage
            recordKeyUsage(matchedAccount.id, exchange.getFromRouteId(), tenantId);
        }

        private void recordKeyUsage(UUID keyId, String routeId, String tenantId) {
            byte opType = 1;  // usage
            byte[] routeHash = sha256(routeId.getBytes()).slice(0, 15);

            Transfer usageEvent = new Transfer(
                UUID.randomUUID(),
                keyId,
                UUID.fromString(tenantId),
                1,
                13,  // code: API key operation
                packOperationUserData128(opType, routeHash),
                Instant.now().toEpochMilli(),
                tenantToLedgerId(tenantId)
            );

            client.createTransfer(usageEvent);
        }
    }

    @Named("revokeApiKeyProcessor")
    public static class RevokeProcessor implements Processor {
        @Inject
        TigerBeetleClient client;

        @Override
        @SOC2(controls = {CC6_2}, notes = "API key revocation")
        public void process(Exchange exchange) throws Exception {
            String tenantId = exchange.getProperty("tenantId", String.class);
            String authTenantId = exchange.getProperty("authTenantId", String.class);
            String adminUserId = exchange.getProperty("userId", String.class);
            List<String> roles = exchange.getProperty("userRoles", List.class);
            String keyIdToRevoke = exchange.getIn().getHeader("keyId", String.class);

            // Enforce tenant isolation
            if (!tenantId.equals(authTenantId)) {
                throw new SecurityException("Cannot revoke key for other tenant");
            }

            // Verify admin permission
            if (!roles.contains("admin")) {
                throw new SecurityException("Only admins can revoke API keys");
            }

            // Get key account
            UUID keyId = UUID.fromString(keyIdToRevoke);
            Account keyAccount = client.getAccount(keyId);
            if (keyAccount == null) {
                throw new IllegalArgumentException("API key not found");
            }

            // Verify key belongs to tenant
            String keyTenantId = extractTenantId(keyAccount);
            if (!keyTenantId.equals(tenantId)) {
                throw new SecurityException("API key does not belong to this tenant");
            }

            // Update status to revoked (status=2)
            Account updated = keyAccount.withUpdatedStatus((byte) 2);
            client.updateAccount(updated);

            // Record revocation transfer
            Transfer revokeEvent = buildRevocationTransfer(tenantId, keyId);
            client.createTransfer(revokeEvent);

            // Emit compliance span
            emitRevocationSpan(tenantId, keyId, adminUserId);

            exchange.getMessage().setBody(Map.of("success", true));
        }

        private Transfer buildRevocationTransfer(String tenantId, UUID keyId) {
            byte opType = 7;  // api_key_revoked

            return new Transfer(
                UUID.randomUUID(),
                UUID.fromString(tenantId),
                keyId,
                1,
                9,  // code: tenant operation
                packOperationUserData128(opType, new byte[15]),
                Instant.now().toEpochMilli(),
                tenantToLedgerId(tenantId)
            );
        }

        private void emitRevocationSpan(String tenantId, UUID keyId, String adminUserId) {
            Span span = Span.current();
            span.setAttribute("compliance.framework", "soc2");
            span.setAttribute("compliance.control", "CC6_2");
            span.setAttribute("compliance.evidenceType", "api_key_revocation");
            span.setAttribute("tenant.id", tenantId);
            span.setAttribute("key.id", keyId.toString());
            span.setAttribute("admin.userId", adminUserId);
            span.addEvent("api.key.revoked");
        }
    }

    @Named("listApiKeysProcessor")
    public static class ListProcessor implements Processor {
        @Inject
        TigerBeetleClient client;

        @Override
        public void process(Exchange exchange) throws Exception {
            String tenantId = exchange.getProperty("tenantId", String.class);
            String authTenantId = exchange.getProperty("authTenantId", String.class);

            // Enforce tenant isolation
            if (!tenantId.equals(authTenantId)) {
                throw new SecurityException("Cannot list other tenant's API keys");
            }

            // Query all API key accounts for tenant (code=13, ledger=tenantId)
            List<Account> keyAccounts = client.queryAccountsByCodeAndLedger(13, tenantToLedgerId(tenantId));

            // Build response (NO plaintext keys)
            List<ApiKeyListResponse> keys = keyAccounts.stream()
                .map(this::unpackApiKey)
                .collect(Collectors.toList());

            exchange.getMessage().setBody(keys);
        }

        private ApiKeyListResponse unpackApiKey(Account account) {
            byte status = extractStatus(account);
            long createdAt = extractCreatedAt(account);

            // Reconstruct key name from transfers (TODO: or cache in metadata)
            String name = lookupKeyNameById(account.id);

            return new ApiKeyListResponse(
                account.id.toString(),
                name,
                codeToStatus(status),
                Instant.ofEpochMilli(createdAt)
            );
        }

        private String codeToStatus(byte code) {
            return switch (code) {
                case 1 -> "active";
                case 2 -> "revoked";
                default -> "unknown";
            };
        }
    }
}
```

**Route:**
```java
// backend/src/main/java/com/fluo/routes/ApiKeyRoute.java
@ApplicationScoped
public class ApiKeyRoute extends RouteBuilder {
    @Override
    public void configure() {
        rest("/api/tenants/{tenantId}/api-keys")
            .get()
            .produces("application/json")
            .to("direct:listApiKeys")

            .post()
            .consumes("application/json")
            .produces("application/json")
            .to("direct:generateApiKey")

            .delete("/{keyId}")
            .to("direct:revokeApiKey");

        from("direct:listApiKeys")
            .process("listApiKeysProcessor")
            .marshal().json();

        from("direct:generateApiKey")
            .process("generateApiKeyProcessor")
            .marshal().json();

        from("direct:revokeApiKey")
            .process("revokeApiKeyProcessor")
            .marshal().json();
    }
}
```

**Models:**
```java
// backend/src/main/java/com/fluo/model/ApiKeyCreateRequest.java
public record ApiKeyCreateRequest(
    String name  // E.g., "CI/CD Pipeline", "Production Monitoring"
) {}

// backend/src/main/java/com/fluo/model/ApiKeyResponse.java
public record ApiKeyResponse(
    String keyId,
    String apiKey,  // Plaintext (only on creation)
    String name,
    String status,
    Instant createdAt
) {}

// backend/src/main/java/com/fluo/model/ApiKeyListResponse.java
public record ApiKeyListResponse(
    String keyId,
    String name,
    String status,
    Instant createdAt
    // NO plaintext apiKey field
) {}
```

### Frontend Files

**API Key Management Page:**
```tsx
// bff/src/routes/settings/api-keys.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/settings/api-keys')({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['tenant', tenantId, 'api-keys'],
    queryFn: () => api.listApiKeys(tenantId),
  });

  const generateMutation = useMutation({
    mutationFn: (name: string) => api.generateApiKey(tenantId, { name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['tenant', tenantId, 'api-keys']);
      setNewKey(data.apiKey);
      setKeyName('');
      toast.success('API key generated');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.revokeApiKey(tenantId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenant', tenantId, 'api-keys']);
      toast.success('API key revoked');
    },
  });

  const handleGenerate = (e) => {
    e.preventDefault();
    generateMutation.mutate(keyName);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">API Keys</h1>

      {newKey && (
        <Card className="p-6 mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500">
          <h3 className="text-lg font-bold mb-2">New API Key Generated</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Copy this key now. You won't be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white dark:bg-gray-800 p-3 rounded border font-mono text-sm">
              {newKey}
            </code>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(newKey)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewKey(null)}>
            Dismiss
          </Button>
        </Card>
      )}

      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Generate New API Key</h2>
        <form onSubmit={handleGenerate} className="flex gap-2">
          <Input
            placeholder="Key name (e.g., CI/CD Pipeline)"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            required
          />
          <Button type="submit" disabled={generateMutation.isPending}>
            Generate Key
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">API Keys</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No API keys. Generate one above.
                </TableCell>
              </TableRow>
            )}
            {keys?.map((key) => (
              <TableRow key={key.keyId}>
                <TableCell className="font-mono text-sm">{key.name}</TableCell>
                <TableCell>
                  <Badge variant={key.status === 'active' ? 'success' : 'destructive'}>
                    {key.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  {key.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeMutation.mutate(key.keyId)}
                      disabled={revokeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
- [ ] POST /api/tenants/{tenantId}/api-keys generates API key
- [ ] API key returned in plaintext only on creation
- [ ] Keys stored as bcrypt hashes (cost=12)
- [ ] X-API-Key header validates via ApiKeyAuthProcessor
- [ ] DELETE /api/tenants/{tenantId}/api-keys/{keyId} revokes key
- [ ] Revoked keys return 401 Unauthorized
- [ ] Only admins can generate/revoke keys
- [ ] SOC2 CC6.1/CC6.2 compliance spans emitted

**Performance:**
- [ ] API key validation <50ms
- [ ] Key generation <500ms

**Security:**
- [ ] Keys use SecureRandom (cryptographically secure)
- [ ] Bcrypt cost=12 (industry standard)
- [ ] Tenant isolation enforced (ledger boundaries)
- [ ] Key usage recorded in TigerBeetle (audit trail)

## Testing Requirements

**Unit Tests (90% coverage):**
```java
@Test
void testGenerateApiKey_Success() {
    // Admin generates key
    // Verify account created (code=13)
    // Verify bcrypt hash stored
    // Verify plaintext key in response
}

@Test
void testApiKeyAuth_ValidKey() {
    // Request with X-API-Key header
    // Verify bcrypt match
    // Verify tenantId extracted
    // Verify usage transfer recorded
}

@Test
void testApiKeyAuth_InvalidKey() {
    // Request with wrong API key
    // Verify UnauthorizedException thrown
}

@Test
void testApiKeyAuth_RevokedKey() {
    // Request with revoked key
    // Verify UnauthorizedException thrown
}

@Test
void testRevokeApiKey_TenantIsolation() {
    // Tenant A tries to revoke tenant B's key
    // Verify SecurityException thrown
}
```

## Files to Create

**Backend:**
- `backend/src/main/java/com/fluo/processors/ApiKeyProcessors.java`
- `backend/src/main/java/com/fluo/routes/ApiKeyRoute.java`
- `backend/src/main/java/com/fluo/model/ApiKeyCreateRequest.java`
- `backend/src/main/java/com/fluo/model/ApiKeyResponse.java`
- `backend/src/main/java/com/fluo/model/ApiKeyListResponse.java`
- `backend/src/test/java/com/fluo/processors/ApiKeyProcessorsTest.java`

**Frontend:**
- `bff/src/routes/settings/api-keys.tsx`
- `bff/src/lib/api/api-key-client.ts`
- `bff/src/stories/ApiKeys.stories.tsx`

## Files to Modify

**Backend:**
- `backend/src/main/java/com/fluo/routes/AuthInterceptor.java` - Add ApiKeyAuthProcessor as alternative to JWT
- `backend/pom.xml` - Add bcrypt dependency
- `backend/src/main/resources/application.properties` - Add bcrypt config

**Frontend:**
- `bff/src/routes/settings/index.tsx` - Add API keys tab

## Integration Points

**Depends On:**
- **PRD-012a:** Tenant must exist
- **PRD-001:** JWT-based auth for admin operations
- **PRD-002:** TigerBeetle client

**Alternative To:**
- **PRD-001:** API keys provide alternative auth method (for CI/CD)

## ADR Compliance

- **ADR-011 (TigerBeetle-First):** API keys in TigerBeetle accounts (code=13)
- **ADR-012 (Mathematical Tenant Isolation):** Per-tenant ledger, key validation
- **ADR-013 (Camel-First):** Implemented as Camel routes and interceptor
- **ADR-014 (Named Processors):** All logic in named CDI processors
- **ADR-015 (Workflow Standards):** 90% test coverage

## Compliance Benefits

**SOC2 CC6.1 (Logical Access):**
- API keys provide controlled programmatic access
- All key usage recorded in TigerBeetle (audit trail)

**SOC2 CC6.2 (Access Provisioning/Removal):**
- Key generation and revocation events emitted as compliance spans
- Admin-only operations enforced

## Future Enhancements

- Key rotation (generate replacement, mark old as rotated)
- Key expiration (auto-revoke after N days)
- Scoped permissions (read-only keys, write-only keys)
- Key usage analytics dashboard
- Rate limiting per API key
- Webhook signing keys (for event notifications)
