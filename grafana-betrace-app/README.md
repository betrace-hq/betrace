# BeTrace Grafana App Plugin

**Behavioral Assurance for OpenTelemetry Traces**

A Grafana App Plugin for managing BeTraceDSL rules - create, edit, test, and deploy trace pattern matching rules directly in Grafana.

## Status: Phase 2 - Rule Management ✅

**Completed**:
- ✅ Plugin metadata (plugin.json)
- ✅ TypeScript configuration
- ✅ Page structure (RootPage, ConfigPage)
- ✅ Grafana UI component integration
- ✅ **Rule CRUD operations**
  - ✅ RuleList component with interactive table
  - ✅ RuleEditor component with form
  - ✅ Create/Edit/Delete/Toggle enable rules
  - ✅ Backend API integration (http://localhost:12011)
  - ✅ View routing (list ↔ create ↔ edit)

**Next Phases**:
- ⏸️ Phase 3: Monaco editor with BeTraceDSL syntax highlighting
- ⏸️ Phase 4: Rule testing with sample traces
- ⏸️ Phase 5: Validation and error handling
- ⏸️ Phase 6: Polish and production readiness

## Architecture

```
BeTrace Grafana Integration
├── App Plugin (this project)
│   ├── /a/betrace-app - Rule management UI
│   └── /a/betrace-app/config - Plugin configuration
└── Datasource Plugin (future: PRD-031)
    └── Query violations via /api/violations
```

## Development

### Prerequisites

- Node.js ≥18
- Grafana ≥9.0.0 (local or remote instance)
- BeTrace backend running on http://localhost:8080

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
ln -s $(pwd)/dist /var/lib/grafana/plugins/betrace-app

# Restart Grafana
sudo systemctl restart grafana-server

# Or via Docker
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/dist:/var/lib/grafana/plugins/betrace-app \
  --name=grafana \
  grafana/grafana:latest
```

#### Option 2: Grafana CLI (future, requires publication)

```bash
grafana-cli plugins install betrace-app
```

### Accessing the Plugin

1. Navigate to Grafana (http://localhost:3000)
2. Go to Configuration → Plugins
3. Find "BeTrace" in the list
4. Click to view plugin details
5. Click "Enable" if needed
6. Access via sidebar: Apps → BeTrace

## ADR Compliance

- **ADR-022**: Grafana-First Architecture
- **ADR-027**: BeTrace as Grafana App Plugin
- **PRD-030**: Grafana App Plugin Specification

## Features

### ✅ Phase 2: Rule Management (Complete)
- ✅ Rule list with interactive table
- ✅ Create/Edit/Delete rules
- ✅ Toggle enable/disable status
- ✅ Real-time updates from backend API

### ⏸️ Phase 3: Advanced Editing (Planned)
- Monaco editor with BeTraceDSL syntax highlighting
- Autocomplete and validation
- Pattern testing with sample traces

### Phase 3: Monaco Editor
- BeTraceDSL syntax highlighting
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

The BeTrace backend must expose:

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
grafana-betrace-app/
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

- **BeTrace Documentation**: https://betrace.dev/docs
- **Grafana Plugin Development**: https://grafana.com/docs/grafana/latest/developers/plugins/
- **BeTraceDSL Reference**: See `.skills/betrace-dsl/SKILL.md`
