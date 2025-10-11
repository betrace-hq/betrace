import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/design-system'

const iconContainerVariants = cva(
  'p-3 rounded-lg',
  {
    variants: {
      variant: {
        blue: 'bg-blue-50 dark:bg-blue-950/30',
        green: 'bg-green-50 dark:bg-green-950/30',
        amber: 'bg-amber-50 dark:bg-amber-950/30',
        red: 'bg-red-50 dark:bg-red-950/30',
      },
    },
    defaultVariants: {
      variant: 'blue',
    },
  }
)

const iconVariants = {
  blue: 'text-blue-700 dark:text-blue-300',
  green: 'text-green-700 dark:text-green-300',
  amber: 'text-amber-700 dark:text-amber-300',
  red: 'text-red-700 dark:text-red-300',
}

export interface IconContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconContainerVariants> {
  icon: LucideIcon
}

export function IconContainer({
  icon: Icon,
  variant = 'blue',
  className,
  ...props
}: IconContainerProps) {
  const iconColorClass = iconVariants[variant || 'blue']

  return (
    <div className={cn(iconContainerVariants({ variant }), className)} {...props}>
      <Icon className={cn('w-6 h-6', iconColorClass)} />
    </div>
  )
}
