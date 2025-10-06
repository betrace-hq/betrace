import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Activity,
  Clock,
  Target,
  Zap,
  Download,
  Maximize2,
  Filter,
  Calendar,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react'

interface SignalDataVisualizationProps {
  className?: string
}

interface ChartDataPoint {
  label: string
  value: number
  color?: string
  percentage?: number
}

interface TimeSeriesDataPoint {
  timestamp: string
  value: number
  category?: string
}

interface HeatmapDataPoint {
  x: string
  y: string
  value: number
  intensity: number
}

interface AnalyticsMetrics {
  total_signals: number
  resolved_signals: number
  false_positives: number
  avg_resolution_time: number
  critical_alerts: number
  detection_accuracy: number
  mttr: number // Mean Time To Resolution
  mttd: number // Mean Time To Detection
}

export function SignalDataVisualization({ className }: SignalDataVisualizationProps) {
  const [timeRange, setTimeRange] = useState('7d')
  const [selectedChart, setSelectedChart] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Mock analytics data - in production this would come from API
  const analyticsMetrics: AnalyticsMetrics = useMemo(() => ({
    total_signals: 1247,
    resolved_signals: 1089,
    false_positives: 89,
    avg_resolution_time: 142, // minutes
    critical_alerts: 23,
    detection_accuracy: 92.8,
    mttr: 156, // minutes
    mttd: 8.4 // minutes
  }), [])

  // Signal status distribution
  const statusDistribution: ChartDataPoint[] = useMemo(() => [
    { label: 'Resolved', value: 1089, color: '#10b981', percentage: 87.3 },
    { label: 'Investigating', value: 69, color: '#f59e0b', percentage: 5.5 },
    { label: 'Open', value: 44, color: '#ef4444', percentage: 3.5 },
    { label: 'False Positive', value: 45, color: '#6b7280', percentage: 3.6 }
  ], [])

  // Severity distribution
  const severityDistribution: ChartDataPoint[] = useMemo(() => [
    { label: 'Critical', value: 23, color: '#dc2626', percentage: 1.8 },
    { label: 'High', value: 167, color: '#ea580c', percentage: 13.4 },
    { label: 'Medium', value: 658, color: '#d97706', percentage: 52.8 },
    { label: 'Low', value: 399, color: '#16a34a', percentage: 32.0 }
  ], [])

  // Time series data for signal volume
  const signalVolumeData: TimeSeriesDataPoint[] = useMemo(() => {
    const days = 30
    const data: TimeSeriesDataPoint[] = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const baseVolume = 40 + Math.sin(i * 0.2) * 10
      const randomVariation = Math.random() * 20 - 10

      data.push({
        timestamp: date.toISOString().split('T')[0],
        value: Math.max(0, Math.round(baseVolume + randomVariation)),
        category: 'signals'
      })
    }

    return data
  }, [])

  // Top triggered rules
  const topRules: ChartDataPoint[] = useMemo(() => [
    { label: 'Suspicious Login Activity', value: 234, percentage: 18.8 },
    { label: 'Failed Authentication Attempts', value: 189, percentage: 15.2 },
    { label: 'Privilege Escalation Detection', value: 156, percentage: 12.5 },
    { label: 'Data Exfiltration Pattern', value: 123, percentage: 9.9 },
    { label: 'Network Anomaly Detection', value: 98, percentage: 7.9 },
    { label: 'Malware Signature Match', value: 87, percentage: 7.0 },
    { label: 'SQL Injection Attempt', value: 76, percentage: 6.1 },
    { label: 'Brute Force Attack', value: 65, percentage: 5.2 }
  ], [])

  // Response time heatmap
  const responseTimeHeatmap: HeatmapDataPoint[] = useMemo(() => {
    const hours = ['00', '04', '08', '12', '16', '20']
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const data: HeatmapDataPoint[] = []

    days.forEach(day => {
      hours.forEach(hour => {
        const baseTime = 15 + Math.random() * 30
        const intensity = Math.min(100, Math.max(0, baseTime))

        data.push({
          x: hour,
          y: day,
          value: Math.round(baseTime),
          intensity: intensity / 45 * 100
        })
      })
    })

    return data
  }, [])

  const handleRefreshData = () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => setIsLoading(false), 1500)
  }

  const handleExportData = () => {
    // In production, this would generate and download a CSV/PDF report
    console.log('Exporting analytics data...')
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getIntensityColor = (intensity: number) => {
    if (intensity < 25) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    if (intensity < 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    if (intensity < 75) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
  }

  return (
    <Card className={`border-gray-200 dark:border-gray-700 ${className}`}>
      <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Signal Analytics Dashboard
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
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
              size="sm"
              onClick={handleRefreshData}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportData}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Signals</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {analyticsMetrics.total_signals.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400">+12% vs last period</span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Detection Accuracy</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {analyticsMetrics.detection_accuracy}%
                    </p>
                  </div>
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400">+2.1% accuracy improvement</span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">MTTR</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatDuration(analyticsMetrics.mttr)}
                    </p>
                  </div>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                    <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-red-500 rotate-180" />
                  <span className="text-xs text-green-600 dark:text-green-400">-18% faster response</span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Critical Alerts</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {analyticsMetrics.critical_alerts}
                    </p>
                  </div>
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-red-500 rotate-180" />
                  <span className="text-xs text-green-600 dark:text-green-400">-31% reduction</span>
                </div>
              </div>
            </div>

            {/* Status and Severity Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Signal Status Distribution
                </h3>
                <div className="space-y-3">
                  {statusDistribution.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.value.toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {item.percentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Severity Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Severity Distribution
                </h3>
                <div className="space-y-3">
                  {severityDistribution.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.value} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: item.color,
                            width: `${item.percentage}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            {/* Signal Volume Trend */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Signal Volume Trend (30 Days)
              </h3>
              <div className="h-64 flex items-end justify-between gap-1">
                {signalVolumeData.slice(-14).map((point, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all duration-300 hover:bg-blue-600 dark:hover:bg-blue-300"
                      style={{
                        height: `${(point.value / Math.max(...signalVolumeData.map(p => p.value))) * 200}px`,
                        minHeight: '4px'
                      }}
                      title={`${point.value} signals on ${point.timestamp}`}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400 transform -rotate-45 origin-center">
                      {new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Triggered Rules */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Top Triggered Rules
              </h3>
              <div className="space-y-3">
                {topRules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {rule.label}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          {rule.value} ({rule.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${rule.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {/* Response Time Heatmap */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Average Response Time Heatmap (Minutes)
              </h3>
              <div className="space-y-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="flex items-center gap-2">
                    <div className="w-12 text-xs text-gray-500 dark:text-gray-400">{day}</div>
                    <div className="flex gap-1">
                      {['00', '04', '08', '12', '16', '20'].map(hour => {
                        const dataPoint = responseTimeHeatmap.find(p => p.y === day && p.x === hour)
                        return (
                          <div
                            key={hour}
                            className={`w-12 h-8 rounded text-xs flex items-center justify-center font-medium ${
                              dataPoint ? getIntensityColor(dataPoint.intensity) : 'bg-gray-100 dark:bg-gray-700'
                            }`}
                            title={`${day} ${hour}:00 - ${dataPoint?.value || 0} min avg response time`}
                          >
                            {dataPoint?.value || 0}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-4">
                  <div className="w-12"></div>
                  <div className="flex gap-1">
                    {['00', '04', '08', '12', '16', '20'].map(hour => (
                      <div key={hour} className="w-12 text-xs text-center text-gray-500 dark:text-gray-400">
                        {hour}:00
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Resolution Rate</h4>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">87.3%</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  of signals resolved successfully
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">False Positive Rate</h4>
                  <XCircle className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">7.2%</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  improvement in accuracy
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Detection Speed</h4>
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">8.4m</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  average time to detect threats
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            {/* AI-Generated Insights */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                AI-Powered Insights
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-blue-500 rounded-full">
                      <TrendingUp className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">Peak Activity Pattern</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Signal volume increases by 34% during business hours (9 AM - 5 PM). Consider adjusting monitoring sensitivity during these periods.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-amber-500 rounded-full">
                      <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-amber-900 dark:text-amber-100">False Positive Trend</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        "Suspicious Login Activity" rule generates 23% false positives. Consider tuning the threshold parameters.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-green-500 rounded-full">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-green-900 dark:text-green-100">Performance Improvement</h4>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        Response time improved by 18% this week. The new automation playbooks are effectively reducing manual intervention.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-purple-500 rounded-full">
                      <Target className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-purple-900 dark:text-purple-100">Optimization Opportunity</h4>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        Weekend response times are 40% slower. Consider implementing automated triage for low-severity signals during off-hours.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recommendations</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Rule Optimization</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Review and tune the top 3 rules generating false positives to improve detection accuracy.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Automation Enhancement</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Implement automated response for low-severity signals to reduce manual workload by an estimated 25%.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Coverage Analysis</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Consider adding monitoring rules for emerging threat patterns detected in external intelligence feeds.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}