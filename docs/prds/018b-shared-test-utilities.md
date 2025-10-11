# PRD-018b: Shared Test Utilities

**Priority:** P1 (Infrastructure - Test Foundation)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-018 (Comprehensive Test Suite)
**Dependencies:** PRD-018a (TestFixtureGenerator)

## Problem

Test code duplicates assertion logic, mock setup, and common test helpers. No standardized assertions for FLUO domain models. No shared matchers for complex validation (compliance spans, TigerBeetle transfers, signed data).

## Solution

Implement shared test utilities including custom AssertJ assertions, mock builders, test helpers, and domain-specific matchers. Provide fluent API for readable test code.

## Unit Description

**File:** `backend/src/test/java/com/fluo/test/utils/`
**Type:** Test Utility Classes
**Purpose:** Shared test helpers, assertions, and matchers

## Implementation

```java
// ============ CUSTOM ASSERTIONS ============

package com.fluo.test.utils;

import com.fluo.model.*;
import org.assertj.core.api.AbstractAssert;

import java.util.Map;
import java.util.UUID;

/**
 * Custom AssertJ assertions for Signal domain model
 */
public class SignalAssert extends AbstractAssert<SignalAssert, Signal> {

    public SignalAssert(Signal actual) {
        super(actual, SignalAssert.class);
    }

    public static SignalAssert assertThat(Signal actual) {
        return new SignalAssert(actual);
    }

    public SignalAssert hasId(UUID expectedId) {
        isNotNull();
        if (!actual.getId().equals(expectedId)) {
            failWithMessage("Expected signal ID to be <%s> but was <%s>", expectedId, actual.getId());
        }
        return this;
    }

    public SignalAssert hasSeverity(String expectedSeverity) {
        isNotNull();
        if (!actual.getSeverity().equals(expectedSeverity)) {
            failWithMessage("Expected signal severity to be <%s> but was <%s>",
                expectedSeverity, actual.getSeverity());
        }
        return this;
    }

    public SignalAssert hasStatus(String expectedStatus) {
        isNotNull();
        if (!actual.getStatus().equals(expectedStatus)) {
            failWithMessage("Expected signal status to be <%s> but was <%s>",
                expectedStatus, actual.getStatus());
        }
        return this;
    }

    public SignalAssert belongsToTenant(UUID expectedTenantId) {
        isNotNull();
        if (!actual.getTenantId().equals(expectedTenantId)) {
            failWithMessage("Expected signal to belong to tenant <%s> but was <%s>",
                expectedTenantId, actual.getTenantId());
        }
        return this;
    }

    public SignalAssert hasTraceId(String expectedTraceId) {
        isNotNull();
        if (!actual.getTraceId().equals(expectedTraceId)) {
            failWithMessage("Expected signal trace ID to be <%s> but was <%s>",
                expectedTraceId, actual.getTraceId());
        }
        return this;
    }

    public SignalAssert hasMatchedSpanCount(int expectedCount) {
        isNotNull();
        if (actual.getMatchedSpanCount() != expectedCount) {
            failWithMessage("Expected signal to have <%d> matched spans but had <%d>",
                expectedCount, actual.getMatchedSpanCount());
        }
        return this;
    }
}

/**
 * Custom AssertJ assertions for Span domain model
 */
public class SpanAssert extends AbstractAssert<SpanAssert, Span> {

    public SpanAssert(Span actual) {
        super(actual, SpanAssert.class);
    }

    public static SpanAssert assertThat(Span actual) {
        return new SpanAssert(actual);
    }

    public SpanAssert hasAttribute(String key, Object value) {
        isNotNull();
        if (!actual.getAttributes().containsKey(key)) {
            failWithMessage("Expected span to have attribute <%s> but it was missing", key);
        }
        if (!actual.getAttributes().get(key).equals(value)) {
            failWithMessage("Expected span attribute <%s> to be <%s> but was <%s>",
                key, value, actual.getAttributes().get(key));
        }
        return this;
    }

    public SpanAssert hasAttributeKey(String key) {
        isNotNull();
        if (!actual.getAttributes().containsKey(key)) {
            failWithMessage("Expected span to have attribute <%s> but it was missing", key);
        }
        return this;
    }

    public SpanAssert isComplianceSpan() {
        isNotNull();
        if (!actual.getAttributes().containsKey("compliance.framework")) {
            failWithMessage("Expected span to be a compliance span but missing compliance.framework attribute");
        }
        return this;
    }

    public SpanAssert hasComplianceStatus(String expectedStatus) {
        isComplianceSpan();
        String actualStatus = (String) actual.getAttributes().get("compliance.status");
        if (!expectedStatus.equals(actualStatus)) {
            failWithMessage("Expected compliance status to be <%s> but was <%s>",
                expectedStatus, actualStatus);
        }
        return this;
    }

    public SpanAssert hasServiceName(String expectedServiceName) {
        isNotNull();
        if (!actual.getServiceName().equals(expectedServiceName)) {
            failWithMessage("Expected span service name to be <%s> but was <%s>",
                expectedServiceName, actual.getServiceName());
        }
        return this;
    }
}

/**
 * Custom AssertJ assertions for Rule domain model
 */
public class RuleAssert extends AbstractAssert<RuleAssert, Rule> {

    public RuleAssert(Rule actual) {
        super(actual, RuleAssert.class);
    }

    public static RuleAssert assertThat(Rule actual) {
        return new RuleAssert(actual);
    }

    public RuleAssert hasName(String expectedName) {
        isNotNull();
        if (!actual.getName().equals(expectedName)) {
            failWithMessage("Expected rule name to be <%s> but was <%s>", expectedName, actual.getName());
        }
        return this;
    }

    public RuleAssert hasCategory(String expectedCategory) {
        isNotNull();
        if (!actual.getCategory().equals(expectedCategory)) {
            failWithMessage("Expected rule category to be <%s> but was <%s>",
                expectedCategory, actual.getCategory());
        }
        return this;
    }

    public RuleAssert isEnabled() {
        isNotNull();
        if (!actual.isEnabled()) {
            failWithMessage("Expected rule to be enabled but it was disabled");
        }
        return this;
    }

    public RuleAssert isDisabled() {
        isNotNull();
        if (actual.isEnabled()) {
            failWithMessage("Expected rule to be disabled but it was enabled");
        }
        return this;
    }
}

// ============ TIGERBEETLE TEST HELPERS ============

package com.fluo.test.utils;

import com.tigerbeetle.Transfer;
import com.tigerbeetle.UInt128;

import java.util.UUID;

/**
 * Helper methods for working with TigerBeetle transfers in tests
 */
public class TigerBeetleTestHelper {

    public static Transfer createTestTransfer(UUID debitId, UUID creditId, long amount, int code) {
        Transfer transfer = new Transfer();
        transfer.setId(uuidToUInt128(UUID.randomUUID()));
        transfer.setDebitAccountId(uuidToUInt128(debitId));
        transfer.setCreditAccountId(uuidToUInt128(creditId));
        transfer.setAmount(amount);
        transfer.setCode(code);
        transfer.setLedger(1); // Test ledger
        transfer.setTimestamp(System.currentTimeMillis());
        return transfer;
    }

    public static UInt128 uuidToUInt128(UUID uuid) {
        long msb = uuid.getMostSignificantBits();
        long lsb = uuid.getLeastSignificantBits();
        return new UInt128(msb, lsb);
    }

    public static UUID uint128ToUUID(UInt128 uint128) {
        return new UUID(uint128.getMostSignificantLong(), uint128.getLeastSignificantLong());
    }

    public static int extractCodeFromTransfer(Transfer transfer) {
        return transfer.getCode();
    }

    public static long extractAmountFromTransfer(Transfer transfer) {
        return transfer.getAmount();
    }
}

// ============ MOCK BUILDERS ============

package com.fluo.test.utils;

import org.mockito.Mockito;

import java.util.*;

/**
 * Builder for creating mock objects with fluent API
 */
public class MockBuilder {

    public static <T> T mockService(Class<T> serviceClass) {
        return Mockito.mock(serviceClass);
    }

    public static TenantServiceMock tenantService() {
        return new TenantServiceMock();
    }

    public static KMSServiceMock kmsService() {
        return new KMSServiceMock();
    }
}

class TenantServiceMock {
    private final TenantService mock;

    public TenantServiceMock() {
        this.mock = Mockito.mock(TenantService.class);
    }

    public TenantServiceMock withTenant(UUID tenantId, String name) {
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setName(name);
        Mockito.when(mock.getTenant(tenantId)).thenReturn(Optional.of(tenant));
        return this;
    }

    public TenantService build() {
        return mock;
    }
}

class KMSServiceMock {
    private final KMSService mock;

    public KMSServiceMock() {
        this.mock = Mockito.mock(KMSService.class);
    }

    public KMSServiceMock withSigningKey(UUID tenantId, byte[] publicKey) {
        Mockito.when(mock.getPublicKey(tenantId, "signing")).thenReturn(publicKey);
        return this;
    }

    public KMSServiceMock withEncryptionKey(UUID tenantId, byte[] key) {
        Mockito.when(mock.getEncryptionKey(tenantId, "encryption")).thenReturn(key);
        return this;
    }

    public KMSService build() {
        return mock;
    }
}

// ============ TEST DATA BUILDERS ============

package com.fluo.test.utils;

import com.fluo.model.*;

import java.time.Instant;
import java.util.*;

/**
 * Builder pattern for creating test domain objects
 */
public class SpanBuilder {
    private String traceId = UUID.randomUUID().toString().replace("-", "");
    private String spanId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    private String serviceName = "test-service";
    private String operationName = "test-operation";
    private String parentSpanId = null;
    private Instant startTime = Instant.now().minusSeconds(10);
    private Instant endTime = Instant.now();
    private Map<String, Object> attributes = new HashMap<>();

    public SpanBuilder traceId(String traceId) {
        this.traceId = traceId;
        return this;
    }

    public SpanBuilder spanId(String spanId) {
        this.spanId = spanId;
        return this;
    }

    public SpanBuilder serviceName(String serviceName) {
        this.serviceName = serviceName;
        return this;
    }

    public SpanBuilder operationName(String operationName) {
        this.operationName = operationName;
        return this;
    }

    public SpanBuilder parentSpanId(String parentSpanId) {
        this.parentSpanId = parentSpanId;
        return this;
    }

    public SpanBuilder attribute(String key, Object value) {
        this.attributes.put(key, value);
        return this;
    }

    public SpanBuilder complianceAttributes(String framework, String control, String status) {
        attributes.put("compliance.framework", framework);
        attributes.put("compliance.control", control);
        attributes.put("compliance.status", status);
        return this;
    }

    public Span build() {
        Span span = new Span();
        span.setTraceId(traceId);
        span.setSpanId(spanId);
        span.setServiceName(serviceName);
        span.setOperationName(operationName);
        span.setParentSpanId(parentSpanId);
        span.setStartTime(startTime);
        span.setEndTime(endTime);
        span.setAttributes(attributes);
        return span;
    }
}

public class RuleBuilder {
    private UUID id = UUID.randomUUID();
    private UUID tenantId = UUID.randomUUID();
    private String name = "Test Rule";
    private String dsl = "DETECT \"Test\" WHEN count(spans) > 0";
    private String severity = "medium";
    private String category = "test";
    private boolean enabled = true;

    public RuleBuilder id(UUID id) {
        this.id = id;
        return this;
    }

    public RuleBuilder tenantId(UUID tenantId) {
        this.tenantId = tenantId;
        return this;
    }

    public RuleBuilder name(String name) {
        this.name = name;
        return this;
    }

    public RuleBuilder dsl(String dsl) {
        this.dsl = dsl;
        return this;
    }

    public RuleBuilder severity(String severity) {
        this.severity = severity;
        return this;
    }

    public RuleBuilder category(String category) {
        this.category = category;
        return this;
    }

    public RuleBuilder enabled(boolean enabled) {
        this.enabled = enabled;
        return this;
    }

    public Rule build() {
        Rule rule = new Rule();
        rule.setId(id);
        rule.setTenantId(tenantId);
        rule.setName(name);
        rule.setDsl(dsl);
        rule.setSeverity(severity);
        rule.setCategory(category);
        rule.setEnabled(enabled);
        rule.setCreatedAt(Instant.now());
        return rule;
    }
}

// ============ JWT TEST HELPER ============

package com.fluo.test.utils;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

import java.util.*;

/**
 * Helper for generating test JWT tokens
 */
public class JWTTestHelper {

    private static final String TEST_SECRET = "test-secret-key-for-jwt-signing";

    public static String generateToken(UUID userId, UUID tenantId, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("user_id", userId.toString());
        claims.put("tenant_id", tenantId.toString());
        claims.put("role", role);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(userId.toString())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 3600000)) // 1 hour
                .signWith(SignatureAlgorithm.HS256, TEST_SECRET)
                .compact();
    }

    public static String generateExpiredToken(UUID userId, UUID tenantId, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("user_id", userId.toString());
        claims.put("tenant_id", tenantId.toString());
        claims.put("role", role);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(userId.toString())
                .setIssuedAt(new Date(System.currentTimeMillis() - 7200000)) // 2 hours ago
                .setExpiration(new Date(System.currentTimeMillis() - 3600000)) // 1 hour ago
                .signWith(SignatureAlgorithm.HS256, TEST_SECRET)
                .compact();
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** TigerBeetleTestHelper for transfer assertions
**ADR-013 (Camel-First):** Not applicable (test utility)
**ADR-014 (Named Processors):** Utilities support testing all processors
**ADR-015 (Tiered Storage):** Not applicable (test utility)

## Usage Examples

```java
// Using custom assertions
@Test
void testSignalGeneration() {
    Signal signal = signalService.createSignal(...);

    SignalAssert.assertThat(signal)
        .hasSeverity("critical")
        .hasStatus("open")
        .belongsToTenant(tenantId)
        .hasMatchedSpanCount(3);
}

// Using SpanBuilder
@Test
void testComplianceSpan() {
    Span span = new SpanBuilder()
        .traceId("abc123")
        .serviceName("compliance-service")
        .complianceAttributes("SOC2", "CC6.1", "PASS")
        .build();

    SpanAssert.assertThat(span)
        .isComplianceSpan()
        .hasComplianceStatus("PASS");
}

// Using MockBuilder
@Test
void testTenantServiceMock() {
    TenantService tenantService = MockBuilder.tenantService()
        .withTenant(tenantId, "Acme Corp")
        .build();

    Optional<Tenant> tenant = tenantService.getTenant(tenantId);
    assertThat(tenant).isPresent();
}
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testSignalAssert_HasSeverity - custom assertion works
- testSpanAssert_IsComplianceSpan - validates compliance attributes
- testRuleAssert_IsEnabled - validates enabled state
- testTigerBeetleHelper_UUIDConversion - UUID ↔ UInt128 conversion
- testSpanBuilder_BuildsValidSpan - builder creates valid span
- testRuleBuilder_BuildsValidRule - builder creates valid rule
- testJWTHelper_GeneratesValidToken - JWT token is valid
- testJWTHelper_GeneratesExpiredToken - expired token is expired

**Integration Tests:**
- testAssertions_WorkWithRealObjects - assertions work with actual domain objects

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- JWT test secret leakage - mitigate by using different secret from production
- Mock pollution - mitigate with test isolation

**Compliance:**
- SOC2 CC8.1 (Change Management) - test utilities enable comprehensive testing

## Success Criteria

- [ ] Custom AssertJ assertions for Signal, Span, Rule
- [ ] TigerBeetle test helpers (UUID conversion, transfer creation)
- [ ] Mock builders with fluent API (TenantService, KMSService)
- [ ] Domain object builders (SpanBuilder, RuleBuilder)
- [ ] JWT test helper (generate valid/expired tokens)
- [ ] All utilities reusable across unit/integration tests
- [ ] All tests pass with 90% coverage
