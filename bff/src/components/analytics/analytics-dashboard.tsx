import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  Shield,
  Clock,
  Users,
  Target,
  Zap,
  BarChart3,
  PieChartIcon,
  Calendar,
  Download,
  RefreshCw,
} from 'lucide-react'
import { useAnalytics } from '@/lib/hooks/use-analytics'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

interface AnalyticsDashboardProps {
  tenantId?: string
  dateRange?: { start: Date; end: Date }
}

export function AnalyticsDashboard({ tenantId, dateRange }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d')
  const [refreshing, setRefreshing] = useState(false)

  const { data: analytics, isLoading, refetch } = useAnalytics({
    tenantId,
    timeRange,
    dateRange,
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setTimeout(() => setRefreshing(false), 500)
  }

  const metrics = analytics?.metrics || {
    totalSignals: 0,
    activeSignals: 0,
    resolvedSignals: 0,
    falsePositives: 0,
    avgResolutionTime: 0,
    totalRules: 0,
    activeRules: 0,
    ruleHitRate: 0,
  }

  const signalTrend = analytics?.signalTrend || []
  const signalsByStatus = analytics?.signalsByStatus || []
  const rulePerformance = analytics?.rulePerformance || []
  const signalsByCategory = analytics?.signalsByCategory || []
  const resolutionTimeDistribution = analytics?.resolutionTimeDistribution || []
  const teamActivity = analytics?.teamActivity || []

  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const statusColors = {
    OPEN: '#ef4444',
    INVESTIGATING: '#f59e0b',
    RESOLVED: '#10b981',
    FALSE_POSITIVE: '#6b7280',
  }

  const categoryColors = [
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#10b981',
    '#06b6d4',
  ]

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-gray-500">Monitor your signal and rule performance</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className={refreshing ? 'animate-spin' : ''}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Signals</CardTitle>
              <Activity className="w-4 h-4 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSignals.toLocaleString()}</div>
            <div className="flex items-center gap-1 mt-1">
              {metrics.totalSignals > 100 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-500">+12.5%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-500">-5.2%</span>
                </>
              )}
              <span className="text-xs text-gray-500">from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Signals</CardTitle>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeSignals}</div>
            <div className="text-xs text-gray-500 mt-1">
              {metrics.totalSignals > 0
                ? `${((metrics.activeSignals / metrics.totalSignals) * 100).toFixed(1)}% of total`
                : '0% of total'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.avgResolutionTime < 60
                ? `${metrics.avgResolutionTime}m`
                : metrics.avgResolutionTime < 1440
                ? `${(metrics.avgResolutionTime / 60).toFixed(1)}h`
                : `${(metrics.avgResolutionTime / 1440).toFixed(1)}d`}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-500">-18%</span>
              <span className="text-xs text-gray-500">improvement</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Rule Hit Rate</CardTitle>
              <Target className="w-4 h-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.ruleHitRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-1">
              {metrics.activeRules} of {metrics.totalRules} rules active
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signal Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Signal Trend</CardTitle>
          <CardDescription>Signal volume over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={signalTrend}>
              <defs>
                <linearGradient id="colorSignals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  border: 'none',
                  borderRadius: '8px',
                }}
                labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorSignals)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signals by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Signals by Status</CardTitle>
            <CardDescription>Current signal distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={signalsByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {signalsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={statusColors[entry.name as keyof typeof statusColors]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {signalsByStatus.map((status) => (
                <div key={status.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: statusColors[status.name as keyof typeof statusColors] }}
                  />
                  <span className="text-sm">{status.name}</span>
                  <span className="text-sm font-semibold ml-auto">{status.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rule Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Rules</CardTitle>
            <CardDescription>Rules by signal detection count</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rulePerformance} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="hits" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Signals by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Signal Categories</CardTitle>
            <CardDescription>Distribution across threat categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={signalsByCategory}>
                <PolarGrid className="stroke-gray-200 dark:stroke-gray-700" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="Signals"
                  dataKey="value"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resolution Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Resolution Time Distribution</CardTitle>
            <CardDescription>Time to resolve signals</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={resolutionTimeDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Team Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Team Activity</CardTitle>
          <CardDescription>Investigation and resolution activity by team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamActivity.map((member) => (
              <div key={member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{member.signalsInvestigated}</p>
                    <p className="text-xs text-gray-500">Investigated</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{member.signalsResolved}</p>
                    <p className="text-xs text-gray-500">Resolved</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{member.avgResolutionTime}h</p>
                    <p className="text-xs text-gray-500">Avg Time</p>
                  </div>
                  <Badge variant={member.performance === 'high' ? 'default' : 'secondary'}>
                    {member.performance === 'high' ? (
                      <>
                        <Zap className="w-3 h-3 mr-1" />
                        High Performer
                      </>
                    ) : (
                      'Active'
                    )}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}