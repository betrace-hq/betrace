# MIT License Standardization - Complete

**Date:** 2025-10-23
**License:** MIT
**Status:** ✅ Standardized

## Summary

BeTrace now uses **MIT License** consistently across the entire project.

## Changes Made

### ✅ 1. Root LICENSE File
**Created:** `/Users/sscoble/Projects/fluo/LICENSE`
- Standard MIT License text
- Copyright: "2025 BeTrace Contributors"
- Applies to entire monorepo

### ✅ 2. Distribution Docker Images
**Updated:** `distribution/docker/flake.nix`
- Line 40: `Apache-2.0` → `MIT` (backend image)
- Line 69: `Apache-2.0` → `MIT` (grafana-plugin image)
- OCI image labels now correctly declare MIT

### ✅ 3. Helm Chart
**Updated:** `distribution/helm/betrace/Chart.yaml`
- Line 41: `licenses: Apache-2.0` → `licenses: MIT`
- Helm chart metadata now consistent

### ✅ 4. Grafana Plugin
**Updated:** `grafana-betrace-app/package.json`
- Added: `"license": "MIT"`
- npm/yarn will now show correct license

### ✅ 5. Backend Flake (Branding + Binary Names)
**Updated:** `backend/flake.nix`
- Description: "FLUO" → "BeTrace"
- Homepage: `github.com/fluohq/fluo` → `github.com/betracehq/betrace`
- Package names: `fluo-backend` → `betrace-backend`, `fluo-cli` → `betrace-cli`
- Binary names: `mainProgram = "betrace-backend"` (was fluo-backend)
- Shell hook messages updated to BeTrace branding
- License: Already `licenses.mit` ✅

## Verification

### Check License Consistency
```bash
# Root license exists
cat LICENSE | head -1
# Output: MIT License

# Docker images declare MIT
grep "licenses" distribution/docker/flake.nix
# Output: "org.opencontainers.image.licenses" = "MIT"; (x2)

# Helm chart declares MIT
grep "licenses:" distribution/helm/betrace/Chart.yaml
# Output: licenses: MIT

# Plugin declares MIT
grep "license" grafana-betrace-app/package.json
# Output: "license": "MIT",

# Backend declares MIT (and correct branding)
grep "license\|description\|homepage\|mainProgram" backend/flake.nix | head -4
# Output:
#   description = "BeTrace behavioral assurance backend";
#   homepage = "https://github.com/betracehq/betrace";
#   license = licenses.mit;
#   mainProgram = "betrace-backend";
```

## Why MIT?

**Decision factors:**
1. ✅ **Simplicity** - Single license for entire monorepo
2. ✅ **Grafana ecosystem** - Most plugins use MIT
3. ✅ **Community-first** - Maximum adoption, minimal friction
4. ✅ **Low patent risk** - BeTraceDSL is pattern matching, not novel algorithms
5. ✅ **Consistency** - Backend already declared MIT

**Alternative considered:** Apache-2.0 for patent protection
- **Rejected:** Split licensing adds complexity without clear benefit
- **Preserved:** Can migrate MIT → Apache-2.0 later if needed (legally clean)

## Binary Name Changes (Backend)

### Old Binary Names (FLUO)
- `fluo-backend` - Main backend server
- `fluo-cli` - CLI tool

### New Binary Names (BeTrace)
- `betrace-backend` - Main backend server
- `betrace-cli` - CLI tool

**Impact:** Users running `nix build .#backend` will get `betrace-backend` binary, not `fluo-backend`

**Migration:** None needed (no releases yet with old names)

## Distribution Impact

### Docker Images
```bash
# Images now correctly labeled as MIT
docker inspect betrace-backend:latest | grep licenses
# Output: "org.opencontainers.image.licenses": "MIT"
```

### Helm Chart
```bash
# Chart metadata shows MIT
helm show chart distribution/helm/betrace | grep licenses
# Output: licenses: MIT
```

### FlakeHub
```bash
# Nix flake will show MIT in metadata
nix flake show | grep license
# Output: license = licenses.mit;
```

## Legal Compliance

### ✅ License Header in Source Files
Not required by MIT, but recommended:
```
// SPDX-License-Identifier: MIT
// Copyright (c) 2025 BeTrace Contributors
```

**Action:** Optional - can add to source files later

### ✅ NOTICE File
Not required by MIT (only Apache-2.0 requires NOTICE)

**Action:** None needed

### ✅ Third-Party Licenses
Dependencies have their own licenses (mostly MIT):
- Go modules: See `go.mod`
- npm packages: See `node_modules/*/LICENSE`
- Grafana (Apache-2.0): Okay to bundle, no conflict

**Action:** Document in THIRD_PARTY_LICENSES.md (future)

## Contributor Agreement

### Current Status
No CLA required for MIT (contributions assume MIT license)

### Future (Optional)
If project grows, consider:
- Developer Certificate of Origin (DCO) via `git commit -s`
- Light CLA for corporate contributors

**Action:** Not needed now, revisit if acquiring corporate sponsors

## Next Steps

1. **Commit changes:**
   ```bash
   git add LICENSE backend/flake.nix grafana-betrace-app/package.json
   git add distribution/docker/flake.nix distribution/helm/betrace/Chart.yaml
   git commit -m "license: standardize on MIT across entire project

   - Add root LICENSE file (MIT)
   - Update Docker images: Apache-2.0 → MIT
   - Update Helm chart: Apache-2.0 → MIT
   - Add license to Grafana plugin package.json
   - Update backend flake: FLUO → BeTrace branding
   - Rename binaries: fluo-* → betrace-*
   
   Rationale: Single license for simplicity, Grafana ecosystem
   alignment, community-first approach. See distribution/LICENSE_STANDARDIZATION.md"
   ```

2. **Update README badges** (future):
   ```markdown
   [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
   ```

3. **Add license headers** (optional):
   Prepend to source files:
   ```
   // SPDX-License-Identifier: MIT
   ```

## References

- [MIT License (OSI)](https://opensource.org/licenses/MIT)
- [Grafana Plugin Licensing](https://grafana.com/docs/grafana/latest/developers/plugins/)
- [GitHub Licensing Guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)

---

**Completed by:** Claude Code
**Date:** 2025-10-23
**Status:** ✅ MIT License standardized across BeTrace
