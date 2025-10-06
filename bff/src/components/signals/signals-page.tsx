import { useState, useEffect } from 'react'
import { useNavigate, useSearch, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Filter,
  Eye,
  Wifi,
  WifiOff,
  AlertTriangle,
  Shield,
  Activity,
  TrendingUp,
  RefreshCw,
  CheckSquare
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'
import { useWebSocket } from '@/lib/hooks/use-websocket'
import { ConnectionStatus } from '@/components/common/connection-status'
import { ExportSignals } from './export-signals'
import { BulkActions } from './bulk-actions'
import { SignalCorrelation } from './signal-correlation'
import { PriorityScoring } from './priority-scoring'
import { SignalNotifications } from './signal-notifications'
import { SignalMetricsDashboard } from './signal-metrics-dashboard'
import { SignalPlaybookAutomation } from './signal-playbook-automation'
import { EnhancedSignalSearch } from './enhanced-signal-search'
import { SignalDataVisualization } from './signal-data-visualization'
import { SignalThreatIntelligence } from './signal-threat-intelligence'
import { SignalExportReporting } from './signal-export-reporting'
import { SignalMLInsights } from './signal-ml-insights'

export function SignalsPage() {
  const navigate = useNavigate()
  const { user, canAccess } = useAuth()
  const search = useSearch({ from: '/signals' })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(search.status || 'active')
  const [severityFilter, setSeverityFilter] = useState(search.severity || 'all')
  const [isFiltering, setIsFiltering] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<any[]>([])
  const [selectedSignals, setSelectedSignals] = useState<string[]>([])
  const [signalGroups, setSignalGroups] = useState<any[]>([])
  const [wsConnected, setWsConnected] = useState(false)

  // Initialize WebSocket for real-time updates
  const { isConnected } = useWebSocket({
    autoConnect: true,
    onConnect: () => {
      console.log('WebSocket connected - real-time updates enabled')
      setWsConnected(true)
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected - real-time updates paused')
      setWsConnected(false)
    },
    onError: (error) => {
      console.error('WebSocket error:', error)
      setWsConnected(false)
    }
  })

  // Use TanStack Query for server state
  const { data: allSignals = [], isPending: isLoading, error, refetch } = useSignals({
    status: statusFilter === 'active' ? undefined : (statusFilter === 'all' ? undefined : [statusFilter as any]),
    severity: severityFilter === 'all' ? undefined : [severityFilter as any],
  })

  // Signal mutation hooks
  const investigateSignal = useInvestigateSignal()
  const resolveSignal = useResolveSignal()
  const markFalsePositive = useMarkFalsePositive()

  // Sync filters with URL search parameters
  useEffect(() => {
    setStatusFilter(search.status || 'active')
    setSeverityFilter(search.severity || 'all')
  }, [search.status, search.severity])

  // Generic filter change handlers with dimming effect
  const handleStatusFilterChange = (value: string) => {
    setIsFiltering(true)
    setStatusFilter(value)
    setTimeout(() => setIsFiltering(false), 200)
  }

  const handleSeverityFilterChange = (value: string) => {
    setIsFiltering(true)
    setSeverityFilter(value)
    setTimeout(() => setIsFiltering(false), 200)
  }

  // Advanced filter handling
  const handleAdvancedSearch = (filters: any[]) => {
    setAdvancedFilters(filters)
    setIsFiltering(true)
    setTimeout(() => setIsFiltering(false), 200)
  }

  const handleClearAdvancedSearch = () => {
    setAdvancedFilters([])
  }

  // Enhanced search handlers
  const handleEnhancedSearch = (filters: any[]) => {
    setAdvancedFilters(filters)
  }

  const handleClearEnhancedSearch = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setSeverityFilter('all')
    setAdvancedFilters([])
  }

  // Bulk action handler
  const handleBulkAction = async (action: string, signalIds: string[]) => {
    if (!canAccess('signals:write')) {
      alert('You do not have permission to modify signals')
      return
    }

    try {
      // In a real app, this would make API calls to update multiple signals
      switch (action) {
        case 'investigate':
          await Promise.all(signalIds.map(id => investigateSignal.mutateAsync({ id, notes: `Bulk investigation started by ${user?.firstName} ${user?.lastName}` })))
          break
        case 'resolve':
          await Promise.all(signalIds.map(id => resolveSignal.mutateAsync({ id, notes: `Bulk resolved by ${user?.firstName} ${user?.lastName}` })))
          break
        case 'false_positive':
          await Promise.all(signalIds.map(id => markFalsePositive.mutateAsync({ id, notes: `Bulk marked as false positive by ${user?.firstName} ${user?.lastName}` })))
          break
        case 'assign':
          // Would open assignment dialog in real app
          alert('Assignment functionality would be implemented here')
          break
        case 'archive':
          // Would implement archiving
          alert('Archive functionality would be implemented here')
          break
        case 'delete':
          // Would implement deletion
          alert('Delete functionality would be implemented here')
          break
        default:
          throw new Error(`Unknown bulk action: ${action}`)
      }

      // Refresh data after bulk action
      refetch()
    } catch (error) {
      console.error('Bulk action failed:', error)
      alert('Bulk action failed. Please try again.')
    }
  }

  // Signal group management
  const handleGroupCreate = (group: any) => {
    setSignalGroups([...signalGroups, group])
    alert(`Signal group "${group.name}" created successfully!`)
  }

  const handleGroupUpdate = (groupId: string, updates: any) => {
    setSignalGroups(signalGroups.map(group =>
      group.id === groupId ? { ...group, ...updates } : group
    ))
  }

  // Apply advanced filters to a signal
  const matchesAdvancedFilters = (signal: DemoSignal) => {
    return advancedFilters.every(filter => {
      const fieldValue = (signal as any)[filter.field]?.toString().toLowerCase() || ''
      const filterValue = filter.value.toLowerCase()

      switch (filter.operator) {
        case 'contains':
          return fieldValue.includes(filterValue)
        case 'equals':
          return fieldValue === filterValue
        case 'starts_with':
          return fieldValue.startsWith(filterValue)
        case 'ends_with':
          return fieldValue.endsWith(filterValue)
        case 'not_equals':
          return fieldValue !== filterValue
        case 'on':
          return new Date(signal.timestamp).toDateString() === new Date(filter.value).toDateString()
        case 'before':
          return new Date(signal.timestamp) < new Date(filter.value)
        case 'after':
          return new Date(signal.timestamp) > new Date(filter.value)
        default:
          return true
      }
    })
  }

  // Filter signals based on search term, status, and advanced filters
  const filteredSignals = (allSignals as DemoSignal[]).filter((signal: DemoSignal) => {
    // Search term filter
    const matchesSearch = signal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signal.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signal.description.toLowerCase().includes(searchTerm.toLowerCase())

    // Only handle 'active' status filter client-side, others are handled server-side
    const matchesStatus = statusFilter === 'active'
      ? (signal.status === 'open' || signal.status === 'investigating')
      : true

    // Advanced filters
    const matchesAdvanced = matchesAdvancedFilters(signal)

    return matchesSearch && matchesStatus && matchesAdvanced
  })

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: {
        label: 'Open',
        className: 'bg-red-500 text-white border-red-600',
        icon: AlertCircle,
      },
      investigating: {
        label: 'Investigating',
        className: 'bg-amber-500 text-white border-amber-600',
        icon: Clock,
      },
      resolved: {
        label: 'Resolved',
        className: 'bg-emerald-500 text-white border-emerald-600',
        icon: CheckCircle,
      },
      'false-positive': {
        label: 'False Positive',
        className: 'bg-gray-500 text-white border-gray-600',
        icon: CheckCircle,
      }
    } as const

    const normalizedStatus = status as keyof typeof statusConfig
    const config = statusConfig[normalizedStatus] || statusConfig.open
    const Icon = config.icon

    return (
      <Badge className={`${config.className} px-2 py-1 text-xs font-medium border`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      CRITICAL: { className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800', icon: AlertTriangle },
      HIGH: { className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800', icon: AlertCircle },
      MEDIUM: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800', icon: Shield },
      LOW: { className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800', icon: Activity },
    } as const

    const normalizedSeverity = severity.toUpperCase() as keyof typeof severityConfig
    const config = severityConfig[normalizedSeverity] || severityConfig.LOW
    const Icon = config.icon

    return (
      <Badge variant="outline" className={`${config.className} border px-2 py-1 text-xs font-medium`}>
        <Icon className="w-3 h-3 mr-1" />
        {severity}
      </Badge>
    )
  }

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Security Signals</h1>
              <p className="text-gray-600 dark:text-gray-400">Monitor and manage behavioral anomalies detected by FLUO</p>
            </div>
            <div className="flex items-center gap-3">
              <ConnectionStatus size="sm" />
              <SignalPlaybookAutomation />
              <SignalMetricsDashboard signals={filteredSignals} />
              <SignalNotifications />
              <SignalCorrelation
                signals={filteredSignals}
                onGroupCreate={handleGroupCreate}
                onGroupUpdate={handleGroupUpdate}
              />
              <ExportSignals
                signals={filteredSignals}
                filteredCount={filteredSignals.length}
                totalCount={allSignals.length}
              />
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
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-gray-200 dark:border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Signals</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{allSignals.length}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-lg">
                  <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Open</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {(allSignals as DemoSignal[]).filter(s => s.status === 'open').length}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-950 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Investigating</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {(allSignals as DemoSignal[]).filter(s => s.status === 'investigating').length}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-950 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {(allSignals as DemoSignal[]).filter(s => s.status === 'resolved').length}
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Visualization Dashboard */}
        <div className="mb-6">
          <SignalDataVisualization />
        </div>

        {/* Export and Reporting */}
        <div className="mb-6">
          <SignalExportReporting signals={filteredSignals} />
        </div>

        {/* ML-Powered Intelligence */}
        <div className="mb-6">
          <SignalMLInsights signals={filteredSignals} />
        </div>

        {/* Filters Card */}
        <Card className="mb-6 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
              {/* Real-time Status */}
              <div className="flex items-center gap-2">
                {wsConnected ? (
                  <>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Live</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Offline</span>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Enhanced Search */}
              <EnhancedSignalSearch
                onSearch={handleEnhancedSearch}
                onClear={handleClearEnhancedSearch}
                signals={allSignals as DemoSignal[]}
              />

              {advancedFilters.length > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {advancedFilters.length} advanced filter{advancedFilters.length > 1 ? 's' : ''} active
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signals Table */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <div className="space-y-4">
              <CardTitle className="flex items-center justify-between">
                <span>Active Signals</span>
                <Badge variant="secondary" className="ml-2">
                  {filteredSignals.length} {filteredSignals.length === 1 ? 'signal' : 'signals'}
                </Badge>
              </CardTitle>

              {/* Bulk Actions */}
              {filteredSignals.length > 0 && (
                <BulkActions
                  signals={filteredSignals}
                  selectedSignals={selectedSignals}
                  onSelectionChange={setSelectedSignals}
                  onBulkAction={handleBulkAction}
                  canAccess={canAccess}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredSignals.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No signals found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || (statusFilter !== 'active') || (severityFilter !== 'all')
                    ? 'Try adjusting your filters to see more results.'
                    : 'No active signals detected. Your systems are secure.'}
                </p>
              </div>
            ) : (
              <div className={`overflow-x-auto transition-opacity duration-200 ${isFiltering ? 'opacity-50' : 'opacity-100'}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Priority</TableHead>
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
                        <TableCell>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const isSelected = selectedSignals.includes(signal.id)
                              if (isSelected) {
                                setSelectedSignals(selectedSignals.filter(id => id !== signal.id))
                              } else {
                                setSelectedSignals([...selectedSignals, signal.id])
                              }
                            }}
                            className="flex items-center justify-center w-5 h-5 border border-gray-300 dark:border-gray-600 rounded transition-colors hover:border-gray-400 dark:hover:border-gray-500"
                          >
                            {selectedSignals.includes(signal.id) && (
                              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>{getStatusBadge(signal.status)}</TableCell>
                        <TableCell>{getSeverityBadge(signal.severity)}</TableCell>
                        <TableCell>
                          <PriorityScoring signal={signal} compact={true} />
                        </TableCell>
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
        </Card>
      </main>
    </div>
  )
}