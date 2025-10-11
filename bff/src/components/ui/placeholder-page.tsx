import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StyledCard, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/styled-card'
import { cn } from '@/lib/design-system'

export interface PlaceholderPageProps {
  /**
   * Icon to display at the top
   */
  icon: LucideIcon

  /**
   * Main title of the page
   */
  title: string

  /**
   * Subtitle or description
   */
  description: string

  /**
   * Optional additional content sections
   */
  sections?: Array<{
    title: string
    description: string
    icon?: LucideIcon
  }>

  /**
   * Primary CTA button
   */
  primaryAction?: {
    label: string
    onClick: () => void
  }

  /**
   * Secondary CTA button
   */
  secondaryAction?: {
    label: string
    onClick: () => void
  }

  /**
   * Optional custom className
   */
  className?: string
}

export function PlaceholderPage({
  icon: Icon,
  title,
  description,
  sections = [],
  primaryAction,
  secondaryAction,
  className,
}: PlaceholderPageProps) {
  return (
    <div className={cn('min-h-screen bg-gray-50 dark:bg-gray-900', className)}>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
            <Icon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {title}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        {/* Sections */}
        {sections.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {sections.map((section, index) => {
              const SectionIcon = section.icon
              return (
                <StyledCard key={index}>
                  <CardHeader>
                    {SectionIcon && (
                      <div className="mb-3">
                        <SectionIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </CardHeader>
                </StyledCard>
              )
            })}
          </div>
        )}

        {/* CTA Section */}
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {primaryAction && (
              <Button size="lg" onClick={primaryAction.onClick}>
                {primaryAction.label}
              </Button>
            )}
            {secondaryAction && (
              <Button size="lg" variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}

        {/* Coming Soon Badge */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Coming Soon
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
