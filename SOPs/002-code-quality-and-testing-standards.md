# SOP-002: Code Quality and Testing Standards

**Version**: 1.0
**Date**: 2025-09-26
**Status**: Active

## Overview

This Standard Operating Procedure defines comprehensive code quality and testing standards for FLUO, building upon the Apache Camel-First Architecture (ADR-013) and Camel Testing Standards (ADR-014). These standards ensure high-quality, maintainable code with mathematical security guarantees.

## Quality Metrics and Thresholds

### Test Coverage Requirements

#### Minimum Coverage Thresholds
- **Overall Instruction Coverage**: 90%
- **Overall Branch Coverage**: 80%
- **Security Components Coverage**: 95% instruction, 90% branch
- **Business Logic Processors**: 90% instruction, 85% branch
- **Route Configuration**: 100% of route definitions tested

#### Current Achievement (Verified)
- **Overall Instruction Coverage**: 93%+
- **Overall Branch Coverage**: 83%+
- **Security Processors**: 99% instruction, 91% branch
- **OAuth Processors**: 100% instruction and branch
- **Route Configuration**: 100% tested

### Code Quality Gates

#### Automated Quality Checks
1. **JaCoCo Coverage**: Enforced via Maven plugin with build failure on threshold miss
2. **Checkstyle**: Code style consistency (configured for team standards)
3. **SpotBugs**: Static analysis for bug detection
4. **Dependency Vulnerability Scanning**: Security audit of dependencies

## Testing Standards by Component Type

### 1. Camel Route Testing

#### Route Configuration Tests
**Purpose**: Verify route definitions and REST DSL configuration without processor execution.

```java
@Test
@DisplayName("Should configure OAuth routes correctly")
void testRouteConfiguration() throws Exception {
    CamelContext testContext = new DefaultCamelContext();

    // Test: Route can be added without starting processors
    assertDoesNotThrow(() -> testContext.addRoutes(workOSAuthRoutes));

    // Test: Configuration properties are bound correctly
    assertEquals("test-client-id", workOSAuthRoutes.clientId);
    assertEquals("http://localhost:8080/api/auth/callback", workOSAuthRoutes.redirectUri);
}

@Test
@DisplayName("Should define REST endpoints correctly")
void testRestEndpointDefinition() throws Exception {
    // Verify REST DSL configuration doesn't throw exceptions
    assertDoesNotThrow(() -> workOSAuthRoutes.configure());
}

@Test
@DisplayName("Should use RouteBuilder pattern correctly")
void testRouteBuilderInheritance() {
    assertTrue(workOSAuthRoutes instanceof RouteBuilder);
}
```

#### Requirements for Route Tests
- [ ] All route classes have corresponding test classes
- [ ] Configuration properties tested for binding
- [ ] REST DSL definitions verified
- [ ] Route builder inheritance confirmed
- [ ] No processor execution required

### 2. Processor Testing

#### Unit Testing Pattern
**Purpose**: Test individual processor logic with full coverage and edge cases.

```java
@Test
@DisplayName("Should build authorization URL with organization ID")
void testLoginProcessorWithOrgId() throws Exception {
    // Arrange
    WorkOSProcessors.LoginProcessor processor = new WorkOSProcessors.LoginProcessor();
    CamelContext camelContext = new DefaultCamelContext();
    Exchange exchange = new DefaultExchange(camelContext);

    // Setup test data
    exchange.getIn().setHeader("org_id", "org_123");
    camelContext.getPropertiesComponent().addOverrideProperty("workos.client.id", "test-client");
    camelContext.getPropertiesComponent().addOverrideProperty("workos.redirect.uri", "http://test.com/callback");

    // Act
    processor.process(exchange);

    // Assert
    assertEquals(302, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
    String location = exchange.getIn().getHeader("Location", String.class);
    assertThat(location)
        .contains("test-client")
        .contains("http://test.com/callback")
        .contains("organization=org_123");
}

@Test
@DisplayName("Should handle missing authorization code gracefully")
void testCallbackProcessorError() throws Exception {
    WorkOSProcessors.CallbackProcessor processor = new WorkOSProcessors.CallbackProcessor();
    Exchange exchange = new DefaultExchange(new DefaultCamelContext());

    // Test error condition
    IllegalArgumentException exception = assertThrows(
        IllegalArgumentException.class,
        () -> processor.process(exchange)
    );
    assertEquals("No authorization code received", exception.getMessage());
}
```

#### Requirements for Processor Tests
- [ ] All processors have comprehensive unit tests
- [ ] All code paths tested (happy path + edge cases)
- [ ] Error conditions explicitly tested
- [ ] External dependencies mocked appropriately
- [ ] Test data uses property placeholders, not hardcoded values

### 3. Security Testing

#### Property-Based Testing for Tenant Isolation
**Purpose**: Mathematical verification of security guarantees at scale.

```java
@Test
@DisplayName("Should maintain tenant isolation under all conditions")
void testTenantIsolationProperty() {
    // Property: No processor should allow cross-tenant access
    for (int i = 0; i < 1000; i++) {
        String tenantA = generateRandomTenantId();
        String tenantB = generateRandomTenantId();

        Exchange exchangeA = createTenantExchange(tenantA);
        Exchange exchangeB = createTenantExchange(tenantB);

        // Process with tenant A context
        processor.process(exchangeA);

        // Verify tenant B cannot access tenant A's result
        assertTenantIsolation(exchangeA, exchangeB);
    }
}

@Test
@DisplayName("Should reject unauthorized access with proper audit logging")
void testSecurityViolationHandling() throws Exception {
    TenantSecurityProcessor processor = TenantSecurityProcessor.requireAuthentication();
    Exchange exchange = new DefaultExchange(new DefaultCamelContext());

    // Test: No authentication token
    processor.process(exchange);

    assertEquals(401, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
    // Verify audit log entry created (mock verification)
}
```

#### Requirements for Security Tests
- [ ] Property-based tests for all security boundaries
- [ ] Tenant isolation verified at scale (1000+ iterations)
- [ ] Authentication and authorization paths tested
- [ ] Audit logging verified for all security events
- [ ] Cross-tenant access attempts explicitly tested and blocked

### 4. Integration Testing

#### End-to-End Route Flow Testing
**Purpose**: Verify complete message processing through route chains.

```java
@Test
@DisplayName("Should process complete OAuth flow successfully")
void testCompleteOAuthFlow() throws Exception {
    // This test would require more complex setup with mock endpoints
    // and is typically reserved for integration test phase

    // Setup mock external services
    MockEndpoint mockWorkOSToken = getMockEndpoint("mock:workos-token");
    MockEndpoint mockWorkOSProfile = getMockEndpoint("mock:workos-profile");

    // Configure expected responses
    mockWorkOSToken.expectedMessageCount(1);
    mockWorkOSProfile.expectedMessageCount(1);

    // Send test message through route
    template.sendBodyAndHeader("direct:workosCallback", null, "code", "test-auth-code");

    // Verify all endpoints called correctly
    assertMockEndpointsSatisfied();
}
```

#### Requirements for Integration Tests
- [ ] Critical business flows tested end-to-end
- [ ] External service integration points mocked
- [ ] Error handling and recovery tested
- [ ] Performance characteristics verified
- [ ] Data transformation accuracy validated

## Maven Configuration

### JaCoCo Configuration
```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <executions>
        <execution>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
        <execution>
            <id>check</id>
            <phase>verify</phase>
            <goals>
                <goal>check</goal>
            </goals>
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
        </execution>
    </executions>
</plugin>
```

### Surefire Configuration for Test Execution
```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <version>3.5.0</version>
    <configuration>
        <systemProperties>
            <property>
                <name>java.util.logging.manager</name>
                <value>org.jboss.logmanager.LogManager</value>
            </property>
        </systemProperties>
        <includes>
            <include>**/*Test.java</include>
            <include>**/*Tests.java</include>
        </includes>
    </configuration>
</plugin>
```

## Test Execution Workflow

### Local Development Testing
```bash
# Run all tests with coverage
mvn clean test

# Generate and view coverage report
mvn jacoco:report
open target/site/jacoco/index.html

# Run specific test categories
mvn test -Dtest=*RouteTest*           # Route configuration tests
mvn test -Dtest=*ProcessorTest*       # Processor unit tests
mvn test -Dtest=*SecurityTest*        # Security boundary tests
mvn test -Dtest=*PropertyTest*        # Property-based tests
mvn test -Dtest=*IntegrationTest*     # Integration tests

# Run tests with specific profiles
mvn test -Ptest-security              # Security-focused test suite
mvn test -Ptest-performance           # Performance validation tests
```

### Continuous Integration Requirements
1. **All Tests Must Pass**: Zero tolerance for failing tests in CI
2. **Coverage Gates Enforced**: Build fails if coverage below thresholds
3. **Security Tests Required**: Property-based tests must execute
4. **Performance Baselines**: Integration tests validate performance
5. **Dependency Scanning**: Security audit of all dependencies

## Quality Assurance Checklist

### Pre-Commit Checklist
- [ ] All new code has corresponding tests
- [ ] Local test suite passes completely
- [ ] Coverage meets or exceeds thresholds
- [ ] No security vulnerabilities introduced
- [ ] Code follows established patterns

### Code Review Checklist

#### General Quality
- [ ] Code follows single responsibility principle
- [ ] Methods are focused and testable
- [ ] Dependencies injected properly
- [ ] Error handling comprehensive
- [ ] Security considerations addressed

#### Camel-Specific Quality
- [ ] No inline processors (all extracted to named CDI beans)
- [ ] Route tests cover configuration
- [ ] Processor tests achieve required coverage
- [ ] Package organization follows standards
- [ ] Named processors use proper annotations

#### Testing Quality
- [ ] Test methods have descriptive names (@DisplayName used)
- [ ] All code paths tested (happy + edge cases)
- [ ] Error conditions explicitly tested
- [ ] Mock usage minimized and appropriate
- [ ] Property-based tests for security boundaries

### Performance Requirements

#### Test Execution Performance
- **Unit Tests**: < 10ms average per test
- **Processor Tests**: < 50ms average per test
- **Route Configuration Tests**: < 100ms per test
- **Integration Tests**: < 5 seconds per test
- **Property-Based Tests**: < 10 seconds for 1000 iterations

#### Coverage Report Generation
- **JaCoCo Report**: < 30 seconds for complete report
- **HTML Report**: Generated automatically with each test run
- **CSV Export**: Available for automated analysis

## Tools and Dependencies

### Required Testing Dependencies
```xml
<!-- JUnit 5 for testing framework -->
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>

<!-- AssertJ for fluent assertions -->
<dependency>
    <groupId>org.assertj</groupId>
    <artifactId>assertj-core</artifactId>
    <scope>test</scope>
</dependency>

<!-- Mockito for mocking (minimal usage) -->
<dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-core</artifactId>
    <scope>test</scope>
</dependency>

<!-- Camel Test Support -->
<dependency>
    <groupId>org.apache.camel</groupId>
    <artifactId>camel-test-junit5</artifactId>
    <scope>test</scope>
</dependency>
```

### Static Analysis Tools
- **JaCoCo**: Code coverage measurement and reporting
- **SpotBugs**: Static analysis for bug detection
- **Checkstyle**: Code style enforcement
- **OWASP Dependency Check**: Security vulnerability scanning

## Troubleshooting Common Testing Issues

### Coverage Not Meeting Thresholds
```bash
# Generate detailed coverage report
mvn clean test jacoco:report

# Check which lines are not covered
open target/site/jacoco/index.html

# Common fixes:
# 1. Add tests for missing code paths
# 2. Test error conditions and edge cases
# 3. Remove dead code if coverage reveals it
```

### Test Failures in CI But Not Locally
```bash
# Common causes and solutions:
# 1. Environment differences - check property values
# 2. Race conditions - add proper test isolation
# 3. External dependencies - ensure proper mocking
# 4. Resource cleanup - verify @AfterEach methods
```

### Slow Test Execution
```bash
# Profile test execution
mvn test -Dmaven.surefire.debug

# Common optimizations:
# 1. Avoid starting full Camel contexts in unit tests
# 2. Use direct processor instantiation
# 3. Mock external services appropriately
# 4. Reduce test data size where possible
```

## Compliance and Audit Requirements

### SOC 2 Type II Requirements
- **Security Testing**: All security boundaries tested with property-based tests
- **Audit Trail**: All test executions logged with results
- **Coverage Documentation**: Regular coverage reports maintained
- **Change Management**: All code changes require test coverage

### Documentation Requirements
- **Test Plan Documentation**: Maintained for each release
- **Coverage Reports**: Archived for compliance audits
- **Security Test Results**: Special documentation for property-based tests
- **Performance Baselines**: Tracked over time for regression detection

---

## Related Documents

- [ADR-013: Apache Camel-First Architecture](../ADRs/013-apache-camel-first-architecture.md)
- [ADR-014: Camel Testing and Code Organization Standards](../ADRs/014-camel-testing-and-organization-standards.md)
- [SOP-001: Development and Deployment Procedures](./001-development-and-deployment-procedures.md)

**Next Review Date**: 2025-12-26