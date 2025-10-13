import { createFileRoute } from '@tanstack/react-router'
import { ComplianceDashboard } from '../components/compliance/compliance-dashboard'

/**
 * PRD-004: Compliance Dashboard Route
 *
 * Route: /compliance
 *
 * Displays real-time compliance posture with control coverage grid.
 */
export const Route = createFileRoute('/compliance')({
  component: CompliancePage,
})

function CompliancePage() {
  return (
    <div className="container mx-auto py-6">
      <ComplianceDashboard />
    </div>
  )
}
