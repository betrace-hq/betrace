import React, { useState } from 'react';
import { AppPluginMeta, PluginConfigPageProps } from '@grafana/data';
import { Button, Field, Input, VerticalGroup } from '@grafana/ui';

/**
 * ConfigPage - Plugin configuration
 *
 * Allows admins to configure BeTrace backend URL and API settings
 */
export const ConfigPage: React.FC<PluginConfigPageProps<AppPluginMeta>> = ({ plugin }) => {
  const [backendUrl, setBackendUrl] = useState(
    plugin.meta.jsonData?.backendUrl || 'http://localhost:8080'
  );

  return (
    <div style={{ padding: '20px' }}>
      <VerticalGroup spacing="lg">
        <h2>BeTrace Plugin Configuration</h2>

        <Field
          label="BeTrace Backend URL"
          description="URL of the BeTrace backend API (Quarkus server)"
        >
          <Input
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.currentTarget.value)}
            placeholder="http://localhost:8080"
            width={50}
          />
        </Field>

        <div>
          <Button variant="primary" disabled>
            Save Configuration (Coming in Phase 2)
          </Button>
        </div>

        <div style={{ marginTop: '40px' }}>
          <h3>Backend API Endpoints</h3>
          <p>
            The BeTrace backend should expose the following REST API:
          </p>
          <ul>
            <li><code>GET /api/rules</code> - List all rules</li>
            <li><code>POST /api/rules</code> - Create new rule</li>
            <li><code>PUT /api/rules/:id</code> - Update rule</li>
            <li><code>DELETE /api/rules/:id</code> - Delete rule</li>
            <li><code>POST /api/rules/test</code> - Test rule with sample trace</li>
          </ul>
        </div>
      </VerticalGroup>
    </div>
  );
};
