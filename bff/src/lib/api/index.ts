// Export all API clients and types
export * from './client';
export * from './rules';
export * from './signals';

// Export WebSocket client
export * from '../websocket/client';

// Environment configuration
export const API_ENDPOINTS = {
  FLUO_API: import.meta.env.VITE_FLUO_API_URL || 'http://localhost:8080',
  FLUO_WS: import.meta.env.VITE_FLUO_WS_URL || 'ws://localhost:8080',
} as const;

// Health check function
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_ENDPOINTS.FLUO_API}/q/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}