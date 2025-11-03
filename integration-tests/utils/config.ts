/**
 * Integration test configuration
 *
 * Service URLs for BeTrace stack. Override via environment variables:
 * - BETRACE_BACKEND_URL
 * - BETRACE_SIGNOZ_URL
 * - BETRACE_GRAFANA_URL
 * - BETRACE_TEMPO_URL
 */

export const config = {
  backend: process.env.BETRACE_BACKEND_URL || 'http://localhost:12011',
  signoz: process.env.BETRACE_SIGNOZ_URL || 'http://localhost:3001',
  grafana: process.env.BETRACE_GRAFANA_URL || 'http://localhost:12015',
  tempo: process.env.BETRACE_TEMPO_URL || 'http://localhost:3200',

  // API endpoints
  api: {
    rules: '/v1/rules',
    violations: '/v1/violations',
    health: '/health',
  },

  // Test timeouts (milliseconds)
  timeouts: {
    apiRequest: 5000,
    uiAction: 10000,
    backendSync: 2000,  // Time for backend to persist data
  },

  // Grafana credentials
  grafana: {
    username: 'admin',
    password: 'admin',
  },
};

export default config;
