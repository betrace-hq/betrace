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

- Monaco editor with FLUO DSL syntax highlighting
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

- [ ] Monaco editor with FLUO DSL syntax
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

**Relevance:** Code editor powering VS Code, the industry standard for in-browser code editing. Essential reference for implementing FLUO's DSL editor with syntax highlighting, autocomplete, and error diagnostics.

**Key Patterns:**
- Language registration and tokenization
- Monarch syntax highlighting definition
- Language Server Protocol (LSP) integration
- Inline error markers and diagnostics
- Custom autocomplete providers
- Keyboard shortcuts and commands

**FLUO Implementation:** FLUO's rule editor uses Monaco with custom FLUO DSL language definition for syntax highlighting and validation.

### 2. CodeMirror
**URL:** https://codemirror.net/

**Relevance:** Alternative code editor used by Grafana and other observability tools. Demonstrates modular language support and extension-based architecture.

**Key Patterns:**
- Lezer parser for syntax analysis
- Extension-based configuration
- Language packages for custom DSLs
- Inline linting and error display
- Vim/Emacs keybindings

**FLUO Alternative:** If Monaco proves too heavyweight, CodeMirror provides a lighter alternative with excellent DSL support.

### 3. Grafana Query Editor
**URL:** https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/

**Relevance:** Reference implementation for DSL editing in observability context. Combines Monaco editor with query validation, showing patterns directly applicable to FLUO's rule management.

**Key Patterns:**
- PromQL/LogQL syntax highlighting
- Real-time query validation
- Query history and saved queries
- Autocomplete for metrics and labels
- Explain query feature (shows execution plan)

**FLUO Alignment:** Grafana's query editor workflow (write query → validate → test → save) mirrors FLUO's rule workflow (write rule → validate DSL → test with sample traces → deploy).
