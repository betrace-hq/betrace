import { createFileRoute } from '@tanstack/react-router'
import { SecurityDashboard } from '@/components/security/security-dashboard'

export const Route = createFileRoute('/security')({
  component: SecurityDashboard,
  beforeLoad: ({ context }) => {
    // Require authentication and admin access
    const auth = context.auth || {}
    if (!auth.isAuthenticated) {
      throw new Error('Authentication required')
    }
    // Additional security admin check would go here
  },
})