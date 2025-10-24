import React, { useState, useEffect } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  VerticalGroup,
  HorizontalGroup,
  Icon,
  Tooltip,
  useTheme2,
} from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: string;
  startTime: number;
  endTime: number;
  duration: number;
  attributes: Record<string, any>;
  status: {
    code: string;
    message?: string;
  };
  resource: Record<string, any>;
}

interface Violation {
  ruleId: string;
  ruleName: string;
  spanId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: number;
}

interface Trace {
  traceId: string;
  spans: Span[];
  violations: Violation[];
  serviceName: string;
  startTime: number;
  endTime: number;
  duration: number;
}

interface TraceDrilldownPageProps {
  traceId: string;
  backendUrl?: string;
  onBack?: () => void;
}

/**
 * TraceDrilldownPage - Detailed trace visualization with violations
 *
 * Shows:
 * - Trace metadata (ID, duration, service, timeline)
 * - Span hierarchy with parent/child relationships
 * - Violation highlights and rule matching
 * - Span attributes and metadata
 */
export const TraceDrilldownPage: React.FC<TraceDrilldownPageProps> = ({
  traceId,
  backendUrl = 'http://localhost:12011',
  onBack,
}) => {
  const theme = useTheme2();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());
  const [selectedSpan, setSelectedSpan] = useState<string | null>(null);

  useEffect(() => {
    fetchTrace();
  }, [traceId]);

  const fetchTrace = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/traces/${traceId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch trace: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate data structure
      if (data && data.spans && Array.isArray(data.spans)) {
        setTrace(data);

        // Expand root spans by default
        const rootSpans = data.spans.filter((s: Span) => !s.parentSpanId);
        setExpandedSpans(new Set(rootSpans.map((s: Span) => s.spanId)));
      } else {
        throw new Error('Invalid trace data structure');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTrace(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleSpanExpansion = (spanId: string) => {
    const newExpanded = new Set(expandedSpans);
    if (newExpanded.has(spanId)) {
      newExpanded.delete(spanId);
    } else {
      newExpanded.add(spanId);
    }
    setExpandedSpans(newExpanded);
  };

  const getSpanViolations = (spanId: string): Violation[] => {
    return trace?.violations.filter((v) => v.spanId === spanId) || [];
  };

  const getChildSpans = (parentId?: string): Span[] => {
    return trace?.spans.filter((s) => s.parentSpanId === parentId) || [];
  };

  const formatDuration = (ns: number): string => {
    if (ns < 1000) return `${ns}ns`;
    if (ns < 1000000) return `${(ns / 1000).toFixed(2)}μs`;
    if (ns < 1000000000) return `${(ns / 1000000).toFixed(2)}ms`;
    return `${(ns / 1000000000).toFixed(2)}s`;
  };

  const formatTimestamp = (epochNs: number): string => {
    const date = new Date(epochNs / 1000000);
    return date.toISOString();
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

  const renderSpan = (span: Span, depth: number = 0) => {
    const isExpanded = expandedSpans.has(span.spanId);
    const isSelected = selectedSpan === span.spanId;
    const violations = getSpanViolations(span.spanId);
    const hasViolations = violations.length > 0;
    const children = getChildSpans(span.spanId);
    const hasChildren = children.length > 0;

    const backgroundColor = isSelected
      ? theme.colors.action.selected
      : hasViolations
      ? `${theme.colors.error.main}22`
      : 'transparent';

    return (
      <div key={span.spanId} style={{ marginLeft: `${depth * 20}px` }}>
        <Card
          onClick={() => setSelectedSpan(span.spanId)}
          style={{
            marginBottom: '8px',
            cursor: 'pointer',
            backgroundColor,
            border: isSelected ? `2px solid ${theme.colors.primary.main}` : undefined,
          }}
        >
          <Card.Heading>
            <HorizontalGroup spacing="sm" justify="space-between">
              <HorizontalGroup spacing="xs">
                {hasChildren && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={isExpanded ? 'angle-down' : 'angle-right'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSpanExpansion(span.spanId);
                    }}
                  />
                )}
                <Icon name="circle" style={{ color: span.status.code === 'OK' ? theme.colors.success.main : theme.colors.error.main }} />
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{span.name}</span>
                <Badge text={span.kind} color="blue" />
              </HorizontalGroup>
              <HorizontalGroup spacing="xs">
                {hasViolations && (
                  <Badge
                    text={`${violations.length} violation${violations.length > 1 ? 's' : ''}`}
                    color="red"
                    icon="exclamation-triangle"
                  />
                )}
                <span style={{ color: theme.colors.text.secondary, fontSize: '12px' }}>
                  {formatDuration(span.duration)}
                </span>
              </HorizontalGroup>
            </HorizontalGroup>
          </Card.Heading>

          {isSelected && (
            <Card.Meta>
              <VerticalGroup spacing="xs">
                <div style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                  <strong>Span ID:</strong> {span.spanId}
                  <br />
                  <strong>Start:</strong> {formatTimestamp(span.startTime)}
                  <br />
                  <strong>End:</strong> {formatTimestamp(span.endTime)}
                  <br />
                  {span.parentSpanId && (
                    <>
                      <strong>Parent:</strong> {span.parentSpanId}
                      <br />
                    </>
                  )}
                </div>

                {/* Span Attributes */}
                {Object.keys(span.attributes).length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <strong>Attributes:</strong>
                    <div
                      style={{
                        backgroundColor: theme.colors.background.secondary,
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflow: 'auto',
                      }}
                    >
                      {Object.entries(span.attributes).map(([key, value]) => (
                        <div key={key}>
                          <span style={{ color: theme.colors.primary.main }}>{key}</span>:{' '}
                          <span style={{ color: theme.colors.text.primary }}>
                            {typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Violations */}
                {hasViolations && (
                  <div style={{ marginTop: '8px' }}>
                    <strong>Violations:</strong>
                    {violations.map((v, idx) => (
                      <Alert
                        key={idx}
                        title={v.ruleName}
                        severity="error"
                        style={{ marginTop: '4px', fontSize: '12px' }}
                      >
                        <div>
                          <Badge text={v.severity.toUpperCase()} color="red" />
                          <span style={{ marginLeft: '8px' }}>{v.message}</span>
                        </div>
                      </Alert>
                    ))}
                  </div>
                )}
              </VerticalGroup>
            </Card.Meta>
          )}
        </Card>

        {/* Render children if expanded */}
        {isExpanded && hasChildren && (
          <div style={{ marginLeft: '20px' }}>
            {children.map((child) => renderSpan(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert title="Loading trace..." severity="info">
          Fetching trace {traceId}...
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert title="Failed to load trace" severity="error">
          {error}
        </Alert>
        {onBack && (
          <Button onClick={onBack} style={{ marginTop: '16px' }}>
            Back to List
          </Button>
        )}
      </div>
    );
  }

  if (!trace) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert title="Trace not found" severity="warning">
          No trace found with ID {traceId}
        </Alert>
        {onBack && (
          <Button onClick={onBack} style={{ marginTop: '16px' }}>
            Back to List
          </Button>
        )}
      </div>
    );
  }

  const rootSpans = getChildSpans(undefined);
  const totalViolations = trace.violations.length;
  const criticalViolations = trace.violations.filter((v) => v.severity === 'critical').length;

  return (
    <div style={{ padding: '20px' }}>
      <VerticalGroup spacing="lg">
        {/* Header */}
        <HorizontalGroup spacing="md" justify="space-between">
          <VerticalGroup spacing="xs">
            <h2>Trace Details</h2>
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, fontFamily: 'monospace' }}>
              {trace.traceId}
            </div>
          </VerticalGroup>
          {onBack && (
            <Button onClick={onBack} icon="arrow-left">
              Back to List
            </Button>
          )}
        </HorizontalGroup>

        {/* Trace Summary */}
        <Card>
          <Card.Heading>Trace Summary</Card.Heading>
          <Card.Meta>
            <HorizontalGroup spacing="lg">
              <VerticalGroup spacing="xs">
                <span style={{ fontSize: '11px', color: theme.colors.text.secondary }}>Service</span>
                <span style={{ fontWeight: 600 }}>{trace.serviceName}</span>
              </VerticalGroup>
              <VerticalGroup spacing="xs">
                <span style={{ fontSize: '11px', color: theme.colors.text.secondary }}>Duration</span>
                <span style={{ fontWeight: 600 }}>{formatDuration(trace.duration)}</span>
              </VerticalGroup>
              <VerticalGroup spacing="xs">
                <span style={{ fontSize: '11px', color: theme.colors.text.secondary }}>Spans</span>
                <span style={{ fontWeight: 600 }}>{trace.spans.length}</span>
              </VerticalGroup>
              <VerticalGroup spacing="xs">
                <span style={{ fontSize: '11px', color: theme.colors.text.secondary }}>Violations</span>
                <HorizontalGroup spacing="xs">
                  <Badge text={`${totalViolations} total`} color={totalViolations > 0 ? 'red' : 'green'} />
                  {criticalViolations > 0 && (
                    <Badge text={`${criticalViolations} critical`} color="red" icon="exclamation-triangle" />
                  )}
                </HorizontalGroup>
              </VerticalGroup>
              <VerticalGroup spacing="xs">
                <span style={{ fontSize: '11px', color: theme.colors.text.secondary }}>Start Time</span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                  {formatTimestamp(trace.startTime)}
                </span>
              </VerticalGroup>
            </HorizontalGroup>
          </Card.Meta>
        </Card>

        {/* Violations Summary */}
        {totalViolations > 0 && (
          <Alert title={`${totalViolations} Violation${totalViolations > 1 ? 's' : ''} Detected`} severity="error">
            <div>
              {criticalViolations > 0 && <div>🔴 {criticalViolations} critical violations require immediate attention</div>}
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                Click on spans below to see violation details
              </div>
            </div>
          </Alert>
        )}

        {/* Span Tree */}
        <Card>
          <Card.Heading>Span Hierarchy</Card.Heading>
          <Card.Meta>
            <VerticalGroup spacing="xs">
              {rootSpans.map((span) => renderSpan(span, 0))}
            </VerticalGroup>
          </Card.Meta>
        </Card>
      </VerticalGroup>
    </div>
  );
};
