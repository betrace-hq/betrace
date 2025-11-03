# BeTrace Architecture

## What BeTrace Is

BeTrace is a **deployed service/platform** for behavioral assurance of OpenTelemetry data. It is NOT a library you import.

**Think of BeTrace like:**
- Grafana (deployed service for observability)
- Datadog (SaaS platform for monitoring)
- Jaeger (deployed service for tracing)

**NOT like:**
- SDK/library you import (`import betrace from '@betrace/sdk'` - DOES NOT EXIST)
- Agent you install in your application
- Code you add to your services

## How Customers Deploy BeTrace

### Option 1: Nix Flake (Local Development)
```bash
# Clone and run locally
git clone https://github.com/betracehq/betrace
cd betrace
nix run .#dev

# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
```

### Option 2: Docker Compose (Production)
```yaml
# External deployment project creates this
version: '3'
services:
  betrace-frontend:
    image: betracehq/frontend:latest
    ports:
      - "3000:3000"
  betrace-backend:
    image: betracehq/backend:latest
    ports:
      - "8080:8080"
```

### Option 3: Kubernetes (Enterprise)
```yaml
# External deployment manifests
apiVersion: apps/v1
kind: Deployment
metadata:
  name: betrace-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: betrace
        image: betracehq/backend:latest
        ports:
        - containerPort: 8080
```

## How BeTrace Receives Traces

Applications send OpenTelemetry traces to BeTrace via standard OTLP protocol:

```javascript
// In your application code (Node.js example)
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const provider = new NodeTracerProvider();
provider.addSpanProcessor(
  new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: 'http://betrace-backend:8080/v1/traces', // BeTrace's OTLP endpoint
    })
  )
);
provider.register();
```

```java
// In your application code (Java example)
OtlpHttpSpanExporter exporter = OtlpHttpSpanExporter.builder()
    .setEndpoint("http://betrace-backend:8080/v1/traces") // BeTrace's OTLP endpoint
    .build();

SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
    .addSpanProcessor(BatchSpanProcessor.builder(exporter).build())
    .build();
```

## How BeTrace Rules Work

Rules are configured in **BeTrace's web UI** or via **BeTrace's REST API**, NOT in application code.

### Creating Rules via BeTrace UI

1. Navigate to BeTrace UI: `http://localhost:3000`
2. Click "Rules" → "Create New Rule"
3. Enter rule definition using BeTrace DSL
4. Save rule

### Example Rules (Configured in BeTrace, NOT in Application Code)

```BeTraceDSL
// Rule: "Auth Retry Storm Detection"
// Configured in BeTrace UI, not in application code!
trace.has(span => span.name === 'auth.login' && span.status === 'ERROR')
  .and(trace.has(span => span.name === 'auth.login' && span.status === 'OK'))
  .within('5 seconds')
```

```BeTraceDSL
// Rule: "Missing Audit Logs After PII Access"
trace.has(span => span.attributes['data.contains_pii'] === true)
  .and(trace.missing(span => span.name === 'audit.log'))
```

```BeTraceDSL
// Rule: "Slow Database Queries in Payment Flow"
trace.where(span => span.name.startsWith('payment'))
  .has(span =>
    span.name.includes('db.query') &&
    span.duration > 1000
  )
```

### Creating Rules via BeTrace API

```bash
# POST rule to BeTrace's REST API
curl -X POST http://localhost:8080/api/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Detect payment timeout cascade",
    "dsl": "trace.where(span => span.name.startsWith(\"payment\")).has(span => span.status === \"TIMEOUT\")",
    "severity": "critical"
  }'
```

## What BeTrace Does NOT Provide

❌ **Application Libraries/SDKs** - BeTrace is not imported into your code
❌ **Language-Specific Agents** - You use standard OpenTelemetry SDKs
❌ **Code Instrumentation** - Applications use vanilla OpenTelemetry
❌ **NPM/Maven/PyPI Packages** - BeTrace is a deployed service, not a package

## What BeTrace DOES Provide

✅ **OTLP Endpoint** - Receives traces from any OpenTelemetry SDK
✅ **Web UI** - Configure rules, view signals, investigate patterns
✅ **REST API** - Programmatic rule management
✅ **Pattern Matching Engine** - BeTraceDSL for trace patterns
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
│  BeTrace Service   │ (deployed separately)
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

**BeTrace is a platform you deploy and point your OpenTelemetry traces to, NOT code you add to your application.**

Your application code only needs standard OpenTelemetry instrumentation pointing to BeTrace's OTLP endpoint.
