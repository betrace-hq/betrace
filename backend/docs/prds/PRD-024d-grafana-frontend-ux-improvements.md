# PRD-024d: Grafana Frontend UX Improvements

**Parent PRD:** PRD-024c (Grafana Frontend Components)
**Priority:** P1
**Status:** Backlog
**Estimated Effort:** 3 days

## Context

Following expert reviews of PRD-024c implementation, several UX and quality improvements were identified. While not blocking production deployment, these enhancements will significantly improve user experience and system reliability.

## Problem Statement

**Current Issues:**
1. **No Loading State**: Button may show "not configured" error during initial config fetch
2. **Popup Blocker Race Condition**: 500ms timeout causes false positives/negatives
3. **No Retry Mechanism**: Temporary network failures permanently disable button until page refresh
4. **Generic Error Messages**: URL validation errors don't help operators debug configuration
5. **Missing Test Coverage**: No automated tests for hook and component

**Impact:**
- Users confused by transient errors during page load
- False popup blocker warnings
- Poor resilience to network glitches
- Difficult configuration debugging

## Requirements

### P1-1: Add Loading State During Config Fetch

**File:** `bff/src/components/signals/view-in-grafana-button.tsx`

```typescript
import { Loader2 } from 'lucide-react';

export function ViewInGrafanaButton({ signal }: Props) {
  const { isConfigured, isLoading, baseUrl, orgId, datasourceUid } = useGrafanaConfig();

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  // ... rest of component
}
```

### P1-2: Fix Popup Blocker Detection Race Condition

**File:** `bff/src/components/signals/view-in-grafana-button.tsx`

```typescript
const handleClick = () => {
  const popup = window.open(url, '_blank', 'noopener,noreferrer');

  if (!popup) {
    toast({
      title: 'Popup Blocked',
      description: 'Please allow popups for this site to view in Grafana',
      variant: 'destructive',
    });
    return;
  }

  // Check if popup was closed by popup blocker
  const checkInterval = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkInterval);
      toast({
        title: 'Popup Blocked',
        description: 'Please allow popups for this site to view in Grafana',
        variant: 'destructive',
      });
    }
  }, 100);

  // Stop checking after 3 seconds (popup successfully opened)
  setTimeout(() => clearInterval(checkInterval), 3000);
};
```

### P1-3: Add Retry Mechanism for Failed Config Fetch

**File:** `bff/src/lib/hooks/use-grafana-config.ts`

```typescript
export function useGrafanaConfig() {
  const { data, isLoading, isError, refetch } = useQuery<GrafanaConfig>({
    queryKey: ['grafana-config'],
    queryFn: async () => {
      const response = await fetch('/api/grafana/config');
      if (!response.ok) {
        throw new Error('Failed to fetch Grafana config');
      }
      const config = await response.json();

      // URL validation
      if (config.baseUrl && !isValidHttpUrl(config.baseUrl)) {
        throw new Error('Invalid Grafana base URL');
      }

      return config;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2, // Retry twice on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });

  return {
    isLoading,
    isError,
    isConfigured: !isLoading && !isError && !!data?.baseUrl && !!data?.datasourceUid,
    baseUrl: data?.baseUrl,
    orgId: data?.orgId,
    datasourceUid: data?.datasourceUid,
    refetch, // Expose refetch for manual retry
  };
}
```

**Button Component:**
```typescript
const { isError, refetch } = useGrafanaConfig();

if (isError) {
  return (
    <Button variant="outline" onClick={() => refetch()}>
      <AlertCircle className="h-4 w-4 mr-2" />
      Retry
    </Button>
  );
}
```

### P1-4: Improve URL Validation Error Messages

**File:** `bff/src/lib/hooks/use-grafana-config.ts`

```typescript
function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(
        `Grafana URL must use http/https protocol, got: ${url.protocol}`
      );
    }

    if (!url.hostname) {
      throw new Error('Grafana URL is missing a hostname');
    }

    return true;
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(`Grafana URL is malformed: ${e.message}`);
    }
    throw e;
  }
}
```

### P1-5: Add Comprehensive Test Coverage

**File:** `bff/src/lib/hooks/__tests__/use-grafana-config.test.ts`

```typescript
describe('useGrafanaConfig', () => {
  it('validates URL protocol (security)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ baseUrl: 'javascript:alert(1)' }),
    });

    const { result } = renderHook(() => useGrafanaConfig());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('retries on fetch failure', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ baseUrl: 'http://grafana:3000' }),
      });

    const { result } = renderHook(() => useGrafanaConfig());

    await waitFor(() => {
      expect(result.current.isConfigured).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('exposes refetch for manual retry', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGrafanaConfig());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ baseUrl: 'http://grafana:3000' }),
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isConfigured).toBe(true);
    });
  });
});
```

**File:** `bff/src/components/signals/__tests__/view-in-grafana-button.test.tsx`

```typescript
describe('ViewInGrafanaButton', () => {
  it('shows loading state during config fetch', () => {
    mockUseGrafanaConfig.mockReturnValue({ isLoading: true });

    render(<ViewInGrafanaButton signal={mockSignal} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('detects popup blocker and shows toast', async () => {
    mockUseGrafanaConfig.mockReturnValue({
      isConfigured: true,
      baseUrl: 'http://grafana:3000',
    });

    window.open = vi.fn().mockReturnValue(null); // Popup blocked

    render(<ViewInGrafanaButton signal={mockSignal} />);

    await userEvent.click(screen.getByRole('button'));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Popup Blocked',
      })
    );
  });

  it('shows retry button on config error', () => {
    mockUseGrafanaConfig.mockReturnValue({
      isError: true,
      refetch: mockRefetch,
    });

    render(<ViewInGrafanaButton signal={mockSignal} />);

    const retryButton = screen.getByText(/retry/i);
    expect(retryButton).toBeInTheDocument();

    userEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });
});
```

## Success Criteria

- [ ] Loading spinner shown during config fetch (no premature errors)
- [ ] Popup blocker detection reliable (no false positives/negatives)
- [ ] Network failures retry automatically (2 attempts with backoff)
- [ ] URL validation errors are specific and actionable
- [ ] Test coverage ≥90% for hook and component
- [ ] All tests pass with no flakiness

## Out of Scope

- Analytics tracking (P2, separate PRD)
- Keyboard shortcuts (P2, separate PRD)
- Performance optimizations (already good enough)

## Dependencies

- Existing Grafana button implementation (PRD-024c)
- React Query for retries
- Vitest for testing

## Timeline

**Week 1:**
- Day 1: Implement loading state and popup blocker fix
- Day 2: Add retry mechanism
- Day 3: Improve error messages
- Day 4: Write comprehensive tests
- Day 5: Review and merge

## Acceptance Criteria

1. User never sees "not configured" error during initial page load
2. Popup blocker detection works reliably across browsers
3. Temporary network failures auto-retry (user sees spinner)
4. URL validation errors help operators configure correctly
5. ≥90% test coverage with all edge cases covered
6. Zero flaky tests in CI

## Expected Outcomes

**Before:**
- Users confused by transient errors
- False popup blocker warnings
- Permanent failures from network glitches
- Difficult to debug Grafana configuration

**After:**
- Smooth loading experience (spinner → configured/unconfigured)
- Accurate popup blocker detection
- Resilient to network issues (auto-retry)
- Clear, actionable error messages
- High confidence from comprehensive tests
