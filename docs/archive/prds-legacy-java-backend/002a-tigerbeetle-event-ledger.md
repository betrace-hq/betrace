# PRD-002a: TigerBeetle Event Ledger

**Priority:** P0 (Blocks Production)
**Complexity:** Medium
**Personas:** All
**Dependencies:** PRD-001 (Authentication for tenant isolation)
**Implementation Status:** ✅ READY - Well-defined scope, testable independently

## Problem

BeTrace currently has **no persistent storage for signals and rules** - everything is in-memory:
- **Signals:** Lost on restart, no audit trail, no historical analysis
- **Rules:** TenantSessionManager holds rules in ConcurrentHashMap, lost on restart
- **Audit Requirements:** Cannot prove signal history for compliance (SOC2 CC7.2)
- **No Versioning:** Rule changes have no audit trail

**Impact:**
- ❌ All signals lost on service restart
- ❌ No historical signal analysis
- ❌ No rule versioning or rollback capability
- ❌ Cannot prove compliance controls are working
- ❌ Cannot scale horizontally (state in memory)

**Current State:**
- `SignalService.java` - In-memory ArrayList only
- `TenantSessionManager.java` - ConcurrentHashMap<UUID, KieSession>
- No database configuration in `application.properties`

## Solution

### Technology Choice

**TigerBeetle only** - Purpose-built financial accounting database with:
- **Double-entry bookkeeping semantics** (perfect for audit trails)
- **ACID guarantees** at extreme performance (1M+ TPS)
- **Immutable ledger** (WORM - Write Once Read Many)
- **Deterministic** for distributed correctness
- **Built-in idempotency** (no duplicate signals)
- **Zero external dependencies** (single binary)

**Why TigerBeetle for Signals/Rules:**
- Signals are immutable audit events (WORM) - perfect fit
- Need high write throughput (100K+ signals/day)
- Compliance requires tamper-proof audit trail
- Simple data model fits TigerBeetle's account/transfer model
- Metadata stored in TigerBeetle's user_data fields (128-bit + 64-bit + 32-bit)

**Out of Scope for this PRD:**
- ❌ Trace/span storage (see PRD-002b)
- ❌ Cold storage archival (see PRD-002c/d)
- ❌ Complex query analytics (use TigerBeetle for writes, export for analytics)

### Data Model

**Two Entity Types:**
1. **Rules** (read/write) - BeTrace DSL rules with versioning
2. **Signals** (WORM) - Immutable signal events

**Storage Mapping:**
- **TigerBeetle Accounts** → Rules (with metadata in user_data fields)
- **TigerBeetle Transfers** → Signals (immutable ledger entries)

### TigerBeetle Schema Design

#### Account Schema (Rules)

```java
// TigerBeetle Account = Rule
public record TBAccount(
    UInt128 id,              // Rule UUID as UInt128
    UInt128 userData128,     // Tenant UUID (rule owner)
    long userData64,         // Flags: bit 0=enabled, bit 1=deleted
    int userData32,          // Severity (packed: high, medium, low, info)
    int reserved,
    int ledger,              // Tenant ledger ID (for isolation)
    int code,                // Entity type: 2=rule
    int flags,               // AccountFlags
    long debitsPosted,       // Signal count (incremented by transfers)
    long creditsPosted,      // Unused
    long debitsPending,      // Unused
    long creditsPending,     // Unused
    long timestamp           // Created timestamp (nanoseconds)
) {}
```

**Rule Account Example:**
```java
TBAccount rule = new TBAccount(
    id: ruleUUID,
    userData128: tenantUUID,        // Parent tenant
    userData64: 0x01,               // Enabled flag (bit 0 set)
    userData32: severity << 16,     // Severity in high 16 bits
    code: 2,                        // Rule type
    ledger: tenantLedgerId(tenantId), // Tenant's ledger
    debitsPosted: 0,                // Signal count (incremented by transfers)
    timestamp: now()
);
```

**Rule Metadata Storage Strategy:**
- **In TigerBeetle:** Rule ID, tenant ID, enabled status, severity, signal count
- **On Filesystem:** Rule expression (BeTrace DSL) + compiled DRL
  - Path: `./data-rules/{tenant-id}/{rule-id}.json`
  - Content: `{"expression": "...", "drl": "...", "name": "...", "description": "..."}`
- **In Drools Memory:** Compiled KieSession (hot cache, reloaded from filesystem on startup)

#### Transfer Schema (Signals)

```java
// TigerBeetle Transfer = Signal (immutable WORM)
public record TBTransfer(
    UInt128 id,              // Signal UUID
    UInt128 debitAccountId,  // Rule ID (which rule fired)
    UInt128 creditAccountId, // Tenant ID (which tenant)
    long amount,             // Always 1 (for counting)
    UInt128 userData128,     // Trace ID as UInt128
    long userData64,         // Packed: severity (4 bits) + status (4 bits) + flags (56 bits)
    int userData32,          // Span ID hash
    int timeout,             // Unused
    int ledger,              // Tenant ledger
    int code,                // Signal type (3)
    int flags,               // TransferFlags.linked for batching
    long timestamp           // Signal occurred timestamp (nanoseconds)
) {}
```

**Signal Transfer Example:**
```java
TBTransfer signal = new TBTransfer(
    id: signalUUID,
    debitAccountId: ruleUUID,           // Which rule fired
    creditAccountId: tenantUUID,        // Which tenant (for isolation)
    amount: 1,                          // Increment rule's debitsPosted counter
    userData128: traceIdAsUInt128,      // Full trace ID
    userData64: packSignalMetadata(severity, status), // Packed metadata
    userData32: spanIdHash,             // Span ID reference
    code: 3,                            // Signal type
    ledger: tenantLedgerId(tenantId),   // Tenant isolation
    timestamp: occurredAt()
);
```

### Tenant Isolation via Ledgers

**Ledger ID Assignment:**
```java
private int tenantToLedgerId(UUID tenantId) {
    // Use first 31 bits of tenant UUID as ledger ID (positive int)
    // TigerBeetle enforces: transfers cannot cross ledger boundaries
    ByteBuffer bb = ByteBuffer.wrap(tenantId.toString().getBytes());
    return Math.abs(bb.getInt()) & 0x7FFFFFFF; // Ensure positive
}
```

**Collision Detection:**
- On tenant creation, attempt to create TigerBeetle account with ledger ID
- If collision (extremely rare: 1 in 2 billion), retry with UUID v7 (timestamp-ordered)
- Store ledger ID mapping in tenant metadata for fast lookup

**Guarantees:**
- Signals for tenant A cannot be credited to tenant B (different ledgers)
- Rule accounts for tenant A cannot debit signals to tenant B
- TigerBeetle enforces at database level (not application logic)

### Backend Implementation

#### 1. TigerBeetle Service

**`com/betrace/services/TigerBeetleService.java`:**
```java
@ApplicationScoped
public class TigerBeetleService {

    private final Client client;

    // Cache for hot data (loaded at startup)
    private final Map<UUID, Rule> ruleCache = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> tenantLedgerMap = new ConcurrentHashMap<>();

    public TigerBeetleService(
        @ConfigProperty(name = "tigerbeetle.cluster-id") int clusterId,
        @ConfigProperty(name = "tigerbeetle.addresses") String addresses
    ) {
        this.client = new Client(
            UInt128.asBytes(clusterId),
            addresses.split(",")
        );
    }

    @PostConstruct
    public void initialize() {
        // Load all rules into cache at startup
        loadRulesIntoCache();
        loadTenantLedgerMappings();
    }

    /**
     * Create a new rule (persists to TigerBeetle + filesystem).
     */
    public void createRule(UUID ruleId, UUID tenantId, String expression, String drl,
                          Severity severity, boolean enabled) {
        // 1. Persist to TigerBeetle
        AccountBatch accounts = new AccountBatch(1);
        accounts.add();
        accounts.setId(toUInt128(ruleId));
        accounts.setUserData128(toUInt128(tenantId));
        accounts.setUserData64(enabled ? 0x01 : 0);
        accounts.setUserData32(severity.ordinal() << 16);
        accounts.setCode(2); // Rule type
        accounts.setLedger(tenantToLedgerId(tenantId));

        CreateAccountsResult result = client.createAccounts(accounts);
        if (result.getLength() > 0) {
            throw new TigerBeetleException("Failed to create rule", result);
        }

        // 2. Persist expression to filesystem
        writeRuleToFile(tenantId, ruleId, expression, drl);

        // 3. Cache it
        Rule rule = new Rule(ruleId, tenantId, expression, drl, severity, enabled);
        ruleCache.put(ruleId, rule);
    }

    /**
     * Create a signal (immutable WORM).
     */
    public UUID createSignal(UUID tenantId, UUID ruleId, String traceId,
                            Severity severity, SignalStatus status) {
        UUID signalId = UUID.randomUUID();

        TransferBatch transfers = new TransferBatch(1);
        transfers.add();
        transfers.setId(toUInt128(signalId));
        transfers.setDebitAccountId(toUInt128(ruleId));
        transfers.setCreditAccountId(toUInt128(tenantId)); // Credit to tenant (for counting)
        transfers.setAmount(1); // Increment rule's debitsPosted
        transfers.setUserData128(traceIdToUInt128(traceId));
        transfers.setUserData64(packSignalData(severity, status));
        transfers.setCode(3); // Signal type
        transfers.setLedger(tenantToLedgerId(tenantId));

        CreateTransfersResult result = client.createTransfers(transfers);
        if (result.getLength() > 0) {
            throw new TigerBeetleException("Failed to create signal", result);
        }

        return signalId;
    }

    /**
     * Get signals for a tenant (queries TigerBeetle transfers).
     */
    public List<Signal> getSignalsByTenant(UUID tenantId, int limit) {
        // Query transfers where creditAccountId = tenantId
        AccountFilter filter = new AccountFilter();
        filter.setAccountId(toUInt128(tenantId));
        filter.setTimestampMin(0);
        filter.setTimestampMax(Long.MAX_VALUE);
        filter.setLimit(limit);
        filter.setFlags(AccountFilterFlags.CREDITS); // Signals are credits to tenant

        TransferBatch transfers = client.getAccountTransfers(filter);

        List<Signal> signals = new ArrayList<>();
        for (int i = 0; i < transfers.getLength(); i++) {
            signals.add(transferToSignal(transfers.getTransfer(i)));
        }

        return signals;
    }

    /**
     * Get signal count for a rule (read rule account's debitsPosted).
     */
    public long getRuleSignalCount(UUID ruleId) {
        AccountBatch accounts = new AccountBatch(1);
        accounts.add();
        accounts.setId(toUInt128(ruleId));

        AccountBatch result = client.lookupAccounts(accounts);
        if (result.getLength() == 0) {
            throw new NotFoundException("Rule not found: " + ruleId);
        }

        return result.getAccount(0).getDebitsPosted();
    }

    /**
     * Get rule by ID (from cache or filesystem).
     */
    public Rule getRuleById(UUID ruleId) {
        Rule cached = ruleCache.get(ruleId);
        if (cached != null) return cached;

        return loadRuleFromFile(ruleId);
    }

    /**
     * Get all rules for a tenant (filter cache).
     */
    public List<Rule> getRulesByTenant(UUID tenantId) {
        return ruleCache.values().stream()
            .filter(r -> r.getTenantId().equals(tenantId))
            .collect(Collectors.toList());
    }

    // Helper methods

    private void loadRulesIntoCache() {
        // Query all accounts with code=2 (rules)
        AccountFilter filter = new AccountFilter();
        filter.setCode(2);

        AccountBatch rules = client.queryAccounts(filter);

        for (int i = 0; i < rules.getLength(); i++) {
            Account account = rules.getAccount(i);
            UUID ruleId = fromUInt128(account.getId());
            UUID tenantId = fromUInt128(account.getUserData128());

            RuleMetadata metadata = loadRuleMetadata(ruleId);

            boolean enabled = (account.getUserData64() & 0x01) != 0;
            int severityOrdinal = account.getUserData32() >> 16;
            Severity severity = Severity.values()[severityOrdinal];

            Rule rule = new Rule(ruleId, tenantId, metadata.expression(),
                                metadata.drl(), severity, enabled);

            ruleCache.put(ruleId, rule);
        }
    }

    private void writeRuleToFile(UUID tenantId, UUID ruleId, String expression, String drl) {
        Path ruleDir = Path.of("./data-rules", tenantId.toString());
        Files.createDirectories(ruleDir);

        Path ruleFile = ruleDir.resolve(ruleId + ".json");
        String json = new ObjectMapper().writeValueAsString(
            new RuleMetadata(expression, drl)
        );
        Files.writeString(ruleFile, json);
    }

    private RuleMetadata loadRuleMetadata(UUID ruleId) {
        // Search all tenant directories for this rule
        Path rulesBase = Path.of("./data-rules");
        try (Stream<Path> paths = Files.walk(rulesBase, 2)) {
            Optional<Path> ruleFile = paths
                .filter(p -> p.getFileName().toString().equals(ruleId + ".json"))
                .findFirst();

            if (ruleFile.isPresent()) {
                String json = Files.readString(ruleFile.get());
                return new ObjectMapper().readValue(json, RuleMetadata.class);
            }
        }

        throw new NotFoundException("Rule metadata not found: " + ruleId);
    }

    private int tenantToLedgerId(UUID tenantId) {
        return tenantLedgerMap.computeIfAbsent(tenantId, id -> {
            ByteBuffer bb = ByteBuffer.wrap(id.toString().getBytes());
            return Math.abs(bb.getInt()) & 0x7FFFFFFF;
        });
    }

    private UInt128 toUInt128(UUID uuid) {
        ByteBuffer bb = ByteBuffer.wrap(new byte[16]);
        bb.putLong(uuid.getMostSignificantBits());
        bb.putLong(uuid.getLeastSignificantBits());
        return UInt128.asBytes(bb.array());
    }

    private UUID fromUInt128(UInt128 uint128) {
        byte[] bytes = UInt128.asBytes(uint128);
        ByteBuffer bb = ByteBuffer.wrap(bytes);
        return new UUID(bb.getLong(), bb.getLong());
    }

    private UInt128 traceIdToUInt128(String traceId) {
        byte[] bytes = new byte[16];
        for (int i = 0; i < 16; i++) {
            bytes[i] = (byte) Integer.parseInt(traceId.substring(i * 2, i * 2 + 2), 16);
        }
        return UInt128.asBytes(bytes);
    }

    private long packSignalData(Severity severity, SignalStatus status) {
        return ((long) severity.ordinal() << 60) | ((long) status.ordinal() << 56);
    }

    private Signal transferToSignal(Transfer transfer) {
        UUID signalId = fromUInt128(transfer.getId());
        UUID ruleId = fromUInt128(transfer.getDebitAccountId());
        UUID tenantId = fromUInt128(transfer.getCreditAccountId());
        String traceId = uint128ToTraceId(transfer.getUserData128());

        long packed = transfer.getUserData64();
        Severity severity = Severity.values()[(int) ((packed >> 60) & 0x0F)];
        SignalStatus status = SignalStatus.values()[(int) ((packed >> 56) & 0x0F)];

        return new Signal(
            signalId, tenantId, ruleId, traceId, severity, status,
            Instant.ofEpochMilli(transfer.getTimestamp() / 1_000_000)
        );
    }

    record RuleMetadata(String expression, String drl) {}
}
```

#### 2. Repository Pattern (Abstraction)

**`com/betrace/repository/RuleRepository.java`:**
```java
@ApplicationScoped
public class RuleRepository {

    @Inject
    TigerBeetleService tb;

    public void create(Rule rule) {
        tb.createRule(
            rule.getId(),
            rule.getTenantId(),
            rule.getExpression(),
            rule.getCompiledDrl(),
            rule.getSeverity(),
            rule.isEnabled()
        );
    }

    public Rule findById(UUID id) {
        return tb.getRuleById(id);
    }

    public List<Rule> findByTenant(UUID tenantId) {
        return tb.getRulesByTenant(tenantId);
    }

    public long getSignalCount(UUID ruleId) {
        return tb.getRuleSignalCount(ruleId);
    }
}
```

**`com/betrace/repository/SignalRepository.java`:**
```java
@ApplicationScoped
public class SignalRepository {

    @Inject
    TigerBeetleService tb;

    public UUID create(Signal signal) {
        return tb.createSignal(
            signal.getTenantId(),
            signal.getRuleId(),
            signal.getTraceId(),
            signal.getSeverity(),
            signal.getStatus()
        );
    }

    public List<Signal> findByTenant(UUID tenantId, int limit) {
        return tb.getSignalsByTenant(tenantId, limit);
    }
}
```

#### 3. Configuration

**`application.properties`:**
```properties
# TigerBeetle
tigerbeetle.cluster-id=0
tigerbeetle.addresses=127.0.0.1:3000

# Local filesystem for rule metadata
betrace.rules.storage-path=./data-rules
```

**`pom.xml`:**
```xml
<dependency>
  <groupId>com.tigerbeetle</groupId>
  <artifactId>tigerbeetle-java</artifactId>
  <version>0.15.3</version>
</dependency>
```

### Development Setup

**`flake.nix` additions:**
```nix
process-compose.yaml = {
  processes = {
    tigerbeetle = {
      command = "${pkgs.tigerbeetle}/bin/tigerbeetle start --addresses=127.0.0.1:3000 ./data-tigerbeetle/cluster_0_replica_0.tigerbeetle";
      availability.restart = "on_failure";
      readiness_probe = {
        exec.command = "${pkgs.netcat}/bin/nc -z 127.0.0.1 3000";
        initial_delay_seconds = 2;
        period_seconds = 5;
      };
    };
  };
};
```

**Initialize TigerBeetle (shellHook):**
```bash
mkdir -p data-tigerbeetle data-rules
if [ ! -f data-tigerbeetle/cluster_0_replica_0.tigerbeetle ]; then
  tigerbeetle format --cluster=0 --replica=0 --replica-count=1 \
    ./data-tigerbeetle/cluster_0_replica_0.tigerbeetle
fi
```

## Success Criteria

**TigerBeetle Core:**
- [ ] TigerBeetle runs in local dev environment
- [ ] Rules persist in TigerBeetle accounts + filesystem
- [ ] Signals immutable (WORM) in TigerBeetle transfers
- [ ] Rule signal counts accurate (TigerBeetle debitsPosted)
- [ ] Multi-tenant isolation (ledger partitioning)
- [ ] High throughput (10K+ signals/sec)
- [ ] Rules cached at startup for fast lookups

**Tenant Isolation:**
- [ ] Ledger ID collision detection works
- [ ] Signals cannot cross tenant boundaries
- [ ] Query by tenant only returns that tenant's signals

**Testing:**
- [ ] Repository unit tests (TigerBeetle operations)
- [ ] Idempotency tests (duplicate signal rejection)
- [ ] Integration tests (end-to-end signal flow)
- [ ] Property-based tenant isolation tests
- [ ] Performance tests (100K signal writes)

## Testing Requirements

**Unit Tests:**
```java
@Test
@DisplayName("Should create rule in TigerBeetle")
void testCreateRule() {
    UUID ruleId = UUID.randomUUID();
    UUID tenantId = UUID.randomUUID();

    ruleRepo.create(new Rule(
        ruleId, tenantId, "trace.has(error)", "...", Severity.HIGH, true
    ));

    Rule retrieved = ruleRepo.findById(ruleId);
    assertEquals(ruleId, retrieved.getId());
    assertEquals(tenantId, retrieved.getTenantId());
}

@Test
@DisplayName("Should create signal and increment rule counter")
void testCreateSignal() {
    UUID ruleId = createTestRule();
    UUID tenantId = getTenantForRule(ruleId);

    UUID signalId = signalRepo.create(new Signal(
        null, tenantId, ruleId, "trace-123", Severity.HIGH, SignalStatus.NEW
    ));

    assertNotNull(signalId);
    assertEquals(1, ruleRepo.getSignalCount(ruleId));
}

@Test
@DisplayName("Should reject duplicate signal ID")
void testSignalIdempotency() {
    UUID signalId = UUID.randomUUID();

    // First creation succeeds
    createSignalWithId(signalId);

    // Duplicate should fail
    assertThrows(TigerBeetleException.class, () -> {
        createSignalWithId(signalId);
    });
}
```

**Property-Based Tests:**
```java
@Property
void tenantIsolationInvariant(
    @ForAll UUID tenantA,
    @ForAll UUID tenantB,
    @ForAll List<Signal> signalsA,
    @ForAll List<Signal> signalsB
) {
    signalsA.forEach(s -> signalRepo.create(s.withTenantId(tenantA)));
    signalsB.forEach(s -> signalRepo.create(s.withTenantId(tenantB)));

    List<Signal> retrievedA = signalRepo.findByTenant(tenantA, 1000);

    assertThat(retrievedA)
        .allMatch(s -> s.getTenantId().equals(tenantA))
        .noneMatch(s -> s.getTenantId().equals(tenantB));
}
```

**Performance Tests:**
```java
@Test
@DisplayName("Should sustain 10K signals/sec")
void testSignalThroughput() {
    UUID ruleId = createTestRule();
    UUID tenantId = getTenantForRule(ruleId);

    int count = 100_000;
    Instant start = Instant.now();

    for (int i = 0; i < count; i++) {
        signalRepo.create(new Signal(
            null, tenantId, ruleId, "trace-" + i, Severity.MEDIUM, SignalStatus.NEW
        ));
    }

    Duration elapsed = Duration.between(start, Instant.now());
    double signalsPerSec = count / elapsed.toSeconds();

    assertThat(signalsPerSec).isGreaterThan(10_000);
}
```

## Minimum Test Coverage Targets

- **Overall Instruction Coverage:** 90%
- **Overall Branch Coverage:** 80%
- **Critical Services:** 95% instruction coverage
  - `TigerBeetleService`
  - `RuleRepository`
  - `SignalRepository`

## Files to Create

**Backend Services:**
- `backend/src/main/java/com/betrace/services/TigerBeetleService.java`
- `backend/src/main/java/com/betrace/repository/RuleRepository.java`
- `backend/src/main/java/com/betrace/repository/SignalRepository.java`

**Models:**
- `backend/src/main/java/com/betrace/model/Rule.java`
- `backend/src/main/java/com/betrace/model/Signal.java`
- `backend/src/main/java/com/betrace/model/Severity.java`
- `backend/src/main/java/com/betrace/model/SignalStatus.java`

**Tests:**
- `backend/src/test/java/com/betrace/services/TigerBeetleServiceTest.java`
- `backend/src/test/java/com/betrace/repository/RuleRepositoryTest.java`
- `backend/src/test/java/com/betrace/repository/SignalRepositoryTest.java`
- `backend/src/test/java/com/betrace/repository/TenantIsolationPropertyTest.java`
- `backend/src/test/java/com/betrace/repository/SignalThroughputTest.java`

**Dev Environment:**
- Update `flake.nix` with TigerBeetle process

## Files to Modify

**Backend:**
- `backend/pom.xml` - Add TigerBeetle dependency
- `backend/src/main/resources/application.properties` - Add TigerBeetle config

## Implementation Notes

**TigerBeetle-Only Advantages:**
- **Zero dependencies** - Single binary, no external services
- **Immutability** - Signals cannot be modified (audit integrity)
- **Performance** - 1M+ TPS sustained throughput
- **Deterministic** - Consistent across distributed deployments

**Metadata Strategy:**
- **TigerBeetle** - Core immutable data + packed metadata (128+64+32 bits)
- **In-memory cache** - Rules loaded at startup for fast access
- **Local filesystem** - Rule expressions (BeTrace DSL + DRL)

**Query Limitations:**
- TigerBeetle optimized for writes, not complex queries
- Simple queries: iterate transfers, use account counters
- Complex analytics: Export to DuckDB (future PRD)

**Tenant Isolation:**
- Each tenant gets unique ledger ID (hash of tenant UUID)
- TigerBeetle enforces ledger boundaries
- Cannot create transfers across ledgers

**Cache Strategy:**
- Load all rules into memory at startup
- Acceptable: thousands of rules, not millions
- Drools already caches compiled rules
- Signals not cached (query on demand)

## Related ADRs

- **[ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)** - TigerBeetle as library, deployment-agnostic
- **[ADR-012: Mathematical Tenant Isolation](../adrs/012-mathematical-tenant-isolation-architecture.md)** - Ledger-based isolation
- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - Future: wrap in Camel routes
- **[ADR-014: Camel Testing Standards](../adrs/014-camel-testing-and-organization-standards.md)** - 90% coverage

## Dependencies

**Requires:**
- PRD-001: Authentication (for tenant ID in signals)

**Blocks:**
- PRD-002b: Hot Trace Storage (signals trigger from trace rules)
- All signal/rule management features

## Future Enhancements

- **TigerBeetle Clustering:** Multi-node replication for HA
- **Rule Versioning:** Track rule changes as separate accounts
- **Signal Status Updates:** Create linked transfers for status changes
- **DuckDB Export:** Periodic export for complex analytics
