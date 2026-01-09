import React, { useState, useEffect, useCallback } from 'react';
import { AppPluginMeta, PluginConfigPageProps } from '@grafana/data';
import {
  Button,
  Field,
  Input,
  VerticalGroup,
  HorizontalGroup,
  Alert,
  Spinner,
  Badge,
  SecretInput,
  useTheme2,
} from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';

/**
 * Plugin configuration interface
 */
interface BeTracePluginSettings {
  backendUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

interface BeTraceSecureSettings {
  apiKey?: string;
}

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';

/**
 * ConfigPage - Plugin configuration
 *
 * Allows admins to configure BeTrace backend URL and API settings.
 * Persists settings via Grafana plugin API.
 */
export const ConfigPage: React.FC<PluginConfigPageProps<AppPluginMeta<BeTracePluginSettings>>> = ({ plugin }) => {
  const theme = useTheme2();

  // Form state
  const [backendUrl, setBackendUrl] = useState(
    plugin.meta.jsonData?.backendUrl || 'http://localhost:12011'
  );
  const [timeout, setTimeout] = useState(
    plugin.meta.jsonData?.timeout || 30000
  );
  const [retryAttempts, setRetryAttempts] = useState(
    plugin.meta.jsonData?.retryAttempts || 3
  );
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(
    !!(plugin.meta.secureJsonFields as any)?.apiKey
  );

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Validate URL format
  const validateUrl = useCallback((url: string): boolean => {
    if (!url) {
      setUrlError('Backend URL is required');
      return false;
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setUrlError('URL must use http or https protocol');
        return false;
      }
      setUrlError(null);
      return true;
    } catch {
      setUrlError('Invalid URL format');
      return false;
    }
  }, []);

  // Validate URL on change
  useEffect(() => {
    if (backendUrl) {
      validateUrl(backendUrl);
    }
  }, [backendUrl, validateUrl]);

  // Test connection to backend
  const testConnection = useCallback(async () => {
    if (!validateUrl(backendUrl)) {
      return;
    }

    setConnectionStatus('testing');
    setConnectionError(null);

    try {
      const response = await fetch(`${backendUrl}/v1/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey || apiKeyConfigured ? { 'X-API-Key': apiKey || '***' } : {}),
        },
        signal: AbortSignal.timeout(timeout),
      });

      if (response.ok) {
        setConnectionStatus('connected');
        setConnectionError(null);
      } else {
        setConnectionStatus('failed');
        setConnectionError(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setConnectionStatus('failed');
      if (err instanceof Error) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          setConnectionError('Connection timed out');
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setConnectionError('Unable to reach backend - check URL and ensure backend is running');
        } else {
          setConnectionError(err.message);
        }
      } else {
        setConnectionError('Unknown error occurred');
      }
    }
  }, [backendUrl, apiKey, apiKeyConfigured, timeout, validateUrl]);

  // Save configuration
  const saveConfig = useCallback(async () => {
    if (!validateUrl(backendUrl)) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      // Update plugin settings via Grafana API
      await getBackendSrv().post(`/api/plugins/${plugin.meta.id}/settings`, {
        enabled: plugin.meta.enabled,
        pinned: plugin.meta.pinned,
        jsonData: {
          backendUrl,
          timeout,
          retryAttempts,
        },
        secureJsonData: apiKey ? { apiKey } : undefined,
      });

      setSaveMessage({ type: 'success', text: 'Configuration saved successfully' });

      // Clear API key from form after save (it's now stored securely)
      if (apiKey) {
        setApiKey('');
        setApiKeyConfigured(true);
      }
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save configuration',
      });
    } finally {
      setSaving(false);
    }
  }, [plugin.meta.id, plugin.meta.enabled, plugin.meta.pinned, backendUrl, timeout, retryAttempts, apiKey, validateUrl]);

  // Reset API key
  const resetApiKey = useCallback(() => {
    setApiKey('');
    setApiKeyConfigured(false);
  }, []);

  // Render connection status badge
  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case 'testing':
        return <Spinner size="sm" />;
      case 'connected':
        return <Badge text="Connected" color="green" icon="check" />;
      case 'failed':
        return <Badge text="Failed" color="red" icon="exclamation-triangle" />;
      default:
        return <Badge text="Not tested" color="blue" icon="question-circle" />;
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <VerticalGroup spacing="lg">
        <h2>BeTrace Plugin Configuration</h2>

        {/* Save feedback */}
        {saveMessage && (
          <Alert
            severity={saveMessage.type === 'success' ? 'success' : 'error'}
            title={saveMessage.type === 'success' ? 'Saved' : 'Error'}
            onRemove={() => setSaveMessage(null)}
          >
            {saveMessage.text}
          </Alert>
        )}

        {/* Backend URL */}
        <Field
          label="BeTrace Backend URL"
          description="URL of the BeTrace backend API (Go server)"
          required
          invalid={!!urlError}
          error={urlError}
        >
          <Input
            name="backendUrl"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.currentTarget.value)}
            placeholder="http://localhost:12011"
            width={50}
          />
        </Field>

        {/* API Key */}
        <Field
          label="API Key"
          description="Optional API key for backend authentication"
        >
          <SecretInput
            name="apiKey"
            isConfigured={apiKeyConfigured}
            value={apiKey}
            onChange={(e) => setApiKey(e.currentTarget.value)}
            onReset={resetApiKey}
            placeholder="Enter API key (optional)"
            width={50}
          />
        </Field>

        {/* Timeout */}
        <Field
          label="Request Timeout (ms)"
          description="Maximum time to wait for backend responses"
        >
          <Input
            name="timeout"
            type="number"
            value={timeout}
            onChange={(e) => setTimeout(parseInt(e.currentTarget.value, 10) || 30000)}
            placeholder="30000"
            width={20}
            min={1000}
            max={300000}
          />
        </Field>

        {/* Retry Attempts */}
        <Field
          label="Retry Attempts"
          description="Number of retry attempts for failed requests"
        >
          <Input
            name="retryAttempts"
            type="number"
            value={retryAttempts}
            onChange={(e) => setRetryAttempts(parseInt(e.currentTarget.value, 10) || 3)}
            placeholder="3"
            width={10}
            min={0}
            max={10}
          />
        </Field>

        {/* Connection Status */}
        <Field label="Connection Status">
          <HorizontalGroup spacing="md" align="center">
            <div data-testid="connection-status" className="connection-status">
              {renderConnectionStatus()}
            </div>
            <Button
              variant="secondary"
              onClick={testConnection}
              disabled={connectionStatus === 'testing' || !!urlError}
            >
              Test Connection
            </Button>
            {connectionStatus === 'failed' && (
              <Button
                variant="secondary"
                onClick={testConnection}
              >
                Retry
              </Button>
            )}
          </HorizontalGroup>
        </Field>

        {/* Connection error details */}
        {connectionError && (
          <Alert severity="error" title="Connection Failed">
            {connectionError}
          </Alert>
        )}

        {/* Save Button */}
        <HorizontalGroup spacing="md">
          <Button
            variant="primary"
            onClick={saveConfig}
            disabled={saving || !!urlError}
          >
            {saving ? <Spinner inline size="sm" /> : null}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </HorizontalGroup>

        {/* API Documentation */}
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: `1px solid ${theme.colors.border.weak}` }}>
          <h3>Backend API Endpoints</h3>
          <p style={{ color: theme.colors.text.secondary }}>
            The BeTrace backend should expose the following REST API:
          </p>
          <ul style={{ color: theme.colors.text.secondary }}>
            <li><code>GET /v1/health</code> - Health check endpoint</li>
            <li><code>GET /v1/rules</code> - List all rules</li>
            <li><code>POST /v1/rules</code> - Create new rule</li>
            <li><code>PUT /v1/rules/:id</code> - Update rule</li>
            <li><code>DELETE /v1/rules/:id</code> - Delete rule</li>
            <li><code>POST /v1/rules/:id/enable</code> - Enable rule</li>
            <li><code>POST /v1/rules/:id/disable</code> - Disable rule</li>
          </ul>
        </div>
      </VerticalGroup>
    </div>
  );
};
