import { createFileRoute } from '@tanstack/react-router'
import { SignalsPageClean } from '@/components/signals/signals-page-clean'

export const Route = createFileRoute('/signals/')({
  component: SignalsPageClean,
})