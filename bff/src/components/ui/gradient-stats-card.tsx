import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/design-system'
import { LucideIcon } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

interface GradientStatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode | LucideIcon
  gradientFrom: string
  gradientTo: string
  iconBg: string
  iconColor: string
  borderColor?: string
  hoverBorderColor?: string
  navigateTo?: string
  navigateSearch?: any
  className?: string
}

export function GradientStatsCard({
  title,
  value,
  icon,
  gradientFrom,
  gradientTo,
  iconBg,
  iconColor,
  borderColor = 'border-slate-200/50 dark:border-slate-700/50',
  hoverBorderColor = 'hover:border-blue-300/50 dark:hover:border-blue-600/50',
  navigateTo,
  navigateSearch,
  className
}: GradientStatsCardProps) {
  const navigate = useNavigate()
  const isComponent = React.isValidElement(icon)
  const Icon = !isComponent ? icon as LucideIcon : null

  const handleClick = () => {
    if (navigateTo) {
      navigate({ to: navigateTo as any, search: navigateSearch })
    }
  }

  return (
    <div className="group relative">
      <div className={cn(
        'absolute -inset-1 rounded-3xl blur-lg opacity-20 group-hover:opacity-30 transition duration-300',
        `bg-gradient-to-r ${gradientFrom} ${gradientTo}`
      )} />
      <Card
        className={cn(
          'relative cursor-pointer bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border transition-all duration-300 hover:scale-105 hover:shadow-xl rounded-3xl',
          borderColor,
          hoverBorderColor,
          className
        )}
        onClick={handleClick}
      >
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className={cn(
              'p-3 rounded-2xl transition-colors duration-300',
              iconBg,
              `group-hover:${iconBg.replace('/20', '/30')}`
            )}>
              {isComponent ? icon : Icon && (
                <Icon className={cn('w-6 h-6', iconColor)} />
              )}
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {title}
              </p>
              <p className="text-3xl font-black text-slate-900 dark:text-white">
                {value}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}