import * as React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { borders, cards, cn } from '@/lib/design-system'

interface StyledCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof cards
  children?: React.ReactNode
}

export function StyledCard({ variant = 'default', className, children, ...props }: StyledCardProps) {
  return (
    <Card className={cn(cards[variant], className)} {...props}>
      {children}
    </Card>
  )
}

// Re-export card components for convenience
export { CardContent, CardDescription, CardFooter, CardHeader, CardTitle }