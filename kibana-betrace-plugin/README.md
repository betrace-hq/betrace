# BeTrace for Kibana

**Status**: v1.0 Implementation
**Platform**: Kibana (Elastic Stack)

BeTrace plugin for Kibana - behavioral pattern matching on OpenTelemetry traces.

---

## Architecture

BeTrace for Kibana consists of:

1. **Kibana Plugin** - Rule management UI integrated into Kibana
2. **BeTrace Backend** - Rule engine and violation detection (shared with Grafana/SigNoz)
3. **Elasticsearch Integration** - Violations indexed as documents

```
┌──────────────────┐
│ Kibana Plugin    │ ← Kibana app (this directory)
│                  │
└────────┬─────────┘
         ↓ HTTP REST
┌──────────────────┐
│ BeTrace Backend  │ ← Shared Go backend
│ (Port 12011)     │
└────────┬─────────┘
         ↓ REST/Bulk API
┌──────────────────┐
│ Elasticsearch    │ ← Violations as documents
└──────────────────┘
```

---

## Quick Start

### 1. Install Dependencies
```bash
cd kibana-betrace-plugin
npm install
```

### 2. Start BeTrace Backend
```bash
# From project root
cd backend
PORT=12011 go run ./cmd/betrace-backend
```

### 3. Build Plugin
```bash
npm run build
# Creates installable .zip in build/
```

### 4. Install in Kibana
```bash
# Install plugin
bin/kibana-plugin install file:///path/to/betrace-plugin.zip

# Start Kibana
bin/kibana
```

### 5. Configure Backend Connection
- Open Kibana
- Navigate to BeTrace app
- Go to Settings
- Set Backend URL: http://localhost:12011
- Click "Test Connection"

---

## Features

### Rules Management
- Create/Edit/Delete rules with BeTraceDSL
- Real-time validation
- Rule testing interface

### Violations View
- Query violations from backend
- Filter by severity, time range
- Export to CSV
- Deep link to APM traces

### Integration with Kibana
- Violations appear as Elasticsearch documents
- Queryable via Kibana Discover
- Alert on critical violations
- Dashboard metrics via Lens

---

## Development

### Directory Structure
```
kibana-betrace-plugin/
├── public/            # Client-side code
│   ├── application.tsx
│   ├── components/
│   ├── pages/
│   └── services/
├── server/            # Server-side code
│   ├── plugin.ts
│   ├── routes/
│   └── types.ts
├── common/            # Shared types
└── kibana.json        # Plugin manifest
```

### Shared Components
This plugin reuses components from grafana-betrace-app:
- MonacoRuleEditor
- RuleList
- ViolationList
- Effect-based API clients

---

## Configuration

### Environment Variables
```bash
BETRACE_BACKEND_URL=http://localhost:12011
ELASTICSEARCH_HOSTS=http://localhost:9200
```

### Backend API
BeTrace plugin connects to shared backend:
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

### With Kibana Docker
```bash
# Build plugin
npm run build

# Create Dockerfile extending Kibana
FROM docker.elastic.co/kibana/kibana:8.11.0
COPY build/betrace-*.zip /tmp/
RUN bin/kibana-plugin install file:///tmp/betrace-*.zip
```

### With Elastic Cloud
1. Build plugin: `npm run build`
2. Upload to Elastic Cloud via UI
3. Restart Kibana instances

---

## Documentation

- [Kibana Plugin Guide](../docs/integration/kibana-integration-guide.md)
- [BeTrace DSL Reference](../docs/betrace-dsl-reference.md)
- [API Reference](../docs/API_REFERENCE.md)

---

## License

Apache 2.0
