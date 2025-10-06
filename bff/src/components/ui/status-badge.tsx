import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { statusBadges, cn } from '@/lib/design-system'

interface StatusBadgeProps {
  status: 'open' | 'investigating' | 'resolved' | 'false-positive' | string
  className?: string
}

const statusIcons = {
  open: AlertCircle,
  investigating: Clock,
  resolved: CheckCircle,
  'false-positive': CheckCircle,
} as const

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace('_', '-') as keyof typeof statusBadges
  const config = statusBadges[normalizedStatus === 'false-positive' ? 'falsePositive' : normalizedStatus] || statusBadges.open
  const Icon = statusIcons[normalizedStatus as keyof typeof statusIcons] || AlertCircle

  return (
    <Badge className={cn(config.className, 'px-2 py-1 text-xs font-medium', className)}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  )
}