import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/ui/badge';
import { StyledCard, CardContent, CardHeader, CardTitle } from '@/components/ui/styled-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tables } from '@/lib/design-system';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/ui/stats-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/severity-badge';
import {
  AlertCircle, CheckCircle, Clock, Eye, AlertTriangle, Shield, Activity, RefreshCw, Search, MoreHorizontal
} from 'lucide-react';

const meta: Meta = {
  title: 'FLUO/Signals',
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock signal data
const mockSignals = [
  {
    id: '1',
    status: 'open',
    severity: 'CRITICAL',
    service: 'Auth Service',
    title: 'Unusual login pattern detected',
    description: 'Multiple failed login attempts from different geographic locations',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    status: 'investigating',
    severity: 'HIGH',
    service: 'API Gateway',
    title: 'Elevated API error rate',
    description: 'Error rate increased by 300% in the last 10 minutes',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '3',
    status: 'resolved',
    severity: 'MEDIUM',
    service: 'Database',
    title: 'Slow query performance',
    description: 'Query execution time exceeded threshold',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '4',
    status: 'false-positive',
    severity: 'LOW',
    service: 'Storage Service',
    title: 'Unusual file access pattern',
    description: 'Large number of file reads detected',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

// Helper functions replaced by standardized badge components

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
};

export const SignalStatusBadges: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Signal Status Badges</h3>
      <div className="flex gap-4 flex-wrap">
        {['open', 'investigating', 'resolved', 'false-positive'].map(status => (
          <div key={status} className="space-y-2">
            <StatusBadge status={status} />
            <p className="text-xs text-gray-500 capitalize">{status.replace('-', ' ')}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const SignalSeverityBadges: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Signal Severity Badges</h3>
      <div className="flex gap-4 flex-wrap">
        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(severity => (
          <div key={severity} className="space-y-2">
            <SeverityBadge severity={severity} />
            <p className="text-xs text-gray-500">{severity}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const SignalStatsCards: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Signal Statistics Cards</h3>
      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="Total Signals"
          value="1,234"
          icon={Activity}
          iconColor="blue"
        />

        <StatsCard
          title="Open"
          value="42"
          icon={AlertCircle}
          iconColor="red"
          valueColor="text-red-600 dark:text-red-400"
        />

        <StatsCard
          title="Investigating"
          value="18"
          icon={Clock}
          iconColor="amber"
          valueColor="text-amber-600 dark:text-amber-400"
        />

        <StatsCard
          title="Resolved"
          value="1,174"
          icon={CheckCircle}
          iconColor="emerald"
          valueColor="text-emerald-600 dark:text-emerald-400"
        />
      </div>
    </div>
  ),
};

export const SignalTable: Story = {
  render: () => (
    <StyledCard>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Active Signals</span>
          <Badge variant="secondary">4 signals</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className={tables.headerBorder}>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockSignals.map((signal) => (
                <TableRow key={signal.id} className={`${tables.rowBorder} ${tables.rowHover}`}>
                  <TableCell><StatusBadge status={signal.status} /></TableCell>
                  <TableCell><SeverityBadge severity={signal.severity} /></TableCell>
                  <TableCell>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {signal.service}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {signal.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                      {signal.description}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTimestamp(signal.timestamp)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                      {signal.status === 'open' ? (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Search className="w-4 h-4" />
                        </Button>
                      ) : (
                        <div className="w-8" />
                      )}
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </StyledCard>
  ),
};

export const SignalEmptyState: Story = {
  render: () => (
    <StyledCard>
      <CardContent className="py-12">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No signals found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            No active signals detected. Your systems are secure.
          </p>
        </div>
      </CardContent>
    </StyledCard>
  ),
};

export const SignalLoadingState: Story = {
  render: () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading signals...</p>
      </div>
    </div>
  ),
};

export const SignalErrorState: Story = {
  render: () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Signals</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Failed to load signals. Please try again.</p>
        <Button>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    </div>
  ),
};