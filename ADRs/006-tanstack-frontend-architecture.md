# ADR-006: Tanstack Ecosystem for Frontend Architecture

**Status:** Accepted
**Date:** 2025-09-21
**Deciders:** Architecture Team

## Context

FLUO requires a sophisticated frontend application that serves multiple purposes:

1. **Marketing Site**: Public-facing pages for FLUO promotion and documentation
2. **FLUO Web Dashboard**: Real-time signal monitoring and rule management interface
3. **Account/Billing Site**: Tenant and subscription management
4. **Real-time Capabilities**: Live updates for signal status changes and system monitoring
5. **Enterprise Authentication**: Integration with WorkOS for OIDC/SAML
6. **Type Safety**: Prevent runtime errors through compile-time validation
7. **Performance**: Fast initial loads and responsive user interactions

### Problem Statement

Traditional frontend approaches suffer from:
- **Runtime Errors**: Type mismatches and API inconsistencies discovered late
- **State Management Complexity**: Difficult to coordinate local and server state
- **Routing Fragility**: Dynamic routes prone to breaking and hard to refactor
- **Bundle Size**: Large JavaScript bundles slow initial page loads
- **Real-time Challenges**: Complex WebSocket management and state synchronization
- **Development Velocity**: Slow feedback loops and configuration overhead

## Decision

We will use the **Tanstack ecosystem** as the foundation for the FLUO frontend, specifically:

- **Vite**: Build tool for fast development and optimized production builds
- **React 18**: Component framework with concurrent features
- **Tanstack Router**: Type-safe, file-based routing
- **React Context + useReducer**: Reactive state management with background workers
- **Tanstack Query**: Server state management with caching
- **TypeScript**: Static typing throughout the application
- **shadcn/ui**: Component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first styling with custom design system

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Frontend                       │
│  ┌─────────────┬─────────────┬─────────────┐    │
│  │  Marketing  │  Dashboard  │  Account    │    │
│  │    Site     │     SPA     │   Portal    │    │
│  └─────────────┴─────────────┴─────────────┘    │
│                      │                          │
│  ┌─────────────────────────────────────────┐    │
│  │         Tanstack Router                 │    │
│  │     (Type-safe, File-based)             │    │
│  └─────────────────────────────────────────┘    │
│                      │                          │
│  ┌─────────────┬─────────────┬─────────────┐    │
│  │   React     │  TanStack   │  WebSocket  │    │
│  │  Context    │    Query    │   Client    │    │
│  │  (UI State) │(Server Data)│(Real-time)  │    │
│  └─────────────┴─────────────┴─────────────┘    │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│                BFF API                          │
│  ┌─────────────┬─────────────┬─────────────┐    │
│  │    REST     │   GraphQL   │  WebSocket  │    │
│  │   Endpoints │   Queries   │   Events    │    │
│  └─────────────┴─────────────┴─────────────┘    │
└─────────────────────────────────────────────────┘
```

## Implementation Details

### Reactive Architecture Pattern

The frontend uses a high-performance reactive architecture:

```typescript
// UI Controller using React Context + useReducer
interface UIState {
  signalData: Signal[];
  loading: boolean;
}

const UIContext = createContext<{
  state: UIState;
  dispatch: Dispatch<UIAction>;
}>();

// Reducer for state management
const uiReducer = (state: UIState, action: UIAction): UIState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SIGNALS':
      return { ...state, signalData: action.payload, loading: false };
    default:
      return state;
  }
};

// Background Workers handle heavy operations
// auth-worker.ts - Authentication off main thread
// data-worker.ts - Data fetching and caching
```

### Type-Safe Routing

Tanstack Router provides compile-time route validation:

```typescript
// File-based routes with full type safety
const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  signalsRoute.addChildren([
    signalsIndexRoute,
    signalRoute
  ])
]);

// Router knows all routes and their parameters
router.navigate({ to: '/signals/$signalId', params: { signalId: '123' } });
```

### Server State Management

Tanstack Query handles server state with automatic caching:

```typescript
// Automatic background refetching and caching
const signalsQuery = useQuery({
  queryKey: ['signals'],
  queryFn: () => api.signals.list(),
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchInterval: 30 * 1000, // 30 seconds
});
```

### Real-time Updates

WebSocket integration with reactive state updates:

```typescript
// WebSocket client with automatic reconnection
const useWebSocket = () => {
  const { dispatch } = useContext(UIContext);

  useEffect(() => {
    const ws = new WebSocket('/api/ws');
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      dispatch({
        type: 'UPDATE_SIGNAL',
        payload: { signalId: update.signalId, status: update.status }
      });
    };
    return () => ws.close();
  }, [dispatch]);
};
```

## Alternatives Considered

### 1. Next.js with App Router
**Rejected**:
- Overkill for SPA requirements
- Server-side rendering not needed for dashboard
- Complex deployment for containerized apps
- Less flexibility in build configuration

### 2. Vue.js with Nuxt
**Rejected**:
- Team expertise primarily in React ecosystem
- Tanstack ecosystem not available
- Different TypeScript patterns

### 3. Svelte/SvelteKit
**Rejected**:
- Smaller ecosystem for enterprise features
- Less mature tooling for large applications
- Team unfamiliarity

### 4. Angular
**Rejected**:
- Heavy framework overhead
- Complex dependency injection
- Opinionated structure doesn't fit needs

### 5. Vanilla React with Create React App
**Rejected**:
- CRA is deprecated and unmaintained
- Slower build times compared to Vite
- More configuration needed for advanced features

## Consequences

### Positive
- **Type Safety**: Compile-time validation prevents runtime errors
- **Performance**: Vite provides fast HMR and optimized builds
- **Developer Experience**: File-based routing and automatic code generation
- **Real-time**: Efficient WebSocket handling with reactive updates
- **Scalability**: Component-based architecture scales with team size
- **Maintainability**: Clear separation of concerns between state types
- **Accessibility**: shadcn/ui components have built-in a11y support
- **Customization**: Tailwind allows rapid UI iteration

### Negative
- **Learning Curve**: Team needs to learn Tanstack ecosystem patterns
- **Bundle Size**: TypeScript and multiple libraries increase bundle size
- **Complexity**: More sophisticated than simple jQuery applications
- **Dependency Count**: Many npm dependencies to maintain

### Mitigation Strategies
- **Documentation**: Comprehensive guides in CLAUDE.md for patterns
- **Code Splitting**: Route-based code splitting to reduce initial bundle
- **Tree Shaking**: Vite automatically removes unused code
- **Dependency Auditing**: Regular security and performance reviews
- **Training**: Team workshops on Tanstack patterns and best practices

## Implementation Status

- ✅ **Vite Configuration**: Fast development server with HMR
- ✅ **Tanstack Router**: Type-safe routing with file-based structure
- ✅ **React 18 Setup**: Concurrent features and strict mode
- ✅ **TypeScript Configuration**: Strict type checking enabled
- ✅ **Zustand Store**: Reactive state management with background workers
- ✅ **shadcn/ui Components**: Design system with accessibility
- ✅ **Tailwind CSS**: Custom FLUO design tokens
- ✅ **WebSocket Client**: Real-time signal updates
- ✅ **Authentication**: WorkOS integration with JWT tokens
- ✅ **Security Framework**: Enterprise-grade security with red-team testing
- ⏳ **Tanstack Query**: Server state management (partial implementation)
- ⏳ **E2E Testing**: Playwright test suite (planned)

## Key Configuration

### Vite Configuration
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['@tanstack/react-router'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    }
  }
});
```

### Router Configuration
```typescript
// src/routeTree.gen.ts (auto-generated)
export const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  signalsRoute.addChildren([
    signalsIndexRoute,
    signalRoute.addChildren([signalDetailRoute])
  ]),
  rulesRoute,
  tenantRoute,
  securityRoute
]);
```

### State Management
```typescript
// src/lib/reactive-engine/ui-controller.ts
export const useUIController = create<UIState>((set, get) => ({
  // Reactive state with stable references
  signalData: [],
  authState: { user: null, loading: false },

  // Actions maintain referential stability
  updateSignal: (signalId: string, status: SignalStatus) =>
    set(state => ({
      signalData: state.signalData.map(signal =>
        signal.id === signalId ? { ...signal, status } : signal
      )
    }))
}));
```

## Performance Optimizations

### Code Splitting
- **Route-based**: Each route loads only required components
- **Component-based**: Heavy components lazy-loaded
- **Vendor chunks**: Third-party libraries in separate bundles

### Caching Strategy
- **Service Worker**: Cache static assets and API responses
- **Tanstack Query**: Intelligent server state caching
- **Local Storage**: Persist user preferences and auth state

### Bundle Optimization
```typescript
// Lazy loading heavy components
const SignalAnalytics = lazy(() => import('./SignalAnalytics'));
const RuleEditor = lazy(() => import('./RuleEditor'));

// Preload critical routes
router.preloadRoute({ to: '/signals' });
```

## Future Considerations

1. **Progressive Web App**: Service worker for offline capabilities
2. **Micro-frontends**: Split into independent deployable modules
3. **React Server Components**: When Tanstack Router adds support
4. **Web Workers**: More background processing capabilities
5. **Streaming**: Real-time data streaming optimizations
6. **Analytics**: User behavior tracking and performance monitoring

## References

- [BFF Implementation](../bff/)
- [Tanstack Router Configuration](../bff/src/routeTree.gen.ts)
- [Reactive Architecture](../bff/src/lib/reactive-engine/)
- [Component Library](../bff/src/components/ui/)
- [BFF CLAUDE.md](../bff/CLAUDE.md)
- [Security Framework](../bff/src/lib/security/)
- [Authentication System](../bff/src/lib/auth/)
- [WebSocket Client](../bff/src/lib/websocket/)