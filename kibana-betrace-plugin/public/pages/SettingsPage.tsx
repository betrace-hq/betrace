import React, { useState, useEffect } from 'react';
import {
  EuiPanel,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
  EuiSpacer,
  EuiTitle,
  EuiCallOut,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHealth,
} from '@elastic/eui';

export const SettingsPage: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState('http://localhost:12011');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem('betrace_backend_url');
    if (savedUrl) setBackendUrl(savedUrl);
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');

    try {
      const response = await fetch(`${backendUrl}/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.status === 'healthy') {
        setConnectionStatus('success');
      } else {
        throw new Error('Backend returned unhealthy status');
      }
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const saveSettings = () => {
    localStorage.setItem('betrace_backend_url', backendUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <>
      <EuiTitle size="l">
        <h1>Settings</h1>
      </EuiTitle>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiTitle size="m">
          <h2>Backend Configuration</h2>
        </EuiTitle>
        <EuiSpacer size="m" />

        <EuiForm>
          <EuiFormRow
            label="BeTrace Backend URL"
            helpText="URL of the BeTrace backend API server"
          >
            <EuiFieldText
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://localhost:12011"
            />
          </EuiFormRow>

          <EuiSpacer size="m" />

          <EuiFlexGroup gutterSize="s" alignItems="center">
            <EuiFlexItem grow={false}>
              <EuiButton
                onClick={testConnection}
                isLoading={connectionStatus === 'testing'}
              >
                Test Connection
              </EuiButton>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                fill
                onClick={saveSettings}
              >
                Save Settings
              </EuiButton>
            </EuiFlexItem>
            {connectionStatus === 'success' && (
              <EuiFlexItem grow={false}>
                <EuiHealth color="success">Connected successfully</EuiHealth>
              </EuiFlexItem>
            )}
            {connectionStatus === 'error' && (
              <EuiFlexItem grow={false}>
                <EuiHealth color="danger">Connection failed</EuiHealth>
              </EuiFlexItem>
            )}
            {saved && (
              <EuiFlexItem grow={false}>
                <EuiHealth color="success">Settings saved</EuiHealth>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>

          {errorMessage && (
            <>
              <EuiSpacer size="m" />
              <EuiCallOut title="Connection Error" color="danger" iconType="alert">
                <p>{errorMessage}</p>
              </EuiCallOut>
            </>
          )}
        </EuiForm>
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiCallOut
        title="Elasticsearch Integration"
        color="primary"
        iconType="iInCircle"
      >
        <p>
          Violations are automatically indexed in Elasticsearch by the BeTrace backend.
          Configure the Elasticsearch connection in the backend's configuration file.
        </p>
      </EuiCallOut>
    </>
  );
};
