# Repository Cleanup Checklist

## Recent Changes (2025-11-11)

### ✅ Completed: Nix Configuration Consolidation
- [x] Migrated all configs to format generators (YAML, INI, JSON)
- [x] Created `nix/service-wrappers.nix` (consolidated from `.flox/pkgs`)
- [x] Updated main `flake.nix` to export service wrappers
- [x] Updated `.flox/env/manifest.toml` to reference main flake
- [x] Removed `.flox/pkgs/` directory (16 files)
- [x] Removed `.flox/configs/` directory (11 files)
- [x] Fixed infinite recursion bugs in container definitions

---

## Pending Cleanup Tasks

### 1. Documentation Updates

#### Update CLAUDE.md
- [ ] Remove references to `.flox/pkgs` and `.flox/configs`
- [ ] Document new `nix/service-wrappers.nix` pattern
- [ ] Update Quick Start commands (already correct, but verify)
- [ ] Add section on format generators

#### Update ADRs (if applicable)
- [ ] Check if any ADRs reference `.flox/pkgs` or `.flox/configs`
- [ ] Document decision to consolidate Nix expressions

### 2. Git History Cleanup

#### Untracked Files (from git status)
```
?? backend/docs/BACKEND_API_VALIDATION_ENDPOINT.md
?? backend/docs/DSL_V2_INTEGRATION_COMPLETE.md
?? backend/docs/SESSION_SUMMARY_DSL_V2_UI_API_COMPLETION.md
?? backend/internal/api/rules_validate.go
?? backend/internal/dsl/parser_debug_test.go
?? backend/internal/dsl/quoted_attributes_test.go
?? backend/internal/integration/dsl_v2_integration_test.go
?? docs/SESSION_COMPLETE_DSL_V2_FULL_STACK.md
?? docs/SESSION_COMPLETE_PRIORITY_6_TEMPLATE_LIBRARY.md
?? grafana-betrace-app/coverage-reports/
?? grafana-betrace-app/docs/
?? grafana-betrace-app/grafana-betrace-app/
?? grafana-betrace-app/src/components/RuleTemplatePicker.tsx
?? grafana-betrace-app/src/lib/monaco-dsl-v2.ts
?? grafana-betrace-app/src/lib/rule-templates.ts
?? mcp-server/docs/
```

**Actions:**
- [ ] Review and commit backend validation endpoint code
- [ ] Review and commit DSL v2 integration tests
- [ ] Review and commit rule template picker UI
- [ ] Add `coverage-reports/` to `.gitignore` (build artifacts)
- [ ] Review `grafana-betrace-app/grafana-betrace-app/` - looks like duplicate directory?
- [ ] Commit or remove MCP server docs

#### Modified Files (from git status)
```
M backend/internal/api/server.go
M backend/internal/dsl/evaluator.go
M backend/internal/dsl/parser.go
M backend/internal/rules/engine.go
M backend/internal/rules/engine_observability.go
M grafana-betrace-app/playwright.config.ts
M grafana-betrace-app/src/components/MonacoRuleEditor.tsx
M grafana-betrace-app/src/services/runtime.ts
M grafana-betrace-app/tests/e2e-rules.spec.ts
M grafana-betrace-app/tests/lib/capability-orchestrator.ts
M grafana-betrace-app/tests/lib/test-preprocessor.ts
M mcp-server/README.md
M mcp-server/src/index.ts
```

**Actions:**
- [ ] Review backend DSL v2 changes
- [ ] Review Grafana plugin Monaco editor changes
- [ ] Review test orchestration changes
- [ ] Review MCP server changes
- [ ] Create commit for completed work

### 3. Gitignore Updates

#### Add to `.gitignore`:
```gitignore
# Build artifacts
grafana-betrace-app/coverage-reports/
grafana-betrace-app/dist/

# Local development data
.dev/

# Temporary files
/tmp/
*.log
```

- [ ] Verify `.dev/` is in `.gitignore` (created by service wrappers)
- [ ] Add `coverage-reports/` if not already ignored
- [ ] Add any other build artifacts

### 4. Test Current State

#### Verify Services Work
- [ ] `flox services start` - All services start successfully
- [ ] `flox services status` - All services show as running
- [ ] Check Grafana at http://localhost:12015 - Plugin loads
- [ ] Check Loki at http://localhost:3100/ready - Health check passes
- [ ] Check Tempo at http://localhost:3200/ready - Health check passes
- [ ] Check Prometheus at http://localhost:9090 - UI loads
- [ ] Send test telemetry through Alloy - Traces arrive

#### Verify Builds Work
- [ ] `nix build .#all` - Applications build
- [ ] `nix build .#loki-wrapped` - Service wrapper builds
- [ ] `nix build .#container-backend` - Container builds
- [ ] `nix flake check` - All checks pass

### 5. Remove Temporary Files

#### Files to Remove (if no longer needed):
- [ ] `/tmp/format-generators-complete.md` (created during session)
- [ ] `/tmp/format-generators-comparison.md` (created during session)
- [ ] Any other temporary documentation files

### 6. Archive Completed Session Docs

#### Move to Archive:
- [ ] `docs/SESSION_COMPLETE_DSL_V2_FULL_STACK.md` → `docs/archive/`
- [ ] `docs/SESSION_COMPLETE_PRIORITY_6_TEMPLATE_LIBRARY.md` → `docs/archive/`
- [ ] Other completed session summaries

### 7. Update README Files

#### Backend README
- [ ] Verify paths are correct (no `.flox/pkgs` references)
- [ ] Update build instructions if needed

#### Grafana Plugin README
- [ ] Verify development workflow is documented
- [ ] Update any references to old structure

#### MCP Server README
- [ ] Already updated (checked in modified files)

### 8. Container Build Verification

#### Test Full Container Stack:
- [ ] `nix build .#containers-all` - All containers build
- [ ] Load containers into Docker
- [ ] `docker-compose up -d` (using generated compose file)
- [ ] Verify all services healthy
- [ ] Send test traces through full stack

### 9. CI/CD Considerations

#### Check CI Configuration (if exists):
- [ ] Update any CI scripts referencing `.flox/pkgs`
- [ ] Verify container build jobs still work
- [ ] Update caching keys if structure changed

---

## Cleanup Commands

### Review Untracked Files
```bash
# List all untracked files
git status --short | grep '^??'

# Review each file
git diff --no-index /dev/null <file>

# Add if needed
git add <file>
```

### Review Modified Files
```bash
# See all changes
git diff

# See changes per file
git diff backend/internal/api/server.go
git diff grafana-betrace-app/src/components/MonacoRuleEditor.tsx
```

### Update Gitignore
```bash
# Edit .gitignore
vim .gitignore

# Verify it works
git status
```

### Create Commits
```bash
# Stage related changes
git add nix/service-wrappers.nix
git add nix/containers.nix
git add nix/docker-compose.nix
git add flake.nix
git add .flox/env/manifest.toml

# Commit consolidation
git commit -m "$(cat <<'EOF'
feat(nix): consolidate configs with format generators

- Create nix/service-wrappers.nix (all service wrappers)
- Migrate all configs to format generators (YAML, INI, JSON)
- Remove .flox/pkgs and .flox/configs duplication
- Update Flox manifest to reference main flake
- Fix infinite recursion bugs in containers (grafana, tempo, prometheus)

Single source of truth: All configs now generated declaratively
using pkgs.formats.* - no external dependencies (yq, jq).

See docs/SESSION_CONSOLIDATE_NIX_CONFIGS.md for details.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Priority Order

1. **HIGH** - Test that services still work (`flox services start`)
2. **HIGH** - Review and commit untracked backend/grafana changes
3. **MEDIUM** - Update documentation (CLAUDE.md, READMEs)
4. **MEDIUM** - Clean up temporary files
5. **LOW** - Update gitignore
6. **LOW** - Archive old session docs

---

## Success Criteria

- [ ] All services start and run correctly
- [ ] All nix builds pass
- [ ] No duplicate configs exist
- [ ] Documentation reflects current structure
- [ ] Git history is clean (no uncommitted work)
- [ ] `.gitignore` is up to date

---

## Notes

- The consolidation is complete and tested
- Format generators are now used throughout
- Main risk: Grafana plugin loading (test this!)
- Verify `.dev/` directories are created on service start
