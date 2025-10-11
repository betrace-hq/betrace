import * as React from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetadataGrid, type MetadataItem } from '@/components/ui/metadata-grid'

export interface TechnicalContextProps {
  /**
   * Trace ID for linking to tracing system
   */
  traceId?: string

  /**
   * Correlation ID
   */
  correlationId?: string

  /**
   * Span ID
   */
  spanId?: string

  /**
   * Additional context metadata
   */
  metadata?: Record<string, string | number>

  /**
   * Optional URL to external tracing system
   */
  tracingUrl?: string

  /**
   * Callback when "View in Tracing System" is clicked
   */
  onViewTrace?: () => void
}

export function TechnicalContext({
  traceId,
  correlationId,
  spanId,
  metadata = {},
  tracingUrl,
  onViewTrace,
}: TechnicalContextProps) {
  const items: MetadataItem[] = []

  // Add trace context items
  if (correlationId) {
    items.push({
      label: 'Correlation ID',
      value: correlationId,
      mono: true,
    })
  }

  if (traceId) {
    items.push({
      label: 'Trace ID',
      value: traceId,
      mono: true,
    })
  }

  if (spanId) {
    items.push({
      label: 'Span ID',
      value: spanId,
      mono: true,
    })
  }

  // Add additional metadata
  Object.entries(metadata).forEach(([key, value]) => {
    const valueStr = String(value)
    const hasMatch = typeof value === 'string' && (value.includes('/') || value.includes('.') || !!value.match(/^\d+$/))
    items.push({
      label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      value: valueStr,
      mono: hasMatch,
    })
  })

  const handleViewTrace = () => {
    if (onViewTrace) {
      onViewTrace()
    } else if (tracingUrl) {
      window.open(tracingUrl, '_blank')
    }
  }

  return (
    <div className="space-y-4">
      <MetadataGrid items={items} columns={2} />

      {(tracingUrl || onViewTrace) && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleViewTrace}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View in Tracing System
          </Button>
        </div>
      )}
    </div>
  )
}
