# PRD-030: BeTrace Grafana App Plugin

**Status:** Draft
**Created:** 2025-01-22
**ADRs:** ADR-022 (Grafana-First), ADR-027 (BeTrace as Grafana App Plugin)
**Dependencies:** None (standalone plugin)
**Estimated Effort:** ~800 LOC, 2-3 weeks

---

## Executive Summary

Create a Grafana App Plugin for BeTrace rule management. This replaces the custom React BFF and provides a native Grafana UI for creating, editing, testing, and managing BeTrace DSL rules.

**Key Decision:** Per ADR-027, BeTrace provides **rule management UI only**. Grafana provides everything else (dashboards, alerting, visualization, auth).

---

## Problem Statement

### Current State (Post-Backend Cleanup)

After commits b9953f3-4871e97 (-4,607 LOC cleanup):
- ✅ Backend simplified to core competencies
- ✅ ViolationSpan emission to Tempo
- ❌ No UI for rule management
- ❌ Custom React BFF (bff/) still exists but obsolete

### Grafana-First Vision (ADR-022)

Users interact with BeTrace entirely through Grafana:
1. **Create rules**: BeTrace App Plugin (this PRD)
2. **Query violations**: Grafana Explore + BeTrace Datasource Plugin (PRD-031)
3. **Alert on violations**: Grafana Alerting (ADR-025)
4. **Visualize trends**: Grafana Dashboards (native)

### What This PRD Delivers

A Grafana App Plugin that provides:
- BeTraceDSL rule editor with Monaco syntax highlighting
- Rule CRUD operations (Create, Read, Update, Delete)
- Rule testing with sample traces
- Integration with BeTrace backend API (`/api/rules`)

---

## Success Criteria

1. **Installable**: `grafana-cli plugins install fluo-app` works
2. **Native Look**: UI matches Grafana design system
3. **Monaco Integration**: Syntax highlighting for BeTraceDSL
4. **API Integration**: CRUD operations via `/api/rules`
5. **Rule Testing**: Test rules against sample traces before saving

---

## Architecture

### Plugin Type: Grafana App Plugin

**Why App Plugin (not Panel/Datasource)?**
- App plugins provide full-page UIs with routing
- Can have multiple pages (Rules, Config)
- Appears in Grafana sidebar navigation
- Perfect for CRUD interfaces

**Comparison**:
| Plugin Type | Use Case | BeTrace Fit |
|-------------|----------|----------|
| App | Multi-page UI, configuration | ✅ Rules management |
| Datasource | Query external data | ⏸️ PRD-031 (violations) |
| Panel | Custom visualization | ❌ Not needed |

### Project Structure

```
grafana-betrace-app/
├── src/
│   ├── components/
│   │   ├── RuleEditor.tsx           # Monaco editor for BeTraceDSL
│   │   ├── RuleList.tsx             # Table of rules with actions
│   │   ├── RuleTestPanel.tsx        # Test rule with sample trace
│   │   └── DeleteConfirmModal.tsx   # Confirmation dialog
│   ├── pages/
│   │   ├── RulesPage.tsx            # Main rules page (/a/fluo-app)
│   │   └── ConfigPage.tsx           # Plugin config (/a/fluo-app/config)
│   ├── api/
│   │   └── rulesApi.ts              # Backend API client
│   ├── types/
│   │   └── rule.ts                  # TypeScript types for rules
│   ├── module.ts                    # Plugin entry point
│   └── plugin.json                  # Plugin metadata
├── package.json
├── tsconfig.json
└── README.md
```

### Integration Points

```
┌─────────────────┐
│  Grafana UI     │
│  ┌───────────┐  │
│  │ BeTrace App  │  │ ◄── User creates/edits rules
│  │ Plugin    │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │ HTTP
         ▼
┌─────────────────┐
│ BeTrace Backend    │
│ /api/rules      │ ◄── CRUD operations
│ (Quarkus)       │
└─────────────────┘
```

---

## Functional Requirements

### FR-1: Rule List View

**User Story**: As an SRE, I want to see all my BeTraceDSL rules so I can manage them.

**UI Components**:
- Table with columns: Name, Description, Status (Active/Inactive), Last Modified
- Actions: Edit, Delete, Test, Toggle Active/Inactive
- "New Rule" button (top-right)
- Search/filter by name or description

**API**: `GET /api/rules`

**Response**:
```json
[
  {
    "id": "rule-123",
    "name": "High Error Rate",
    "description": "Alert when error rate > 5%",
    "expression": "trace.has(error) and trace.count(error) / trace.count(span) > 0.05",
    "active": true,
    "createdAt": "2025-01-22T10:00:00Z",
    "updatedAt": "2025-01-22T12:00:00Z"
  }
]
```

### FR-2: Rule Editor (Monaco Integration)

**User Story**: As a developer, I want syntax highlighting for BeTraceDSL so I can write rules correctly.

**UI Components**:
- Monaco editor with BeTraceDSL syntax highlighting
- Form fields: Name, Description, Active checkbox
- "Save" and "Cancel" buttons
- Validation errors displayed inline

**Monaco Configuration**:
```typescript
// BeTraceDSL language definition
const fluoDSLLanguage = {
  keywords: ['trace', 'has', 'where', 'and', 'or', 'not', 'count', 'matches', 'in'],
  operators: ['==', '!=', '>', '<', '>=', '<='],
  tokenizer: {
    root: [
      [/trace\.(has|count)/, 'keyword'],
      [/\b(and|or|not|where|in|matches)\b/, 'keyword'],
      // ... (see .skills/grafana-plugin/SKILL.md for full definition)
    ]
  }
};
```

**API**:
- Create: `POST /api/rules`
- Update: `PUT /api/rules/{id}`

**Request Body**:
```json
{
  "name": "High Error Rate",
  "description": "Alert when error rate > 5%",
  "expression": "trace.has(error) and trace.count(error) / trace.count(span) > 0.05",
  "active": true
}
```

### FR-3: Rule Testing

**User Story**: As a developer, I want to test my rule against sample traces before saving.

**UI Components**:
- "Test Rule" button in editor
- Sample trace input (JSON textarea or file upload)
- Test results panel showing:
  - ✅ "Rule matched" or ❌ "Rule did not match"
  - Matched spans highlighted
  - Violation details if matched

**API**: `POST /api/rules/test`

**Request**:
```json
{
  "expression": "trace.has(payment.charge_card).where(amount > 1000)",
  "sampleTrace": [
    {
      "spanId": "span-1",
      "traceId": "trace-1",
      "operationName": "payment.charge_card",
      "attributes": {"amount": 1500}
    }
  ]
}
```

**Response**:
```json
{
  "matched": true,
  "matchedSpans": ["span-1"],
  "violationMessage": "High-value charge without fraud check"
}
```

### FR-4: Rule Deletion

**User Story**: As an SRE, I want to delete obsolete rules.

**UI Components**:
- Delete button in rule list
- Confirmation modal: "Are you sure you want to delete rule '{name}'?"
- "Cancel" and "Delete" buttons

**API**: `DELETE /api/rules/{id}`

### FR-5: Plugin Configuration

**User Story**: As an admin, I want to configure the BeTrace backend URL.

**UI Components**:
- Configuration page (/a/fluo-app/config)
- Form fields:
  - BeTrace Backend URL (default: `http://localhost:8080`)
  - API Key (optional, for auth)
- "Save Configuration" button

**Storage**: Grafana plugin settings (persisted per instance)

---

## Non-Functional Requirements

### NFR-1: Performance

- Rule list loads in <1s for 100 rules
- Monaco editor loads in <500ms
- Rule test completes in <2s

### NFR-2: Accessibility

- Keyboard navigation for all actions
- ARIA labels for screen readers
- High contrast mode support

### NFR-3: Compatibility

- Works in Grafana ≥9.0.0
- Works in Grafana Cloud and self-hosted
- Supports Chrome, Firefox, Safari, Edge

---

## Technical Design

### Tech Stack

- **Framework**: React 18 + TypeScript
- **Editor**: Monaco Editor (@monaco-editor/react)
- **UI Components**: @grafana/ui (Grafana design system)
- **HTTP Client**: @grafana/runtime (getBackendSrv)
- **Routing**: React Router (for multi-page app)
- **Build**: Grafana plugin tools (@grafana/toolkit)

### Plugin Metadata (plugin.json)

```json
{
  "type": "app",
  "name": "BeTrace",
  "id": "fluo-app",
  "info": {
    "description": "Behavioral assurance for OpenTelemetry traces",
    "author": {
      "name": "BeTrace",
      "url": "https://betrace.dev"
    },
    "keywords": ["observability", "opentelemetry", "compliance", "traces"],
    "version": "1.0.0",
    "updated": "2025-01-22",
    "logos": {
      "small": "img/logo.svg",
      "large": "img/logo.svg"
    }
  },
  "includes": [
    {
      "type": "page",
      "name": "Rules",
      "path": "/a/fluo-app",
      "role": "Editor",
      "addToNav": true,
      "defaultNav": true
    },
    {
      "type": "page",
      "name": "Configuration",
      "path": "/a/fluo-app/config",
      "role": "Admin",
      "addToNav": false
    }
  ],
  "dependencies": {
    "grafanaDependency": ">=9.0.0",
    "plugins": []
  }
}
```

### Component Breakdown

#### 1. RulesPage.tsx (Main Page)

```typescript
import React from 'react';
import { RuleList } from '../components/RuleList';
import { RuleEditor } from '../components/RuleEditor';

export const RulesPage: React.FC = () => {
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className="page-container">
      {showEditor ? (
        <RuleEditor
          rule={selectedRule}
          onSave={handleSave}
          onCancel={() => setShowEditor(false)}
        />
      ) : (
        <RuleList
          onEdit={(rule) => {
            setSelectedRule(rule);
            setShowEditor(true);
          }}
          onNew={() => {
            setSelectedRule(null);
            setShowEditor(true);
          }}
        />
      )}
    </div>
  );
};
```

#### 2. RuleEditor.tsx (Monaco Integration)

```typescript
import React from 'react';
import { Editor } from '@monaco-editor/react';
import { Button, Field, Input, Checkbox } from '@grafana/ui';

interface RuleEditorProps {
  rule: Rule | null;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({ rule, onSave, onCancel }) => {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [expression, setExpression] = useState(rule?.expression || '');
  const [active, setActive] = useState(rule?.active ?? true);

  return (
    <div>
      <Field label="Rule Name">
        <Input value={name} onChange={(e) => setName(e.currentTarget.value)} />
      </Field>

      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
      </Field>

      <Field label="BeTraceDSL Expression">
        <Editor
          height="300px"
          language="fluo-dsl"
          value={expression}
          onChange={(value) => setExpression(value || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
          }}
        />
      </Field>

      <Checkbox
        label="Active"
        value={active}
        onChange={(e) => setActive(e.currentTarget.checked)}
      />

      <div className="button-row">
        <Button onClick={() => onSave({ name, description, expression, active })}>
          Save Rule
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
```

#### 3. rulesApi.ts (Backend Client)

```typescript
import { getBackendSrv } from '@grafana/runtime';

const API_BASE = '/api/rules'; // Proxied through Grafana

export interface Rule {
  id?: string;
  name: string;
  description: string;
  expression: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const rulesApi = {
  async list(): Promise<Rule[]> {
    return getBackendSrv().get(API_BASE);
  },

  async create(rule: Rule): Promise<Rule> {
    return getBackendSrv().post(API_BASE, rule);
  },

  async update(id: string, rule: Rule): Promise<Rule> {
    return getBackendSrv().put(`${API_BASE}/${id}`, rule);
  },

  async delete(id: string): Promise<void> {
    return getBackendSrv().delete(`${API_BASE}/${id}`);
  },

  async test(expression: string, sampleTrace: any[]): Promise<{ matched: boolean; matchedSpans: string[] }> {
    return getBackendSrv().post(`${API_BASE}/test`, { expression, sampleTrace });
  },
};
```

---

## Backend API Requirements

**Note**: Backend already has DroolsSpanProcessor and rule infrastructure. This PRD only requires exposing REST API.

### Required Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rules` | List all rules |
| POST | `/api/rules` | Create new rule |
| GET | `/api/rules/{id}` | Get rule by ID |
| PUT | `/api/rules/{id}` | Update rule |
| DELETE | `/api/rules/{id}` | Delete rule |
| POST | `/api/rules/test` | Test rule against sample trace |

### Implementation Plan (Backend)

1. Create `RuleResource.java` (JAX-RS resource)
2. Reuse existing `ASTRuleManager` for rule storage
3. Add `RuleTestService` for test endpoint
4. Enable CORS for Grafana origin

**Estimated Backend Work**: ~200 LOC

---

## Development Plan

### Phase 1: Plugin Skeleton (Week 1)

**Tasks**:
- [ ] Set up Grafana plugin project with `@grafana/toolkit`
- [ ] Create plugin.json metadata
- [ ] Implement basic RulesPage layout
- [ ] Add navigation to Grafana sidebar
- [ ] Test plugin installation

**Deliverable**: Installable plugin with empty UI

### Phase 2: Rule List & CRUD (Week 2)

**Tasks**:
- [ ] Implement RuleList component
- [ ] Add rulesApi.ts backend client
- [ ] Implement Create/Edit RuleEditor
- [ ] Add Delete confirmation modal
- [ ] Test CRUD operations

**Deliverable**: Full CRUD functionality

### Phase 3: Monaco Integration (Week 2-3)

**Tasks**:
- [ ] Add Monaco editor dependency
- [ ] Define BeTraceDSL syntax highlighting
- [ ] Integrate Monaco into RuleEditor
- [ ] Add syntax validation
- [ ] Test editor UX

**Deliverable**: Syntax-highlighted DSL editor

### Phase 4: Rule Testing (Week 3)

**Tasks**:
- [ ] Add RuleTestPanel component
- [ ] Implement sample trace input
- [ ] Call backend `/api/rules/test` endpoint
- [ ] Display test results
- [ ] Highlight matched spans

**Deliverable**: Working rule test functionality

### Phase 5: Polish & Documentation (Week 3)

**Tasks**:
- [ ] Add loading states
- [ ] Improve error handling
- [ ] Write README.md
- [ ] Create screenshot for Grafana catalog
- [ ] Test in Grafana Cloud

**Deliverable**: Production-ready plugin

---

## Testing Strategy

### Unit Tests (Vitest)

- Test RuleEditor form validation
- Test RuleList filtering/sorting
- Test rulesApi client error handling

### Integration Tests (Playwright)

- Test full CRUD flow in Grafana
- Test Monaco editor interaction
- Test rule testing with sample traces

### Manual Testing Checklist

- [ ] Install plugin via grafana-cli
- [ ] Create rule with Monaco editor
- [ ] Edit existing rule
- [ ] Delete rule with confirmation
- [ ] Test rule with sample trace
- [ ] Toggle rule active/inactive
- [ ] Configure backend URL

---

## Success Metrics

1. **Adoption**: 100+ plugin installs in first month
2. **Usability**: <5 minutes to create first rule
3. **Reliability**: <1% error rate on API calls
4. **Performance**: <1s rule list load time

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Monaco bundle size too large | High | Lazy-load Monaco, use CDN |
| Grafana API changes | Medium | Pin Grafana version, test before upgrades |
| Backend CORS issues | Low | Configure CORS in Quarkus |
| BeTraceDSL syntax complex for users | Medium | Add rule templates, examples |

---

## Future Enhancements (Out of Scope)

- Rule templates library
- Rule versioning and rollback
- Collaborative editing (multiple users)
- AI-assisted rule generation
- Rule performance analytics

---

## References

- **ADR-022**: Grafana-First Architecture
- **ADR-027**: BeTrace as Grafana App Plugin
- **Skill**: `.skills/grafana-plugin/SKILL.md`
- **Grafana Docs**: https://grafana.com/docs/grafana/latest/developers/plugins/
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/

---

## Approval

**Committee Decision**: Approved by Grafana-First Product Owner, Tech Lead, Engineering Manager

**Next Steps**:
1. Review PRD-030 with team
2. Set up plugin project skeleton
3. Implement Phase 1 (plugin skeleton)
