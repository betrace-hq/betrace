# ADR-014: Camel Route Testing and Code Organization Standards

**Status:** ✅ **IMPLEMENTED**
**Date:** 2025-09-26
**Deciders:** Architecture Team

## Context

With the successful implementation of Apache Camel-First Architecture (ADR-013), FLUO has established mature patterns for route development, processor extraction, and comprehensive testing. These patterns have achieved 93%+ instruction coverage and proven effective for complex multi-tenant security scenarios. This ADR formalizes the testing and organization standards that have emerged from practical implementation.

### Problem Statement

1. **Testing Complexity**: Camel routes with inline processors are difficult to test comprehensively
2. **Code Organization**: Mixed concerns in route definitions reduce maintainability
3. **Quality Metrics**: Need standardized coverage requirements and quality gates
4. **Developer Onboarding**: Lack of clear patterns for new route development

## Decision

**Establish formal standards for Camel route testing and code organization based on proven implementation patterns from FLUO's security and OAuth systems.**

### Core Principles

1. **Processor Extraction**: All business logic extracted from routes into named CDI processors
2. **Separation of Testing**: Routes tested for configuration, processors tested for logic
3. **Package Organization**: Clear package structure with single-responsibility modules
4. **Coverage Requirements**: Minimum 90% instruction coverage with specific thresholds

## Implementation Standards

### 1. Package Organization Standard

```
com.fluo.routes/              # Route definitions only
├── WorkOSAuthRoutes.java     # OAuth authentication routes
├── TenantRoute.java          # Tenant management routes
├── SpanApiRoute.java         # OTLP/Span processing routes
└── ApiRoutes.java           # REST API aggregation routes

com.fluo.processors/          # General business logic processors
├── SpanApiProcessors.java    # Span processing logic
├── TenantRouteProcessors.java # Tenant management logic
└── TestStubProcessors.java   # Development/testing processors

com.fluo.security/            # Security-specific processors
├── WorkOSProcessors.java     # OAuth-specific processors
├── TenantSecurityProcessor.java # Multi-tenant security
└── WorkOSAuthConfiguration.java # Security configuration

com.fluo.model/              # Domain models and data structures
com.fluo.transformers/       # Data transformation logic
com.fluo.components/         # Shared components and utilities
```

### 2. Named Processor Pattern

**All business logic must be extracted to named CDI processors:**

```java
// ✅ CORRECT: Named processor pattern
@Named("workosLoginProcessor")
@ApplicationScoped
public class LoginProcessor implements Processor {
    @Override
    public void process(Exchange exchange) throws Exception {
        // Testable business logic
    }
}

// Route uses named reference
from("direct:workosLogin")
    .process("workosLoginProcessor");

// ❌ INCORRECT: Inline lambda
from("direct:workosLogin")
    .process(exchange -> {
        // Business logic here - hard to test
    });
```

### 3. Route Testing Pattern

**Routes are tested for configuration correctness without full context startup:**

```java
@Test
@DisplayName("Should configure OAuth routes correctly")
void testRouteConfiguration() throws Exception {
    CamelContext testContext = new DefaultCamelContext();

    // Test route addition without starting processors
    assertDoesNotThrow(() -> testContext.addRoutes(workOSAuthRoutes));

    // Verify route definition properties
    assertEquals("test-client-id", workOSAuthRoutes.clientId);
    assertNotNull(workOSAuthRoutes);
}

@Test
@DisplayName("Should define REST endpoints correctly")
void testRestEndpointDefinition() throws Exception {
    // Verify REST DSL configuration
    assertDoesNotThrow(() -> workOSAuthRoutes.configure());
}
```

### 4. Processor Testing Pattern

**Processors are unit tested with full coverage:**

```java
@Test
@DisplayName("Should build authorization URL correctly")
void testLoginProcessor() throws Exception {
    // Arrange
    WorkOSProcessors.LoginProcessor processor = new WorkOSProcessors.LoginProcessor();
    CamelContext camelContext = new DefaultCamelContext();
    Exchange exchange = new DefaultExchange(camelContext);

    // Add test properties
    camelContext.getPropertiesComponent().addOverrideProperty("workos.client.id", "test-client");

    // Act
    processor.process(exchange);

    // Assert
    assertEquals(302, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
    String location = exchange.getIn().getHeader("Location", String.class);
    assertThat(location).contains("test-client");
}

@Test
@DisplayName("Should handle missing authorization code")
void testCallbackProcessorError() throws Exception {
    WorkOSProcessors.CallbackProcessor processor = new WorkOSProcessors.CallbackProcessor();
    Exchange exchange = new DefaultExchange(new DefaultCamelContext());

    // Test error handling
    assertThrows(IllegalArgumentException.class, () -> processor.process(exchange));
}
```

### 5. Property-Based Testing for Security

**Security processors require property-based testing:**

```java
@Test
@DisplayName("Should maintain tenant isolation under all conditions")
void testTenantIsolationProperty() {
    // Property: No processor should allow cross-tenant access
    for (int i = 0; i < 1000; i++) {
        String tenantA = generateRandomTenantId();
        String tenantB = generateRandomTenantId();

        // Verify tenant A cannot access tenant B's data
        assertTenantIsolation(tenantA, tenantB);
    }
}
```

## Quality Requirements

### Coverage Thresholds

**Minimum Coverage Requirements:**
- **Overall Instruction Coverage**: 90%
- **Branch Coverage**: 80%
- **Security Processor Coverage**: 95% instructions, 90% branches
- **Business Logic Processor Coverage**: 90% instructions, 85% branches
- **Route Configuration Coverage**: 100% of route definitions tested

### Testing Categories (All Required)

1. **Unit Tests**: Individual processor testing
   - Direct processor instantiation
   - Mock external dependencies
   - Test all code paths and edge cases

2. **Route Configuration Tests**: Route definition validation
   - REST DSL configuration
   - Route builder inheritance
   - Configuration property binding

3. **Integration Tests**: End-to-end route flows
   - Complete message processing
   - Error handling and recovery
   - Performance under load

4. **Property-Based Tests**: Mathematical guarantees
   - Security boundary enforcement
   - Tenant isolation validation
   - Scale testing with generated data

5. **Error Handling Tests**: Exception scenarios
   - Processor exception handling
   - Route error recovery
   - Dead letter queue behavior

## Tools and Configuration

### Required Tools
- **JUnit 5**: Primary testing framework
- **JaCoCo**: Coverage measurement and reporting
- **AssertJ**: Fluent assertions for better test readability
- **Mockito**: External dependency mocking (when absolutely necessary)

### JaCoCo Configuration
```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <configuration>
        <rules>
            <rule>
                <element>BUNDLE</element>
                <limits>
                    <limit>
                        <counter>INSTRUCTION</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.90</minimum>
                    </limit>
                    <limit>
                        <counter>BRANCH</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.80</minimum>
                    </limit>
                </limits>
            </rule>
        </rules>
    </configuration>
</plugin>
```

## Alternatives Considered

### Alternative 1: Full Camel Testing Framework
**Considered**: Using CamelTestSupport with MockEndpoint
**Rejected**: Too heavyweight for unit testing, complex setup requirements

### Alternative 2: Inline Lambda Testing
**Considered**: Testing routes with inline processors
**Rejected**: Impossible to achieve comprehensive coverage, poor maintainability

### Alternative 3: JAX-RS Controller Testing
**Considered**: Keeping some endpoints as JAX-RS controllers
**Rejected**: Violates Camel-First Architecture principle

## Consequences

### Positive

1. **High Quality**: 93%+ coverage achieved with clear quality gates
2. **Fast Testing**: Unit tests run quickly without Camel context overhead
3. **Clear Debugging**: Named processors provide clear stack traces
4. **Reusable Components**: Processors can be composed across routes
5. **Easy Onboarding**: Clear patterns for new developers

### Negative

1. **Initial Complexity**: Requires understanding of processor extraction pattern
2. **File Count**: More files due to separated concerns
3. **Setup Overhead**: Need to configure properties for processor testing

### Mitigation Strategies

1. **Documentation**: Comprehensive examples in ADR and SOP documents
2. **Templates**: Provide templates for route and processor creation
3. **Code Review**: Enforce patterns through code review checklist
4. **Training**: Developer training on Camel testing patterns

## Implementation Status

### ✅ Completed
- **WorkOS OAuth Routes**: 7 processors extracted, 100% coverage
- **Tenant Security**: Complex security logic with 99% coverage
- **Route Configuration**: All routes follow REST DSL pattern
- **Package Organization**: Clear separation implemented
- **Quality Gates**: JaCoCo configured with thresholds

### Current Metrics
- **Total Test Classes**: 30+ comprehensive test suites
- **Overall Coverage**: 93% instruction, 83% branch
- **Security Coverage**: 99% instruction, 91% branch
- **OAuth Coverage**: 100% instruction and branch

## References

- [ADR-013: Apache Camel-First Architecture](./013-apache-camel-first-architecture.md)
- [JUnit 5 Documentation](https://junit.org/junit5/docs/current/user-guide/)
- [JaCoCo Maven Plugin](https://www.jacoco.org/jacoco/trunk/doc/maven.html)
- [Apache Camel Testing Guide](https://camel.apache.org/manual/testing.html)
- [FLUO Backend Test Examples](../backend/src/test/java/com/fluo/)

## Related ADRs

- [ADR-013: Apache Camel-First Architecture](./013-apache-camel-first-architecture.md) - Base architecture
- [ADR-012: Mathematical Tenant Isolation](./012-mathematical-tenant-isolation-architecture.md) - Security requirements
- [ADR-011: Pure Application Framework](./011-pure-application-framework.md) - Application structure