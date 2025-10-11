import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/ui/placeholder-page'
import { Layout } from '@/components/layout/layout'
import { BookOpen, Code, Puzzle, GraduationCap } from 'lucide-react'

export const Route = createFileRoute('/documentation')({
  component: DocumentationPage,
})

const sections = [
  {
    title: 'Getting Started',
    description: 'Learn the basics and get up and running with FLUO in minutes.',
    icon: GraduationCap,
  },
  {
    title: 'API Reference',
    description: 'Complete API documentation with examples and best practices.',
    icon: Code,
  },
  {
    title: 'Integration Guides',
    description: 'Step-by-step guides for integrating FLUO with your existing tools.',
    icon: Puzzle,
  },
  {
    title: 'Best Practices',
    description: 'Learn how to optimize your behavioral rules and signal workflows.',
    icon: BookOpen,
  },
]

const primaryAction = {
  label: 'Request Early Access',
  onClick: () => (window.location.href = '/auth'),
}

const secondaryAction = {
  label: 'Back to Home',
  onClick: () => (window.location.href = '/'),
}

function DocumentationPage() {
  return (
    <Layout>
      <PlaceholderPage
        icon={BookOpen}
        title="Documentation"
        description="Comprehensive guides, API references, and tutorials to help you get the most out of FLUO's behavioral assurance platform."
        sections={sections}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
      />
    </Layout>
  )
}
