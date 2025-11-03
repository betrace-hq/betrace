#!/bin/bash
# Setup GPG Key for Grafana Plugin Signing
#
# This script generates a GPG key pair for signing BeTrace Grafana plugin.
# Run this ONCE to set up signing infrastructure.

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
KEY_NAME="${GPG_KEY_NAME:-BeTrace Plugin Signing}"
KEY_EMAIL="${GPG_KEY_EMAIL:-plugins@betrace.dev}"
KEY_SIZE=4096
KEY_EXPIRY="${GPG_KEY_EXPIRY:-2y}"  # 2 years
KEY_DIR="$HOME/.gnupg-betrace"

# Check if GPG is installed
if ! command -v gpg &> /dev/null; then
  error "GPG not installed"
  echo ""
  echo "Install GPG:"
  echo "  macOS:   brew install gnupg"
  echo "  Ubuntu:  sudo apt-get install gnupg"
  echo "  Fedora:  sudo dnf install gnupg"
  exit 1
fi

log "BeTrace GPG Key Setup"
echo ""

# Check if key already exists
if gpg --list-secret-keys "$KEY_EMAIL" &> /dev/null; then
  warn "GPG key already exists for $KEY_EMAIL"

  KEY_ID=$(gpg --list-secret-keys --keyid-format=long "$KEY_EMAIL" 2>/dev/null | grep sec | awk '{print $2}' | cut -d'/' -f2 | head -1)

  echo ""
  echo "Existing key ID: $KEY_ID"
  echo ""
  read -p "Do you want to use this existing key? (y/n) " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "Using existing key: $KEY_ID"
  else
    error "Aborting. Delete existing key first or use different email."
    echo ""
    echo "To delete existing key:"
    echo "  gpg --delete-secret-keys $KEY_EMAIL"
    echo "  gpg --delete-keys $KEY_EMAIL"
    exit 1
  fi
else
  log "Generating new GPG key..."
  echo ""

  # Show configuration
  info "Key Configuration:"
  echo "  Name:       $KEY_NAME"
  echo "  Email:      $KEY_EMAIL"
  echo "  Key Size:   $KEY_SIZE bits"
  echo "  Expiration: $KEY_EXPIRY"
  echo ""

  read -p "Continue with this configuration? (y/n) " -n 1 -r
  echo

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    warn "Aborted by user"
    echo ""
    echo "To customize, set environment variables:"
    echo "  export GPG_KEY_NAME=\"Your Name\""
    echo "  export GPG_KEY_EMAIL=\"your@email.com\""
    echo "  export GPG_KEY_EXPIRY=\"2y\"  # or \"0\" for never"
    echo "  $0"
    exit 1
  fi

  # Generate key with batch mode
  log "Generating key (this may take a few minutes)..."

  gpg --batch --generate-key <<EOF
Key-Type: RSA
Key-Length: $KEY_SIZE
Subkey-Type: RSA
Subkey-Length: $KEY_SIZE
Name-Real: $KEY_NAME
Name-Email: $KEY_EMAIL
Expire-Date: $KEY_EXPIRY
%no-protection
%commit
EOF

  if [ $? -ne 0 ]; then
    error "Failed to generate GPG key"
    exit 1
  fi

  log "✅ GPG key generated successfully!"

  # Get key ID
  KEY_ID=$(gpg --list-secret-keys --keyid-format=long "$KEY_EMAIL" 2>/dev/null | grep sec | awk '{print $2}' | cut -d'/' -f2 | head -1)
fi

echo ""
log "Key ID: $KEY_ID"
echo ""

# Create secure key directory
if [ ! -d "$KEY_DIR" ]; then
  log "Creating secure key directory: $KEY_DIR"
  mkdir -p "$KEY_DIR"
  chmod 700 "$KEY_DIR"
fi

# Export public key
PUBLIC_KEY_FILE="$KEY_DIR/betrace-plugin-public.key"
log "Exporting public key to: $PUBLIC_KEY_FILE"
gpg --armor --export "$KEY_EMAIL" > "$PUBLIC_KEY_FILE"

if [ -f "$PUBLIC_KEY_FILE" ]; then
  log "✅ Public key exported"
else
  error "Failed to export public key"
  exit 1
fi

# Export private key
PRIVATE_KEY_FILE="$KEY_DIR/betrace-plugin-private.key"
warn "Exporting private key to: $PRIVATE_KEY_FILE"
warn "⚠️  KEEP THIS FILE SECRET - DO NOT COMMIT TO GIT!"

gpg --armor --export-secret-keys "$KEY_EMAIL" > "$PRIVATE_KEY_FILE"
chmod 600 "$PRIVATE_KEY_FILE"

if [ -f "$PRIVATE_KEY_FILE" ]; then
  log "✅ Private key exported"
else
  error "Failed to export private key"
  exit 1
fi

# Create .env file for signing
ENV_FILE="$(dirname "$0")/../.env.signing"
log "Creating environment file: $ENV_FILE"

cat > "$ENV_FILE" <<EOF
# BeTrace Plugin Signing Environment Variables
# Generated: $(date)
#
# ⚠️  DO NOT COMMIT THIS FILE TO GIT!
# Add to .gitignore: .env.signing

# GPG Configuration
export GPG_KEY_EMAIL="$KEY_EMAIL"
export GPG_KEY_ID="$KEY_ID"
export GPG_PRIVATE_KEY_PATH="$PRIVATE_KEY_FILE"
export GPG_PUBLIC_KEY_PATH="$PUBLIC_KEY_FILE"

# Grafana Configuration (you need to set this manually)
# Get API key from: https://grafana.com/orgs/YOUR_ORG/api-keys
export GRAFANA_API_KEY=""

# Usage:
#   source .env.signing
#   npm run sign-plugin
EOF

chmod 600 "$ENV_FILE"

echo ""
log "✅ GPG key setup complete!"
echo ""
info "Next steps:"
echo ""
echo "1. Upload public key to Grafana.com:"
echo "   - Go to: https://grafana.com/orgs/YOUR_ORG/keys"
echo "   - Click 'Add Key'"
echo "   - Paste contents of: $PUBLIC_KEY_FILE"
echo ""
echo "2. Get Grafana API key:"
echo "   - Go to: https://grafana.com/orgs/YOUR_ORG/api-keys"
echo "   - Click 'Add API Key'"
echo "   - Copy the key"
echo "   - Edit: $ENV_FILE"
echo "   - Set: export GRAFANA_API_KEY=\"YOUR_KEY\""
echo ""
echo "3. Sign plugin:"
echo "   source $ENV_FILE"
echo "   npm run sign-plugin"
echo ""

# Update .gitignore
GITIGNORE="$(dirname "$0")/../.gitignore"
if [ -f "$GITIGNORE" ]; then
  if ! grep -q ".env.signing" "$GITIGNORE"; then
    log "Adding .env.signing to .gitignore"
    echo "" >> "$GITIGNORE"
    echo "# Plugin signing secrets" >> "$GITIGNORE"
    echo ".env.signing" >> "$GITIGNORE"
    echo "*.key" >> "$GITIGNORE"
    echo "!*-public.key" >> "$GITIGNORE"
  fi
fi

echo ""
info "Key Details:"
gpg --list-keys "$KEY_EMAIL"
echo ""

log "Done! 🎉"
