import type { Meta, StoryObj } from '@storybook/react';
import { PlaceholderPage } from '@/components/ui/placeholder-page';
import { BookOpen, Mail, Code, Puzzle, GraduationCap, Phone, MessageSquare, Calendar } from 'lucide-react';

const meta: Meta<typeof PlaceholderPage> = {
  title: 'BeTrace/Placeholder Pages',
  component: PlaceholderPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof PlaceholderPage>;

export const Documentation: Story = {
  args: {
    icon: BookOpen,
    title: 'Documentation',
    description: 'Comprehensive guides, API references, and tutorials to help you get the most out of BeTrace\'s behavioral assurance platform.',
    sections: [
      {
        title: 'Getting Started',
        description: 'Learn the basics and get up and running with BeTrace in minutes.',
        icon: GraduationCap,
      },
      {
        title: 'API Reference',
        description: 'Complete API documentation with examples and best practices.',
        icon: Code,
      },
      {
        title: 'Integration Guides',
        description: 'Step-by-step guides for integrating BeTrace with your existing tools.',
        icon: Puzzle,
      },
      {
        title: 'Best Practices',
        description: 'Learn how to optimize your behavioral rules and signal workflows.',
        icon: BookOpen,
      },
    ],
    primaryAction: {
      label: 'Request Early Access',
      onClick: () => console.log('Primary action clicked'),
    },
    secondaryAction: {
      label: 'Back to Home',
      onClick: () => console.log('Secondary action clicked'),
    },
  },
};

export const ContactSales: Story = {
  args: {
    icon: Mail,
    title: 'Contact Sales',
    description: 'Get in touch with our team to discuss how BeTrace can help your organization achieve behavioral assurance at scale.',
    sections: [
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
    ],
    primaryAction: {
      label: 'Schedule Enterprise Demo',
      onClick: () => console.log('Primary action clicked'),
    },
    secondaryAction: {
      label: 'Back to Home',
      onClick: () => console.log('Secondary action clicked'),
    },
  },
};

export const MinimalPlaceholder: Story = {
  args: {
    icon: Code,
    title: 'Coming Soon',
    description: 'This feature is currently under development and will be available soon.',
    primaryAction: {
      label: 'Get Notified',
      onClick: () => console.log('Primary action clicked'),
    },
  },
};

export const NoActions: Story = {
  args: {
    icon: Puzzle,
    title: 'Feature Preview',
    description: 'We\'re working hard to bring you this exciting new feature.',
    sections: [
      {
        title: 'Advanced Analytics',
        description: 'Deep insights into your system behavior patterns.',
      },
      {
        title: 'Custom Integrations',
        description: 'Build and deploy your own behavioral rules.',
      },
    ],
  },
};
