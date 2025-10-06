import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Zap,
  Bot,
  Play,
  Pause,
  Settings,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Code,
  GitBranch,
  Layers,
  ExternalLink,
  Target,
  Shield,
  Network,
  Database,
  Mail,
  Slack,
  MessageSquare,
  Phone,
  Webhook,
  Cloud,
  Server,
  Terminal,
  FileText,
  Eye,
  Edit,
  Plus,
  Trash2,
  Copy,
  RotateCw,
  Workflow,
  Timer,
  Hash,
  Filter,
  Search
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface SignalSOARAutomationProps {
  signal?: DemoSignal
  signals?: DemoSignal[]
  className?: string
}

interface AutomationRule {
  id: string
  name: string
  description: string
  trigger: {
    conditions: AutomationCondition[]
    logic: 'AND' | 'OR'
  }
  actions: AutomationAction[]
  enabled: boolean
  priority: number
  created_at: string
  last_triggered?: string
  trigger_count: number
  success_rate: number
  category: 'containment' | 'investigation' | 'notification' | 'remediation'
}

interface AutomationCondition {
  id: string
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_list'
  value: string | string[] | number
  case_sensitive?: boolean
}

interface AutomationAction {
  id: string
  type: 'api_call' | 'email' | 'slack' | 'webhook' | 'script' | 'ticket' | 'containment'
  name: string
  config: Record<string, any>
  timeout: number
  retry_count: number
  on_failure: 'continue' | 'stop' | 'retry'
}

interface AutomationExecution {
  id: string
  rule_id: string
  signal_id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at?: string
  duration?: number
  actions_executed: number
  actions_successful: number
  actions_failed: number
  error_message?: string
  logs: AutomationLog[]
}

interface AutomationLog {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  action: string
  message: string
  details?: Record<string, any>
}

interface IntegrationConfig {
  id: string
  name: string
  type: 'siem' | 'ticketing' | 'chat' | 'security_tool' | 'cloud' | 'endpoint'
  status: 'connected' | 'disconnected' | 'error'
  config: Record<string, any>
  last_sync?: string
  capabilities: string[]
}

export function SignalSOARAutomation({ signal, signals = [], className }: SignalSOARAutomationProps) {
  const [activeTab, setActiveTab] = useState('rules')
  const [selectedRule, setSelectedRule] = useState<string | null>(null)
  const [isCreatingRule, setIsCreatingRule] = useState(false)

  // Mock automation rules
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([
    {
      id: 'rule-1',
      name: 'Critical Alert Containment',
      description: 'Automatically contain critical security threats by isolating affected systems',
      trigger: {
        conditions: [
          { id: 'cond-1', field: 'severity', operator: 'equals', value: 'CRITICAL' },
          { id: 'cond-2', field: 'tags', operator: 'contains', value: 'malware' }
        ],
        logic: 'AND'
      },
      actions: [
        {
          id: 'action-1',
          type: 'containment',
          name: 'Isolate Endpoint',
          config: { endpoint_id: '${signal.source_ip}', action: 'isolate' },
          timeout: 300,
          retry_count: 3,
          on_failure: 'continue'
        },
        {
          id: 'action-2',
          type: 'slack',
          name: 'Notify Security Team',
          config: { channel: '#security-alerts', message: 'Critical threat contained: ${signal.title}' },
          timeout: 30,
          retry_count: 2,
          on_failure: 'continue'
        }
      ],
      enabled: true,
      priority: 1,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_triggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      trigger_count: 23,
      success_rate: 95.6,
      category: 'containment'
    },
    {
      id: 'rule-2',
      name: 'Suspicious Login Investigation',
      description: 'Automatically gather context for suspicious login attempts',
      trigger: {
        conditions: [
          { id: 'cond-3', field: 'title', operator: 'contains', value: 'login', case_sensitive: false },
          { id: 'cond-4', field: 'severity', operator: 'in_list', value: ['HIGH', 'MEDIUM'] }
        ],
        logic: 'AND'
      },
      actions: [
        {
          id: 'action-3',
          type: 'api_call',
          name: 'Query User Context',
          config: { url: 'https://api.ad.company.com/users/${signal.user_id}', method: 'GET' },
          timeout: 60,
          retry_count: 2,
          on_failure: 'continue'
        },
        {
          id: 'action-4',
          type: 'ticket',
          name: 'Create Investigation Ticket',
          config: {
            system: 'jira',
            project: 'SEC',
            type: 'Investigation',
            summary: 'Suspicious Login: ${signal.title}',
            description: 'Automated investigation triggered for suspicious login activity'
          },
          timeout: 120,
          retry_count: 1,
          on_failure: 'stop'
        }
      ],
      enabled: true,
      priority: 2,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      last_triggered: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      trigger_count: 156,
      success_rate: 87.3,
      category: 'investigation'
    },
    {
      id: 'rule-3',
      name: 'Data Exfiltration Response',
      description: 'Respond to potential data exfiltration attempts with immediate containment',
      trigger: {
        conditions: [
          { id: 'cond-5', field: 'tags', operator: 'contains', value: 'data-exfiltration' }
        ],
        logic: 'OR'
      },
      actions: [
        {
          id: 'action-5',
          type: 'containment',
          name: 'Block Network Traffic',
          config: { source_ip: '${signal.source_ip}', action: 'block_outbound' },
          timeout: 180,
          retry_count: 2,
          on_failure: 'retry'
        },
        {
          id: 'action-6',
          type: 'email',
          name: 'Executive Alert',
          config: {
            to: ['ciso@company.com', 'legal@company.com'],
            subject: 'URGENT: Potential Data Exfiltration Detected',
            template: 'data_breach_alert'
          },
          timeout: 60,
          retry_count: 3,
          on_failure: 'continue'
        }
      ],
      enabled: true,
      priority: 1,
      created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      last_triggered: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      trigger_count: 8,
      success_rate: 100.0,
      category: 'remediation'
    }
  ])

  // Mock automation executions
  const [automationExecutions, setAutomationExecutions] = useState<AutomationExecution[]>([
    {
      id: 'exec-1',
      rule_id: 'rule-1',
      signal_id: signal?.id || 'demo-signal',
      status: 'completed',
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 118 * 60 * 1000).toISOString(),
      duration: 125,
      actions_executed: 2,
      actions_successful: 2,
      actions_failed: 0,
      logs: [
        {
          id: 'log-1',
          timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
          level: 'info',
          action: 'Isolate Endpoint',
          message: 'Successfully isolated endpoint 192.168.1.100'
        },
        {
          id: 'log-2',
          timestamp: new Date(Date.now() - 118 * 60 * 1000).toISOString(),
          level: 'info',
          action: 'Notify Security Team',
          message: 'Slack notification sent to #security-alerts'
        }
      ]
    },
    {
      id: 'exec-2',
      rule_id: 'rule-2',
      signal_id: 'signal-789',
      status: 'failed',
      started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      duration: 300,
      actions_executed: 1,
      actions_successful: 0,
      actions_failed: 1,
      error_message: 'API timeout: Unable to connect to Active Directory service',
      logs: [
        {
          id: 'log-3',
          timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
          level: 'error',
          action: 'Query User Context',
          message: 'Connection timeout after 60 seconds'
        }
      ]
    }
  ])

  // Mock integrations
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([
    {
      id: 'int-1',
      name: 'Splunk SIEM',
      type: 'siem',
      status: 'connected',
      config: { host: 'splunk.company.com', port: 8089 },
      last_sync: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      capabilities: ['query_logs', 'create_alerts', 'threat_intel']
    },
    {
      id: 'int-2',
      name: 'ServiceNow',
      type: 'ticketing',
      status: 'connected',
      config: { instance: 'company.service-now.com' },
      last_sync: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      capabilities: ['create_tickets', 'update_tickets', 'assign_tickets']
    },
    {
      id: 'int-3',
      name: 'CrowdStrike Falcon',
      type: 'endpoint',
      status: 'connected',
      config: { api_base: 'https://api.crowdstrike.com' },
      last_sync: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      capabilities: ['isolate_endpoint', 'query_detections', 'remediate_threats']
    },
    {
      id: 'int-4',
      name: 'Slack Workspace',
      type: 'chat',
      status: 'error',
      config: { workspace: 'company.slack.com' },
      last_sync: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      capabilities: ['send_messages', 'create_channels', 'manage_workflows']
    }
  ])

  const handleToggleRule = (ruleId: string) => {
    setAutomationRules(prev =>
      prev.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    )
  }

  const handleExecuteRule = async (ruleId: string) => {
    if (!signal) return

    const rule = automationRules.find(r => r.id === ruleId)
    if (!rule) return

    const newExecution: AutomationExecution = {
      id: `exec-${Date.now()}`,
      rule_id: ruleId,
      signal_id: signal.id,
      status: 'running',
      started_at: new Date().toISOString(),
      actions_executed: 0,
      actions_successful: 0,
      actions_failed: 0,
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          action: 'Automation Started',
          message: `Executing rule: ${rule.name}`
        }
      ]
    }

    setAutomationExecutions(prev => [newExecution, ...prev])

    // Simulate execution
    setTimeout(() => {
      setAutomationExecutions(prev =>
        prev.map(exec =>
          exec.id === newExecution.id
            ? {
                ...exec,
                status: 'completed',
                completed_at: new Date().toISOString(),
                duration: 45,
                actions_executed: rule.actions.length,
                actions_successful: rule.actions.length,
                logs: [
                  ...exec.logs,
                  ...rule.actions.map((action, index) => ({
                    id: `log-${Date.now()}-${index}`,
                    timestamp: new Date(Date.now() + index * 1000).toISOString(),
                    level: 'info' as const,
                    action: action.name,
                    message: `Successfully executed: ${action.name}`
                  }))
                ]
              }
            : exec
        )
      )
    }, 3000)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      connected: {
        className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400',
        icon: CheckCircle,
        label: 'Connected'
      },
      disconnected: {
        className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400',
        icon: XCircle,
        label: 'Disconnected'
      },
      error: {
        className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400',
        icon: AlertTriangle,
        label: 'Error'
      },
      running: {
        className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
        icon: Activity,
        label: 'Running'
      },
      completed: {
        className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400',
        icon: CheckCircle,
        label: 'Completed'
      },
      failed: {
        className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400',
        icon: XCircle,
        label: 'Failed'
      },
      cancelled: {
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400',
        icon: Clock,
        label: 'Cancelled'
      }
    } as const

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected
    const Icon = config.icon

    return (
      <Badge variant="outline" className={`${config.className} px-2 py-1 text-xs font-medium border`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  const getCategoryBadge = (category: string) => {
    const categoryConfig = {
      containment: { className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', label: 'Containment' },
      investigation: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', label: 'Investigation' },
      notification: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', label: 'Notification' },
      remediation: { className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', label: 'Remediation' }
    } as const

    const config = categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.investigation

    return (
      <Badge variant="outline" className={`${config.className} text-xs px-2 py-0.5`}>
        {config.label}
      </Badge>
    )
  }

  const getIntegrationIcon = (type: string) => {
    const iconMap = {
      siem: Database,
      ticketing: FileText,
      chat: MessageSquare,
      security_tool: Shield,
      cloud: Cloud,
      endpoint: Server
    } as const

    return iconMap[type as keyof typeof iconMap] || Network
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className={`border-gray-200 dark:border-gray-700 ${className}`}>
      <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
          <Bot className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          SOAR Automation
          <Badge variant="outline" className="ml-auto">
            {automationRules.filter(r => r.enabled).length} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="rules">
              <Workflow className="w-4 h-4 mr-2" />
              Rules ({automationRules.length})
            </TabsTrigger>
            <TabsTrigger value="executions">
              <Activity className="w-4 h-4 mr-2" />
              Executions ({automationExecutions.length})
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <Network className="w-4 h-4 mr-2" />
              Integrations ({integrations.length})
            </TabsTrigger>
            <TabsTrigger value="playbooks">
              <FileText className="w-4 h-4 mr-2" />
              Playbooks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-6">
            {/* Rule Creation */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Automation Rules</h3>
              <Button
                onClick={() => setIsCreatingRule(true)}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Rule
              </Button>
            </div>

            {/* Rules List */}
            <div className="space-y-4">
              {automationRules.map(rule => (
                <div key={rule.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {rule.name}
                        </h4>
                        {getCategoryBadge(rule.category)}
                        <Badge variant="outline" className="text-xs">
                          Priority {rule.priority}
                        </Badge>
                        {rule.enabled ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {rule.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Triggered: {rule.trigger_count} times</span>
                        <span>Success Rate: {rule.success_rate}%</span>
                        <span>Actions: {rule.actions.length}</span>
                        {rule.last_triggered && (
                          <span>Last: {formatTimeAgo(rule.last_triggered)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => handleToggleRule(rule.id)}
                      />
                      {signal && (
                        <Button
                          onClick={() => handleExecuteRule(rule.id)}
                          variant="outline"
                          size="sm"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Rule Details */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Trigger Conditions ({rule.trigger.logic})
                      </h5>
                      <div className="space-y-1">
                        {rule.trigger.conditions.map(condition => (
                          <div key={condition.id} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                            {condition.field} {condition.operator} {Array.isArray(condition.value) ? condition.value.join(', ') : condition.value}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Actions ({rule.actions.length})
                      </h5>
                      <div className="space-y-1">
                        {rule.actions.map(action => (
                          <div key={action.id} className="flex items-center gap-2 text-xs">
                            <Badge variant="secondary" className="text-xs">
                              {action.type}
                            </Badge>
                            <span className="text-gray-600 dark:text-gray-400">
                              {action.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="executions" className="space-y-6">
            {/* Execution History */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Executions</h3>
              <Button variant="outline" size="sm">
                <RotateCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>

            <div className="space-y-4">
              {automationExecutions.map(execution => {
                const rule = automationRules.find(r => r.id === execution.rule_id)
                return (
                  <div key={execution.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {rule?.name || 'Unknown Rule'}
                          </h4>
                          {getStatusBadge(execution.status)}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Signal ID: {execution.signal_id}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>Started: {formatTimeAgo(execution.started_at)}</span>
                          {execution.duration && <span>Duration: {execution.duration}s</span>}
                          <span>Actions: {execution.actions_successful}/{execution.actions_executed}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>

                    {execution.error_message && (
                      <div className="p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400 mb-3">
                        {execution.error_message}
                      </div>
                    )}

                    {/* Execution Logs */}
                    <div className="space-y-1">
                      {execution.logs.slice(0, 3).map(log => (
                        <div key={log.id} className="flex items-center gap-2 text-xs">
                          <Badge
                            variant="outline"
                            className={
                              log.level === 'error' ? 'border-red-200 text-red-800 bg-red-50 dark:bg-red-900/20 dark:text-red-400' :
                              log.level === 'warning' ? 'border-yellow-200 text-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400' :
                              'border-gray-200 text-gray-800 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400'
                            }
                          >
                            {log.level}
                          </Badge>
                          <span className="text-gray-600 dark:text-gray-400 font-mono">
                            {formatTimeAgo(log.timestamp)}
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {log.message}
                          </span>
                        </div>
                      ))}
                      {execution.logs.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          +{execution.logs.length - 3} more entries
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            {/* Integration Overview */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Integrations</h3>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Integration
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {integrations.map(integration => {
                const Icon = getIntegrationIcon(integration.type)
                return (
                  <div key={integration.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {integration.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {integration.type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(integration.status)}
                        <Button variant="outline" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Capabilities:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {integration.capabilities.map(capability => (
                            <Badge key={capability} variant="secondary" className="text-xs">
                              {capability.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {integration.last_sync && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Last sync: {formatTimeAgo(integration.last_sync)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="playbooks" className="space-y-6">
            {/* Incident Response Playbooks */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Response Playbooks</h3>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Create Playbook
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                {
                  name: 'Malware Incident Response',
                  description: 'Comprehensive response to malware detections',
                  steps: 8,
                  automations: 5,
                  category: 'Malware'
                },
                {
                  name: 'Data Breach Response',
                  description: 'Immediate containment and investigation procedures',
                  steps: 12,
                  automations: 7,
                  category: 'Data Breach'
                },
                {
                  name: 'Insider Threat Investigation',
                  description: 'Structured approach to insider threat cases',
                  steps: 15,
                  automations: 4,
                  category: 'Insider Threat'
                },
                {
                  name: 'Network Intrusion Response',
                  description: 'Response to unauthorized network access',
                  steps: 10,
                  automations: 6,
                  category: 'Network Security'
                }
              ].map((playbook, index) => (
                <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        {playbook.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {playbook.description}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {playbook.category}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                      <span>{playbook.steps} steps</span>
                      <span>{playbook.automations} automations</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}