import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  FileSearch,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  FileText,
  Link,
  User,
  Calendar,
  Target,
  Activity,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Eye,
  Edit,
  Trash2,
  Save,
  Share
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface WorkflowStep {
  id: string
  name: string
  description: string
  type: 'manual' | 'automated' | 'approval' | 'documentation'
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed'
  assigned_to?: string
  estimated_duration: number
  actual_duration?: number
  dependencies: string[]
  artifacts: WorkflowArtifact[]
  notes: string
  started_at?: string
  completed_at?: string
}

interface WorkflowArtifact {
  id: string
  type: 'evidence' | 'analysis' | 'screenshot' | 'log' | 'report' | 'external_link'
  name: string
  description: string
  url?: string
  content?: string
  created_at: string
  created_by: string
}

interface InvestigationWorkflow {
  id: string
  name: string
  description: string
  signal_id: string
  template_id: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assigned_investigator: string
  supervisor: string
  steps: WorkflowStep[]
  created_at: string
  started_at?: string
  completed_at?: string
  estimated_completion: string
  progress_percentage: number
  findings: string
  recommendations: string
}

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'security_incident' | 'data_breach' | 'malware_analysis' | 'phishing' | 'insider_threat'
  steps: Omit<WorkflowStep, 'id' | 'status' | 'artifacts' | 'notes'>[]
  estimated_duration: number
  complexity: 'low' | 'medium' | 'high'
  required_skills: string[]
}

interface SignalInvestigationWorkflowProps {
  signal: DemoSignal
  className?: string
}

export function SignalInvestigationWorkflow({ signal, className }: SignalInvestigationWorkflowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [workflows, setWorkflows] = useState<InvestigationWorkflow[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [activeTab, setActiveTab] = useState('active')
  const [selectedWorkflow, setSelectedWorkflow] = useState<InvestigationWorkflow | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Mock workflow templates
  const mockTemplates: WorkflowTemplate[] = [
    {
      id: 'template-1',
      name: 'Security Incident Response',
      description: 'Standard workflow for investigating security incidents',
      category: 'security_incident',
      estimated_duration: 240, // 4 hours
      complexity: 'medium',
      required_skills: ['incident_response', 'forensics', 'threat_analysis'],
      steps: [
        {
          name: 'Initial Triage',
          description: 'Assess the severity and scope of the incident',
          type: 'manual',
          estimated_duration: 30,
          dependencies: [],
          assigned_to: undefined
        },
        {
          name: 'Evidence Collection',
          description: 'Gather relevant logs, screenshots, and digital evidence',
          type: 'manual',
          estimated_duration: 60,
          dependencies: ['Initial Triage']
        },
        {
          name: 'Threat Analysis',
          description: 'Analyze the threat using available intelligence sources',
          type: 'automated',
          estimated_duration: 15,
          dependencies: ['Evidence Collection']
        },
        {
          name: 'Impact Assessment',
          description: 'Determine the business impact and affected systems',
          type: 'manual',
          estimated_duration: 45,
          dependencies: ['Threat Analysis']
        },
        {
          name: 'Containment Strategy',
          description: 'Develop and implement containment measures',
          type: 'approval',
          estimated_duration: 30,
          dependencies: ['Impact Assessment']
        },
        {
          name: 'Documentation & Reporting',
          description: 'Document findings and create incident report',
          type: 'documentation',
          estimated_duration: 60,
          dependencies: ['Containment Strategy']
        }
      ]
    },
    {
      id: 'template-2',
      name: 'Malware Analysis',
      description: 'Comprehensive malware analysis workflow',
      category: 'malware_analysis',
      estimated_duration: 180,
      complexity: 'high',
      required_skills: ['malware_analysis', 'reverse_engineering', 'sandbox_analysis'],
      steps: [
        {
          name: 'Sample Acquisition',
          description: 'Safely acquire and isolate malware samples',
          type: 'manual',
          estimated_duration: 20,
          dependencies: []
        },
        {
          name: 'Static Analysis',
          description: 'Perform static analysis of malware binaries',
          type: 'manual',
          estimated_duration: 60,
          dependencies: ['Sample Acquisition']
        },
        {
          name: 'Dynamic Analysis',
          description: 'Execute malware in controlled sandbox environment',
          type: 'automated',
          estimated_duration: 45,
          dependencies: ['Static Analysis']
        },
        {
          name: 'Behavioral Analysis',
          description: 'Analyze malware behavior and network communications',
          type: 'manual',
          estimated_duration: 45,
          dependencies: ['Dynamic Analysis']
        },
        {
          name: 'IOC Extraction',
          description: 'Extract indicators of compromise for detection',
          type: 'manual',
          estimated_duration: 30,
          dependencies: ['Behavioral Analysis']
        }
      ]
    }
  ]

  // Mock active workflows
  const mockWorkflows: InvestigationWorkflow[] = [
    {
      id: 'workflow-1',
      name: 'Critical Auth Incident Investigation',
      description: 'Investigation of suspicious authentication patterns detected',
      signal_id: signal.id,
      template_id: 'template-1',
      status: 'active',
      priority: 'high',
      assigned_investigator: 'Sarah Chen',
      supervisor: 'Mike Rodriguez',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      started_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      estimated_completion: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString(),
      progress_percentage: 65,
      findings: 'Identified potential brute force attack from multiple IP addresses targeting admin accounts.',
      recommendations: 'Implement additional rate limiting and enable MFA for admin accounts.',
      steps: [
        {
          id: 'step-1',
          name: 'Initial Triage',
          description: 'Assess the severity and scope of the incident',
          type: 'manual',
          status: 'completed',
          assigned_to: 'Sarah Chen',
          estimated_duration: 30,
          actual_duration: 25,
          dependencies: [],
          artifacts: [
            {
              id: 'artifact-1',
              type: 'analysis',
              name: 'Initial Assessment Report',
              description: 'Preliminary analysis of authentication anomalies',
              content: 'Multiple failed login attempts detected across admin accounts...',
              created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
              created_by: 'Sarah Chen'
            }
          ],
          notes: 'High severity confirmed based on admin account targeting',
          started_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 65 * 60 * 1000).toISOString()
        },
        {
          id: 'step-2',
          name: 'Evidence Collection',
          description: 'Gather relevant logs, screenshots, and digital evidence',
          type: 'manual',
          status: 'completed',
          assigned_to: 'Sarah Chen',
          estimated_duration: 60,
          actual_duration: 45,
          dependencies: ['Initial Triage'],
          artifacts: [
            {
              id: 'artifact-2',
              type: 'log',
              name: 'Authentication Logs',
              description: 'Failed login attempts from suspicious IPs',
              url: '/logs/auth-2023-12-15.log',
              created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
              created_by: 'Sarah Chen'
            },
            {
              id: 'artifact-3',
              type: 'screenshot',
              name: 'SIEM Dashboard',
              description: 'Screenshot of SIEM alerts during incident',
              url: '/screenshots/siem-alerts-001.png',
              created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
              created_by: 'Sarah Chen'
            }
          ],
          notes: 'Collected comprehensive authentication logs and network traffic data',
          started_at: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 20 * 60 * 1000).toISOString()
        },
        {
          id: 'step-3',
          name: 'Threat Analysis',
          description: 'Analyze the threat using available intelligence sources',
          type: 'automated',
          status: 'in_progress',
          assigned_to: 'Sarah Chen',
          estimated_duration: 15,
          dependencies: ['Evidence Collection'],
          artifacts: [],
          notes: 'Running automated threat intelligence queries',
          started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
        },
        {
          id: 'step-4',
          name: 'Impact Assessment',
          description: 'Determine the business impact and affected systems',
          type: 'manual',
          status: 'pending',
          estimated_duration: 45,
          dependencies: ['Threat Analysis'],
          artifacts: [],
          notes: ''
        }
      ]
    }
  ]

  useEffect(() => {
    setTemplates(mockTemplates)
    setWorkflows(mockWorkflows)
  }, [])

  const createWorkflowFromTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return

    const newWorkflow: InvestigationWorkflow = {
      id: `workflow-${Date.now()}`,
      name: `${template.name} - ${signal.id}`,
      description: `Investigation workflow for signal ${signal.id}`,
      signal_id: signal.id,
      template_id: templateId,
      status: 'draft',
      priority: signal.severity === 'CRITICAL' ? 'critical' : 'high',
      assigned_investigator: 'Current User',
      supervisor: 'Team Lead',
      created_at: new Date().toISOString(),
      estimated_completion: new Date(Date.now() + template.estimated_duration * 60 * 1000).toISOString(),
      progress_percentage: 0,
      findings: '',
      recommendations: '',
      steps: template.steps.map((step, index) => ({
        id: `step-${index + 1}`,
        ...step,
        status: 'pending' as const,
        artifacts: [],
        notes: ''
      }))
    }

    setWorkflows([...workflows, newWorkflow])
    setSelectedWorkflow(newWorkflow)
    setIsCreating(false)
    alert(`Workflow "${newWorkflow.name}" created successfully!`)
  }

  const updateStepStatus = (workflowId: string, stepId: string, status: WorkflowStep['status']) => {
    setWorkflows(workflows.map(workflow =>
      workflow.id === workflowId
        ? {
            ...workflow,
            steps: workflow.steps.map(step =>
              step.id === stepId
                ? {
                    ...step,
                    status,
                    started_at: status === 'in_progress' ? new Date().toISOString() : step.started_at,
                    completed_at: status === 'completed' ? new Date().toISOString() : undefined
                  }
                : step
            )
          }
        : workflow
    ))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'in_progress': return <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />
      case 'skipped': return <ArrowRight className="w-4 h-4 text-gray-400" />
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'manual': return <User className="w-4 h-4" />
      case 'automated': return <Activity className="w-4 h-4" />
      case 'approval': return <CheckCircle className="w-4 h-4" />
      case 'documentation': return <FileText className="w-4 h-4" />
      default: return <Target className="w-4 h-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
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
            <FileSearch className="w-4 h-4 mr-2" />
            Investigation Workflow
            {workflows.filter(w => w.signal_id === signal.id && w.status === 'active').length > 0 && (
              <Badge variant="default" className="ml-2">
                {workflows.filter(w => w.signal_id === signal.id && w.status === 'active').length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Investigation Workflows</DialogTitle>
            <DialogDescription>
              Structured investigation workflows for signal {signal.id} with step-by-step guidance and evidence tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="active">Active ({workflows.filter(w => w.status === 'active').length})</TabsTrigger>
                <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({workflows.filter(w => w.status === 'completed').length})</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              {/* Active Workflows Tab */}
              <TabsContent value="active" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Active Investigations</h3>
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Start Investigation
                  </Button>
                </div>

                {workflows.filter(w => w.status === 'active').length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <FileSearch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold mb-2">No Active Investigations</h4>
                      <p className="text-gray-600 mb-4">Start a new investigation workflow to begin structured analysis.</p>
                      <Button onClick={() => setIsCreating(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Start Investigation
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  workflows
                    .filter(w => w.status === 'active')
                    .map(workflow => (
                      <Card key={workflow.id} className="border-blue-200 bg-blue-50/50">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                <FileSearch className="w-5 h-5" />
                                {workflow.name}
                                <Badge className={getPriorityColor(workflow.priority)}>
                                  {workflow.priority}
                                </Badge>
                              </CardTitle>
                              <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => setSelectedWorkflow(workflow)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                              <span>Progress: {workflow.progress_percentage}%</span>
                              <span>Assigned: {workflow.assigned_investigator}</span>
                            </div>
                            <Progress value={workflow.progress_percentage} className="w-full" />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-500">Created:</span>
                                <div>{formatTimestamp(workflow.created_at)}</div>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Est. Completion:</span>
                                <div>{formatTimestamp(workflow.estimated_completion)}</div>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Steps:</span>
                                <div>
                                  {workflow.steps.filter(s => s.status === 'completed').length} / {workflow.steps.length} completed
                                </div>
                              </div>
                            </div>

                            {/* Current Step */}
                            {(() => {
                              const currentStep = workflow.steps.find(s => s.status === 'in_progress')
                              if (currentStep) {
                                return (
                                  <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded">
                                    <div className="flex items-center gap-2 mb-1">
                                      {getStatusIcon(currentStep.status)}
                                      <span className="font-medium">Current Step: {currentStep.name}</span>
                                    </div>
                                    <p className="text-sm text-gray-600">{currentStep.description}</p>
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </TabsContent>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Investigation Templates</h3>
                  {templates.map(template => (
                    <Card key={template.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">{template.name}</h4>
                            <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Duration: {formatDuration(template.estimated_duration)}</span>
                              <span>Steps: {template.steps.length}</span>
                              <span>Complexity: {template.complexity}</span>
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                          </div>
                          <Button onClick={() => createWorkflowFromTemplate(template.id)}>
                            <Play className="w-4 h-4 mr-2" />
                            Start Workflow
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Completed Tab */}
              <TabsContent value="completed" className="space-y-4">
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold mb-2">No Completed Investigations</h4>
                  <p className="text-gray-600">Completed investigation workflows will appear here.</p>
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                {selectedWorkflow ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{selectedWorkflow.name}</h3>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Share className="w-4 h-4 mr-2" />
                          Share
                        </Button>
                        <Button variant="outline" size="sm">
                          <Save className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Workflow Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Status</Label>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(selectedWorkflow.status)}
                              <span className="capitalize">{selectedWorkflow.status}</span>
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Investigator</Label>
                            <div>{selectedWorkflow.assigned_investigator}</div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Progress</Label>
                            <div className="flex items-center gap-2">
                              <Progress value={selectedWorkflow.progress_percentage} className="flex-1" />
                              <span className="text-sm">{selectedWorkflow.progress_percentage}%</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Key Findings</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Textarea
                            placeholder="Document key findings and observations..."
                            value={selectedWorkflow.findings}
                            className="min-h-[100px]"
                            readOnly
                          />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Workflow Steps */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Investigation Steps</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {selectedWorkflow.steps.map((step, index) => (
                            <div key={step.id} className="border rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(step.status)}
                                  <div>
                                    <h4 className="font-semibold">{step.name}</h4>
                                    <p className="text-sm text-gray-600">{step.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getTypeIcon(step.type)}
                                  <Badge variant="outline" className="text-xs">
                                    {step.type}
                                  </Badge>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                                <div>
                                  <span className="font-medium text-gray-500">Assigned:</span>
                                  <div>{step.assigned_to || 'Unassigned'}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500">Duration:</span>
                                  <div>
                                    {step.actual_duration
                                      ? `${formatDuration(step.actual_duration)} (est. ${formatDuration(step.estimated_duration)})`
                                      : `est. ${formatDuration(step.estimated_duration)}`
                                    }
                                  </div>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500">Artifacts:</span>
                                  <div>{step.artifacts.length} collected</div>
                                </div>
                              </div>

                              {step.notes && (
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
                                  <span className="font-medium">Notes: </span>
                                  {step.notes}
                                </div>
                              )}

                              {step.status === 'pending' && index === selectedWorkflow.steps.findIndex(s => s.status === 'pending') && (
                                <div className="flex gap-2 mt-3">
                                  <Button size="sm" onClick={() => updateStepStatus(selectedWorkflow.id, step.id, 'in_progress')}>
                                    <Play className="w-4 h-4 mr-1" />
                                    Start
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => updateStepStatus(selectedWorkflow.id, step.id, 'skipped')}>
                                    Skip
                                  </Button>
                                </div>
                              )}

                              {step.status === 'in_progress' && (
                                <div className="flex gap-2 mt-3">
                                  <Button size="sm" onClick={() => updateStepStatus(selectedWorkflow.id, step.id, 'completed')}>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Complete
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => updateStepStatus(selectedWorkflow.id, step.id, 'pending')}>
                                    <Pause className="w-4 h-4 mr-1" />
                                    Pause
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileSearch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold mb-2">Select a Workflow</h4>
                    <p className="text-gray-600">Choose an active workflow to view detailed step-by-step progress.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

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