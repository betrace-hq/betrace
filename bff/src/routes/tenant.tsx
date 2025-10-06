import { createFileRoute } from '@tanstack/react-router'
import { TenantPage } from '@/components/tenant/tenant-page'

export const Route = createFileRoute('/tenant')({
  component: TenantPage,
  beforeLoad: ({ context }) => {
    // Require authentication and admin access
    const auth = context.auth || {}
    if (!auth.isAuthenticated) {
      throw new Error('Authentication required')
    }
    // Additional tenant admin check would go here
  },
})