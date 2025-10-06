# CLAUDE.md - FLUO Backend

This file provides guidance to Claude Code (claude.ai/code) when working with the FLUO Backend.

## Overview

**FLUO Backend** is a clean-architecture implementation of the FLUO backend using:
- **Apache Camel** for integration and routing
- **Transformer Pattern** instead of processors for data conversion
- **REST APIs** for clear contracts with the BFF
- **Direct integration** with custom Camel components (rule, tigerbeetle, tenant)

## Key Architectural Decisions

### 1. No camel-signal Component
After analysis, we determined that a separate signal component adds no value. Instead, we use:
- REST endpoints for API contracts
- Transformers for data conversion
- Direct integration with camel-rule and camel-tigerbeetle

### 2. Transformer Pattern Over Processors
We use Camel's Transformer pattern for all data conversions:
```java
// Instead of processors:
.process(exchange -> { /* convert data */ })

// We use transformers:
.inputType("json:signalInput")
.outputType("java:com.fluo.model.Signal")
```

Benefits:
- Type safety
- Reusable transformations
- Automatic conversion based on declared types
- Cleaner routes

### 3. Clean Domain Models
All models are vendor-agnostic Java records:
- `Signal` - No TigerBeetle specifics
- `Rule` - Pure rule representation
- `RuleEvaluationResult` - Clean evaluation results

## Project Structure

```
backendV2/
├── src/main/java/com/fluo/
│   ├── model/              # Domain models (records)
│   ├── routes/             # Camel REST routes
│   ├── transformers/       # Data transformers
│   └── config/            # Configuration classes
└── src/main/resources/
    └── application.properties
```

## Development Commands

```bash
# Enter development environment
cd backendV2
nix develop

# Start development server with hot reload
mvn quarkus:dev

# Run tests
mvn test

# Build production JAR
mvn clean package

# Using Nix apps
nix run .#dev   # Start dev server
nix run .#test  # Run tests
nix build       # Build production
```

## API Endpoints

### Signal API
- `POST /api/signals` - Create new signal
- `GET /api/signals/{id}` - Get signal by ID
- `GET /api/signals` - List signals with pagination
- `POST /api/signals/{id}/evaluate` - Evaluate signal against rules

### Rule API
- `POST /api/rules` - Create new rule
- `GET /api/rules/{id}` - Get rule by ID
- `GET /api/rules` - List all rules
- `PUT /api/rules/{id}` - Update rule
- `DELETE /api/rules/{id}` - Delete rule
- `POST /api/rules/validate` - Validate rule expression
- `POST /api/rules/{id}/test` - Test rule with sample data

## Data Flow

```
BFF Request
    ↓
REST Endpoint (SignalApiRoute)
    ↓
Transformer (JSON → Domain Object)
    ↓
Camel Component (rule/tigerbeetle/tenant)
    ↓
Transformer (Component Result → Domain Object)
    ↓
REST Response
```

## Transformer Examples

### Signal Transformers
```java
// JSON → Signal
@Converter
public Signal fromJson(String json)

// Signal → TigerBeetle format
public Map<String, Object> toTigerBeetleTransfer(Signal signal)

// TigerBeetle result → Signal
public Signal fromTigerBeetleResult(Map<String, Object> result)

// Signal → Rule input
public Map<String, Object> toRuleInput(Signal signal)
```

## Route Pattern

```java
from("direct:createSignal")
    .inputType("java:com.fluo.model.Signal")    // Declare input type
    .outputType("rule:input")                   // Declare output type
    .to("rule:validate")                        // Automatic transformation
    .outputType("tigerbeetle:transfer")         // Next transformation
    .to("tigerbeetle:create");                  // Store in TigerBeetle
```

## Key Differences from Backend V1

1. **No Signal Component** - Removed unnecessary abstraction
2. **Transformers over Processors** - Type-safe data conversion
3. **Clean Models** - No vendor coupling in domain objects
4. **Simpler Routes** - Declarative type transformations
5. **~80% Less Code** - Focused on actual business logic

## Testing

```bash
# Run all tests
mvn test

# Run specific test
mvn test -Dtest=SignalApiRouteTest

# Run with coverage
mvn test jacoco:report
```

## Configuration

Key configuration in `application.properties`:
- HTTP port: 8080
- CORS enabled for BFF integration
- Health endpoint: `/health`
- Metrics endpoint: `/metrics`
- OpenTelemetry enabled

## Future Enhancements

1. Add WebSocket support for real-time signals
2. Implement batch processing endpoints
3. Add GraphQL API alongside REST
4. Enhance OpenTelemetry integration

## Important Notes

- Components (camel-rule, camel-tigerbeetle, camel-tenant) are assumed to exist
- All data transformation is centralized in transformer classes
- No business logic in routes - only orchestration
- Domain models are immutable records
- Use declarative type conversion over imperative processing