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
  Download,
  FileText,
  Share2,
  Calendar,
  Filter,
  Settings,
  Mail,
  Clock,
  BarChart3,
  PieChart,
  TrendingUp,
  FileDown,
  Database,
  CloudDownload,
  ExternalLink,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Zap,
  Shield,
  Users,
  Target,
  Hash,
  Play,
  Save,
  Copy,
  Refresh,
  Plus
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface SignalExportReportingProps {
  signals?: DemoSignal[]
  className?: string
}

interface ExportConfig {
  format: 'pdf' | 'csv' | 'json' | 'xlsx' | 'xml'
  includeFields: string[]
  dateRange: {
    start: string
    end: string
  }
  filters: {
    status: string[]
    severity: string[]
    services: string[]
  }
  groupBy: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  type: 'executive' | 'technical' | 'compliance' | 'incident'
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly'
  config: ExportConfig
  recipients: string[]
  created_at: string
  last_generated: string
  active: boolean
}

interface ReportGeneration {
  id: string
  template_id: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  progress: number
  started_at: string
  completed_at?: string
  file_url?: string
  file_size?: number
  error_message?: string
}

export function SignalExportReporting({ signals = [], className }: SignalExportReportingProps) {
  const [activeTab, setActiveTab] = useState('export')
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'pdf',
    includeFields: ['id', 'title', 'status', 'severity', 'timestamp', 'service'],
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    filters: {
      status: [],
      severity: [],
      services: []
    },
    groupBy: 'none',
    sortBy: 'timestamp',
    sortOrder: 'desc'
  })

  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([
    {
      id: 'template-1',
      name: 'Executive Security Summary',
      description: 'High-level security metrics and trends for executive leadership',
      type: 'executive',
      schedule: 'weekly',
      config: {
        format: 'pdf',
        includeFields: ['title', 'severity', 'status', 'timestamp', 'impact'],
        dateRange: { start: '', end: '' },
        filters: { status: ['resolved', 'investigating'], severity: ['CRITICAL', 'HIGH'], services: [] },
        groupBy: 'severity',
        sortBy: 'severity',
        sortOrder: 'desc'
      },
      recipients: ['ceo@company.com', 'ciso@company.com'],
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_generated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      active: true
    },
    {
      id: 'template-2',
      name: 'Technical Incident Report',
      description: 'Detailed technical analysis for security operations team',
      type: 'technical',
      schedule: 'daily',
      config: {
        format: 'pdf',
        includeFields: ['id', 'title', 'description', 'severity', 'status', 'timestamp', 'service', 'rule_name'],
        dateRange: { start: '', end: '' },
        filters: { status: ['open', 'investigating'], severity: [], services: [] },
        groupBy: 'service',
        sortBy: 'timestamp',
        sortOrder: 'desc'
      },
      recipients: ['security-team@company.com'],
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      last_generated: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      active: true
    },
    {
      id: 'template-3',
      name: 'Compliance Audit Report',
      description: 'Regulatory compliance report for audit purposes',
      type: 'compliance',
      schedule: 'monthly',
      config: {
        format: 'xlsx',
        includeFields: ['id', 'title', 'severity', 'status', 'timestamp', 'service', 'resolution_time'],
        dateRange: { start: '', end: '' },
        filters: { status: ['resolved'], severity: [], services: [] },
        groupBy: 'status',
        sortBy: 'timestamp',
        sortOrder: 'asc'
      },
      recipients: ['compliance@company.com', 'audit@company.com'],
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_generated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      active: true
    }
  ])

  const [reportGenerations, setReportGenerations] = useState<ReportGeneration[]>([
    {
      id: 'gen-1',
      template_id: 'template-1',
      status: 'completed',
      progress: 100,
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      file_url: '/exports/executive-summary-2024-01-15.pdf',
      file_size: 2457600
    },
    {
      id: 'gen-2',
      template_id: 'template-2',
      status: 'generating',
      progress: 67,
      started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    },
    {
      id: 'gen-3',
      template_id: 'template-3',
      status: 'failed',
      progress: 0,
      started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      error_message: 'Insufficient data for the selected date range'
    }
  ])

  const [isGenerating, setIsGenerating] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')

  const availableFields = [
    { id: 'id', label: 'Signal ID', category: 'basic' },
    { id: 'title', label: 'Title', category: 'basic' },
    { id: 'description', label: 'Description', category: 'basic' },
    { id: 'severity', label: 'Severity', category: 'basic' },
    { id: 'status', label: 'Status', category: 'basic' },
    { id: 'timestamp', label: 'Created Date', category: 'basic' },
    { id: 'service', label: 'Service', category: 'basic' },
    { id: 'rule_name', label: 'Rule Name', category: 'technical' },
    { id: 'source_ip', label: 'Source IP', category: 'technical' },
    { id: 'user_agent', label: 'User Agent', category: 'technical' },
    { id: 'impact', label: 'Business Impact', category: 'business' },
    { id: 'resolution_time', label: 'Resolution Time', category: 'metrics' },
    { id: 'assigned_to', label: 'Assigned To', category: 'workflow' },
    { id: 'escalation_level', label: 'Escalation Level', category: 'workflow' }
  ]

  const formatOptions = [
    { value: 'pdf', label: 'PDF Report', icon: FileText, description: 'Professional formatted report' },
    { value: 'csv', label: 'CSV Export', icon: Database, description: 'Comma-separated values for analysis' },
    { value: 'json', label: 'JSON Export', icon: FileDown, description: 'Machine-readable format' },
    { value: 'xlsx', label: 'Excel Spreadsheet', icon: BarChart3, description: 'Excel workbook with charts' },
    { value: 'xml', label: 'XML Export', icon: FileText, description: 'Structured XML format' }
  ]

  const handleExport = async () => {
    setIsGenerating(true)

    // Simulate export process
    const newGeneration: ReportGeneration = {
      id: `gen-${Date.now()}`,
      template_id: 'manual',
      status: 'generating',
      progress: 0,
      started_at: new Date().toISOString()
    }

    setReportGenerations(prev => [newGeneration, ...prev])

    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setReportGenerations(prev =>
        prev.map(gen =>
          gen.id === newGeneration.id
            ? { ...gen, progress: i, status: i === 100 ? 'completed' : 'generating' }
            : gen
        )
      )
    }

    // Complete the export
    setReportGenerations(prev =>
      prev.map(gen =>
        gen.id === newGeneration.id
          ? {
              ...gen,
              status: 'completed',
              completed_at: new Date().toISOString(),
              file_url: `/exports/manual-export-${Date.now()}.${exportConfig.format}`,
              file_size: Math.floor(Math.random() * 5000000) + 1000000
            }
          : gen
      )
    )

    setIsGenerating(false)
  }

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim()) return

    const newTemplate: ReportTemplate = {
      id: `template-${Date.now()}`,
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim(),
      type: 'technical',
      schedule: 'manual',
      config: { ...exportConfig },
      recipients: [],
      created_at: new Date().toISOString(),
      last_generated: '',
      active: true
    }

    setReportTemplates(prev => [newTemplate, ...prev])
    setNewTemplateName('')
    setNewTemplateDescription('')
  }

  const handleToggleTemplate = (templateId: string) => {
    setReportTemplates(prev =>
      prev.map(template =>
        template.id === templateId
          ? { ...template, active: !template.active }
          : template
      )
    )
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: {
        className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400',
        icon: CheckCircle,
        label: 'Completed'
      },
      generating: {
        className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
        icon: Activity,
        label: 'Generating'
      },
      pending: {
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400',
        icon: Clock,
        label: 'Pending'
      },
      failed: {
        className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400',
        icon: XCircle,
        label: 'Failed'
      }
    } as const

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge variant="outline" className={`${config.className} px-2 py-1 text-xs font-medium border`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
          <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          Export & Reporting
          <Badge variant="outline" className="ml-auto">
            {signals.length} signals
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="export">
              <Download className="w-4 h-4 mr-2" />
              Quick Export
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="w-4 h-4 mr-2" />
              Templates ({reportTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="w-4 h-4 mr-2" />
              History ({reportGenerations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-6">
            {/* Export Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Format Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Export Format</h3>
                <div className="grid grid-cols-2 gap-3">
                  {formatOptions.map(format => {
                    const Icon = format.icon
                    return (
                      <button
                        key={format.value}
                        onClick={() => setExportConfig(prev => ({ ...prev, format: format.value as any }))}
                        className={`p-4 rounded-lg border transition-all ${
                          exportConfig.format === format.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <Icon className="w-6 h-6 mx-auto mb-2" />
                        <div className="text-sm font-medium">{format.label}</div>
                        <div className="text-xs text-gray-500 mt-1">{format.description}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Field Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Include Fields</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableFields.map(field => (
                    <label key={field.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded">
                      <input
                        type="checkbox"
                        checked={exportConfig.includeFields.includes(field.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExportConfig(prev => ({
                              ...prev,
                              includeFields: [...prev.includeFields, field.id]
                            }))
                          } else {
                            setExportConfig(prev => ({
                              ...prev,
                              includeFields: prev.includeFields.filter(f => f !== field.id)
                            }))
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {field.label}
                        </span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {field.category}
                        </Badge>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Date Range and Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">Date Range</h4>
                <div className="space-y-2">
                  <Input
                    type="date"
                    value={exportConfig.dateRange.start}
                    onChange={(e) => setExportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                  />
                  <Input
                    type="date"
                    value={exportConfig.dateRange.end}
                    onChange={(e) => setExportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">Grouping & Sorting</h4>
                <div className="space-y-2">
                  <Select
                    value={exportConfig.groupBy}
                    onValueChange={(value) => setExportConfig(prev => ({ ...prev, groupBy: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Group by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Grouping</SelectItem>
                      <SelectItem value="severity">Severity</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Select
                      value={exportConfig.sortBy}
                      onValueChange={(value) => setExportConfig(prev => ({ ...prev, sortBy: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="timestamp">Date</SelectItem>
                        <SelectItem value="severity">Severity</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={exportConfig.sortOrder}
                      onValueChange={(value) => setExportConfig(prev => ({ ...prev, sortOrder: value as 'asc' | 'desc' }))}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">ASC</SelectItem>
                        <SelectItem value="desc">DESC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">Filters</h4>
                <div className="space-y-2">
                  <Input placeholder="Status filter (comma-separated)" />
                  <Input placeholder="Severity filter (comma-separated)" />
                  <Input placeholder="Service filter (comma-separated)" />
                </div>
              </div>
            </div>

            {/* Export Actions */}
            <div className="flex items-center justify-between pt-6 border-t">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {signals.length} signals match current criteria
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
                <Button variant="outline" size="sm" onClick={handleCreateTemplate}>
                  <Save className="w-4 h-4 mr-1" />
                  Save Template
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={isGenerating}
                  size="sm"
                >
                  {isGenerating ? (
                    <>
                      <Activity className="w-4 h-4 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      Export Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            {/* Create New Template */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Create Report Template</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Input
                  placeholder="Template name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                />
                <Input
                  placeholder="Description"
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                />
                <Button onClick={handleCreateTemplate} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Create Template
                </Button>
              </div>
            </div>

            {/* Template List */}
            <div className="space-y-3">
              {reportTemplates.map(template => (
                <div key={template.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {template.name}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {template.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.schedule}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {template.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.active}
                        onCheckedChange={() => handleToggleTemplate(template.id)}
                      />
                      <Button variant="outline" size="sm">
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-4">
                      <span>Recipients: {template.recipients.length}</span>
                      <span>Format: {template.config.format.toUpperCase()}</span>
                      <span>Fields: {template.config.includeFields.length}</span>
                    </div>
                    <div>
                      Last generated: {template.last_generated ? formatTimeAgo(template.last_generated) : 'Never'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {/* Generation History */}
            <div className="space-y-3">
              {reportGenerations.map(generation => {
                const template = reportTemplates.find(t => t.id === generation.template_id)
                return (
                  <div key={generation.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {template?.name || 'Manual Export'}
                          </h4>
                          {getStatusBadge(generation.status)}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Started: {formatTimeAgo(generation.started_at)}
                          {generation.completed_at && (
                            <> • Completed: {formatTimeAgo(generation.completed_at)}</>
                          )}
                        </p>
                        {generation.error_message && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            Error: {generation.error_message}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {generation.status === 'generating' && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {generation.progress}%
                          </div>
                        )}
                        {generation.file_url && (
                          <Button variant="outline" size="sm">
                            <CloudDownload className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                    {generation.status === 'generating' && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${generation.progress}%` }}
                        />
                      </div>
                    )}
                    {generation.file_size && (
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        File size: {formatFileSize(generation.file_size)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}