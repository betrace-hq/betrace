# Submitting FLUO to nixpkgs

Guide for submitting FLUO packages to the official [NixOS/nixpkgs](https://github.com/NixOS/nixpkgs) repository.

## Overview

nixpkgs is the official package repository for Nix. Inclusion provides:

- ✅ Distribution via official Nix channels
- ✅ Integration with NixOS modules
- ✅ Community maintenance and reviews
- ✅ Binary cache via cache.nixos.org

**Timeline:** 3-6 months from submission to acceptance (highly variable)

## Packages to Submit

### 1. `fluo-backend`
Go backend binary

**Category:** `pkgs/by-name/fl/fluo-backend/`

**Package file:** `package.nix`

```nix
{ lib
, buildGoModule
, fetchFromGitHub
}:

buildGoModule rec {
  pname = "fluo-backend";
  version = "2.0.0";

  src = fetchFromGitHub {
    owner = "fluohq";
    repo = "fluo";
    rev = "v${version}";
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  sourceRoot = "${src.name}/backend";

  vendorHash = "sha256-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=";

  ldflags = [
    "-s" "-w"
    "-X main.version=${version}"
  ];

  meta = with lib; {
    description = "Behavioral assurance system for OpenTelemetry traces";
    homepage = "https://github.com/fluohq/fluo";
    license = licenses.asl20;
    maintainers = with maintainers; [ /* your-github-handle */ ];
    mainProgram = "fluo-backend";
  };
}
```

### 2. `grafanaPlugins.fluo-app`
Grafana app plugin

**Category:** `pkgs/servers/monitoring/grafana/plugins/`

**Package file:** `fluo-app.nix`

```nix
{ grafanaPlugin
, fetchFromGitHub
, lib
}:

grafanaPlugin rec {
  pname = "fluo-app";
  version = "0.1.0";
  zipHash = "sha256-CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=";

  src = fetchFromGitHub {
    owner = "fluohq";
    repo = "fluo";
    rev = "v${version}";
    hash = "sha256-DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD=";
  };

  sourceRoot = "${src.name}/grafana-betrace-app";

  meta = with lib; {
    description = "BeTrace Grafana app plugin for trace pattern matching";
    homepage = "https://github.com/fluohq/fluo";
    license = licenses.asl20;
    maintainers = with maintainers; [ /* your-github-handle */ ];
  };
}
```

## Prerequisites

### 1. Stable Release

- Tag a stable release (v1.0.0 or higher)
- No breaking changes expected
- Documentation complete
- Tests passing

### 2. nixpkgs Contributor Account

```bash
# Fork nixpkgs
git clone https://github.com/YOUR-USERNAME/nixpkgs
cd nixpkgs

# Add upstream
git remote add upstream https://github.com/NixOS/nixpkgs
```

### 3. Add Yourself as Maintainer

Edit `maintainers/maintainer-list.nix`:

```nix
your-github-handle = {
  email = "you@example.com";
  github = "your-github-handle";
  githubId = 12345678;  # Your GitHub user ID
  name = "Your Name";
};
```

## Submission Process

### Step 1: Create Package Files

```bash
# Backend package
mkdir -p pkgs/by-name/fl/fluo-backend
cat > pkgs/by-name/fl/fluo-backend/package.nix <<'EOF'
# (paste package.nix from above)
EOF

# Grafana plugin
cat > pkgs/servers/monitoring/grafana/plugins/fluo-app.nix <<'EOF'
# (paste fluo-app.nix from above)
EOF
```

### Step 2: Calculate Hashes

```bash
# Get source hash
nix-prefetch-github fluohq fluo --rev v2.0.0

# Get vendor hash (for Go)
cd pkgs/by-name/fl/fluo-backend
nix-build -A fluo-backend  # Will fail with correct hash

# Update vendorHash in package.nix with output
```

### Step 3: Test Build

```bash
# Test backend build
nix-build -A fluo-backend

# Test plugin build
nix-build -A grafanaPlugins.fluo-app

# Run package tests
nix-build -A fluo-backend.tests
```

### Step 4: Test in NixOS

```nix
# configuration.nix
{ pkgs, ... }:

{
  environment.systemPackages = with pkgs; [
    fluo-backend
  ];

  services.grafana = {
    enable = true;
    settings.plugins = {
      allow_loading_unsigned_plugins = "fluo-app";
    };
  };

  # Test that package works
  systemd.services.fluo-backend-test = {
    description = "FLUO Backend Test";
    wantedBy = [ "multi-user.target" ];
    serviceConfig = {
      ExecStart = "${pkgs.fluo-backend}/bin/fluo-backend --version";
      Type = "oneshot";
    };
  };
}
```

### Step 5: Format and Lint

```bash
# Format Nix files
nixpkgs-fmt pkgs/by-name/fl/fluo-backend/package.nix
nixpkgs-fmt pkgs/servers/monitoring/grafana/plugins/fluo-app.nix

# Run nixpkgs checks
nix-shell -p nixpkgs-review
nixpkgs-review pr --eval-local
```

### Step 6: Create Pull Request

```bash
# Create branch
git checkout -b fluo-init

# Commit changes
git add pkgs/by-name/fl/fluo-backend/
git add pkgs/servers/monitoring/grafana/plugins/fluo-app.nix
git commit -m "fluo-backend, grafanaPlugins.fluo-app: init at 2.0.0"

# Push to fork
git push origin fluo-init
```

### Step 7: Open PR on GitHub

**PR Title:**
```
fluo-backend, grafanaPlugins.fluo-app: init at 2.0.0
```

**PR Description:**
```markdown
## Description

Adds FLUO Behavioral Assurance System packages:

- `fluo-backend`: Go backend for trace pattern matching
- `grafanaPlugins.fluo-app`: Grafana app plugin

## Motivation

FLUO enables behavioral assertions on OpenTelemetry traces, filling the gap identified in the [International AI Safety Report](https://github.com/example/report) for production AI monitoring.

## Checklist

- [x] Built successfully on x86_64-linux
- [x] Built successfully on aarch64-darwin
- [x] Tested runtime functionality
- [x] Added maintainer (your-github-handle)
- [x] Follows nixpkgs guidelines
- [x] No breaking changes

## Testing

Tested on NixOS 24.05:
```bash
$ nix-build -A fluo-backend
$ ./result/bin/fluo-backend --version
FLUO Backend v2.0.0
```

Built for platforms:
- [x] x86_64-linux
- [x] aarch64-linux
- [x] x86_64-darwin
- [x] aarch64-darwin

## Related Links

- Homepage: https://github.com/fluohq/fluo
- License: Apache-2.0
```

## Review Process

### What to Expect

1. **Automated Checks** (~5 minutes)
   - `ofborg` bot builds package
   - Tests on multiple platforms
   - Checks for regressions

2. **Maintainer Review** (1-4 weeks)
   - Code review by nixpkgs maintainers
   - Feedback on packaging standards
   - Suggestions for improvements

3. **Revisions** (variable)
   - Address reviewer feedback
   - Update based on CI failures
   - Re-test after changes

4. **Approval** (when ready)
   - Maintainer approves PR
   - Merged by nixpkgs committer

5. **Channel Propagation** (days-weeks)
   - Appears in unstable channel first
   - Later backported to stable if requested

### Common Feedback

**"Use `buildGoModule` instead of manual build"**
```nix
# ✅ Good
buildGoModule {
  vendorHash = "sha256-...";
}

# ❌ Bad
stdenv.mkDerivation {
  buildPhase = "go build ...";
}
```

**"Add more metadata"**
```nix
meta = with lib; {
  description = "Short description (no 'A' or 'An')";
  longDescription = ''
    Detailed multi-line description
    explaining what the package does.
  '';
  homepage = "https://github.com/fluohq/fluo";
  changelog = "https://github.com/fluohq/fluo/releases/tag/v${version}";
  license = licenses.asl20;
  maintainers = with maintainers; [ your-handle ];
  mainProgram = "fluo-backend";
  platforms = platforms.unix;
};
```

**"Package fails on Darwin"**
- Test on macOS or disable: `meta.platforms = platforms.linux;`
- Fix Darwin-specific build issues

**"Vendor hash incorrect"**
- Re-run build to get correct hash
- Update `vendorHash` in package file

### Responding to Feedback

```bash
# Make changes based on feedback
vim pkgs/by-name/fl/fluo-backend/package.nix

# Test again
nix-build -A fluo-backend

# Commit and push
git add pkgs/by-name/fl/fluo-backend/package.nix
git commit -m "fluo-backend: address review feedback"
git push origin fluo-init
```

## After Merge

### Update Upstream Releases

When releasing new FLUO versions:

```bash
# Fork nixpkgs (if not already)
git clone https://github.com/YOUR-USERNAME/nixpkgs

# Update package
cd nixpkgs
vim pkgs/by-name/fl/fluo-backend/package.nix
# Change version and hashes

# Create PR
git checkout -b fluo-2.1.0
git commit -m "fluo-backend: 2.0.0 -> 2.1.0"
git push origin fluo-2.1.0
```

### Become Package Maintainer

- You're now listed as maintainer
- Notified of PRs updating FLUO
- Help review updates
- Fix broken builds

## Alternative: `nur` (Nix User Repository)

If nixpkgs submission is delayed, use NUR as interim solution:

**NUR Advantages:**
- ✅ Faster acceptance (days, not months)
- ✅ More flexible policies
- ✅ User-controlled updates

**NUR Disadvantages:**
- ❌ Not in official Nix channels
- ❌ No automatic binary cache
- ❌ Less visibility

**Setup NUR repo:**
```bash
git clone https://github.com/your-user/nur-packages
cd nur-packages

# Add FLUO packages
mkdir -p pkgs/fluo-backend
cp /path/to/package.nix pkgs/fluo-backend/default.nix

# Update default.nix
vim default.nix
# Add: fluo-backend = callPackage ./pkgs/fluo-backend { };

# Submit to NUR index
# https://github.com/nix-community/NUR
```

## See Also

- [nixpkgs Contributing Guide](https://github.com/NixOS/nixpkgs/blob/master/CONTRIBUTING.md)
- [nixpkgs Package Guidelines](https://nixos.org/manual/nixpkgs/stable/#chap-stdenv)
- [Nix User Repository (NUR)](https://github.com/nix-community/NUR)
- [FlakeHub Distribution](flakehub-publishing.md)
