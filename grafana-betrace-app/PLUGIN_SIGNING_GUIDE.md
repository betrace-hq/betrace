# Grafana Plugin Signing Guide

## Overview

Grafana requires plugins to be signed for distribution via the official catalog. This guide covers the complete signing process for the BeTrace plugin.

---

## Prerequisites

### 1. Grafana Account
- Sign up at https://grafana.com/auth/sign-up
- Verify email address
- Log in to Grafana Cloud

### 2. Install Grafana Toolkit
```bash
# Option A: Global installation
npm install -g @grafana/toolkit

# Option B: Use npx (recommended)
npx @grafana/toolkit
```

### 3. Build Plugin
```bash
cd grafana-betrace-app
npm run build
```

Verify `dist/` directory exists with compiled plugin files.

---

## Signing Process

### Step 1: Generate Signing Keys

Grafana uses GPG keys for plugin signing.

```bash
# Generate GPG key (if you don't have one)
gpg --full-generate-key

# Follow prompts:
# - Kind: (1) RSA and RSA
# - Key size: 4096
# - Expiration: 0 (never expires) or 2y (2 years)
# - Real name: BeTrace Team
# - Email: plugins@betrace.dev
# - Passphrase: (set a strong passphrase)

# List keys to get key ID
gpg --list-secret-keys --keyid-format=long

# Output example:
# sec   rsa4096/ABCD1234EF567890 2025-11-02 [SC]
#       ABCD1234EF567890ABCD1234EF567890ABCD1234
# uid         [ultimate] BeTrace Team <plugins@betrace.dev>

# Export public key (for Grafana upload)
gpg --armor --export ABCD1234EF567890 > betrace-gpg-public.key

# Export private key (for signing - KEEP SECRET!)
gpg --armor --export-secret-keys ABCD1234EF567890 > betrace-gpg-private.key
```

**⚠️ IMPORTANT**:
- Store private key securely (password manager, secrets vault)
- Never commit private key to Git
- Add to .gitignore: `*.key`, `*.asc`, `*.gpg`

---

### Step 2: Sign Plugin ZIP

#### Option A: Using Grafana Toolkit (Recommended)

```bash
# Set environment variables
export GRAFANA_API_KEY="your-grafana-cloud-api-key"
export GPG_PRIVATE_KEY_PATH="$HOME/.gnupg/betrace-gpg-private.key"
export GPG_PRIVATE_KEY_PASSPHRASE="your-gpg-passphrase"

# Sign plugin
npx @grafana/toolkit plugin:sign
```

#### Option B: Manual Signing

```bash
# Create plugin ZIP
cd grafana-betrace-app
zip -r betrace-app-0.1.0.zip dist/

# Generate checksum
sha256sum betrace-app-0.1.0.zip > betrace-app-0.1.0.zip.sha256

# Sign checksum
gpg --detach-sign --armor --output betrace-app-0.1.0.zip.sig betrace-app-0.1.0.zip.sha256

# Verify signature
gpg --verify betrace-app-0.1.0.zip.sig betrace-app-0.1.0.zip.sha256
```

---

### Step 3: Create MANIFEST.txt

The MANIFEST.txt file lists all plugin files and their checksums.

```bash
# Generate manifest
cd dist/
find . -type f -exec sha256sum {} \; | sort > MANIFEST.txt

# Example MANIFEST.txt:
# abc123...  ./module.js
# def456...  ./plugin.json
# ghi789...  ./README.md
```

---

### Step 4: Update plugin.json

Add signing metadata to `src/plugin.json`:

```json
{
  "type": "app",
  "name": "BeTrace",
  "id": "betrace-app",
  "info": {
    "version": "0.1.0",
    "updated": "2025-11-02",
    ...
  },
  "dependencies": {
    "grafanaDependency": ">=9.0.0"
  }
}
```

Grafana toolkit will add signing metadata automatically:

```json
{
  ...
  "signature": {
    "status": "valid",
    "type": "private",
    "signedBy": "BeTrace Team",
    "signedByOrg": "betrace",
    "signedByOrgName": "BeTrace",
    "pluginId": "betrace-app",
    "pluginVersion": "0.1.0"
  }
}
```

---

### Step 5: Verify Signed Plugin

```bash
# Install plugin locally to test
cp -r dist/ /var/lib/grafana/plugins/betrace-app

# Restart Grafana
sudo systemctl restart grafana-server

# Check Grafana logs for signature verification
sudo journalctl -u grafana-server -f | grep -i "betrace\|signature"

# Expected output:
# logger=plugins.signature pluginID=betrace-app status=valid
```

---

## Publishing to Grafana Catalog

### Step 1: Create Grafana.com Account

1. Sign up at https://grafana.com/auth/sign-up
2. Verify email
3. Create organization (if needed)

### Step 2: Submit Plugin

1. Go to https://grafana.com/auth/sign-in
2. Navigate to "My Account" → "Plugins"
3. Click "Submit Plugin"
4. Fill out form:
   - Plugin ID: `betrace-app`
   - Plugin Type: App
   - Repository: https://github.com/betracehq/betrace
   - README URL: https://raw.githubusercontent.com/betracehq/betrace/main/grafana-betrace-app/README.md
   - Logo: Upload logo.svg
   - Screenshots: Upload screenshots
   - Category: Observability, Tracing
5. Upload signed ZIP file
6. Submit for review

### Step 3: Grafana Review Process

**Timeline**: 3-5 business days

**Review Checklist**:
- ✅ Plugin signed with valid GPG key
- ✅ MANIFEST.txt present and valid
- ✅ plugin.json complete and valid
- ✅ README.md comprehensive
- ✅ Screenshots show key features
- ✅ No security issues
- ✅ Works with Grafana 9.x, 10.x, 11.x

**Possible Outcomes**:
- **Approved**: Plugin published to catalog
- **Revisions Requested**: Fix issues and resubmit
- **Rejected**: Major issues, need significant changes

---

## Troubleshooting

### Issue: "Plugin signature is invalid"

**Cause**: Signature doesn't match plugin files

**Fix**:
```bash
# Re-sign plugin
rm MANIFEST.txt
npx @grafana/toolkit plugin:sign

# Verify signature
gpg --verify betrace-app-0.1.0.zip.sig betrace-app-0.1.0.zip.sha256
```

---

### Issue: "GPG key not found"

**Cause**: GPG key not imported in Grafana

**Fix**:
1. Upload public key to Grafana.com account settings
2. Re-submit plugin

---

### Issue: "Plugin not loading"

**Cause**: Missing dependencies or invalid plugin.json

**Fix**:
```bash
# Check Grafana logs
sudo journalctl -u grafana-server -f | grep -i error

# Validate plugin.json
cat dist/plugin.json | jq .

# Check dependencies
npm ls
```

---

## Security Best Practices

### 1. Key Management

```bash
# Store private key in secure location
mkdir -p ~/.gnupg-betrace
chmod 700 ~/.gnupg-betrace
mv betrace-gpg-private.key ~/.gnupg-betrace/
chmod 600 ~/.gnupg-betrace/betrace-gpg-private.key

# Use in CI/CD
# - Store as GitHub secret: GPG_PRIVATE_KEY
# - Store passphrase as secret: GPG_PASSPHRASE
# - Use in GitHub Actions workflow
```

### 2. Gitignore

Add to `.gitignore`:
```
# GPG keys
*.key
*.asc
*.gpg
!betrace-gpg-public.key  # Public key is safe to commit

# Signed artifacts
*.sig
*.sha256
*.zip

# Signing credentials
.env.signing
```

### 3. Signing Script

Create `scripts/sign-plugin.sh`:

```bash
#!/bin/bash
set -e

# Load credentials from environment
if [ -z "$GPG_PRIVATE_KEY_PASSPHRASE" ]; then
  echo "Error: GPG_PRIVATE_KEY_PASSPHRASE not set"
  exit 1
fi

# Build plugin
echo "Building plugin..."
npm run build

# Sign plugin
echo "Signing plugin..."
npx @grafana/toolkit plugin:sign

echo "✅ Plugin signed successfully!"
echo "Files:"
ls -lh dist/*.{zip,sig,sha256} 2>/dev/null || true
```

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/sign-and-release.yml`:

```yaml
name: Sign and Release Plugin

on:
  push:
    tags:
      - 'v*'

jobs:
  sign:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd grafana-betrace-app
          npm ci

      - name: Build plugin
        run: |
          cd grafana-betrace-app
          npm run build

      - name: Import GPG key
        run: |
          echo "${{ secrets.GPG_PRIVATE_KEY }}" | gpg --import

      - name: Sign plugin
        env:
          GRAFANA_API_KEY: ${{ secrets.GRAFANA_API_KEY }}
          GPG_PRIVATE_KEY_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
        run: |
          cd grafana-betrace-app
          npx @grafana/toolkit plugin:sign

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            grafana-betrace-app/dist/*.zip
            grafana-betrace-app/dist/*.sig
            grafana-betrace-app/dist/*.sha256
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Testing Signed Plugin

### Local Testing

```bash
# Install signed plugin
sudo mkdir -p /var/lib/grafana/plugins/betrace-app
sudo unzip betrace-app-0.1.0.zip -d /var/lib/grafana/plugins/betrace-app

# Restart Grafana
sudo systemctl restart grafana-server

# Check logs
sudo journalctl -u grafana-server -f | grep betrace
```

### Docker Testing

```bash
# Create test Docker compose
cat > docker-compose.test.yml <<EOF
version: '3'
services:
  grafana:
    image: grafana/grafana:11.0.0
    ports:
      - "3000:3000"
    volumes:
      - ./dist:/var/lib/grafana/plugins/betrace-app
    environment:
      - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=betrace-app  # Only for testing unsigned
      - GF_LOG_LEVEL=debug
EOF

# Run Grafana
docker-compose -f docker-compose.test.yml up

# Visit http://localhost:3000
# Login: admin/admin
# Navigate to Plugins → BeTrace
```

---

## Version Management

### Semantic Versioning

Follow semver for plugin versions:
- `0.1.0` - Initial beta release
- `1.0.0` - First stable release
- `1.1.0` - New features (backwards compatible)
- `1.0.1` - Bug fixes
- `2.0.0` - Breaking changes

### Update Checklist

When releasing new version:
1. [ ] Update `package.json` version
2. [ ] Update `src/plugin.json` version and updated date
3. [ ] Update `CHANGELOG.md`
4. [ ] Build plugin: `npm run build`
5. [ ] Sign plugin: `npx @grafana/toolkit plugin:sign`
6. [ ] Tag release: `git tag v1.0.0 && git push --tags`
7. [ ] Upload to Grafana.com
8. [ ] Create GitHub release with signed artifacts

---

## Resources

- [Grafana Plugin Signing Documentation](https://grafana.com/docs/grafana/latest/developers/plugins/sign-a-plugin/)
- [Grafana Plugin Guidelines](https://grafana.com/docs/grafana/latest/developers/plugins/guidelines/)
- [Grafana Toolkit CLI](https://github.com/grafana/grafana/tree/main/packages/grafana-toolkit)
- [GPG Quick Start](https://www.gnupg.org/gph/en/manual.html)

---

## Next Steps

1. ✅ Build successful
2. ⏭️ Generate GPG keys
3. ⏭️ Sign plugin
4. ⏭️ Test signed plugin locally
5. ⏭️ Submit to Grafana catalog
6. ⏭️ Write E2E tests

---

**Status**: Ready for signing
**Est. Time**: 2-3 hours (including Grafana account setup)
**Blocker**: Need Grafana Cloud API key for automatic signing
