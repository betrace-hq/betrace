import React, { useState, useEffect } from 'react';
import { AppRootProps } from '@grafana/data';
import { VerticalGroup, Card, HorizontalGroup, useTheme2, Icon, Tooltip, Badge } from '@grafana/ui';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { parseError, retryWithBackoff, ErrorResponse } from '../utils/errorHandling';

interface HomePageMetrics {
  activeRules: number;
  violations24h: number;
  tracesEvaluated: number;
  avgLatency: number;
}

interface HomePageProps extends Partial<AppRootProps> {
  backendUrl?: string;
  mockData?: HomePageMetrics;
}

/**
 * HomePage - BeTrace metrics dashboard
 *
 * Shows BeTrace-specific operational metrics with graceful degradation:
 * - Active rules count
 * - Violation detection rates (24h)
 * - Trace processing throughput
 * - Average evaluation latency
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Stale data display during outages
 * - Partial data support
 */
export const HomePage: React.FC<HomePageProps> = ({
  backendUrl = 'http://localhost:12011',
  mockData,
}) => {
  const theme = useTheme2();
  const [metrics, setMetrics] = useState<HomePageMetrics>(mockData || {
    activeRules: 0,
    violations24h: 0,
    tracesEvaluated: 0,
    avgLatency: 0,
  });
  const [cachedMetrics, setCachedMetrics] = useState<HomePageMetrics | null>(null);
  const [loading, setLoading] = useState(!mockData);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (mockData) {
      setMetrics(mockData);
      setLoading(false);
      return;
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [mockData]);

  const fetchMetrics = async () => {
    try {
      const data = await retryWithBackoff(
        async () => {
          const response = await fetch(`${backendUrl}/api/metrics/dashboard`);
          if (!response.ok) {
            throw { status: response.status, message: response.statusText };
          }
          return response.json();
        },
        {
          maxRetries: 2,
          initialDelay: 500,
          maxDelay: 5000,
        }
      );

      // Success - update metrics and cache
      setMetrics(data);
      setCachedMetrics(data);
      setError(null);
      setUsingCachedData(false);
      setRetryCount(0);
    } catch (err) {
      const parsedError = parseError(err);
      setError(parsedError);
      setRetryCount(prev => prev + 1);

      // Use cached data if available and error is retryable
      if (cachedMetrics && parsedError.retryable) {
        setMetrics(cachedMetrics);
        setUsingCachedData(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div style={{ padding: '40px' }}>
      <VerticalGroup spacing="lg">
        {/* Header */}
        <HorizontalGroup justify="space-between">
          <div>
            <h1>BeTrace - Behavioral Assurance</h1>
            <p style={{ color: theme.colors.text.secondary, fontSize: '14px', margin: 0 }}>
              Pattern matching and invariant monitoring for OpenTelemetry traces
            </p>
          </div>
          {!mockData && (
            <Tooltip content="Refresh metrics">
              <Icon
                name="sync"
                style={{ cursor: 'pointer', fontSize: '20px' }}
                onClick={() => fetchMetrics()}
              />
            </Tooltip>
          )}
        </HorizontalGroup>

        {/* Error Display with Graceful Degradation */}
        {error && !usingCachedData && (
          <ErrorDisplay
            error={error}
            onRetry={fetchMetrics}
            context="Dashboard Metrics"
          />
        )}

        {/* Cached Data Warning */}
        {usingCachedData && (
          <HorizontalGroup spacing="sm" style={{ marginBottom: '16px' }}>
            <Badge
              text="Using Cached Data"
              color="orange"
              icon="exclamation-triangle"
            />
            <span style={{ fontSize: '12px', color: theme.colors.text.secondary }}>
              Backend unavailable. Showing last known data. Auto-retry #{retryCount}
            </span>
          </HorizontalGroup>
        )}

        {/* Metrics Cards */}
        <HorizontalGroup spacing="lg">
          <Card style={{ flex: 1, padding: '24px' }}>
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginBottom: '12px', textTransform: 'uppercase', fontWeight: 600 }}>
              Active Rules
            </div>
            <div style={{ fontSize: '42px', fontWeight: 'bold', color: theme.colors.primary.main }}>
              {metrics.activeRules}
            </div>
            <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '8px' }}>
              Monitoring behavioral patterns
            </div>
          </Card>

          <Card style={{ flex: 1, padding: '24px' }}>
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginBottom: '12px', textTransform: 'uppercase', fontWeight: 600 }}>
              Violations (24h)
            </div>
            <div style={{
              fontSize: '42px',
              fontWeight: 'bold',
              color: metrics.violations24h > 100 ? theme.colors.error.main : theme.colors.success.main
            }}>
              {formatLargeNumber(metrics.violations24h)}
            </div>
            <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '8px' }}>
              Pattern violations detected
            </div>
          </Card>

          <Card style={{ flex: 1, padding: '24px' }}>
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginBottom: '12px', textTransform: 'uppercase', fontWeight: 600 }}>
              Traces Evaluated
            </div>
            <div style={{ fontSize: '42px', fontWeight: 'bold', color: theme.colors.info.main }}>
              {formatLargeNumber(metrics.tracesEvaluated)}
            </div>
            <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '8px' }}>
              Total traces processed
            </div>
          </Card>

          <Card style={{ flex: 1, padding: '24px' }}>
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginBottom: '12px', textTransform: 'uppercase', fontWeight: 600 }}>
              Avg Latency
            </div>
            <div style={{
              fontSize: '42px',
              fontWeight: 'bold',
              color: metrics.avgLatency > 10 ? theme.colors.warning.main : theme.colors.success.main
            }}>
              {metrics.avgLatency.toFixed(1)}<span style={{ fontSize: '18px' }}>ms</span>
            </div>
            <div style={{ fontSize: '11px', color: theme.colors.text.secondary, marginTop: '8px' }}>
              Rule evaluation time
            </div>
          </Card>
        </HorizontalGroup>

        {/* Getting Started */}
        <Card style={{ padding: '24px', background: theme.colors.background.secondary }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Quick Navigation</h3>
          <VerticalGroup spacing="sm">
            <div style={{ fontSize: '14px' }}>
              <Icon name="apps" style={{ marginRight: '8px', color: theme.colors.primary.main }} />
              <strong>Signals</strong> - Explore and analyze invariant violations across services
            </div>
            <div style={{ fontSize: '14px' }}>
              <Icon name="document-info" style={{ marginRight: '8px', color: theme.colors.primary.main }} />
              <strong>Rules</strong> - Create and manage BeTraceDSL pattern matching rules
            </div>
          </VerticalGroup>
        </Card>

        {/* System Info */}
        <div style={{
          fontSize: '11px',
          color: theme.colors.text.secondary,
          borderTop: `1px solid ${theme.colors.border.weak}`,
          paddingTop: '16px',
          marginTop: '16px'
        }}>
          <strong>ADR-027:</strong> BeTrace as Grafana App Plugin
          {' • '}
          <strong>Backend:</strong> {backendUrl}
        </div>
      </VerticalGroup>
    </div>
  );
};
