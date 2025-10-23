# FLUO Grafana App Plugin

**Behavioral Assurance for OpenTelemetry Traces**

A Grafana App Plugin for managing FluoDSL rules - create, edit, test, and deploy trace pattern matching rules directly in Grafana.

## Status: Phase 1 - Plugin Skeleton ✅

**Current Implementation**:
- ✅ Plugin metadata (plugin.json)
- ✅ TypeScript configuration
- ✅ Basic page structure (RootPage, ConfigPage)
- ✅ Grafana UI component integration
- ✅ Plugin entry point (module.ts)

**Next Phases**:
- ⏸️ Phase 2: Rule CRUD operations
- ⏸️ Phase 3: Monaco editor with FluoDSL syntax
- ⏸️ Phase 4: Rule testing with sample traces
- ⏸️ Phase 5: Polish and production readiness

## Architecture

```
FLUO Grafana Integration
├── App Plugin (this project)
│   ├── /a/fluo-app - Rule management UI
│   └── /a/fluo-app/config - Plugin configuration
└── Datasource Plugin (future: PRD-031)
    └── Query violations via /api/violations
```

## Development

### Prerequisites

- Node.js ≥18
- Grafana ≥9.0.0 (local or remote instance)
- FLUO backend running on http://localhost:8080

### Setup

```bash
# Install dependencies
npm install

# Build plugin
npm run build

# Development mode (with watch)
npm run dev
```

### Installation

#### Option 1: Local Development

```bash
# Link plugin to Grafana plugins directory
ln -s $(pwd)/dist /var/lib/grafana/plugins/fluo-app

# Restart Grafana
sudo systemctl restart grafana-server

# Or via Docker
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/dist:/var/lib/grafana/plugins/fluo-app \
  --name=grafana \
  grafana/grafana:latest
```

#### Option 2: Grafana CLI (future, requires publication)

```bash
grafana-cli plugins install fluo-app
```

### Accessing the Plugin

1. Navigate to Grafana (http://localhost:3000)
2. Go to Configuration → Plugins
3. Find "FLUO" in the list
4. Click to view plugin details
5. Click "Enable" if needed
6. Access via sidebar: Apps → FLUO

## ADR Compliance

- **ADR-022**: Grafana-First Architecture
- **ADR-027**: FLUO as Grafana App Plugin
- **PRD-030**: Grafana App Plugin Specification

## Features (Planned)

### Phase 2: Rule Management
- Rule list with search/filter
- Create/Edit/Delete rules
- Toggle active/inactive status

### Phase 3: Monaco Editor
- FluoDSL syntax highlighting
- Auto-completion for DSL keywords
- Inline validation errors

### Phase 4: Rule Testing
- Test rules against sample traces
- Display matched spans
- Preview violation messages

### Phase 5: Production Ready
- Error handling and loading states
- Grafana Cloud compatibility
- Plugin screenshot and documentation

## Backend API Requirements

The FLUO backend must expose:

```
GET    /api/rules           # List all rules
POST   /api/rules           # Create new rule
GET    /api/rules/:id       # Get rule by ID
PUT    /api/rules/:id       # Update rule
DELETE /api/rules/:id       # Delete rule
POST   /api/rules/test      # Test rule with sample trace
```

## Project Structure

```
grafana-fluo-app/
├── src/
│   ├── components/          # React components (Phase 2+)
│   ├── pages/
│   │   ├── RootPage.tsx     # Main rules page
│   │   └── ConfigPage.tsx   # Plugin configuration
│   ├── api/                 # Backend API client (Phase 2+)
│   ├── types/               # TypeScript types (Phase 2+)
│   ├── module.ts            # Plugin entry point
│   └── plugin.json          # Plugin metadata
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

See [PRD-030](../docs/prds/PRD-030-grafana-app-plugin.md) for detailed specification and development plan.

## License

Apache-2.0

## Links

- **FLUO Documentation**: https://fluo.dev/docs
- **Grafana Plugin Development**: https://grafana.com/docs/grafana/latest/developers/plugins/
- **FluoDSL Reference**: See `.skills/fluo-dsl/SKILL.md`
