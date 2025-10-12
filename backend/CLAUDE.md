# Backend - FLUO Behavioral Assurance System

## Architecture

**Technology Stack:**
- Java 21, Quarkus, Maven
- Drools rule engine for DSL execution
- OpenTelemetry for trace ingestion
- JUnit 5 for testing

**Core Components:**
- `rules/dsl/` - FLUO DSL parser (lexer, parser, AST, Drools generator)
- `services/` - DroolsRuleEngine, SignalService, TenantSessionManager
- `compliance/` - SOC2/HIPAA annotations and evidence generation
- `routes/` - REST API endpoints (SpanApiRoute)

## Development

```bash
# Start backend dev server (from project root)
nix run .#backend

# Or from backend directory
nix develop
mvn quarkus:dev

# Run tests
mvn test

# Generate coverage report
mvn jacoco:report
open target/site/jacoco/index.html

# Run mutation testing (tiered by security criticality)
mvn test -Ppit-auth      # 80% threshold - authentication services
mvn test -Ppit-security  # 75% threshold - security components
mvn test -Ppit-all       # 70% threshold - all application code
```

**Testing Documentation:** See [TESTING.md](TESTING.md) for comprehensive testing guide including test categories, monitoring tools, and mutation testing details.

## Key Files

### DSL Implementation
- **@docs/technical/trace-rules-dsl.md** - DSL syntax and grammar reference
- **@docs/technical/error-messages.md** - Error message patterns and testing
- `src/main/java/com/fluo/rules/dsl/` - Parser implementation
  - `FluoDslParser.java` - Main parser
  - `DroolsGenerator.java` - AST → Drools DRL compiler
  - `RuleValidator.java` - Semantic validation

### Compliance System
- **@docs/compliance.md** - Compliance evidence generation guide
- `src/main/java/com/fluo/compliance/` - Generated compliance code
  - `annotations/` - `@SOC2`, `@HIPAA` annotations
  - `models/` - Control definitions
  - `evidence/` - ComplianceSpan, redaction strategies

### Services
- `DroolsRuleEngine.java` - Compiles DSL to Drools, executes rules
- `TenantSessionManager.java` - Per-tenant Drools sessions
- `SignalService.java` - Signal creation from rule violations
- `RuleEvaluationService.java` - Rule CRUD and validation

## Testing

**Test Coverage Target:** 90% instruction, 80% branch

**Key Test Files:**
- `FluoDslParserTest.java` - DSL parser tests
- `DroolsGeneratorTest.java` - Code generation tests
- `RuleValidatorTest.java` - Semantic validation tests
- `ErrorMessagesTest.java` - Error message quality tests

**Run Specific Tests:**
```bash
mvn test -Dtest=FluoDslParserTest
mvn test -Dtest=*RuleValidatorTest
```

## Compliance Integration

**Generated from:** `github:fluohq/compliance-as-code#java-soc2`

**Usage:**
```java
@SOC2(controls = {CC6_1}, notes = "Authorization check")
public boolean authorizeUser(String userId, String resource) {
    // Emits compliance span with framework=soc2, control=CC6_1
}
```

**Files auto-generated on:**
- `nix develop` (dev shell entry)
- `nix build` (production build)

See **@docs/compliance.md** for full details.

## Security Principles

1. **Never log PII without @Redact** - Use RedactionStrategy.HASH
2. **Compliance spans must be signed** - P0 security gap (not yet implemented)
3. **Rules are sandboxed** - P0 security gap (global objects need restriction)
4. **Tenant crypto isolation** - P0 security gap (need KMS integration)

See @docs/compliance-status.md for security gap details.

## Architecture Constraints

**Pure Application Framework (ADR-011):**
- ❌ No Docker/container builds in backend/
- ❌ No Kubernetes manifests
- ❌ No deployment infrastructure
- ✅ Export packages (`nix build`)
- ✅ Provide dev server (`nix run .#backend`)
- ✅ Deployment is external consumer responsibility

## API Endpoints

```
POST /api/spans              # Ingest OpenTelemetry spans
GET  /api/signals            # Query signals
POST /api/rules              # Create FLUO DSL rule
GET  /api/rules/{id}         # Get rule definition
PUT  /api/rules/{id}         # Update rule
DELETE /api/rules/{id}       # Delete rule
```

## References

- **/CLAUDE.md** - Root project overview
- **@docs/adrs/011-pure-application-framework.md** - Architecture
- **@docs/adrs/015-development-workflow-and-quality-standards.md** - Dev standards
- **@docs/COMPLIANCE_STATUS.md** - Compliance reality check
