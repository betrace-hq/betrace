import { useState, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { StyledCard, CardContent, CardHeader, CardTitle } from '@/components/ui/styled-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { SeverityBadge } from '@/components/ui/severity-badge'
import { StatsCard } from '@/components/ui/stats-card'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SortableColumn, type SortDirection } from '@/components/ui/sortable-column'
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
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

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

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Cycle through: null -> asc -> desc -> null
      if (sortDirection === null) {
        setSortDirection('asc')
      } else if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortDirection(null)
        setSortColumn(null)
      }
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Filter and sort signals
  const filteredSignals = (allSignals as DemoSignal[])
    .filter((signal: DemoSignal) => {
      const matchesSearch = signal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signal.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signal.description.toLowerCase().includes(searchTerm.toLowerCase())

      return matchesSearch
    })
    .sort((a, b) => {
      if (!sortColumn || !sortDirection) return 0

      const getValue = (signal: DemoSignal, column: string) => {
        switch (column) {
          case 'status':
            return signal.status
          case 'severity':
            const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
            return severityOrder[signal.severity as keyof typeof severityOrder] || 0
          case 'service':
            return signal.service
          case 'title':
            return signal.title
          case 'time':
            return new Date(signal.timestamp).getTime()
          default:
            return ''
        }
      }

      const aVal = getValue(a, sortColumn)
      const bVal = getValue(b, sortColumn)

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
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
    return <LoadingState fullScreen message="Loading signals..." />
  }

  if (error) {
    return (
      <ErrorState
        fullScreen
        title="Error Loading Signals"
        message="Failed to load signals. Please try again."
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
          <StatsCard
            title="Total Signals"
            value={String(allSignals.length)}
            icon={Activity}
            iconColor="blue"
          />
          <StatsCard
            title="Open"
            value={String((allSignals as DemoSignal[]).filter(s => s.status === 'open').length)}
            icon={AlertCircle}
            iconColor="red"
            valueColor="text-red-600 dark:text-red-400"
          />
          <StatsCard
            title="Investigating"
            value={String((allSignals as DemoSignal[]).filter(s => s.status === 'investigating').length)}
            icon={Clock}
            iconColor="amber"
            valueColor="text-amber-600 dark:text-amber-400"
          />
          <StatsCard
            title="Resolved"
            value={String((allSignals as DemoSignal[]).filter(s => s.status === 'resolved').length)}
            icon={CheckCircle}
            iconColor="emerald"
            valueColor="text-emerald-600 dark:text-emerald-400"
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
              <EmptyState
                icon={Shield}
                title="No signals found"
                description={
                  searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                    ? 'Try adjusting your filters to see more results.'
                    : 'No signals detected. Your systems are secure.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                      <SortableColumn
                        sortDirection={sortColumn === 'status' ? sortDirection : null}
                        onSort={() => handleSort('status')}
                        className="w-32"
                      >
                        Status
                      </SortableColumn>
                      <SortableColumn
                        sortDirection={sortColumn === 'severity' ? sortDirection : null}
                        onSort={() => handleSort('severity')}
                        className="w-32"
                      >
                        Severity
                      </SortableColumn>
                      <SortableColumn
                        sortDirection={sortColumn === 'service' ? sortDirection : null}
                        onSort={() => handleSort('service')}
                        className="w-40"
                      >
                        Service
                      </SortableColumn>
                      <SortableColumn
                        sortDirection={sortColumn === 'title' ? sortDirection : null}
                        onSort={() => handleSort('title')}
                      >
                        Title
                      </SortableColumn>
                      <SortableColumn sortable={false}>
                        Description
                      </SortableColumn>
                      <SortableColumn
                        sortDirection={sortColumn === 'time' ? sortDirection : null}
                        onSort={() => handleSort('time')}
                        className="w-32"
                      >
                        Time
                      </SortableColumn>
                      <SortableColumn sortable={false} className="text-right w-32">
                        Actions
                      </SortableColumn>
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
                              params: { id: signal.id },
                              search: { status: '', severity: '', service: '', page: 1, limit: 20 }
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
                                  params: { id: signal.id },
                                  search: { status: '', severity: '', service: '', page: 1, limit: 20 }
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