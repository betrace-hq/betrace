import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth/auth-context'
import {
  useSignal,
  useInvestigateSignal,
  useResolveSignal,
  useMarkFalsePositive,
  useAddSignalNotes
} from '@/lib/hooks/use-signals'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowLeft,
  User,
  Calendar,
  FileText,
  MessageSquare,
  Shield,
  Activity,
  Database,
  AlertTriangle,
  CheckCircle2,
  X,
  Server,
  Hash,
  Tag,
  Layers,
  Send,
  ExternalLink,
  TrendingUp
} from 'lucide-react'
import { DemoApiService, DemoSignal } from '@/lib/api/demo-api'
import { useWebSocket } from '@/lib/hooks/use-websocket'
import { InvestigationTimeline, type TimelineEvent } from './investigation-timeline'
import { ConnectionStatus } from '@/components/common/connection-status'
import { PriorityScoring } from './priority-scoring'
import { SignalPlaybookAutomation } from './signal-playbook-automation'
import { SignalThreatIntelligence } from './signal-threat-intelligence'
import { SignalInvestigationWorkflow } from './signal-investigation-workflow'
import { SignalCollaboration } from './signal-collaboration'
import { SignalSOARAutomation } from './signal-soar-automation'

export function SignalDetailPage() {
  const navigate = useNavigate()
  const { user, canAccess, isDemoMode } = useAuth()
  const { id } = useParams({ from: '/signals/$id' })
  const [newNote, setNewNote] = useState('')
  const [notes, setNotes] = useState<Array<{id: string, content: string, author: string, timestamp: string}>>([])
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])

  // Initialize WebSocket for real-time updates on this specific signal
  useWebSocket({
    autoConnect: true,
    onConnect: () => {
      console.log(`WebSocket connected for signal ${id}`)
    },
    onDisconnect: () => {
      console.log(`WebSocket disconnected for signal ${id}`)
    }
  })

  // Fetch signal data
  const { data: signal, isPending: isLoading, error, refetch } = useSignal(id)

  // Type assertion for demo signal data
  const typedSignal = signal as DemoSignal | undefined

  // Signal mutation hooks
  const investigateSignal = useInvestigateSignal()
  const resolveSignal = useResolveSignal()
  const markFalsePositive = useMarkFalsePositive()
  const addNotes = useAddSignalNotes()

  // Mock notes and timeline for demo (in production this would come from the API)
  useEffect(() => {
    if (isDemoMode && typedSignal) {
      const mockNotes = [
        {
          id: 'note-1',
          content: 'Initial triage completed. Reviewing logs and user permissions.',
          author: 'Sarah Chen',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'note-2',
          content: 'Found suspicious pattern in user activity. Escalating to security team.',
          author: 'Mike Johnson',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        }
      ]

      // Create timeline events based on signal status
      const mockTimeline: TimelineEvent[] = [
        {
          id: 'event-1',
          type: 'status_change',
          title: 'Signal Created',
          description: 'Automated detection triggered this signal based on rule evaluation.',
          author: { id: 'system', name: 'FLUO System', role: 'Automated' },
          timestamp: typedSignal.timestamp,
          metadata: {
            newStatus: 'open',
            priority: typedSignal.severity,
            tags: ['automated', 'rule-triggered']
          }
        }
      ]

      if (typedSignal.status === 'investigating' || typedSignal.status === 'resolved' || typedSignal.status === 'false-positive') {
        mockTimeline.push({
          id: 'event-2',
          type: 'assignment',
          title: 'Assigned to Security Team',
          description: 'Signal assigned for investigation',
          author: { id: 'user-1', name: 'Sarah Chen', role: 'Security Lead' },
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          metadata: {
            assignee: 'Security Team',
            previousStatus: 'open',
            newStatus: 'investigating'
          }
        })

        mockNotes.forEach((note, index) => {
          mockTimeline.push({
            id: `event-note-${index}`,
            type: 'note_added',
            title: 'Investigation Note Added',
            description: note.content,
            author: { id: `user-${index}`, name: note.author },
            timestamp: note.timestamp
          })
        })
      }

      if (typedSignal.status === 'resolved') {
        mockTimeline.push({
          id: 'event-resolved',
          type: 'status_change',
          title: 'Signal Resolved',
          description: 'Investigation completed. Threat neutralized and systems secured.',
          author: { id: 'user-2', name: 'Mike Johnson', role: 'Security Analyst' },
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          metadata: {
            previousStatus: 'investigating',
            newStatus: 'resolved',
            tags: ['threat-mitigated', 'security-hardened']
          }
        })
      }

      setNotes(mockNotes)
      setTimelineEvents(mockTimeline)
    }
  }, [isDemoMode, typedSignal])

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: {
        label: 'Open',
        className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
        icon: AlertCircle,
      },
      investigating: {
        label: 'Investigating',
        className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        icon: Clock,
      },
      resolved: {
        label: 'Resolved',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
        icon: CheckCircle,
      },
      'false-positive': {
        label: 'False Positive',
        className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800',
        icon: CheckCircle,
      }
    } as const

    const normalizedStatus = status as keyof typeof statusConfig
    const config = statusConfig[normalizedStatus] || statusConfig.open
    const Icon = config.icon

    return (
      <Badge variant="outline" className={`${config.className} border px-3 py-1.5 text-sm font-semibold`}>
        <Icon className="w-4 h-4 mr-1.5" />
        {config.label}
      </Badge>
    )
  }

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      CRITICAL: { className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800', label: 'Critical' },
      HIGH: { className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800', label: 'High' },
      MEDIUM: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800', label: 'Medium' },
      LOW: { className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800', label: 'Low' },
    } as const

    const normalizedSeverity = severity.toUpperCase() as keyof typeof severityConfig
    const config = severityConfig[normalizedSeverity] || severityConfig.LOW

    return (
      <Badge variant="outline" className={`${config.className} border px-3 py-1.5 text-sm font-semibold`}>
        {config.label}
      </Badge>
    )
  }

  const handleStatusChange = async (action: 'investigate' | 'resolve' | 'false_positive') => {
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
          await investigateSignal.mutateAsync({ id, notes: userNote })
          break
        case 'resolve':
          await resolveSignal.mutateAsync({ id, notes: userNote })
          break
        case 'false_positive':
          await markFalsePositive.mutateAsync({ id, notes: userNote })
          break
      }

      // Refresh signal data
      refetch()
    } catch (error) {
      console.error(`Failed to ${action} signal:`, error)
      alert(`Failed to ${action} signal. Please try again.`)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !canAccess('signals:write')) return

    try {
      if (isDemoMode) {
        // In demo mode, just add to local state
        const note = {
          id: `note-${Date.now()}`,
          content: newNote.trim(),
          author: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown User',
          timestamp: new Date().toISOString(),
        }
        setNotes(prev => [...prev, note])

        // Also add to timeline
        const newEvent: TimelineEvent = {
          id: `event-${Date.now()}`,
          type: 'note_added',
          title: 'Note Added',
          description: newNote.trim(),
          author: {
            id: 'current-user',
            name: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown User'
          },
          timestamp: new Date().toISOString()
        }
        setTimelineEvents(prev => [...prev, newEvent])

        setNewNote('')
      } else {
        await addNotes.mutateAsync({ id, notes: newNote.trim() })
        setNewNote('')
        refetch()
      }
    } catch (error) {
      console.error('Failed to add note:', error)
      alert('Failed to add note. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading signal details...</p>
        </div>
      </div>
    )
  }

  if (error || !typedSignal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Signal Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">The signal you're looking for doesn't exist or you don't have access to it.</p>
          <Button
            onClick={() => navigate({ to: '/signals', search: { status: '', severity: '', service: '', page: 1, limit: 20 } })}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Signals
          </Button>
        </div>
      </div>
    )
  }

  // Mock additional data for demo
  const contextData = typedSignal.metadata || {
    source_ip: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    request_method: 'POST',
    endpoint: '/api/v1/admin/users',
    response_code: 403,
    correlation_id: 'corr-' + typedSignal.id,
    trace_id: 'trace-' + Math.random().toString(36).substr(2, 9),
    span_id: 'span-' + Math.random().toString(36).substr(2, 9),
    rule_triggered: typedSignal.rule_name || 'Suspicious Activity Detection',
    confidence_score: Math.floor(Math.random() * 20) + 80
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50/50 to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/signals', search: { status: '', severity: '', service: '', page: 1, limit: 20 } })}
            className="mb-6 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Signals
          </Button>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                  {typedSignal.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-4 h-4" />
                    {typedSignal.service}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(typedSignal.timestamp).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-4 h-4" />
                    <code className="font-mono text-xs">{typedSignal.id}</code>
                  </span>
                  <ConnectionStatus size="sm" showLabel={false} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getSeverityBadge(typedSignal.severity)}
                {getStatusBadge(typedSignal.status)}
              </div>
            </div>
          </div>
        </div>

        {/* All content visible without tabs */}
        <div className="space-y-6">
          {/* Quick Actions */}
          {typedSignal.status === 'open' && canAccess('signals:write') && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium text-amber-900 dark:text-amber-100">
                    This signal requires attention
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleStatusChange('investigate')}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    size="sm"
                  >
                    Start Investigation
                  </Button>
                  <Button
                    onClick={() => handleStatusChange('false_positive')}
                    variant="outline"
                    size="sm"
                  >
                    Mark False Positive
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Details & Context */}
            <div className="lg:col-span-2 space-y-6">
              {/* Signal Details */}
              <Card className="border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    Signal Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">Description</h4>
                    <p className="text-gray-900 dark:text-gray-100">
                      {typedSignal.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 mb-1">Signal ID</h4>
                      <p className="font-mono text-sm">{typedSignal.id}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 mb-1">Rule Triggered</h4>
                      <p className="text-sm">{typedSignal.rule_name || 'Behavioral Detection Rule'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 mb-1">Confidence Score</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{contextData.confidence_score}%</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${contextData.confidence_score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 mb-1">Impact</h4>
                      <Badge variant="outline">{typedSignal.impact || 'Service Disruption'}</Badge>
                    </div>
                  </div>

                  {/* Tags */}
                  {typedSignal.tags && typedSignal.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {typedSignal.tags.map((tag: string, index: number) => (
                          <Badge key={index} variant="secondary">
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Technical Context */}
              <Card className="border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    Technical Context
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Source IP</span>
                      <p className="font-mono">{contextData.source_ip}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Request Method</span>
                      <p className="font-mono">{contextData.request_method}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Endpoint</span>
                      <p className="font-mono">{contextData.endpoint}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Response Code</span>
                      <p className="font-mono">{contextData.response_code}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Correlation ID</span>
                      <p className="font-mono text-xs">{contextData.correlation_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Trace ID</span>
                      <p className="font-mono text-xs">{contextData.trace_id}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">User Agent</span>
                      <p className="font-mono text-xs break-all">{contextData.user_agent}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View in Tracing System
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Investigation Timeline */}
              <Card className="border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    Investigation Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InvestigationTimeline
                    events={timelineEvents}
                    onAddNote={(note, type) => {
                      const newEvent: TimelineEvent = {
                        id: `event-${Date.now()}`,
                        type: type === 'action' ? 'action' : 'note_added',
                        title: type === 'action' ? 'Action Taken' : 'Note Added',
                        description: note,
                        author: {
                          id: 'current-user',
                          name: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown User'
                        },
                        timestamp: new Date().toISOString()
                      }
                      setTimelineEvents([...timelineEvents, newEvent])
                    }}
                    canEdit={canAccess('signals:write')}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Actions & Related */}
            <div className="space-y-6">
              {/* Priority Scoring */}
              <PriorityScoring signal={typedSignal} />

              {/* Threat Intelligence */}
              <SignalThreatIntelligence signal={typedSignal} />

              {/* Investigation Workflow */}
              <SignalInvestigationWorkflow signal={typedSignal} />

              {/* Team Collaboration */}
              <SignalCollaboration signal={typedSignal} />

              {/* SOAR Automation */}
              <SignalSOARAutomation signal={typedSignal} />

              {/* Playbook Automation */}
              <SignalPlaybookAutomation signal={typedSignal} />

              {/* Actions Card */}
              <Card className="border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {typedSignal.status === 'investigating' && (
                    <>
                      <Button
                        onClick={() => handleStatusChange('resolve')}
                        className="w-full"
                        variant="default"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Mark as Resolved
                      </Button>
                      <Button
                        onClick={() => handleStatusChange('false_positive')}
                        className="w-full"
                        variant="outline"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Mark as False Positive
                      </Button>
                    </>
                  )}

                  {(typedSignal.status === 'resolved' || typedSignal.status === 'false-positive') && (
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        This signal has been {typedSignal.status === 'resolved' ? 'resolved' : 'marked as false positive'}
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t">
                    <h4 className="text-sm font-medium mb-2">Quick Add Note</h4>
                    <Textarea
                      placeholder="Add a note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="min-h-[80px] mb-2"
                    />
                    <Button
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || !canAccess('signals:write')}
                      className="w-full"
                      size="sm"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Related Signals */}
              <Card className="border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Layers className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    Related Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Failed Login Attempts</span>
                        <Badge variant="outline" className="text-xs">2h ago</Badge>
                      </div>
                      <p className="text-xs text-gray-500">Same source IP detected</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Port Scanning Activity</span>
                        <Badge variant="outline" className="text-xs">5h ago</Badge>
                      </div>
                      <p className="text-xs text-gray-500">Related network segment</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    View All Related ({Math.floor(Math.random() * 5) + 2})
                  </Button>
                </CardContent>
              </Card>

              {/* Metrics */}
              <Card className="border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    Signal Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Detection Time</span>
                      <span className="text-sm font-medium">1.2s</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Time to Acknowledge</span>
                      <span className="text-sm font-medium">
                        {typedSignal.status !== 'open' ? '15m' : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Resolution Time</span>
                      <span className="text-sm font-medium">
                        {typedSignal.status === 'resolved' ? '2h 30m' : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Similar Signals (7d)</span>
                      <span className="text-sm font-medium">3</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}