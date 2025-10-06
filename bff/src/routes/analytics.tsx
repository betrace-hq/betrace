import { createFileRoute } from '@tanstack/react-router'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'

export const Route = createFileRoute('/analytics')({
  component: AnalyticsPage,
})

function AnalyticsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <AnalyticsDashboard />
    </div>
  )
}