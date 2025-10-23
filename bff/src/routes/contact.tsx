import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/ui/placeholder-page'
import { Layout } from '@/components/layout/layout'
import { Mail, Phone, MessageSquare, Calendar } from 'lucide-react'

export const Route = createFileRoute('/contact')({
  component: ContactPage,
})

const sections = [
  {
    title: 'Enterprise Sales',
    description: 'Speak with our sales team about pricing, features, and custom deployments.',
    icon: Phone,
  },
  {
    title: 'Technical Consultation',
    description: 'Connect with our solutions architects to design your implementation.',
    icon: MessageSquare,
  },
  {
    title: 'Schedule a Demo',
    description: 'See BeTrace in action with a personalized demonstration for your team.',
    icon: Calendar,
  },
  {
    title: 'Support Inquiries',
    description: 'Existing customers can reach our support team for technical assistance.',
    icon: Mail,
  },
]

const primaryAction = {
  label: 'Schedule Enterprise Demo',
  onClick: () => (window.location.href = '/auth'),
}

const secondaryAction = {
  label: 'Back to Home',
  onClick: () => (window.location.href = '/'),
}

function ContactPage() {
  return (
    <Layout>
      <PlaceholderPage
        icon={Mail}
        title="Contact Sales"
        description="Get in touch with our team to discuss how BeTrace can help your organization achieve behavioral assurance at scale."
        sections={sections}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
      />
    </Layout>
  )
}
