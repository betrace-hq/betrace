# PRD-024e: Grafana Button Enhancements

**Parent PRD:** PRD-024c (Grafana Frontend Components)
**Priority:** P2
**Status:** Backlog
**Estimated Effort:** 2 days

## Context

Following expert reviews of PRD-024c, several nice-to-have enhancements were identified that would improve power user productivity and observability.

## Problem Statement

**Current Limitations:**
1. **No Analytics**: Cannot measure feature adoption or debug user issues
2. **No Keyboard Shortcuts**: Power users must use mouse for every signal
3. **Weak Hover States**: Icon-only buttons not obviously clickable
4. **Unnecessary Refetches**: Config re-fetched on every window focus
5. **Missing ARIA Labels**: Icon-only buttons lack explicit accessibility labels

**Impact:**
- Unknown feature usage metrics
- Slower workflow for power users
- Slightly reduced discoverability
- Wasted network requests

## Requirements

### P2-1: Add Analytics Tracking

**File:** `bff/src/components/signals/view-in-grafana-button.tsx`

```typescript
import { useAnalytics } from '@/lib/hooks/use-analytics';

export function ViewInGrafanaButton({ signal }: Props) {
  const analytics = useAnalytics();

  const handleClick = () => {
    analytics.track('grafana_button_clicked', {
      signalId: signal.id,
      hasTraceId: !!signal.traceId,
      hasSpanId: !!signal.spanId,
      location: window.location.pathname, // 'detail' or 'table'
    });

    const popup = window.open(url, '_blank', 'noopener,noreferrer');

    if (!popup) {
      analytics.track('grafana_popup_blocked', {
        signalId: signal.id,
      });
      toast({ /* ... */ });
    } else {
      analytics.track('grafana_navigation_success', {
        signalId: signal.id,
        grafanaOrigin: new URL(url).origin,
      });
    }
  };

  // Track configuration errors
  if (error) {
    analytics.track('grafana_config_error', {
      error: error.message,
    });
  }
}
```

**Analytics Events:**
- `grafana_button_clicked` - User clicked button
- `grafana_popup_blocked` - Popup blocker prevented navigation
- `grafana_navigation_success` - Successfully opened Grafana
- `grafana_config_error` - Configuration fetch failed

### P2-2: Add Keyboard Shortcut

**File:** `bff/src/components/signals/signal-detail-page.tsx`

```typescript
import { useHotkeys } from '@/lib/hooks/use-hotkeys';

export function SignalDetailPage() {
  const signal = useSignal(signalId);

  // 'g' key opens Grafana (Gmail-style shortcut)
  useHotkeys('g', () => {
    if (signal?.traceId) {
      // Trigger Grafana navigation
      const button = document.querySelector('[data-grafana-button]');
      if (button instanceof HTMLButtonElement) {
        button.click();
      }
    }
  }, [signal]);

  return (
    <div>
      {/* ... */}
      <ViewInGrafanaButton
        signal={signal}
        data-grafana-button  // Identifier for keyboard trigger
      />
    </div>
  );
}
```

**Help Text:**
```tsx
<TooltipContent>
  <p>View signal in Grafana</p>
  <p className="text-xs text-muted-foreground mt-1">
    Shortcut: <kbd>g</kbd>
  </p>
</TooltipContent>
```

### P2-3: Improve Hover States for Icon-Only Buttons

**File:** `bff/src/components/signals/signals-page.tsx`

```typescript
<ViewInGrafanaButton
  signal={signal}
  iconOnly={true}
  className="hover:bg-accent hover:text-accent-foreground transition-colors"
/>
```

**Additional Enhancement:**
```typescript
// Add scale animation on hover
<Button
  variant="ghost"
  size="icon"
  className="hover:bg-accent hover:scale-110 transition-all duration-150"
>
  <ExternalLink className="h-4 w-4" />
</Button>
```

### P2-4: Disable Unnecessary Window Focus Refetches

**File:** `bff/src/lib/hooks/use-grafana-config.ts`

```typescript
export function useGrafanaConfig() {
  const { data, isLoading, isError, refetch } = useQuery<GrafanaConfig>({
    queryKey: ['grafana-config'],
    queryFn: fetchGrafanaConfig,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    refetchOnWindowFocus: false, // Config rarely changes
    refetchOnMount: true,
    refetchOnReconnect: true, // Still refetch on network reconnect
  });

  // ...
}
```

**Rationale:** Grafana configuration changes infrequently. Refetching every time user switches tabs wastes requests.

### P2-5: Add Explicit ARIA Labels for Icon-Only Buttons

**File:** `bff/src/components/signals/view-in-grafana-button.tsx`

```typescript
<Button
  variant="ghost"
  size="icon"
  aria-label={`View signal ${signal.id} trace in Grafana`}
  aria-describedby={`grafana-tooltip-${signal.id}`}
>
  <ExternalLink className="h-4 w-4" />
</Button>

<TooltipContent id={`grafana-tooltip-${signal.id}`}>
  View signal in Grafana
</TooltipContent>
```

**Accessibility Improvements:**
- Screen readers announce: "Button: View signal sig-123 trace in Grafana"
- Tooltip linked via `aria-describedby` for additional context

## Success Criteria

- [ ] Analytics events tracked for all user interactions
- [ ] Keyboard shortcut 'g' opens Grafana from detail page
- [ ] Icon-only buttons have visible hover state before tooltip appears
- [ ] Config refetch only on mount/reconnect (not window focus)
- [ ] All icon-only buttons have explicit ARIA labels
- [ ] Help text shows keyboard shortcuts in tooltips

## Out of Scope

- Advanced keyboard shortcuts (e.g., Vim-style navigation)
- Custom analytics dashboards (use existing analytics platform)
- A/B testing different button placements

## Dependencies

- Analytics system (`use-analytics` hook)
- Hotkeys library (`use-hotkeys` hook)
- Tailwind CSS for hover animations

## Timeline

**Week 1:**
- Day 1: Add analytics tracking
- Day 2: Implement keyboard shortcut
- Day 3: Improve hover states and ARIA labels
- Day 4: Optimize refetch behavior
- Day 5: Testing and documentation

## Acceptance Criteria

1. Analytics dashboard shows Grafana button usage metrics
2. Power users can open Grafana with 'g' key from detail page
3. Icon-only buttons have subtle hover effect (scale/bg change)
4. Config only refetches on mount/reconnect (not window focus)
5. Screen readers properly announce icon-only buttons
6. Help tooltip shows keyboard shortcuts

## Expected Outcomes

**Before:**
- Unknown feature usage
- Mouse-only interaction (slower for power users)
- Icon-only buttons less discoverable
- Unnecessary network requests on tab switch
- Suboptimal screen reader experience

**After:**
- Analytics track adoption and issues
- Keyboard shortcuts for power users
- Clear visual feedback on hover
- Optimized network usage
- Excellent accessibility for all users

## Notes

- Analytics tracking must respect user privacy preferences (GDPR/CCPA)
- Keyboard shortcuts should be documented in help menu
- Hover states should not interfere with existing table interactions
- ARIA labels should be concise but descriptive
