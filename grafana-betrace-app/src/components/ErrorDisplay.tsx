import React from 'react';
import { Alert, Button, HorizontalGroup, Icon } from '@grafana/ui';
import { ErrorResponse } from '../utils/errorHandling';

interface ErrorDisplayProps {
  error: ErrorResponse;
  onRetry?: () => void;
  showDetails?: boolean;
  context?: string;
}

/**
 * Standardized error display component
 *
 * Shows user-friendly error messages with retry options
 * and appropriate severity levels.
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  showDetails = false,
  context,
}) => {
  const getSeverity = (): 'error' | 'warning' | 'info' => {
    if (!error.retryable) return 'error';
    if (error.type === 'timeout' || error.statusCode === 429) return 'warning';
    return 'info';
  };

  const getTitle = (): string => {
    if (context) return context;

    switch (error.type) {
      case 'network':
        return 'Connection Failed';
      case 'timeout':
        return 'Request Timeout';
      case 'server':
        return 'Backend Error';
      default:
        return 'Error';
    }
  };

  return (
    <Alert title={getTitle()} severity={getSeverity()}>
      <p>{error.message}</p>

      {showDetails && error.statusCode && (
        <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
          Status Code: {error.statusCode}
        </p>
      )}

      {error.retryable && onRetry && (
        <HorizontalGroup spacing="sm" style={{ marginTop: '12px' }}>
          <Button size="sm" onClick={onRetry} icon="sync">
            Retry Now
          </Button>
          <span style={{ fontSize: '12px', opacity: 0.8 }}>
            <Icon name="info-circle" size="sm" /> Auto-retry in progress
          </span>
        </HorizontalGroup>
      )}

      {!error.retryable && (
        <p style={{ fontSize: '12px', marginTop: '12px', opacity: 0.8 }}>
          <Icon name="exclamation-triangle" size="sm" /> This error requires manual intervention.
        </p>
      )}
    </Alert>
  );
};
