import React from 'react';
import { AppRootProps } from '@grafana/data';
import { InvariantsPage } from './InvariantsPage';

interface SignalsPageProps extends Partial<AppRootProps> {
  backendUrl?: string;
}

/**
 * SignalsPage - Invariant violations explorer
 *
 * Wrapper around InvariantsPage to maintain naming consistency
 * in navigation while reusing the full-featured violations UI.
 *
 * Features:
 * - Real-time violation feed with filtering
 * - Statistics and trends
 * - Drill-down to traces with violations
 * - Timeline and rule effectiveness views
 */
export const SignalsPage: React.FC<SignalsPageProps> = ({ backendUrl }) => {
  return <InvariantsPage backendUrl={backendUrl} />;
};
