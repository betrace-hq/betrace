# FLUO Architecture

## What FLUO Is

FLUO is a **deployed service/platform** for behavioral assurance of OpenTelemetry data. It is NOT a library you import.

**Think of FLUO like:**
- Grafana (deployed service for observability)
- Datadog (SaaS platform for monitoring)
- Jaeger (deployed service for tracing)

**NOT like:**
- SDK/library you import (`import fluo from '@fluo/sdk'` - DOES NOT EXIST)
- Agent you install in your application
- Code you add to your services

## How Customers Deploy FLUO

### Option 1: Nix Flake (Local Development)
```bash
# Clone and run locally
git clone https://github.com/fluohq/fluo
cd fluo
nix run .#dev

# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
```

### Option 2: Docker Compose (Production)
```yaml
# External deployment project creates this
version: '3'
services:
  fluo-frontend:
    image: fluohq/frontend:latest
    ports:
      - "3000:3000"
  fluo-backend:
    image: fluohq/backend:latest
    ports:
      - "8080:8080"
```

### Option 3: Kubernetes (Enterprise)
```yaml
# External deployment manifests
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fluo-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: fluo
        image: fluohq/backend:latest
        ports:
        - containerPort: 8080
```

## How FLUO Receives Traces

Applications send OpenTelemetry traces to FLUO via standard OTLP protocol:

```javascript
// In your application code (Node.js example)
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const provider = new NodeTracerProvider();
provider.addSpanProcessor(
  new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: 'http://fluo-backend:8080/v1/traces', // FLUO's OTLP endpoint
    })
  )
);
provider.register();
```

```java
// In your application code (Java example)
OtlpHttpSpanExporter exporter = OtlpHttpSpanExporter.builder()
    .setEndpoint("http://fluo-backend:8080/v1/traces") // FLUO's OTLP endpoint
    .build();

SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
    .addSpanProcessor(BatchSpanProcessor.builder(exporter).build())
    .build();
```

## How FLUO Rules Work

Rules are configured in **FLUO's web UI** or via **FLUO's REST API**, NOT in application code.

### Creating Rules via FLUO UI

1. Navigate to FLUO UI: `http://localhost:3000`
2. Click "Rules" → "Create New Rule"
3. Enter rule definition using FLUO DSL
4. Save rule

### Example Rules (Configured in FLUO, NOT in Application Code)

```FluoDSL
// Rule: "Auth Retry Storm Detection"
// Configured in FLUO UI, not in application code!
trace.has(span => span.name === 'auth.login' && span.status === 'ERROR')
  .and(trace.has(span => span.name === 'auth.login' && span.status === 'OK'))
  .within('5 seconds')
```

```FluoDSL
// Rule: "Missing Audit Logs After PII Access"
trace.has(span => span.attributes['data.contains_pii'] === true)
  .and(trace.missing(span => span.name === 'audit.log'))
```

```FluoDSL
// Rule: "Slow Database Queries in Payment Flow"
trace.where(span => span.name.startsWith('payment'))
  .has(span =>
    span.name.includes('db.query') &&
    span.duration > 1000
  )
```

### Creating Rules via FLUO API

```bash
# POST rule to FLUO's REST API
curl -X POST http://localhost:8080/api/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Detect payment timeout cascade",
    "dsl": "trace.where(span => span.name.startsWith(\"payment\")).has(span => span.status === \"TIMEOUT\")",
    "severity": "critical"
  }'
```

## What FLUO Does NOT Provide

❌ **Application Libraries/SDKs** - FLUO is not imported into your code
❌ **Language-Specific Agents** - You use standard OpenTelemetry SDKs
❌ **Code Instrumentation** - Applications use vanilla OpenTelemetry
❌ **NPM/Maven/PyPI Packages** - FLUO is a deployed service, not a package

## What FLUO DOES Provide

✅ **OTLP Endpoint** - Receives traces from any OpenTelemetry SDK
✅ **Web UI** - Configure rules, view signals, investigate patterns
✅ **REST API** - Programmatic rule management
✅ **Pattern Matching Engine** - FluoDSL for trace patterns
✅ **Signal Generation** - Alerts when patterns are detected
✅ **Investigation Tools** - Query traces, view violations, discover invariants

## Architecture Diagram

```
┌─────────────────┐
│ Your Services   │ (instrumented with vanilla OpenTelemetry)
│ (Node/Java/Go)  │
└────────┬────────┘
         │ OTLP traces
         ▼
┌─────────────────┐
│  FLUO Service   │ (deployed separately)
│  - Backend API  │ - Receives OTLP traces
│  - Frontend UI  │ - Pattern matching engine
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Signals (Alerts)│ When patterns are detected
└─────────────────┘
```

## Key Point for Blog Posts

**FLUO is a platform you deploy and point your OpenTelemetry traces to, NOT code you add to your application.**

Your application code only needs standard OpenTelemetry instrumentation pointing to FLUO's OTLP endpoint.
