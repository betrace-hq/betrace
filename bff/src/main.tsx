import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';

// TanStack Query for server state management
import { QueryProvider } from '@/lib/providers/query-client';

// WorkOS + React Context for authentication
import { AuthProvider } from '@/lib/auth/auth-context';

// Theme provider for light/dark mode
import { ThemeProvider } from '@/lib/theme/theme-context';

// Import the generated route tree
import { routeTree } from './routeTree.gen';

import './styles/globals.css';

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// TanStack-first app: Query + Router + WorkOS + Theme
function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

// Render immediately (no loading states, no async setup)
const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);