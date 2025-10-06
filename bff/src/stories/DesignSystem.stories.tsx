import type { Meta, StoryObj } from '@storybook/react';
import { StyledCard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/styled-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { StatsCard } from '@/components/ui/stats-card';
import { Activity, AlertCircle, Clock, CheckCircle, Shield } from 'lucide-react';
import * as DS from '@/lib/design-system';

const meta: Meta = {
  title: 'Design System/Components',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const StandardizedCards: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Standardized Card Components</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Using the centralized design system for consistent styling
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Card Variants</h3>
        <div className="grid grid-cols-2 gap-4">
          <StyledCard>
            <CardHeader>
              <CardTitle>Default Card</CardTitle>
              <CardDescription>Standard card with soft borders</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={DS.text.secondary}>
                This card uses the default styling from the design system.
              </p>
            </CardContent>
          </StyledCard>

          <StyledCard variant="error">
            <CardHeader>
              <CardTitle className={DS.text.error}>Error Card</CardTitle>
              <CardDescription className="text-red-600 dark:text-red-400">
                Critical issue detected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className={DS.text.error}>
                Error variant with appropriate coloring.
              </p>
            </CardContent>
          </StyledCard>

          <StyledCard variant="warning">
            <CardHeader>
              <CardTitle className="text-amber-800 dark:text-amber-200">Warning Card</CardTitle>
              <CardDescription className="text-amber-600 dark:text-amber-400">
                Attention required
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-amber-700 dark:text-amber-300">
                Warning variant for caution states.
              </p>
            </CardContent>
          </StyledCard>

          <StyledCard variant="success">
            <CardHeader>
              <CardTitle className="text-emerald-800 dark:text-emerald-200">Success Card</CardTitle>
              <CardDescription className="text-emerald-600 dark:text-emerald-400">
                Operation completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-emerald-700 dark:text-emerald-300">
                Success variant for positive states.
              </p>
            </CardContent>
          </StyledCard>
        </div>
      </div>
    </div>
  ),
};

export const StandardizedBadges: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Standardized Badge Components</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Reusable badge components with consistent styling
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Status Badges</h3>
        <div className="flex gap-4 flex-wrap">
          <StatusBadge status="open" />
          <StatusBadge status="investigating" />
          <StatusBadge status="resolved" />
          <StatusBadge status="false-positive" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Severity Badges</h3>
        <div className="flex gap-4 flex-wrap">
          <SeverityBadge severity="CRITICAL" />
          <SeverityBadge severity="HIGH" />
          <SeverityBadge severity="MEDIUM" />
          <SeverityBadge severity="LOW" />
        </div>
      </div>
    </div>
  ),
};

export const StandardizedStatsCards: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Standardized Stats Cards</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Reusable stats card components with consistent styling and soft borders
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="Total Signals"
          value="1,234"
          icon={Activity}
          iconColor="blue"
        />
        <StatsCard
          title="Open"
          value="42"
          icon={AlertCircle}
          iconColor="red"
          valueColor="text-red-600 dark:text-red-400"
        />
        <StatsCard
          title="Investigating"
          value="18"
          icon={Clock}
          iconColor="amber"
          valueColor="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          title="Resolved"
          value="1,174"
          icon={CheckCircle}
          iconColor="emerald"
          valueColor="text-emerald-600 dark:text-emerald-400"
        />
      </div>
    </div>
  ),
};

export const DesignTokens: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Design System Tokens</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          All design tokens are centralized in <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">src/lib/design-system.ts</code>
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Border Styles</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 border rounded ${DS.borders.default}`}>
            <code className="text-sm">borders.default</code>
            <p className="text-xs text-gray-500 mt-1">border-gray-200 dark:border-gray-800</p>
          </div>
          <div className={`p-4 border rounded ${DS.borders.subtle}`}>
            <code className="text-sm">borders.subtle</code>
            <p className="text-xs text-gray-500 mt-1">border-gray-100 dark:border-gray-900</p>
          </div>
          <div className={`p-4 border rounded ${DS.borders.strong}`}>
            <code className="text-sm">borders.strong</code>
            <p className="text-xs text-gray-500 mt-1">border-gray-300 dark:border-gray-700</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Text Colors</h3>
        <div className="space-y-2">
          <p className={DS.text.primary}><code>text.primary</code> - Main text color</p>
          <p className={DS.text.secondary}><code>text.secondary</code> - Secondary text color</p>
          <p className={DS.text.muted}><code>text.muted</code> - Muted text color</p>
          <p className={DS.text.error}><code>text.error</code> - Error text color</p>
          <p className={DS.text.warning}><code>text.warning</code> - Warning text color</p>
          <p className={DS.text.success}><code>text.success</code> - Success text color</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Icon Backgrounds</h3>
        <div className="flex gap-4">
          <div className={`p-4 rounded-lg ${DS.iconBackgrounds.blue}`}>
            <Shield className={`w-6 h-6 ${DS.iconColors.blue}`} />
          </div>
          <div className={`p-4 rounded-lg ${DS.iconBackgrounds.red}`}>
            <AlertCircle className={`w-6 h-6 ${DS.iconColors.red}`} />
          </div>
          <div className={`p-4 rounded-lg ${DS.iconBackgrounds.amber}`}>
            <Clock className={`w-6 h-6 ${DS.iconColors.amber}`} />
          </div>
          <div className={`p-4 rounded-lg ${DS.iconBackgrounds.emerald}`}>
            <CheckCircle className={`w-6 h-6 ${DS.iconColors.emerald}`} />
          </div>
        </div>
      </div>
    </div>
  ),
};