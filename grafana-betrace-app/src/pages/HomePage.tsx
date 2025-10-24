import React, { useState, useEffect } from 'react';
import { AppRootProps } from '@grafana/data';
import { Alert, VerticalGroup, Card, HorizontalGroup, useTheme2, Icon, Tooltip } from '@grafana/ui';

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
 * Shows BeTrace-specific operational metrics:
 * - Active rules count
 * - Violation detection rates (24h)
 * - Trace processing throughput
 * - Average evaluation latency
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
  const [loading, setLoading] = useState(!mockData);
  const [error, setError] = useState<string | null>(null);

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
      const response = await fetch(`${backendUrl}/api/metrics/dashboard`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        setError(null);
      } else {
        setError(`Backend returned ${response.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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

        {/* Error Alert */}
        {error && (
          <Alert title="Unable to fetch metrics" severity="warning">
            <p>Could not connect to BeTrace backend: {error}</p>
            <p style={{ marginTop: '8px', fontSize: '12px' }}>
              Showing placeholder data. Check that backend is running at: <code>{backendUrl}</code>
            </p>
          </Alert>
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
