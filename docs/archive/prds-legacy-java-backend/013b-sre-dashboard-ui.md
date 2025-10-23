# PRD-013b: SRE Dashboard UI

**Status:** Draft
**Created:** 2025-10-10
**Dependencies:** PRD-013a (Real-time Signal Transport)
**Depended By:** None

## Problem Statement

SREs need a visual interface to monitor and triage signals effectively. Current implementation lacks:

- **Organized Layout**: No structured view of signal stream and statistics
- **Filtering Capabilities**: Cannot filter by severity, status, service
- **Sorting Controls**: No way to prioritize signals
- **Quick Actions**: No one-click investigate/resolve operations
- **Real-time Updates**: Signals appear only on manual refresh

**Business Impact:**
- Increased mean time to acknowledge (MTTA)
- Missed critical signals buried in noise
- SRE cognitive overload from unorganized presentation

## Solution

### Dashboard Layout

```
<DashboardPage>
  ├── <ConnectionStatus />       // WebSocket indicator
  ├── <StatsCards>
  │   ├── <StatCard label="Open Signals" value={42} />
  │   ├── <StatCard label="Critical" value={3} />
  │   ├── <StatCard label="Last 24h" value={156} />
  │   └── <StatCard label="MTTR" value="1h 24m" />
  ├── <SignalFeed>
  │   ├── <FilterBar />
  │   ├── <SortControls />
  │   └── <SignalTable />
  └── <TrendingSidebar />
```

### Core Implementation

```tsx
export function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    severity: null,
    status: null,
    service: null
  });

  const { connected, subscribe } = useWebSocket('/api/v1/ws/signals');

  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      switch (message.type) {
        case 'signal.created':
          setSignals(prev => [message.payload, ...prev].slice(0, 500));
          break;
        case 'signal.updated':
          setSignals(prev => prev.map(s =>
            s.id === message.payload.id ? { ...s, ...message.payload } : s
          ));
          break;
        case 'stats.updated':
          setStats(message.payload);
          break;
      }
    });

    return unsubscribe;
  }, [subscribe]);

  const filteredSignals = useMemo(() =>
    applyFilters(signals, filterState),
    [signals, filterState]
  );

  return (
    <div className="dashboard">
      {!connected && <ConnectionStatus status="reconnecting" />}
      <StatsCards stats={stats} />
      <SignalFeed signals={filteredSignals} />
      <TrendingSidebar />
    </div>
  );
}
```

### Filtering Logic

```tsx
interface FilterState {
  severity: Severity[] | null;
  status: SignalStatus[] | null;
  service: string[] | null;
}

function applyFilters(signals: Signal[], filters: FilterState): Signal[] {
  return signals.filter(signal => {
    if (filters.severity && !filters.severity.includes(signal.severity)) {
      return false;
    }
    if (filters.status && !filters.status.includes(signal.status)) {
      return false;
    }
    if (filters.service && !filters.service.includes(signal.serviceName)) {
      return false;
    }
    return true;
  });
}
```

## Acceptance Criteria

### Layout
- **AC1**: Stats cards in top row (4 cards, responsive)
- **AC2**: Signal feed in main content area
- **AC3**: Trending sidebar visible on desktop
- **AC4**: Responsive down to 768px width

### Filtering
- **AC5**: Filter by severity (multiple selection)
- **AC6**: Filter by status (multiple selection)
- **AC7**: Filter by service (autocomplete)
- **AC8**: Filters combine with AND logic
- **AC9**: Clear filters button resets state
- **AC10**: Filter state in URL query params

### Sorting
- **AC11**: Sort by created time (asc/desc)
- **AC12**: Sort by severity (priority order)
- **AC13**: Sort by status
- **AC14**: Direction toggles on click

### Quick Actions
- **AC15**: Investigate button opens detail page
- **AC16**: Resolve button shows confirmation
- **AC17**: Actions disabled during API call
- **AC18**: Success shows toast notification

### Real-time Updates
- **AC19**: New signals appear within 1 second
- **AC20**: Updates reflected immediately
- **AC21**: Stats cards update in real-time
- **AC22**: Connection loss shows warning

## Performance Requirements

- **Rendering**: < 100ms for 50 signals
- **Filtering**: < 50ms for 200 signals
- **Sorting**: < 50ms for 200 signals
- **Memory**: Max 500 signals cached (LRU)

## Test Requirements

- **Unit Tests**: 25 tests (filters, sorting, state)
- **Component Tests**: 15 tests (rendering, interactions)
- **Integration Tests**: 10 tests (WebSocket, API)
- **Accessibility Tests**: 5 tests (keyboard, screen reader)

## Dependencies

- PRD-013a: WebSocket endpoint and message format
- Signal API endpoints (GET, PATCH)
- shadcn/ui components (Table, Badge, Button)
- Tanstack Query for data fetching
