# PRD-010 Implementation Plan: Rule Management UI

This document outlines the implementation strategy for PRD-010, broken into independently implementable units.

## Overview

PRD-010 has been split into 5 focused units that can be implemented and tested independently. Units A and B form the foundation, while C, D, and E add progressive enhancements.

## Unit Breakdown

### Unit A: Monaco Editor with FLUO DSL Syntax Highlighting
**File:** `010a-monaco-dsl-editor.md`
**Priority:** P0 (Foundation)
**Dependencies:** None
**Estimated Effort:** 2-3 days

**What it delivers:**
- Professional code editor replacing basic textarea
- Syntax highlighting for FLUO DSL (trace.has, where, and, or, not)
- Auto-completion for DSL keywords and functions
- Bracket matching and indentation
- Integration point for validation markers (Unit B)

**Key files:**
- `bff/src/lib/monaco/fluo-dsl-language.ts` - Language definition
- `bff/src/components/rules/monaco-dsl-editor.tsx` - Editor component

**Why start here:**
- Foundation for all editing features
- Improves UX immediately
- Creates integration point for validation

---

### Unit B: Real-Time DSL Validation Feedback
**File:** `010b-real-time-validation.md`
**Priority:** P0 (Foundation)
**Dependencies:** Unit A (Monaco editor for error markers)
**Estimated Effort:** 3-4 days

**What it delivers:**
- Client-side FLUO DSL parser (lexer + parser)
- Real-time syntax validation with 300ms debounce
- Helpful error messages with suggestions
- Monaco editor markers (red squiggles under errors)
- Validation feedback UI component

**Key files:**
- `bff/src/lib/validation/dsl-parser.ts` - Parser implementation
- `bff/src/lib/validation/error-messages.ts` - Error message guide
- `bff/src/components/rules/validation-feedback.tsx` - UI feedback

**Why second:**
- Depends on Monaco for error marker display
- Prevents invalid rules from being saved
- Critical for good developer experience

---

### Unit C: Rule List Component Improvements
**File:** `010c-rule-list-improvements.md`
**Priority:** P0 (Productivity)
**Dependencies:** None (enhances existing rules-page.tsx)
**Estimated Effort:** 2-3 days

**What it delivers:**
- Advanced filtering (severity, status, tags, search)
- Bulk operations (enable/disable/delete/duplicate/export)
- Active filter display with removable badges
- Selection checkboxes in table
- Export rules to JSON

**Key files:**
- `bff/src/components/rules/rule-list-filters.tsx` - Filter UI
- `bff/src/components/rules/rule-bulk-actions.tsx` - Bulk actions toolbar
- Updates to `bff/src/components/rules/rules-page.tsx`

**Why third:**
- Independent of editor improvements
- High productivity impact for power users
- Can be implemented in parallel with A/B

---

### Unit D: Rule Testing Interface
**File:** `010d-rule-testing-interface.md`
**Priority:** P0 (Confidence)
**Dependencies:** Unit A (Monaco), Unit B (validation)
**Estimated Effort:** 3-4 days

**What it delivers:**
- Test rules against sample traces before activation
- Sample test cases library
- Custom trace JSON testing
- Test result visualization (matched spans, execution time)
- Save test cases for regression testing

**Key files:**
- `bff/src/components/rules/rule-test-interface.tsx` - Testing UI
- `bff/src/lib/hooks/use-test-rule.ts` - Backend API hook

**Backend requirement:**
- `POST /api/rules/test` endpoint for rule evaluation

**Why fourth:**
- Requires validated expressions (Unit B)
- High value for ensuring rules work correctly
- Reduces production debugging

---

### Unit E: Rule History and Version Tracking
**File:** `010e-rule-history-tracking.md`
**Priority:** P1 (Nice-to-have)
**Dependencies:** None (works with existing API)
**Estimated Effort:** 3-4 days

**What it delivers:**
- Version history for each rule (who, when, what changed)
- Diff view comparing versions
- Restore previous version capability
- Audit log of all rule operations
- Export audit trail for compliance

**Key files:**
- `bff/src/components/rules/rule-history.tsx` - History UI
- `bff/src/components/rules/audit-log.tsx` - Audit log UI
- `bff/src/lib/hooks/use-rule-history.ts` - API hooks

**Backend requirement:**
- `GET /api/rules/:id/history` endpoint
- `POST /api/rules/:id/restore` endpoint
- `GET /api/audit-log` endpoint

**Why last:**
- Not blocking for core functionality
- High compliance value
- Can be added after MVP is stable

---

## Recommended Implementation Order

### Phase 1: Foundation (Week 1)
1. **Unit A** (Monaco Editor) - Days 1-2
2. **Unit B** (Validation) - Days 3-5

**Milestone:** Users can write and validate FLUO DSL rules with professional editor experience.

### Phase 2: Productivity (Week 2)
3. **Unit C** (List Improvements) - Days 6-8
4. **Unit D** (Testing Interface) - Days 9-12

**Milestone:** Users can efficiently manage many rules and test them before deployment.

### Phase 3: Compliance (Week 3+)
5. **Unit E** (History Tracking) - Days 13-16

**Milestone:** Complete audit trail for compliance and debugging.

---

## Dependency Graph

```
Unit A (Monaco Editor)
  ↓
Unit B (Validation) ← depends on A for error markers
  ↓
Unit D (Testing) ← depends on A, B

Unit C (List Improvements) ← independent

Unit E (History) ← independent
```

**Critical Path:** A → B → D (foundation for rule authoring)
**Parallel Track:** C (can be built anytime)
**Enhancement:** E (adds compliance features)

---

## Backend API Requirements Summary

### Immediate (for Unit D):
- `POST /api/rules/test` - Evaluate rule against trace

### Future (for Unit E):
- `GET /api/rules/:id/history` - Fetch version history
- `POST /api/rules/:id/restore` - Restore previous version
- `GET /api/audit-log` - Fetch audit log entries

---

## Testing Strategy

Each unit includes:
- **Vitest Unit Tests** - Component logic and hooks
- **Storybook Stories** - Visual component documentation
- **Integration Tests** - API interactions (where applicable)

**Coverage Target:** 90% instruction coverage per FLUO standards

---

## Success Metrics

### Unit A + B (Foundation)
- [ ] 0 syntax errors reach backend (caught by client-side validation)
- [ ] <300ms validation response time
- [ ] All FLUO DSL keywords have autocomplete

### Unit C (Productivity)
- [ ] Bulk operations reduce time to enable/disable 10 rules by 80%
- [ ] Advanced filters reduce time to find specific rule by 60%

### Unit D (Confidence)
- [ ] 100% of new rules tested before activation
- [ ] <1% of rules fail in production (caught in testing)

### Unit E (Compliance)
- [ ] 100% of rule changes auditable
- [ ] Audit trail export in <5 seconds for any rule

---

## Notes for Implementation

1. **Monaco Editor Setup:** Add `monaco-editor` to package.json and configure Vite for web workers
2. **Parser Design:** Consider using recursive descent parser for FLUO DSL (simple, maintainable)
3. **Backend Coordination:** Unit D and E require new backend endpoints - coordinate with backend team
4. **Performance:** For >100 rules, consider virtualization in table (Unit C)
5. **Accessibility:** Ensure all components have ARIA labels and keyboard navigation

---

## Questions for Product/Engineering

1. **Backend API Priority:** When can `/api/rules/test` endpoint be available? (Blocks Unit D)
2. **Audit Log Storage:** Should audit logs be in separate database for compliance? (Unit E)
3. **Version History Retention:** How many versions to keep? (Unit E)
4. **Live Trace Testing:** Should Unit D include testing against production traces? (Nice-to-have)

---

## Related Documents

- **Parent PRD:** `/docs/prds/010-rule-management-ui.md`
- **FLUO DSL Reference:** `/docs/technical/trace-rules-dsl.md`
- **Architecture:** `/docs/adrs/011-pure-application-framework.md`
- **Frontend Guide:** `/bff/CLAUDE.md`
