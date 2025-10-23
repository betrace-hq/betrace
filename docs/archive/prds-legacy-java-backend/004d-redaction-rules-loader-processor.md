# PRD-004d: Redaction Rules Loader Processor

**Priority:** P0
**Complexity:** Medium
**Unit:** `LoadRedactionRulesProcessor.java`
**Dependencies:** PRD-002 (TigerBeetle), PRD-004c (DetectPIIProcessor)

## Problem

After detecting PII, the pipeline needs to load per-tenant redaction rules from TigerBeetle to determine which strategy to apply for each PII type. Rules are stored in tenant account metadata for WORM compliance.

## Architecture Integration

**ADR Compliance:**
- **ADR-011:** TigerBeetle as single source of truth - no SQL tables
- **ADR-012:** Tenant-isolated redaction rules in tenant account userData128
- **ADR-013:** Camel-first architecture - rules loading as named processor
- **ADR-014:** Named processor with 90% test coverage

**TigerBeetle Schema:**
Redaction rules stored in tenant account `userData128` field (128 bits = 21 rules max):
- Each rule = 6 bits: 3 bits for PIIType (0-7), 3 bits for RedactionStrategy (0-4)
- Example: EMAIL→HASH encoded as 000 (EMAIL) + 000 (HASH) = 0b000000

## Implementation

```java
package com.betrace.processors.redaction;

import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import com.betrace.model.PIIType;
import com.betrace.model.RedactionStrategy;
import com.betrace.tigerbeetle.TigerBeetleService;

/**
 * Camel processor that loads redaction rules from TigerBeetle.
 *
 * INPUT (Exchange Headers):
 *   - "tenantId" (UUID) - Tenant identifier
 *   - "hasPII" (Boolean) - Whether PII was detected
 *
 * OUTPUT (Exchange Headers):
 *   - "redactionRules" (Map<PIIType, RedactionStrategy>) - Rules to apply
 *
 * Per ADR-014: Named processor, stateless, 90% test coverage required.
 */
@Named("loadRedactionRulesProcessor")
@ApplicationScoped
public class LoadRedactionRulesProcessor implements Processor {

    @Inject
    TigerBeetleService tb;

    // In-memory cache for tenant redaction rules (performance optimization)
    private final Map<UUID, Map<PIIType, RedactionStrategy>> rulesCache =
        new ConcurrentHashMap<>();

    @Override
    public void process(Exchange exchange) throws Exception {
        // Skip if no PII detected
        Boolean hasPII = exchange.getIn().getHeader("hasPII", Boolean.class);
        if (hasPII == null || !hasPII) {
            Log.debug("No PII detected, skipping redaction rules loading");
            return;
        }

        // Get tenant ID from exchange
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        if (tenantId == null) {
            Log.error("No tenantId in exchange, cannot load redaction rules");
            throw new IllegalStateException("Missing tenantId header");
        }

        // Load rules (from cache or TigerBeetle)
        Map<PIIType, RedactionStrategy> rules = loadRules(tenantId);

        // Set rules in exchange header for downstream processors
        exchange.getIn().setHeader("redactionRules", rules);

        Log.debugf("Loaded %d redaction rules for tenant %s", rules.size(), tenantId);
    }

    /**
     * Load redaction rules for tenant (with caching).
     */
    private Map<PIIType, RedactionStrategy> loadRules(UUID tenantId) {
        // Check cache first
        Map<PIIType, RedactionStrategy> cached = rulesCache.get(tenantId);
        if (cached != null) {
            return cached;
        }

        // Load from TigerBeetle
        Map<PIIType, RedactionStrategy> rules = tb.getRedactionRules(tenantId);

        // If no tenant-specific rules, use defaults
        if (rules.isEmpty()) {
            Log.infof("No custom redaction rules for tenant %s, using defaults", tenantId);
            rules = getDefaultRedactionRules();
        }

        // Cache for future requests
        rulesCache.put(tenantId, rules);

        return rules;
    }

    /**
     * Default redaction rules applied when tenant has no custom rules.
     *
     * Based on industry best practices:
     * - EMAIL: HASH (allows correlation without revealing)
     * - SSN: REMOVE (too sensitive to keep in any form)
     * - CREDIT_CARD: TOKENIZE (enables refund/transaction lookups)
     * - PHONE: MASK (shows country code for support)
     * - NAME: MASK (shows first letter for UX context)
     * - ADDRESS: REMOVE (too sensitive, no business need)
     */
    private Map<PIIType, RedactionStrategy> getDefaultRedactionRules() {
        return Map.of(
            PIIType.EMAIL, RedactionStrategy.HASH,
            PIIType.SSN, RedactionStrategy.REMOVE,
            PIIType.CREDIT_CARD, RedactionStrategy.TOKENIZE,
            PIIType.PHONE, RedactionStrategy.MASK,
            PIIType.NAME, RedactionStrategy.MASK,
            PIIType.ADDRESS, RedactionStrategy.REMOVE
        );
    }

    /**
     * Clear cache (useful for testing or when rules are updated).
     */
    public void clearCache() {
        rulesCache.clear();
        Log.info("Redaction rules cache cleared");
    }

    /**
     * Invalidate cache for specific tenant.
     */
    public void invalidateTenant(UUID tenantId) {
        rulesCache.remove(tenantId);
        Log.infof("Redaction rules cache invalidated for tenant %s", tenantId);
    }
}
```

**TigerBeetle Integration (Extend TigerBeetleService):**

```java
/**
 * Get redaction rules from tenant account userData128.
 * Each rule = 6 bits: 3 for PIIType + 3 for RedactionStrategy.
 */
public Map<PIIType, RedactionStrategy> getRedactionRules(UUID tenantId) {
    AccountBatch accounts = new AccountBatch(1);
    accounts.add();
    accounts.setId(toUInt128(tenantId));

    AccountBatch result = client.lookupAccounts(accounts);
    if (result.getLength() == 0) {
        return Map.of(); // No tenant rules, use defaults
    }

    long rulesData = result.getUserData128().asLong();
    return unpackRedactionRules(rulesData);
}

private Map<PIIType, RedactionStrategy> unpackRedactionRules(long packed) {
    Map<PIIType, RedactionStrategy> rules = new HashMap<>();
    for (int offset = 0; offset < 128; offset += 6) {
        int typeOrdinal = (int) ((packed >> offset) & 0b111);
        int strategyOrdinal = (int) ((packed >> (offset + 3)) & 0b111);

        if (typeOrdinal >= PIIType.values().length) break;

        rules.put(PIIType.values()[typeOrdinal],
                  RedactionStrategy.values()[strategyOrdinal]);
    }
    return rules;
}
```

## Testing Requirements (QA - 90% Coverage)

**Unit Tests:**
- `testLoadTenantRules()` - Loads custom rules from TigerBeetle
- `testDefaultRulesFallback()` - Uses defaults when no tenant rules exist
- `testSkipIfNoPII()` - Skips processing when hasPII=false
- `testRulesCached()` - Second load uses cache, no TigerBeetle call
- `testMissingTenantId()` - Throws exception when tenantId header missing
- `testDefaultRulesContent()` - Verifies all 6 default rules present

## Security Considerations (Security Expert)

**Threat Model:**
- **Rule Tampering (TigerBeetle):** Attacker modifies redaction rules
  - Mitigation: TigerBeetle WORM prevents modification, only append
- **Missing Default Rules:** No fallback causes PII leakage
  - Mitigation: Hardcoded defaults always available
- **Cache Poisoning:** Attacker forces wrong rules into cache
  - Mitigation: Cache only populated from trusted TigerBeetle source
- **Unauthorized Rule Changes:** Non-admin changes tenant rules
  - Mitigation: setRedactionRules() requires admin role (API gateway)

## Success Criteria

- [ ] Load tenant redaction rules from TigerBeetle userData128
- [ ] Apply default rules if no tenant rules exist
- [ ] Skip processing if hasPII=false (performance)
- [ ] Cache rules in memory per tenant
- [ ] Set "redactionRules" header for downstream processors
- [ ] Support cache invalidation for rule updates
- [ ] Handle missing tenantId gracefully
- [ ] 90% test coverage (ADR-014)

## Files to Create

- `backend/src/main/java/com/betrace/processors/redaction/LoadRedactionRulesProcessor.java`
- `backend/src/test/java/com/betrace/processors/redaction/LoadRedactionRulesProcessorTest.java`

## Files to Modify

- `backend/src/main/java/com/betrace/tigerbeetle/TigerBeetleService.java` - Add redaction rule methods

## Dependencies

**Requires:**
- PRD-002 (TigerBeetle persistence for rules storage)
- PRD-004c (DetectPIIProcessor sets "hasPII" header)

**Blocks:** Redaction application processor (needs rules to apply redaction)
