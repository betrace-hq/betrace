import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Link } from '@tanstack/react-router'

/**
 * PRD-004: Control Card
 *
 * Displays status of a single compliance control.
 *
 * Status:
 * - ACTIVE: ✅ Green (≥10 spans/hour)
 * - PARTIAL: ⚠️ Yellow (1-9 spans/hour)
 * - NO_EVIDENCE: ❌ Red (0 spans in 24h)
 */

interface ControlSummaryDTO {
  id: string
  name: string
  framework: string
  spanCount: number
  lastEvidence: string | null
  status: 'ACTIVE' | 'PARTIAL' | 'NO_EVIDENCE'
  trendData: number[] | null
}

interface ControlCardProps {
  control: ControlSummaryDTO
}

export function ControlCard({ control }: ControlCardProps) {
  const statusConfig = {
    ACTIVE: {
      icon: CheckCircle2,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-950',
      border: 'border-green-200 dark:border-green-800',
    },
    PARTIAL: {
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bg: 'bg-yellow-50 dark:bg-yellow-950',
      border: 'border-yellow-200 dark:border-yellow-800',
    },
    NO_EVIDENCE: {
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-red-200 dark:border-red-800',
    },
  }

  const config = statusConfig[control.status]
  const Icon = config.icon

  const lastEvidenceText = control.lastEvidence
    ? formatDistanceToNow(new Date(control.lastEvidence), { addSuffix: true })
    : 'Never'

  return (
    <Link
      to="/compliance/controls/$framework/$controlId"
      params={{ framework: control.framework, controlId: control.id }}
      className={`block rounded-lg border ${config.border} ${config.bg} p-4 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <p className="font-mono text-sm font-semibold">{control.id}</p>
          </div>
          <p className="text-sm font-medium text-foreground line-clamp-2">{control.name}</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Evidence Spans</span>
          <span className="font-semibold">{control.spanCount.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Last Evidence</span>
          <span className="font-medium">{lastEvidenceText}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Framework</span>
          <span className="font-medium uppercase">{control.framework}</span>
        </div>
      </div>
    </Link>
  )
}
