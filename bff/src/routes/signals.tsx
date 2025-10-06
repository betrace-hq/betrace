import { createFileRoute, Outlet } from '@tanstack/react-router'

function SignalsLayout() {
  // This route now needs to handle both:
  // 1. /signals (show the signals list)
  // 2. /signals/$id (show the signal detail as child)
  return <Outlet />
}

export const Route = createFileRoute('/signals')({
  component: SignalsLayout,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      status: (search.status as string) || '',
      severity: (search.severity as string) || '',
      service: (search.service as string) || '',
      page: Number(search.page) || 1,
      limit: Number(search.limit) || 20,
    }
  },
})