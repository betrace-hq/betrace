# PRD-019B: Grafana Dashboards

**Priority:** P1 (After instrumentation)
**Complexity:** Low
**Personas:** SRE, Platform
**Dependencies:** PRD-019A (metrics must exist)
**Implements:** Pre-built monitoring dashboards

## Problem

BeTrace exposes Prometheus metrics but lacks dashboards:
- SREs must manually craft PromQL queries
- No standardized view of system health
- Difficult to correlate metrics across components
- Onboarding requires Prometheus/PromQL expertise

## Solution

### Dashboard Suite

**1. System Overview Dashboard**
- High-level health at-a-glance
- Key metrics: ingestion rate, signal generation, error rate
- Target: Incident response (is BeTrace healthy?)

**2. Performance Deep Dive Dashboard**
- Rule evaluation latency breakdown
- Database query performance
- Resource utilization (CPU, memory, threads)
- Target: Performance optimization

**3. Tenant Analytics Dashboard**
- Per-tenant span volume
- Per-tenant rule evaluation counts
- Tenant resource consumption
- Target: Capacity planning, tenant debugging

**4. Error Tracking Dashboard**
- Error rates by type (parse, validation, rule evaluation)
- Failed rule evaluations with context
- Database error trends
- Target: Debugging production issues

## Implementation

### Dashboard JSON Files

**Location:** `grafana-dashboards/`

**Files:**
```
grafana-dashboards/
├── fluo-system-overview.json
├── fluo-performance-deep-dive.json
├── fluo-tenant-analytics.json
└── fluo-error-tracking.json
```

### Dashboard 1: System Overview

**Panels:**

1. **Ingestion Rate** (Time series)
   - Metric: `rate(fluo.spans.received.total[5m])`
   - Aggregation: `sum by (tenant_id)`
   - Y-axis: Spans/sec

2. **Signal Generation Rate** (Time series)
   - Metric: `rate(fluo.signals.generated.total[5m])`
   - Aggregation: `sum by (severity)`
   - Y-axis: Signals/sec

3. **Rule Evaluation P99 Latency** (Time series)
   - Metric: `histogram_quantile(0.99, rate(fluo.rules.evaluation.duration_bucket[5m]))`
   - Aggregation: `by (rule_id)`
   - Y-axis: Milliseconds
   - Threshold: 2000ms (red line)

4. **Error Rate** (Time series)
   - Metric: `rate(fluo.errors.total[5m])`
   - Aggregation: `sum by (type)`
   - Y-axis: Errors/sec

5. **Active Database Connections** (Gauge)
   - Metric: `fluo.db.connections.active`
   - Aggregation: `sum by (pool)`

6. **Memory Usage** (Gauge)
   - Metric: `fluo.memory.used.bytes / 1024 / 1024 / 1024`
   - Y-axis: Gigabytes

**Variables:**
- `$tenant`: Multi-select dropdown (all tenants)
- `$rule`: Multi-select dropdown (all rules)
- `$time_range`: Quick ranges (5m, 15m, 1h, 6h, 24h)

**Example JSON Snippet:**
```json
{
  "dashboard": {
    "title": "BeTrace System Overview",
    "timezone": "utc",
    "panels": [
      {
        "id": 1,
        "title": "Ingestion Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(fluo_spans_received_total[5m])) by (tenant_id)",
            "legendFormat": "{{tenant_id}}"
          }
        ],
        "yaxes": [
          {
            "format": "short",
            "label": "Spans/sec"
          }
        ]
      }
    ],
    "templating": {
      "list": [
        {
          "name": "tenant",
          "type": "query",
          "query": "label_values(fluo_spans_received_total, tenant_id)",
          "multi": true
        }
      ]
    }
  }
}
```

### Dashboard 2: Performance Deep Dive

**Panels:**

1. **Rule Evaluation Latency Heatmap** (Heatmap)
   - Metric: `fluo.rules.evaluation.duration_bucket`
   - X-axis: Time
   - Y-axis: Latency buckets
   - Color: Request density

2. **Database Query Latency by Operation** (Time series)
   - Metric: `histogram_quantile(0.95, rate(fluo.db.queries.duration_bucket[5m]))`
   - Aggregation: `by (operation)`
   - Operations: `insert_signal`, `query_rules`, `update_signal_status`

3. **CPU Usage** (Gauge)
   - Metric: `fluo.cpu.usage.percent`
   - Threshold: >80% warning, >90% critical

4. **Thread Pool Utilization** (Time series)
   - Metric: `fluo.threads.active / fluo.threads.max`
   - Aggregation: `by (pool)`
   - Y-axis: Percentage

5. **GC Pause Time** (Time series)
   - Metric: `rate(jvm_gc_pause_seconds_sum[5m])`
   - Y-axis: Seconds/sec

### Dashboard 3: Tenant Analytics

**Panels:**

1. **Top 10 Tenants by Span Volume** (Bar gauge)
   - Metric: `topk(10, sum(rate(fluo.spans.received.total[1h])) by (tenant_id))`

2. **Tenant Rule Evaluation Count** (Table)
   - Columns: Tenant, Rule Count, Avg Latency, Error Rate
   - Metric: `count by (tenant_id, rule_id) (fluo.rules.evaluated.total)`

3. **Tenant Resource Consumption** (Pie chart)
   - Metric: `sum(fluo.spans.bytes.total) by (tenant_id)`
   - Shows percentage of total ingestion

### Dashboard 4: Error Tracking

**Panels:**

1. **Error Rate by Type** (Time series)
   - Metric: `rate(fluo.errors.total[5m])`
   - Aggregation: `by (type)`
   - Types: `parse_error`, `validation_error`, `rule_error`, `db_error`

2. **Failed Rule Evaluations** (Logs panel)
   - Query: `{app="fluo"} |= "ERROR" |= "rule_evaluation"`
   - Shows error logs with context

3. **Top 5 Failing Rules** (Table)
   - Metric: `topk(5, sum(rate(fluo.rules.errors.total[1h])) by (rule_id))`

## Security Requirements

### P1 (Compliance)

**Dashboard Access Control**
- Implement Grafana RBAC via OIDC/SAML SSO
- Roles:
  - `viewer`: Read-only dashboard access
  - `editor`: Can modify dashboards
  - `admin`: Full Grafana admin
- Configuration:
```ini
[auth.generic_oauth]
enabled = true
name = OIDC
client_id = grafana-client
client_secret = <secret>
auth_url = https://auth.example.com/authorize
token_url = https://auth.example.com/token
api_url = https://auth.example.com/userinfo
```

**Per-Tenant Dashboard Folders**
- Create folder per tenant: `/dashboards/tenant_<id>/`
- Folder permissions: Only accessible by tenant users
- Implementation:
```bash
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Tenant ACME","permissions":[{"userId":123,"permission":"View"}]}' \
  https://grafana/api/folders
```

## Validation Requirements

### JSON Schema Validation

**Requirement:** All dashboard JSON must be valid per Grafana schema

**Implementation:**
```bash
# Install validator
npm install -g @grafana/toolkit

# Validate dashboards
grafana-toolkit plugin:test --testPathPattern="dashboards/*.json"
```

**CI Integration:**
```yaml
# .github/workflows/validate-dashboards.yml
name: Validate Dashboards
on: [push]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install -g @grafana/toolkit
      - run: find grafana-dashboards -name "*.json" -exec grafana-toolkit plugin:test {} \;
```

### Metric Existence Check

**Requirement:** Dashboards cannot query non-existent metrics

**Implementation:**
```python
# scripts/validate_dashboard_metrics.py
import json
import re
from pathlib import Path

def extract_metrics(dashboard_json):
    """Extract all Prometheus queries from dashboard."""
    metrics = []
    for panel in dashboard_json.get("panels", []):
        for target in panel.get("targets", []):
            expr = target.get("expr", "")
            # Extract metric names (e.g., fluo.spans.received.total)
            metrics.extend(re.findall(r'fluo\.\w+\.\w+\.\w+', expr))
    return metrics

def check_metrics_exist(metrics):
    """Verify metrics exist in backend codebase."""
    backend_files = Path("backend/src/main/java").rglob("*.java")
    codebase = "\n".join([f.read_text() for f in backend_files])

    missing = []
    for metric in metrics:
        if metric not in codebase:
            missing.append(metric)

    return missing

# Run validation
for dashboard_file in Path("grafana-dashboards").glob("*.json"):
    with open(dashboard_file) as f:
        dashboard = json.load(f)

    metrics = extract_metrics(dashboard)
    missing = check_metrics_exist(metrics)

    if missing:
        print(f"❌ {dashboard_file.name}: Missing metrics {missing}")
        exit(1)

print("✅ All dashboard metrics exist")
```

### Timezone Handling

**Requirement:** All dashboards use UTC timestamps consistently

**Implementation:**
```json
{
  "dashboard": {
    "timezone": "utc",
    "time": {
      "from": "now-6h",
      "to": "now"
    }
  }
}
```

**Validation:**
```python
def validate_timezone(dashboard_json):
    if dashboard_json.get("timezone") != "utc":
        raise ValueError("Dashboard must use UTC timezone")
```

## Acceptance Criteria

### Functional Requirements

```gherkin
Scenario: Dashboard JSON is valid
  Given grafana-dashboards/fluo-system-overview.json
  When I validate against Grafana schema
  Then validation passes with zero errors

Scenario: All metrics exist
  Given dashboard queries fluo.spans.received.total
  When I grep for this metric in backend code
  Then I find metric registration in MetricsService.java

Scenario: Dashboard renders without errors
  Given Grafana instance with BeTrace metrics
  When I import fluo-system-overview.json
  Then dashboard loads with no missing data warnings
  And all panels display data
```

### Security Requirements

```gherkin
Scenario: Dashboard requires authentication
  Given unauthenticated user
  When user visits Grafana dashboard URL
  Then user is redirected to OIDC login

Scenario: Tenant isolation enforced
  Given user authenticated as tenant "acme"
  When user views tenant analytics dashboard
  Then only data for tenant "acme" is visible
  And data for tenant "other" is NOT visible
```

### Quality Requirements

```gherkin
Scenario: Dashboard loads quickly
  Given Grafana dashboard with 10 panels
  When I load the dashboard
  Then all panels render within 3 seconds

Scenario: Dashboard variables work
  Given dashboard with $tenant variable
  When I select tenant="acme"
  Then all panels filter to tenant="acme"

Scenario: Timezone is UTC
  Given dashboard time range "Last 24 hours"
  When loaded in browser with PST timezone
  Then X-axis shows UTC timestamps
```

## Testing Strategy

### Automated Validation

**JSON Schema:**
```bash
make validate-dashboards
# Runs: grafana-toolkit plugin:test grafana-dashboards/*.json
```

**Metric Existence:**
```bash
make check-dashboard-metrics
# Runs: python scripts/validate_dashboard_metrics.py
```

**Timezone Check:**
```bash
jq '.dashboard.timezone' grafana-dashboards/*.json | grep -v "utc" && exit 1
```

### Manual Testing

**1. Import Dashboard:**
```bash
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @grafana-dashboards/fluo-system-overview.json \
  http://localhost:12015/api/dashboards/db
```

**2. Visual Inspection:**
- Load dashboard in Grafana UI
- Verify all panels display data
- Check for missing data warnings
- Test variable dropdowns work

**3. Screenshot Diffing (Advanced):**
```javascript
// playwright-dashboard-test.js
const { test, expect } = require('@playwright/test');

test('dashboard renders correctly', async ({ page }) => {
  await page.goto('http://localhost:12015/d/fluo-overview');
  await page.waitForSelector('.grafana-panel');
  await expect(page).toHaveScreenshot('fluo-overview.png', { maxDiffPixels: 100 });
});
```

## Files to Create

**Dashboards:**
- `grafana-dashboards/fluo-system-overview.json` (~500 lines)
- `grafana-dashboards/fluo-performance-deep-dive.json` (~400 lines)
- `grafana-dashboards/fluo-tenant-analytics.json` (~300 lines)
- `grafana-dashboards/fluo-error-tracking.json` (~250 lines)

**Validation:**
- `scripts/validate_dashboard_metrics.py`
- `scripts/import_dashboards.sh`

**Documentation:**
- `grafana-dashboards/README.md` (import instructions)

**CI:**
- `.github/workflows/validate-dashboards.yml`

## Success Criteria

- [ ] 4 dashboards created (system, performance, tenant, errors)
- [ ] All dashboards pass JSON schema validation
- [ ] All metrics referenced in dashboards exist in backend
- [ ] Dashboards use UTC timezone consistently
- [ ] Dashboard variables (tenant, rule) work correctly
- [ ] Grafana RBAC configured via OIDC
- [ ] CI validates dashboards on every commit
- [ ] Import script works: `./scripts/import_dashboards.sh`
- [ ] Documentation explains dashboard purpose and panels
