import type { Meta, StoryObj } from '@storybook/react';
import { StatusInfoBadge } from '@/components/ui/status-info-badge';
import { FeatureCard } from '@/components/ui/feature-card';
import { IconContainer } from '@/components/ui/icon-container';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, AlertCircle, Lock, Zap, Eye, FileX, Inbox, Cloud, BarChart3, Users } from 'lucide-react';

const meta: Meta = {
  title: 'FLUO/Components',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const StatusInfoBadges: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold mb-4">Status Info Badges</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Used to display status information with icons and text.
      </p>

      <div className="flex gap-4 flex-wrap">
        <StatusInfoBadge variant="amber" icon={AlertCircle}>
          In Development
        </StatusInfoBadge>

        <StatusInfoBadge variant="blue" icon={Shield}>
          Security-First Design
        </StatusInfoBadge>

        <StatusInfoBadge variant="green" icon={CheckCircle}>
          Open Source
        </StatusInfoBadge>

        <StatusInfoBadge variant="red" icon={AlertCircle}>
          Critical Alert
        </StatusInfoBadge>
      </div>
    </div>
  ),
};

export const IconContainers: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold mb-4">Icon Containers</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Used for icons in feature sections with colored backgrounds.
      </p>

      <div className="flex gap-4 flex-wrap">
        <IconContainer icon={Cloud} variant="blue" />
        <IconContainer icon={BarChart3} variant="green" />
        <IconContainer icon={Users} variant="amber" />
        <IconContainer icon={AlertCircle} variant="red" />
      </div>
    </div>
  ),
};

export const FeatureCards: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold mb-4">Feature Cards</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Used to highlight key features or benefits.
      </p>

      <div className="grid grid-cols-3 gap-6">
        <FeatureCard
          icon={Shield}
          iconColor="blue"
          title="High Availability"
          description="99.9% uptime SLA"
        />

        <FeatureCard
          icon={Zap}
          iconColor="green"
          title="Real-Time Alerts"
          description="Sub-100ms detection"
        />

        <FeatureCard
          icon={Eye}
          iconColor="amber"
          title="Full Visibility"
          description="Complete trace context"
        />
      </div>

      <div className="grid grid-cols-3 gap-6 mt-6">
        <FeatureCard
          icon={Lock}
          iconColor="green"
          title="Zero Trust Security"
          description="End-to-end encryption"
        />

        <FeatureCard
          icon={CheckCircle}
          iconColor="amber"
          title="Compliance-Ready"
          description="Built for certification"
        />

        <FeatureCard
          icon={Shield}
          iconColor="blue"
          title="Designed for Reliability"
          description="Enterprise-grade performance"
        />
      </div>
    </div>
  ),
};

export const EmptyStates: Story = {
  render: () => (
    <div className="space-y-8">
      <h3 className="text-xl font-bold mb-4">Empty States</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Used when no data is available.
      </p>

      <div className="space-y-8">
        <EmptyState
          icon={Inbox}
          title="No items found"
          description="Start by creating your first item"
        >
          <Button>Create Item</Button>
        </EmptyState>

        <EmptyState
          icon={FileX}
          title="No rules found"
          description="No rules match your search criteria"
        />
      </div>
    </div>
  ),
};

export const LoadingStates: Story = {
  render: () => (
    <div className="space-y-8">
      <h3 className="text-xl font-bold mb-4">Loading States</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Shown while data is being fetched.
      </p>

      <div className="space-y-8">
        <div>
          <h4 className="font-semibold mb-3">Inline Loading</h4>
          <LoadingState message="Loading data..." />
        </div>

        <div>
          <h4 className="font-semibold mb-3">Full Screen Loading</h4>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden" style={{ height: '300px' }}>
            <LoadingState fullScreen message="Loading application..." />
          </div>
        </div>
      </div>
    </div>
  ),
};

export const ErrorStates: Story = {
  render: () => (
    <div className="space-y-8">
      <h3 className="text-xl font-bold mb-4">Error States</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Shown when an error occurs.
      </p>

      <div className="space-y-8">
        <div>
          <h4 className="font-semibold mb-3">Inline Error with Retry</h4>
          <ErrorState
            title="Failed to load data"
            message="Unable to fetch data. Please try again."
            onRetry={() => alert('Retrying...')}
          />
        </div>

        <div>
          <h4 className="font-semibold mb-3">Full Screen Error</h4>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden" style={{ height: '300px' }}>
            <ErrorState
              fullScreen
              title="Error Loading Rules"
              message="Failed to load rules. Please try again."
              onRetry={() => alert('Retrying...')}
            />
          </div>
        </div>
      </div>
    </div>
  ),
};
