import React, { useState, useEffect } from 'react';
import { AppRootProps } from '@grafana/data';
import { TabsBar, Tab, TabContent, Input, Button, VerticalGroup, HorizontalGroup, Field, Alert, useTheme2 } from '@grafana/ui';
import { HomePage } from './HomePage';
import { SignalsPage } from './SignalsPage';
import { RulesPage } from './RulesPage';
import { TraceDrilldownPage } from './TraceDrilldownPage';

type TabView = 'home' | 'signals' | 'rules' | 'traces';

/**
 * TracesTab - Wrapper component for trace lookup and drilldown
 */
const TracesTab: React.FC = () => {
  const theme = useTheme2();
  const [traceId, setTraceId] = useState('');
  const [loadedTraceId, setLoadedTraceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateTraceId = (id: string): boolean => {
    // Basic validation - trace IDs are typically hex strings
    if (!id.trim()) {
      setError('Please enter a trace ID');
      return false;
    }
    // Accept alphanumeric and hyphens (common trace ID formats)
    if (!/^[a-zA-Z0-9-]+$/.test(id.trim())) {
      setError('Invalid trace ID format. Trace IDs should only contain alphanumeric characters and hyphens.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleLoad = () => {
    if (validateTraceId(traceId)) {
      setLoadedTraceId(traceId.trim());
    }
  };

  const handleClear = () => {
    setLoadedTraceId(null);
    setTraceId('');
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoad();
    }
  };

  // Get Tempo URL from Grafana (if configured)
  const getTempoUrl = (id: string): string => {
    // Default Tempo explore URL pattern
    return `/explore?left=${encodeURIComponent(JSON.stringify({
      datasource: 'tempo',
      queries: [{ query: id, queryType: 'traceqlSearch' }],
      range: { from: 'now-1h', to: 'now' }
    }))}`;
  };

  if (loadedTraceId) {
    return (
      <div>
        <HorizontalGroup spacing="md" style={{ marginBottom: '16px', padding: '16px', background: theme.colors.background.secondary }}>
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            Trace: <strong>{loadedTraceId}</strong>
          </span>
          <Button variant="secondary" size="sm" onClick={handleClear}>
            Load Different Trace
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="external-link-alt"
            onClick={() => window.open(getTempoUrl(loadedTraceId), '_blank')}
          >
            View in Tempo
          </Button>
        </HorizontalGroup>
        <TraceDrilldownPage traceId={loadedTraceId} onBack={handleClear} />
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', maxWidth: '600px' }}>
      <VerticalGroup spacing="lg">
        <div>
          <h2>Trace Drilldown</h2>
          <p style={{ color: theme.colors.text.secondary }}>
            Enter a trace ID to view detailed span hierarchy and violation analysis.
          </p>
        </div>

        {error && (
          <Alert severity="error" title="Invalid Input">
            {error}
          </Alert>
        )}

        <Field label="Trace ID" description="Enter the trace ID to load (e.g., from a violation or Tempo)">
          <Input
            name="traceId"
            value={traceId}
            onChange={(e) => setTraceId(e.currentTarget.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., abc123def456..."
            width={50}
          />
        </Field>

        <HorizontalGroup spacing="md">
          <Button variant="primary" onClick={handleLoad} disabled={!traceId.trim()}>
            Load Trace
          </Button>
          {traceId && (
            <Button variant="secondary" onClick={() => setTraceId('')}>
              Clear
            </Button>
          )}
        </HorizontalGroup>

        <div style={{ marginTop: '40px', padding: '16px', background: theme.colors.background.secondary, borderRadius: '4px' }}>
          <h4 style={{ marginTop: 0 }}>Where to find trace IDs</h4>
          <ul style={{ color: theme.colors.text.secondary, fontSize: '14px', margin: 0, paddingLeft: '20px' }}>
            <li>Click on a violation in the Signals tab to see its trace ID</li>
            <li>Copy trace IDs from Tempo or Jaeger</li>
            <li>Find trace IDs in your application logs</li>
          </ul>
        </div>
      </VerticalGroup>
    </div>
  );
};

/**
 * RootPage - Main entry point for BeTrace plugin
 *
 * Uses internal tabs with URL sync to maintain navigation state.
 * URL format: /a/betrace-app?tab=<home|signals|rules|traces>
 *
 * Provides:
 * - Home - BeTrace metrics dashboard
 * - Signals - Invariants violations explorer
 * - Rules - Rule management (with sub-pages via query params)
 * - Traces - Trace drilldown and visualization
 */
export const RootPage: React.FC<AppRootProps> = ({ query }) => {
  // Read initial tab from URL query params
  const getInitialTab = (): TabView => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'signals' || tab === 'rules' || tab === 'traces') {
      return tab;
    }
    return 'home';
  };

  const [activeTab, setActiveTab] = useState<TabView>(getInitialTab());

  // Update URL when tab changes
  const handleTabChange = (tab: TabView) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  };

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div>
      <TabsBar>
        <Tab
          label="Home"
          active={activeTab === 'home'}
          onChangeTab={() => handleTabChange('home')}
        />
        <Tab
          label="Signals"
          active={activeTab === 'signals'}
          onChangeTab={() => handleTabChange('signals')}
        />
        <Tab
          label="Rules"
          active={activeTab === 'rules'}
          onChangeTab={() => handleTabChange('rules')}
        />
        <Tab
          label="Traces"
          active={activeTab === 'traces'}
          onChangeTab={() => handleTabChange('traces')}
        />
      </TabsBar>

      <TabContent>
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'signals' && <SignalsPage />}
        {activeTab === 'rules' && <RulesPage />}
        {activeTab === 'traces' && <TracesTab />}
      </TabContent>
    </div>
  );
};
