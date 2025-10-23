import React from 'react';
import { AppRootProps } from '@grafana/data';
import { Alert, Button, VerticalGroup } from '@grafana/ui';

/**
 * RootPage - Main entry point for FLUO plugin
 *
 * Phase 1: Skeleton UI showing plugin is installed and working
 * Future: Full rule management interface with Monaco editor
 */
export const RootPage: React.FC<AppRootProps> = () => {
  return (
    <div style={{ padding: '20px' }}>
      <VerticalGroup spacing="lg">
        <h1>FLUO - Behavioral Assurance for OpenTelemetry</h1>

        <Alert title="Plugin Installed Successfully" severity="success">
          The FLUO Grafana App Plugin is installed and running.
          This is Phase 1 (Plugin Skeleton) - full rule management UI coming soon.
        </Alert>

        <div>
          <h2>What is FLUO?</h2>
          <p>
            FLUO enables pattern matching on OpenTelemetry traces using FluoDSL.
            Define invariants to detect violations in production systems.
          </p>
        </div>

        <div>
          <h2>Next Steps</h2>
          <ul>
            <li>✅ Plugin skeleton installed</li>
            <li>⏸️ Phase 2: Rule list and CRUD operations</li>
            <li>⏸️ Phase 3: Monaco editor with FluoDSL syntax highlighting</li>
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
            <strong>ADR-027:</strong> FLUO as Grafana App Plugin
            <br />
            <strong>PRD-030:</strong> Grafana App Plugin Specification
          </p>
        </div>
      </VerticalGroup>
    </div>
  );
};
