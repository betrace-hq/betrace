import { CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * PRD-004: Compliance Score Card
 *
 * Displays aggregate coverage score for a compliance framework (SOC2, HIPAA).
 */

interface FrameworkSummaryDTO {
  covered: number
  total: number
  score: number
}

interface ComplianceScoreCardProps {
  framework: string
  summary: FrameworkSummaryDTO
}

export function ComplianceScoreCard({ framework, summary }: ComplianceScoreCardProps) {
  const isHighCoverage = summary.score >= 80

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{framework} Compliance</p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold">{Math.round(summary.score)}%</p>
            {isHighCoverage ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {summary.covered} of {summary.total} controls covered
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${
              isHighCoverage ? 'bg-green-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${summary.score}%` }}
          />
        </div>
      </div>
    </div>
  )
}
