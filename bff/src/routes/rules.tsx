import { createFileRoute } from '@tanstack/react-router'
import { RulesPageWithAuth } from '@/components/rules/rules-page'

export const Route = createFileRoute('/rules')({
  component: RulesPageWithAuth,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      search: (search.search as string) || '',
      active: search.active === 'true' || search.active === true,
    }
  },
})