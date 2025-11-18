# Grafana E2E Testing Guide

## Architecture Overview

BeTrace Grafana E2E tests use a simplified, reliable architecture that separates service orchestration from test execution.

**Core Principle**: Tests ASSUME services are already running, rather than trying to auto-start them.

## Test Environment Assumptions

E2E tests require these services to be running:

1. **Grafana** - Runs on port 3000 (in CI) or 12015 (locally via Flox)
2. **Backend** - Runs on port 12011 (BeTrace API)
3. **Tempo** - Runs on port 3200 (trace backend)
4. **Loki** - Runs on port 3100 (log aggregation)

## Running Tests Locally

### Option 1: Using Flox (Recommended)

```bash
# Terminal 1: Start all BeTrace services
cd /path/to/betrace
flox services start

# Verify services are running
flox services status

# Terminal 2: Run E2E tests
cd grafana-betrace-app
npm run test:integration
```

### Option 2: Using Docker for Grafana

```bash
# Terminal 1: Start backend services with Flox
flox services start backend tempo loki

# Terminal 2: Build plugin and run Grafana in Docker
cd grafana-betrace-app
npm run build

docker run -d \
  --name grafana \
  -p 3000:3000 \
  -v $(pwd)/dist:/var/lib/grafana/plugins/betrace-app \
  -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=betrace-app" \
  -e "GF_AUTH_ANONYMOUS_ENABLED=true" \
  -e "GF_AUTH_ANONYMOUS_ORG_ROLE=Admin" \
  grafana/grafana:11.0.0

# Terminal 3: Run tests
cd grafana-betrace-app
BETRACE_PORT_GRAFANA=3000 npm run test:integration
```

## CI/CD Workflow

In GitHub Actions (`.github/workflows/e2e-tests.yml`):

1. **Install Flox** - Installs Flox environment manager
2. **Build Plugin** - Compiles the Grafana plugin
3. **Start Backend Services** - Starts backend, tempo, loki via Flox
4. **Start Grafana** - Runs Grafana in Docker with plugin mounted
5. **Health Checks** - Verifies all services are responding
6. **Run Playwright Tests** - Executes E2E test suite
7. **Collect Artifacts** - Saves reports, videos, logs
8. **Cleanup** - Stops all services

## Health Check System

The new health check system (`tests/lib/simple-health-check.ts`):

- **Non-intrusive**: Only checks if services are responding
- **Does NOT auto-start**: Services must be started externally
- **Graceful degradation**: Tests run even if some services are down
- **Fast**: Simple HTTP health checks with 5s timeout

## What Changed (Breaking Changes)

### Before (Old Architecture)

❌ Tests tried to auto-start services using `flox services start`
❌ Failed outside of Flox activated environment
❌ Complex capability orchestration system
❌ Unreliable service lifecycle management

### After (New Architecture)

✅ Tests assume services are already running
✅ Simple HTTP health checks only
✅ Service orchestration is external responsibility
✅ Clear separation of concerns

## Migrating Existing Tests

No changes needed! Tests still work the same way. Only the global setup changed:

```typescript
// Old: tests/lib/playwright-capability-plugin.ts (tried to auto-start)
globalSetup: require.resolve('./tests/lib/playwright-capability-plugin'),

// New: tests/lib/simple-health-check.ts (just checks health)
globalSetup: require.resolve('./tests/lib/simple-health-check'),
```

## Troubleshooting

### Tests timing out waiting for Grafana

**Cause**: Services not running or not healthy

**Solution**:
```bash
# Check service status
flox services status

# Check health endpoints
curl http://localhost:12015/api/health  # Grafana (local)
curl http://localhost:12011/health       # Backend
curl http://localhost:3200/ready         # Tempo
curl http://localhost:3100/ready         # Loki
```

### Plugin not loading in Grafana

**Cause**: Plugin not built or not mounted correctly

**Solution**:
```bash
# Rebuild plugin
cd grafana-betrace-app
npm run build

# Verify dist/ directory exists
ls -la dist/
# Should see: plugin.json, module.js, img/

# For local Flox: restart Grafana
flox services restart grafana

# For Docker: remount plugin
docker stop grafana && docker rm grafana
# Re-run docker run command with -v mount
```

### "Cannot start services for an environment that is not activated"

**Cause**: Running `flox services` command outside `flox activate` context

**Solution**: Always wrap Flox service commands:
```bash
# Wrong
flox services start

# Right
flox activate -- flox services start
# Or just: flox services start (if already in activated shell)
```

## Performance

- **Health checks**: ~500ms total (4 services × 100ms avg)
- **Test startup**: ~2s (health check + Playwright initialization)
- **Full E2E suite**: ~3-5 minutes (varies by test count)

## Best Practices

1. **Start services before running tests** - Don't rely on auto-start
2. **Use Flox for local dev** - Simplest, most reliable
3. **Use Docker for CI** - Isolated, reproducible Grafana versions
4. **Check health endpoints** - Before reporting test failures
5. **Collect logs on failure** - Essential for debugging

## Future Improvements

- [ ] Add service warmup wait (smart polling vs fixed sleep)
- [ ] Add plugin load verification before tests run
- [ ] Add automatic service restart on test failure
- [ ] Add parallel test execution (when Grafana supports it)
- [ ] Add test environment snapshots for faster reruns
