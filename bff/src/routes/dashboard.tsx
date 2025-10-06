import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getAnalytics } from '@/lib/data/mock-data'
import { useAuth } from '@/lib/auth/auth-context'
import { DemoApiService } from '@/lib/api/demo-api'
import { Layout } from '@/components/layout/layout'
import { StyledCard, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/styled-card'
import { GradientStatsCard } from '@/components/ui/gradient-stats-card'
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-purple-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 relative overflow-hidden">
        {/* Enhanced background elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Subtle gradient orbs */}
          <div className="absolute -top-40 -right-32 w-[400px] h-[400px] bg-gradient-to-br from-blue-500/20 to-cyan-400/10 rounded-full blur-3xl animate-pulse opacity-60"></div>
          <div className="absolute -bottom-40 -left-32 w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/15 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000 opacity-50"></div>
          <div className="absolute top-1/3 right-1/4 w-[250px] h-[250px] bg-gradient-to-r from-emerald-400/15 to-teal-300/10 rounded-full blur-3xl animate-pulse delay-2000 opacity-40"></div>

          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.04),transparent_70%)]"></div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <GradientStatsCard
            title="Total Signals"
            value={String(analytics?.totalSignalsToday || 0)}
            icon={Activity}
            gradientFrom="from-blue-500"
            gradientTo="to-cyan-500"
            iconBg="bg-blue-100 dark:bg-blue-950"
            iconColor="text-blue-600 dark:text-blue-400"
            navigateTo="/signals"
          />

          <GradientStatsCard
            title="Open Signals"
            value={String(analytics?.openSignals || 0)}
            icon={AlertCircle}
            gradientFrom="from-red-500"
            gradientTo="to-orange-500"
            iconBg="bg-red-100 dark:bg-red-950"
            iconColor="text-red-600 dark:text-red-400"
            navigateTo="/signals"
            navigateSearch={{ status: 'OPEN' }}
          />

          <GradientStatsCard
            title="Investigating"
            value={String(analytics?.openSignals ? Math.floor(analytics.openSignals * 0.3) : 0)}
            icon={Clock}
            gradientFrom="from-yellow-500"
            gradientTo="to-amber-500"
            iconBg="bg-yellow-100 dark:bg-yellow-950"
            iconColor="text-yellow-600 dark:text-yellow-400"
            navigateTo="/signals"
            navigateSearch={{ status: 'INVESTIGATING' }}
          />

          <GradientStatsCard
            title="Resolved"
            value={String(analytics?.resolvedToday || 0)}
            icon={CheckCircle}
            gradientFrom="from-emerald-500"
            gradientTo="to-green-500"
            iconBg="bg-emerald-100 dark:bg-emerald-950"
            iconColor="text-emerald-600 dark:text-emerald-400"
            navigateTo="/signals"
            navigateSearch={{ status: 'RESOLVED' }}
          />
        </div>

        {/* Recent Signals */}
        <div className="mb-8">
          <StyledCard>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Recent Signals</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400 font-medium">Latest signals from your services</CardDescription>
            </CardHeader>
          <CardContent>
            {signalsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Loading signals...</p>
              </div>
            ) : recentSignals.length > 0 ? (
              <div className="space-y-3">
                {recentSignals.map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-slate-50/80 to-slate-100/50 dark:from-slate-700/50 dark:to-slate-800/30 hover:from-slate-100/90 hover:to-slate-200/60 dark:hover:from-slate-600/60 dark:hover:to-slate-700/40 border border-slate-200/30 dark:border-slate-600/30 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-slate-900 dark:text-white">{signal.title}</span>
                        <StatusBadge status={signal.status} />
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{signal.service} • {new Date(signal.timestamp).toLocaleDateString()}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 font-semibold rounded-xl"
                      onClick={() => navigate({ to: '/signals' })}
                    >
                      View
                    </Button>
                  </div>
                ))}
                <div className="pt-4">
                  <Button
                    variant="outline"
                    className="w-full bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200/50 dark:border-blue-700/50 hover:border-blue-300 dark:hover:border-blue-600 font-semibold rounded-2xl py-3 transition-all duration-300 hover:scale-105"
                    onClick={() => navigate({ to: '/signals' })}
                  >
                    View All Signals
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No Recent Signals</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Signals will appear here as they are generated by your services</p>
              </div>
            )}
          </CardContent>
          </StyledCard>
        </div>

        {/* Recent Activity */}
        <div>
          <StyledCard>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">Recent Activity</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400 font-medium">Recent system events and actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No Recent Activity</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Activity will appear here once you start using the system</p>
              </div>
            </CardContent>
          </StyledCard>
        </div>
        </main>
      </div>
    </Layout>
  )
}