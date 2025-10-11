import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getAnalytics } from '@/lib/data/mock-data'
import { useAuth } from '@/lib/auth/auth-context'
import { DemoApiService } from '@/lib/api/demo-api'
import { Layout } from '@/components/layout/layout'
import { StyledCard, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/styled-card'
import { StatsCard } from '@/components/ui/stats-card'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSignals } from '@/lib/hooks/use-signals'
import { AlertCircle, CheckCircle, Clock, Activity, TrendingUp, Users, Shield } from 'lucide-react'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const { user, tenant, isAuthenticated, isLoading, isDemoMode } = useAuth()

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/auth' })
    }
  }, [isAuthenticated, isLoading, navigate])

  // Use TanStack Query for server state
  const { data: analytics, isPending: statsLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => {
      if (isDemoMode) {
        return DemoApiService.getAnalytics()
      }
      return getAnalytics()
    },
    staleTime: 30 * 1000, // 30 seconds
  })

  // Fetch recent signals for the dashboard
  const { data: allSignals = [], isPending: signalsLoading } = useSignals()
  const recentSignals = allSignals.slice(0, 5) // Show 5 most recent signals

  if (statsLoading) {
    return <LoadingState fullScreen message="Loading dashboard..." />
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Signals"
            value={String(analytics?.totalSignalsToday || 0)}
            icon={Activity}
            iconColor="blue"
          />

          <StatsCard
            title="Open Signals"
            value={String(analytics?.openSignals || 0)}
            icon={AlertCircle}
            iconColor="red"
          />

          <StatsCard
            title="Investigating"
            value={String(analytics?.openSignals ? Math.floor(analytics.openSignals * 0.3) : 0)}
            icon={Clock}
            iconColor="amber"
          />

          <StatsCard
            title="Resolved"
            value={String(analytics?.resolvedToday || 0)}
            icon={CheckCircle}
            iconColor="green"
          />
        </div>

        {/* Recent Signals */}
        <div className="mb-8">
          <StyledCard>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">Recent Signals</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">Latest signals from your services</CardDescription>
            </CardHeader>
          <CardContent>
            {signalsLoading ? (
              <LoadingState message="Loading signals..." />
            ) : recentSignals.length > 0 ? (
              <div className="space-y-3">
                {recentSignals.map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{signal.title}</span>
                        <StatusBadge status={signal.status} />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{signal.service} • {new Date(signal.timestamp).toLocaleDateString()}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      onClick={() => navigate({ to: '/signals' })}
                    >
                      View
                    </Button>
                  </div>
                ))}
                <div className="pt-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate({ to: '/signals' })}
                  >
                    View All Signals
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={AlertCircle}
                title="No Recent Signals"
                description="Signals will appear here as they are generated by your services"
              />
            )}
          </CardContent>
          </StyledCard>
        </div>

        {/* Recent Activity */}
        <div>
          <StyledCard>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">Recent Activity</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">Recent system events and actions</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Activity}
                title="No Recent Activity"
                description="Activity will appear here once you start using the system"
              />
            </CardContent>
          </StyledCard>
        </div>
        </main>
      </div>
    </Layout>
  )
}