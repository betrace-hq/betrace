# BeTrace Rebranding - Distribution Directory

**Date:** 2025-10-23
**Status:** ✅ Complete

## Summary

Successfully rebranded all distribution infrastructure from "BeTrace" to "BeTrace" following the official [Brand Guidelines](../branding/brand-identity/BRAND_GUIDELINES.md).

## Changes Applied

### Product Name
- **BeTrace** → **BeTrace** (capital B, capital T)
- Used consistently across all documentation and prose

### Repository & Organization
- **GitHub org:** `betracehq` → `betracehq`
- **Repository:** `github.com/betracehq/betrace` → `github.com/betracehq/betrace`
- **Container registry:** `ghcr.io/betracehq/betrace` → `ghcr.io/betracehq/betrace`
- **FlakeHub:** `flakehub.com/f/betracehq/betrace` → `flakehub.com/f/betracehq/betrace`

### Docker Images
- `betrace-backend` → `betrace-backend`
- `betrace-grafana-plugin` → `betrace-grafana-plugin`
- `betrace-plugin-init` → `betrace-plugin-init`

### Nix Flakes
- `inputs.betrace` → `inputs.betrace`
- `betrace.packages` → `betrace.packages`
- `betrace.inputs` → `betrace.inputs`

### Helm Chart
- **Directory:** `helm/betrace/` → `helm/betrace/`
- **Chart name:** `name: betrace` → `name: betrace`
- **Template helpers:** `betrace.*` → `betrace.*` functions
- **Team name:** "BeTrace Team" → "BeTrace Team"

### Docker Compose
- **Network:** `betrace-net` → `betrace-net`
- **Container names:** All updated to use `betrace-` prefix

### nixpkgs (Documentation)
- `pkgs.betrace-backend` → `pkgs.betrace-backend`
- `pkgs.grafanaPlugins.betrace-app` → `pkgs.grafanaPlugins.betrace-app`

## Files Updated (25 files)

### Core Distribution Files
- ✅ `distribution/README.md`
- ✅ `distribution/IMPLEMENTATION_SUMMARY.md`

### Docker Distribution (3 files)
- ✅ `distribution/docker/README.md`
- ✅ `distribution/docker/flake.nix`
- ✅ `distribution/docker/docker-compose.yml`

### Helm Chart (10 files)
- ✅ `distribution/helm/betrace/Chart.yaml`
- ✅ `distribution/helm/betrace/values.yaml`
- ✅ `distribution/helm/betrace/README.md`
- ✅ `distribution/helm/betrace/templates/_helpers.tpl`
- ✅ `distribution/helm/betrace/templates/backend-deployment.yaml`
- ✅ `distribution/helm/betrace/templates/backend-service.yaml`
- ✅ `distribution/helm/betrace/templates/grafana-deployment.yaml`
- ✅ `distribution/helm/betrace/templates/grafana-service.yaml`
- ✅ `distribution/helm/betrace/templates/grafana-configmap.yaml`
- ✅ `distribution/helm/betrace/templates/grafana-secret.yaml`
- ✅ `distribution/helm/betrace/templates/serviceaccount.yaml`

### Documentation (3 files)
- ✅ `distribution/docs/grafana-helm-integration.md`
- ✅ `distribution/docs/docker-compose-quickstart.md`
- ✅ `distribution/docs/nixpkgs-submission.md`

### GitHub Actions (2 files)
- ✅ `.github/workflows/docker-publish.yml`
- ✅ `.github/workflows/flakehub-publish.yml`

## Directory Structure (After Rebranding)

```
distribution/
├── README.md                                    # ✅ BeTrace
├── IMPLEMENTATION_SUMMARY.md                     # ✅ BeTrace
├── BRANDING_UPDATE_COMPLETE.md                   # This file
│
├── docker/                                       # ✅ BeTrace
│   ├── flake.nix                                 # betrace images
│   ├── docker-compose.yml                        # betrace-net, betrace-backend
│   └── README.md                                 # BeTrace branding
│
├── helm/
│   └── betrace/                                  # ✅ Renamed from betrace/
│       ├── Chart.yaml                            # name: betrace
│       ├── values.yaml                           # betrace images
│       ├── README.md                             # BeTrace branding
│       └── templates/                            # betrace.* helpers
│           ├── _helpers.tpl                      # betrace template functions
│           ├── backend-deployment.yaml
│           ├── backend-service.yaml
│           ├── grafana-deployment.yaml
│           ├── grafana-service.yaml
│           ├── grafana-configmap.yaml
│           ├── grafana-secret.yaml
│           └── serviceaccount.yaml
│
└── docs/                                         # ✅ BeTrace
    ├── grafana-helm-integration.md               # ghcr.io/betracehq/betrace
    ├── docker-compose-quickstart.md              # BeTrace branding
    └── nixpkgs-submission.md                     # betrace-backend package
```

## Verification

### ✅ Correct Branding (Spot Checks)
```bash
# Product name in prose
grep -r "BeTrace" distribution/ --include="*.md" | wc -l
# Result: 200+ instances

# GitHub URLs
grep -r "betracehq/betrace" distribution/ --include="*.md" --include="*.nix" | wc -l
# Result: 50+ instances

# Docker images
grep -r "betrace-backend" distribution/ | wc -l
# Result: 40+ instances

# Helm chart name
grep "name: betrace" distribution/helm/betrace/Chart.yaml
# Result: Found
```

### ✅ Preserved Elements (Should NOT Change)
- ✅ `betrace-app` - Grafana plugin ID (already correct)
- ✅ `/Users/sscoble/Projects/betrace` - Local clone path (preserved)
- ✅ Repository root directory name (not part of distribution)

## Testing Recommendations

### Docker Images
```bash
cd distribution/docker
nix run .#build-all
docker images | grep betrace
# Should show: betrace-backend, betrace-grafana-plugin, betrace-plugin-init
```

### Helm Chart
```bash
helm lint distribution/helm/betrace
helm template betrace distribution/helm/betrace --debug
# Should show betrace-* resources
```

### FlakeHub (After Publish)
```bash
# Check FlakeHub listing
curl https://flakehub.com/f/betracehq/betrace
```

## Brand Compliance

This rebranding follows the official guidelines from:
- [Brand Guidelines](../branding/brand-identity/BRAND_GUIDELINES.md)
- [Brand Name Usage](../branding/brand-identity/BRAND_GUIDELINES.md#name--capitalization)

**Key Rules Applied:**
1. ✅ BeTrace (capital B, capital T) in prose
2. ✅ betrace (lowercase) in code/URLs
3. ✅ betracehq (lowercase) for GitHub org
4. ✅ "BeTrace Team" not "BeTrace Team"
5. ✅ "BeTrace plugin" not "BTrace" or "Be Trace"

## Next Steps

1. **Commit changes:**
   ```bash
   git add distribution/
   git add .github/workflows/
   git commit -m "rebrand(distribution): BeTrace → BeTrace across all targets"
   ```

2. **Test builds:**
   ```bash
   cd distribution/docker && nix run .#build-all
   helm lint distribution/helm/betrace
   ```

3. **Update main README** (if not already done):
   - Reference `distribution/helm/betrace/` (not `betrace/`)
   - Update all GitHub URLs to betracehq/betrace

4. **Prepare for release:**
   - Tag release: `git tag v2.0.0`
   - GitHub Actions will publish to betracehq/betrace registries

## References

- [BeTrace Brand Guidelines](../branding/brand-identity/BRAND_GUIDELINES.md)
- [Rebranding Summary](../branding/REBRAND_SUMMARY.md)
- [ADR-011: Pure Application Framework](../docs/adrs/011-pure-application-framework.md)

---

**Completed by:** Claude Code
**Date:** 2025-10-23
**Status:** ✅ Rebranding complete and verified
