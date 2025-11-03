#!/bin/bash
# Package Grafana Plugin for Distribution
#
# This script builds, validates, and packages the BeTrace plugin.
# Can be used for both signed and unsigned distributions.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
  echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1"
}

warn() {
  echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARN:${NC} $1"
}

info() {
  echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO:${NC} $1"
}

# Configuration
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_SIGN="${SKIP_SIGN:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-sign)
      SKIP_SIGN=true
      shift
      ;;
    --unsigned)
      SKIP_SIGN=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-tests   Skip running tests"
      echo "  --skip-build   Skip building plugin (use existing dist/)"
      echo "  --skip-sign    Skip signing (create unsigned package)"
      echo "  --unsigned     Same as --skip-sign"
      echo "  --help         Show this help message"
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      echo "Run with --help for usage"
      exit 1
      ;;
  esac
done

log "BeTrace Plugin Packaging"
echo ""

# Step 1: Install dependencies
if [ ! -d "node_modules" ]; then
  log "Installing dependencies..."
  npm ci
else
  info "Dependencies already installed (skipping npm ci)"
fi

# Step 2: Run tests
if [ "$SKIP_TESTS" = "false" ]; then
  log "Running tests..."
  npm test || {
    error "Tests failed!"
    exit 1
  }
  log "✅ Tests passed"
else
  warn "Skipping tests (--skip-tests)"
fi

# Step 3: Build plugin
if [ "$SKIP_BUILD" = "false" ]; then
  log "Building plugin..."
  npm run build || {
    error "Build failed!"
    exit 1
  }
  log "✅ Build successful"
else
  warn "Skipping build (--skip-build)"

  if [ ! -d "dist" ]; then
    error "dist/ directory not found - cannot skip build"
    exit 1
  fi
fi

# Step 4: Validate dist/
log "Validating dist/ directory..."

REQUIRED_FILES=(
  "dist/plugin.json"
  "dist/module.js"
  "dist/README.md"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    MISSING_FILES+=("$file")
  fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
  error "Missing required files in dist/:"
  for file in "${MISSING_FILES[@]}"; do
    echo "  - $file"
  done
  exit 1
fi

log "✅ Validation passed"

# Get plugin metadata
PLUGIN_JSON="dist/plugin.json"
PLUGIN_VERSION=$(node -p "require('./$PLUGIN_JSON').info.version")
PLUGIN_ID=$(node -p "require('./$PLUGIN_JSON').id")

info "Plugin ID: $PLUGIN_ID"
info "Version: $PLUGIN_VERSION"
echo ""

# Step 5: Sign plugin (optional)
if [ "$SKIP_SIGN" = "false" ]; then
  log "Signing plugin..."

  if [ ! -f "scripts/sign-plugin.sh" ]; then
    warn "sign-plugin.sh not found - skipping signing"
    SKIP_SIGN=true
  else
    ./scripts/sign-plugin.sh || {
      warn "Signing failed - continuing with unsigned package"
      SKIP_SIGN=true
    }
  fi
else
  warn "Skipping signing (unsigned package)"
fi

# Step 6: Create distribution ZIP
if [ "$SKIP_SIGN" = "true" ]; then
  ZIP_FILE="${PLUGIN_ID}-${PLUGIN_VERSION}-unsigned.zip"
else
  ZIP_FILE="${PLUGIN_ID}-${PLUGIN_VERSION}.zip"
fi

log "Creating distribution package: $ZIP_FILE"

# Remove old ZIP if exists
if [ -f "$ZIP_FILE" ]; then
  rm "$ZIP_FILE"
fi

# Create ZIP
cd dist/
zip -q -r "../$ZIP_FILE" ./*
cd ..

if [ ! -f "$ZIP_FILE" ]; then
  error "Failed to create ZIP file"
  exit 1
fi

log "✅ Package created: $ZIP_FILE ($(du -h "$ZIP_FILE" | cut -f1))"

# Step 7: Create checksums
log "Creating checksums..."

if command -v sha256sum &> /dev/null; then
  SHA256=$(sha256sum "$ZIP_FILE" | awk '{print $1}')
  echo "$SHA256" > "${ZIP_FILE}.sha256"
elif command -v shasum &> /dev/null; then
  SHA256=$(shasum -a 256 "$ZIP_FILE" | awk '{print $1}')
  echo "$SHA256" > "${ZIP_FILE}.sha256"
else
  warn "Neither sha256sum nor shasum found - skipping checksum"
  SHA256="N/A"
fi

if [ "$SHA256" != "N/A" ]; then
  log "✅ SHA256: $SHA256"
fi

# Step 8: Analyze package contents
log "Analyzing package..."
echo ""

info "Package contents:"
unzip -l "$ZIP_FILE" | head -20
echo ""

info "Package size breakdown:"
unzip -l "$ZIP_FILE" | grep -E "\.(js|css|json|md|txt)" | awk '{
  ext = $4;
  gsub(/.*\./, "", ext);
  sizes[ext] += $1;
  total += $1
}
END {
  for (ext in sizes) {
    printf "  %-10s %8.2f MB (%5.1f%%)\n", ext ":", sizes[ext]/1024/1024, sizes[ext]*100/total
  }
  printf "  %-10s %8.2f MB\n", "Total:", total/1024/1024
}'
echo ""

# Step 9: Summary
log "✅ Plugin packaged successfully!"
echo ""

info "Distribution files:"
ls -lh "$ZIP_FILE" "${ZIP_FILE}.sha256" 2>/dev/null || ls -lh "$ZIP_FILE"
echo ""

info "Package details:"
echo "  Plugin ID:  $PLUGIN_ID"
echo "  Version:    $PLUGIN_VERSION"
echo "  Signed:     $([ "$SKIP_SIGN" = "true" ] && echo "No" || echo "Yes")"
echo "  Size:       $(du -h "$ZIP_FILE" | cut -f1)"
echo "  Files:      $(unzip -l "$ZIP_FILE" | tail -1 | awk '{print $2}')"
echo ""

if [ "$SKIP_SIGN" = "true" ]; then
  warn "⚠️  This is an UNSIGNED package"
  echo ""
  echo "To create a signed package:"
  echo "  1. Generate GPG keys: ./scripts/setup-gpg-key.sh"
  echo "  2. Get Grafana API key: https://grafana.com/orgs/YOUR_ORG/api-keys"
  echo "  3. Run: $0 (without --skip-sign)"
  echo ""
fi

info "Next steps:"
echo ""
echo "1. Test locally:"
echo "   unzip $ZIP_FILE -d /tmp/test-plugin"
echo "   # Copy to Grafana plugins directory"
echo "   sudo cp -r /tmp/test-plugin /var/lib/grafana/plugins/${PLUGIN_ID}"
echo "   sudo systemctl restart grafana-server"
echo ""
echo "2. Create GitHub release:"
echo "   git tag v${PLUGIN_VERSION}"
echo "   git push origin v${PLUGIN_VERSION}"
echo "   gh release create v${PLUGIN_VERSION} $ZIP_FILE --title \"v${PLUGIN_VERSION}\""
echo ""
if [ "$SKIP_SIGN" = "false" ]; then
  echo "3. Submit to Grafana.com:"
  echo "   https://grafana.com/auth/sign-in → My Account → Plugins → Submit"
  echo ""
fi

log "Done! 🎉"
