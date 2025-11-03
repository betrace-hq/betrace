# BeTrace for SigNoz

**Status**: v1.0 Implementation
**Platform**: SigNoz (OpenTelemetry-native)

BeTrace integration for SigNoz - behavioral pattern matching on OpenTelemetry traces.

---

## Architecture

BeTrace for SigNoz consists of:

1. **Standalone React UI** - Rule management interface
2. **BeTrace Backend** - Rule engine and violation detection (shared with Grafana plugin)
3. **Custom OTEL Receiver** - Ingests violations into SigNoz

```
┌──────────────────┐
│ BeTrace UI       │ ← React app (this directory)
│ (Port 3001)      │
└────────┬─────────┘
         ↓ HTTP REST
┌──────────────────┐
│ BeTrace Backend  │ ← Shared Go backend
│ (Port 12011)     │
└────────┬─────────┘
         ↓ OTLP
┌──────────────────┐
│ SigNoz Collector │ ← Custom receiver
└────────┬─────────┘
         ↓
┌──────────────────┐
│ SigNoz Backend   │ ← ClickHouse
└──────────────────┘
```

---

## Quick Start

### 1. Install Dependencies
```bash
cd signoz-betrace-app
npm install
```

### 2. Start BeTrace Backend
```bash
# From project root
cd backend
PORT=12011 go run ./cmd/betrace-backend
```

### 3. Start SigNoz UI
```bash
npm run dev
# Access: http://localhost:3001
```

### 4. Configure Backend Connection
- Open http://localhost:3001
- Navigate to Settings
- Set Backend URL: http://localhost:12011
- Click "Test Connection"

---

## Features

### Rules Management
- Create/Edit/Delete rules with BeTraceDSL
- Monaco editor with syntax highlighting
- Real-time validation
- Rule testing interface

### Violations View
- Query violations from backend
- Filter by severity, time range
- Export to CSV
- Deep link to SigNoz trace explorer

### Integration with SigNoz
- Violations appear as spans in SigNoz traces
- Queryable via SigNoz UI
- Alert on critical violations
- Dashboard metrics

---

## Development

### Directory Structure
```
signoz-betrace-app/
├── src/
│   ├── pages/          # Page components
│   ├── components/     # Reusable components
│   ├── services/       # API clients
│   └── lib/            # Utilities
├── public/             # Static assets
└── tests/              # Tests
```

### Shared Components
This app reuses components from grafana-betrace-app:
- MonacoRuleEditor
- RuleList
- ViolationList
- Effect-based API clients

---

## Configuration

### Environment Variables
```bash
VITE_BETRACE_BACKEND_URL=http://localhost:12011
VITE_APP_PORT=3001
```

### Backend API
BeTrace UI connects to shared backend:
- `GET /api/rules` - List rules
- `POST /api/rules` - Create rule
- `GET /api/violations` - Query violations

---

## Testing

```bash
# Run tests
npm test

# E2E tests
npm run test:e2e
```

---

## Deployment

### With Docker
```bash
docker build -t betrace-signoz-ui .
docker run -p 3001:3001 -e VITE_BETRACE_BACKEND_URL=http://backend:12011 betrace-signoz-ui
```

### With SigNoz Stack
Deploy alongside SigNoz:
```yaml
# docker-compose.yml
services:
  betrace-ui:
    image: betrace-signoz-ui:latest
    ports:
      - "3001:3001"
    environment:
      VITE_BETRACE_BACKEND_URL: http://betrace-backend:12011

  betrace-backend:
    image: betrace-backend:latest
    ports:
      - "12011:12011"
```

---

## Documentation

- [SigNoz Integration Guide](../docs/integration/signoz-integration-guide.md)
- [BeTrace DSL Reference](../docs/betrace-dsl-reference.md)
- [API Reference](../docs/API_REFERENCE.md)

---

## License

Apache 2.0
