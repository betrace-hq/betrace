import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { SeverityBadge } from '@/components/ui/severity-badge'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/lib/auth/auth-context'
import {
  useSignal,
  useInvestigateSignal,
  useResolveSignal,
  useMarkFalsePositive,
  useAddSignalNotes
} from '@/lib/hooks/use-signals'
import {
  ArrowLeft,
  Calendar,
  FileText,
  MessageSquare,
  Shield,
  Activity,
  Database,
  AlertTriangle,
  Hash,
  Layers,
  TrendingUp
} from 'lucide-react'
import { DemoApiService, DemoSignal } from '@/lib/api/demo-api'
import { useWebSocket } from '@/lib/hooks/use-websocket'
import { InvestigationTimeline, type TimelineEvent } from './investigation-timeline'
import { ConnectionStatus } from '@/components/common/connection-status'
import { PriorityScoring } from './priority-scoring'
import { SignalCollaboration } from './signal-collaboration'
import { MetadataGrid } from '@/components/ui/metadata-grid'
import { TechnicalContext } from '@/components/ui/technical-context'
import { SignalActions } from '@/components/ui/signal-actions'
import { RelatedSignals } from '@/components/ui/related-signals'

export function SignalDetailPage() {
  const navigate = useNavigate()
  const { user, canAccess, isDemoMode } = useAuth()
  const { id } = useParams({ from: '/signals/$id' })
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

  const handleAddNote = async (noteContent: string) => {
    if (!noteContent.trim() || !canAccess('signals:write')) return

    try {
      if (isDemoMode) {
        // In demo mode, just add to local state
        const note = {
          id: `note-${Date.now()}`,
          content: noteContent.trim(),
          author: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown User',
          timestamp: new Date().toISOString(),
        }
        setNotes(prev => [...prev, note])

        // Also add to timeline
        const newEvent: TimelineEvent = {
          id: `event-${Date.now()}`,
          type: 'note_added',
          title: 'Note Added',
          description: noteContent.trim(),
          author: {
            id: 'current-user',
            name: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown User'
          },
          timestamp: new Date().toISOString()
        }
        setTimelineEvents(prev => [...prev, newEvent])
      } else {
        await addNotes.mutateAsync({ id, notes: noteContent.trim() })
        refetch()
      }
    } catch (error) {
      console.error('Failed to add note:', error)
      alert('Failed to add note. Please try again.')
    }
  }

  if (isLoading) {
    return <LoadingState fullScreen message="Loading signal details..." />
  }

  if (error || !typedSignal) {
    return (
      <ErrorState
        fullScreen
        title="Signal Not Found"
        message="The signal you're looking for doesn't exist or you don't have access to it."
        onRetry={() => navigate({ to: '/signals', search: { status: '', severity: '', service: '', page: 1, limit: 20 } })}
      />
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/signals', search: { status: '', severity: '', service: '', page: 1, limit: 20 } })}
            className="mb-6"
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
                <SeverityBadge severity={typedSignal.severity} />
                <StatusBadge status={typedSignal.status} />
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
                <CardContent>
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">Description</h4>
                    <p className="text-gray-900 dark:text-gray-100">
                      {typedSignal.description}
                    </p>
                  </div>

                  <MetadataGrid
                    items={[
                      {
                        label: 'Signal ID',
                        value: typedSignal.id,
                        icon: Hash,
                        mono: true,
                      },
                      {
                        label: 'Rule Triggered',
                        value: typedSignal.rule_name || 'Behavioral Detection Rule',
                        icon: Shield,
                      },
                      {
                        label: 'Confidence Score',
                        value: (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contextData.confidence_score}%</span>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                              <div
                                className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full"
                                style={{ width: `${contextData.confidence_score}%` }}
                              />
                            </div>
                          </div>
                        ),
                      },
                      {
                        label: 'Impact',
                        value: typedSignal.impact || 'Service Disruption',
                        badge: 'outline',
                      },
                      {
                        label: 'Service',
                        value: typedSignal.service,
                        icon: Database,
                      },
                      {
                        label: 'Detected At',
                        value: new Date(typedSignal.timestamp).toLocaleString(),
                        icon: Calendar,
                      },
                      ...(typedSignal.tags && typedSignal.tags.length > 0 ? [{
                        label: 'Tags',
                        value: (
                          <div className="flex flex-wrap gap-2">
                            {typedSignal.tags.map((tag: string, index: number) => (
                              <span
                                key={index}
                                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ),
                        fullWidth: true,
                      }] : []),
                    ]}
                    columns={2}
                  />
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
                  <TechnicalContext
                    traceId={contextData.trace_id}
                    correlationId={contextData.correlation_id}
                    spanId={contextData.span_id}
                    metadata={{
                      source_ip: contextData.source_ip,
                      request_method: contextData.request_method,
                      endpoint: contextData.endpoint,
                      response_code: contextData.response_code,
                      user_agent: contextData.user_agent,
                    }}
                    tracingUrl={`https://jaeger.example.com/trace/${contextData.trace_id}`}
                  />
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

              {/* Team Collaboration */}
              <SignalCollaboration signal={typedSignal} />

              {/* Actions Card */}
              <Card className="border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SignalActions
                    status={typedSignal.status as 'open' | 'investigating' | 'resolved' | 'false-positive'}
                    canEdit={canAccess('signals:write')}
                    onStatusChange={handleStatusChange}
                    onAddNote={handleAddNote}
                  />
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
                  <RelatedSignals
                    signals={[
                      {
                        id: 'signal-002',
                        title: 'Failed Login Attempts',
                        service: typedSignal.service,
                        severity: 'HIGH',
                        status: 'investigating',
                        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                        relation: 'same-service',
                      },
                      {
                        id: 'signal-003',
                        title: 'Port Scanning Activity',
                        service: 'Network Service',
                        severity: 'MEDIUM',
                        status: 'open',
                        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                        relation: 'time-correlation',
                      },
                    ]}
                    limit={3}
                  />
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