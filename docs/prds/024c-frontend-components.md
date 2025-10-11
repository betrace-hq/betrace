# PRD-024c: Frontend Components

**Parent PRD:** PRD-024 (Grafana Integration)
**Unit:** C (Frontend)
**Priority:** P2
**Dependencies:** Unit B (Grafana API endpoints)

## Scope

Implement React components for Grafana integration in the BFF (frontend). This unit provides:

1. **ViewInGrafanaButton Component** - Reusable button to open Grafana trace viewer
2. **useGrafanaConfig Hook** - Query hook to check if Grafana is configured
3. **Integration with Existing Pages** - Add buttons to Signal Detail and Signals Table

This unit consumes the API endpoints provided by Unit B.

## Architecture Compliance

**ADR-011 (Pure Application Framework):**
- Frontend gracefully handles Grafana not being configured
- Shows helpful messages guiding admins to enable integration

**ADR-006 (Tanstack Frontend Architecture):**
- Uses Tanstack Query for API calls
- React 18 component patterns
- TypeScript for type safety

**Testing Requirements:**
- Vitest for unit tests
- 90% coverage per ADR-014

## Implementation

### File 1: View in Grafana Button Component

**File:** `bff/src/components/signals/view-in-grafana-button.tsx`

```tsx
import { Button } from '@/components/ui/button'
import { ExternalLink, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

interface ViewInGrafanaButtonProps {
  signalId: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showLabel?: boolean
}

/**
 * Button to open signal's trace in Grafana.
 * Fetches Grafana deep link from backend and opens in new tab.
 *
 * Gracefully handles Grafana not being configured.
 */
export function ViewInGrafanaButton({
  signalId,
  variant = 'outline',
  size = 'default',
  showLabel = true
}: ViewInGrafanaButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleClick = async () => {
    setLoading(true)

    try {
      // Fetch Grafana link from backend
      const response = await fetch(`/api/signals/${signalId}/grafana-link`)

      if (response.status === 501) {
        // Grafana not configured - show helpful message
        toast({
          title: 'Grafana Not Configured',
          description: 'Contact your administrator to enable Grafana integration.',
          variant: 'default',
        })
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to get Grafana link: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.configured) {
        toast({
          title: 'Grafana Not Available',
          description: 'Grafana integration is not configured for this deployment.',
          variant: 'default',
        })
        return
      }

      // Open Grafana in new tab
      window.open(data.grafanaLink, '_blank', 'noopener,noreferrer')

      toast({
        title: 'Opening Grafana',
        description: 'Trace viewer opened in new tab',
      })

    } catch (error) {
      console.error('Error fetching Grafana link:', error)
      toast({
        title: 'Error',
        description: 'Failed to open Grafana trace viewer',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className="gap-2"
    >
      <ExternalLink className="h-4 w-4" />
      {showLabel && (loading ? 'Loading...' : 'View in Grafana')}
    </Button>
  )
}
```

### File 2: Grafana Configuration Status Hook

**File:** `bff/src/lib/hooks/use-grafana-config.ts`

```tsx
import { useQuery } from '@tanstack/react-query'

interface GrafanaConfig {
  configured: boolean
  available: boolean
  message?: string
}

/**
 * Hook to check if Grafana integration is configured.
 * Used to conditionally show/hide Grafana buttons.
 */
export function useGrafanaConfig() {
  return useQuery<GrafanaConfig>({
    queryKey: ['grafana', 'config'],
    queryFn: async () => {
      const response = await fetch('/api/grafana/config')
      if (!response.ok) {
        throw new Error('Failed to fetch Grafana config')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Don't retry much - configuration doesn't change often
  })
}
```

### File 3: Integration into Signal Detail Page

**File:** `bff/src/components/signals/signal-detail-page.tsx` (modification)

**Add Import:**
```tsx
import { ViewInGrafanaButton } from './view-in-grafana-button'
import { useGrafanaConfig } from '@/lib/hooks/use-grafana-config'
```

**Add to Component (in actions section):**
```tsx
export function SignalDetailPage({ signalId }: { signalId: string }) {
  const { data: signal } = useSignal(signalId)
  const { data: grafanaConfig } = useGrafanaConfig()

  // ... existing code ...

  return (
    <div className="container mx-auto p-6">
      {/* Signal header with title, severity, etc. */}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={handleInvestigate}>Mark as Investigating</Button>
        <Button onClick={handleResolve}>Resolve</Button>
        <Button onClick={handleFalsePositive}>False Positive</Button>

        {/* NEW: Grafana integration button */}
        {grafanaConfig?.configured && (
          <ViewInGrafanaButton signalId={signal.id} />
        )}
      </div>

      {/* Rest of signal detail page */}
    </div>
  )
}
```

### File 4: Integration into Signals Table

**File:** `bff/src/components/signals/signals-table.tsx` (modification)

**Add Import:**
```tsx
import { ViewInGrafanaButton } from './view-in-grafana-button'
import { useGrafanaConfig } from '@/lib/hooks/use-grafana-config'
```

**Add to Table Columns (actions column):**
```tsx
export function SignalsTable({ signals }: { signals: Signal[] }) {
  const { data: grafanaConfig } = useGrafanaConfig()
  const navigate = useNavigate()

  const columns = [
    // ... existing columns (severity, rule name, timestamp, etc.) ...

    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => navigate(`/signals/${row.original.id}`)}
          >
            View
          </Button>

          {/* NEW: Grafana button (icon only for table) */}
          {grafanaConfig?.configured && (
            <ViewInGrafanaButton
              signalId={row.original.id}
              variant="ghost"
              size="sm"
              showLabel={false}
            />
          )}
        </div>
      )
    }
  ]

  return <DataTable columns={columns} data={signals} />
}
```

## Success Criteria

**Functional:**
- [ ] `ViewInGrafanaButton` fetches Grafana link and opens new tab
- [ ] Button shows loading state while fetching
- [ ] Graceful error handling with toast notifications
- [ ] Button hidden when Grafana not configured (via `useGrafanaConfig`)
- [ ] Integrated into Signal Detail Page
- [ ] Integrated into Signals Table (icon-only variant)

**Quality:**
- [ ] 90% test coverage (Vitest unit tests)
- [ ] TypeScript types for all props and responses
- [ ] Accessible button (keyboard navigation, ARIA labels)

**UX:**
- [ ] Button opens Grafana in new tab (doesn't lose FLUO context)
- [ ] Toast notifications guide users on errors
- [ ] Loading state prevents double-clicks
- [ ] Consistent styling with existing UI

## Testing Requirements

### Unit Tests

**File:** `bff/src/components/signals/__tests__/view-in-grafana-button.test.tsx`

**Test Cases:**

1. **Renders Button with Label**
   - Given: Default props
   - When: Component rendered
   - Then: Button text is "View in Grafana"

2. **Renders Button without Label**
   - Given: `showLabel={false}`
   - When: Component rendered
   - Then: No text, only icon visible

3. **Fetches Grafana Link and Opens Tab**
   - Given: Valid signal ID, Grafana configured
   - When: Button clicked
   - Then: `window.open()` called with Grafana URL

4. **Shows Toast When Grafana Not Configured**
   - Given: API returns 501 Not Implemented
   - When: Button clicked
   - Then: Toast shows "Grafana Not Configured" message, tab not opened

5. **Shows Error Toast on Network Failure**
   - Given: API fetch fails
   - When: Button clicked
   - Then: Toast shows error message, tab not opened

6. **Disables Button While Loading**
   - Given: Fetch in progress
   - When: Loading state active
   - Then: Button is disabled, text shows "Loading..."

### Integration Tests

**File:** `bff/src/components/signals/__tests__/signal-detail-page-grafana.test.tsx`

**Test Cases:**

1. **Grafana Button Visible When Configured**
   - Given: Grafana config returns `configured: true`
   - When: Signal detail page rendered
   - Then: "View in Grafana" button present

2. **Grafana Button Hidden When Not Configured**
   - Given: Grafana config returns `configured: false`
   - When: Signal detail page rendered
   - Then: "View in Grafana" button not present

### Test Coverage Targets (ADR-014)

- **Instruction Coverage:** 90% minimum
- **Branch Coverage:** 80% minimum
- **Component Coverage:** 95% (user interaction paths)

### Example Test

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ViewInGrafanaButton } from '../view-in-grafana-button'
import { vi } from 'vitest'

describe('ViewInGrafanaButton', () => {
  beforeEach(() => {
    // Mock window.open
    global.window.open = vi.fn()
  })

  it('fetches Grafana link and opens new tab on click', async () => {
    // Mock successful API response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        grafanaLink: 'https://grafana.example.com/explore?...',
        configured: true,
      }),
    })

    render(<ViewInGrafanaButton signalId="sig-123" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/signals/sig-123/grafana-link')
      expect(window.open).toHaveBeenCalledWith(
        'https://grafana.example.com/explore?...',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  it('shows toast when Grafana not configured', async () => {
    // Mock 501 Not Implemented response
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 501,
      json: async () => ({
        error: 'Grafana integration not configured',
        configured: false,
      }),
    })

    render(<ViewInGrafanaButton signalId="sig-123" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(window.open).not.toHaveBeenCalled()
      // Toast library would show message (verify via toast mock)
    })
  })
})
```

## Files to Create

**Components:**
- `bff/src/components/signals/view-in-grafana-button.tsx` (~90 lines)

**Hooks:**
- `bff/src/lib/hooks/use-grafana-config.ts` (~30 lines)

**Tests:**
- `bff/src/components/signals/__tests__/view-in-grafana-button.test.tsx` (~150 lines)
- `bff/src/components/signals/__tests__/signal-detail-page-grafana.test.tsx` (~80 lines)

**Total:** ~350 lines (120 lines implementation, 230 lines tests)

## Files to Modify

**Signal Detail Page:**
- `bff/src/components/signals/signal-detail-page.tsx`
  - Import `ViewInGrafanaButton` and `useGrafanaConfig`
  - Add button to actions section (conditional on Grafana configured)

**Signals Table:**
- `bff/src/components/signals/signals-table.tsx`
  - Import `ViewInGrafanaButton` and `useGrafanaConfig`
  - Add icon-only button to actions column (conditional)

## User Experience Flow

### Happy Path: Grafana Configured

1. User navigates to signal detail page
2. User sees "View in Grafana" button (enabled)
3. User clicks button
4. Button shows "Loading..." text, disables
5. Backend returns Grafana link
6. New tab opens with Grafana Explore + trace loaded
7. Toast shows "Opening Grafana - Trace viewer opened in new tab"
8. User investigates trace in Grafana
9. User returns to FLUO tab to update signal status

### Degraded Path: Grafana Not Configured

1. User navigates to signal detail page
2. User does NOT see "View in Grafana" button (hidden via `useGrafanaConfig`)
3. Admin must configure Grafana URL to enable integration

### Error Path: API Failure

1. User navigates to signal detail page
2. User sees "View in Grafana" button (enabled)
3. User clicks button
4. Button shows "Loading..." text, disables
5. Backend API fails (network error, server down)
6. Toast shows "Error - Failed to open Grafana trace viewer"
7. Button re-enables
8. User can retry or investigate via manual Grafana search

## Dependencies

**Depends On:**
- **Unit B:** `GET /api/signals/{id}/grafana-link` endpoint
- **Unit B:** `GET /api/grafana/config` endpoint
- **Existing:** Signal Detail Page structure
- **Existing:** Signals Table structure

**External Libraries:**
- `@tanstack/react-query` - API calls and caching
- `lucide-react` - Icons (ExternalLink)
- `shadcn/ui` - Button component

## Accessibility Considerations

**Keyboard Navigation:**
- Button is keyboard accessible (native `<button>` element)
- Enter/Space keys trigger click

**Screen Readers:**
- Button has descriptive label "View in Grafana"
- Icon-only variant should have `aria-label="View in Grafana"`
- Loading state announced: "Loading..."

**ARIA Attributes:**
```tsx
<Button
  aria-label={showLabel ? undefined : "View trace in Grafana"}
  aria-busy={loading}
  disabled={loading}
>
  {/* content */}
</Button>
```

## Estimated Implementation Time

**Total:** ~4 hours (0.5 days)
- ViewInGrafanaButton component: 1 hour
- useGrafanaConfig hook: 30 minutes
- Integration into pages: 1 hour
- Unit tests: 1.5 hours

## Security Considerations

**Cross-Site Scripting (XSS):**
- Grafana link received from backend is trusted (not user input)
- `window.open()` with `noopener,noreferrer` prevents reverse tab-napping

**Information Disclosure:**
- Grafana URL not logged to console (only in network tab)
- Configuration endpoint reveals only boolean status (no URLs)

## Post-Implementation Checklist

- [ ] All tests pass with 90%+ coverage
- [ ] Button works in Signal Detail Page
- [ ] Button works in Signals Table (icon-only variant)
- [ ] Button hidden when Grafana not configured
- [ ] Loading state prevents double-clicks
- [ ] Toast notifications guide users
- [ ] Accessible via keyboard navigation
- [ ] Storybook story created (optional, for design review)

## Storybook Story (Optional)

**File:** `bff/src/components/signals/__stories__/view-in-grafana-button.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { ViewInGrafanaButton } from '../view-in-grafana-button'

const meta: Meta<typeof ViewInGrafanaButton> = {
  title: 'Signals/ViewInGrafanaButton',
  component: ViewInGrafanaButton,
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof ViewInGrafanaButton>

export const Default: Story = {
  args: {
    signalId: 'sig-123',
  },
}

export const IconOnly: Story = {
  args: {
    signalId: 'sig-123',
    showLabel: false,
  },
}

export const Small: Story = {
  args: {
    signalId: 'sig-123',
    size: 'sm',
  },
}
```

## Component Props Specification

### ViewInGrafanaButton Props

```typescript
interface ViewInGrafanaButtonProps {
  /** Signal ID to generate Grafana link for */
  signalId: string

  /** Button visual style (default: 'outline') */
  variant?: 'default' | 'outline' | 'ghost'

  /** Button size (default: 'default') */
  size?: 'default' | 'sm' | 'lg' | 'icon'

  /** Show "View in Grafana" label (default: true) */
  showLabel?: boolean
}
```

### useGrafanaConfig Return Type

```typescript
interface GrafanaConfig {
  /** Whether Grafana is configured and enabled */
  configured: boolean

  /** Whether Grafana integration is available */
  available: boolean

  /** Error message if not configured (optional) */
  message?: string
}
```

## Notes

**Tanstack Query Caching:**
- Grafana config cached for 5 minutes (configuration rarely changes)
- Link fetch is NOT cached (each button click fetches fresh link)

**Button Variants:**
- Signal Detail Page: Outlined button with label
- Signals Table: Ghost button, icon-only (space-saving)

**Future Enhancement:**
- Add tooltip to icon-only button: "View trace in Grafana"
- Add keyboard shortcut: `G` to open Grafana from signal detail
