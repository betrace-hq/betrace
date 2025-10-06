# SOP-001: Development and Deployment Procedures

**Version**: 2.0
**Last Updated**: 2025-01-05
**Status**: Active

## Overview

This Standard Operating Procedure defines the development, testing, and deployment processes for FLUO - a Pure Application Framework with mathematical tenant isolation guarantees.

## Architecture Summary

FLUO implements a mathematically secure, multi-tenant observability platform with:
- **TigerBeetle**: Financial-grade ledger for immutable span storage
- **Three-Tier Observability**: Platform, Tenant, and Business metrics
- **Pure Application Design**: Deployment-agnostic with external orchestration

## Development Environment Setup

### Prerequisites
- **Nix** (with flakes enabled)
- **Docker** (for external deployment testing)
- **Git** (for version control)

### Initial Setup
```bash
# Clone and enter development environment
git clone <repository-url>
cd fluo
nix develop

# Start complete development stack
nix run .#dev
```

### Development Stack Components
- **Frontend**: React + Tanstack (http://localhost:3000)
- **Backend**: Quarkus API (http://localhost:8081)
- **PostgreSQL**: Legacy data store (localhost:5432)
- **TigerBeetle**: Financial ledger (tcp://localhost:3001)
- **NATS**: Message broker (nats://localhost:4222)

## Development Workflow

### 1. Feature Development

#### Creating New Features
1. **Start from Clean State**
   ```bash
   git checkout main
   git pull origin main
   nix run .#dev  # Verify clean start
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/feature-name
   ```

3. **Implement with Tenant Isolation**
   - All new endpoints must use `@RequiresTenantContext`
   - Validate tenant access in all service methods
   - Use `TenantContext.validateTenantAccess()` before data operations
   - Add audit logging for all tenant operations

4. **Test Tenant Isolation**
   ```bash
   # Run tenant isolation tests
   cd backend && mvn test -Dtest=*TenantIsolation*

   # Run contract tests
   mvn test -Dtest=*ContractTest*
   ```

### 2. Camel Route Development Workflow

FLUO follows Apache Camel-First Architecture (ADR-013) with established patterns for route development, processor extraction, and comprehensive testing.

#### Route Development Process
1. **Define REST Endpoints**: Use Camel REST DSL for all HTTP endpoints
2. **Extract Business Logic**: Create named CDI processors for all business logic
3. **Implement Route Testing**: Test route configuration separately from business logic
4. **Achieve Coverage**: Minimum 90% instruction coverage required

#### Creating New Camel Routes
```bash
# 1. Create route class in com.fluo.routes package
# 2. Extract all business logic to named processors
# 3. Create comprehensive tests for both routes and processors
# 4. Verify coverage meets quality gates

# Example workflow
cd backend
# Create route class
touch src/main/java/com/fluo/routes/NewFeatureRoute.java
# Create processors
touch src/main/java/com/fluo/processors/NewFeatureProcessors.java
# Create tests
touch src/test/java/com/fluo/routes/NewFeatureRouteTest.java
touch src/test/java/com/fluo/processors/NewFeatureProcessorsTest.java
```

#### Processor Extraction Pattern
```java
// ✅ CORRECT: Named processor pattern
@Named("businessLogicProcessor")
@ApplicationScoped
public class BusinessLogicProcessor implements Processor {
    @Override
    public void process(Exchange exchange) throws Exception {
        // Testable business logic here
    }
}

// Route references named processor
from("rest:post:/api/endpoint")
    .process("businessLogicProcessor");

// ❌ INCORRECT: Inline lambda
from("rest:post:/api/endpoint")
    .process(exchange -> {
        // Business logic - hard to test
    });
```

#### Package Organization Requirements
```
com.fluo.routes/              # Route definitions only (RouteBuilder extensions)
com.fluo.processors/          # General business logic processors
com.fluo.security/            # Security-specific processors
com.fluo.model/              # Domain models
com.fluo.transformers/       # Data transformation logic
```

### 3. Code Quality Standards

#### Security Requirements
- **Tenant Validation**: Every tenant operation must validate access
- **Audit Logging**: All security events must be logged
- **Property Testing**: New tenant features require property-based tests
- **No Cross-Tenant Leaks**: Responses must contain only authorized tenant data

#### Camel Route Requirements
- **Named Processors**: All business logic in named CDI processors
- **Route Testing**: Configuration tests for all routes
- **Coverage Gates**: 90%+ instruction coverage required
- **Error Handling**: Comprehensive error scenarios tested

#### Code Structure
```java
@RequiresTenantContext  // Required for tenant operations
public class ServiceClass {

    @Inject TenantContext tenantContext;
    @Inject SecurityAuditLogger auditLogger;

    public ResponseType operation(String tenantId) {
        // Always validate tenant access first
        tenantContext.validateTenantAccess(tenantId);

        // Log the operation
        auditLogger.logTenantAccess("OPERATION_TYPE",
            tenantContext.getCurrentUserId(), tenantId,
            tenantContext.getRequestId(), "Description");

        // Perform business logic
        // ...
    }
}
```

### 4. Testing Requirements

#### Test Categories (All Required)
1. **Unit Tests**: Individual component testing
   - **Processor Tests**: Test individual named processors
   - **Component Tests**: Test utility classes and models
2. **Route Configuration Tests**: Camel route definition validation
   - **Route Builder Tests**: Test route configuration without context startup
   - **REST DSL Tests**: Verify endpoint definitions
3. **Integration Tests**: Cross-component interaction testing
   - **Complete Route Flow**: End-to-end message processing
   - **Error Handling**: Exception scenarios and recovery
4. **Property Tests**: Mathematical guarantee validation
   - **Security Boundaries**: Tenant isolation validation
   - **Scale Testing**: Generated data validation
5. **Contract Tests**: API boundary validation
6. **Security Tests**: Tenant isolation verification

#### Camel-Specific Testing Patterns

##### Route Testing Pattern
```java
@Test
@DisplayName("Should configure routes correctly")
void testRouteConfiguration() throws Exception {
    CamelContext testContext = new DefaultCamelContext();

    // Test route addition without starting processors
    assertDoesNotThrow(() -> testContext.addRoutes(routeBuilder));

    // Verify configuration properties
    assertNotNull(routeBuilder.getConfigProperty());
}
```

##### Processor Testing Pattern
```java
@Test
@DisplayName("Should process message correctly")
void testProcessor() throws Exception {
    // Arrange
    MyProcessor processor = new MyProcessor();
    CamelContext camelContext = new DefaultCamelContext();
    Exchange exchange = new DefaultExchange(camelContext);

    // Add test properties
    camelContext.getPropertiesComponent().addOverrideProperty("test.prop", "value");

    // Act
    processor.process(exchange);

    // Assert
    assertEquals("expected", exchange.getIn().getBody());
}
```

#### Running Tests
```bash
# Complete test suite
nix run .#test

# Backend tests only
cd backend && mvn test

# Frontend tests only
cd bff && npm test

# Camel route tests specifically
mvn test -Dtest=*RouteTest*

# Processor tests specifically
mvn test -Dtest=*ProcessorTest*

# Property-based security tests
mvn test -Dtest=*PropertyTest*

# Contract tests
mvn test -Dtest=*ContractTest*

# Coverage report
mvn test jacoco:report
```

#### Coverage Requirements
- **Overall Instruction Coverage**: 90% minimum
- **Branch Coverage**: 80% minimum
- **Security Processor Coverage**: 95% instruction, 90% branch
- **Route Configuration Coverage**: 100% of route definitions tested
- **Error Handling Coverage**: All exception paths tested

#### Test Data Requirements
- Use deterministic test data for reproducible results
- Never use real tenant IDs in tests
- Mock external dependencies (TigerBeetle, WorkOS)
- Validate tenant isolation in all multi-tenant tests
- Property files for processor testing (avoid hardcoded values)

## Build and Deployment

### Build Process
```bash
# Build all applications
nix build .#all

# Verify builds
ls -la bff/result/     # Frontend static assets
ls -la backend/result/ # Backend JAR

# Test production build locally
nix run .#serve        # Production preview
```

### Deployment Artifacts

#### Frontend Output
- **Static Assets**: Optimized React build in `bff/result/`
- **Content Type**: HTML, CSS, JS, assets
- **Serving**: Any static file server (Caddy, nginx, CDN)

#### Backend Output
- **Executable JAR**: Self-contained Quarkus application in `backend/result/bin/fluo-backend`
- **Dependencies**: All Maven dependencies included
- **Runtime**: Java 21 JVM required

### External Deployment Examples

#### Kubernetes Deployment
```yaml
# External deployment project
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fluo-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        image: fluo-backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: QUARKUS_DATASOURCE_JDBC_URL
          value: "jdbc:postgresql://postgres:5432/fluo"
        - name: TIGERBEETLE_ADDRESSES
          value: "tigerbeetle-service:3001"
```

#### Docker Compose
```yaml
version: '3.8'
services:
  fluo-frontend:
    image: nginx:alpine
    volumes:
      - ./frontend-assets:/usr/share/nginx/html
    ports:
      - "3000:80"

  fluo-backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8080:8080"
    environment:
      - QUARKUS_DATASOURCE_JDBC_URL=jdbc:postgresql://postgres:5432/fluo
    depends_on:
      - postgres
      - tigerbeetle
```

## Observability and Monitoring

### Metrics Endpoints
- **Platform Metrics**: `GET /observability/metrics/summary`
- **Tenant Metrics**: `GET /observability/metrics/tenant` (requires auth)
- **Health Status**: `GET /observability/health`
- **Migration Status**: `GET /migration/status`

### Three-Tier Metrics
1. **Platform Tier**: System health, processing rates, queue sizes
2. **Tenant Tier**: Per-tenant usage, error rates, performance
3. **Business Tier**: Service calls, business events, domain KPIs

### Alerting Thresholds
- **Security Violations**: Alert on any tenant isolation violations
- **Processing Errors**: Alert if error rate > 5% over 5 minutes
- **Queue Backup**: Alert if batch queue > 10,000 items
- **Migration Issues**: Alert if validation failure rate > 1%

## Security Procedures

### Tenant Isolation Verification

#### Pre-Deployment Checklist
- [ ] All endpoints with tenant data use `@RequiresTenantContext`
- [ ] Property tests validate tenant isolation at scale
- [ ] Contract tests verify no cross-tenant data in responses
- [ ] Audit logging enabled for all tenant operations
- [ ] Integration tests cover tenant boundary enforcement

#### Camel Route Code Review Checklist
- [ ] **No Inline Processors**: All business logic extracted to named CDI processors
- [ ] **Route Tests**: Configuration tests for all new routes
- [ ] **Processor Tests**: Unit tests with 90%+ coverage for all processors
- [ ] **Package Organization**: Routes in `routes/`, processors in appropriate packages
- [ ] **Named References**: All processors use `@Named` annotation and string references
- [ ] **Error Handling**: Exception scenarios tested and handled appropriately
- [ ] **REST DSL**: HTTP endpoints use Camel REST DSL, not JAX-RS controllers
- [ ] **Property Configuration**: External configuration via `@ConfigProperty`
- [ ] **Security Integration**: Security processors follow tenant isolation patterns
- [ ] **Documentation**: Complex routes documented with clear business logic description

#### Runtime Security Monitoring
- Monitor audit logs for `TENANT_ISOLATION_VIOLATION` events
- Set up alerts for unusual cross-tenant access patterns
- Regularly review security violation statistics
- Perform periodic tenant isolation verification tests

### Authentication and Authorization
- **Frontend → BFF**: JWT tokens from identity provider
- **BFF → Backend**: Validated JWT with tenant claims
- **Service → Service**: Internal service authentication
- **Database Access**: Application-level tenant validation

## Troubleshooting

### Common Issues

#### Tenant Context Missing
```
Error: "Method requires valid tenant context"
Solution: Ensure JWT token includes tenant_id claim
Check: TenantSecurityFilter logs for authentication failures
```

#### Cross-Tenant Access Denied
```
Error: "Tenant isolation violation"
Solution: Verify request tenant matches authenticated tenant
Check: SecurityAuditLogger for TENANT_ACCESS events
```

#### Migration Consistency Failures
```
Error: "Migration consistency validation failed"
Solution: Check data consistency between PostgreSQL and new system
Action: Consider rollback to previous migration phase
```

#### Batch Processing Stalled
```
Symptom: High queue size, no processing
Solution: Check TigerBeetle service connectivity
Action: Restart batch processor if necessary
```

### Debug Commands
```bash
# Check service health
curl http://localhost:8081/q/health

# Check tenant metrics (with auth)
curl -H "Authorization: Bearer demo-token" \
     http://localhost:8081/observability/metrics/tenant

# Check migration status
curl http://localhost:8081/migration/status

# View audit logs
docker logs fluo-backend | grep "FLUO_SECURITY_AUDIT"
```

## Change Management

### Architecture Changes
1. **Propose ADR**: Document architectural decisions
2. **Security Review**: Ensure tenant isolation maintained
3. **Performance Testing**: Validate scale requirements
4. **Contract Validation**: Ensure frontend compatibility
5. **Migration Planning**: Plan data migration if needed

### Deployment Changes
1. **Staging Deployment**: Test in staging environment
2. **Migration Validation**: Test migration procedures
3. **Rollback Planning**: Prepare rollback procedures
4. **Production Deployment**: Deploy with monitoring
5. **Post-Deployment Verification**: Verify all systems operational

## Compliance and Audit

### SOC 2 Requirements
- **Audit Logging**: All tenant operations logged
- **Access Control**: Tenant isolation enforced at all layers
- **Data Integrity**: Financial-grade storage with TigerBeetle
- **Monitoring**: Continuous security monitoring enabled
- **Incident Response**: Procedures for security violations

### Documentation Requirements
- Keep ADRs updated with architectural changes
- Update SOPs with procedural changes
- Maintain contract specifications for API changes
- Document security procedures and incident responses

---

## References

- [ADR-012: Mathematical Tenant Isolation Architecture](../ADRs/012-mathematical-tenant-isolation-architecture.md)
- [ADR-011: Pure Application Framework](../ADRs/011-pure-application-framework.md)
- [API Contract Specifications](../backend/src/test/resources/contracts/)
- [Security Audit Documentation](../backend/src/main/java/com/fluo/security/)

**Next Review Date**: 2025-04-05