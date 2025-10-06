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
  name: 'Dashboard Stats Cards (Gradient)',
  render: () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold mb-4">Dashboard Stats Cards with Gradients</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        These gradient stats cards are used on the dashboard for a more visually appealing display.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GradientStatsCard
          title="Total Signals"
          value="1,234"
          icon={Activity}
          gradientFrom="from-blue-500"
          gradientTo="to-purple-500"
          iconBg="bg-blue-100 dark:bg-blue-950"
          iconColor="text-blue-600 dark:text-blue-400"
        />

        <GradientStatsCard
          title="Open"
          value="42"
          icon={AlertCircle}
          gradientFrom="from-red-500"
          gradientTo="to-orange-500"
          iconBg="bg-red-100 dark:bg-red-950"
          iconColor="text-red-600 dark:text-red-400"
        />

        <GradientStatsCard
          title="Investigating"
          value="18"
          icon={Clock}
          gradientFrom="from-amber-500"
          gradientTo="to-yellow-500"
          iconBg="bg-amber-100 dark:bg-amber-950"
          iconColor="text-amber-600 dark:text-amber-400"
        />

        <GradientStatsCard
          title="Resolved"
          value="1,174"
          icon={CheckCircle}
          gradientFrom="from-emerald-500"
          gradientTo="to-green-500"
          iconBg="bg-emerald-100 dark:bg-emerald-950"
          iconColor="text-emerald-600 dark:text-emerald-400"
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
          iconColor="green"
          valueColor="text-green-600 dark:text-green-400"
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
        <StyledCard>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Response Time</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">87ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Throughput</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">1.2K/s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate</span>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">99.8%</span>
            </div>
          </CardContent>
        </StyledCard>

        {/* System Health */}
        <StyledCard>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">CPU Usage</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">42%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Memory</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">3.2GB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Disk I/O</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">Normal</span>
            </div>
          </CardContent>
        </StyledCard>

        {/* Alert Summary */}
        <StyledCard>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Alert Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Critical</span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">2</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Warning</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">5</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Info</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">12</span>
            </div>
          </CardContent>
        </StyledCard>
      </div>
    </div>
  ),
};