import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '../settings';

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

// Mock fetch
global.fetch = vi.fn();

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders settings page', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Backend Configuration')).toBeInTheDocument();
  });

  it('loads saved settings from localStorage', () => {
    localStorageMock.setItem('betrace_backend_url', 'http://custom:8080');
    localStorageMock.setItem('signoz_url', 'http://signoz:3301');

    render(<SettingsPage />);

    const backendInput = screen.getByPlaceholderText('http://localhost:12011') as HTMLInputElement;
    const signozInput = screen.getByPlaceholderText('http://localhost:3301') as HTMLInputElement;

    expect(backendInput.value).toBe('http://custom:8080');
    expect(signozInput.value).toBe('http://signoz:3301');
  });

  it('saves settings to localStorage', async () => {
    render(<SettingsPage />);

    const backendInput = screen.getByPlaceholderText('http://localhost:12011');
    fireEvent.change(backendInput, { target: { value: 'http://new-backend:9000' } });

    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(localStorageMock.getItem('betrace_backend_url')).toBe('http://new-backend:9000');
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('tests backend connection successfully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'healthy' }),
    });

    render(<SettingsPage />);

    const testButton = screen.getByText('Test Connection');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('Connected successfully')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:12011/health',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('handles backend connection failure', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Connection failed'));

    render(<SettingsPage />);

    const testButton = screen.getByText('Test Connection');
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows system information', () => {
    render(<SettingsPage />);

    expect(screen.getByText('System Information')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('SigNoz')).toBeInTheDocument();
  });
});
