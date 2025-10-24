import React from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Field, Input, VerticalGroup, SecretInput } from '@grafana/ui';
import { BeTraceDataSourceOptions, BeTraceSecureJsonData } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<BeTraceDataSourceOptions, BeTraceSecureJsonData> {}

export const ConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
  const { jsonData, secureJsonFields, secureJsonData } = options;

  const onBackendUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        backendUrl: event.target.value,
      },
    });
  };

  const onTimeoutChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        timeout: parseInt(event.target.value, 10) || 30000,
      },
    });
  };

  const onApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        apiKey: event.target.value,
      },
    });
  };

  const onResetApiKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...secureJsonFields,
        apiKey: false,
      },
      secureJsonData: {
        ...secureJsonData,
        apiKey: '',
      },
    });
  };

  return (
    <VerticalGroup spacing="md">
      <Field
        label="Backend URL"
        description="URL of your BeTrace backend API (e.g., http://localhost:12011)"
        required
      >
        <Input
          placeholder="http://localhost:12011"
          value={jsonData.backendUrl || ''}
          onChange={onBackendUrlChange}
          width={40}
        />
      </Field>

      <Field
        label="Timeout (ms)"
        description="Request timeout in milliseconds"
      >
        <Input
          type="number"
          placeholder="30000"
          value={jsonData.timeout || 30000}
          onChange={onTimeoutChange}
          width={20}
        />
      </Field>

      <Field
        label="API Key"
        description="Optional API key for authentication (if your backend requires it)"
      >
        <SecretInput
          isConfigured={secureJsonFields?.apiKey || false}
          value={secureJsonData?.apiKey || ''}
          placeholder="Optional API key"
          onChange={onApiKeyChange}
          onReset={onResetApiKey}
          width={40}
        />
      </Field>
    </VerticalGroup>
  );
};
