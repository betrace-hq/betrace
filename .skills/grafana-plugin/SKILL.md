---
name: Grafana Plugin Development
category: Implementation
difficulty: Advanced
prerequisites:
  - React/TypeScript
  - Grafana concepts
  - REST API design
tags:
  - grafana
  - plugin
  - react
  - typescript
success_metrics:
  - Plugin installable via grafana-cli
  - Plugin discoverable in Grafana catalog
  - UI matches Grafana look-and-feel
  - Works in Grafana Explore, dashboards, alerts
---

# Grafana Plugin Development Skill

## Quick Reference

### Plugin Types

| Type | Purpose | Use Case | Examples |
|------|---------|----------|----------|
| **App Plugin** | Full application UI | Multi-page features, settings | k6 Cloud, Synthetic Monitoring |
| **Datasource Plugin** | Query external data | Custom query languages | Tempo, Loki, Prometheus |
| **Panel Plugin** | Custom visualization | Domain-specific viz | Geomap, Node Graph |

### FLUO Plugin Architecture

```
FLUO Grafana Integration
├── App Plugin (fluo-app)
│   └── /plugins/fluo/rules - Rule management UI
└── Datasource Plugin (fluo-datasource)
    └── Query violations via /api/violations
```

## Development Patterns

### 1. App Plugin (Rule Management UI)

#### Project Structure

```
grafana-fluo-app/
├── src/
│   ├── components/
│   │   ├── RuleEditor.tsx      # Monaco editor for FluoDSL
│   │   ├── RuleList.tsx        # CRUD UI for rules
│   │   └── RuleTest.tsx        # Test rules with sample traces
│   ├── pages/
│   │   ├── RulesPage.tsx       # Main rules page
│   │   └── ConfigPage.tsx      # Plugin configuration
│   ├── module.ts               # Plugin entry point
│   └── plugin.json             # Plugin metadata
├── package.json
└── README.md
```

#### plugin.json

```json
{
  "type": "app",
  "name": "FLUO",
  "id": "fluo-app",
  "info": {
    "description": "Behavioral assurance for OpenTelemetry traces",
    "author": {
      "name": "FLUO",
      "url": "https://fluo.dev"
    },
    "keywords": ["observability", "opentelemetry", "compliance"],
    "version": "1.0.0",
    "updated": "2025-01-22"
  },
  "includes": [
    {
      "type": "page",
      "name": "Rules",
      "path": "/a/fluo-app",
      "role": "Editor",
      "addToNav": true,
      "defaultNav": true
    }
  ],
  "dependencies": {
    "grafanaDependency": ">=9.0.0",
    "plugins": []
  }
}
```

#### App Plugin Component (RulesPage.tsx)

```typescript
import React, { useEffect, useState } from 'react';
import { AppRootProps } from '@grafana/data';
import { Button, Input, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import Editor from '@monaco-editor/react';

interface Rule {
  id: string;
  name: string;
  dsl: string;
  enabled: boolean;
}

export const RulesPage = (props: AppRootProps) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const styles = useStyles2(getStyles);

  // Fetch rules from FLUO backend
  useEffect(() => {
    fetch('/api/rules')
      .then(res => res.json())
      .then(data => setRules(data))
      .catch(err => console.error('Failed to fetch rules', err));
  }, []);

  const handleSaveRule = async () => {
    if (!selectedRule) return;

    await fetch(`/api/rules/${selectedRule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedRule),
    });

    // Refresh rules list
    const updated = await fetch('/api/rules').then(res => res.json());
    setRules(updated);
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <h2>Rules</h2>
        <Button onClick={() => setSelectedRule({ id: '', name: '', dsl: '', enabled: true })}>
          New Rule
        </Button>
        <ul>
          {rules.map(rule => (
            <li key={rule.id} onClick={() => setSelectedRule(rule)}>
              {rule.name} {rule.enabled ? '✓' : '✗'}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.editor}>
        {selectedRule && (
          <>
            <Input
              value={selectedRule.name}
              onChange={e => setSelectedRule({ ...selectedRule, name: e.currentTarget.value })}
              placeholder="Rule name"
            />
            <Editor
              height="400px"
              language="javascript"
              value={selectedRule.dsl}
              onChange={value => setSelectedRule({ ...selectedRule, dsl: value || '' })}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
              }}
            />
            <Button onClick={handleSaveRule}>Save Rule</Button>
          </>
        )}
      </div>
    </div>
  );
};

const getStyles = () => ({
  container: css`
    display: flex;
    height: 100%;
  `,
  sidebar: css`
    width: 250px;
    border-right: 1px solid #333;
    padding: 16px;
  `,
  editor: css`
    flex: 1;
    padding: 16px;
  `,
});
```

#### module.ts (App Plugin Entry Point)

```typescript
import { AppPlugin } from '@grafana/data';
import { RulesPage } from './pages/RulesPage';
import { ConfigPage } from './pages/ConfigPage';

export const plugin = new AppPlugin<{}>()
  .setRootPage(RulesPage)
  .addConfigPage({
    title: 'Configuration',
    icon: 'cog',
    body: ConfigPage,
    id: 'config',
  });
```

### 2. Datasource Plugin (Violation Queries)

#### Project Structure

```
grafana-fluo-datasource/
├── src/
│   ├── datasource.ts           # Datasource implementation
│   ├── QueryEditor.tsx         # Query UI in Explore
│   ├── ConfigEditor.tsx        # Datasource config UI
│   ├── module.ts               # Plugin entry point
│   └── plugin.json             # Plugin metadata
├── pkg/                        # Backend (Go)
│   ├── main.go
│   └── plugin.go
├── package.json
└── README.md
```

#### plugin.json (Datasource)

```json
{
  "type": "datasource",
  "name": "FLUO",
  "id": "fluo-datasource",
  "metrics": true,
  "logs": false,
  "backend": true,
  "executable": "gpx_fluo-datasource",
  "info": {
    "description": "Query FLUO violations",
    "author": {
      "name": "FLUO"
    },
    "version": "1.0.0"
  },
  "dependencies": {
    "grafanaDependency": ">=9.0.0"
  }
}
```

#### datasource.ts

```typescript
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

export interface FluoQuery {
  severity?: string;
  ruleId?: string;
  timeRange?: { from: number; to: number };
}

export class FluoDatasource extends DataSourceApi<FluoQuery> {
  url: string;

  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
    this.url = instanceSettings.url || '';
  }

  async query(options: DataQueryRequest<FluoQuery>): Promise<DataQueryResponse> {
    const promises = options.targets.map(async target => {
      // Build query URL
      const params = new URLSearchParams();
      if (target.severity) params.append('severity', target.severity);
      if (target.ruleId) params.append('ruleId', target.ruleId);
      params.append('from', options.range.from.valueOf().toString());
      params.append('to', options.range.to.valueOf().toString());

      // Query FLUO backend
      const response = await fetch(`${this.url}/api/violations?${params}`);
      const data = await response.json();

      // Convert to Grafana data frame
      const frame = new MutableDataFrame({
        refId: target.refId,
        fields: [
          { name: 'time', type: FieldType.time },
          { name: 'severity', type: FieldType.string },
          { name: 'ruleId', type: FieldType.string },
          { name: 'message', type: FieldType.string },
          { name: 'traceId', type: FieldType.string },
        ],
      });

      data.violations.forEach((v: any) => {
        frame.add({
          time: new Date(v.timestamp).valueOf(),
          severity: v.severity,
          ruleId: v.ruleId,
          message: v.message,
          traceId: v.traceId,
        });
      });

      return frame;
    });

    const data = await Promise.all(promises);
    return { data };
  }

  async testDatasource() {
    try {
      await fetch(`${this.url}/api/health`);
      return {
        status: 'success',
        message: 'FLUO datasource is working',
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to connect to FLUO backend',
      };
    }
  }
}
```

#### QueryEditor.tsx

```typescript
import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { Input, Select } from '@grafana/ui';
import { FluoDatasource, FluoQuery } from './datasource';

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
      <div>
        <label>Severity</label>
        <Select
          options={severityOptions}
          value={query.severity || ''}
          onChange={v => {
            onChange({ ...query, severity: v.value || undefined });
            onRunQuery();
          }}
        />
      </div>

      <div>
        <label>Rule ID</label>
        <Input
          value={query.ruleId || ''}
          onChange={e => {
            onChange({ ...query, ruleId: e.currentTarget.value });
          }}
          onBlur={onRunQuery}
        />
      </div>
    </div>
  );
};
```

#### Backend Datasource (Go)

```go
package main

import (
    "context"
    "encoding/json"
    "net/http"

    "github.com/grafana/grafana-plugin-sdk-go/backend"
    "github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
    "github.com/grafana/grafana-plugin-sdk-go/data"
)

type FluoDatasource struct {
    fluoBackendURL string
}

func (ds *FluoDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
    response := backend.NewQueryDataResponse()

    for _, query := range req.Queries {
        // Parse query JSON
        var qm map[string]interface{}
        json.Unmarshal(query.JSON, &qm)

        severity := qm["severity"].(string)
        ruleId := qm["ruleId"].(string)

        // Query FLUO backend
        violations, err := ds.queryViolations(severity, ruleId, query.TimeRange)
        if err != nil {
            response.Responses[query.RefID] = backend.DataResponse{
                Error: err,
            }
            continue
        }

        // Build data frame
        frame := data.NewFrame("violations",
            data.NewField("time", nil, []time.Time{}),
            data.NewField("severity", nil, []string{}),
            data.NewField("ruleId", nil, []string{}),
            data.NewField("message", nil, []string{}),
            data.NewField("traceId", nil, []string{}),
        )

        for _, v := range violations {
            frame.AppendRow(v.Timestamp, v.Severity, v.RuleId, v.Message, v.TraceId)
        }

        response.Responses[query.RefID] = backend.DataResponse{
            Frames: []*data.Frame{frame},
        }
    }

    return response, nil
}

func (ds *FluoDatasource) queryViolations(severity, ruleId string, timeRange backend.TimeRange) ([]Violation, error) {
    // HTTP call to FLUO backend /api/violations
    url := fmt.Sprintf("%s/api/violations?severity=%s&ruleId=%s&from=%d&to=%d",
        ds.fluoBackendURL, severity, ruleId, timeRange.From.Unix(), timeRange.To.Unix())

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

type Violation struct {
    Timestamp time.Time `json:"timestamp"`
    Severity  string    `json:"severity"`
    RuleId    string    `json:"ruleId"`
    Message   string    `json:"message"`
    TraceId   string    `json:"traceId"`
}
```

## Grafana UI Components

### Common Components

```typescript
import {
  Button,
  Input,
  Select,
  Switch,
  Field,
  InlineField,
  InlineFieldRow,
  Alert,
  Badge,
  Card,
  IconButton,
  Modal,
  useTheme2,
  useStyles2,
} from '@grafana/ui';

// Example: Form with validation
const RuleForm = () => {
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);

  return (
    <div>
      <Field label="Rule Name" description="Unique identifier for this rule">
        <Input value={name} onChange={e => setName(e.currentTarget.value)} />
      </Field>

      <Field label="Enabled">
        <Switch value={enabled} onChange={e => setEnabled(e.currentTarget.checked)} />
      </Field>

      <Button>Save Rule</Button>
    </div>
  );
};
```

### Styling with Emotion

```typescript
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(2)};
    background: ${theme.colors.background.primary};
  `,
  title: css`
    font-size: ${theme.typography.h2.fontSize};
    color: ${theme.colors.text.primary};
  `,
  button: css`
    margin-top: ${theme.spacing(2)};
  `,
});

const MyComponent = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>FLUO Rules</h2>
      <button className={styles.button}>Add Rule</button>
    </div>
  );
};
```

## Plugin Development Workflow

### 1. Scaffold Plugin

```bash
# Install Grafana plugin tools
npm install -g @grafana/toolkit

# Scaffold app plugin
npx @grafana/create-plugin --pluginType=app

# Scaffold datasource plugin
npx @grafana/create-plugin --pluginType=datasource
```

### 2. Local Development

```bash
# Start dev server
npm run dev

# Build plugin
npm run build

# Sign plugin (for distribution)
npx @grafana/sign-plugin
```

### 3. Install Plugin Locally

```bash
# Copy plugin to Grafana plugins directory
cp -r dist /var/lib/grafana/plugins/fluo-app

# Restart Grafana
systemctl restart grafana-server

# Or run Grafana in Docker with plugin mounted
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/dist:/var/lib/grafana/plugins/fluo-app \
  grafana/grafana:latest
```

### 4. Test Plugin

```bash
# Run tests
npm test

# E2E tests with Playwright
npm run e2e
```

## Common Patterns

### Pattern 1: Query Backend API from Plugin

```typescript
// Use Grafana's data source proxy to avoid CORS
const response = await fetch('/api/datasources/proxy/1/api/violations', {
  headers: {
    'Authorization': `Bearer ${config.jsonData.apiToken}`,
  },
});

// Or use backend plugin SDK (Go)
resp, err := http.Get(config.URL + "/api/violations")
```

### Pattern 2: Handle Time Ranges

```typescript
import { TimeRange } from '@grafana/data';

const handleTimeRangeChange = (timeRange: TimeRange) => {
  const from = timeRange.from.valueOf(); // Unix timestamp (ms)
  const to = timeRange.to.valueOf();

  // Query violations in time range
  fetchViolations({ from, to });
};
```

### Pattern 3: Display Traces with Tempo Links

```typescript
const ViolationTable = ({ violations }: { violations: Violation[] }) => {
  return (
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Severity</th>
          <th>Message</th>
          <th>Trace</th>
        </tr>
      </thead>
      <tbody>
        {violations.map(v => (
          <tr key={v.id}>
            <td>{new Date(v.timestamp).toLocaleString()}</td>
            <td><Badge text={v.severity} color={getSeverityColor(v.severity)} /></td>
            <td>{v.message}</td>
            <td>
              <a href={`/explore?left={"datasource":"tempo","queries":[{"query":"${v.traceId}"}]}`}>
                View in Tempo
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

### Pattern 4: Monaco Editor Integration

```typescript
import Editor from '@monaco-editor/react';

const DslEditor = ({ dsl, onChange }: { dsl: string; onChange: (v: string) => void }) => {
  return (
    <Editor
      height="400px"
      language="javascript"  // Use JavaScript syntax highlighting for DSL
      value={dsl}
      onChange={value => onChange(value || '')}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        theme: 'vs-dark',  // Matches Grafana dark theme
      }}
    />
  );
};
```

## Plugin Configuration

### ConfigEditor.tsx (Datasource Config)

```typescript
import React from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Field, Input, SecretInput } from '@grafana/ui';

interface FluoOptions {
  backendUrl?: string;
}

interface FluoSecureOptions {
  apiToken?: string;
}

export const ConfigEditor: React.FC<DataSourcePluginOptionsEditorProps<FluoOptions, FluoSecureOptions>> = ({
  options,
  onOptionsChange,
}) => {
  const { jsonData, secureJsonFields, secureJsonData } = options;

  return (
    <div>
      <Field label="Backend URL" description="FLUO backend API endpoint">
        <Input
          value={jsonData.backendUrl || ''}
          onChange={e =>
            onOptionsChange({
              ...options,
              jsonData: {
                ...jsonData,
                backendUrl: e.currentTarget.value,
              },
            })
          }
        />
      </Field>

      <Field label="API Token" description="Authentication token for FLUO backend">
        <SecretInput
          isConfigured={secureJsonFields?.apiToken}
          value={secureJsonData?.apiToken || ''}
          onChange={e =>
            onOptionsChange({
              ...options,
              secureJsonData: {
                ...secureJsonData,
                apiToken: e.currentTarget.value,
              },
            })
          }
          onReset={() =>
            onOptionsChange({
              ...options,
              secureJsonFields: {
                ...secureJsonFields,
                apiToken: false,
              },
              secureJsonData: {
                ...secureJsonData,
                apiToken: '',
              },
            })
          }
        />
      </Field>
    </div>
  );
};
```

## Security Considerations

### 1. Secure API Tokens

```typescript
// NEVER expose API tokens in frontend code
// Store in secureJsonData, access via backend plugin

// ConfigEditor.tsx (frontend)
<SecretInput
  isConfigured={secureJsonFields?.apiToken}
  value={secureJsonData?.apiToken || ''}
  // ...
/>

// plugin.go (backend)
apiToken := config.DecryptedSecureJSONData["apiToken"]
req.Header.Set("Authorization", "Bearer " + apiToken)
```

### 2. Validate User Input

```typescript
const validateRuleName = (name: string): string | null => {
  if (!name) return 'Rule name is required';
  if (name.length < 3) return 'Rule name must be at least 3 characters';
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return 'Rule name can only contain alphanumeric characters, hyphens, and underscores';
  return null;
};
```

### 3. Sanitize DSL Input

```typescript
const sanitizeDsl = (dsl: string): string => {
  // Remove potentially dangerous patterns
  const dangerous = [
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout/gi,
    /setInterval/gi,
  ];

  for (const pattern of dangerous) {
    if (pattern.test(dsl)) {
      throw new Error('DSL contains dangerous code patterns');
    }
  }

  return dsl;
};
```

## Common Pitfalls

### ❌ Pitfall 1: Not Using Grafana UI Components

```typescript
// WRONG: Custom button styling
<button style={{ background: 'blue', color: 'white' }}>Save</button>

// RIGHT: Use Grafana Button
import { Button } from '@grafana/ui';
<Button>Save</Button>
```

### ❌ Pitfall 2: Hardcoding Backend URL

```typescript
// WRONG: Hardcoded URL
fetch('http://localhost:8080/api/violations')

// RIGHT: Use configured datasource URL
fetch(`${this.url}/api/violations`)
```

### ❌ Pitfall 3: Not Handling Time Zones

```typescript
// WRONG: Assumes local timezone
new Date(timestamp).toString()

// RIGHT: Use Grafana's time formatting
import { dateTimeFormat } from '@grafana/data';
dateTimeFormat(timestamp, { timeZone: 'UTC' })
```

## Plugin Distribution

### 1. Sign Plugin

```bash
# Generate signing key
npx @grafana/sign-plugin --rootUrls http://localhost:3000

# Sign plugin
npx @grafana/sign-plugin
```

### 2. Publish to Grafana Plugin Catalog

```bash
# Create plugin.json with metadata
{
  "id": "fluo-app",
  "type": "app",
  "info": {
    "version": "1.0.0",
    "author": { "name": "FLUO" },
    "keywords": ["observability", "opentelemetry"],
    "screenshots": [
      { "name": "Rules Page", "path": "img/screenshot1.png" }
    ]
  }
}

# Submit to Grafana plugin catalog
# https://grafana.com/docs/grafana/latest/developers/plugins/publish-a-plugin/
```

### 3. Install via grafana-cli

```bash
grafana-cli plugins install fluo-app
grafana-cli plugins install fluo-datasource
```

## References

- **Grafana Plugin Developer Guide**: https://grafana.com/docs/grafana/latest/developers/plugins/
- **Plugin SDK for Go**: https://github.com/grafana/grafana-plugin-sdk-go
- **@grafana/ui Components**: https://developers.grafana.com/ui
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/
- **ADR-027**: FLUO as Grafana App Plugin
