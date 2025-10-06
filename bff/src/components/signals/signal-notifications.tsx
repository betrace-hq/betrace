import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Smartphone,
  Settings,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Users,
  Clock,
  Filter
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface NotificationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  triggers: {
    severity: string[]
    services: string[]
    keywords: string[]
    priority_threshold: number
  }
  channels: {
    email: boolean
    sms: boolean
    slack: boolean
    teams: boolean
    webhook: boolean
  }
  recipients: string[]
  cooldown_minutes: number
  created_at: string
  last_triggered?: string
}

interface NotificationHistory {
  id: string
  rule_id: string
  signal_id: string
  channel: string
  recipient: string
  status: 'sent' | 'failed' | 'pending'
  sent_at: string
  error_message?: string
}

interface SignalNotificationsProps {
  className?: string
}

export function SignalNotifications({ className }: SignalNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<NotificationRule | null>(null)
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [history, setHistory] = useState<NotificationHistory[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules')

  // Mock notification rules for demo
  const mockRules: NotificationRule[] = [
    {
      id: 'rule-1',
      name: 'Critical Security Alerts',
      description: 'Immediate notifications for critical severity signals',
      enabled: true,
      triggers: {
        severity: ['CRITICAL'],
        services: [],
        keywords: ['breach', 'compromise', 'unauthorized'],
        priority_threshold: 80
      },
      channels: {
        email: true,
        sms: true,
        slack: true,
        teams: false,
        webhook: false
      },
      recipients: ['security-team@company.com', '+1-555-0123'],
      cooldown_minutes: 5,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_triggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'rule-2',
      name: 'High Priority Auth Failures',
      description: 'Authentication-related high priority signals',
      enabled: true,
      triggers: {
        severity: ['HIGH', 'CRITICAL'],
        services: ['auth-service', 'user-service'],
        keywords: ['login', 'authentication', 'brute force'],
        priority_threshold: 70
      },
      channels: {
        email: true,
        sms: false,
        slack: true,
        teams: true,
        webhook: false
      },
      recipients: ['auth-team@company.com', '#security-alerts'],
      cooldown_minutes: 15,
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      last_triggered: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: 'rule-3',
      name: 'Data Exfiltration Indicators',
      description: 'Signals indicating potential data exfiltration',
      enabled: false,
      triggers: {
        severity: ['MEDIUM', 'HIGH', 'CRITICAL'],
        services: ['api-gateway', 'data-service'],
        keywords: ['download', 'export', 'large transfer'],
        priority_threshold: 60
      },
      channels: {
        email: true,
        sms: false,
        slack: false,
        teams: false,
        webhook: true
      },
      recipients: ['data-protection@company.com'],
      cooldown_minutes: 30,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]

  // Mock notification history
  const mockHistory: NotificationHistory[] = [
    {
      id: 'hist-1',
      rule_id: 'rule-1',
      signal_id: 'signal-123',
      channel: 'email',
      recipient: 'security-team@company.com',
      status: 'sent',
      sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'hist-2',
      rule_id: 'rule-1',
      signal_id: 'signal-123',
      channel: 'slack',
      recipient: '#security-alerts',
      status: 'sent',
      sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'hist-3',
      rule_id: 'rule-2',
      signal_id: 'signal-124',
      channel: 'email',
      recipient: 'auth-team@company.com',
      status: 'failed',
      sent_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      error_message: 'SMTP server temporarily unavailable'
    },
    {
      id: 'hist-4',
      rule_id: 'rule-2',
      signal_id: 'signal-125',
      channel: 'teams',
      recipient: 'Security Team',
      status: 'sent',
      sent_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    }
  ]

  useEffect(() => {
    setRules(mockRules)
    setHistory(mockHistory)
  }, [])

  const toggleRule = (ruleId: string) => {
    setRules(rules.map(rule =>
      rule.id === ruleId
        ? { ...rule, enabled: !rule.enabled }
        : rule
    ))
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />
      case 'sms': return <Smartphone className="w-4 h-4" />
      case 'slack': return <MessageSquare className="w-4 h-4" />
      case 'teams': return <Users className="w-4 h-4" />
      case 'webhook': return <Settings className="w-4 h-4" />
      default: return <Bell className="w-4 h-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><Check className="w-3 h-3 mr-1" />Sent</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><X className="w-3 h-3 mr-1" />Failed</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className={className}>
            <Bell className="w-4 h-4 mr-2" />
            Notification Settings
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Signal Notification System</DialogTitle>
            <DialogDescription>
              Configure automated notifications for security signals and monitor delivery status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Tab Navigation */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'rules'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Notification Rules ({rules.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Delivery History ({history.length})
              </button>
            </div>

            {/* Notification Rules Tab */}
            {activeTab === 'rules' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Notification Rules</h3>
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </div>

                <div className="grid gap-4">
                  {rules.map(rule => (
                    <Card key={rule.id} className={`border ${rule.enabled ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                {rule.enabled ? (
                                  <Bell className="w-5 h-5 text-green-600" />
                                ) : (
                                  <BellOff className="w-5 h-5 text-gray-400" />
                                )}
                                <h4 className="font-semibold">{rule.name}</h4>
                              </div>
                              <Switch
                                checked={rule.enabled}
                                onCheckedChange={() => toggleRule(rule.id)}
                              />
                            </div>

                            <p className="text-sm text-gray-600 mb-3">{rule.description}</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <Label className="text-xs font-medium text-gray-500">Triggers</Label>
                                <div className="mt-1 space-y-1">
                                  {rule.triggers.severity.length > 0 && (
                                    <div className="flex gap-1">
                                      {rule.triggers.severity.map(severity => (
                                        <Badge key={severity} variant="outline" className="text-xs">
                                          {severity}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {rule.triggers.priority_threshold > 0 && (
                                    <div className="text-xs text-gray-600">
                                      Priority ≥ {rule.triggers.priority_threshold}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs font-medium text-gray-500">Channels</Label>
                                <div className="mt-1 flex gap-2">
                                  {Object.entries(rule.channels)
                                    .filter(([_, enabled]) => enabled)
                                    .map(([channel]) => (
                                      <div key={channel} className="flex items-center gap-1">
                                        {getChannelIcon(channel)}
                                        <span className="text-xs capitalize">{channel}</span>
                                      </div>
                                    ))
                                  }
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs font-medium text-gray-500">Recipients</Label>
                                <div className="mt-1 text-xs text-gray-600">
                                  {rule.recipients.slice(0, 2).join(', ')}
                                  {rule.recipients.length > 2 && ` +${rule.recipients.length - 2} more`}
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-4 mt-3 text-xs text-gray-500">
                              <span>Cooldown: {rule.cooldown_minutes}min</span>
                              {rule.last_triggered && (
                                <span>Last triggered: {formatTimestamp(rule.last_triggered)}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRule(rule)}
                            >
                              <Edit className="w-4 h-4" />
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

            {/* Delivery History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Delivery History</h3>
                  <div className="flex gap-2">
                    <Select defaultValue="all">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  {history.map(item => (
                    <Card key={item.id} className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {getChannelIcon(item.channel)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.recipient}</span>
                                {getStatusBadge(item.status)}
                              </div>
                              <div className="text-sm text-gray-500">
                                Rule: {rules.find(r => r.id === item.rule_id)?.name || 'Unknown Rule'}
                                • Signal: {item.signal_id}
                              </div>
                              {item.error_message && (
                                <div className="text-sm text-red-600 mt-1">
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  {item.error_message}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatTimestamp(item.sent_at)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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