import * as React from 'react'
import { StyledCard, CardContent } from '@/components/ui/styled-card'
import { iconBackgrounds, iconColors, text, spacing, cn } from '@/lib/design-system'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: keyof typeof iconColors
  valueColor?: string
  className?: string
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor = 'blue',
  valueColor,
  className
}: StatsCardProps) {
  return (
    <StyledCard className={className}>
      <CardContent className={spacing.cardPadding}>
        <div className="flex items-center justify-between">
          <div>
            <p className={cn('text-sm', text.secondary)}>{title}</p>
            <p className={cn('text-2xl font-bold', valueColor || text.primary)}>
              {value}
            </p>
          </div>
          <div className={cn('p-3 rounded-lg', iconBackgrounds[iconColor])}>
            <Icon className={cn('w-6 h-6', iconColors[iconColor])} />
          </div>
        </div>
      </CardContent>
    </StyledCard>
  )
}