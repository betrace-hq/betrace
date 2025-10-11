import * as React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/design-system'
import { TableHead } from '@/components/ui/table'

export type SortDirection = 'asc' | 'desc' | null

export interface SortableColumnProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /**
   * The label to display in the column header
   */
  children: React.ReactNode

  /**
   * The current sort state for this column
   */
  sortDirection?: SortDirection

  /**
   * Callback when the column is clicked to sort
   */
  onSort?: () => void

  /**
   * Whether sorting is enabled for this column
   */
  sortable?: boolean
}

export function SortableColumn({
  children,
  sortDirection = null,
  onSort,
  sortable = true,
  className,
  ...props
}: SortableColumnProps) {
  const getSortIcon = () => {
    if (!sortable) return null

    if (sortDirection === 'asc') {
      return <ArrowUp className="w-3 h-3" />
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="w-3 h-3" />
    }
    return <ArrowUpDown className="w-3 h-3 opacity-50" />
  }

  return (
    <TableHead
      className={cn('font-semibold text-gray-900 dark:text-gray-100', className)}
      {...props}
    >
      {sortable && onSort ? (
        <button
          onClick={onSort}
          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {children}
          {getSortIcon()}
        </button>
      ) : (
        children
      )}
    </TableHead>
  )
}
