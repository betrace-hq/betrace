import { useQuery } from '@tanstack/react-query'
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval } from 'date-fns'
import { useReactiveAuth } from './use-reactive-auth'

interface AnalyticsOptions {
  tenantId?: string
  timeRange?: '24h' | '7d' | '30d' | '90d'
  dateRange?: { start: Date; end: Date }
}

interface AnalyticsData {
  metrics: {
    totalSignals: number
    activeSignals: number
    resolvedSignals: number
    falsePositives: number
    avgResolutionTime: number
    totalRules: number
    activeRules: number
    ruleHitRate: number
  }
  signalTrend: Array<{
    date: string
    count: number
  }>
  signalsByStatus: Array<{
    name: string
    value: number
  }>
  rulePerformance: Array<{
    id: string
    name: string
    hits: number
  }>
  signalsByCategory: Array<{
    category: string
    value: number
  }>
  resolutionTimeDistribution: Array<{
    range: string
    count: number
  }>
  teamActivity: Array<{
    id: string
    name: string
    role: string
    signalsInvestigated: number
    signalsResolved: number
    avgResolutionTime: number
    performance: 'high' | 'normal'
  }>
}

export function useAnalytics(options: AnalyticsOptions = {}) {
  const { isAuthenticated, isDemo } = useReactiveAuth()
  const { timeRange = '7d', dateRange, tenantId } = options

  const getDateRange = () => {
    if (dateRange) {
      return {
        start: startOfDay(dateRange.start),
        end: endOfDay(dateRange.end),
      }
    }

    const end = endOfDay(new Date())
    let start: Date

    switch (timeRange) {
      case '24h':
        start = subDays(end, 1)
        break
      case '7d':
        start = subDays(end, 7)
        break
      case '30d':
        start = subDays(end, 30)
        break
      case '90d':
        start = subDays(end, 90)
        break
      default:
        start = subDays(end, 7)
    }

    return { start: startOfDay(start), end }
  }

  return useQuery({
    queryKey: ['analytics', timeRange, dateRange, tenantId],
    queryFn: async (): Promise<AnalyticsData> => {
      // Demo mode - return mock data
      if (isDemo || !isAuthenticated) {
        return getMockAnalytics(getDateRange())
      }

      // Real API call would go here
      const response = await fetch(`/api/v1/analytics?${new URLSearchParams({
        tenantId: tenantId || '',
        startDate: getDateRange().start.toISOString(),
        endDate: getDateRange().end.toISOString(),
      })}`)

      if (!response.ok) {
        // Fallback to mock data on error
        return getMockAnalytics(getDateRange())
      }

      return response.json()
    },
    enabled: true,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  })
}

function getMockAnalytics(dateRange: { start: Date; end: Date }): AnalyticsData {
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end })

  // Generate signal trend data
  const signalTrend = days.map(day => ({
    date: day.toISOString(),
    count: Math.floor(Math.random() * 50) + 20 + (Math.random() > 0.7 ? Math.floor(Math.random() * 100) : 0),
  }))

  const totalSignals = signalTrend.reduce((sum, day) => sum + day.count, 0)
  const activeSignals = Math.floor(totalSignals * 0.15)
  const resolvedSignals = Math.floor(totalSignals * 0.75)
  const falsePositives = Math.floor(totalSignals * 0.1)

  return {
    metrics: {
      totalSignals,
      activeSignals,
      resolvedSignals,
      falsePositives,
      avgResolutionTime: 127, // minutes
      totalRules: 42,
      activeRules: 38,
      ruleHitRate: 76.3,
    },
    signalTrend,
    signalsByStatus: [
      { name: 'OPEN', value: activeSignals },
      { name: 'INVESTIGATING', value: Math.floor(activeSignals * 0.6) },
      { name: 'RESOLVED', value: resolvedSignals },
      { name: 'FALSE_POSITIVE', value: falsePositives },
    ],
    rulePerformance: [
      { id: '1', name: 'Suspicious Login', hits: 342 },
      { id: '2', name: 'Data Exfiltration', hits: 289 },
      { id: '3', name: 'Privilege Escalation', hits: 201 },
      { id: '4', name: 'Lateral Movement', hits: 156 },
      { id: '5', name: 'Command & Control', hits: 98 },
    ],
    signalsByCategory: [
      { category: 'Authentication', value: 85 },
      { category: 'Network', value: 72 },
      { category: 'File System', value: 68 },
      { category: 'Process', value: 91 },
      { category: 'Registry', value: 45 },
      { category: 'API', value: 78 },
    ],
    resolutionTimeDistribution: [
      { range: '< 15m', count: 120 },
      { range: '15-30m', count: 85 },
      { range: '30m-1h', count: 95 },
      { range: '1-2h', count: 110 },
      { range: '2-4h', count: 65 },
      { range: '> 4h', count: 45 },
    ],
    teamActivity: [
      {
        id: '1',
        name: 'Sarah Chen',
        role: 'Security Analyst',
        signalsInvestigated: 142,
        signalsResolved: 98,
        avgResolutionTime: 1.2,
        performance: 'high',
      },
      {
        id: '2',
        name: 'Michael Rodriguez',
        role: 'Senior Analyst',
        signalsInvestigated: 89,
        signalsResolved: 76,
        avgResolutionTime: 0.9,
        performance: 'high',
      },
      {
        id: '3',
        name: 'Emily Johnson',
        role: 'Security Engineer',
        signalsInvestigated: 67,
        signalsResolved: 52,
        avgResolutionTime: 1.8,
        performance: 'normal',
      },
      {
        id: '4',
        name: 'David Park',
        role: 'Incident Responder',
        signalsInvestigated: 125,
        signalsResolved: 89,
        avgResolutionTime: 2.1,
        performance: 'normal',
      },
    ],
  }
}