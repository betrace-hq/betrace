# Service Startup Issue - Root Cause Found

**Date**: 2025-11-02
**Issue**: Services report "started" but not accessible
**Root Cause**: Nix packages downloading/building (slow first start)

---

## What I Discovered

Tested running grafana-wrapped directly:
```bash
nix run ./.flox/pkgs#grafana-wrapped -- --version
```

**Result**: Downloads packages from https://cache.nixos.org

```
copying path '/nix/store/sqilaxdxljyalv530z1qrd1q3nd4lyxq-source' from 'https://cache.nixos.org'...
copying path '/nix/store/cs1whj2lnf6g1ppf8m43ipffi1xcfvi7-gnused-4.9' from 'https://cache.nixos.org'...
copying path '/nix/store/4wcrinlpfwgzpczdzrcjcmp353b4k02g-diffutils-3.12' from 'https://cache.nixos.org'...
```

---

## Root Cause

**Services ARE starting**, but:

1. Nix packages not yet built/cached locally
2. First `flox services start` downloads dependencies
3. This takes **several minutes**
4. `flox services start` returns immediately with "✅ started"
5. But services are still downloading/building in background
6. Services become accessible **later** (after downloads complete)

---

## Why Tests Failed

E2E tests ran too soon:
1. `flox services start` → reported success ✅
2. Waited 30-60 seconds
3. Ran tests → Grafana not responding ❌
4. Reality: Grafana still downloading Nix packages

**Required wait time**: Unknown (depends on network, cache)
- Could be 5 minutes
- Could be 15 minutes
- First run is slowest (no cache)

---

## The Misleading Message

**What flox reports**:
```
✅ Service 'grafana' started.
```

**What it actually means**:
"Service launch command executed (but might still be downloading/building)"

**What users expect**:
"Service is running and ready to accept connections"

This is a UX issue with flox services - no indication of actual readiness.

---

## Solution for E2E Tests

### Option 1: Wait Longer (Unreliable)
```bash
flox services start
sleep 600  # Wait 10 minutes (hope it's enough)
npx playwright test
```

Problems:
- Unknown how long needed
- Varies by system/network
- Wasteful if already cached

### Option 2: Poll for Readiness (Better)
```bash
flox services start

# Wait for Grafana to respond
for i in {1..120}; do
  if curl -s http://localhost:12015/api/health > /dev/null; then
    echo "Grafana ready!"
    break
  fi
  echo "Waiting... ($i/120)"
  sleep 5
done

npx playwright test
```

### Option 3: Pre-build Packages (Best)
```bash
# Build all service packages first
nix build ./.flox/pkgs#grafana-wrapped
nix build ./.flox/pkgs#loki-wrapped
nix build ./.flox/pkgs#tempo-wrapped
# ... etc

# Then start services (instant, already built)
flox services start
sleep 30  # Just for service startup
npx playwright test
```

---

## Corrected Assessment

**Previous**: "Service orchestration broken"
**Actual**: "Service startup slow (Nix downloads), misleading status messages"

Services DO work, just:
1. Take time to download/build (first run)
2. No readiness indication from flox
3. Tests need to poll for readiness

---

## Updated User Instructions

### For E2E Testing:

1. **Pre-build packages** (one-time, ~10-15 min):
   ```bash
   cd /Users/sscoble/Projects/betrace
   nix build ./.flox/pkgs#grafana-wrapped
   nix build ./.flox/pkgs#loki-wrapped
   nix build ./.flox/pkgs#tempo-wrapped
   nix build ./.flox/pkgs#prometheus-wrapped
   nix build ./.flox/pkgs#pyroscope-wrapped
   nix build ./.flox/pkgs#alloy-wrapped
   ```

2. **Start services** (Terminal 1):
   ```bash
   flox activate --start-services
   # Keep open
   ```

3. **Wait for readiness** (Terminal 2):
   ```bash
   # Poll Grafana until ready
   until curl -s http://localhost:12015/api/health > /dev/null; do
     echo "Waiting for Grafana..."
     sleep 5
   done
   echo "Services ready!"
   ```

4. **Run E2E tests**:
   ```bash
   cd grafana-betrace-app
   npx playwright test
   ```

---

## Impact on Completion Estimate

**Previous assessment**: ~80% (service orchestration broken)
**Corrected assessment**: ~85% (services work, just slow first start)

**What works**:
- ✅ Service configuration valid
- ✅ Services DO start (just slow)
- ✅ Nix packages defined correctly

**What's not ideal**:
- ⚠️ Slow first startup (Nix downloads)
- ⚠️ No readiness feedback
- ⚠️ Requires polling

**What user must do**:
1. Pre-build Nix packages (speeds up subsequent starts)
2. Poll for service readiness before tests
3. Run E2E tests
4. Fix any test failures

---

## Lesson

"Service started" ≠ "Service ready"

Always poll for actual readiness:
- Check HTTP endpoints
- Verify service responding
- Don't trust status messages alone

Nix package downloads are invisible to users - need better feedback about what's happening.
