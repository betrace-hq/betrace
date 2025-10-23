# PRD-012f: Frontend Tenant Admin UI

**Parent PRD:** PRD-012 (Tenant Management System)
**Unit:** F
**Priority:** P0
**Dependencies:** PRD-012a (Onboarding), PRD-012b (Settings), PRD-012c (Team), PRD-012d (Usage), PRD-012e (API Keys)

## Scope

Implement unified frontend tenant administration UI using Tanstack Router and shadcn/ui components. Consolidate tenant settings, team management, usage dashboard, and API keys into a single Settings page with tabbed navigation. Add tenant switcher in header for multi-tenant users. Display tenant logo, usage widgets in dashboard.

## Architecture

```
/settings (route)
  ├── /settings/tenant (tab: Tenant Settings - PRD-012b)
  ├── /settings/team (tab: Team Members - PRD-012c)
  ├── /settings/usage (tab: Usage & Quotas - PRD-012d)
  └── /settings/api-keys (tab: API Keys - PRD-012e)

Header Component
  ├── Logo (tenant logo from PRD-012b)
  ├── Tenant Switcher (multi-tenant dropdown)
  └── User Menu (profile, logout)

Dashboard Widgets
  ├── Usage Summary (PRD-012d: current usage percentages)
  └── Quick Links (Team, Settings, API Keys)
```

## UI Components

### Settings Layout

**Figma-Aligned Design:**
- Tabbed navigation (horizontal tabs on desktop, vertical on mobile)
- Consistent spacing (24px padding, 16px gap)
- Dark mode support
- Responsive breakpoints (mobile: <768px, tablet: 768-1024px, desktop: >1024px)

### Component Hierarchy

```tsx
<SettingsLayout>
  <Tabs>
    <TabsList>
      <TabsTrigger value="tenant">Tenant</TabsTrigger>
      <TabsTrigger value="team">Team</TabsTrigger>
      <TabsTrigger value="usage">Usage</TabsTrigger>
      <TabsTrigger value="api-keys">API Keys</TabsTrigger>
    </TabsList>
    <TabsContent value="tenant">
      <TenantSettingsForm />  // PRD-012b
    </TabsContent>
    <TabsContent value="team">
      <TeamMembers />  // PRD-012c
    </TabsContent>
    <TabsContent value="usage">
      <UsageDashboard />  // PRD-012d
    </TabsContent>
    <TabsContent value="api-keys">
      <ApiKeys />  // PRD-012e
    </TabsContent>
  </Tabs>
</SettingsLayout>
```

## Implementation

### Frontend Files

**Settings Layout:**
```tsx
// bff/src/routes/settings/index.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate, useLocation } from '@tanstack/react-router';

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab from pathname
  const activeTab = location.pathname.split('/')[2] || 'tenant';

  const handleTabChange = (value: string) => {
    navigate({ to: `/settings/${value}` });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="tenant">Tenant</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>

        <Outlet />
      </Tabs>
    </div>
  );
}
```

**Tenant Context Provider:**
```tsx
// bff/src/lib/context/tenant-context.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface TenantContextType {
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
  switchTenant: (tenantId: string) => void;
  availableTenants: Array<{ id: string; name: string; logo: string | null }>;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentTenantId, setCurrentTenantId] = useState<string>(() => {
    // Load from localStorage or JWT
    return localStorage.getItem('selectedTenantId') || '';
  });

  // Fetch tenant metadata
  const { data: tenant } = useQuery({
    queryKey: ['tenant', currentTenantId, 'settings'],
    queryFn: () => api.getTenantSettings(currentTenantId),
    enabled: !!currentTenantId,
  });

  // Fetch available tenants for multi-tenant users
  const { data: availableTenants } = useQuery({
    queryKey: ['user', 'tenants'],
    queryFn: () => api.getUserTenants(),
  });

  const switchTenant = (tenantId: string) => {
    setCurrentTenantId(tenantId);
    localStorage.setItem('selectedTenantId', tenantId);
  };

  return (
    <TenantContext.Provider
      value={{
        tenantId: currentTenantId,
        tenantName: tenant?.name || 'Loading...',
        tenantLogo: tenant?.logoUrl || null,
        switchTenant,
        availableTenants: availableTenants || [],
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

// Convenience hook for just tenant ID
export function useTenantId() {
  return useTenant().tenantId;
}
```

**Header with Tenant Switcher:**
```tsx
// bff/src/components/layout/header.tsx
import { Link } from '@tanstack/react-router';
import { useTenant } from '@/lib/context/tenant-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChevronDown, Building2 } from 'lucide-react';

export function Header() {
  const { tenantName, tenantLogo, switchTenant, availableTenants } = useTenant();

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-4">
          {/* Tenant Logo */}
          {tenantLogo && (
            <img src={tenantLogo} alt={tenantName} className="h-8 w-auto" />
          )}

          <Link to="/" className="text-2xl font-bold">
            BeTrace
          </Link>
        </div>

        <nav className="flex items-center gap-6">
          <Link to="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <Link to="/rules" className="hover:underline">
            Rules
          </Link>
          <Link to="/signals" className="hover:underline">
            Signals
          </Link>

          {/* Tenant Switcher (if multi-tenant user) */}
          {availableTenants.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Building2 className="h-4 w-4 mr-2" />
                  {tenantName}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Switch Tenant</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableTenants.map((tenant) => (
                  <DropdownMenuItem
                    key={tenant.id}
                    onClick={() => switchTenant(tenant.id)}
                  >
                    {tenant.logo && (
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={tenant.logo} />
                        <AvatarFallback>{tenant.name[0]}</AvatarFallback>
                      </Avatar>
                    )}
                    {tenant.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Link to="/settings/tenant">
            <Button variant="ghost" size="sm">
              Settings
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

**Dashboard Usage Widgets:**
```tsx
// bff/src/components/dashboard/usage-widget.tsx
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useTenantId } from '@/lib/context/tenant-context';

export function UsageWidget() {
  const tenantId = useTenantId();

  const { data: usage } = useQuery({
    queryKey: ['tenant', tenantId, 'usage'],
    queryFn: () => api.getUsage(tenantId),
    refetchInterval: 60000,  // Refresh every minute
  });

  if (!usage) return null;

  const metrics = [
    { key: 'api_call', label: 'API Calls', icon: '🔌' },
    { key: 'signal', label: 'Signals', icon: '🚨' },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Usage This Month</h3>
        <Badge variant="outline">{usage.tier.toUpperCase()}</Badge>
      </div>

      <div className="space-y-4">
        {metrics.map((metric) => {
          const data = usage.usage[metric.key];
          const isUnlimited = usage.tier === 'enterprise';

          return (
            <div key={metric.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm flex items-center gap-2">
                  <span>{metric.icon}</span>
                  {metric.label}
                </span>
                <span className="text-sm font-medium">
                  {data.current.toLocaleString()}
                  {!isUnlimited && ` / ${data.limit.toLocaleString()}`}
                </span>
              </div>
              {!isUnlimited && (
                <Progress
                  value={data.percentageUsed}
                  className="h-2"
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

**Route Configuration:**
```tsx
// bff/src/routes/settings.tsx (parent route)
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
});

// Child routes (already created in PRD-012b, c, d, e)
// bff/src/routes/settings/tenant.tsx
// bff/src/routes/settings/team.tsx
// bff/src/routes/settings/usage.tsx
// bff/src/routes/settings/api-keys.tsx
```

**Storybook Stories:**
```tsx
// bff/src/stories/TenantAdmin.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { SettingsLayout } from '../routes/settings';
import { TenantProvider } from '../lib/context/tenant-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const meta: Meta<typeof SettingsLayout> = {
  title: 'Pages/Tenant Admin',
  component: SettingsLayout,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <TenantProvider>
          <Story />
        </TenantProvider>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SettingsLayout>;

export const TenantSettings: Story = {
  parameters: {
    route: '/settings/tenant',
  },
};

export const TeamManagement: Story = {
  parameters: {
    route: '/settings/team',
  },
};

export const UsageDashboard: Story = {
  parameters: {
    route: '/settings/usage',
  },
};

export const ApiKeys: Story = {
  parameters: {
    route: '/settings/api-keys',
  },
};

export const MultiTenantUser: Story = {
  parameters: {
    mockData: {
      availableTenants: [
        { id: 'tenant-1', name: 'Acme Corp', logo: null },
        { id: 'tenant-2', name: 'Widget Inc', logo: null },
      ],
    },
  },
};
```

## Success Criteria

**Functional:**
- [ ] Settings page with 4 tabs (Tenant, Team, Usage, API Keys)
- [ ] Tab navigation via Tanstack Router
- [ ] Tenant context provider supplies tenantId to all components
- [ ] Header displays tenant logo (if configured)
- [ ] Tenant switcher for multi-tenant users
- [ ] Dashboard displays usage widgets
- [ ] All forms validate input client-side
- [ ] Success/error toast notifications
- [ ] Responsive design (mobile, tablet, desktop)

**Design:**
- [ ] Consistent spacing (24px padding, 16px gap)
- [ ] Dark mode support (all components)
- [ ] shadcn/ui components throughout
- [ ] Loading states for async operations
- [ ] Empty states for no data
- [ ] Error states with retry buttons

**Accessibility:**
- [ ] Keyboard navigation works
- [ ] ARIA labels on interactive elements
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA

## Testing Requirements

**Component Tests (Vitest):**
```tsx
// bff/src/components/layout/header.test.tsx
describe('Header', () => {
  it('displays tenant name', () => {
    render(<Header />, { wrapper: TenantProvider });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('shows tenant switcher for multi-tenant users', () => {
    render(<Header />, {
      wrapper: TenantProvider,
      mockData: { availableTenants: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }] },
    });
    expect(screen.getByRole('button', { name: /switch tenant/i })).toBeInTheDocument();
  });
});

// bff/src/routes/settings/index.test.tsx
describe('Settings Layout', () => {
  it('renders all tabs', () => {
    render(<SettingsLayout />);
    expect(screen.getByRole('tab', { name: 'Tenant' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Usage' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'API Keys' })).toBeInTheDocument();
  });

  it('navigates to correct route on tab click', async () => {
    const { user } = render(<SettingsLayout />);
    await user.click(screen.getByRole('tab', { name: 'Team' }));
    expect(window.location.pathname).toBe('/settings/team');
  });
});
```

**Storybook Visual Regression:**
```bash
# Run Storybook
npm run storybook

# Visual regression tests (Chromatic or Percy)
npm run storybook:test
```

## Files to Create

**Frontend:**
- `bff/src/routes/settings/index.tsx` (layout)
- `bff/src/lib/context/tenant-context.tsx`
- `bff/src/components/dashboard/usage-widget.tsx`
- `bff/src/stories/TenantAdmin.stories.tsx`
- `bff/src/components/layout/header.test.tsx`
- `bff/src/routes/settings/index.test.tsx`

## Files to Modify

**Frontend:**
- `bff/src/components/layout/header.tsx` - Add tenant logo and switcher
- `bff/src/routes/dashboard.tsx` - Add usage widget
- `bff/src/main.tsx` - Wrap app with TenantProvider
- `bff/src/routeTree.gen.ts` - Regenerate after adding routes

## Integration Points

**Depends On:**
- **PRD-012a:** Tenant metadata (name, logo)
- **PRD-012b:** Tenant settings API
- **PRD-012c:** Team management API
- **PRD-012d:** Usage dashboard API
- **PRD-012e:** API keys API

**Consumed By:**
- All frontend pages (use useTenantId() hook)

## ADR Compliance

- **ADR-011 (Pure Application Framework):** Frontend builds static assets, no infrastructure
- **ADR-006 (Tanstack Frontend Architecture):** Uses Tanstack Router, Query, Form
- **ADR-015 (Workflow Standards):** Component tests with Vitest, Storybook documentation

## Design System

**Colors:**
- Primary: #4F46E5 (Indigo)
- Success: #10B981 (Green)
- Warning: #F59E0B (Amber)
- Destructive: #EF4444 (Red)

**Typography:**
- Font: Inter (sans-serif)
- Heading: 28px bold
- Subheading: 20px semibold
- Body: 14px regular
- Small: 12px regular

**Spacing:**
- Page padding: 24px
- Card padding: 24px
- Section gap: 16px
- Element gap: 8px

## Storybook Coverage

**Stories Required:**
- [ ] Settings layout (all tabs)
- [ ] Tenant settings form (light/dark)
- [ ] Team members table (empty, populated, loading)
- [ ] Usage dashboard (free, pro, enterprise tiers)
- [ ] API keys page (no keys, with keys)
- [ ] Header (single tenant, multi-tenant)
- [ ] Usage widget (normal, warning, exceeded)

## Accessibility Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Tab navigation follows logical order
- [ ] Focus visible on all focusable elements
- [ ] ARIA labels on icon-only buttons
- [ ] Error messages announced to screen readers
- [ ] Color not only way to convey information
- [ ] Text contrast ratio ≥4.5:1 (AA)

## Future Enhancements

- [ ] Tenant onboarding wizard (multi-step form)
- [ ] Billing integration (Stripe checkout)
- [ ] Custom branding (primary color, custom domain)
- [ ] Audit log viewer (compliance events timeline)
- [ ] Team roles matrix (visual permission editor)
- [ ] Usage forecasting (predict quota exhaustion)
- [ ] Mobile app deep links (from notification to signal detail)
