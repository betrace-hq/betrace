# BeTrace Integration with Kibana/Elastic Stack

**Platform:** Kibana + Elastic Stack (Elasticsearch, APM Server)
**Status:** Community Supported
**Difficulty:** ⭐⭐⭐☆☆ (Moderate - 3-4 weeks)
**Last Updated:** 2025-01-23

---

## Executive Summary

### Overview

Kibana is the visualization layer of the **Elastic Stack** (Elasticsearch, Logstash, Kibana, Beats). With native **OpenTelemetry support** via Elastic APM Server, BeTrace integrates naturally into enterprise Elastic deployments.

### Why Kibana/Elastic?

✅ **Enterprise-Grade**: Mature observability platform with RBAC, audit logs, compliance features
✅ **OTLP Native**: Elastic APM Server natively supports OpenTelemetry Protocol
✅ **Rich Visualization**: TSVB, Canvas, Lens, Vega for advanced dashboards
✅ **Powerful Querying**: KQL (Kibana Query Language) + Lucene for complex filters
✅ **Battle-Tested**: Scales to petabytes of data, proven in production

### Integration Effort

| Component | Effort | Complexity |
|-----------|--------|-----------|
| **OTLP Export to APM Server** | 1 week | Low |
| **Custom Ingest Pipeline** | 3-5 days | Medium |
| **Kibana Plugin (Optional)** | 2-3 weeks | High |
| **Testing & Validation** | 3-5 days | Medium |
| **Total** | **3-4 weeks** | **Moderate** |

### Architectural Fit

**Very Good (8/10)** - Elastic APM's OTLP support makes integration straightforward, though plugin development adds complexity.

---

## Architecture Overview

### High-Level Integration

```
┌─────────────────────────────────────────────────────────┐
│  BeTrace Standalone UI (Optional)                      │
│  - Storybook components extracted                      │
│  - MonacoRuleEditor for BeTraceDSL                      │
│  - Rule CRUD interface                                  │
│  - http://betrace-ui:5601/app/betrace                   │
└────────────────┬────────────────────────────────────────┘
                 ↓ (HTTP REST API)
┌─────────────────────────────────────────────────────────┐
│  BeTrace Backend (Go)                                   │
│  - /api/rules (CRUD BeTraceDSL rules)                   │
│  - /api/violations (query violations)                   │
│  - BeTraceDSL engine (Lua-based)                        │
│  - Violation detection                                  │
└────────────────┬────────────────────────────────────────┘
                 ↓ (OTLP/HTTP or gRPC)
┌─────────────────────────────────────────────────────────┐
│  Elastic APM Server                                     │
│  - OTLP Receiver (gRPC: 8200, HTTP: 8200)               │
│  - Custom Ingest Pipeline: traces-apm@custom            │
│  - Index Template: traces-apm-betrace                   │
│  - Enrichment: Add @timestamp, normalize fields         │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│  Elasticsearch                                          │
│  - Index: traces-apm-betrace-{date}                     │
│  - Mapping: Violation schema                            │
│  - ILM Policy: 30-day retention                         │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│  Kibana                                                 │
│  - Discover: Search violations (KQL)                    │
│  - Dashboards: Violation metrics, trends                │
│  - Alerts: Trigger on critical violations               │
│  - (Optional) BeTrace App Plugin: Rule management       │
└─────────────────────────────────────────────────────────┘
```

---

## Integration Options

### Option A: OTLP Export to Elastic APM (Recommended)

**Best for:** Production deployments, teams already using Elastic Stack

**Approach:** Configure BeTrace backend to export violations as OTLP spans to Elastic APM Server, leverage custom ingest pipelines for transformation.

**Advantages:**
- ✅ No custom code (OTLP is standard)
- ✅ Violations appear in APM alongside app traces
- ✅ Leverage Kibana's full feature set (Discover, Dashboards, Alerts)
- ✅ Automatic correlation by trace ID

**Disadvantages:**
- ⚠️ Requires understanding of Elastic ingest pipelines
- ⚠️ APM Server configuration complexity

**Effort:** 1 week

---

### Option B: Custom Kibana Plugin

**Best for:** Teams wanting native Kibana UI for rule management

**Approach:** Build Kibana application plugin (React/TypeScript) that reuses Storybook components for rule CRUD, integrates with Elasticsearch for violation queries.

**Advantages:**
- ✅ Native Kibana experience (seamless integration)
- ✅ Reuse MonacoRuleEditor from Storybook
- ✅ RBAC via Kibana spaces/roles

**Disadvantages:**
- ⚠️ Kibana plugin SDK learning curve
- ⚠️ Requires maintaining plugin across Kibana versions
- ⚠️ More development effort (2-3 weeks)

**Effort:** 2-3 weeks

---

## Option A: OTLP Export to Elastic APM

### Step 1: Configure Elastic APM Server for OTLP

**File: `apm-server.yml`**

```yaml
apm-server:
  # OTLP receivers (BeTrace will send violations here)
  rum:
    enabled: false

  # OTLP gRPC endpoint
  otlp:
    grpc:
      enabled: true
      host: "0.0.0.0:8200"

    # OTLP HTTP endpoint
    http:
      enabled: true
      host: "0.0.0.0:8200"

# Elasticsearch output
output.elasticsearch:
  hosts: ["http://elasticsearch:9200"]
  username: "elastic"
  password: "${ELASTICSEARCH_PASSWORD}"

  # Index lifecycle management
  ilm:
    enabled: true

  # Custom index pattern for BeTrace violations
  index: "traces-apm-betrace-%{+yyyy.MM.dd}"

  # Custom ingest pipeline for violations
  pipeline: "traces-apm@custom"

# Kibana endpoint (for setup)
setup.kibana:
  host: "http://kibana:5601"
  username: "elastic"
  password: "${KIBANA_PASSWORD}"

# Logging
logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/apm-server
```

**Start APM Server:**
```bash
# Docker
docker run -d \
  --name apm-server \
  -p 8200:8200 \
  -v $(pwd)/apm-server.yml:/usr/share/apm-server/apm-server.yml \
  docker.elastic.co/apm/apm-server:8.18.0

# Verify OTLP endpoints
curl http://localhost:8200/  # Health check
```

### Step 2: Create Custom Ingest Pipeline

**Purpose:** Transform OTLP spans into Elasticsearch documents with BeTrace-specific fields.

**Create pipeline via Kibana Dev Tools:**

```json
PUT _ingest/pipeline/traces-apm@custom
{
  "description": "BeTrace violation processing pipeline",
  "processors": [
    {
      "set": {
        "description": "Set document timestamp",
        "field": "@timestamp",
        "value": "{{_ingest.timestamp}}"
      }
    },
    {
      "rename": {
        "description": "Normalize span.attributes.betrace.* to top-level",
        "field": "span.attributes.betrace.violation.id",
        "target_field": "betrace.violation.id",
        "ignore_missing": true
      }
    },
    {
      "rename": {
        "field": "span.attributes.betrace.violation.rule_id",
        "target_field": "betrace.violation.rule_id",
        "ignore_missing": true
      }
    },
    {
      "rename": {
        "field": "span.attributes.betrace.violation.rule_name",
        "target_field": "betrace.violation.rule_name",
        "ignore_missing": true
      }
    },
    {
      "rename": {
        "field": "span.attributes.betrace.violation.severity",
        "target_field": "betrace.violation.severity",
        "ignore_missing": true
      }
    },
    {
      "rename": {
        "field": "span.attributes.betrace.violation.message",
        "target_field": "betrace.violation.message",
        "ignore_missing": true
      }
    },
    {
      "set": {
        "description": "Mark as BeTrace violation",
        "field": "betrace.is_violation",
        "value": true
      }
    },
    {
      "script": {
        "description": "Convert severity to numeric priority",
        "lang": "painless",
        "source": """
          def severity = ctx.betrace?.violation?.severity;
          if (severity == 'CRITICAL') {
            ctx.betrace.violation.priority = 1;
          } else if (severity == 'HIGH') {
            ctx.betrace.violation.priority = 2;
          } else if (severity == 'MEDIUM') {
            ctx.betrace.violation.priority = 3;
          } else if (severity == 'LOW') {
            ctx.betrace.violation.priority = 4;
          }
        """
      }
    },
    {
      "set": {
        "description": "Add service name for APM",
        "field": "service.name",
        "value": "betrace",
        "override": false
      }
    },
    {
      "set": {
        "description": "Add event category",
        "field": "event.category",
        "value": ["observability"]
      }
    },
    {
      "set": {
        "description": "Add event type",
        "field": "event.type",
        "value": ["info"]
      }
    }
  ],
  "on_failure": [
    {
      "set": {
        "field": "_index",
        "value": "failed-{{{ _index }}}"
      }
    },
    {
      "set": {
        "field": "error.message",
        "value": "{{ _ingest.on_failure_message }}"
      }
    }
  ]
}
```

**Test pipeline:**
```json
POST _ingest/pipeline/traces-apm@custom/_simulate
{
  "docs": [
    {
      "_source": {
        "span": {
          "attributes": {
            "betrace.violation.id": "viol-001",
            "betrace.violation.rule_id": "rule-001",
            "betrace.violation.rule_name": "missing_audit_log",
            "betrace.violation.severity": "HIGH",
            "betrace.violation.message": "PII access without audit log"
          }
        },
        "trace": {
          "id": "abc123"
        }
      }
    }
  ]
}
```

### Step 3: Create Index Template

**Define mapping for BeTrace violation documents:**

```json
PUT _index_template/traces-apm-betrace
{
  "index_patterns": ["traces-apm-betrace-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 1,
      "index.lifecycle.name": "betrace-ilm-policy"
    },
    "mappings": {
      "properties": {
        "@timestamp": {
          "type": "date"
        },
        "betrace": {
          "properties": {
            "is_violation": {
              "type": "boolean"
            },
            "violation": {
              "properties": {
                "id": {
                  "type": "keyword"
                },
                "rule_id": {
                  "type": "keyword"
                },
                "rule_name": {
                  "type": "keyword"
                },
                "severity": {
                  "type": "keyword"
                },
                "priority": {
                  "type": "integer"
                },
                "message": {
                  "type": "text",
                  "fields": {
                    "keyword": {
                      "type": "keyword",
                      "ignore_above": 256
                    }
                  }
                },
                "signature": {
                  "type": "keyword"
                }
              }
            }
          }
        },
        "trace": {
          "properties": {
            "id": {
              "type": "keyword"
            }
          }
        },
        "span": {
          "properties": {
            "id": {
              "type": "keyword"
            }
          }
        },
        "service": {
          "properties": {
            "name": {
              "type": "keyword"
            }
          }
        },
        "event": {
          "properties": {
            "category": {
              "type": "keyword"
            },
            "type": {
              "type": "keyword"
            }
          }
        }
      }
    }
  },
  "priority": 500,
  "composed_of": [],
  "version": 1,
  "_meta": {
    "description": "Index template for BeTrace violations"
  }
}
```

### Step 4: Create Index Lifecycle Management Policy

**30-day retention with hot/warm/delete phases:**

```json
PUT _ilm/policy/betrace-ilm-policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_primary_shard_size": "50GB",
            "max_age": "1d"
          },
          "set_priority": {
            "priority": 100
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "set_priority": {
            "priority": 50
          },
          "shrink": {
            "number_of_shards": 1
          },
          "forcemerge": {
            "max_num_segments": 1
          }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

### Step 5: Configure BeTrace Backend for OTLP Export

**Update BeTrace backend to export violations as OTLP spans:**

```go
// backend/pkg/otel/exporter.go
package otel

import (
    "context"
    "time"

    "go.opentelemetry.io/otel/exporters/otlp/otlptrace"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
)

func InitElasticAPMExporter(endpoint string) (*sdktrace.TracerProvider, error) {
    ctx := context.Background()

    // Create OTLP/HTTP exporter (Elastic APM prefers HTTP)
    exporter, err := otlptracehttp.New(ctx,
        otlptracehttp.WithEndpoint(endpoint),
        otlptracehttp.WithInsecure(), // Use WithTLSClientConfig for production
        otlptracehttp.WithURLPath("/intake/v2/otlp/v1/traces"),
    )
    if err != nil {
        return nil, err
    }

    // Create resource
    res, err := resource.New(ctx,
        resource.WithAttributes(
            semconv.ServiceNameKey.String("betrace"),
            semconv.ServiceVersionKey.String("1.0.0"),
        ),
    )
    if err != nil {
        return nil, err
    }

    // Create tracer provider with batching
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter,
            sdktrace.WithMaxQueueSize(1000),
            sdktrace.WithBatchTimeout(5*time.Second),
            sdktrace.WithMaxExportBatchSize(100),
        ),
        sdktrace.WithResource(res),
    )

    return tp, nil
}
```

**Environment variables:**
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=apm-server:8200
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

### Step 6: Deploy with Docker Compose

**File: `docker-compose.elastic.yml`**

```yaml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.18.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - es-data:/usr/share/elasticsearch/data

  kibana:
    image: docker.elastic.co/kibana/kibana:8.18.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

  apm-server:
    image: docker.elastic.co/apm/apm-server:8.18.0
    ports:
      - "8200:8200"
    volumes:
      - ./apm-server.yml:/usr/share/apm-server/apm-server.yml:ro
    environment:
      - ELASTICSEARCH_PASSWORD=changeme
      - KIBANA_PASSWORD=changeme
    depends_on:
      - elasticsearch
      - kibana

  betrace-backend:
    image: betrace/backend:latest
    ports:
      - "12011:12011"
    environment:
      - OTEL_EXPORTER_OTLP_ENDPOINT=apm-server:8200
      - OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
    depends_on:
      - apm-server

  betrace-ui:
    image: betrace/ui-standalone:latest
    ports:
      - "3000:3000"
    environment:
      - BETRACE_BACKEND_URL=http://betrace-backend:12011

volumes:
  es-data:
```

**Start stack:**
```bash
docker-compose -f docker-compose.elastic.yml up -d

# Wait for Elasticsearch to be ready
curl -X GET http://localhost:9200/_cluster/health?wait_for_status=yellow

# Load ingest pipeline
curl -X PUT http://localhost:9200/_ingest/pipeline/traces-apm@custom \
  -H "Content-Type: application/json" \
  -d @ingest-pipeline.json

# Load index template
curl -X PUT http://localhost:9200/_index_template/traces-apm-betrace \
  -H "Content-Type: application/json" \
  -d @index-template.json

# Access Kibana
open http://localhost:5601
```

---

## Option B: Custom Kibana Plugin

### Step 1: Generate Kibana Plugin Scaffold

**Prerequisites:**
```bash
# Install Node.js 18+ and Yarn
node --version  # v18.x or higher
yarn --version  # 1.22.x or higher
```

**Clone Kibana repository (for plugin generator):**
```bash
git clone https://github.com/elastic/kibana.git
cd kibana

# Generate plugin
node scripts/generate_plugin betrace-plugin

# Answer prompts:
# Plugin name: betrace
# Description: BeTrace rule management for Kibana
# Generate a UI plugin: Yes
# Generate a server plugin: Yes
```

**Directory structure:**
```
plugins/betrace/
├── kibana.json              # Plugin manifest
├── package.json
├── tsconfig.json
├── public/
│   ├── index.ts             # Plugin entry point
│   ├── plugin.tsx           # Plugin class
│   ├── components/
│   │   ├── RuleList.tsx     # Reuse from Storybook
│   │   └── MonacoRuleEditor.tsx  # Reuse from Storybook
│   ├── application.tsx      # Main app
│   └── types.ts
└── server/
    ├── index.ts
    ├── plugin.ts
    └── routes/
        └── rules.ts         # Proxy to BeTrace backend
```

### Step 2: Configure Plugin Manifest

**File: `plugins/betrace/kibana.json`**

```json
{
  "id": "betrace",
  "version": "1.0.0",
  "kibanaVersion": "8.18.0",
  "server": true,
  "ui": true,
  "requiredPlugins": ["navigation", "data", "embeddable"],
  "optionalPlugins": [],
  "requiredBundles": ["kibanaReact", "kibanaUtils"]
}
```

### Step 3: Implement Plugin UI

**File: `plugins/betrace/public/plugin.tsx`**

```typescript
import { Plugin, CoreSetup, CoreStart, AppMountParameters } from '@kbn/core/public';
import { NavigationPublicPluginStart } from '@kbn/navigation-plugin/public';

export interface BeTracePluginSetup {}
export interface BeTracePluginStart {}

interface BeTracePluginSetupDeps {}
interface BeTracePluginStartDeps {
  navigation: NavigationPublicPluginStart;
}

export class BeTracePlugin
  implements Plugin<BeTracePluginSetup, BeTracePluginStart, BeTracePluginSetupDeps, BeTracePluginStartDeps>
{
  public setup(core: CoreSetup): BeTracePluginSetup {
    // Register application
    core.application.register({
      id: 'betrace',
      title: 'BeTrace',
      euiIconType: 'logoObservability',
      async mount(params: AppMountParameters) {
        // Import application on mount (code splitting)
        const { renderApp } = await import('./application');
        return renderApp(core, params);
      },
    });

    return {};
  }

  public start(core: CoreStart): BeTracePluginStart {
    return {};
  }

  public stop() {}
}
```

**File: `plugins/betrace/public/application.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom';
import { AppMountParameters, CoreSetup } from '@kbn/core/public';
import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';
import { MonacoRuleEditor } from './components/MonacoRuleEditor';
import { RuleList } from './components/RuleList';

const BeTraceApp = () => {
  const [selectedRule, setSelectedRule] = React.useState(null);
  const [rules, setRules] = React.useState([]);

  // Fetch rules from BeTrace backend (via Kibana server proxy)
  React.useEffect(() => {
    fetch('/api/betrace/rules')
      .then(res => res.json())
      .then(setRules);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>BeTrace Rule Management</h1>
      <RuleList
        rules={rules}
        onSelect={setSelectedRule}
        onCreate={() => setSelectedRule(null)}
      />
      {selectedRule !== undefined && (
        <MonacoRuleEditor
          rule={selectedRule}
          onSave={() => {
            // Refresh rules
            fetch('/api/betrace/rules').then(res => res.json()).then(setRules);
            setSelectedRule(undefined);
          }}
          onCancel={() => setSelectedRule(undefined)}
        />
      )}
    </div>
  );
};

export const renderApp = (core: CoreSetup, { element }: AppMountParameters) => {
  ReactDOM.render(
    <KibanaContextProvider services={core}>
      <BeTraceApp />
    </KibanaContextProvider>,
    element
  );

  return () => ReactDOM.unmountComponentAtNode(element);
};
```

### Step 4: Implement Server-Side Proxy

**File: `plugins/betrace/server/routes/rules.ts`**

```typescript
import { IRouter } from '@kbn/core/server';
import axios from 'axios';

export function defineRoutes(router: IRouter, betraceBackendUrl: string) {
  // GET /api/betrace/rules
  router.get(
    {
      path: '/api/betrace/rules',
      validate: false,
    },
    async (context, request, response) => {
      try {
        const { data } = await axios.get(`${betraceBackendUrl}/api/rules`);
        return response.ok({ body: data });
      } catch (err) {
        return response.customError({
          statusCode: 500,
          body: { message: err.message },
        });
      }
    }
  );

  // POST /api/betrace/rules
  router.post(
    {
      path: '/api/betrace/rules',
      validate: {
        body: schema.object({
          name: schema.string(),
          description: schema.string(),
          expression: schema.string(),
          severity: schema.string(),
          enabled: schema.boolean(),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const { data } = await axios.post(`${betraceBackendUrl}/api/rules`, request.body);
        return response.ok({ body: data });
      } catch (err) {
        return response.customError({
          statusCode: 500,
          body: { message: err.message },
        });
      }
    }
  );

  // PUT /api/betrace/rules/:id
  router.put(
    {
      path: '/api/betrace/rules/{id}',
      validate: {
        params: schema.object({ id: schema.string() }),
        body: schema.object({
          name: schema.string(),
          description: schema.string(),
          expression: schema.string(),
          severity: schema.string(),
          enabled: schema.boolean(),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const { data } = await axios.put(
          `${betraceBackendUrl}/api/rules/${request.params.id}`,
          request.body
        );
        return response.ok({ body: data });
      } catch (err) {
        return response.customError({
          statusCode: 500,
          body: { message: err.message },
        });
      }
    }
  );

  // DELETE /api/betrace/rules/:id
  router.delete(
    {
      path: '/api/betrace/rules/{id}',
      validate: {
        params: schema.object({ id: schema.string() }),
      },
    },
    async (context, request, response) => {
      try {
        await axios.delete(`${betraceBackendUrl}/api/rules/${request.params.id}`);
        return response.ok({ body: { success: true } });
      } catch (err) {
        return response.customError({
          statusCode: 500,
          body: { message: err.message },
        });
      }
    }
  );
}
```

**File: `plugins/betrace/server/plugin.ts`**

```typescript
import { Plugin, CoreSetup, PluginInitializerContext } from '@kbn/core/server';
import { defineRoutes } from './routes/rules';

export class BeTraceServerPlugin implements Plugin {
  constructor(private readonly initContext: PluginInitializerContext) {}

  public setup(core: CoreSetup) {
    const router = core.http.createRouter();

    // Read BeTrace backend URL from kibana.yml
    const config = this.initContext.config.get<{ backendUrl: string }>();
    const betraceBackendUrl = config.backendUrl || 'http://localhost:12011';

    defineRoutes(router, betraceBackendUrl);

    return {};
  }

  public start() {
    return {};
  }

  public stop() {}
}
```

### Step 5: Copy Storybook Components

**Copy MonacoRuleEditor and dependencies:**

```bash
# Copy components from grafana-betrace-app to Kibana plugin
cp -r /path/to/betrace/grafana-betrace-app/src/components/MonacoRuleEditor.tsx \
      plugins/betrace/public/components/

# Install Monaco editor for Kibana
cd plugins/betrace
yarn add @monaco-editor/react monaco-editor
```

**Adapt imports to Kibana:**

```typescript
// Replace @grafana/ui with @elastic/eui
import {
  EuiButton,
  EuiFieldText,
  EuiFormRow,
  EuiSwitch,
  EuiSpacer,
} from '@elastic/eui';
```

### Step 6: Build and Install Plugin

```bash
# Build plugin
cd plugins/betrace
yarn build

# Create plugin archive
cd ../../
yarn plugin:build betrace

# Install plugin in Kibana
bin/kibana-plugin install file:///path/to/betrace-1.0.0.zip

# Restart Kibana
```

**Configure Kibana:**

**File: `config/kibana.yml`**

```yaml
betrace:
  backendUrl: "http://betrace-backend:12011"
```

---

## Data Model Mapping

### Violation → Elasticsearch Document

| BeTrace Field | Elasticsearch Field | Type | Example |
|---------------|---------------------|------|---------|
| `ID` | `betrace.violation.id` | keyword | `"viol-abc123"` |
| `RuleID` | `betrace.violation.rule_id` | keyword | `"rule-001"` |
| `RuleName` | `betrace.violation.rule_name` | keyword | `"missing_audit_log"` |
| `Severity` | `betrace.violation.severity` | keyword | `"HIGH"` |
| `Message` | `betrace.violation.message` | text | `"PII access without audit"` |
| `TraceIDs[0]` | `trace.id` | keyword | `"abc123..."` |
| `CreatedAt` | `@timestamp` | date | `"2025-01-23T10:30:00.000Z"` |
| `Signature` | `betrace.violation.signature` | keyword | `"hmac-sha256..."` |

**Example Elasticsearch document:**

```json
{
  "@timestamp": "2025-01-23T10:30:00.000Z",
  "betrace": {
    "is_violation": true,
    "violation": {
      "id": "viol-abc123",
      "rule_id": "rule-001",
      "rule_name": "missing_audit_log",
      "severity": "HIGH",
      "priority": 2,
      "message": "PII access without audit log",
      "signature": "hmac-sha256:abc..."
    }
  },
  "trace": {
    "id": "trace-abc123"
  },
  "span": {
    "id": "span-456"
  },
  "service": {
    "name": "betrace"
  },
  "event": {
    "category": ["observability"],
    "type": ["info"]
  }
}
```

---

## Querying Violations in Kibana

### Discover (KQL Queries)

**Search all violations:**
```
betrace.is_violation: true
```

**High-severity violations:**
```
betrace.is_violation: true AND betrace.violation.severity: "HIGH"
```

**Violations from specific rule:**
```
betrace.is_violation: true AND betrace.violation.rule_name: "missing_audit_log"
```

**Time range + severity:**
```
betrace.is_violation: true AND betrace.violation.severity: ("HIGH" OR "CRITICAL") AND @timestamp >= now-1h
```

### Lucene Query Syntax

**Complex query:**
```
betrace.is_violation:true AND (betrace.violation.severity:HIGH OR betrace.violation.severity:CRITICAL) AND trace.id:abc*
```

---

## Dashboard Examples

### Violations Over Time

**Visualization Type:** TSVB Time Series

**Configuration:**
- **Index Pattern:** `traces-apm-betrace-*`
- **Metric:** Count
- **Group By:** `betrace.violation.severity`
- **Interval:** Auto
- **Time Range:** Last 24 hours

**JSON Config:**
```json
{
  "type": "timeseries",
  "series": [
    {
      "id": "critical",
      "color": "#D32F2F",
      "split_mode": "filter",
      "filter": {
        "query": "betrace.violation.severity: \"CRITICAL\"",
        "language": "kuery"
      },
      "metrics": [
        {
          "id": "count",
          "type": "count"
        }
      ]
    },
    {
      "id": "high",
      "color": "#FF6F00",
      "split_mode": "filter",
      "filter": {
        "query": "betrace.violation.severity: \"HIGH\"",
        "language": "kuery"
      },
      "metrics": [
        {
          "id": "count",
          "type": "count"
        }
      ]
    }
  ],
  "time_field": "@timestamp",
  "index_pattern": "traces-apm-betrace-*"
}
```

### Top Violated Rules

**Visualization Type:** Pie Chart

**Configuration:**
- **Metric:** Count
- **Bucket:** Terms aggregation on `betrace.violation.rule_name.keyword`
- **Size:** 10

---

## Alerting in Kibana

### Create Rule-Based Alert

**Navigate:** Stack Management → Rules and Connectors → Create rule

**Rule Type:** Elasticsearch query

**Configuration:**
```json
{
  "index": ["traces-apm-betrace-*"],
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "betrace.is_violation": true
          }
        },
        {
          "terms": {
            "betrace.violation.severity": ["HIGH", "CRITICAL"]
          }
        }
      ]
    }
  },
  "timeField": "@timestamp",
  "threshold": 5,
  "timeWindowSize": 5,
  "timeWindowUnit": "m"
}
```

**Alert Actions:**
- **Slack**: Send message to #alerts channel
- **Email**: Notify security team
- **PagerDuty**: Create incident

**Alert Template:**
```
[BeTrace] {{ context.hits.total.value }} critical violations detected

Rule: {{ context.hits.hits.0._source.betrace.violation.rule_name }}
Severity: {{ context.hits.hits.0._source.betrace.violation.severity }}
Message: {{ context.hits.hits.0._source.betrace.violation.message }}

View in Kibana: {{ kibanaBaseUrl }}/app/discover#/?_g=(time:(from:now-15m,to:now))
```

---

## Testing & Validation

### End-to-End Test

**1. Send test violation:**
```bash
# Create test rule
curl -X POST http://localhost:12011/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_rule",
    "expression": "trace.has(span.status == \"error\")",
    "severity": "HIGH",
    "enabled": true
  }'

# Trigger violation (emit test trace with error)
# Use OTEL SDK to emit trace...
```

**2. Verify in Elasticsearch:**
```bash
# Query Elasticsearch
curl -X GET "http://localhost:9200/traces-apm-betrace-*/_search?pretty" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "term": {
        "betrace.is_violation": true
      }
    },
    "size": 1
  }'
```

**3. Verify in Kibana Discover:**
- Open http://localhost:5601/app/discover
- Select index pattern: `traces-apm-betrace-*`
- Search: `betrace.is_violation: true`
- Verify violation appears

### Performance Test

```bash
# Load test: 500 violations/minute
for i in {1..500}; do
  # Emit violation span via BeTrace
  curl -X POST http://localhost:12011/internal/test/emit-violation &
  sleep 0.12  # ~500/min
done

# Monitor Elasticsearch indexing rate
curl "http://localhost:9200/_nodes/stats/indices/indexing?pretty" | jq '.nodes[].indices.indexing.index_total'
```

---

## Deployment Checklist

- [ ] Deploy Elasticsearch cluster (3+ nodes for HA)
- [ ] Deploy Kibana with authentication enabled
- [ ] Deploy APM Server with OTLP endpoints
- [ ] Create custom ingest pipeline (`traces-apm@custom`)
- [ ] Create index template (`traces-apm-betrace`)
- [ ] Configure ILM policy (30-day retention)
- [ ] Deploy BeTrace backend with OTLP exporter
- [ ] (Optional) Install BeTrace Kibana plugin
- [ ] Create Kibana dashboards for violations
- [ ] Set up alerts for critical violations
- [ ] Test end-to-end flow
- [ ] Configure backup/restore (Elasticsearch snapshots)

---

## Troubleshooting

### Violations Not Appearing in Elasticsearch

**Check:**
```bash
# 1. Verify APM Server received spans
curl http://localhost:8200/  # Health check

# 2. Check APM Server logs
docker logs apm-server | grep OTLP

# 3. Query Elasticsearch for any documents
curl "http://localhost:9200/traces-apm-betrace-*/_count"

# 4. Check ingest pipeline errors
curl "http://localhost:9200/failed-traces-apm-betrace-*/_search?pretty"
```

### Ingest Pipeline Failures

**Debug:**
```bash
# Test pipeline with sample document
curl -X POST "http://localhost:9200/_ingest/pipeline/traces-apm@custom/_simulate?pretty" \
  -H "Content-Type: application/json" \
  -d @test-violation.json

# Check for processor errors in response
```

### High Elasticsearch Disk Usage

**Fix:**
```bash
# Force ILM execution
curl -X POST "http://localhost:9200/_ilm/start"

# Manually delete old indices
curl -X DELETE "http://localhost:9200/traces-apm-betrace-2025.01.01"

# Adjust ILM policy to shorter retention
curl -X PUT "http://localhost:9200/_ilm/policy/betrace-ilm-policy" \
  -H "Content-Type: application/json" \
  -d '{
    "policy": {
      "phases": {
        "delete": {
          "min_age": "7d",
          "actions": { "delete": {} }
        }
      }
    }
  }'
```

---

## Migration from Grafana

### Export Rules

```bash
# Rules API is platform-agnostic - same export
curl http://localhost:12011/api/rules > rules-backup.json
```

### Reconfigure OTLP Exporter

**Before (Grafana/Tempo):**
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=tempo:4317
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
```

**After (Elastic APM):**
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=apm-server:8200
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

---

## Performance Considerations

### Expected Throughput

| Metric | Value |
|--------|-------|
| **Violations/second** | 500-1000 |
| **APM Server CPU** | 1-2 cores |
| **APM Server Memory** | 512MB-1GB |
| **Elasticsearch Ingestion** | 5K docs/sec |
| **Disk Space (30 days)** | ~50GB (500 viol/sec) |

---

## Cost Comparison

### Grafana Stack vs. Elastic Stack

| Component | Grafana Cloud | Elastic Cloud | Self-Hosted Elastic |
|-----------|---------------|---------------|---------------------|
| **Traces (10M spans/month)** | $50-200/month | $100-300/month | $0 (infra only) |
| **Infrastructure** | $0 (managed) | $0 (managed) | $100-200/month |
| **Total** | **$50-200/month** | **$100-300/month** | **$100-200/month** |

---

## References

- **Elastic APM Documentation**: https://www.elastic.co/guide/en/apm/guide/current/index.html
- **Kibana Plugin Development**: https://www.elastic.co/guide/en/kibana/current/development.html
- **Elasticsearch Ingest Pipelines**: https://www.elastic.co/guide/en/elasticsearch/reference/current/ingest.html
- **OTLP Specification**: https://opentelemetry.io/docs/specs/otlp/
- **BeTrace ADRs**:
  - [ADR-022: Grafana-First Architecture](../adrs/022-grafana-first-architecture.md)
  - [ADR-026: BeTrace Core Competencies](../adrs/026-betrace-core-competencies.md)

---

## Support

- **GitHub Issues**: [betracehq/betrace/issues](https://github.com/betracehq/betrace/issues)
- **Elastic Community**: [discuss.elastic.co](https://discuss.elastic.co)
- **Kibana Slack**: [elasticstack.slack.com](https://elasticstack.slack.com)
