# PRD-010: Rule Management UI

**Priority:** P0 (Core Feature)
**Complexity:** Medium
**Personas:** SRE, Developer
**Dependencies:** PRD-002 (Persistence), PRD-008 (Signals)

## Problem

No UI for managing rules:
- Rules can only be created via API
- No rule editor with syntax highlighting
- No rule validation feedback
- No rule enable/disable toggle
- No rule history

## Solution

### Rule Editor

- Monaco editor with BeTrace DSL syntax highlighting
- Real-time validation as user types
- Error messages with suggestions (from ERROR_MESSAGES_GUIDE.md)
- Test rule against sample traces

### Rule List

- Table showing all rules
- Enable/disable toggle
- Edit/Delete actions
- Filter by severity, status

### Implementation

**Frontend Components:**
```tsx
<RuleEditor
  value={ruleExpression}
  onChange={handleChange}
  onValidate={validateDsl}
  errors={parseErrors}
/>

<RuleList
  rules={rules}
  onToggle={handleToggle}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

## Success Criteria

- [ ] Monaco editor with BeTrace DSL syntax
- [ ] Real-time validation
- [ ] Create/edit/delete rules
- [ ] Enable/disable toggle
- [ ] Rule history tracking
- [ ] Test coverage: Validation, CRUD operations

## Files to Create

- `bff/src/components/rules/rule-editor.tsx`
- `bff/src/components/rules/rule-list.tsx`
- `bff/src/lib/monaco/fluo-dsl-language.ts`

## Public Examples

### 1. Monaco Editor
**URL:** https://microsoft.github.io/monaco-editor/

**Relevance:** Code editor powering VS Code, the industry standard for in-browser code editing. Essential reference for implementing BeTrace's DSL editor with syntax highlighting, autocomplete, and error diagnostics.

**Key Patterns:**
- Language registration and tokenization
- Monarch syntax highlighting definition
- Language Server Protocol (LSP) integration
- Inline error markers and diagnostics
- Custom autocomplete providers
- Keyboard shortcuts and commands

**BeTrace Implementation:** BeTrace's rule editor uses Monaco with custom BeTrace DSL language definition for syntax highlighting and validation.

### 2. CodeMirror
**URL:** https://codemirror.net/

**Relevance:** Alternative code editor used by Grafana and other observability tools. Demonstrates modular language support and extension-based architecture.

**Key Patterns:**
- Lezer parser for syntax analysis
- Extension-based configuration
- Language packages for custom DSLs
- Inline linting and error display
- Vim/Emacs keybindings

**BeTrace Alternative:** If Monaco proves too heavyweight, CodeMirror provides a lighter alternative with excellent DSL support.

### 3. Grafana Query Editor
**URL:** https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/

**Relevance:** Reference implementation for DSL editing in observability context. Combines Monaco editor with query validation, showing patterns directly applicable to BeTrace's rule management.

**Key Patterns:**
- PromQL/LogQL syntax highlighting
- Real-time query validation
- Query history and saved queries
- Autocomplete for metrics and labels
- Explain query feature (shows execution plan)

**BeTrace Alignment:** Grafana's query editor workflow (write query → validate → test → save) mirrors BeTrace's rule workflow (write rule → validate DSL → test with sample traces → deploy).

---

## Implementation Readiness Assessment

**Implementation Specialist Confidence:** 95% ✅ **READY TO IMPLEMENT**

### Clarifications Completed

All 26 implementation questions answered across 7 categories with specific, actionable details:

**1. Backend Architecture & API Design:**
- ✅ TigerBeetle account schema for rules (no SQL per ADR-011)
- ✅ RulesApiRoute.java with 6 REST endpoints (GET/POST/PUT/DELETE/validate)
- ✅ Tenant isolation via TigerBeetle ledger partitioning (account ID hashing)
- ✅ Validation endpoint response format with line/column error details
- ✅ Pre-compile Drools DRL on save, store alongside DSL in TigerBeetle account
- ✅ Rule versioning out of scope for MVP (future enhancement)
- ✅ Hot reload from TigerBeetle every 10s into DroolsRuleEngine

**2. Monaco Editor Integration:**
- ✅ Custom language registration via monaco.languages.register() + setMonarchTokensProvider
- ✅ Syntax highlighting: keywords (trace, span, has), operators (==, !=), strings, numbers
- ✅ 500ms debounce for real-time validation API calls
- ✅ Error markers: Monaco squiggly underlines + hover tooltips + separate error panel
- ✅ Bundled via vite-plugin-monaco-editor (~2MB, acceptable for editor-heavy UX)

**3. Frontend State Management & UX:**
- ✅ Optimistic updates with rollback on error (Tanstack Query mutations)
- ✅ Unsaved changes warning (useBeforeUnload + Tanstack Router useBlocker)
- ✅ Default sort: updatedAt DESC, filter: active rules only
- ✅ 4 rule templates: slow DB query, failed payment, high error rate, PII access without audit

**4. Testing Strategy:**
- ✅ Mock Monaco in unit tests (Vitest), E2E for integration (Playwright)
- ✅ Backend coverage: 90% overall, 95% for RuleService (per ADR-015)
- ✅ Frontend tests: CRUD flows, validation errors, network failures, tenant isolation

**5. Non-Functional Requirements:**
- ✅ Performance targets: validation <200ms, list rules <500ms, create/update <1s
- ✅ Error recovery: graceful degradation with "Save as Draft" fallback if validation API fails
- ✅ Accessibility: WCAG 2.1 AA compliance (keyboard nav, screen readers, 4.5:1 contrast)

**6. Deployment & Migration:**
- ✅ No SQL migration (TigerBeetle schema-less storage)
- ✅ No backward compatibility needed (initial implementation of rule management)

**7. Documentation & Observability:**
- ✅ SOC2 CC8.1 compliance spans for rule CRUD operations (change management)
- ✅ OpenAPI/Swagger UI auto-generated via Quarkus annotations
- ✅ Custom metrics: rules.created, rules.active.count, rule.validation.duration

### Implementation Estimate

**Total Time:** 5-7 days (1-1.5 weeks)

**Breakdown:**
1. **Backend Foundation (2 days):**
   - TigerBeetle schema + RuleAccount model
   - RulesApiRoute.java with 6 endpoints
   - RuleService with CRUD + validation
   - Wire FluoDslParser to validation endpoint

2. **Monaco Integration (2 days):**
   - monaco-dsl-config.ts (language registration + Monarch tokenizer)
   - rule-editor.tsx with error markers
   - API client methods + Tanstack Query hooks
   - Debounced validation

3. **Frontend UX (1-2 days):**
   - rules-page.tsx with sort/filter
   - Optimistic updates + unsaved changes warning
   - Rule templates dropdown
   - Create/edit/delete flows

4. **Testing & Polish (1 day):**
   - Backend unit tests (95% coverage for RuleService)
   - Frontend component tests + E2E (Playwright)
   - Performance validation (<200ms validation, <500ms list)
   - Compliance span verification in Grafana

### TigerBeetle Schema

```java
// backend/src/main/java/com/fluo/models/RuleAccount.java
public class RuleAccount {
    private UInt128 id;  // Hash(tenantId + ruleId)

    // Flags for rule state
    private static final int FLAG_ACTIVE = 1 << 16;
    private static final int FLAG_DRAFT = 1 << 17;
    private static final int FLAG_COMPILED = 1 << 18;

    // User data fields (packed binary in account.user_data, 1KB max)
    private String tenantId;      // 16 bytes (UUID)
    private String ruleId;        // 16 bytes (UUID)
    private String ruleName;      // 128 bytes max
    private String dslText;       // 512 bytes max
    private String droolsDrl;     // 256 bytes max (compiled DRL)
    private long createdAt;       // 8 bytes (timestamp)
    private long updatedAt;       // 8 bytes (timestamp)
    private long ledger;          // Tenant-specific ledger ID
}
```

### REST API Endpoints

```
GET    /api/v1/tenants/{tenantId}/rules              - List all rules for tenant
GET    /api/v1/tenants/{tenantId}/rules/{ruleId}     - Get rule by ID
POST   /api/v1/tenants/{tenantId}/rules              - Create new rule
PUT    /api/v1/tenants/{tenantId}/rules/{ruleId}     - Update rule
DELETE /api/v1/tenants/{tenantId}/rules/{ruleId}     - Delete rule
POST   /api/v1/tenants/{tenantId}/rules/validate     - Validate DSL without saving
```

### Validation Response Format

**Success:**
```json
{
  "valid": true,
  "dsl": "trace.has(span.name == 'payment') and count(span.errors) > 0",
  "compiled_drl": "rule \"payment_errors\"\n  when\n    $trace: Trace(...)\n  then\n    ...\nend",
  "warnings": []
}
```

**Error:**
```json
{
  "valid": false,
  "errors": [
    {
      "line": 1,
      "column": 25,
      "message": "Unexpected token 'an'. Expected operator ('and', 'or', ')', end of input)",
      "severity": "error",
      "code": "SYNTAX_ERROR"
    }
  ]
}
```

### Files to Create

**Backend:**
```
backend/src/main/java/com/fluo/routes/RulesApiRoute.java
backend/src/main/java/com/fluo/services/RuleService.java
backend/src/main/java/com/fluo/models/RuleAccount.java
backend/src/main/java/com/fluo/dto/CreateRuleRequest.java
backend/src/main/java/com/fluo/dto/UpdateRuleRequest.java
backend/src/main/java/com/fluo/dto/ValidateRuleRequest.java
backend/src/main/java/com/fluo/dto/ValidationResponse.java
backend/src/main/java/com/fluo/dto/ValidationError.java
backend/src/test/java/com/fluo/services/RuleServiceTest.java
backend/src/test/java/com/fluo/routes/RulesApiRouteTest.java
```

**Frontend:**
```
bff/src/components/rules/rule-editor.tsx
bff/src/components/rules/monaco-dsl-config.ts
bff/src/lib/rule-templates.ts
bff/src/lib/api/rules-api.ts
bff/src/hooks/use-rules.ts
bff/src/components/rules/__tests__/rule-editor.test.tsx
bff/e2e/rule-editor.spec.ts
```

**Configuration:**
```
bff/vite.config.ts (add vite-plugin-monaco-editor)
bff/package.json (add @monaco-editor/react, vite-plugin-monaco-editor)
```

### Files to Modify

**Backend:**
```
backend/src/main/java/com/fluo/services/DroolsRuleEngine.java (add hot reload scheduler)
backend/src/main/resources/application.properties (add rule.reload.interval=10s)
```

**Frontend:**
```
bff/src/components/rules/rules-page.tsx (replace demo API with real API client)
```

### Remaining 5% Risk

- **Monaco Bundle Size**: ~2MB estimate needs validation during actual build
- **TigerBeetle Query Performance**: Hot reload every 10s may need tuning based on rule count
- **Monaco Custom Language Edge Cases**: Syntax highlighting correctness will emerge during implementation

**Status:** No blockers. Ready to start implementation immediately.

### Validation Criteria

Before marking PRD-010 as complete, verify:
- [ ] Monaco editor loads and registers custom BeTrace DSL language
- [ ] Syntax highlighting works for keywords, operators, strings, numbers
- [ ] Real-time validation shows errors with line/column numbers
- [ ] Rule CRUD operations succeed with tenant isolation
- [ ] Pre-compilation to Drools DRL on save
- [ ] Hot reload fetches updated rules from TigerBeetle
- [ ] Backend tests achieve 95% coverage for RuleService
- [ ] Frontend E2E test creates/edits/deletes rule successfully
- [ ] Performance: validation <200ms (p95), list rules <500ms (p95)
- [ ] Compliance spans emitted for rule CRUD (SOC2 CC8.1)
- [ ] Unsaved changes warning appears when navigating away
- [ ] Rule templates populate editor correctly
