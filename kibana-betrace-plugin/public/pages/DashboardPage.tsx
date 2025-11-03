import React, { useEffect, useState } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiStat,
  EuiTitle,
  EuiSpacer,
  EuiCallOut,
  EuiText,
} from '@elastic/eui';

interface Stats {
  totalRules: number;
  activeRules: number;
  violations24h: number;
}

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<Stats>({ totalRules: 0, activeRules: 0, violations24h: 0 });
  const backendUrl = localStorage.getItem('betrace_backend_url') || 'http://localhost:12011';

  useEffect(() => {
    fetch(`${backendUrl}/api/stats`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Failed to fetch stats:', err));
  }, [backendUrl]);

  return (
    <>
      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={stats.totalRules.toString()}
              description="Total Rules"
              titleColor="primary"
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={stats.activeRules.toString()}
              description="Active Rules"
              titleColor="success"
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={stats.violations24h.toString()}
              description="Violations (24h)"
              titleColor="danger"
            />
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiTitle size="m">
          <h2>Quick Start</h2>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiText>
          <ol>
            <li>Configure backend connection in Settings</li>
            <li>Create your first rule using BeTraceDSL</li>
            <li>Monitor violations in Kibana Discover</li>
          </ol>
        </EuiText>
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiCallOut
        title="Integration with Elastic Stack"
        color="primary"
        iconType="iInCircle"
      >
        <p>
          Violations are automatically indexed in Elasticsearch. Use Kibana Discover to query violations,
          create visualizations with Lens, and set up alerts with Kibana Alerting.
        </p>
      </EuiCallOut>
    </>
  );
};
