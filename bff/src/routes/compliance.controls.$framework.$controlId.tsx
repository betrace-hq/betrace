import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Download, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface EvidenceSpan {
  timestamp: string
  framework: string
  control: string
  evidenceType: string
  outcome: string
  traceId: string
  spanId: string
  tenantId: string
  operation: string
}

interface ControlStatus {
  controlId: string
  framework: string
  name: string
  status: 'covered' | 'partial' | 'no_evidence'
  spanCount: number
  lastEvidence: string | null
  description: string
}

interface ControlDetail {
  control: ControlStatus
  spans: EvidenceSpan[]
  totalSpans: number
  page: number
  pageSize: number
  hasMore: boolean
}

export const Route = createFileRoute(
  '/compliance/controls/$framework/$controlId'
)({
  component: ControlDetailPage,
})

function ControlDetailPage() {
  const { framework, controlId } = Route.useParams()

  const { data, isLoading, error } = useQuery<ControlDetail>({
    queryKey: ['control-detail', framework, controlId],
    queryFn: async () => {
      const response = await fetch(
        `/api/compliance/controls/${framework}/${controlId}?pageSize=50`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch control detail')
      }
      return response.json()
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  })

  const handleExport = async (format: 'csv' | 'json') => {
    const url = `/api/compliance/export?format=${format}&framework=${framework}&controlId=${controlId}`
    const response = await fetch(url)
    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `compliance-${framework}-${controlId}.${format}`
    a.click()
    window.URL.revokeObjectURL(downloadUrl)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load control detail: {error.message}
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const statusColors = {
    covered: 'text-green-500',
    partial: 'text-yellow-500',
    no_evidence: 'text-red-500',
  }

  const outcomeColors = {
    success: 'text-green-600 dark:text-green-400',
    failure: 'text-red-600 dark:text-red-400',
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/compliance">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
          >
            <Download className="h-4 w-4 mr-1" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Control Info Card */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{data.control.controlId}</h1>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-secondary text-secondary-foreground uppercase">
                {data.control.framework}
              </span>
              <span
                className={`text-sm font-semibold uppercase ${statusColors[data.control.status]}`}
              >
                {data.control.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-lg text-muted-foreground">
              {data.control.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {data.control.description}
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-3xl font-bold">
              {data.totalSpans.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Total Evidence Spans</p>
            {data.control.lastEvidence && (
              <p className="text-xs text-muted-foreground">
                Last evidence:{' '}
                {formatDistanceToNow(new Date(data.control.lastEvidence), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Evidence Spans Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Evidence Spans</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Showing {data.spans.length} of {data.totalSpans} spans
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Evidence Type</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Trace ID</TableHead>
                <TableHead>Tenant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.spans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <p className="text-muted-foreground">
                      No evidence spans found
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                data.spans.map((span, idx) => (
                  <TableRow key={`${span.traceId}-${span.spanId}-${idx}`}>
                    <TableCell className="font-mono text-xs">
                      {formatDistanceToNow(new Date(span.timestamp), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {span.operation}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium px-2 py-1 rounded bg-secondary text-secondary-foreground">
                        {span.evidenceType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-semibold uppercase ${outcomeColors[span.outcome as 'success' | 'failure']}`}
                      >
                        {span.outcome}
                      </span>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`http://localhost:12015/explore?left=%7B%22queries%22:%5B%7B%22query%22:%22%7B.traceID%3D%5C%22${span.traceId}%5C%22%7D%22%7D%5D%7D`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                      >
                        {span.traceId}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {span.tenantId}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
