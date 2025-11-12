# Monaco Editor DSL v2.0 Integration - COMPLETE ✅

**Date:** November 11, 2025
**Status:** ✅ PRODUCTION READY
**Component:** Grafana BeTrace App Plugin

---

## Summary

The Grafana BeTrace app plugin now includes **full Monaco editor support for BeTraceDSL v2.0** with syntax highlighting, autocomplete, and real-time validation.

---

## Features Implemented

### 1. Custom Language Definition (`src/lib/monaco-dsl-v2.ts`)

**Syntax Highlighting:**
- Keywords: `when`, `always`, `never`, `and`, `or`, `not`, `where`, `count`, `in`, `matches`, `contains`
- Operators: `==`, `!=`, `<=`, `>=`, `<`, `>`, `=`
- Dotted identifiers: `payment.charge_card`, `agent.plan.created`
- Quoted attributes: `"data.contains_pii"`, `"http.status_code"`
- Strings, numbers, booleans, comments

**Autocomplete Suggestions:**
- Top-level keywords with snippets:
  - `when { ${1:condition} }`
  - `always { ${1:condition} }`
  - `never { ${1:condition} }`
- Boolean operators: `and`, `or`, `not`
- Functions: `count(${1:span.name})`
- Methods: `.where(${1:condition})`
- Common operation patterns:
  - `http.request`, `http.response`
  - `database.query`, `payment.charge_card`
  - `agent.tool_use`, `agent.plan.created`
  - `pii.access`, `audit.log`
- Comparison operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `in`, `matches`, `contains`
- Quoted attributes: `"data.contains_pii"`, `"user.id"`, `"http.status_code"`

**Real-time Validation:**
- Balanced braces check
- Balanced parentheses check
- Required `when` clause check
- At least one `always` or `never` clause check
- Unclosed string detection

### 2. Editor Component Updates (`src/components/MonacoRuleEditor.tsx`)

**Changes:**
- Changed `defaultLanguage="javascript"` to `defaultLanguage="betrace-dsl"`
- Registered custom DSL v2.0 language in `onMount` handler
- Removed 200+ lines of old DSL v1 autocomplete code
- Added real-time validation with Monaco markers
- Updated examples sidebar with DSL v2.0 patterns
- Updated test validation to check for `when-always-never` syntax

**Example Rules in Sidebar:**
```dsl
// Payment fraud check
when { payment.charge.where(amount > 1000) }
always { payment.fraud_check }

// PII access requires auth
when { database.query.where("data.contains_pii" == true) }
always { auth.check }

// AI agent tool approval
when { agent.tool_use.where(tool_requires_approval == true) }
always { human.approval_granted }

// Count mismatch detection
when { count(http.request) != count(http.response) }
always { alert }

// Audit logging
when { pii.access }
always { audit.log }

// Never allow unauthorized access
when { admin.action }
never { unauthorized_access }

// Chained where clauses
when { payment.charge.where(amount > 1000).where(currency == "USD") }
always { verification }
```

---

## Files Modified

### Created:
- `grafana-betrace-app/src/lib/monaco-dsl-v2.ts` - Custom language definition

### Updated:
- `grafana-betrace-app/src/components/MonacoRuleEditor.tsx` - Editor component integration

---

## Build Status

✅ **Build Successful** (no TypeScript errors)
⚠️ Warnings about Monaco editor asset size are expected and normal

```bash
cd grafana-betrace-app && npm run build
# webpack 5.102.1 compiled with 2 warnings in 27567 ms
```

---

## Usage

When users edit rules in the Grafana plugin:

1. **Syntax Highlighting**: DSL v2.0 keywords are automatically highlighted
2. **Autocomplete**: Type to see suggestions for keywords, operators, and patterns
3. **Real-time Validation**: Editor shows red squiggly lines for syntax errors
4. **Error Messages**: Hover over errors to see validation messages
5. **Examples**: Reference sidebar shows common DSL v2.0 patterns

---

## Technical Details

### Language Registration

```typescript
import { registerDSLLanguage, validateDSL } from '../lib/monaco-dsl-v2';

// In onMount handler:
if (!languageRegistered.current) {
  registerDSLLanguage(monacoInstance);
  languageRegistered.current = true;
}
```

### Real-time Validation

```typescript
useEffect(() => {
  if (editorRef.current && monacoRef.current && expression) {
    const markers = validateDSL(monacoRef.current, expression);
    const model = editorRef.current.getModel();
    if (model) {
      monacoRef.current.editor.setModelMarkers(model, 'betrace-dsl', markers);
    }
  }
}, [expression]);
```

### Autocomplete Context-Aware

The autocomplete provider analyzes cursor position and text context to provide relevant suggestions:

- After `when {` or `always {` → suggests span checks and boolean operators
- After operation name → suggests `.where()` method
- Inside `where()` → suggests quoted attributes and operators
- After attribute name → suggests comparison operators

---

## Next Steps (Optional Enhancements)

### Priority 3: Backend API Completeness
1. Add DSL v2.0 validation endpoint
2. Return detailed parse errors with line/column info
3. Provide rule testing with sample traces

### Priority 4: Template Library
1. Create 45 pre-built rule templates (from integration tests)
2. Add template picker UI component
3. Allow users to select and customize templates

### Priority 5: Enhanced Validation
1. Server-side DSL v2.0 validation on save
2. Attribute existence validation against Tempo schema
3. Type checking for attribute comparisons

---

## Conclusion

**Monaco editor DSL v2.0 integration is COMPLETE and ready for production use.**

Users can now create, edit, and validate DSL v2.0 rules with a professional code editor experience including syntax highlighting, autocomplete, and real-time error detection.

The integration seamlessly combines:
- ✅ Custom language definition with DSL v2.0 grammar
- ✅ Context-aware autocomplete suggestions
- ✅ Real-time syntax validation
- ✅ Professional Monaco editor UX
- ✅ Grafana plugin integration

---

*Generated: November 11, 2025*
*Component: Grafana BeTrace App Plugin*
*Status: ✅ COMPLETE*
