# PRD-007d: Request Sanitization & Injection Prevention

**Parent PRD:** PRD-007 (API Input Validation & Rate Limiting)
**Unit:** D
**Priority:** P0
**Dependencies:**
- Unit A (Bean Validation Foundation) - for validation error format

## Scope

Implement request sanitization and injection prevention for XSS, SQL injection, LDAP injection, and command injection attacks. Enforce request size limits to prevent memory exhaustion DoS attacks.

## Problem

- No protection against XSS attacks (malicious HTML/JavaScript in inputs)
- No protection against SQL injection (malicious SQL in queries)
- No request size limits (attackers can send gigabyte-sized payloads)
- String inputs not sanitized before storage or display

## Solution

### Request Size Limits

**Camel Route Configuration:**
```java
@ApplicationScoped
public class ApiRoutes extends RouteBuilder {

    @Override
    public void configure() {
        // Global request size limit
        onException(RequestEntityTooLargeException.class)
            .handled(true)
            .process("requestSizeLimitErrorProcessor")
            .marshal().json()
            .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(413));

        // Configure max request size (1MB default)
        restConfiguration()
            .component("platform-http")
            .dataFormatProperty("maxRequestSize", "1048576");  // 1MB in bytes
    }
}
```

### Input Sanitization Processor

**Named Processor for Input Sanitization:**

```java
@Named("inputSanitizerProcessor")
@ApplicationScoped
public class InputSanitizerProcessor implements Processor {

    @Inject
    InputSanitizer sanitizer;

    @Override
    public void process(Exchange exchange) throws Exception {
        Object body = exchange.getIn().getBody();

        if (body instanceof String stringBody) {
            String sanitized = sanitizer.sanitize(stringBody);
            exchange.getIn().setBody(sanitized);
        } else if (body instanceof Map<?, ?> mapBody) {
            Map<String, Object> sanitized = sanitizer.sanitizeMap(mapBody);
            exchange.getIn().setBody(sanitized);
        } else if (body instanceof Record record) {
            Object sanitized = sanitizer.sanitizeRecord(record);
            exchange.getIn().setBody(sanitized);
        }
    }
}
```

### Input Sanitizer Service

```java
@ApplicationScoped
public class InputSanitizer {

    private static final Logger LOG = Logger.getLogger(InputSanitizer.class);

    // HTML/XSS sanitization policy
    private final PolicyFactory htmlPolicy = new HtmlPolicyBuilder()
        .allowElements("p", "br", "strong", "em")  // Allow minimal safe HTML
        .toFactory();

    // SQL injection patterns
    private static final Pattern SQL_INJECTION_PATTERN = Pattern.compile(
        "('|(\\-\\-)|;|\\bOR\\b|\\bAND\\b|\\bUNION\\b|\\bSELECT\\b|\\bINSERT\\b|\\bUPDATE\\b|\\bDELETE\\b|\\bDROP\\b)",
        Pattern.CASE_INSENSITIVE
    );

    // LDAP injection patterns
    private static final Pattern LDAP_INJECTION_PATTERN = Pattern.compile(
        "[\\(\\)\\*\\|\\&\\=\\!\\<\\>\\~]"
    );

    // Command injection patterns
    private static final Pattern COMMAND_INJECTION_PATTERN = Pattern.compile(
        "[;\\|\\&\\$\\`\\(\\)\\<\\>\\n]"
    );

    /**
     * Sanitize string input for XSS, SQL injection, and command injection.
     *
     * @param input Raw input string
     * @return Sanitized string
     */
    public String sanitize(String input) {
        if (input == null || input.isBlank()) {
            return input;
        }

        String sanitized = input;

        // 1. Strip dangerous HTML (XSS prevention)
        sanitized = htmlPolicy.sanitize(sanitized);

        // 2. Detect SQL injection attempts (log and reject)
        if (SQL_INJECTION_PATTERN.matcher(sanitized).find()) {
            LOG.warn("SQL injection attempt detected: " + input);
            throw new InjectionAttemptException("SQL injection pattern detected in input");
        }

        // 3. Detect LDAP injection attempts
        if (LDAP_INJECTION_PATTERN.matcher(sanitized).find()) {
            LOG.warn("LDAP injection attempt detected: " + input);
            throw new InjectionAttemptException("LDAP injection pattern detected in input");
        }

        // 4. Detect command injection attempts
        if (COMMAND_INJECTION_PATTERN.matcher(sanitized).find()) {
            LOG.warn("Command injection attempt detected: " + input);
            throw new InjectionAttemptException("Command injection pattern detected in input");
        }

        return sanitized;
    }

    /**
     * Recursively sanitize all string values in a map.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> sanitizeMap(Map<?, ?> map) {
        Map<String, Object> sanitized = new HashMap<>();

        for (Map.Entry<?, ?> entry : map.entrySet()) {
            String key = entry.getKey().toString();
            Object value = entry.getValue();

            if (value instanceof String stringValue) {
                sanitized.put(key, sanitize(stringValue));
            } else if (value instanceof Map<?, ?> nestedMap) {
                sanitized.put(key, sanitizeMap(nestedMap));
            } else if (value instanceof List<?> list) {
                sanitized.put(key, sanitizeList(list));
            } else {
                sanitized.put(key, value);  // Pass through non-string values
            }
        }

        return sanitized;
    }

    /**
     * Recursively sanitize all string values in a list.
     */
    private List<Object> sanitizeList(List<?> list) {
        return list.stream()
            .map(item -> {
                if (item instanceof String stringItem) {
                    return sanitize(stringItem);
                } else if (item instanceof Map<?, ?> mapItem) {
                    return sanitizeMap(mapItem);
                } else if (item instanceof List<?> nestedList) {
                    return sanitizeList(nestedList);
                } else {
                    return item;
                }
            })
            .toList();
    }

    /**
     * Sanitize Java record by creating new instance with sanitized fields.
     */
    public Object sanitizeRecord(Record record) {
        try {
            RecordComponent[] components = record.getClass().getRecordComponents();
            Object[] sanitizedValues = new Object[components.length];

            for (int i = 0; i < components.length; i++) {
                RecordComponent component = components[i];
                Method accessor = component.getAccessor();
                Object value = accessor.invoke(record);

                if (value instanceof String stringValue) {
                    sanitizedValues[i] = sanitize(stringValue);
                } else if (value instanceof Map<?, ?> mapValue) {
                    sanitizedValues[i] = sanitizeMap(mapValue);
                } else {
                    sanitizedValues[i] = value;
                }
            }

            // Reconstruct record with sanitized values
            Class<?>[] paramTypes = Arrays.stream(components)
                .map(RecordComponent::getType)
                .toArray(Class<?>[]::new);
            Constructor<?> constructor = record.getClass().getDeclaredConstructor(paramTypes);
            return constructor.newInstance(sanitizedValues);

        } catch (Exception e) {
            LOG.error("Failed to sanitize record: " + e.getMessage(), e);
            throw new RuntimeException("Record sanitization failed", e);
        }
    }
}

public class InjectionAttemptException extends RuntimeException {
    public InjectionAttemptException(String message) {
        super(message);
    }
}
```

### Injection Attempt Error Handler

```java
@Named("injectionAttemptErrorProcessor")
@ApplicationScoped
public class InjectionAttemptErrorProcessor implements Processor {

    @Inject
    MetricsService metricsService;

    @Override
    public void process(Exchange exchange) throws Exception {
        Throwable cause = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Throwable.class);

        if (cause instanceof InjectionAttemptException iae) {
            UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
            String userId = exchange.getIn().getHeader("userId", String.class);

            // Record security event
            metricsService.recordInjectionAttempt(tenantId, userId, iae.getMessage());

            InjectionAttemptResponse response = new InjectionAttemptResponse(
                "Security violation detected",
                "Your request contains potentially malicious input and has been blocked"
            );

            exchange.getIn().setBody(response);
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 400);
        }
    }
}

public record InjectionAttemptResponse(
    String error,
    String message
) {}

public class RequestEntityTooLargeException extends RuntimeException {
    public RequestEntityTooLargeException(String message) {
        super(message);
    }
}

@Named("requestSizeLimitErrorProcessor")
@ApplicationScoped
public class RequestSizeLimitErrorProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        RequestSizeLimitResponse response = new RequestSizeLimitResponse(
            "Request too large",
            "Request body exceeds maximum size of 1MB"
        );

        exchange.getIn().setBody(response);
    }
}

public record RequestSizeLimitResponse(
    String error,
    String message
) {}
```

### Camel Route Integration

```java
@ApplicationScoped
public class RuleApiRoutes extends RouteBuilder {

    @Override
    public void configure() {
        // Injection attempt error handler
        onException(InjectionAttemptException.class)
            .handled(true)
            .process("injectionAttemptErrorProcessor")
            .marshal().json();

        // Apply sanitization to all API endpoints
        rest("/api/rules")
            .post()
            .to("direct:createRuleWithSanitization");

        from("direct:createRuleWithSanitization")
            .process("inputSanitizerProcessor")  // Sanitize input
            .to("direct:createRule");            // Existing business logic
    }
}
```

### Updated Metrics Service

```java
@ApplicationScoped
public class MetricsService {

    @Inject
    MeterRegistry meterRegistry;

    public void recordInjectionAttempt(UUID tenantId, String userId, String injectionType) {
        meterRegistry.counter(
            "betrace.security.injection_attempts",
            "tenant_id", tenantId != null ? tenantId.toString() : "unknown",
            "user_id", userId != null ? userId : "unauthenticated",
            "injection_type", injectionType
        ).increment();
    }
}
```

## Files to Create

### Sanitization
- `backend/src/main/java/com/betrace/security/InputSanitizer.java`
- `backend/src/main/java/com/betrace/processors/security/InputSanitizerProcessor.java`
- `backend/src/main/java/com/betrace/security/InjectionAttemptException.java`
- `backend/src/main/java/com/betrace/security/RequestEntityTooLargeException.java`

### Error Handling
- `backend/src/main/java/com/betrace/processors/security/InjectionAttemptErrorProcessor.java`
- `backend/src/main/java/com/betrace/processors/security/RequestSizeLimitErrorProcessor.java`
- `backend/src/main/java/com/betrace/dto/InjectionAttemptResponse.java`
- `backend/src/main/java/com/betrace/dto/RequestSizeLimitResponse.java`

### Tests
- `backend/src/test/java/com/betrace/security/InputSanitizerTest.java`
- `backend/src/test/java/com/betrace/processors/security/InputSanitizerProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/security/InjectionAttemptErrorProcessorTest.java`
- `backend/src/test/java/com/betrace/routes/InputSanitizationIntegrationTest.java`

## Files to Modify

- `backend/src/main/java/com/betrace/routes/RuleApiRoute.java` - Add sanitization processor
- `backend/src/main/java/com/betrace/routes/SpanApiRoute.java` - Add sanitization processor
- `backend/src/main/java/com/betrace/services/MetricsService.java` - Add injection attempt metrics
- `backend/pom.xml` - Add OWASP HTML Sanitizer dependency

## Success Criteria

- [ ] XSS attacks blocked (HTML/JavaScript stripped from inputs)
- [ ] SQL injection attempts detected and blocked
- [ ] LDAP injection attempts detected and blocked
- [ ] Command injection attempts detected and blocked
- [ ] Request size limited to 1MB (configurable)
- [ ] Oversized requests return 413 response
- [ ] Injection attempts logged and metrics recorded
- [ ] Test coverage: 90%+ instruction coverage per ADR-014

## Testing Requirements

### Unit Tests

**XSS Prevention:**
```java
@Test
@DisplayName("Should strip malicious HTML tags from input")
void testStripMaliciousHtml() {
    String maliciousInput = "<script>alert('XSS')</script><p>Valid content</p>";

    String sanitized = inputSanitizer.sanitize(maliciousInput);

    assertFalse(sanitized.contains("<script>"));
    assertFalse(sanitized.contains("alert"));
    assertTrue(sanitized.contains("Valid content"));
}

@Test
@DisplayName("Should allow safe HTML tags")
void testAllowSafeHtml() {
    String safeInput = "<p>This is <strong>bold</strong> text</p>";

    String sanitized = inputSanitizer.sanitize(safeInput);

    assertTrue(sanitized.contains("<p>"));
    assertTrue(sanitized.contains("<strong>"));
}
```

**SQL Injection Detection:**
```java
@Test
@DisplayName("Should detect SQL injection with UNION SELECT")
void testDetectSqlInjectionUnion() {
    String sqlInjection = "'; UNION SELECT password FROM users--";

    assertThrows(InjectionAttemptException.class, () -> {
        inputSanitizer.sanitize(sqlInjection);
    });
}

@Test
@DisplayName("Should detect SQL injection with OR 1=1")
void testDetectSqlInjectionOr() {
    String sqlInjection = "admin' OR '1'='1";

    assertThrows(InjectionAttemptException.class, () -> {
        inputSanitizer.sanitize(sqlInjection);
    });
}

@Test
@DisplayName("Should allow legitimate SQL-like content in DSL")
void testAllowLegitimateSqlInDsl() {
    String legitimateInput = "trace.has(database.query).where(result.error == true)";

    // This should NOT throw because it's not a SQL injection pattern
    assertDoesNotThrow(() -> inputSanitizer.sanitize(legitimateInput));
}
```

**LDAP Injection Detection:**
```java
@Test
@DisplayName("Should detect LDAP injection with wildcards")
void testDetectLdapInjection() {
    String ldapInjection = "admin)(|(password=*))";

    assertThrows(InjectionAttemptException.class, () -> {
        inputSanitizer.sanitize(ldapInjection);
    });
}
```

**Command Injection Detection:**
```java
@Test
@DisplayName("Should detect command injection with pipe")
void testDetectCommandInjectionPipe() {
    String commandInjection = "file.txt | rm -rf /";

    assertThrows(InjectionAttemptException.class, () -> {
        inputSanitizer.sanitize(commandInjection);
    });
}

@Test
@DisplayName("Should detect command injection with backticks")
void testDetectCommandInjectionBacktick() {
    String commandInjection = "`cat /etc/passwd`";

    assertThrows(InjectionAttemptException.class, () -> {
        inputSanitizer.sanitize(commandInjection);
    });
}
```

**Map Sanitization:**
```java
@Test
@DisplayName("Should recursively sanitize nested maps")
void testSanitizeNestedMap() {
    Map<String, Object> nestedMap = Map.of(
        "name", "<script>alert('XSS')</script>",
        "attributes", Map.of(
            "description", "<p>Valid</p><script>Bad</script>"
        )
    );

    Map<String, Object> sanitized = inputSanitizer.sanitizeMap(nestedMap);

    assertFalse(sanitized.get("name").toString().contains("<script>"));
    Map<String, Object> attrs = (Map<String, Object>) sanitized.get("attributes");
    assertFalse(attrs.get("description").toString().contains("<script>"));
}
```

**Record Sanitization:**
```java
@Test
@DisplayName("Should sanitize record fields")
void testSanitizeRecord() {
    CreateRuleRequest request = new CreateRuleRequest(
        "<script>alert('XSS')</script>Malicious Rule",
        "trace.has(error)",
        RuleSeverity.HIGH,
        UUID.randomUUID()
    );

    CreateRuleRequest sanitized = (CreateRuleRequest) inputSanitizer.sanitizeRecord(request);

    assertFalse(sanitized.name().contains("<script>"));
    assertTrue(sanitized.name().contains("Malicious Rule"));
}
```

### Integration Tests

**End-to-End Injection Prevention:**
```java
@Test
@DisplayName("Should reject SQL injection attempt via route")
void testSqlInjectionRejectedViaRoute() throws Exception {
    String maliciousJson = """
        {
            "name": "Rule'; DROP TABLE users--",
            "expression": "trace.has(error)",
            "severity": "HIGH",
            "tenantId": "%s"
        }
        """.formatted(UUID.randomUUID());

    Exchange response = template.request("direct:createRuleWithSanitization", exchange -> {
        exchange.getIn().setBody(maliciousJson);
    });

    assertEquals(400, response.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
    InjectionAttemptResponse error = response.getIn().getBody(InjectionAttemptResponse.class);
    assertEquals("Security violation detected", error.error());
}

@Test
@DisplayName("Should reject oversized request with 413 response")
void testOversizedRequestRejected() throws Exception {
    String largePayload = "a".repeat(2_000_000);  // 2MB payload

    Exchange response = template.request("direct:createRuleWithSanitization", exchange -> {
        exchange.getIn().setBody(largePayload);
    });

    assertEquals(413, response.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
}
```

**Metrics Recording:**
```java
@Test
@DisplayName("Should record injection attempt metrics")
void testInjectionAttemptMetrics() throws Exception {
    UUID tenantId = UUID.randomUUID();

    String sqlInjection = "admin' OR '1'='1";

    assertThrows(InjectionAttemptException.class, () -> {
        inputSanitizer.sanitize(sqlInjection);
    });

    // Verify metrics recorded
    Counter counter = meterRegistry.find("betrace.security.injection_attempts").counter();
    assertNotNull(counter);
    assertTrue(counter.count() > 0);
}
```

## Configuration

**application.properties:**
```properties
# Request size limits
betrace.security.max-request-size=1048576  # 1MB in bytes

# HTML sanitization policy
betrace.security.allowed-html-tags=p,br,strong,em
```

## Dependencies

**Maven (pom.xml):**
```xml
<!-- OWASP HTML Sanitizer for XSS prevention -->
<dependency>
    <groupId>com.googlecode.owasp-java-html-sanitizer</groupId>
    <artifactId>owasp-java-html-sanitizer</artifactId>
    <version>20220608.1</version>
</dependency>
```

## Architecture Compliance

- **ADR-013 (Camel-First):** Sanitization implemented as Camel processor
- **ADR-014 (Named Processors):** `InputSanitizerProcessor` extracted as named CDI bean
- **ADR-011 (Pure Application):** No deployment-specific security logic
- **ADR-015 (Testing Standards):** 90%+ test coverage with unit and integration tests

## Security Notes

**IMPORTANT:**
- Sanitization runs BEFORE validation (malicious input is cleaned first)
- Injection detection is pattern-based (may have false positives)
- Legitimate BeTrace DSL may contain SQL-like keywords (e.g., "SELECT" in trace context) - sanitizer must be tuned
- Request size limit prevents memory exhaustion DoS attacks
- All injection attempts are logged for security monitoring

**Trade-offs:**
- Pattern-based detection can have false positives (e.g., legitimate use of SQL keywords)
- HTML sanitization may strip legitimate formatting in user inputs
- Consider allowlist approach for critical fields (e.g., BeTrace DSL uses custom parser, not regex)

## Notes

- This unit does NOT include compliance logging (see Unit E)
- Injection attempts recorded as metrics for Grafana alerting
- HTML sanitization uses OWASP Java HTML Sanitizer (industry standard)
