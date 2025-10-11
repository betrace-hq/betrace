# PRD-013: SRE Dashboard

**Priority:** P1 (User Workflow)
**Complexity:** Medium
**Personas:** SRE
**Dependencies:** PRD-008 (Signals), PRD-009 (Traces), PRD-011 (Investigation)

## Problem

No dashboard for SREs:
- Can't see active incidents (signals)
- No real-time signal feed
- No signal trends/analytics
- No quick actions

## Solution

### Dashboard Layout

**Top Row: Stats Cards**
- Open signals count
- Critical signals count
- Signals last 24h
- Mean time to resolution

**Main Section: Live Signal Feed**
- Real-time updates (WebSocket)
- Filter by severity, status
- Sort by time, severity
- Quick actions (investigate, resolve)

**Sidebar: Trending**
- Most triggered rules
- Busiest services
- Common patterns

## Success Criteria

- [ ] Real-time signal feed
- [ ] Stats cards update live
- [ ] Filter/sort signals
- [ ] Quick actions from dashboard
- [ ] Trending patterns visible
- [ ] Test coverage: Real-time updates, filtering

## Files to Create

- `bff/src/routes/dashboard.tsx` (update existing)
- `bff/src/components/dashboard/signal-feed.tsx`
- `bff/src/components/dashboard/stats-cards.tsx`
- `bff/src/lib/websocket/signal-updates.ts`

## Public Examples

### 1. Datadog Dashboard
**URL:** https://www.datadoghq.com/product/platform/dashboards/

**Relevance:** Real-time metrics dashboard demonstrating statistics cards, trending analytics, and live data updates. Datadog's dashboard paradigm directly maps to FLUO's signal monitoring requirements.

**Key Patterns:**
- Real-time metric cards (count, rate, percentage)
- Time-series graphs for trending
- Top N lists (top services, top endpoints)
- Dashboard templates and widgets
- Drill-down navigation from metrics to traces

**FLUO Alignment:**
- Datadog metrics cards → FLUO signal statistics (open signals, critical count, MTTR)
- Datadog trending → Most triggered rules, busiest services
- Datadog drill-down → Quick investigation actions

### 2. Grafana Dashboards
**URL:** https://grafana.com/grafana/dashboards/

**Relevance:** Time-series visualization platform with panel-based dashboard composition. FLUO already uses Grafana in its observability stack, making this the most natural reference for signal monitoring dashboards.

**Key Patterns:**
- Panel-based layout (stat panels, table panels, time-series graphs)
- Dashboard variables for filtering (tenant, severity, time range)
- Alert state visualization
- Real-time data updates with configurable refresh intervals
- Dashboard sharing and embedding

**FLUO Implementation:** FLUO signal dashboards can be built as Grafana dashboards querying signal metrics from Prometheus/Tempo, or as standalone React dashboards using similar panel patterns.

### 3. New Relic One Dashboard
**URL:** https://newrelic.com/platform/dashboards

**Relevance:** Operational dashboard with widget-based layout and real-time application performance monitoring. Demonstrates interactive widgets, drill-down navigation, and quick action patterns.

**Key Patterns:**
- Widget composition (billboard widgets for stats, line charts for trends)
- Real-time data updates without page refresh
- Faceted filtering (filter by attribute values)
- Quick actions from widgets
- Custom query language (NRQL) for data retrieval

**FLUO Alignment:** New Relic's widget model maps to FLUO's stats cards + signal feed layout. Drill-down from widgets mirrors FLUO's quick actions (investigate/resolve from dashboard).
