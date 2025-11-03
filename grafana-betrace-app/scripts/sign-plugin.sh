#!/bin/bash
# Sign Grafana Plugin for Distribution
#
# This script signs the BeTrace Grafana plugin using GPG keys.
# Run after building the plugin with: npm run build

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

# Load environment variables if .env.signing exists
ENV_FILE="$(dirname "$0")/../.env.signing"
if [ -f "$ENV_FILE" ]; then
  log "Loading signing configuration from: $ENV_FILE"
  source "$ENV_FILE"
fi

# Validate environment variables
MISSING_VARS=()

if [ -z "$GRAFANA_API_KEY" ]; then
  MISSING_VARS+=("GRAFANA_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  error "Missing required environment variables:"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Please set these variables in $ENV_FILE or export them:"
  echo ""
  for var in "${MISSING_VARS[@]}"; do
    echo "  export $var=\"your-value\""
  done
  echo ""
  echo "To generate Grafana API key:"
  echo "  https://grafana.com/orgs/YOUR_ORG/api-keys"
  exit 1
fi

# Check if plugin is built
DIST_DIR="$(dirname "$0")/../dist"
if [ ! -d "$DIST_DIR" ]; then
  error "Plugin not built. Run 'npm run build' first."
  exit 1
fi

# Check if plugin.json exists
PLUGIN_JSON="$DIST_DIR/plugin.json"
if [ ! -f "$PLUGIN_JSON" ]; then
  error "plugin.json not found in dist/"
  exit 1
fi

# Get plugin version
PLUGIN_VERSION=$(node -p "require('$PLUGIN_JSON').info.version")
PLUGIN_ID=$(node -p "require('$PLUGIN_JSON').id")

log "BeTrace Plugin Signing"
echo ""
info "Plugin ID: $PLUGIN_ID"
info "Version: $PLUGIN_VERSION"
echo ""

# Check if Grafana toolkit is available
if ! npm list -g @grafana/toolkit &> /dev/null && ! npm list @grafana/toolkit &> /dev/null; then
  warn "Grafana toolkit not installed"
  read -p "Install @grafana/toolkit? (y/n) " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Installing @grafana/toolkit..."
    npm install --save-dev @grafana/toolkit
  else
    error "Cannot sign without @grafana/toolkit"
    exit 1
  fi
fi

# Sign the plugin
log "Signing plugin with Grafana toolkit..."
echo ""

# Run signing command
if npx @grafana/toolkit plugin:sign; then
  log "✅ Plugin signed successfully!"
else
  error "Failed to sign plugin"
  exit 1
fi

echo ""

# Check if signature files were created
SIGNATURE_FILE="$DIST_DIR/MANIFEST.txt"
if [ ! -f "$SIGNATURE_FILE" ]; then
  error "MANIFEST.txt not created - signing may have failed"
  exit 1
fi

log "Signature files created:"
ls -lh "$DIST_DIR"/MANIFEST.txt 2>/dev/null || true
echo ""

# Create ZIP file for distribution
ZIP_FILE="$DIST_DIR/../${PLUGIN_ID}-${PLUGIN_VERSION}.zip"
log "Creating distribution ZIP: $(basename "$ZIP_FILE")"

cd "$DIST_DIR"
zip -q -r "$ZIP_FILE" ./*

if [ -f "$ZIP_FILE" ]; then
  log "✅ ZIP created: $(basename "$ZIP_FILE") ($(du -h "$ZIP_FILE" | cut -f1))"
else
  error "Failed to create ZIP file"
  exit 1
fi

# Create checksum
CHECKSUM_FILE="${ZIP_FILE}.sha256"
log "Creating checksum: $(basename "$CHECKSUM_FILE")"

if command -v sha256sum &> /dev/null; then
  sha256sum "$ZIP_FILE" | awk '{print $1}' > "$CHECKSUM_FILE"
elif command -v shasum &> /dev/null; then
  shasum -a 256 "$ZIP_FILE" | awk '{print $1}' > "$CHECKSUM_FILE"
else
  warn "Neither sha256sum nor shasum found - skipping checksum"
fi

if [ -f "$CHECKSUM_FILE" ]; then
  log "✅ Checksum created"
  info "SHA256: $(cat "$CHECKSUM_FILE")"
fi

echo ""
log "✅ Plugin signed and packaged successfully!"
echo ""

info "Distribution files:"
ls -lh "$ZIP_FILE" "$CHECKSUM_FILE" 2>/dev/null || true
echo ""

info "Next steps:"
echo ""
echo "1. Test signed plugin locally:"
echo "   unzip $ZIP_FILE -d /var/lib/grafana/plugins/${PLUGIN_ID}"
echo "   sudo systemctl restart grafana-server"
echo ""
echo "2. Upload to Grafana.com:"
echo "   - Go to: https://grafana.com/auth/sign-in"
echo "   - Navigate to: My Account → Plugins → Submit Plugin"
echo "   - Upload: $(basename "$ZIP_FILE")"
echo ""
echo "3. Create GitHub release:"
echo "   gh release create v${PLUGIN_VERSION} \\"
echo "     $(basename "$ZIP_FILE") \\"
echo "     $(basename "$CHECKSUM_FILE") \\"
echo "     --title \"v${PLUGIN_VERSION}\" \\"
echo "     --notes \"BeTrace Grafana Plugin v${PLUGIN_VERSION}\""
echo ""

log "Done! 🎉"
