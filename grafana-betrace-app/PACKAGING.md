# BeTrace Plugin Packaging Guide

## Quick Start

### Unsigned Package (for testing)
```bash
npm run package:unsigned
```

### Signed Package (for distribution)
```bash
# One-time setup
npm run setup-gpg

# Build and sign
npm run package
```

---

## Complete Workflow

### 1. First-Time Setup

#### Install Dependencies
```bash
npm ci
```

#### Generate GPG Keys (one-time)
```bash
npm run setup-gpg
```

This will:
- Generate RSA 4096-bit GPG key pair
- Export public/private keys to `~/.gnupg-betrace/`
- Create `.env.signing` with configuration
- Update `.gitignore` for security

**Important**:
- Private key stored in: `~/.gnupg-betrace/betrace-plugin-private.key`
- Never commit private key to Git
- Back up private key securely

#### Get Grafana API Key

1. Sign up at https://grafana.com/auth/sign-up
2. Create organization (if needed)
3. Go to: https://grafana.com/orgs/YOUR_ORG/api-keys
4. Click "Add API Key"
5. Name: "BeTrace Plugin Signing"
6. Role: "PluginPublisher"
7. Copy the API key

#### Configure Signing

Edit `.env.signing`:
```bash
export GRAFANA_API_KEY="glc_YOUR_API_KEY_HERE"
```

---

### 2. Build Plugin

```bash
npm run build
```

**Output**: `dist/` directory with compiled plugin

**Verification**:
```bash
ls -la dist/
# Should contain: plugin.json, module.js, README.md, etc.
```

---

### 3. Package Plugin

#### Option A: Signed Package (for production)

```bash
npm run package
```

**What this does**:
1. Runs tests
2. Builds plugin
3. Validates dist/
4. Signs with GPG key
5. Creates MANIFEST.txt
6. Creates ZIP file
7. Generates checksums

**Output**:
- `betrace-app-0.1.0.zip` (signed)
- `betrace-app-0.1.0.zip.sha256`

---

#### Option B: Unsigned Package (for testing)

```bash
npm run package:unsigned
```

**What this does**:
1. Runs tests
2. Builds plugin
3. Validates dist/
4. Creates ZIP file (no signing)
5. Generates checksums

**Output**:
- `betrace-app-0.1.0-unsigned.zip`
- `betrace-app-0.1.0-unsigned.zip.sha256`

---

#### Option C: Quick Package (skip tests)

```bash
npm run package:quick
```

Useful for rapid iteration during development.

---

### 4. Test Package Locally

#### Extract Package
```bash
unzip betrace-app-0.1.0-unsigned.zip -d /tmp/betrace-test
```

#### Install to Grafana

**Docker (recommended for testing)**:
```bash
docker run -d \
  -p 3000:3000 \
  -v /tmp/betrace-test:/var/lib/grafana/plugins/betrace-app \
  -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=betrace-app" \
  grafana/grafana:11.0.0
```

**Local Grafana**:
```bash
sudo mkdir -p /var/lib/grafana/plugins/betrace-app
sudo unzip betrace-app-0.1.0-unsigned.zip -d /var/lib/grafana/plugins/betrace-app
sudo systemctl restart grafana-server
```

#### Verify Installation

1. Open Grafana: http://localhost:3000
2. Login: admin/admin
3. Go to: Administration → Plugins
4. Search: "BeTrace"
5. Click: "BeTrace" → Enable
6. Navigate to: BeTrace app (sidebar)

**Check Logs**:
```bash
# Docker
docker logs -f <container_id> | grep betrace

# Local
sudo journalctl -u grafana-server -f | grep betrace
```

**Expected Output**:
```
logger=plugins.signature pluginID=betrace-app status=valid
logger=plugins pluginID=betrace-app msg="Plugin registered"
```

---

### 5. Publish to GitHub

#### Create Release

```bash
# Tag version
git tag v0.1.0
git push origin v0.1.0

# Create GitHub release
gh release create v0.1.0 \
  betrace-app-0.1.0.zip \
  betrace-app-0.1.0.zip.sha256 \
  --title "BeTrace v0.1.0" \
  --notes "First release of BeTrace Grafana plugin"
```

#### Manual Upload

1. Go to: https://github.com/betracehq/betrace/releases/new
2. Tag: `v0.1.0`
3. Title: `BeTrace v0.1.0`
4. Upload: `betrace-app-0.1.0.zip`, `betrace-app-0.1.0.zip.sha256`
5. Click: "Publish release"

---

### 6. Submit to Grafana Catalog

#### Prerequisites
- ✅ Plugin signed with valid GPG key
- ✅ GitHub repository public
- ✅ README.md comprehensive
- ✅ Screenshots available
- ✅ Tested with Grafana 9.x, 10.x, 11.x

#### Submission Process

1. **Login to Grafana.com**
   - Go to: https://grafana.com/auth/sign-in
   - Login with your account

2. **Navigate to Plugin Submission**
   - My Account → Plugins → Submit Plugin

3. **Fill Out Form**
   - **Plugin ID**: `betrace-app`
   - **Plugin Type**: App
   - **Name**: BeTrace
   - **Description**: Behavioral assertions for Grafana - Create and manage BeTraceDSL rules for trace pattern matching
   - **Repository**: https://github.com/betracehq/betrace
   - **README URL**: https://raw.githubusercontent.com/betracehq/betrace/main/grafana-betrace-app/README.md
   - **Category**: Observability, Tracing, Monitoring

4. **Upload Assets**
   - **Logo**: `src/img/logo.svg` (SVG, 200x200px minimum)
   - **Screenshots**:
     - Rules page screenshot
     - Trace drilldown screenshot
     - Plugin configuration screenshot

5. **Upload Package**
   - Upload: `betrace-app-0.1.0.zip` (signed)

6. **Submit for Review**
   - Click: "Submit Plugin"
   - Wait for email confirmation

#### Review Timeline

- **Initial Review**: 1-2 business days
- **Full Review**: 3-5 business days
- **Revisions**: 1-2 days per iteration

#### Possible Outcomes

- **✅ Approved**: Plugin published to catalog
- **⚠️ Revisions Requested**: Fix issues and resubmit
- **❌ Rejected**: Major issues, need significant changes

---

## NPM Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build plugin (production mode) |
| `npm run dev` | Build and watch for changes |
| `npm test` | Run Jest tests |
| `npm run setup-gpg` | Generate GPG keys (one-time) |
| `npm run sign` | Sign existing dist/ |
| `npm run package` | Full build + test + sign + package |
| `npm run package:unsigned` | Build + test + package (no signing) |
| `npm run package:quick` | Build + package (skip tests) |

---

## Advanced Usage

### Custom GPG Key Configuration

```bash
export GPG_KEY_NAME="Your Organization"
export GPG_KEY_EMAIL="plugins@yourorg.com"
export GPG_KEY_EXPIRY="0"  # Never expires

npm run setup-gpg
```

### Sign Existing Build

If you already have `dist/` built:

```bash
npm run sign
```

### Package Without Tests

Useful during development:

```bash
npm run package:quick
```

### Manual Signing

```bash
# Build
npm run build

# Sign
source .env.signing
npx @grafana/toolkit plugin:sign

# Create ZIP
cd dist/
zip -r ../betrace-app-0.1.0.zip ./*
cd ..
```

---

## Troubleshooting

### Error: "GRAFANA_API_KEY not set"

**Solution**:
```bash
# Edit .env.signing and add your API key
export GRAFANA_API_KEY="glc_YOUR_KEY_HERE"

# Source the file
source .env.signing

# Try again
npm run package
```

---

### Error: "Plugin signature is invalid"

**Cause**: Signature doesn't match plugin files

**Solution**:
```bash
# Re-sign plugin
rm dist/MANIFEST.txt
npm run sign

# Or rebuild from scratch
rm -rf dist/
npm run package
```

---

### Error: "GPG key not found"

**Cause**: GPG key not generated or not in keyring

**Solution**:
```bash
# Check if key exists
gpg --list-secret-keys plugins@betrace.dev

# If not found, generate new key
npm run setup-gpg
```

---

### Error: "Failed to create ZIP file"

**Cause**: Missing `dist/` directory or permissions

**Solution**:
```bash
# Rebuild plugin
npm run build

# Check dist/ exists
ls -la dist/

# Try packaging again
npm run package:unsigned
```

---

### Warning: "Plugin not loading in Grafana"

**Debugging Steps**:

1. **Check Grafana logs**:
   ```bash
   sudo journalctl -u grafana-server -f | grep -i error
   ```

2. **Verify plugin.json**:
   ```bash
   cat dist/plugin.json | jq .
   ```

3. **Check permissions**:
   ```bash
   ls -la /var/lib/grafana/plugins/betrace-app/
   ```

4. **Allow unsigned plugins** (for testing):
   ```bash
   # Edit /etc/grafana/grafana.ini
   [plugins]
   allow_loading_unsigned_plugins = betrace-app

   # Restart Grafana
   sudo systemctl restart grafana-server
   ```

---

## Version Management

### Update Version

1. **Update package.json**:
   ```json
   {
     "version": "0.2.0"
   }
   ```

2. **Update src/plugin.json**:
   ```json
   {
     "info": {
       "version": "0.2.0",
       "updated": "2025-11-03"
     }
   }
   ```

3. **Rebuild and package**:
   ```bash
   npm run package
   ```

4. **Tag release**:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

---

## Security Best Practices

### 1. Protect Private Key

```bash
# Secure key directory
chmod 700 ~/.gnupg-betrace
chmod 600 ~/.gnupg-betrace/betrace-plugin-private.key

# Backup to secure location (password manager, vault)
cp ~/.gnupg-betrace/betrace-plugin-private.key /secure/backup/location/
```

### 2. Never Commit Secrets

`.gitignore` already configured to exclude:
- `.env.signing`
- `*.key` (except `*-public.key`)
- `*.asc`, `*.gpg`

### 3. Rotate Keys Periodically

```bash
# Generate new key (annually or after compromise)
npm run setup-gpg

# Upload new public key to Grafana.com

# Revoke old key
gpg --list-keys
gpg --gen-revoke OLD_KEY_ID > revocation.asc
gpg --import revocation.asc
gpg --send-keys OLD_KEY_ID
```

### 4. Use Environment Variables in CI/CD

GitHub Actions example:
```yaml
- name: Sign plugin
  env:
    GRAFANA_API_KEY: ${{ secrets.GRAFANA_API_KEY }}
    GPG_PRIVATE_KEY: ${{ secrets.GPG_PRIVATE_KEY }}
  run: |
    echo "$GPG_PRIVATE_KEY" | gpg --import
    npm run sign
```

---

## File Structure

```
grafana-betrace-app/
├── dist/                          # Built plugin (gitignored)
│   ├── module.js                  # Main plugin code
│   ├── plugin.json                # Plugin metadata
│   ├── MANIFEST.txt               # File checksums (signed only)
│   └── ...
├── scripts/
│   ├── setup-gpg-key.sh          # GPG key generation
│   ├── sign-plugin.sh            # Plugin signing
│   └── package-plugin.sh         # Build + sign + package
├── src/                           # Source code
│   ├── plugin.json               # Plugin metadata (source)
│   └── ...
├── .env.signing                   # Signing configuration (gitignored)
├── .gitignore                     # Git ignore rules
├── package.json                   # NPM scripts
├── PACKAGING.md                   # This file
└── PLUGIN_SIGNING_GUIDE.md       # Detailed signing guide
```

---

## Resources

- [Grafana Plugin Documentation](https://grafana.com/docs/grafana/latest/developers/plugins/)
- [Plugin Signing](https://grafana.com/docs/grafana/latest/developers/plugins/sign-a-plugin/)
- [Grafana Toolkit](https://github.com/grafana/grafana/tree/main/packages/grafana-toolkit)
- [Plugin Guidelines](https://grafana.com/docs/grafana/latest/developers/plugins/guidelines/)

---

## Support

- **Issues**: https://github.com/betracehq/betrace/issues
- **Discussions**: https://github.com/betracehq/betrace/discussions
- **Email**: support@betrace.dev

---

**Last Updated**: 2025-11-02
**Plugin Version**: 0.1.0
**Grafana Compatibility**: >=9.0.0
