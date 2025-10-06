import { createFileRoute } from '@tanstack/react-router'
import { SignalDetailPage } from '@/components/signals/signal-detail-page'

export const Route = createFileRoute('/signals/$id')({
  component: SignalDetailPage,
})