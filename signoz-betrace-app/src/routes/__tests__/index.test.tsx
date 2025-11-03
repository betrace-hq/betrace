import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '../index';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('DashboardPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    localStorageMock.clear();
  });

  it('renders dashboard title', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('displays zero stats by default', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    expect(screen.getByText('Total Rules')).toBeInTheDocument();
    expect(screen.getByText('Active Rules')).toBeInTheDocument();
    expect(screen.getByText('Violations (24h)')).toBeInTheDocument();
  });

  it('shows quick start guide', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    expect(screen.getByText('Quick Start')).toBeInTheDocument();
    expect(screen.getByText(/Configure Backend Connection/)).toBeInTheDocument();
    expect(screen.getByText(/Create Your First Rule/)).toBeInTheDocument();
    expect(screen.getByText(/Monitor Violations/)).toBeInTheDocument();
  });

  it('shows SigNoz integration info', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    expect(screen.getByText('Integration with SigNoz')).toBeInTheDocument();
  });
});
