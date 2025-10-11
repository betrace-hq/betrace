import type { Meta, StoryObj } from '@storybook/react';
import { GradientStatsCard } from '@/components/ui/gradient-stats-card';
import { StatsCard } from '@/components/ui/stats-card';
import { StyledCard, CardContent, CardHeader, CardTitle } from '@/components/ui/styled-card';
import { Badge } from '@/components/ui/badge';
import {
  Activity, AlertCircle, CheckCircle, Clock, Shield, TrendingUp,
  Users, BarChart3, Eye, AlertTriangle
} from 'lucide-react';

const meta: Meta = {
  title: 'FLUO/Dashboard',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const DashboardStatsCards: Story = {
  name: 'Dashboard Stats Cards',
  render: () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold mb-4">Dashboard Stats Cards</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Clean, professional stats cards designed for long viewing sessions with clear visual hierarchy.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

export const StandardStatsCards: Story = {
  name: 'Standard Stats Cards',
  render: () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold mb-4">Standard Stats Cards</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        These are the standard stats cards without gradients, used in other parts of the application.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value="8,456"
          icon={Users}
          iconColor="blue"
        />

        <StatsCard
          title="Active Sessions"
          value="342"
          icon={Activity}
          iconColor="emerald"
          valueColor="text-emerald-600 dark:text-emerald-400"
        />

        <StatsCard
          title="Error Rate"
          value="0.03%"
          icon={AlertTriangle}
          iconColor="amber"
          valueColor="text-amber-600 dark:text-amber-400"
        />

        <StatsCard
          title="Uptime"
          value="99.98%"
          icon={Shield}
          iconColor="emerald"
          valueColor="text-emerald-600 dark:text-emerald-400"
        />
      </div>
    </div>
  ),
};

export const ActivityFeed: Story = {
  render: () => (
    <StyledCard>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recent Activity</span>
          <Badge variant="secondary">Live</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          {
            type: 'signal',
            icon: AlertCircle,
            iconColor: 'text-red-500',
            title: 'New critical signal detected',
            description: 'Payment service latency exceeded threshold',
            time: '2 minutes ago',
          },
          {
            type: 'rule',
            icon: Shield,
            iconColor: 'text-blue-500',
            title: 'Rule updated',
            description: 'Modified threshold for database query timeout',
            time: '15 minutes ago',
          },
          {
            type: 'resolution',
            icon: CheckCircle,
            iconColor: 'text-green-500',
            title: 'Signal resolved',
            description: 'API rate limit issue has been addressed',
            time: '1 hour ago',
          },
          {
            type: 'investigation',
            icon: Eye,
            iconColor: 'text-amber-500',
            title: 'Investigation started',
            description: 'Team is looking into authentication failures',
            time: '2 hours ago',
          },
        ].map((activity, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className={`mt-1 ${activity.iconColor}`}>
              <activity.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {activity.title}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {activity.description}
              </p>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
              {activity.time}
            </span>
          </div>
        ))}
      </CardContent>
    </StyledCard>
  ),
};

export const ChartContainer: Story = {
  render: () => (
    <StyledCard>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Signal Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              Chart visualization would go here
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Real-time signal trend analysis
            </p>
          </div>
        </div>
      </CardContent>
    </StyledCard>
  ),
};

export const MetricsOverview: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold mb-4">Metrics Overview</h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Metrics */}
        <StyledCard className="border-l-4 border-l-blue-500">
          <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-blue-900 dark:text-blue-100">Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-950/10">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Response Time</span>
              <span className="text-base font-bold text-purple-600 dark:text-purple-400">87ms</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-cyan-50 dark:hover:bg-cyan-950/10">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Throughput</span>
              <span className="text-base font-bold text-cyan-600 dark:text-cyan-400">1.2K/s</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-green-50 dark:hover:bg-green-950/10">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Success Rate</span>
              <span className="text-base font-bold text-green-600 dark:text-green-400">99.8%</span>
            </div>
          </CardContent>
        </StyledCard>

        {/* System Health */}
        <StyledCard className="border-l-4 border-l-green-500">
          <CardHeader className="bg-green-50/50 dark:bg-green-950/20">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-green-900 dark:text-green-100">System Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-2 rounded hover:bg-green-50 dark:hover:bg-green-950/10">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CPU Usage</span>
              <span className="text-base font-bold text-green-600 dark:text-green-400">42%</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-950/10">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Memory</span>
              <span className="text-base font-bold text-blue-600 dark:text-blue-400">3.2GB</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/10">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Disk I/O</span>
              <span className="text-base font-bold text-gray-700 dark:text-gray-300">Normal</span>
            </div>
          </CardContent>
        </StyledCard>

        {/* Alert Summary */}
        <StyledCard className="border-l-4 border-l-amber-500">
          <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-amber-900 dark:text-amber-100">Alert Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-2 rounded hover:bg-red-50 dark:hover:bg-red-950/10">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Critical</span>
              <span className="text-base font-bold text-white bg-red-600 dark:bg-red-700 px-3 py-1 rounded-full">2</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-amber-50 dark:hover:bg-amber-950/10">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Warning</span>
              <span className="text-base font-bold text-white bg-amber-600 dark:bg-amber-700 px-3 py-1 rounded-full">5</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-950/10">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Info</span>
              <span className="text-base font-bold text-white bg-blue-600 dark:bg-blue-700 px-3 py-1 rounded-full">12</span>
            </div>
          </CardContent>
        </StyledCard>
      </div>
    </div>
  ),
};