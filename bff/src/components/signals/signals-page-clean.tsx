import { useState, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { StyledCard, CardContent, CardHeader, CardTitle } from '@/components/ui/styled-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { SeverityBadge } from '@/components/ui/severity-badge'
import { GradientStatsCard } from '@/components/ui/gradient-stats-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth/auth-context'
import { useSignals, useInvestigateSignal, useResolveSignal, useMarkFalsePositive } from '@/lib/hooks/use-signals'
import { Layout } from '@/components/layout/layout'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Eye,
  RefreshCw,
  AlertTriangle,
  Shield,
  Activity
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

export function SignalsPageClean() {
  const navigate = useNavigate()
  const { user, canAccess } = useAuth()
  const search = useSearch({ from: '/signals' })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(search.status || 'all')
  const [severityFilter, setSeverityFilter] = useState(search.severity || 'all')

  // Use TanStack Query for server state
  const { data: allSignals = [], isPending: isLoading, error, refetch } = useSignals({
    status: statusFilter === 'all' ? undefined : [statusFilter as any],
    severity: severityFilter === 'all' ? undefined : [severityFilter as any],
  })

  // Signal mutation hooks
  const investigateSignal = useInvestigateSignal()
  const resolveSignal = useResolveSignal()
  const markFalsePositive = useMarkFalsePositive()

  // Sync filters with URL search parameters
  useEffect(() => {
    setStatusFilter(search.status || 'all')
    setSeverityFilter(search.severity || 'all')
  }, [search.status, search.severity])

  // Filter signals based on search term
  const filteredSignals = (allSignals as DemoSignal[]).filter((signal: DemoSignal) => {
    const matchesSearch = signal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signal.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signal.description.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return `${diffMins}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const handleStatusChange = async (signal: DemoSignal, action: 'investigate' | 'resolve' | 'false_positive') => {
    if (!canAccess('signals:write')) {
      alert('You do not have permission to modify signals')
      return
    }

    try {
      const userNote = `${action === 'investigate' ? 'Investigation started' :
                       action === 'resolve' ? 'Resolved' : 'Marked as false positive'} by ${
                       user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}`

      switch (action) {
        case 'investigate':
          await investigateSignal.mutateAsync({ id: signal.id, notes: userNote })
          break
        case 'resolve':
          await resolveSignal.mutateAsync({ id: signal.id, notes: userNote })
          break
        case 'false_positive':
          await markFalsePositive.mutateAsync({ id: signal.id, notes: userNote })
          break
      }
    } catch (error) {
      console.error(`Failed to ${action} signal:`, error)
      alert(`Failed to ${action} signal. Please try again.`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading signals...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Signals</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Failed to load signals. Please try again.</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Security Signals</h1>
              <p className="text-gray-600 dark:text-gray-400">Monitor and manage behavioral anomalies detected by FLUO</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <GradientStatsCard
            title="Total Signals"
            value={allSignals.length}
            icon={
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            gradientFrom="from-blue-600"
            gradientTo="to-cyan-600"
            iconBg="bg-gradient-to-r from-blue-500/20 to-cyan-500/20"
            iconColor="text-blue-600 dark:text-blue-400"
            borderColor="border-slate-200/50 dark:border-slate-700/50"
            hoverBorderColor="hover:border-blue-300/50 dark:hover:border-blue-600/50"
          />
          <GradientStatsCard
            title="Open"
            value={(allSignals as DemoSignal[]).filter(s => s.status === 'open').length}
            icon={
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            }
            gradientFrom="from-red-600"
            gradientTo="to-orange-600"
            iconBg="bg-gradient-to-r from-red-500/20 to-orange-500/20"
            iconColor="text-red-600 dark:text-red-400"
            borderColor="border-slate-200/50 dark:border-slate-700/50"
            hoverBorderColor="hover:border-red-300/50 dark:hover:border-red-600/50"
          />
          <GradientStatsCard
            title="Investigating"
            value={(allSignals as DemoSignal[]).filter(s => s.status === 'investigating').length}
            icon={
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
            gradientFrom="from-yellow-600"
            gradientTo="to-amber-600"
            iconBg="bg-gradient-to-r from-yellow-500/20 to-amber-500/20"
            iconColor="text-yellow-600 dark:text-yellow-400"
            borderColor="border-slate-200/50 dark:border-slate-700/50"
            hoverBorderColor="hover:border-yellow-300/50 dark:hover:border-yellow-600/50"
          />
          <GradientStatsCard
            title="Resolved"
            value={(allSignals as DemoSignal[]).filter(s => s.status === 'resolved').length}
            icon={
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            gradientFrom="from-emerald-600"
            gradientTo="to-green-600"
            iconBg="bg-gradient-to-r from-emerald-500/20 to-green-500/20"
            iconColor="text-emerald-600 dark:text-emerald-400"
            borderColor="border-slate-200/50 dark:border-slate-700/50"
            hoverBorderColor="hover:border-emerald-300/50 dark:hover:border-emerald-600/50"
          />
        </div>

        {/* Filters */}
        <StyledCard className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search signals..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="false-positive">False Positive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </StyledCard>

        {/* Signals Table */}
        <StyledCard>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Signals</span>
              <Badge variant="secondary">
                {filteredSignals.length} {filteredSignals.length === 1 ? 'signal' : 'signals'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredSignals.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No signals found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                    ? 'Try adjusting your filters to see more results.'
                    : 'No signals detected. Your systems are secure.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
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
                    {filteredSignals.map((signal) => (
                      <TableRow
                        key={signal.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={(e) => {
                          if (!(e.target as HTMLElement).closest('button')) {
                            navigate({
                              to: '/signals/$id',
                              params: { id: signal.id }
                            })
                          }
                        }}
                      >
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
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate({
                                  to: '/signals/$id',
                                  params: { id: signal.id }
                                })
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {signal.status === 'open' && canAccess('signals:write') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStatusChange(signal, 'investigate')
                                }}
                              >
                                Investigate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </StyledCard>
        </main>
      </div>
    </Layout>
  )
}