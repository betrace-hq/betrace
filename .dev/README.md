# .dev/ Directory

**Development runtime data consolidated in one place**

This directory contains all temporary/runtime data generated during local development. It's `.gitignore`d so it won't be committed.

## Directory Structure

```
.dev/
├── data/           # Service data storage
│   ├── prometheus/     # Prometheus TSDB data
│   ├── loki/          # Loki log storage (chunks + rules)
│   ├── tempo/         # Tempo trace storage
│   ├── pyroscope/     # Pyroscope profiling data
│   ├── alloy/         # Alloy pipeline state
│   └── grafana/       # Grafana database + plugins
├── logs/           # Service logs
│   └── grafana/       # Grafana operational logs
├── cache/          # Build/test caches (future)
├── test-results/   # Test execution results (future)
└── services/       # Service runtime state (future)
```

## Why .dev/?

**Before**: Temporary data scattered across:
- `/tmp/prometheus`, `/tmp/loki`, `/tmp/tempo`, etc.
- `.flox/pkgs/data/` (Pyroscope data mixed with Nix packages)
- `backend/data/` (DuckDB files)
- Hard to debug, hard to find, cleaned on reboot

**After**: Everything in `.dev/`
- ✅ Easy to inspect: `ls -la .dev/data/prometheus`
- ✅ Persists across reboots (until you delete it)
- ✅ Easy to clean: `rm -rf .dev/`
- ✅ Separated from Nix store/packages
- ✅ Clear what's runtime vs source code

## Usage

**Start services** (creates .dev/ automatically):
```bash
flox activate
flox services start
```

**Inspect service data**:
```bash
# Check Loki chunk storage
ls -lh .dev/data/loki/chunks/

# Check Tempo traces
du -sh .dev/data/tempo/traces/

# Check Grafana database
sqlite3 .dev/data/grafana/db/grafana.db
```

**Clean all runtime data**:
```bash
rm -rf .dev/
# Services will recreate directories on next start
```

**Clean specific service**:
```bash
rm -rf .dev/data/prometheus/
flox services restart prometheus
```

## Service Data Paths

| Service | Data Path | What's Stored |
|---------|-----------|---------------|
| Prometheus | `.dev/data/prometheus/` | Metrics TSDB |
| Loki | `.dev/data/loki/` | Log chunks + rules |
| Tempo | `.dev/data/tempo/` | Distributed traces |
| Pyroscope | `.dev/data/pyroscope/` | Continuous profiling |
| Alloy | `.dev/data/alloy/` | Telemetry pipeline state |
| Grafana | `.dev/data/grafana/` | Dashboards DB + plugins |

## Gitignore

This entire directory is in `.gitignore`:
```gitignore
# Development runtime data (consolidated)
.dev/
```

Never commit `.dev/` contents - it's all regenerable runtime data.

## Troubleshooting

**Services won't start?**
```bash
# Check if .dev/ has permission issues
ls -la .dev/

# Nuclear option: delete and restart
rm -rf .dev/
flox services restart
```

**Running out of disk space?**
```bash
# Check .dev/ size
du -sh .dev/

# Clean old Tempo traces (largest)
rm -rf .dev/data/tempo/traces/*

# Clean old Prometheus metrics
rm -rf .dev/data/prometheus/*
```

**Want to see logs in real-time?**
```bash
# Grafana logs
tail -f .dev/logs/grafana/*.log

# All logs via Loki
# Access Grafana at http://localhost:12015
# Explore → Loki → Query: {job="fluo"}
```

## Future Enhancements

- `.dev/test-results/` - Test execution artifacts (replacing `/tmp/betrace-test-results/`)
- `.dev/cache/` - Build caches (Go build cache, npm cache)
- `.dev/services/` - Service PIDs, sockets, etc.
