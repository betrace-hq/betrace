---
name: Flox Environment Expert
description: Provides Flox environment management, Nix expression builds in .flox/pkgs/, manifest configuration, and service orchestration patterns
---

# Flox Environment Expert Skill

## Purpose

Provides expertise in Flox-based environment management for FLUO's development and deployment workflows. Flox uses Nix under the hood but provides simpler, more composable environment management through TOML manifests and the `.flox/pkgs/` pattern for custom builds.

## When to Use This Skill

Load this skill when:
- Managing development environments
- Creating Nix expression builds in `.flox/pkgs/`
- Configuring services in manifest.toml
- Composing environments with `[include]`
- Building packages with `flox build`
- Creating cross-platform or containerized builds

## Core Concepts

### Flox vs Nix Flakes
- **Flox**: Environment-centric, TOML manifests, simpler onboarding
- **Nix Flakes**: Package-centric, Nix expressions, more flexible but steeper learning curve
- **Both**: Same reproducibility guarantees (Flox uses Nix internally)

### Key Flox Commands
```bash
flox init                    # Create new environment
flox activate                # Enter environment
flox install <package>       # Add package to environment
flox search <package>        # Search for packages
flox show <package>          # Show package details
flox edit                    # Edit manifest.toml
flox build                   # Build packages from .flox/pkgs/
flox services start          # Start services defined in manifest
flox services stop           # Stop services
flox services status         # Check service status
flox containerize            # Create Docker image from environment
```

## Nix Expression Builds in .flox/pkgs/

### File Naming Conventions
Package names are derived from file paths:
```
.flox/pkgs/hello.nix                          → hello
.flox/pkgs/hello/default.nix                  → hello
.flox/pkgs/hello/how/do/you/do/default.nix    → hello.how.do.you.do
```

**Important**: All files in `.flox/pkgs/` must be tracked in Git.

### Build Types

#### 1. Shell Script/Tool Distribution
```nix
# .flox/pkgs/my-tool.nix
{ writeShellApplication, curl, jq }:

writeShellApplication {
  name = "my-tool";
  runtimeInputs = [ curl jq ];
  text = ''
    # Script automatically gets:
    # - set -euo pipefail
    # - Runtime dependencies in PATH
    curl -s https://api.example.com/data | jq '.results'
  '';
}
```

#### 2. Go Application Build
```nix
# .flox/pkgs/backend.nix
{ buildGoModule, duckdb }:

buildGoModule {
  pname = "fluo-backend";
  version = "2.0.0";
  src = ../../backend-go;

  vendorHash = "sha256-xxx";  # Use empty hash first, copy error output

  buildInputs = [ duckdb ];

  # CGO configuration
  CGO_ENABLED = 1;
  preBuild = ''
    export CGO_LDFLAGS="-L${duckdb}/lib"
    export CGO_CFLAGS="-I${duckdb.dev}/include"
  '';

  ldflags = [ "-s" "-w" "-X main.version=2.0.0" ];

  subPackages = [ "cmd/backend" "cmd/cli" ];
}
```

#### 3. Node.js/NPM Application Build
```nix
# .flox/pkgs/frontend.nix
{ buildNpmPackage, nodejs_20, python3 }:

buildNpmPackage {
  pname = "fluo-frontend";
  version = "0.1.0";
  src = ../../bff;

  npmDepsHash = "sha256-xxx";  # Generate with empty hash first

  env = {
    PUPPETEER_SKIP_DOWNLOAD = "1";
  };

  buildPhase = ''
    npm run build
  '';

  installPhase = ''
    mkdir -p $out
    cp -r dist/* $out/
  '';
}
```

#### 4. Rust Application Build
```nix
# .flox/pkgs/rust-app.nix
{ rustPlatform, openssl, pkg-config }:

rustPlatform.buildRustPackage {
  pname = "my-rust-app";
  version = "1.0.0";
  src = ../../rust-app;

  cargoHash = "sha256-xxx";

  nativeBuildInputs = [ pkg-config ];
  buildInputs = [ openssl ];
}
```

#### 5. Override/Extend Existing Package
```nix
# .flox/pkgs/custom-grafana.nix
{ grafana }:

grafana.overrideAttrs (oldAttrs: {
  patches = oldAttrs.patches or [] ++ [
    ./my-grafana-patch.patch
  ];

  postInstall = oldAttrs.postInstall + ''
    # Additional install steps
    cp ${./custom-config.ini} $out/etc/grafana.ini
  '';
})
```

#### 6. Collection of Tools (buildEnv)
```nix
# .flox/pkgs/dev-tools/default.nix
{ pkgs }:

let
  test-runner = pkgs.callPackage ./test-runner.nix {};
  test-watch = pkgs.callPackage ./test-watch.nix {};
  serve-coverage = pkgs.callPackage ./serve-coverage.nix {};
in
pkgs.buildEnv {
  name = "fluo-dev-tools";
  paths = [ test-runner test-watch serve-coverage ];
}
```

### Hash Generation Workflow
1. Use empty hash: `"sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="`
2. Run `flox build`
3. Nix will error with correct hash
4. Copy hash from error message into your `.nix` file
5. Build again

Or use `nix-prefetch-url` / `nix-prefetch-git` for external sources.

### Referencing .flox/pkgs/ in Manifest

#### Direct Package Reference
```toml
# .flox/env/manifest.toml
[install]
my-app.flake = ".#my-app"          # References .flox/pkgs/my-app.nix
backend.flake = ".#backend"        # References .flox/pkgs/backend.nix
dev-tools.flake = ".#dev-tools"    # References .flox/pkgs/dev-tools/default.nix
```

#### With Nested Packages
```toml
[install]
# For .flox/pkgs/tools/formatter/default.nix
formatter.flake = ".#tools.formatter"
```

## Manifest Configuration

### Full Manifest Structure
```toml
version = 1

# Packages from catalog and custom builds
[install]
nodejs.pkg-path = "nodejs_20"
go.pkg-path = "go_1_22"
backend.flake = ".#backend"        # Custom build from .flox/pkgs/

# Environment variables
[vars]
PORT = "3000"
DATABASE_URL = "postgres://localhost/db"

# Activation hook (bash script)
[hook]
on-activate = '''
  echo "🚀 FLUO Development Environment"
  export PATH="$FLOX_ENV_PROJECT/scripts:$PATH"
'''

# Shell-specific customizations
[profile]
common = '''
  alias ll='ls -la'
'''
zsh = '''
  autoload -U compinit && compinit
'''

# Services
[services]
[services.database]
command = "postgres -D /tmp/pgdata"
vars.PGPORT = "5432"

[services.backend]
command = "cd backend && go run ./cmd/server"
vars.PORT = "8080"

# Include other environments
[include]
environments = [
  { dir = "../common-tools" },
  { remote = "user/shared-env" }
]

# Environment options
[options]
systems = ["x86_64-linux", "aarch64-darwin"]
cuda-detection = false

[options.allow]
unfree = true
broken = false
```

### Package Groups (Resolve Conflicts)
When packages have conflicting dependencies:
```toml
[install]
# Default group
nodejs.pkg-path = "nodejs_20"
python.pkg-path = "python311"

# Separate group for conflicting package
old-tool.pkg-path = "old-tool"
old-tool.pkg-group = "legacy"
```

### Service Configuration

#### Basic Service
```toml
[services.web]
command = "python -m http.server 8000"
```

#### Service with Environment Variables
```toml
[services.backend]
command = "backend-server"
vars.PORT = "8080"
vars.LOG_LEVEL = "debug"
```

#### Daemon Service (Requires Shutdown Command)
```toml
[services.database]
command = "pg_ctl start -D /tmp/pgdata"
is-daemon = true
shutdown.command = "pg_ctl stop -D /tmp/pgdata"
```

#### System-Specific Service
```toml
[services.macos-only]
command = "osascript -e 'display notification \"Started\"'"
systems = ["x86_64-darwin", "aarch64-darwin"]
```

## Building and Packaging

### Build Custom Packages
```bash
# Build all packages in .flox/pkgs/
flox build

# Build specific package
flox build .#backend

# Build for different system
flox build --system x86_64-linux .#backend
```

### Create Docker Images
```bash
# Containerize environment with all packages
flox containerize --output my-app:latest

# Containerize specific package
flox containerize --output backend:v1.0.0 .#backend
```

## Environment Composition

### Include Patterns
```toml
[include]
environments = [
  # Local environment
  { dir = "../common-tools" },

  # Remote environment from FloxHub
  { remote = "myorg/base-env" },

  # With custom name
  { dir = "../database", name = "db-tools" }
]
```

### Merge Semantics
- **[install]**: Higher priority overwrites lower
- **[vars]**: Higher priority overwrites lower
- **[hook]**: Scripts appended (high priority after low)
- **[profile]**: Scripts appended (high priority after low)
- **[services]**: Higher priority overwrites lower
- **[options]**: Deep merge (individual fields overwritten)

## Best Practices

### 1. Keep Builds Pure
```nix
# ❌ Bad: Depends on user environment
{ stdenv }:
stdenv.mkDerivation {
  buildPhase = ''
    # Assumes $HOME/.config exists
    cp ~/.config/app.conf $out/
  '';
}

# ✅ Good: Self-contained
{ stdenv }:
stdenv.mkDerivation {
  buildPhase = ''
    cp ${./app.conf} $out/etc/app.conf
  '';
}
```

### 2. Use callPackage for Modularity
```nix
# .flox/pkgs/dev-tools/default.nix
{ pkgs }:
let
  test-runner = pkgs.callPackage ./test-runner.nix {};
  coverage-tool = pkgs.callPackage ./coverage.nix {};
in
pkgs.buildEnv {
  name = "dev-tools";
  paths = [ test-runner coverage-tool ];
}
```

### 3. Pin External Sources
```nix
{ fetchFromGitHub, buildGoModule }:
buildGoModule {
  pname = "external-tool";
  version = "1.2.3";

  src = fetchFromGitHub {
    owner = "someorg";
    repo = "tool";
    rev = "v1.2.3";
    sha256 = "sha256-xxx";
  };

  vendorHash = "sha256-yyy";
}
```

### 4. Clean Source Filtering
```nix
{ stdenv, lib }:
stdenv.mkDerivation {
  src = lib.cleanSourceWith {
    src = ../../my-app;
    filter = path: type:
      let baseName = baseNameOf path; in
      # Exclude build artifacts, IDE files
      !(lib.hasInfix "target/" path) &&
      !(lib.hasInfix ".git" path) &&
      !(baseName == "node_modules");
  };
}
```

### 5. Service Dependencies
```bash
# Ensure services start in order via shell logic
[services.database]
command = '''
  mkdir -p /tmp/pgdata
  initdb -D /tmp/pgdata
  postgres -D /tmp/pgdata
'''

[services.backend]
command = '''
  # Wait for database
  until pg_isready -h localhost; do
    sleep 1
  done
  backend-server
'''
```

## Troubleshooting

### Build Fails with Hash Mismatch
```bash
# Clear build cache
rm -rf ~/.cache/flox/

# Rebuild with fresh fetch
flox build --rebuild .#my-package
```

### Package Conflicts
```bash
# Move conflicting package to new group
# In manifest.toml:
[install]
conflicting-pkg.pkg-path = "old-version"
conflicting-pkg.pkg-group = "legacy"
```

### Service Won't Start
```bash
# Check service logs
flox services status
flox services logs my-service

# Test command manually
flox activate
# Then run service command directly
```

### Missing Dependencies in Build
```nix
# Add missing build/runtime inputs
{ stdenv, pkg-config, openssl, zlib }:
stdenv.mkDerivation {
  nativeBuildInputs = [ pkg-config ];     # Build-time tools
  buildInputs = [ openssl zlib ];         # Runtime dependencies
}
```

## Cross-Platform Builds

### Multi-System Support
```toml
[options]
systems = [
  "x86_64-linux",
  "aarch64-linux",
  "x86_64-darwin",
  "aarch64-darwin"
]
```

### Build for Different Platforms
```bash
# Build Linux binary on macOS
flox build --system x86_64-linux .#backend

# Build ARM binary
flox build --system aarch64-linux .#backend
```

## Integration with FLUO

### Current Migration Status
FLUO is migrating from Nix Flakes to Flox:
- **Packages**: Frontend (React), Backend (Go), dev-tools in `.flox/pkgs/`
- **Services**: Grafana observability stack (Loki, Tempo, Prometheus, etc.)
- **Testing**: test-runner, test-watch, serve-coverage utilities

### FLUO-Specific Patterns
```toml
# Port configuration via environment variables
[vars]
FLUO_PORT_FRONTEND = "12010"
FLUO_PORT_BACKEND = "12011"
FLUO_PORT_GRAFANA = "12015"

# Go build configuration
GOFLAGS = "-mod=vendor"
CGO_ENABLED = "1"

# Test coverage thresholds
FLUO_COVERAGE_INSTRUCTION_MIN = "90"
FLUO_COVERAGE_BRANCH_MIN = "80"
```

## Progressive Disclosure

For detailed Flox guidance:
1. `manifest-patterns.md` - Advanced manifest configuration
2. `service-orchestration.md` - Complex service setups
3. `nix-expression-examples.md` - More build examples
4. `cross-platform-builds.md` - Multi-architecture patterns

## References
- Official Flox docs: https://flox.dev/docs
- Nix expression builds: https://flox.dev/docs/concepts/nix-expression-builds
- Manifest reference: https://flox.dev/docs/reference/manifest
- Flox CLI reference: https://flox.dev/docs/reference/command-reference

See also:
- [@docs/adrs/028-flox-migration.md](../../docs/adrs/028-flox-migration.md) (pending)
- [@.skills/nix/SKILL.md](../ /SKILL.md) (legacy Nix Flakes patterns)
