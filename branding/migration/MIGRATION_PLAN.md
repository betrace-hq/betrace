# FLUO → BeTrace Migration Plan

**Date**: 2025-10-23
**Status**: 🚧 **IN PROGRESS**
**Total Files**: ~886 files to process

---

## Migration Strategy

### Phase 1: Documentation & Branding (Week 1)
- [x] Create branding guidelines
- [ ] Update CLAUDE.md
- [ ] Update all markdown documentation
- [ ] Update marketing materials

### Phase 2: Code & Configuration (Week 2)
- [ ] Update package.json files
- [ ] Rename DSL (FluoDSL → BeTraceDSL)
- [ ] Update API endpoints
- [ ] Update span attributes
- [ ] Update Java package names

### Phase 3: Grafana Plugin (Week 2)
- [ ] Update plugin.json metadata
- [ ] Update plugin IDs
- [ ] Update UI text
- [ ] Update screenshots

### Phase 4: Testing & Validation (Week 3)
- [ ] Run all tests
- [ ] Verify builds
- [ ] Check broken links
- [ ] Validate API compatibility

### Phase 5: Deployment (Week 4)
- [ ] Create migration announcement
- [ ] Update GitHub repository
- [ ] Publish to Grafana marketplace
- [ ] Set up redirects

---

## Naming Conventions

### Brand Name
- ❌ FLUO, Fluo, fluo
- ✅ BeTrace (capital B, capital T)

### DSL Name
- ❌ FluoDSL, FLUO DSL
- ✅ BeTraceDSL, BeTrace DSL

### Technical Identifiers

**Package Names**:
- ❌ com.fluo.*
- ✅ com.betrace.*

**API Endpoints**:
- ❌ /api/fluo/*
- ✅ /api/betrace/*

**Span Attributes**:
- ❌ span.fluo.*
- ✅ span.betrace.*

**Plugin IDs**:
- ❌ fluo-app, fluo-datasource
- ✅ betrace-app, betrace-datasource

**NPM Packages**:
- ❌ @fluo/*, fluo-*
- ✅ @betrace/*, betrace-*

**Environment Variables**:
- ❌ FLUO_*, FLUO_*
- ✅ BETRACE_*

---

## File-by-File Changes

### High Priority (User-Facing)

**CLAUDE.md**:
- [ ] Replace "FLUO" → "BeTrace"
- [ ] Update tagline
- [ ] Update core purpose section
- [ ] Update quick start URLs

**README.md** (root):
- [ ] Update project title
- [ ] Update description
- [ ] Update badges (if any)

**package.json** files:
- [ ] backend/package.json → name: "betrace-backend"
- [ ] bff/package.json → name: "betrace-bff"
- [ ] grafana-fluo-app/package.json → name: "betrace-grafana-app"

**Grafana Plugin**:
- [ ] grafana-fluo-app/src/plugin.json → id: "betrace-app"
- [ ] Update display name, description
- [ ] Update logo references

### Medium Priority (Internal Docs)

**ADRs** (docs/adrs/):
- [ ] Update all ADR references to FLUO
- [ ] Add ADR-028: FLUO → BeTrace Rebrand

**PRDs** (docs/prds/):
- [ ] Update product references
- [ ] Add PRD-200: BeTrace Rebrand Implementation

**Marketing** (marketing/):
- [ ] Update all marketing docs
- [ ] Update sales deck
- [ ] Update positioning docs

### Low Priority (Code)

**Java Source** (backend/src/):
- [ ] Package renames (com.fluo → com.betrace)
- [ ] Class name updates
- [ ] JavaDoc updates
- [ ] Log message updates

**TypeScript/React** (bff/, grafana-fluo-app/):
- [ ] Component names
- [ ] Type definitions
- [ ] UI text strings
- [ ] API client references

---

## Breaking Changes

### API Compatibility

**Backwards Compatibility Period**: 6 months (dual support)

**Old Endpoints** (deprecated, but functional):
- /api/fluo/rules → redirect to /api/betrace/rules
- /api/fluo/violations → redirect to /api/betrace/violations

**New Endpoints** (preferred):
- /api/betrace/rules
- /api/betrace/violations

**Deprecation Headers**:
```
X-BeTrace-Deprecated: This endpoint is deprecated. Use /api/betrace/* instead.
X-BeTrace-Sunset: 2025-04-23
```

### Span Attributes

**Old Attributes** (still emitted during transition):
- span.fluo.violation
- span.fluo.rule_id

**New Attributes** (primary):
- span.betrace.violation
- span.betrace.rule_id

**Transition Strategy**: Emit both for 6 months

### Grafana Plugin

**Old Plugin ID**: fluo-app (will remain for existing installs)
**New Plugin ID**: betrace-app (new installs)

**Migration Path**:
1. Existing users: Plugin auto-updates, data preserved
2. New users: Install betrace-app directly
3. After 6 months: Deprecate fluo-app, full cutover

---

## Search & Replace Plan

### Global Find/Replace (Safe)

**Markdown Files** (.md):
```bash
# Brand name
FLUO → BeTrace
Fluo → BeTrace

# DSL name
FluoDSL → BeTraceDSL
FLUO DSL → BeTrace DSL

# URLs
fluo.dev → betrace.dev
fluohq → betracehq
```

**Documentation Only** (not code):
```bash
# Product descriptions
"Behavioral Assurance System" → "Behavioral Pattern Matching Plugin"
"behavioral assurance" → "behavioral assertions"
```

### Targeted Replace (Code)

**Java Package Names**:
```bash
# Replace in all .java files
package com.fluo → package com.betrace
import com.fluo → import com.betrace
```

**API Routes**:
```bash
# Replace in route definitions
/api/fluo/ → /api/betrace/
"/api/fluo/" → "/api/betrace/"
```

**Span Attributes**:
```bash
# Replace in instrumentation code
"span.fluo." → "span.betrace."
span.fluo. → span.betrace.
```

**Environment Variables**:
```bash
# Replace in config files
FLUO_ → BETRACE_
${FLUO_ → ${BETRACE_
```

---

## Validation Checklist

### Build Validation
- [ ] Backend builds successfully
- [ ] Frontend builds successfully
- [ ] Grafana plugin builds successfully
- [ ] All tests pass

### Documentation Validation
- [ ] No broken internal links
- [ ] All code examples updated
- [ ] Screenshots reflect new branding
- [ ] ADRs reference correct names

### Functional Validation
- [ ] API endpoints respond correctly
- [ ] Grafana plugin installs
- [ ] Rules can be created/edited
- [ ] Violations appear in Tempo
- [ ] Alerts trigger correctly

### SEO/Marketing Validation
- [ ] Domain redirects work (fluo.dev → betrace.dev)
- [ ] GitHub repository updated
- [ ] NPM packages published
- [ ] Grafana marketplace listing updated

---

## Risk Mitigation

### Backup Plan
1. **Before starting**: Git branch `fluo-to-betrace-migration`
2. **Tag current state**: `git tag v1.0.0-fluo-final`
3. **Incremental commits**: Commit after each phase
4. **Rollback ready**: Can revert to tag if needed

### Testing Strategy
1. Run tests after each category of changes
2. Manual smoke test after API changes
3. Integration test after span attribute changes
4. Full regression test before merge

### Communication Plan
1. **Internal**: Team notification before starting
2. **Users**: Migration announcement blog post
3. **Community**: GitHub discussion thread
4. **Support**: FAQ for common migration questions

---

## Timeline

### Week 1: Documentation (Oct 23-27)
- Mon: Branding guidelines ✅
- Tue: CLAUDE.md, README.md updates
- Wed: ADRs, PRDs updates
- Thu: Marketing materials
- Fri: Documentation validation

### Week 2: Code (Oct 28 - Nov 3)
- Mon: Package.json, plugin metadata
- Tue: Java package renames
- Wed: API endpoints, span attributes
- Thu: UI text, component names
- Fri: Code validation, tests

### Week 3: Testing (Nov 4-10)
- Mon-Wed: Functional testing
- Thu: Integration testing
- Fri: User acceptance testing

### Week 4: Launch (Nov 11-17)
- Mon: Final validation
- Tue: Merge to main
- Wed: Deploy to staging
- Thu: Production deployment
- Fri: Announcement, monitoring

---

## Files to Update (Detailed)

### Root Directory
- [ ] CLAUDE.md
- [ ] README.md
- [ ] flake.nix (descriptions, metadata)
- [ ] .envrc (if references FLUO)

### Backend (backend/)
- [ ] backend/pom.xml (groupId, artifactId)
- [ ] backend/README.md
- [ ] backend/src/main/java/com/fluo/** (package rename)
- [ ] backend/src/main/resources/application.properties (configs)
- [ ] backend/src/test/java/com/fluo/** (test package rename)

### Frontend (bff/)
- [ ] bff/package.json
- [ ] bff/README.md
- [ ] bff/src/** (component imports, API calls)
- [ ] bff/vite.config.ts (if references fluo)

### Grafana Plugin (grafana-fluo-app/)
- [ ] grafana-fluo-app/package.json
- [ ] grafana-fluo-app/README.md
- [ ] grafana-fluo-app/src/plugin.json (**CRITICAL**)
- [ ] grafana-fluo-app/src/module.ts
- [ ] grafana-fluo-app/src/**/*.tsx (UI text)

### Documentation (docs/)
- [ ] docs/README.md
- [ ] docs/adrs/*.md (all ADRs)
- [ ] docs/prds/*.md (all PRDs)
- [ ] docs/compliance*.md
- [ ] docs/technical/*.md

### Marketing (marketing/)
- [ ] marketing/README.md
- [ ] marketing/docs/*.md
- [ ] marketing/sales/*.md
- [ ] marketing/blog-posts/*.md
- [ ] marketing/landing/*.html

### Tests
- [ ] backend/src/test/** (all test files)
- [ ] bff/src/**/*.test.ts
- [ ] bff/src/**/*.spec.ts

---

## Automated Migration Script

```bash
#!/bin/bash
# migrate-fluo-to-betrace.sh

set -e

echo "🚀 Starting FLUO → BeTrace migration..."

# Phase 1: Markdown files (safe, documentation only)
echo "📝 Phase 1: Updating markdown files..."
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/.git/*" \
  -exec sed -i '' 's/FLUO/BeTrace/g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -exec sed -i '' 's/FluoDSL/BeTraceDSL/g' {} +

# Phase 2: Package metadata
echo "📦 Phase 2: Updating package.json files..."
# (Manual, requires careful review)

# Phase 3: Java code
echo "☕ Phase 3: Updating Java packages..."
# (Manual, requires IDE refactoring tools)

# Phase 4: API routes
echo "🛣️ Phase 4: Updating API routes..."
# (Manual, requires testing)

# Phase 5: Validation
echo "✅ Phase 5: Running tests..."
# Run test suite

echo "✨ Migration complete! Review changes before committing."
```

---

## Post-Migration Tasks

### Immediate (Day 1)
- [ ] Announce rebrand on GitHub
- [ ] Update social media (Twitter, LinkedIn)
- [ ] Email existing users (if any)

### Short-Term (Week 1)
- [ ] Monitor error logs for issues
- [ ] Answer community questions
- [ ] Fix any critical bugs

### Medium-Term (Month 1)
- [ ] Publish Grafana marketplace listing
- [ ] Update all external references
- [ ] SEO optimization for "BeTrace"

### Long-Term (Month 3-6)
- [ ] Remove FLUO compatibility layer
- [ ] Archive old documentation
- [ ] Full trademark filing (if not done)

---

## Success Criteria

✅ **Migration Complete When**:
1. All 886 files reviewed and updated
2. All tests passing
3. Builds successful (backend, frontend, plugin)
4. Documentation validated
5. No broken links
6. Grafana plugin installable
7. API backwards compatible
8. Announcement published

---

## Contact & Support

**Migration Lead**: Engineering Team
**Questions**: Create GitHub issue with `migration` label
**Emergency Rollback**: Contact team lead immediately

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Next Review**: After Phase 1 completion
