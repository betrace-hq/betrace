import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/design-system'
import { Badge } from '@/components/ui/badge'

export interface MetadataItem {
  label: string
  value: string | number | React.ReactNode
  /** Optional icon to display next to the label */
  icon?: LucideIcon
  /** Span full width for longer content */
  fullWidth?: boolean
  /** Render value as monospace code */
  mono?: boolean
  /** Optional badge variant */
  badge?: 'default' | 'secondary' | 'outline'
}

export interface MetadataGridProps {
  /**
   * Metadata items to display
   */
  items: MetadataItem[]

  /**
   * Number of columns (default: 2)
   */
  columns?: 1 | 2 | 3 | 4

  /**
   * Optional className
   */
  className?: string
}

export function MetadataGrid({ items, columns = 2, className }: MetadataGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {items.map((item, index) => {
        const Icon = item.icon
        const colSpan = item.fullWidth ? 'col-span-full' : ''

        return (
          <div key={index} className={cn('space-y-1', colSpan)}>
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
              {Icon && <Icon className="w-4 h-4" />}
              <span>{item.label}</span>
            </div>
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {item.badge && typeof item.value === 'string' ? (
                <Badge variant={item.badge}>{item.value}</Badge>
              ) : item.mono && typeof item.value === 'string' ? (
                <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  {item.value}
                </code>
              ) : (
                <div className={item.mono ? 'font-mono' : ''}>{item.value}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
