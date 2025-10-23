# ADR-027: BeTrace as Grafana App Plugin

## Status
**Accepted** - 2025-01-22

## Context

BeTrace originally had a standalone React frontend (BFF) for:
- Rule management UI (CRUD BeTraceDSL rules)
- Violation dashboard
- Compliance evidence queries
- Notification configuration
- Tenant administration

**Total**: ~3,000 LOC custom React application

After adopting Grafana-First Architecture (ADR-022), we need to determine how BeTrace integrates with Grafana as plugins.

**Grafana Plugin Types**:
1. **App Plugin**: Full application UI within Grafana
2. **Datasource Plugin**: Query external data sources
3. **Panel Plugin**: Custom visualization panels

**BeTrace Requirements**:
- ✅ Rule management UI (CRUD BeTraceDSL rules)
- ✅ Query violations for alerting/dashboards
- ❌ Custom visualization (use Grafana panels)
- ❌ Compliance queries (use Tempo datasource)

## Decision

We implement BeTrace as **two Grafana plugins**:

### 1. BeTrace App Plugin (Rule Management)
**Purpose**: Manage BeTraceDSL rules within Grafana

**Features**:
- Rule CRUD operations
- Monaco editor for DSL syntax
- Real-time DSL validation
- Rule testing with sample traces
- Rule history/versioning

**Location**: `/plugins/fluo/rules` in Grafana

### 2. BeTrace Datasource Plugin (Violation Queries)
**Purpose**: Query violations from BeTrace backend

**Features**:
- Query violations by severity, rule, time range
- Return TraceQL-compatible results
- Enable Grafana Explore, dashboards, alerts
- Link violations to Tempo traces

**Integration**: Query editor in Grafana Explore, dashboard panels

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Grafana                              │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │      BeTrace App Plugin                 │              │
│  │      /plugins/fluo                   │              │
│  │                                      │              │
│  │  Pages:                              │              │
│  │  - /plugins/fluo/rules (Rule CRUD)   │              │
│  │                                      │              │
│  │  Components:                         │              │
│  │  - RuleEditor (Monaco DSL editor)    │              │
│  │  - RuleList (CRUD UI)                │              │
│  │  - RuleTest (Test with sample traces)│              │
│  │                                      │              │
│  │  API: /api/rules (BeTrace backend)      │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │   BeTrace Datasource Plugin             │              │
│  │                                      │              │
│  │  Backend (Go):                       │              │
│  │  - Query /api/violations             │              │
│  │  - Return Grafana data frames        │              │
│  │                                      │              │
│  │  Frontend (TypeScript):              │              │
│  │  - Query editor in Explore           │              │
│  │  - Severity, ruleId, timeRange       │              │
│  │                                      │              │
│  │  Used In:                            │              │
│  │  - Grafana Explore                   │              │
│  │  - Dashboards (panels)               │              │
│  │  - Alerting (TraceQL queries)        │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  ┌──────────────────────────────────────┐              │
│  │   Tempo Datasource (Built-in)        │              │
│  │   - Query application traces         │              │
│  │   - Query compliance spans           │              │
│  │   - Link from violations to traces   │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                 BeTrace Backend                            │
│  API:                                                    │
│  - /api/violations (query violations)                   │
│  - /api/rules (CRUD rules)                              │
└─────────────────────────────────────────────────────────┘
```

## Plugin 1: BeTrace App Plugin

### Installation

```bash
# Install via grafana-cli
grafana-cli plugins install fluo-app

# Or install from local build
cp -r dist /var/lib/grafana/plugins/fluo-app
systemctl restart grafana-server
```

### plugin.json

```json
{
  "type": "app",
  "name": "BeTrace",
  "id": "fluo-app",
  "info": {
    "description": "Behavioral assurance for OpenTelemetry traces - BeTraceDSL rule management",
    "author": {
      "name": "BeTrace",
      "url": "https://betrace.dev"
    },
    "keywords": ["observability", "opentelemetry", "compliance", "fluo", "dsl"],
    "version": "1.0.0",
    "updated": "2025-01-22",
    "logos": {
      "small": "img/logo.svg",
      "large": "img/logo.svg"
    },
    "screenshots": [
      { "name": "Rules Page", "path": "img/rules-page.png" },
      { "name": "DSL Editor", "path": "img/dsl-editor.png" }
    ]
  },
  "includes": [
    {
      "type": "page",
      "name": "Rules",
      "path": "/a/fluo-app",
      "role": "Editor",
      "addToNav": true,
      "defaultNav": true,
      "icon": "shield"
    }
  ],
  "dependencies": {
    "grafanaDependency": ">=9.0.0",
    "plugins": []
  }
}
```

### App Plugin Pages

**1. Rules Page** (`/plugins/fluo/rules`):
```typescript
// src/pages/RulesPage.tsx
import React, { useEffect, useState } from 'react';
import { AppRootProps } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { RuleEditor } from '../components/RuleEditor';
import { RuleList } from '../components/RuleList';

export const RulesPage = (props: AppRootProps) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  useEffect(() => {
    // Fetch rules from BeTrace backend
    fetchRules().then(setRules);
  }, []);

  const handleSaveRule = async (rule: Rule) => {
    await saveRule(rule);
    setRules(await fetchRules());
  };

  return (
    <div className="fluo-rules-page">
      <RuleList
        rules={rules}
        onSelect={setSelectedRule}
        onCreate={() => setSelectedRule(createEmptyRule())}
      />
      {selectedRule && (
        <RuleEditor
          rule={selectedRule}
          onSave={handleSaveRule}
          onCancel={() => setSelectedRule(null)}
        />
      )}
    </div>
  );
};
```

**2. Configuration Page** (optional):
```typescript
// src/pages/ConfigPage.tsx
export const ConfigPage = () => {
  return (
    <div>
      <h2>BeTrace Configuration</h2>
      <Field label="BeTrace Backend URL">
        <Input value={config.backendUrl} onChange={...} />
      </Field>
    </div>
  );
};
```

### Components

**Rule Editor** (Monaco DSL Editor):
```typescript
// src/components/RuleEditor.tsx
import Editor from '@monaco-editor/react';

export const RuleEditor: React.FC<{
  rule: Rule;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}> = ({ rule, onSave, onCancel }) => {
  const [dsl, setDsl] = useState(rule.dsl);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleValidate = async () => {
    const result = await validateDsl(dsl);
    setValidationError(result.error);
  };

  return (
    <div className="rule-editor">
      <Input
        label="Rule Name"
        value={rule.name}
        onChange={e => setRule({ ...rule, name: e.currentTarget.value })}
      />

      <Editor
        height="400px"
        language="javascript"  // DSL syntax highlighting
        value={dsl}
        onChange={value => setDsl(value || '')}
        onBlur={handleValidate}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          theme: 'vs-dark',
        }}
      />

      {validationError && <Alert severity="error">{validationError}</Alert>}

      <Button onClick={() => onSave({ ...rule, dsl })}>Save Rule</Button>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
    </div>
  );
};
```

**Rule List**:
```typescript
// src/components/RuleList.tsx
export const RuleList: React.FC<{
  rules: Rule[];
  onSelect: (rule: Rule) => void;
  onCreate: () => void;
}> = ({ rules, onSelect, onCreate }) => {
  return (
    <div className="rule-list">
      <div className="rule-list-header">
        <h2>BeTraceDSL Rules</h2>
        <Button onClick={onCreate}>New Rule</Button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Enabled</th>
            <th>Last Modified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(rule => (
            <tr key={rule.id} onClick={() => onSelect(rule)}>
              <td>{rule.name}</td>
              <td><Switch checked={rule.enabled} /></td>
              <td>{formatDate(rule.updatedAt)}</td>
              <td>
                <IconButton name="edit" onClick={() => onSelect(rule)} />
                <IconButton name="trash-alt" onClick={() => deleteRule(rule.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

## Plugin 2: BeTrace Datasource Plugin

### Installation

```bash
grafana-cli plugins install fluo-datasource
```

### plugin.json

```json
{
  "type": "datasource",
  "name": "BeTrace",
  "id": "fluo-datasource",
  "metrics": true,
  "logs": false,
  "backend": true,
  "executable": "gpx_fluo-datasource",
  "info": {
    "description": "Query BeTrace violations for alerting and dashboards",
    "author": {
      "name": "BeTrace"
    },
    "version": "1.0.0",
    "logos": {
      "small": "img/logo.svg",
      "large": "img/logo.svg"
    }
  },
  "dependencies": {
    "grafanaDependency": ">=9.0.0"
  }
}
```

### Datasource Backend (Go)

```go
// pkg/plugin.go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"

    "github.com/grafana/grafana-plugin-sdk-go/backend"
    "github.com/grafana/grafana-plugin-sdk-go/data"
)

type FluoDatasource struct {
    settings backend.DataSourceInstanceSettings
}

func (ds *FluoDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
    response := backend.NewQueryDataResponse()

    for _, query := range req.Queries {
        // Parse query JSON
        var qm QueryModel
        json.Unmarshal(query.JSON, &qm)

        // Query BeTrace backend /api/violations
        violations, err := ds.queryViolations(qm, query.TimeRange)
        if err != nil {
            response.Responses[query.RefID] = backend.DataResponse{
                Error: err,
            }
            continue
        }

        // Build Grafana data frame
        frame := data.NewFrame("violations",
            data.NewField("time", nil, []time.Time{}),
            data.NewField("severity", nil, []string{}),
            data.NewField("rule_id", nil, []string{}),
            data.NewField("rule_name", nil, []string{}),
            data.NewField("message", nil, []string{}),
            data.NewField("trace_id", nil, []string{}),
        )

        for _, v := range violations {
            frame.AppendRow(v.Timestamp, v.Severity, v.RuleId, v.RuleName, v.Message, v.TraceId)
        }

        response.Responses[query.RefID] = backend.DataResponse{
            Frames: []*data.Frame{frame},
        }
    }

    return response, nil
}

func (ds *FluoDatasource) queryViolations(qm QueryModel, timeRange backend.TimeRange) ([]Violation, error) {
    // Construct query URL
    url := fmt.Sprintf("%s/api/violations?severity=%s&ruleId=%s&from=%d&to=%d",
        ds.settings.URL, qm.Severity, qm.RuleId,
        timeRange.From.Unix(), timeRange.To.Unix())

    // HTTP GET request
    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Violations []Violation `json:"violations"`
    }
    json.NewDecoder(resp.Body).Decode(&result)

    return result.Violations, nil
}

type QueryModel struct {
    Severity string `json:"severity"`
    RuleId   string `json:"ruleId"`
}

type Violation struct {
    Timestamp time.Time `json:"timestamp"`
    Severity  string    `json:"severity"`
    RuleId    string    `json:"ruleId"`
    RuleName  string    `json:"ruleName"`
    Message   string    `json:"message"`
    TraceId   string    `json:"traceId"`
}
```

### Datasource Frontend (TypeScript)

```typescript
// src/datasource.ts
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

export class FluoDatasource extends DataSourceApi<FluoQuery> {
  url: string;

  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
    this.url = instanceSettings.url || '';
  }

  async query(options: DataQueryRequest<FluoQuery>): Promise<DataQueryResponse> {
    // Queries handled by backend plugin (Go)
    return this.getBackendSrv().fetch({
      url: '/api/ds/query',
      method: 'POST',
      data: {
        queries: options.targets,
      },
    }).toPromise();
  }

  async testDatasource() {
    try {
      const response = await fetch(`${this.url}/api/health`);
      if (response.ok) {
        return {
          status: 'success',
          message: 'BeTrace datasource is working',
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to connect to BeTrace backend',
      };
    }
  }
}
```

**Query Editor**:
```typescript
// src/QueryEditor.tsx
import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { Input, Select, InlineField } from '@grafana/ui';

export const QueryEditor: React.FC<QueryEditorProps<FluoDatasource, FluoQuery>> = ({
  query,
  onChange,
  onRunQuery,
}) => {
  const severityOptions = [
    { label: 'All', value: '' },
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'High', value: 'HIGH' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'Low', value: 'LOW' },
  ];

  return (
    <div>
      <InlineField label="Severity">
        <Select
          options={severityOptions}
          value={query.severity || ''}
          onChange={v => {
            onChange({ ...query, severity: v.value });
            onRunQuery();
          }}
        />
      </InlineField>

      <InlineField label="Rule ID">
        <Input
          value={query.ruleId || ''}
          onChange={e => onChange({ ...query, ruleId: e.currentTarget.value })}
          onBlur={onRunQuery}
        />
      </InlineField>
    </div>
  );
};
```

## User Workflows

### Workflow 1: Create BeTraceDSL Rule

1. Navigate to `/plugins/fluo/rules` in Grafana
2. Click "New Rule"
3. Enter rule name: "Missing Audit Log"
4. Write BeTraceDSL in Monaco editor:
   ```javascript
   trace.has(pii.access) and not trace.has(audit.log)
   ```
5. Click "Save Rule"
6. Rule is stored in BeTrace backend (`/api/rules`)

### Workflow 2: Query Violations in Explore

1. Open Grafana Explore
2. Select "BeTrace" datasource
3. Set severity filter: "CRITICAL"
4. Set time range: "Last 24 hours"
5. View violations table
6. Click trace ID to view in Tempo

### Workflow 3: Create Alert on Violations

1. Navigate to Grafana Alerting
2. Create new alert rule
3. Query: `{span.fluo.violation.severity = "CRITICAL"}` (TraceQL on Tempo datasource)
4. Contact point: PagerDuty
5. Save alert rule

### Workflow 4: Dashboard with Violations

1. Create new Grafana dashboard
2. Add panel with BeTrace datasource
3. Query: severity = "HIGH"
4. Visualization: Table
5. Columns: Time, Rule Name, Message, Trace ID
6. Save dashboard

## Deployment

### Build Plugins

```bash
# Build app plugin
cd grafana-betrace-app
npm install
npm run build
npm run sign

# Build datasource plugin
cd grafana-fluo-datasource
npm install
mage build
npx @grafana/sign-plugin
```

### Install Plugins

**Option 1: grafana-cli**:
```bash
grafana-cli plugins install fluo-app
grafana-cli plugins install fluo-datasource
systemctl restart grafana-server
```

**Option 2: Docker Volume Mount**:
```yaml
# docker-compose.yml
services:
  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./grafana-betrace-app/dist:/var/lib/grafana/plugins/fluo-app
      - ./grafana-fluo-datasource/dist:/var/lib/grafana/plugins/fluo-datasource
    ports:
      - 3000:3000
```

**Option 3: Kubernetes ConfigMap**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-plugins
data:
  fluo-app.zip: <base64-encoded-plugin>
  fluo-datasource.zip: <base64-encoded-plugin>
```

### Configure Datasource

```yaml
# Grafana provisioning (datasources.yaml)
apiVersion: 1
datasources:
  - name: BeTrace
    type: fluo-datasource
    access: proxy
    url: http://fluo-backend:8080
    isDefault: false
    jsonData:
      backendUrl: http://fluo-backend:8080
    secureJsonData:
      apiToken: ${BeTrace_API_TOKEN}
```

## What Gets Removed from BeTrace

### BFF (React Frontend) Removed (~3,000 LOC)

**Components Removed**:
- `rules/rules-page.tsx` (~400 LOC) → ✅ Replaced by Grafana App Plugin
- `violations/violation-dashboard.tsx` (~300 LOC) → ✅ Replaced by Grafana Datasource + Explore
- `compliance/compliance-dashboard.tsx` (~300 LOC) → ❌ Removed (use Tempo)
- `notifications/notification-config.tsx` (~200 LOC) → ❌ Removed (use Grafana Alerting)
- `tenants/tenant-admin.tsx` (~400 LOC) → ❌ Removed (single-tenant)

**Infrastructure Removed**:
- Vite build config (~100 LOC)
- Tanstack Router config (~100 LOC)
- shadcn/ui components (~200 LOC)
- Authentication context (~200 LOC)
- API client (~300 LOC)

**Total BFF Removal**: ~2,500 LOC

### Backend Routes Simplified

**Before** (7 routes):
- `/api/rules` (CRUD rules)
- `/api/violations` (query violations)
- `/api/compliance/evidence` (compliance queries)
- `/api/tenants` (tenant management)
- `/api/notifications` (notification config)
- `/api/signatures/verify` (signature verification)
- `/api/auth` (authentication)

**After** (2 routes):
- `/api/rules` (CRUD rules)
- `/api/violations` (query violations)

**Backend Removal**: ~500 LOC

## Consequences

### Positive

1. **Reduced Complexity**: Remove ~3,000 LOC custom React frontend
2. **Better UX**: Users work in familiar Grafana interface
3. **Easier Installation**: `grafana-cli plugins install fluo`
4. **Ecosystem Integration**: BeTrace discoverable in Grafana plugin catalog

### Negative

1. **Plugin Development**: Team must learn Grafana plugin SDK (Go + TypeScript)
2. **Grafana Dependency**: BeTrace requires Grafana (not standalone)
3. **Breaking Change**: Existing BeTrace UI users must migrate to Grafana

### Mitigation Strategies

1. **Skills**: Create `.skills/grafana-plugin/` skill ✅
2. **Migration Guide**: Document BFF → Grafana plugin migration
3. **Gradual Deprecation**: Maintain BFF for 6 months during transition

## Alternatives Considered

### 1. Keep Standalone React BFF
**Rejected**: Duplicates Grafana UI, adds deployment friction

### 2. Embed Grafana in BeTrace
**Rejected**: Grafana is 10x larger than BeTrace, doesn't reduce complexity

### 3. Only Datasource Plugin (No App Plugin)
**Rejected**: Users need UI for rule management

## References

- **Grafana App Plugins**: https://grafana.com/docs/grafana/latest/developers/plugins/create-a-grafana-plugin/develop-a-plugin/build-an-app-plugin/
- **Grafana Datasource Plugins**: https://grafana.com/docs/grafana/latest/developers/plugins/create-a-grafana-plugin/develop-a-plugin/build-a-data-source-plugin/
- **Grafana Plugin SDK for Go**: https://github.com/grafana/grafana-plugin-sdk-go
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/
- **Related ADRs**:
  - ADR-022: Grafana-First Architecture
  - ADR-026: BeTrace Core Competencies
- **Skills**:
  - `.skills/grafana-plugin/` - Grafana plugin development patterns
