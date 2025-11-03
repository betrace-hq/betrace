# Monaco Editor Integration - Summary

## ✅ Priority 3: Feature Enhancements - Monaco Editor COMPLETE

Monaco editor with BeTraceDSL support has been fully integrated into the SigNoz app.

---

## What Was Built

### 1. Monaco Editor Component

**File:** [signoz-betrace-app/src/components/MonacoEditor.tsx](signoz-betrace-app/src/components/MonacoEditor.tsx)

**Features:**
- ✅ **Custom BeTraceDSL Language Definition**
  - Registered as `betrace-dsl` language in Monaco
  - Full language configuration (comments, brackets, auto-closing pairs)

- ✅ **Syntax Highlighting**
  - Keywords: `AND`, `OR`, `NOT`, `IN`, `EXISTS`, `CONTAINS`, `MATCHES`
  - Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`
  - Span attributes: `span.duration`, `span.name`, `span.attributes["key"]`
  - Literals: strings, numbers, booleans (`true`, `false`, `null`)
  - Comments: `//` line comments, `/* */` block comments

- ✅ **Autocomplete (Ctrl+Space)**
  - Span attributes: `span.duration`, `span.name`, `span.status.code`, `span.attributes["key"]`
  - Common attributes: `http.status_code`, `http.method`, `db.system`, `db.statement`
  - Keywords: `AND`, `OR`, `NOT`, `EXISTS`, `CONTAINS`, `MATCHES`
  - Example patterns: `slow-query`, `http-error`, `unauthorized`

- ✅ **Real-Time DSL Validation**
  - Balanced brackets checking
  - Valid attribute syntax verification
  - Unknown keyword detection
  - Error markers with diagnostic messages

- ✅ **Editor Features**
  - Line numbers
  - Syntax highlighting
  - Auto-closing pairs (`()`, `[]`, `{}`, `""`, `''`)
  - Word wrap
  - No minimap (cleaner UI)
  - Configurable theme (`vs-light` / `vs-dark`)

---

### 2. Rule Modal Component

**File:** [signoz-betrace-app/src/components/RuleModal.tsx](signoz-betrace-app/src/components/RuleModal.tsx)

**Features:**
- ✅ **Create/Edit Modes**
  - Create new rule (empty form)
  - Edit existing rule (pre-populated form)

- ✅ **Rule Templates (6 pre-built)**
  1. **Slow Database Query** - `span.duration > 1000000000 AND span.attributes["db.system"] EXISTS` (medium severity)
  2. **HTTP 5xx Errors** - `span.attributes["http.status_code"] >= 500` (high severity)
  3. **Unauthorized Access** - `span.attributes["http.status_code"] == 401` (medium severity)
  4. **Failed Payment Transaction** - `span.name CONTAINS "payment" AND span.status.code == 2` (critical severity)
  5. **PII Access Without Audit** - `span.attributes["pii.accessed"] == true AND NOT span.attributes["audit.logged"]` (critical severity)
  6. **High Memory Usage** - `span.attributes["process.runtime.memory.used"] > 1000000000` (high severity)

- ✅ **Form Fields**
  - Rule Name (required)
  - Description (optional)
  - BeTraceDSL Pattern (required, with Monaco editor)
  - Severity (low/medium/high/critical)
  - Enabled checkbox

- ✅ **Validation**
  - Real-time DSL validation via Monaco editor
  - Name required validation
  - Error display with specific error messages

- ✅ **UX Enhancements**
  - Template selection grid (show templates in create mode)
  - "Start from scratch" option
  - Visual severity selector (colored buttons)
  - Save/Update button disabled until valid
  - Loading state during save

---

### 3. Updated Rules Page

**File:** [signoz-betrace-app/src/routes/rules.tsx](signoz-betrace-app/src/routes/rules.tsx)

**Changes:**
- ✅ Wired up "Create Rule" button → opens RuleModal
- ✅ Wired up "Edit" button → opens RuleModal with rule data
- ✅ Wired up "Delete" button with confirmation dialog
- ✅ Added `createMutation` for creating rules
- ✅ Added `updateMutation` for editing rules
- ✅ Replaced "Monaco Coming Soon" banner with "Monaco Active" feature banner

**Mutations:**
```typescript
createMutation: POST /api/rules
updateMutation: PUT /api/rules/{id}
deleteMutation: DELETE /api/rules/{id}
toggleMutation: PATCH /api/rules/{id} (enable/disable)
```

---

## User Experience

### Creating a New Rule

1. Click "Create Rule" button
2. **See template selector** with 6 pre-built templates
3. Select a template (or "Start from scratch")
4. **Monaco editor loads** with syntax highlighting
5. Edit rule name, description, DSL pattern
6. **Ctrl+Space** for autocomplete suggestions
7. **See real-time validation** (errors highlighted)
8. Select severity (low/medium/high/critical)
9. Toggle "Enable this rule immediately"
10. Click "Create Rule" (disabled until valid)

### Editing an Existing Rule

1. Click "Edit" button on any rule
2. **Monaco editor loads** with rule's current DSL
3. Edit any field (name, description, DSL, severity, enabled)
4. **Real-time validation** as you type
5. Click "Update Rule"

### Autocomplete Examples

**Trigger:** Type `span.` then press **Ctrl+Space**

**Suggestions:**
- `span.duration` - Span duration in nanoseconds
- `span.name` - Span operation name
- `span.status.code` - Span status code (0=OK, 1=ERROR, 2=UNSET)
- `span.attributes[""]` - Span attribute by key

**Trigger:** Type `http` then press **Ctrl+Space**

**Suggestions:**
- `http.status_code` → expands to `span.attributes["http.status_code"]`
- `http.method` → expands to `span.attributes["http.method"]`

**Trigger:** Type `AND` then press **Ctrl+Space**

**Suggestions:**
- `AND ` - Logical AND
- `OR ` - Logical OR
- `NOT ` - Logical NOT
- `EXISTS` - Check if attribute exists
- `CONTAINS ""` - Check if string contains substring
- `MATCHES ""` - Match against regular expression

---

## Technical Details

### Dependencies Added

```json
{
  "@monaco-editor/react": "^4.6.0",
  "monaco-editor": "^0.45.0"
}
```

### Language Definition

**Language ID:** `betrace-dsl`

**Tokens:**
- Keywords: `AND`, `OR`, `NOT`, `IN`, `EXISTS`, `CONTAINS`, `MATCHES`, `true`, `false`, `null`
- Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `+`, `-`, `*`, `/`, `%`
- Attributes: `span.*`, `trace.*`, `resource.*`
- Strings: `"..."`, `'...'`
- Numbers: `123`, `45.67`
- Comments: `// ...`, `/* ... */`

### Validation Rules

1. **Non-empty DSL** - DSL cannot be empty
2. **Balanced brackets** - All `()`, `[]`, `{}` must be balanced
3. **Valid attribute syntax** - `span.attributes["key"]` format required
4. **No unknown keywords** - All uppercase words must be valid keywords

---

## Files Changed

**Commit:** `daa4aab` - feat(signoz): add Monaco editor for BeTraceDSL editing

**Files:**
1. `signoz-betrace-app/package.json` - Added Monaco editor dependencies
2. `signoz-betrace-app/src/components/MonacoEditor.tsx` - New Monaco editor component (343 lines)
3. `signoz-betrace-app/src/components/RuleModal.tsx` - New rule modal component (280 lines)
4. `signoz-betrace-app/src/routes/rules.tsx` - Updated rules page (262 lines)

**Total:** 4 files changed, 819 insertions(+), 29 deletions(-)

---

## Testing

### Manual Testing

✅ **Create Rule:**
1. Open SigNoz app: `http://localhost:3001/rules`
2. Click "Create Rule"
3. Select a template (e.g., "Slow Database Query")
4. Verify Monaco editor loads with syntax highlighting
5. Edit DSL pattern
6. Press Ctrl+Space → verify autocomplete works
7. Click "Create Rule"
8. Verify rule appears in list

✅ **Edit Rule:**
1. Click "Edit" on any rule
2. Verify Monaco editor loads with rule's DSL
3. Modify DSL pattern
4. Verify real-time validation
5. Click "Update Rule"
6. Verify changes saved

✅ **Validation:**
1. Create rule with empty DSL → verify error: "DSL cannot be empty"
2. Create rule with unbalanced brackets: `span.duration > (1000` → verify error: "Unclosed brackets"
3. Create rule with invalid attribute syntax: `span.attributes[db.system]` → verify error: "Invalid span.attributes syntax"
4. Create rule with unknown keyword: `span.duration GREATER 1000` → verify error: "Unknown keyword: GREATER"

---

## Next Steps (Remaining Priority 3 Tasks)

### 1. Violation Export (CSV/JSON)

**Backend:** Add `/v1/violations/export` endpoint
```go
GET /v1/violations/export?format=csv&ruleId=123
GET /v1/violations/export?format=json&ruleId=123
```

**Frontend:** Add "Export" button to Violations page

### 2. Rule Templates Library

Expand templates from 6 to 20+:
- Security patterns (SQL injection, XSS, CSRF)
- Performance patterns (slow queries, high CPU, memory leaks)
- Compliance patterns (PII access, audit logging, data retention)
- Reliability patterns (timeouts, retries, circuit breakers)

### 3. Advanced Monaco Features

- **Hover tooltips** - Show attribute descriptions on hover
- **Diagnostics panel** - Show all validation errors in a panel
- **Code actions** - Quick fixes for common errors
- **Snippets** - More complex DSL patterns

---

## Success Criteria

✅ **Priority 3 (Partial) - Monaco Editor COMPLETE**

All Monaco editor requirements met:
- ✅ Custom BeTraceDSL language definition
- ✅ Syntax highlighting
- ✅ Autocomplete (Ctrl+Space)
- ✅ Real-time validation with error markers
- ✅ Rule creation modal
- ✅ Rule editing modal
- ✅ 6 pre-built templates
- ✅ Integrated into Rules page

**Status:** Monaco editor feature complete and committed (commit `daa4aab`)

**Remaining Priority 3:**
- ⏸️ Violation export (CSV/JSON)
- ⏸️ Expanded rule templates library
- ⏸️ Advanced Monaco features (hover, diagnostics, snippets)

---

## User Feedback

**Before:**
> "Monaco editor integration for BeTraceDSL will be available in the next update."

**After:**
> "BeTraceDSL rule editor with syntax highlighting, autocomplete, and real-time validation is now available! Click 'Create Rule' or 'Edit' to try it out."

**Features highlighted:**
- ✅ Syntax highlighting for BeTraceDSL
- ✅ Autocomplete (Ctrl+Space) for attributes and operators
- ✅ 6 pre-built rule templates
- ✅ Real-time DSL validation

---

## Screenshots (Conceptual)

### Rule Creation Modal - Template Selector
```
┌─────────────────────────────────────────────────────────────┐
│  Create New Rule                                       [X]   │
├─────────────────────────────────────────────────────────────┤
│  Start from template                [Start from scratch]    │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Slow DB Query   │  │ HTTP 5xx Errors │                  │
│  │ [medium]        │  │ [high]          │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Unauthorized    │  │ Failed Payment  │                  │
│  │ [medium]        │  │ [critical]      │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ PII Without     │  │ High Memory     │                  │
│  │ Audit [critical]│  │ [high]          │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Monaco Editor with Autocomplete
```
┌─────────────────────────────────────────────────────────────┐
│  BeTraceDSL Pattern *                                        │
├─────────────────────────────────────────────────────────────┤
│ 1  span.duration > 1000 AND span.                           │
│                                  │                           │
│                                  ▼                           │
│                            ┌─────────────────────────────┐  │
│                            │ span.duration               │  │
│                            │ span.name                   │  │
│                            │ span.status.code            │  │
│                            │ span.attributes[""]         │  │
│                            └─────────────────────────────┘  │
│                                                              │
│  Use Ctrl+Space for autocomplete                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [SigNoz App README](signoz-betrace-app/README.md) - SigNoz app overview
- [Integration Testing](docs/integration-testing.md) - Integration test suite
- [BeTraceDSL Reference](docs/betrace-dsl.md) - DSL language specification
