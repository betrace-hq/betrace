import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, AlertCircle, Shield, Activity } from 'lucide-react'
import { severityBadges, cn } from '@/lib/design-system'

interface SeverityBadgeProps {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string
  className?: string
}

const severityIcons = {
  critical: AlertTriangle,
  high: AlertCircle,
  medium: Shield,
  low: Activity,
} as const

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const normalizedSeverity = severity.toLowerCase() as keyof typeof severityBadges
  const config = severityBadges[normalizedSeverity] || severityBadges.low
  const Icon = severityIcons[normalizedSeverity as keyof typeof severityIcons] || Activity

  return (
    <Badge variant="outline" className={cn(config.className, 'border px-2 py-1 text-xs font-medium', className)}>
      <Icon className="w-3 h-3 mr-1" />
      {severity.toUpperCase()}
    </Badge>
  )
}