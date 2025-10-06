import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Network,
  Link,
  GitMerge,
  Clock,
  MapPin,
  User,
  Server,
  Hash,
  AlertTriangle,
  CheckCircle,
  Eye,
  Plus,
  X,
  Layers
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface SignalGroup {
  id: string
  name: string
  description: string
  signals: DemoSignal[]
  correlationScore: number
  createdAt: string
  status: 'active' | 'resolved' | 'investigating'
  category: 'ip_based' | 'user_based' | 'service_based' | 'time_based' | 'pattern_based' | 'manual'
}

interface SignalCorrelationProps {
  signals: DemoSignal[]
  onGroupCreate: (group: SignalGroup) => void
  onGroupUpdate: (groupId: string, updates: Partial<SignalGroup>) => void
  className?: string
}

export function SignalCorrelation({
  signals,
  onGroupCreate,
  onGroupUpdate,
  className
}: SignalCorrelationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSignals, setSelectedSignals] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [correlationMethod, setCorrelationMethod] = useState<string>('auto')
  const [correlationResults, setCorrelationResults] = useState<SignalGroup[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Mock existing groups for demo
  const existingGroups: SignalGroup[] = [
    {
      id: 'group-1',
      name: 'Coordinated Login Attack',
      description: 'Multiple failed login attempts from different IPs targeting same accounts',
      signals: signals.slice(0, 3),
      correlationScore: 0.92,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'investigating',
      category: 'ip_based'
    },
    {
      id: 'group-2',
      name: 'Data Exfiltration Campaign',
      description: 'Suspicious data access patterns across multiple services',
      signals: signals.slice(3, 6),
      correlationScore: 0.87,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      category: 'pattern_based'
    }
  ]

  const correlationMethods = [
    {
      value: 'auto',
      label: 'Automatic Detection',
      description: 'AI-powered correlation analysis'
    },
    {
      value: 'ip_based',
      label: 'IP Address Based',
      description: 'Group by source IP patterns'
    },
    {
      value: 'user_based',
      label: 'User Account Based',
      description: 'Group by affected user accounts'
    },
    {
      value: 'service_based',
      label: 'Service Based',
      description: 'Group by affected services'
    },
    {
      value: 'time_based',
      label: 'Time Window Based',
      description: 'Group by temporal proximity'
    },
    {
      value: 'manual',
      label: 'Manual Selection',
      description: 'Create custom group'
    }
  ]

  const analyzeCorrelations = async () => {
    setIsAnalyzing(true)

    // Simulate correlation analysis
    await new Promise(resolve => setTimeout(resolve, 2000))

    const mockCorrelations: SignalGroup[] = [
      {
        id: `group-${Date.now()}-1`,
        name: 'Suspicious API Activity',
        description: 'Related API calls showing potential reconnaissance behavior',
        signals: signals.slice(0, 2),
        correlationScore: 0.89,
        createdAt: new Date().toISOString(),
        status: 'active',
        category: correlationMethod as any
      },
      {
        id: `group-${Date.now()}-2`,
        name: 'Network Anomaly Cluster',
        description: 'Connected network events indicating potential lateral movement',
        signals: signals.slice(2, 4),
        correlationScore: 0.76,
        createdAt: new Date().toISOString(),
        status: 'active',
        category: correlationMethod as any
      }
    ]

    setCorrelationResults(mockCorrelations)
    setIsAnalyzing(false)
  }

  const createGroup = (correlationGroup?: SignalGroup) => {
    const newGroup: SignalGroup = correlationGroup || {
      id: `group-${Date.now()}`,
      name: groupName || 'Custom Signal Group',
      description: groupDescription || 'Manually created signal group',
      signals: signals.filter(s => selectedSignals.includes(s.id)),
      correlationScore: 1.0,
      createdAt: new Date().toISOString(),
      status: 'active',
      category: 'manual'
    }

    onGroupCreate(newGroup)

    // Reset form
    setGroupName('')
    setGroupDescription('')
    setSelectedSignals([])
    setCorrelationResults([])
    setIsOpen(false)
  }

  const getCorrelationIcon = (category: string) => {
    switch (category) {
      case 'ip_based': return <MapPin className="w-4 h-4" />
      case 'user_based': return <User className="w-4 h-4" />
      case 'service_based': return <Server className="w-4 h-4" />
      case 'time_based': return <Clock className="w-4 h-4" />
      case 'pattern_based': return <Network className="w-4 h-4" />
      default: return <Hash className="w-4 h-4" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-red-600 dark:text-red-400'
    if (score >= 0.6) return 'text-amber-600 dark:text-amber-400'
    return 'text-blue-600 dark:text-blue-400'
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className={className}>
            <GitMerge className="w-4 h-4 mr-2" />
            Correlate Signals
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Signal Correlation & Grouping</DialogTitle>
            <DialogDescription>
              Identify related signals and create investigation groups for coordinated analysis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Existing Groups */}
            {existingGroups.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Existing Signal Groups</Label>
                <div className="grid gap-3">
                  {existingGroups.map(group => (
                    <Card key={group.id} className="border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getCorrelationIcon(group.category)}
                              <h4 className="font-semibold">{group.name}</h4>
                              <Badge variant="outline" className={getScoreColor(group.correlationScore)}>
                                {(group.correlationScore * 100).toFixed(0)}% confidence
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {group.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{group.signals.length} signals</span>
                              <span>{new Date(group.createdAt).toLocaleDateString()}</span>
                              <Badge variant={group.status === 'active' ? 'destructive' : 'secondary'}>
                                {group.status}
                              </Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Correlation Method Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Correlation Method</Label>
              <Select value={correlationMethod} onValueChange={setCorrelationMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {correlationMethods.map(method => (
                    <SelectItem key={method.value} value={method.value}>
                      <div>
                        <div className="font-medium">{method.label}</div>
                        <div className="text-xs text-gray-500">{method.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manual Selection */}
            {correlationMethod === 'manual' && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Manual Signal Selection</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {signals.map(signal => (
                    <label key={signal.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSignals.includes(signal.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSignals([...selectedSignals, signal.id])
                          } else {
                            setSelectedSignals(selectedSignals.filter(id => id !== signal.id))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">{signal.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {signal.service}
                      </Badge>
                    </label>
                  ))}
                </div>

                {selectedSignals.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Group Name</Label>
                      <Input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Enter group name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Description</Label>
                      <Input
                        value={groupDescription}
                        onChange={(e) => setGroupDescription(e.target.value)}
                        placeholder="Describe the relationship between these signals"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Correlation Results */}
            {correlationResults.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-medium">Suggested Correlations</Label>
                <div className="space-y-3">
                  {correlationResults.map(group => (
                    <Card key={group.id} className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Network className="w-4 h-4 text-blue-600" />
                              <h4 className="font-semibold">{group.name}</h4>
                              <Badge className="bg-blue-600 text-white">
                                {(group.correlationScore * 100).toFixed(0)}% match
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {group.description}
                            </p>
                            <div className="text-xs text-gray-500">
                              {group.signals.length} signals correlated
                            </div>
                          </div>
                          <Button
                            onClick={() => createGroup(group)}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Create Group
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              {correlationMethod !== 'manual' ? (
                <Button
                  onClick={analyzeCorrelations}
                  disabled={isAnalyzing}
                  className="flex-1"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Network className="w-4 h-4 mr-2" />
                      Analyze Correlations
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => createGroup()}
                  disabled={selectedSignals.length < 2 || !groupName}
                  className="flex-1"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Group ({selectedSignals.length} signals)
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}