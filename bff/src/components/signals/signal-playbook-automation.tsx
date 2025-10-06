import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
  Play,
  Pause,
  Settings,
  Plus,
  Edit,
  Trash2,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  GitBranch,
  Shield,
  AlertTriangle,
  Users,
  Mail,
  MessageSquare,
  Database,
  Server,
  Eye,
  ArrowRight,
  Bot
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface PlaybookAction {
  id: string
  type: 'notification' | 'ticket' | 'containment' | 'investigation' | 'enrichment' | 'escalation'
  name: string
  description: string
  config: Record<string, any>
  timeout_seconds: number
  retry_count: number
  continue_on_failure: boolean
}

interface PlaybookRule {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger_conditions: {
    severity: string[]
    services: string[]
    keywords: string[]
    priority_threshold: number
    signal_types: string[]
  }
  actions: PlaybookAction[]
  execution_mode: 'sequential' | 'parallel' | 'conditional'
  cooldown_minutes: number
  created_at: string
  last_executed?: string
  execution_count: number
  success_rate: number
}

interface PlaybookExecution {
  id: string
  playbook_id: string
  signal_id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at?: string
  actions_completed: number
  total_actions: number
  error_message?: string
  execution_log: string[]
}

interface SignalPlaybookAutomationProps {
  signal?: DemoSignal
  className?: string
}

export function SignalPlaybookAutomation({ signal, className }: SignalPlaybookAutomationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'playbooks' | 'executions' | 'create'>('playbooks')
  const [playbooks, setPlaybooks] = useState<PlaybookRule[]>([])
  const [executions, setExecutions] = useState<PlaybookExecution[]>([])
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookRule | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Mock playbook rules
  const mockPlaybooks: PlaybookRule[] = [
    {
      id: 'pb-1',
      name: 'Critical Security Incident Response',
      description: 'Automated response for critical security incidents requiring immediate action',
      enabled: true,
      trigger_conditions: {
        severity: ['CRITICAL'],
        services: [],
        keywords: ['breach', 'compromise', 'unauthorized access'],
        priority_threshold: 85,
        signal_types: ['behavioral_anomaly', 'security_violation']
      },
      actions: [
        {
          id: 'action-1',
          type: 'notification',
          name: 'Immediate Alert',
          description: 'Send immediate notification to security team',
          config: {
            channels: ['email', 'sms', 'slack'],
            recipients: ['security-team@company.com', '+1-555-0123', '#security-critical'],
            template: 'critical_incident'
          },
          timeout_seconds: 30,
          retry_count: 3,
          continue_on_failure: true
        },
        {
          id: 'action-2',
          type: 'ticket',
          name: 'Create High Priority Ticket',
          description: 'Create high priority incident ticket',
          config: {
            system: 'jira',
            project: 'SEC',
            priority: 'Highest',
            assignee: 'security-lead'
          },
          timeout_seconds: 60,
          retry_count: 2,
          continue_on_failure: false
        },
        {
          id: 'action-3',
          type: 'containment',
          name: 'Isolate Affected Resources',
          description: 'Automatically isolate potentially compromised resources',
          config: {
            action: 'network_isolation',
            scope: 'source_ip',
            duration_minutes: 60
          },
          timeout_seconds: 120,
          retry_count: 1,
          continue_on_failure: false
        }
      ],
      execution_mode: 'sequential',
      cooldown_minutes: 10,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      last_executed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      execution_count: 15,
      success_rate: 93.3
    },
    {
      id: 'pb-2',
      name: 'Authentication Anomaly Investigation',
      description: 'Automated investigation workflow for authentication-related anomalies',
      enabled: true,
      trigger_conditions: {
        severity: ['HIGH', 'CRITICAL'],
        services: ['auth-service', 'user-service'],
        keywords: ['login', 'authentication', 'brute force', 'suspicious'],
        priority_threshold: 70,
        signal_types: ['authentication_anomaly']
      },
      actions: [
        {
          id: 'action-4',
          type: 'enrichment',
          name: 'Gather User Context',
          description: 'Collect additional context about the user and login attempts',
          config: {
            data_sources: ['user_directory', 'login_history', 'geolocation'],
            lookback_hours: 24
          },
          timeout_seconds: 45,
          retry_count: 2,
          continue_on_failure: true
        },
        {
          id: 'action-5',
          type: 'investigation',
          name: 'Risk Assessment',
          description: 'Perform automated risk assessment',
          config: {
            risk_factors: ['location', 'device', 'time_of_day', 'access_patterns'],
            threshold: 0.7
          },
          timeout_seconds: 30,
          retry_count: 1,
          continue_on_failure: false
        },
        {
          id: 'action-6',
          type: 'notification',
          name: 'Notify Security Team',
          description: 'Send detailed investigation results to security team',
          config: {
            channels: ['email', 'slack'],
            recipients: ['auth-team@company.com', '#auth-alerts'],
            include_context: true
          },
          timeout_seconds: 30,
          retry_count: 2,
          continue_on_failure: true
        }
      ],
      execution_mode: 'sequential',
      cooldown_minutes: 30,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_executed: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      execution_count: 42,
      success_rate: 88.1
    },
    {
      id: 'pb-3',
      name: 'Data Exfiltration Response',
      description: 'Comprehensive response to potential data exfiltration attempts',
      enabled: false,
      trigger_conditions: {
        severity: ['MEDIUM', 'HIGH', 'CRITICAL'],
        services: ['api-gateway', 'data-service'],
        keywords: ['download', 'export', 'transfer', 'exfiltration'],
        priority_threshold: 60,
        signal_types: ['data_anomaly', 'behavioral_anomaly']
      },
      actions: [
        {
          id: 'action-7',
          type: 'enrichment',
          name: 'Analyze Data Access',
          description: 'Analyze recent data access patterns',
          config: {
            time_window_hours: 6,
            data_types: ['sensitive', 'confidential'],
            access_patterns: ['bulk_download', 'unusual_queries']
          },
          timeout_seconds: 60,
          retry_count: 1,
          continue_on_failure: false
        },
        {
          id: 'action-8',
          type: 'containment',
          name: 'Restrict Data Access',
          description: 'Temporarily restrict access to sensitive data',
          config: {
            action: 'data_access_restriction',
            scope: 'user_session',
            duration_minutes: 120
          },
          timeout_seconds: 90,
          retry_count: 1,
          continue_on_failure: false
        },
        {
          id: 'action-9',
          type: 'escalation',
          name: 'Escalate to DPO',
          description: 'Escalate to Data Protection Officer',
          config: {
            escalation_level: 'executive',
            recipients: ['dpo@company.com', 'legal@company.com'],
            urgency: 'high'
          },
          timeout_seconds: 300,
          retry_count: 3,
          continue_on_failure: true
        }
      ],
      execution_mode: 'conditional',
      cooldown_minutes: 60,
      created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      execution_count: 8,
      success_rate: 75.0
    }
  ]

  // Mock execution history
  const mockExecutions: PlaybookExecution[] = [
    {
      id: 'exec-1',
      playbook_id: 'pb-1',
      signal_id: 'signal-123',
      status: 'completed',
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + 180000).toISOString(),
      actions_completed: 3,
      total_actions: 3,
      execution_log: [
        'Started playbook execution',
        'Action 1: Immediate Alert - SUCCESS',
        'Action 2: Create High Priority Ticket - SUCCESS',
        'Action 3: Isolate Affected Resources - SUCCESS',
        'Playbook execution completed successfully'
      ]
    },
    {
      id: 'exec-2',
      playbook_id: 'pb-2',
      signal_id: 'signal-124',
      status: 'running',
      started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      actions_completed: 2,
      total_actions: 3,
      execution_log: [
        'Started playbook execution',
        'Action 1: Gather User Context - SUCCESS',
        'Action 2: Risk Assessment - SUCCESS',
        'Action 3: Notify Security Team - IN PROGRESS'
      ]
    },
    {
      id: 'exec-3',
      playbook_id: 'pb-1',
      signal_id: 'signal-125',
      status: 'failed',
      started_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 6 * 60 * 60 * 1000 + 90000).toISOString(),
      actions_completed: 1,
      total_actions: 3,
      error_message: 'Failed to create incident ticket - JIRA service unavailable',
      execution_log: [
        'Started playbook execution',
        'Action 1: Immediate Alert - SUCCESS',
        'Action 2: Create High Priority Ticket - FAILED: JIRA service unavailable',
        'Playbook execution stopped due to critical action failure'
      ]
    }
  ]

  useEffect(() => {
    setPlaybooks(mockPlaybooks)
    setExecutions(mockExecutions)
  }, [])

  const togglePlaybook = (playbookId: string) => {
    setPlaybooks(playbooks.map(pb =>
      pb.id === playbookId
        ? { ...pb, enabled: !pb.enabled }
        : pb
    ))
  }

  const executePlaybook = (playbookId: string) => {
    const playbook = playbooks.find(pb => pb.id === playbookId)
    if (!playbook || !signal) return

    const newExecution: PlaybookExecution = {
      id: `exec-${Date.now()}`,
      playbook_id: playbookId,
      signal_id: signal.id,
      status: 'running',
      started_at: new Date().toISOString(),
      actions_completed: 0,
      total_actions: playbook.actions.length,
      execution_log: ['Started playbook execution']
    }

    setExecutions([newExecution, ...executions])
    alert(`Playbook "${playbook.name}" execution started for signal ${signal.id}`)
  }

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case 'notification': return <Mail className="w-4 h-4" />
      case 'ticket': return <MessageSquare className="w-4 h-4" />
      case 'containment': return <Shield className="w-4 h-4" />
      case 'investigation': return <Eye className="w-4 h-4" />
      case 'enrichment': return <Database className="w-4 h-4" />
      case 'escalation': return <AlertTriangle className="w-4 h-4" />
      default: return <Settings className="w-4 h-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Clock className="w-3 h-3 mr-1" />Running</Badge>
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const getExecutionDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : Date.now()
    const durationMs = endTime - startTime
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className={className}>
            <Bot className="w-4 h-4 mr-2" />
            Playbook Automation
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Signal Playbook Automation</DialogTitle>
            <DialogDescription>
              Automated response workflows for security signals with configurable actions and conditions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Tab Navigation */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('playbooks')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'playbooks'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Playbooks ({playbooks.length})
              </button>
              <button
                onClick={() => setActiveTab('executions')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'executions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Executions ({executions.length})
              </button>
            </div>

            {/* Playbooks Tab */}
            {activeTab === 'playbooks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Automation Playbooks</h3>
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Playbook
                  </Button>
                </div>

                <div className="grid gap-4">
                  {playbooks.map(playbook => (
                    <Card key={playbook.id} className={`border ${playbook.enabled ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <Bot className={`w-5 h-5 ${playbook.enabled ? 'text-green-600' : 'text-gray-400'}`} />
                                <h4 className="font-semibold">{playbook.name}</h4>
                              </div>
                              <Switch
                                checked={playbook.enabled}
                                onCheckedChange={() => togglePlaybook(playbook.id)}
                              />
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{playbook.description}</p>

                            {/* Trigger Conditions */}
                            <div className="mb-4">
                              <Label className="text-xs font-medium text-gray-500">Trigger Conditions</Label>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {playbook.trigger_conditions.severity.map(severity => (
                                  <Badge key={severity} variant="outline" className="text-xs">
                                    {severity}
                                  </Badge>
                                ))}
                                <Badge variant="outline" className="text-xs">
                                  Priority ≥ {playbook.trigger_conditions.priority_threshold}
                                </Badge>
                              </div>
                            </div>

                            {/* Actions Preview */}
                            <div className="mb-4">
                              <Label className="text-xs font-medium text-gray-500">Actions ({playbook.actions.length})</Label>
                              <div className="mt-1 flex items-center gap-2">
                                {playbook.actions.slice(0, 3).map((action, index) => (
                                  <div key={action.id} className="flex items-center gap-1">
                                    {index > 0 && <ArrowRight className="w-3 h-3 text-gray-400" />}
                                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                                      {getActionTypeIcon(action.type)}
                                      <span className="capitalize">{action.type}</span>
                                    </div>
                                  </div>
                                ))}
                                {playbook.actions.length > 3 && (
                                  <span className="text-xs text-gray-500">+{playbook.actions.length - 3} more</span>
                                )}
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="flex gap-6 text-xs text-gray-500">
                              <span>Executions: {playbook.execution_count}</span>
                              <span>Success Rate: {playbook.success_rate.toFixed(1)}%</span>
                              <span>Cooldown: {playbook.cooldown_minutes}min</span>
                              {playbook.last_executed && (
                                <span>Last Run: {formatTimestamp(playbook.last_executed)}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {signal && playbook.enabled && (
                              <Button
                                size="sm"
                                onClick={() => executePlaybook(playbook.id)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Execute
                              </Button>
                            )}
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Executions Tab */}
            {activeTab === 'executions' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Execution History</h3>
                  <div className="flex gap-2">
                    <Select defaultValue="all">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  {executions.map(execution => {
                    const playbook = playbooks.find(pb => pb.id === execution.playbook_id)
                    return (
                      <Card key={execution.id} className="border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Bot className="w-5 h-5 text-blue-600" />
                                <div>
                                  <h4 className="font-semibold">{playbook?.name || 'Unknown Playbook'}</h4>
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span>Signal: {execution.signal_id}</span>
                                    <span>•</span>
                                    <span>Started: {formatTimestamp(execution.started_at)}</span>
                                    <span>•</span>
                                    <span>Duration: {getExecutionDuration(execution.started_at, execution.completed_at)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mb-3">
                                {getStatusBadge(execution.status)}
                                <div className="text-sm">
                                  Progress: {execution.actions_completed}/{execution.total_actions} actions
                                </div>
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${(execution.actions_completed / execution.total_actions) * 100}%` }}
                                  />
                                </div>
                              </div>

                              {execution.error_message && (
                                <div className="text-sm text-red-600 mb-2">
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  {execution.error_message}
                                </div>
                              )}

                              <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                                <Label className="text-xs font-medium text-gray-500">Execution Log</Label>
                                <div className="mt-1 space-y-1">
                                  {execution.execution_log.map((log, index) => (
                                    <div key={index} className="text-xs font-mono text-gray-700 dark:text-gray-300">
                                      {log}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              {execution.status === 'running' && (
                                <Button variant="outline" size="sm">
                                  <Pause className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}