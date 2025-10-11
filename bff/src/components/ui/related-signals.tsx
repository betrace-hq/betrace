import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { StatusBadge } from '@/components/ui/status-badge'
import { SeverityBadge } from '@/components/ui/severity-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { Shield, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/design-system'

export interface RelatedSignal {
  id: string
  title: string
  service: string
  severity: string
  status: string
  timestamp: string
  /** Reason why this signal is related */
  relation?: 'same-service' | 'same-trace' | 'same-rule' | 'time-correlation'
}

export interface RelatedSignalsProps {
  /**
   * List of related signals
   */
  signals: RelatedSignal[]

  /**
   * Loading state
   */
  isLoading?: boolean

  /**
   * Maximum number of signals to display (default: 5)
   */
  limit?: number

  /**
   * Optional className
   */
  className?: string

  /**
   * Whether to enable navigation links (default: true)
   * Set to false in Storybook to avoid router context errors
   */
  enableLinks?: boolean
}

const relationLabels = {
  'same-service': 'Same Service',
  'same-trace': 'Same Trace',
  'same-rule': 'Same Rule',
  'time-correlation': 'Time Correlation',
}

// Component to render signal card content
function SignalCard({ signal }: { signal: RelatedSignal }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {signal.title}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {signal.service}
          </p>
        </div>
        <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SeverityBadge severity={signal.severity} />
        <StatusBadge status={signal.status} />
        {signal.relation && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            • {relationLabels[signal.relation]}
          </span>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {new Date(signal.timestamp).toLocaleString()}
      </div>
    </>
  )
}

export function RelatedSignals({
  signals,
  isLoading = false,
  limit = 5,
  className,
  enableLinks = true,
}: RelatedSignalsProps) {
  const displaySignals = signals.slice(0, limit)
  const cardClassName = "block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"

  if (isLoading) {
    return <LoadingState message="Finding related signals..." />
  }

  if (signals.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No Related Signals"
        description="No other signals found with similar characteristics"
      />
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {displaySignals.map((signal) => {
        const content = <SignalCard signal={signal} />

        if (enableLinks) {
          return (
            <Link
              key={signal.id}
              to="/signals/$id"
              params={{ id: signal.id }}
              search={{}}
              className={cardClassName}
            >
              {content}
            </Link>
          )
        }

        return (
          <div key={signal.id} className={cardClassName}>
            {content}
          </div>
        )
      })}

      {signals.length > limit && (
        <div className="text-center pt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            +{signals.length - limit} more related signals
          </p>
        </div>
      )}
    </div>
  )
}
