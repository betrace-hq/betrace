import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Column<T> {
  header: string
  accessorKey?: keyof T
  cell?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T) => void
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            {columns.map((column, index) => (
              <TableHead
                key={index}
                className="h-10 px-3 text-left align-middle font-medium text-slate-900 dark:text-white text-xs border-r border-slate-200 dark:border-slate-700 last:border-r-0"
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, rowIndex) => (
            <TableRow
              key={rowIndex}
              className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200 last:border-b-0"
              onClick={() => onRowClick?.(item)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((column, columnIndex) => (
                <TableCell
                  key={columnIndex}
                  className={`h-12 px-3 align-middle border-r border-slate-200 dark:border-slate-700 last:border-r-0 ${
                    column.className || ''
                  }`}
                >
                  {column.cell
                    ? column.cell(item)
                    : column.accessorKey
                    ? item[column.accessorKey]
                    : null}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Utility badge components for consistent styling
export const StatusBadge = ({
  status,
  variant = 'default',
}: {
  status: string
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default'
}) => {
  const variants = {
    success: 'bg-emerald-600 text-white',
    warning: 'bg-amber-500 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
    default: 'bg-slate-500 text-white',
  }

  return (
    <span
      className={`inline-flex items-center font-medium px-2 py-0.5 rounded text-xs ${variants[variant]}`}
    >
      {status}
    </span>
  )
}

export const SeverityBadge = ({ severity }: { severity: string }) => {
  const severityConfig = {
    CRITICAL: 'bg-red-100 text-red-800 border-red-200',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    LOW: 'bg-blue-100 text-blue-800 border-blue-200',
  } as const

  const normalizedSeverity = severity.toUpperCase() as keyof typeof severityConfig
  const config = severityConfig[normalizedSeverity] || severityConfig.LOW

  return (
    <span
      className={`${config} border font-medium px-1.5 py-0.5 rounded text-xs`}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase()}
    </span>
  )
}