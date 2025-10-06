import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  BarChart,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  Eye,
  Zap,
  Users,
  Server,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface MetricCard {
  title: string
  value: number | string
  change: number
  changeType: 'increase' | 'decrease' | 'neutral'
  icon: any
  description: string
  trend: number[]
}

interface TimeSeriesData {
  timestamp: string
  signals_detected: number
  signals_resolved: number
  avg_resolution_time: number
  false_positive_rate: number
}

interface ServiceMetrics {
  service: string
  signal_count: number
  avg_priority: number
  resolution_rate: number
  avg_time_to_resolve: number
}

interface AnalystMetrics {
  analyst: string
  signals_handled: number
  avg_resolution_time: number
  accuracy_rate: number
  efficiency_score: number
}

interface SignalMetricsDashboardProps {
  signals: DemoSignal[]
  className?: string
}

export function SignalMetricsDashboard({ signals, className }: SignalMetricsDashboardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d')
  const [metrics, setMetrics] = useState<MetricCard[]>([])
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [serviceMetrics, setServiceMetrics] = useState<ServiceMetrics[]>([])
  const [analystMetrics, setAnalystMetrics] = useState<AnalystMetrics[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const generateMetrics = () => {
    setIsLoading(true)

    // Simulate data generation
    setTimeout(() => {
      const totalSignals = signals.length
      const openSignals = signals.filter(s => s.status === 'open').length
      const resolvedSignals = signals.filter(s => s.status === 'resolved').length
      const investigatingSignals = signals.filter(s => s.status === 'investigating').length

      // Generate mock metrics
      const metricsData: MetricCard[] = [
        {
          title: 'Total Signals',
          value: totalSignals,
          change: 12.5,
          changeType: 'increase',
          icon: Activity,
          description: 'Total signals detected in selected period',
          trend: [45, 52, 48, 61, 55, 67, totalSignals]
        },
        {
          title: 'Resolution Rate',
          value: `${Math.round((resolvedSignals / totalSignals) * 100)}%`,
          change: 8.2,
          changeType: 'increase',
          icon: CheckCircle,
          description: 'Percentage of signals successfully resolved',
          trend: [78, 82, 79, 85, 83, 87, Math.round((resolvedSignals / totalSignals) * 100)]
        },
        {
          title: 'Avg Resolution Time',
          value: '4.2h',
          change: -15.3,
          changeType: 'decrease',
          icon: Clock,
          description: 'Average time from detection to resolution',
          trend: [6.2, 5.8, 5.1, 4.9, 4.5, 4.3, 4.2]
        },
        {
          title: 'False Positive Rate',
          value: '8.3%',
          change: -5.1,
          changeType: 'decrease',
          icon: Target,
          description: 'Percentage of signals marked as false positives',
          trend: [12.1, 11.5, 10.8, 9.7, 9.1, 8.6, 8.3]
        },
        {
          title: 'Critical Signals',
          value: signals.filter(s => s.severity === 'CRITICAL').length,
          change: 23.7,
          changeType: 'increase',
          icon: AlertTriangle,
          description: 'High priority signals requiring immediate attention',
          trend: [3, 5, 4, 7, 6, 8, signals.filter(s => s.severity === 'CRITICAL').length]
        },
        {
          title: 'Analyst Efficiency',
          value: '94.2%',
          change: 3.8,
          changeType: 'increase',
          icon: Users,
          description: 'Overall analyst performance and accuracy',
          trend: [89, 91, 90, 93, 92, 94, 94.2]
        }
      ]

      // Generate time series data
      const timeData: TimeSeriesData[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        timeData.push({
          timestamp: date.toISOString(),
          signals_detected: Math.floor(Math.random() * 20) + 10,
          signals_resolved: Math.floor(Math.random() * 15) + 8,
          avg_resolution_time: Math.random() * 3 + 2,
          false_positive_rate: Math.random() * 5 + 5
        })
      }

      // Generate service metrics
      const services = ['auth-service', 'api-gateway', 'payment-service', 'user-service', 'data-service']
      const serviceData: ServiceMetrics[] = services.map(service => ({
        service,
        signal_count: Math.floor(Math.random() * 15) + 5,
        avg_priority: Math.floor(Math.random() * 40) + 50,
        resolution_rate: Math.random() * 20 + 75,
        avg_time_to_resolve: Math.random() * 4 + 2
      }))

      // Generate analyst metrics
      const analysts = ['Sarah Chen', 'Mike Rodriguez', 'Emma Thompson', 'David Kim', 'Alex Johnson']
      const analystData: AnalystMetrics[] = analysts.map(analyst => ({
        analyst,
        signals_handled: Math.floor(Math.random() * 20) + 10,
        avg_resolution_time: Math.random() * 3 + 2,
        accuracy_rate: Math.random() * 15 + 85,
        efficiency_score: Math.random() * 20 + 75
      }))

      setMetrics(metricsData)
      setTimeSeriesData(timeData)
      setServiceMetrics(serviceData)
      setAnalystMetrics(analystData)
      setIsLoading(false)
    }, 1000)
  }

  useEffect(() => {
    if (isOpen) {
      generateMetrics()
    }
  }, [isOpen, timeRange, signals])

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'increase': return <ArrowUp className="w-3 h-3" />
      case 'decrease': return <ArrowDown className="w-3 h-3" />
      default: return <Minus className="w-3 h-3" />
    }
  }

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'increase': return 'text-green-600 dark:text-green-400'
      case 'decrease': return 'text-red-600 dark:text-red-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const formatMetricValue = (value: number | string) => {
    if (typeof value === 'number') {
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k`
      }
      return value.toString()
    }
    return value
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className={className}>
            <BarChart className="w-4 h-4 mr-2" />
            Performance Metrics
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Signal Performance Metrics Dashboard</DialogTitle>
            <DialogDescription>
              Comprehensive analytics and performance insights for signal detection and response operations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Time Range Selector */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Performance Overview</h3>
              <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
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
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading metrics...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {metrics.map((metric, index) => {
                    const Icon = metric.icon
                    return (
                      <Card key={index} className="border-gray-200 dark:border-gray-700">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  {metric.title}
                                </p>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                {formatMetricValue(metric.value)}
                              </p>
                              <div className={`flex items-center gap-1 text-sm ${getChangeColor(metric.changeType)}`}>
                                {getChangeIcon(metric.changeType)}
                                <span>{Math.abs(metric.change)}%</span>
                                <span className="text-gray-500">vs previous period</span>
                              </div>
                            </div>
                            {/* Mini Trend Chart Placeholder */}
                            <div className="w-16 h-12 flex items-end gap-1">
                              {metric.trend.map((value, i) => (
                                <div
                                  key={i}
                                  className="bg-blue-200 dark:bg-blue-800 rounded-sm flex-1"
                                  style={{
                                    height: `${(value / Math.max(...metric.trend)) * 100}%`,
                                    minHeight: '2px'
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">{metric.description}</p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {/* Service Performance */}
                <Card className="border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="w-5 h-5" />
                      Service Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {serviceMetrics.map((service, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                            <span className="font-medium">{service.service}</span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <p className="font-semibold">{service.signal_count}</p>
                              <p className="text-gray-500">Signals</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold">{service.avg_priority.toFixed(0)}</p>
                              <p className="text-gray-500">Avg Priority</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold">{service.resolution_rate.toFixed(1)}%</p>
                              <p className="text-gray-500">Resolution</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold">{service.avg_time_to_resolve.toFixed(1)}h</p>
                              <p className="text-gray-500">Avg Time</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Analyst Performance */}
                <Card className="border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Analyst Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analystMetrics.map((analyst, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                {analyst.analyst.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <span className="font-medium">{analyst.analyst}</span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <p className="font-semibold">{analyst.signals_handled}</p>
                              <p className="text-gray-500">Handled</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold">{analyst.avg_resolution_time.toFixed(1)}h</p>
                              <p className="text-gray-500">Avg Time</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold">{analyst.accuracy_rate.toFixed(1)}%</p>
                              <p className="text-gray-500">Accuracy</p>
                            </div>
                            <div className="text-center">
                              <Badge
                                variant={analyst.efficiency_score >= 85 ? 'default' : analyst.efficiency_score >= 70 ? 'secondary' : 'destructive'}
                              >
                                {analyst.efficiency_score.toFixed(0)}
                              </Badge>
                              <p className="text-gray-500">Score</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Time Series Overview */}
                <Card className="border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Signal Trends ({timeRange})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {timeSeriesData.map((data, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                          <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium">
                              {new Date(data.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <p className="font-semibold text-blue-600">{data.signals_detected}</p>
                              <p className="text-gray-500">Detected</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold text-green-600">{data.signals_resolved}</p>
                              <p className="text-gray-500">Resolved</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold">{data.avg_resolution_time.toFixed(1)}h</p>
                              <p className="text-gray-500">Avg Time</p>
                            </div>
                            <div className="text-center">
                              <p className="font-semibold">{data.false_positive_rate.toFixed(1)}%</p>
                              <p className="text-gray-500">False Pos</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={generateMetrics}
                disabled={isLoading}
                className="flex-1"
              >
                <Zap className="w-4 h-4 mr-2" />
                Refresh Metrics
              </Button>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}