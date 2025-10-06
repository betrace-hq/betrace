import { createFileRoute } from '@tanstack/react-router'
import { TenantManagement } from '@/components/tenant/tenant-management'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <TenantManagement />
    </div>
  )
}