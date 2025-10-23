import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  Calendar,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { DemoSignal } from '@/lib/api/demo-api'

interface ExportSignalsProps {
  signals: DemoSignal[]
  filteredCount: number
  totalCount: number
  className?: string
}

export function ExportSignals({ signals, filteredCount, totalCount, className }: ExportSignalsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf'>('csv')
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered')
  const [isExporting, setIsExporting] = useState(false)
  const [exportComplete, setExportComplete] = useState(false)

  const exportFormats = [
    {
      value: 'csv',
      label: 'CSV',
      description: 'Comma-separated values for spreadsheets',
      icon: FileSpreadsheet,
      extension: '.csv'
    },
    {
      value: 'json',
      label: 'JSON',
      description: 'Structured data format for APIs',
      icon: FileJson,
      extension: '.json'
    },
    {
      value: 'pdf',
      label: 'PDF',
      description: 'Formatted report for printing',
      icon: FileText,
      extension: '.pdf'
    }
  ]

  const getExportData = () => {
    const dataToExport = exportScope === 'filtered' ? signals : signals // In real app, would get all signals
    return dataToExport
  }

  const generateCSV = (data: DemoSignal[]) => {
    const headers = ['ID', 'Title', 'Description', 'Service', 'Severity', 'Status', 'Timestamp', 'Rule Name']
    const rows = data.map(signal => [
      signal.id,
      `"${signal.title}"`,
      `"${signal.description}"`,
      signal.service,
      signal.severity,
      signal.status,
      signal.timestamp,
      `"${signal.rule_name || 'N/A'}"`
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const generateJSON = (data: DemoSignal[]) => {
    return JSON.stringify({
      exported_at: new Date().toISOString(),
      total_count: data.length,
      export_scope: exportScope,
      signals: data.map(signal => ({
        id: signal.id,
        title: signal.title,
        description: signal.description,
        service: signal.service,
        severity: signal.severity,
        status: signal.status,
        timestamp: signal.timestamp,
        rule_name: signal.rule_name,
        impact: signal.impact,
        tags: signal.tags
      }))
    }, null, 2)
  }

  const generatePDF = async (data: DemoSignal[]) => {
    // In a real implementation, you would use a PDF library like jsPDF or Puppeteer
    // For demo purposes, we'll create a simple text-based "PDF"
    const content = `
BeTrace Security Signals Report
Generated: ${new Date().toLocaleString()}
Export Scope: ${exportScope === 'filtered' ? 'Filtered Results' : 'All Signals'}
Total Signals: ${data.length}

${data.map((signal, index) => `
${index + 1}. ${signal.title}
   ID: ${signal.id}
   Service: ${signal.service}
   Severity: ${signal.severity}
   Status: ${signal.status}
   Timestamp: ${new Date(signal.timestamp).toLocaleString()}
   Description: ${signal.description}
   Rule: ${signal.rule_name || 'N/A'}
   ${signal.tags && signal.tags.length > 0 ? `Tags: ${signal.tags.join(', ')}` : ''}
`).join('\n')}
`
    return content
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    setIsExporting(true)
    setExportComplete(false)

    try {
      const data = getExportData()
      const timestamp = new Date().toISOString().split('T')[0]
      const scopePrefix = exportScope === 'filtered' ? 'filtered-' : 'all-'

      let content: string
      let filename: string
      let mimeType: string

      switch (exportFormat) {
        case 'csv':
          content = generateCSV(data)
          filename = `betrace-signals-${scopePrefix}${timestamp}.csv`
          mimeType = 'text/csv'
          break
        case 'json':
          content = generateJSON(data)
          filename = `betrace-signals-${scopePrefix}${timestamp}.json`
          mimeType = 'application/json'
          break
        case 'pdf':
          content = await generatePDF(data)
          filename = `betrace-signals-${scopePrefix}${timestamp}.txt` // Would be .pdf in real implementation
          mimeType = 'text/plain'
          break
        default:
          throw new Error('Unsupported export format')
      }

      // Simulate export processing time
      await new Promise(resolve => setTimeout(resolve, 1500))

      downloadFile(content, filename, mimeType)
      setExportComplete(true)

      setTimeout(() => {
        setIsOpen(false)
        setExportComplete(false)
      }, 2000)

    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const selectedFormat = exportFormats.find(f => f.value === exportFormat)
  const Icon = selectedFormat?.icon || Download

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Signals</DialogTitle>
          <DialogDescription>
            Choose your export format and scope to download signal data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Scope */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Scope</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportScope('filtered')}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  exportScope === 'filtered'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="font-medium text-sm">Filtered Results</div>
                <div className="text-xs text-gray-500 mt-1">{filteredCount} signals</div>
              </button>
              <button
                onClick={() => setExportScope('all')}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  exportScope === 'all'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="font-medium text-sm">All Signals</div>
                <div className="text-xs text-gray-500 mt-1">{totalCount} signals</div>
              </button>
            </div>
          </div>

          {/* Export Format */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <Select value={exportFormat} onValueChange={(value: 'csv' | 'json' | 'pdf') => setExportFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exportFormats.map(format => {
                  const FormatIcon = format.icon
                  return (
                    <SelectItem key={format.value} value={format.value}>
                      <div className="flex items-center gap-2">
                        <FormatIcon className="w-4 h-4" />
                        <div>
                          <div className="font-medium">{format.label}</div>
                          <div className="text-xs text-gray-500">{format.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Icon className="w-4 h-4" />
              <span className="font-medium">
                betrace-signals-{exportScope === 'filtered' ? 'filtered' : 'all'}-{new Date().toISOString().split('T')[0]}{selectedFormat?.extension}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {exportScope === 'filtered' ? filteredCount : totalCount} signals • {selectedFormat?.label} format
            </div>
          </div>

          {/* Export Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              disabled={isExporting || exportComplete}
              className="flex-1"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : exportComplete ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete!
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export {selectedFormat?.label}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}