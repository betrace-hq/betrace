# PRD-012a: Tenant Onboarding Service

**Parent PRD:** PRD-012 (Tenant Management System)
**Unit:** A
**Priority:** P0
**Dependencies:** None (foundation unit)

## Scope

Implement the tenant onboarding flow triggered by WorkOS authentication (PRD-001). When a user completes OAuth and no tenant exists, create a tenant record, generate per-tenant cryptographic keys via KMS (PRD-006), initialize a Drools KieSession, and store tenant metadata in TigerBeetle (ADR-011). Emit SOC2 CC6.2 compliance spans for provisioning audit.

## Architecture

```
POST /api/tenants (authenticated with WorkOS JWT)
        ↓
   TenantOnboardingRoute (Camel REST DSL)
        ↓
   CreateTenantProcessor (Named processor)
        ├── Extract userId, email from JWT (PRD-001)
        ├── Generate tenantId (UUID)
        ├── Call KeyGenerationService (PRD-006b) - generate Ed25519 signing key
        ├── Call KeyGenerationService (PRD-006b) - generate AES-256 encryption key
        ├── Initialize DroolsRuleEngine session for tenant
        ├── Create TigerBeetle account (code=9, tenant metadata)
        ├── Record onboarding transfer (code=9, op_type=1)
        └── Emit SOC2 CC6.2 compliance span
        ↓
   Return { tenantId, name, status: "active", createdAt }
```

## TigerBeetle Schema (ADR-011 Compliance)

**Tenant Account (code=9):**
```java
Account tenantAccount = new Account(
    id: UUID (tenant ID),
    code: 9,  // Tenant metadata
    userData128: pack(
        created_at: 64 bits (Unix timestamp ms),
        status: 8 bits (1=active, 2=suspended, 3=deleted),
        tier: 8 bits (1=free, 2=pro, 3=enterprise),
        reserved: 48 bits
    ),
    userData64: adminUserId (first 64 bits of admin UUID),
    ledger: tenantToLedgerId(tenantId)  // Per-tenant ledger isolation
);
```

**Tenant Operation Transfer (code=9):**
```java
Transfer tenantOperation = new Transfer(
    id: UUID (event ID),
    debitAccountId: 0,  // System account
    creditAccountId: tenantAccount,
    amount: 1,  // Operation count
    code: 9,  // Tenant operation
    userData128: pack(
        op_type: 8 bits (1=create, 2=update, 3=suspend, 4=delete),
        name_hash: 120 bits (SHA-256 of tenant name, first 120 bits)
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

## Implementation

### Backend Files

**Route:**
```java
// backend/src/main/java/com/betrace/routes/TenantOnboardingRoute.java
@ApplicationScoped
public class TenantOnboardingRoute extends RouteBuilder {
    @Override
    public void configure() {
        rest("/api/tenants")
            .post()
            .consumes("application/json")
            .produces("application/json")
            .to("direct:createTenant");

        from("direct:createTenant")
            .process("createTenantProcessor")
            .marshal().json();
    }
}
```

**Processor:**
```java
// backend/src/main/java/com/betrace/processors/CreateTenantProcessor.java
@Named("createTenantProcessor")
@ApplicationScoped
public class CreateTenantProcessor implements Processor {

    @Inject
    KeyGenerationService keyGenerationService;

    @Inject
    TenantSessionManager tenantSessionManager;

    @Inject
    TigerBeetleClient tigerBeetleClient;

    @Override
    public void process(Exchange exchange) throws Exception {
        // 1. Extract user info from JWT (set by PRD-001 auth chain)
        String userId = exchange.getProperty("userId", String.class);
        String email = exchange.getProperty("email", String.class);

        // 2. Generate tenant ID
        String tenantId = UUID.randomUUID().toString();

        // 3. Generate cryptographic keys via KMS
        String signingKeyId = keyGenerationService.generateKey(tenantId, KEY_TYPE.SIGNING);
        String encryptionKeyId = keyGenerationService.generateKey(tenantId, KEY_TYPE.ENCRYPTION);

        // 4. Initialize Drools session for tenant
        tenantSessionManager.createSession(tenantId);

        // 5. Create TigerBeetle account
        Account tenantAccount = buildTenantAccount(tenantId, userId);
        tigerBeetleClient.createAccount(tenantAccount);

        // 6. Record onboarding transfer
        Transfer onboardingEvent = buildOnboardingTransfer(tenantId, email);
        tigerBeetleClient.createTransfer(onboardingEvent);

        // 7. Emit SOC2 CC6.2 compliance span
        emitComplianceSpan(tenantId, userId, signingKeyId, encryptionKeyId);

        // 8. Build response
        Map<String, Object> response = Map.of(
            "tenantId", tenantId,
            "name", email + "'s Organization",  // Default name
            "status", "active",
            "createdAt", Instant.now().toString()
        );

        exchange.getMessage().setBody(response);
    }

    private Account buildTenantAccount(String tenantId, String userId) {
        // Pack userData128: created_at (64), status (8), tier (8), reserved (48)
        long createdAt = Instant.now().toEpochMilli();
        byte status = 1;  // active
        byte tier = 1;  // free

        return new Account(
            UUID.fromString(tenantId),
            9,  // code: tenant metadata
            packUserData128(createdAt, status, tier),
            hashUserId(userId),  // userData64
            tenantToLedgerId(tenantId),
            new byte[48]  // reserved
        );
    }

    private Transfer buildOnboardingTransfer(String tenantId, String email) {
        // Pack userData128: op_type (8), name_hash (120)
        byte opType = 1;  // create
        byte[] nameHash = hashTenantName(email + "'s Organization");

        return new Transfer(
            UUID.randomUUID(),
            new UUID(0, 0),  // System account
            UUID.fromString(tenantId),
            1,  // amount
            9,  // code: tenant operation
            packOperationUserData128(opType, nameHash),
            Instant.now().toEpochMilli(),
            tenantToLedgerId(tenantId)
        );
    }

    @SOC2(controls = {CC6_2}, notes = "Tenant provisioning audit")
    private void emitComplianceSpan(String tenantId, String userId, String signingKeyId, String encryptionKeyId) {
        Span span = Span.current();
        span.setAttribute("compliance.framework", "soc2");
        span.setAttribute("compliance.control", "CC6_2");
        span.setAttribute("compliance.evidenceType", "access_provisioning");
        span.setAttribute("tenant.id", tenantId);
        span.setAttribute("admin.userId", userId);
        span.setAttribute("kms.signingKeyId", signingKeyId);
        span.setAttribute("kms.encryptionKeyId", encryptionKeyId);
        span.addEvent("tenant.created");
    }

    // Helper methods: packUserData128, hashUserId, tenantToLedgerId, etc.
}
```

## Success Criteria

**Functional:**
- [ ] POST /api/tenants creates tenant record in TigerBeetle
- [ ] Generates Ed25519 signing key via KMS (PRD-006b)
- [ ] Generates AES-256 encryption key via KMS (PRD-006b)
- [ ] Initializes Drools KieSession for tenant
- [ ] Returns tenant ID, name, status, createdAt
- [ ] Emits SOC2 CC6.2 compliance span

**Performance:**
- [ ] Onboarding completes in <2 seconds (p95)
- [ ] Handles 10 concurrent tenant creations

**Security:**
- [ ] Tenant ID is unpredictable (UUID v4)
- [ ] Per-tenant ledger isolation enforced
- [ ] Admin user ID recorded in tenant account
- [ ] Compliance span includes KMS key IDs

## Testing Requirements

**Unit Tests (90% coverage):**
```java
// backend/src/test/java/com/betrace/processors/CreateTenantProcessorTest.java
@Test
void testCreateTenant_Success() {
    // Mock KeyGenerationService, TenantSessionManager, TigerBeetleClient
    // Verify tenant account created with correct userData128
    // Verify onboarding transfer created
    // Verify Drools session initialized
}

@Test
void testCreateTenant_KmsFailure() {
    // Simulate KMS key generation failure
    // Verify exception thrown, no partial state
}

@Test
void testCreateTenant_TigerBeetleFailure() {
    // Simulate TigerBeetle account creation failure
    // Verify rollback (no Drools session created)
}

@Test
void testTenantAccountPacking() {
    // Verify userData128 bit packing correct
    // Verify status=1, tier=1, timestamp accurate
}
```

**Integration Tests:**
```java
@Test
void testEndToEndTenantOnboarding() {
    // POST /api/tenants with authenticated JWT
    // Verify response contains tenantId
    // Query TigerBeetle for tenant account
    // Verify Drools session exists
    // Verify KMS keys created
}
```

## Files to Create

**Backend:**
- `backend/src/main/java/com/betrace/routes/TenantOnboardingRoute.java`
- `backend/src/main/java/com/betrace/processors/CreateTenantProcessor.java`
- `backend/src/main/java/com/betrace/model/TenantMetadata.java`
- `backend/src/test/java/com/betrace/routes/TenantOnboardingRouteTest.java`
- `backend/src/test/java/com/betrace/processors/CreateTenantProcessorTest.java`

## Files to Modify

**Backend:**
- `backend/src/main/java/com/betrace/services/TenantSessionManager.java` - Add `createSession(tenantId)` method
- `backend/pom.xml` - Add TigerBeetle client dependency (if not present)
- `backend/src/main/resources/application.properties` - Add tenant onboarding config

## Integration Points

**Depends On:**
- **PRD-001:** WorkOS JWT provides userId, email in exchange properties
- **PRD-006b:** KeyGenerationService.generateKey(tenantId, keyType)
- **PRD-002:** TigerBeetle client for account/transfer creation

**Consumed By:**
- **PRD-012b:** Tenant settings CRUD (reads tenant metadata)
- **PRD-012c:** Team member management (requires tenant exists)
- **PRD-012d:** Usage tracking (requires tenant ledger)

## ADR Compliance

- **ADR-011 (TigerBeetle-First):** No SQL tables - tenant metadata in TigerBeetle accounts
- **ADR-012 (Mathematical Tenant Isolation):** Per-tenant ledger ID, KMS keys
- **ADR-013 (Camel-First):** Implemented as Camel route
- **ADR-014 (Named Processors):** All logic in CreateTenantProcessor CDI bean
- **ADR-015 (Workflow Standards):** Conventional commits, 90% test coverage

## Security Considerations

**SOC2 Compliance:**
- **CC6.2 (Access Provisioning):** Compliance span emitted for audit
- **CC6.3 (Data Isolation):** Per-tenant ledger ID enforced

**Threats Mitigated:**
- Tenant ID prediction (UUID v4 unpredictable)
- Cross-tenant key access (per-tenant KMS keys)
- Missing audit trail (TigerBeetle WORM semantics)

**Known Gaps (P0):**
- Compliance spans not cryptographically signed (PRD-003)
- No rollback if KMS succeeds but TigerBeetle fails (need transaction coordinator)
