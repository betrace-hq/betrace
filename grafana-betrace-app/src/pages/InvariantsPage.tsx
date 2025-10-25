import React, { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Card,
  Field,
  FilterInput,
  HorizontalGroup,
  Icon,
  Select,
  Tab,
  TabsBar,
  Tooltip,
  VerticalGroup,
  useTheme2,
  Alert,
} from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { TraceDrilldownPage } from './TraceDrilldownPage';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { parseError, retryWithBackoff, ErrorResponse } from '../utils/errorHandling';

interface InvariantViolation {
  id: string;
  traceId: string;
  spanId: string;
  ruleId: string;
  ruleName: string;
  ruleExpression: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: number;
  serviceName: string;
  spanName: string;
  attributes: Record<string, any>;
}

interface ViolationStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  last24h: number;
  lastHour: number;
  affectedServices: number;
  affectedTraces: number;
}

interface InvariantsPageProps {
  backendUrl?: string;
  timeRange?: { from: number; to: number };
}

type TabView = 'violations' | 'timeline' | 'rules';

/**
 * InvariantsPage - Observability signal for behavioral violations
 *
 * Sits alongside Metrics, Logs, Traces, Profiles as "Invariants"
 * Shows:
 * - Real-time violation feed
 * - Violation statistics and trends
 * - Rule effectiveness metrics
 * - Drill-down to traces with violations
 */
export const InvariantsPage: React.FC<InvariantsPageProps> = ({
  backendUrl = 'http://localhost:12011',
  timeRange = { from: Date.now() - 24 * 60 * 60 * 1000, to: Date.now() },
}) => {
  const theme = useTheme2();
  const [violations, setViolations] = useState<InvariantViolation[]>([]);
  const [cachedViolations, setCachedViolations] = useState<InvariantViolation[]>([]);
  const [stats, setStats] = useState<ViolationStats | null>(null);
  const [cachedStats, setCachedStats] = useState<ViolationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedTab, setSelectedTab] = useState<TabView>('violations');
  const [filterText, setFilterText] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SelectableValue<string>>({ label: 'All Severities', value: 'all' });
  const [serviceFilter, setServiceFilter] = useState<SelectableValue<string>>({ label: 'All Services', value: 'all' });
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);

  useEffect(() => {
    fetchViolations();
    fetchStats();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchViolations();
      fetchStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchViolations = async () => {
    setLoading(true);

    try {
      const data = await retryWithBackoff(
        async () => {
          const params = new URLSearchParams({
            from: timeRange.from.toString(),
            to: timeRange.to.toString(),
          });

          const response = await fetch(`${backendUrl}/api/violations?${params}`);
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

      // Success - update violations and cache
      const violationArray = Array.isArray(data) ? data : [];
      setViolations(violationArray);
      setCachedViolations(violationArray);
      setError(null);
      setUsingCachedData(false);
      setRetryCount(0);
    } catch (err) {
      const parsedError = parseError(err);
      setError(parsedError);
      setRetryCount(prev => prev + 1);

      // Use cached data if available and error is retryable
      if (cachedViolations.length > 0 && parsedError.retryable) {
        setViolations(cachedViolations);
        setUsingCachedData(true);
      } else {
        setViolations([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await retryWithBackoff(
        async () => {
          const response = await fetch(`${backendUrl}/api/violations/stats`);
          if (!response.ok) {
            throw { status: response.status, message: response.statusText };
          }
          return response.json();
        },
        {
          maxRetries: 1,
          initialDelay: 500,
        }
      );

      setStats(data);
      setCachedStats(data);
    } catch (err) {
      // Use cached stats if available
      if (cachedStats) {
        setStats(cachedStats);
      }
      console.error('Failed to fetch stats:', err);
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return theme.colors.error.main;
      case 'high':
        return theme.colors.warning.main;
      case 'medium':
        return theme.colors.info.main;
      case 'low':
        return theme.colors.success.main;
      default:
        return theme.colors.text.secondary;
    }
  };

  const formatTimestamp = (epochMs: number): string => {
    const now = Date.now();
    const diff = now - epochMs;

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(epochMs).toLocaleString();
  };

  const filteredViolations = violations.filter((v) => {
    if (severityFilter.value !== 'all' && v.severity !== severityFilter.value) return false;
    if (serviceFilter.value !== 'all' && v.serviceName !== serviceFilter.value) return false;
    if (filterText) {
      const search = filterText.toLowerCase();
      return (
        v.message.toLowerCase().includes(search) ||
        v.ruleName.toLowerCase().includes(search) ||
        v.serviceName.toLowerCase().includes(search) ||
        v.spanName.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const services = Array.from(new Set(violations.map((v) => v.serviceName)));
  const serviceOptions = [
    { label: 'All Services', value: 'all' },
    ...services.map((s) => ({ label: s, value: s })),
  ];

  const severityOptions = [
    { label: 'All Severities', value: 'all' },
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ];

  if (selectedTrace) {
    return (
      <TraceDrilldownPage
        traceId={selectedTrace}
        backendUrl={backendUrl}
        onBack={() => setSelectedTrace(null)}
      />
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <VerticalGroup spacing="lg">
        {/* Header */}
        <HorizontalGroup spacing="md" justify="space-between">
          <VerticalGroup spacing="xs">
            <h1>Invariants</h1>
            <p style={{ fontSize: '14px', color: theme.colors.text.secondary, margin: 0 }}>
              Behavioral assertions and pattern violations from BeTrace rules
            </p>
          </VerticalGroup>
          <HorizontalGroup spacing="sm">
            {usingCachedData && (
              <Badge
                text="Cached Data"
                color="orange"
                icon="exclamation-triangle"
              />
            )}
            <Tooltip content="Refresh violations">
              <Icon name="sync" style={{ cursor: 'pointer' }} onClick={() => fetchViolations()} />
            </Tooltip>
            <Badge text={`${filteredViolations.length} violations`} color={filteredViolations.length > 0 ? 'red' : 'green'} />
          </HorizontalGroup>
        </HorizontalGroup>

        {/* Error Display */}
        {error && !usingCachedData && (
          <ErrorDisplay
            error={error}
            onRetry={() => {
              fetchViolations();
              fetchStats();
            }}
            context="Violation Data"
          />
        )}

        {/* Cached Data Warning */}
        {usingCachedData && (
          <Alert title="Using Cached Data" severity="warning">
            Backend temporarily unavailable. Showing last known violations. Auto-retry #{retryCount}
          </Alert>
        )}

        {/* Stats Cards */}
        {stats && (
          <HorizontalGroup spacing="md">
            <Card style={{ flex: 1 }}>
              <Card.Heading>Total Violations</Card.Heading>
              <div style={{ fontSize: '32px', fontWeight: 700, color: theme.colors.error.main }}>
                {stats.total.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: theme.colors.text.secondary }}>
                {stats.last24h} in last 24h
              </div>
            </Card>

            <Card style={{ flex: 1 }}>
              <Card.Heading>Critical</Card.Heading>
              <div style={{ fontSize: '32px', fontWeight: 700, color: theme.colors.error.main }}>
                {stats.critical}
              </div>
              <div style={{ fontSize: '12px', color: theme.colors.text.secondary }}>
                Require immediate attention
              </div>
            </Card>

            <Card style={{ flex: 1 }}>
              <Card.Heading>Affected Services</Card.Heading>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>
                {stats.affectedServices}
              </div>
              <div style={{ fontSize: '12px', color: theme.colors.text.secondary }}>
                {stats.affectedTraces} unique traces
              </div>
            </Card>

            <Card style={{ flex: 1 }}>
              <Card.Heading>Last Hour</Card.Heading>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>
                {stats.lastHour}
              </div>
              <div style={{ fontSize: '12px', color: theme.colors.text.secondary }}>
                Recent violations
              </div>
            </Card>
          </HorizontalGroup>
        )}

        {/* Tabs */}
        <TabsBar>
          <Tab
            label="Violations"
            active={selectedTab === 'violations'}
            onChangeTab={() => setSelectedTab('violations')}
          />
          <Tab
            label="Timeline"
            active={selectedTab === 'timeline'}
            onChangeTab={() => setSelectedTab('timeline')}
          />
          <Tab
            label="Rules"
            active={selectedTab === 'rules'}
            onChangeTab={() => setSelectedTab('rules')}
          />
        </TabsBar>

        {/* Violations Tab */}
        {selectedTab === 'violations' && (
          <VerticalGroup spacing="md">
            {/* Filters */}
            <HorizontalGroup spacing="sm">
              <Field label="Search">
                <FilterInput
                  placeholder="Filter by message, rule, service, or span..."
                  value={filterText}
                  onChange={(value) => setFilterText(value)}
                />
              </Field>
              <Field label="Severity">
                <Select
                  options={severityOptions}
                  value={severityFilter}
                  onChange={(value) => setSeverityFilter(value)}
                  width={20}
                />
              </Field>
              <Field label="Service">
                <Select
                  options={serviceOptions}
                  value={serviceFilter}
                  onChange={(value) => setServiceFilter(value)}
                  width={25}
                />
              </Field>
            </HorizontalGroup>

            {/* Violation List */}
            {loading && !usingCachedData && (
              <Alert title="Loading violations..." severity="info">
                Fetching latest invariant violations...
              </Alert>
            )}

            {!loading && filteredViolations.length === 0 && (
              <Alert title="No violations found" severity="success">
                {filterText || severityFilter.value !== 'all' || serviceFilter.value !== 'all'
                  ? 'No violations match your filters. Try adjusting the filters.'
                  : 'All invariants are satisfied! No behavioral violations detected.'}
              </Alert>
            )}

            {!loading && filteredViolations.length > 0 && (
              <VerticalGroup spacing="xs">
                {filteredViolations.map((violation) => (
                  <Card
                    key={violation.id}
                    style={{
                      borderLeft: `4px solid ${getSeverityColor(violation.severity)}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedTrace(violation.traceId)}
                  >
                    <HorizontalGroup spacing="md" justify="space-between">
                      <VerticalGroup spacing="xs" style={{ flex: 1 }}>
                        <HorizontalGroup spacing="xs">
                          <Badge
                            text={violation.severity.toUpperCase()}
                            color={violation.severity === 'critical' ? 'red' : violation.severity === 'high' ? 'orange' : 'blue'}
                          />
                          <span style={{ fontWeight: 600 }}>{violation.ruleName}</span>
                          <Icon name="arrow-right" />
                          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{violation.spanName}</span>
                        </HorizontalGroup>

                        <div style={{ fontSize: '13px', color: theme.colors.text.primary }}>
                          {violation.message}
                        </div>

                        <HorizontalGroup spacing="sm">
                          <Badge text={violation.serviceName} color="blue" icon="apps" />
                          <span style={{ fontSize: '11px', color: theme.colors.text.secondary, fontFamily: 'monospace' }}>
                            Trace: {violation.traceId.substring(0, 16)}...
                          </span>
                          <span style={{ fontSize: '11px', color: theme.colors.text.secondary }}>
                            {formatTimestamp(violation.timestamp)}
                          </span>
                        </HorizontalGroup>
                      </VerticalGroup>

                      <Button icon="eye" variant="secondary" size="sm">
                        View Trace
                      </Button>
                    </HorizontalGroup>
                  </Card>
                ))}
              </VerticalGroup>
            )}
          </VerticalGroup>
        )}

        {/* Timeline Tab (placeholder) */}
        {selectedTab === 'timeline' && (
          <Alert title="Timeline View" severity="info">
            Violation timeline visualization coming soon. Will show:
            <ul>
              <li>Violation rate over time</li>
              <li>Severity distribution trends</li>
              <li>Service heatmap</li>
              <li>Rule effectiveness metrics</li>
            </ul>
          </Alert>
        )}

        {/* Rules Tab (placeholder) */}
        {selectedTab === 'rules' && (
          <Alert title="Rules View" severity="info">
            Rule management view coming soon. Will show:
            <ul>
              <li>Active rules and their violation counts</li>
              <li>Rule effectiveness (violations per rule)</li>
              <li>Recently triggered rules</li>
              <li>Quick rule enable/disable toggles</li>
            </ul>
          </Alert>
        )}
      </VerticalGroup>
    </div>
  );
};
