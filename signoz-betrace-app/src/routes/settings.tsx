import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const [backendUrl, setBackendUrl] = useState('http://localhost:12011');
  const [signozUrl, setSignozUrl] = useState('http://localhost:3301');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedBackendUrl = localStorage.getItem('betrace_backend_url');
    const savedSignozUrl = localStorage.getItem('signoz_url');
    if (savedBackendUrl) setBackendUrl(savedBackendUrl);
    if (savedSignozUrl) setSignozUrl(savedSignozUrl);
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');

    try {
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

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
    localStorage.setItem('signoz_url', signozUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
        <p className="mt-2 text-sm text-gray-600">
          Configure backend connections and application preferences
        </p>
      </div>

      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Backend Configuration</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="backendUrl" className="block text-sm font-medium text-gray-700">
                BeTrace Backend URL
              </label>
              <input
                type="text"
                id="backendUrl"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://localhost:12011"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                URL of the BeTrace backend API server
              </p>
            </div>

            <div>
              <label htmlFor="signozUrl" className="block text-sm font-medium text-gray-700">
                SigNoz URL
              </label>
              <input
                type="text"
                id="signozUrl"
                value={signozUrl}
                onChange={(e) => setSignozUrl(e.target.value)}
                placeholder="http://localhost:3301"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                URL of your SigNoz instance for trace viewing
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={testConnection}
                disabled={connectionStatus === 'testing'}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {connectionStatus === 'testing' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>

              {connectionStatus === 'success' && (
                <span className="inline-flex items-center text-sm text-green-700">
                  <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Connected successfully
                </span>
              )}

              {connectionStatus === 'error' && (
                <span className="inline-flex items-center text-sm text-red-700">
                  <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Connection failed
                </span>
              )}
            </div>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={saveSettings}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Settings
          </button>
          {saved && (
            <span className="inline-flex items-center text-sm text-green-700">
              <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Saved
            </span>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Version</dt>
            <dd className="mt-1 text-sm text-gray-900">0.1.0</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Platform</dt>
            <dd className="mt-1 text-sm text-gray-900">SigNoz</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Backend API</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono text-xs">{backendUrl}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">SigNoz Instance</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono text-xs">{signozUrl}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">SigNoz Collector Configuration</h3>
            <p className="mt-2 text-sm text-yellow-700">
              Don't forget to configure the custom BeTrace OTLP receiver in your SigNoz collector to ingest violation spans. See the integration guide for details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
