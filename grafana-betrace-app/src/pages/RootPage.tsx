import React, { useState, useEffect } from 'react';
import { AppRootProps } from '@grafana/data';
import { Alert, Button, VerticalGroup, Spinner } from '@grafana/ui';

/**
 * RootPage - Main entry point for BeTrace plugin
 *
 * Phase 1: Skeleton UI showing plugin is installed and working
 * Phase 1.5: Test API connectivity
 * Future: Full rule management interface with Monaco editor
 */
export const RootPage: React.FC<AppRootProps> = () => {
  const [apiStatus, setApiStatus] = useState<'loading' | 'success' | 'error' | null>(null);
  const [apiMessage, setApiMessage] = useState<string>('');
  const [ruleCount, setRuleCount] = useState<number>(0);

  const testApiConnection = async () => {
    setApiStatus('loading');
    try {
      // Use Caddy proxy URL (http://api.localhost:3000) for development
      const response = await fetch('http://api.localhost:3000/api/rules');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const rules = await response.json();
      setRuleCount(rules.length);
      setApiStatus('success');
      setApiMessage(`Connected to BeTrace backend. Found ${rules.length} rule(s).`);
    } catch (error) {
      setApiStatus('error');
      setApiMessage(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <VerticalGroup spacing="lg">
        <h1>BeTrace - Behavioral Assurance for OpenTelemetry</h1>

        <Alert title="Plugin Installed Successfully" severity="success">
          The BeTrace Grafana App Plugin is installed and running.
          This is Phase 1 (Plugin Skeleton) - full rule management UI coming soon.
        </Alert>

        {/* API Connectivity Test */}
        <div>
          <h2>Backend Connectivity Test</h2>
          <p>Test connection to BeTrace backend API (via Caddy proxy at http://api.localhost:3000)</p>
          <Button onClick={testApiConnection} disabled={apiStatus === 'loading'}>
            {apiStatus === 'loading' ? <><Spinner inline /> Testing...</> : 'Test API Connection'}
          </Button>

          {apiStatus === 'success' && (
            <Alert title="API Connected" severity="success" style={{ marginTop: '10px' }}>
              {apiMessage}
            </Alert>
          )}

          {apiStatus === 'error' && (
            <Alert title="API Connection Failed" severity="error" style={{ marginTop: '10px' }}>
              {apiMessage}
              <br /><br />
              <strong>Troubleshooting:</strong>
              <ul>
                <li>Is dev environment running? Start with: <code>nix run .#dev</code></li>
                <li>Backend should be proxied via Caddy at http://api.localhost:3000</li>
                <li>Direct backend URL: http://localhost:12011</li>
              </ul>
            </Alert>
          )}
        </div>

        <div>
          <h2>What is BeTrace?</h2>
          <p>
            BeTrace enables pattern matching on OpenTelemetry traces using BeTraceDSL.
            Define invariants to detect violations in production systems.
          </p>
        </div>

        <div>
          <h2>Next Steps</h2>
          <ul>
            <li>✅ Plugin skeleton installed</li>
            <li>⏸️ Phase 2: Rule list and CRUD operations</li>
            <li>⏸️ Phase 3: Monaco editor with BeTraceDSL syntax highlighting</li>
            <li>⏸️ Phase 4: Rule testing with sample traces</li>
            <li>⏸️ Phase 5: Polish and production readiness</li>
          </ul>
        </div>

        <div>
          <Button variant="primary" disabled>
            Create Rule (Coming in Phase 2)
          </Button>
        </div>

        <div style={{ marginTop: '40px', fontSize: '12px', color: '#888' }}>
          <p>
            <strong>ADR-027:</strong> BeTrace as Grafana App Plugin
            <br />
            <strong>PRD-030:</strong> Grafana App Plugin Specification
          </p>
        </div>
      </VerticalGroup>
    </div>
  );
};
