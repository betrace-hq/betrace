import { useQuery } from '@tanstack/react-query'
import { ComplianceScoreCard } from './compliance-score-card'
import { ControlCard } from './control-card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

/**
 * PRD-004: Compliance Dashboard
 *
 * Main dashboard component showing compliance posture across all frameworks.
 *
 * Features:
 * - Framework score cards (SOC2, HIPAA)
 * - Control coverage grid
 * - Auto-refresh every 5 seconds
 * - Manual refresh button
 */

interface FrameworkScore {
  framework: string
  coveragePercent: number
  coveredControls: number
  totalControls: number
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

interface ComplianceSummary {
  frameworkScores: FrameworkScore[]
  controls: ControlStatus[]
  totalSpans: number
  lastUpdated: string
}

export function ComplianceDashboard() {
  // Fetch compliance summary with 5-second polling
  const { data, isLoading, error, refetch } = useQuery<ComplianceSummary>({
    queryKey: ['compliance-summary'],
    queryFn: async () => {
      const response = await fetch('/api/compliance/summary')
      if (!response.ok) {
        throw new Error('Failed to fetch compliance summary')
      }
      return response.json()
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading compliance data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">
          Error loading compliance data: {error.message}
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  // Sort controls by status priority: no_evidence > partial > covered
  const statusPriority = { no_evidence: 0, partial: 1, covered: 2 }
  const sortedControls = [...data.controls].sort(
    (a, b) => statusPriority[a.status] - statusPriority[b.status]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time compliance posture from OpenTelemetry evidence
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Framework Score Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.frameworkScores.map((score) => (
          <ComplianceScoreCard key={score.framework} score={score} />
        ))}

        {/* Total Spans Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Total Evidence Spans</p>
            <p className="text-3xl font-bold">{data.totalSpans.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* Control Coverage Grid */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">Control Coverage</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedControls.map((control) => (
            <ControlCard key={`${control.framework}-${control.controlId}`} control={control} />
          ))}
        </div>
      </div>
    </div>
  )
}
