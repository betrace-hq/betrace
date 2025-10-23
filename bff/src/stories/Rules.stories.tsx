import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Play, Pause, Edit, Trash2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// Reusable Components
const RulesPageHeader = ({ showCreateButton = true }: { showCreateButton?: boolean }) => (
  <div className="flex justify-between items-center mb-8">
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Behavioral Rules
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        Define and manage rules for monitoring service behavior
      </p>
    </div>
    {showCreateButton && (
      <Button className="bg-blue-600 text-white hover:bg-blue-700 font-semibold">
        <Plus className="w-4 h-4 mr-2" />
        Create New Rule
      </Button>
    )}
  </div>
);

const meta: Meta = {
  title: 'BeTrace/Rules',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

// Sample rule data
const sampleRules = [
  {
    id: '1',
    name: 'High Response Time Alert',
    description: 'Trigger when response time exceeds 500ms for critical endpoints',
    severity: 'CRITICAL',
    expression: 'responseTime > 500 && endpoint.startsWith("/api/critical")',
    active: true,
  },
  {
    id: '2',
    name: 'Error Rate Threshold',
    description: 'Monitor error rate and alert when it exceeds 5%',
    severity: 'HIGH',
    expression: 'errorRate > 0.05',
    active: true,
  },
  {
    id: '3',
    name: 'Database Connection Pool',
    description: 'Alert when database connection pool is running low',
    severity: 'MEDIUM',
    expression: 'dbConnections.available < 10',
    active: false,
  },
  {
    id: '4',
    name: 'Memory Usage Warning',
    description: 'Warn when memory usage approaches limit',
    severity: 'LOW',
    expression: 'memoryUsage > 0.80',
    active: true,
  },
];

/**
 * Rules Table - Default view showing all behavioral assurance rules
 *
 * This view shows a complete rules management interface with:
 * - Page header with title and create button
 * - Search functionality
 * - Comprehensive rules table with all rule details
 * - Action buttons for each rule
 */
export const RulesTable: Story = {
  render: () => (
    <div className="max-w-7xl mx-auto">
      <RulesPageHeader />

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search rules..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Rules Table */}
      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800">
                <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                  <button className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400">
                    Rule
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead className="font-semibold text-gray-900 dark:text-gray-100 w-32">
                  <button className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400">
                    Severity
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead className="font-semibold text-gray-900 dark:text-gray-100 w-24">
                  <button className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400">
                    Status
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead className="font-semibold text-gray-900 dark:text-gray-100 w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRules.map((rule, index) => (
                <TableRow key={rule.id} className={index !== sampleRules.length - 1 ? "border-b border-gray-200 dark:border-gray-700" : ""}>
                  <TableCell className="py-4">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white mb-1">
                        {rule.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {rule.description}
                      </div>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                        {rule.expression}
                      </code>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 align-top">
                    {rule.severity === 'CRITICAL' && (
                      <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                        Critical
                      </Badge>
                    )}
                    {rule.severity === 'HIGH' && (
                      <Badge className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700">
                        High
                      </Badge>
                    )}
                    {rule.severity === 'MEDIUM' && (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">
                        Medium
                      </Badge>
                    )}
                    {rule.severity === 'LOW' && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                        Low
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-4 align-top">
                    {rule.active ? (
                      <Badge className="bg-green-600 text-white border-green-700 inline-flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-500 text-white border-gray-600 inline-flex items-center gap-1">
                        <Pause className="w-3 h-3" />
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-4 align-top">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline">
                        {rule.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  ),
};

/**
 * Empty State - No rules created yet
 */
export const EmptyState: Story = {
  render: () => (
    <div className="max-w-7xl mx-auto">
      <RulesPageHeader showCreateButton={false} />

      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No rules found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first rule to start monitoring your services.
            </p>
            <Button className="bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};

/**
 * Severity Badges - All severity levels displayed
 */
export const SeverityBadges: Story = {
  render: () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Rule Severity Levels
      </h2>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
            Critical
          </Badge>
          <span className="text-gray-600 dark:text-gray-400">
            Immediate action required - system-critical issues
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700">
            High
          </Badge>
          <span className="text-gray-600 dark:text-gray-400">
            Significant impact - requires prompt attention
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">
            Medium
          </Badge>
          <span className="text-gray-600 dark:text-gray-400">
            Moderate impact - should be addressed soon
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
            Low
          </Badge>
          <span className="text-gray-600 dark:text-gray-400">
            Minor impact - can be scheduled for later
          </span>
        </div>
      </div>
    </div>
  ),
};

/**
 * Status Badges - Active and Inactive rule states
 */
export const StatusBadges: Story = {
  render: () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Rule Status
      </h2>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Badge className="bg-green-600 text-white border-green-700 inline-flex items-center gap-1">
            <Play className="w-3 h-3" />
            Active
          </Badge>
          <span className="text-gray-600 dark:text-gray-400">
            Rule is actively monitoring service behavior
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Badge className="bg-gray-500 text-white border-gray-600 inline-flex items-center gap-1">
            <Pause className="w-3 h-3" />
            Inactive
          </Badge>
          <span className="text-gray-600 dark:text-gray-400">
            Rule is disabled and not monitoring
          </span>
        </div>
      </div>
    </div>
  ),
};

/**
 * Rule Card - Individual rule display
 */
export const RuleCard: Story = {
  render: () => (
    <div className="max-w-2xl mx-auto">
      <Card className="border-l-4 border-l-red-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                High Response Time Alert
              </CardTitle>
              <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                Critical
              </Badge>
              <Badge className="bg-green-600 text-white border-green-700 inline-flex items-center gap-1">
                <Play className="w-3 h-3" />
                Active
              </Badge>
            </div>
          </div>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Trigger when response time exceeds 500ms for critical endpoints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                OGNL Expression
              </h4>
              <code className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 rounded border border-gray-200 dark:border-gray-600 block">
                responseTime &gt; 500 &amp;&amp; endpoint.startsWith(&quot;/api/critical&quot;)
              </code>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button size="sm" variant="outline">
                <Pause className="w-4 h-4 mr-2" />
                Deactivate
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};

/**
 * Filtered Search - Search results view
 */
export const FilteredSearch: Story = {
  render: () => (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Behavioral Rules
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Define and manage rules for monitoring service behavior
          </p>
        </div>
        <Button className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Create New Rule
        </Button>
      </div>

      {/* Search with active search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-4 top-4 h-5 w-5 text-blue-600" />
            <Input
              placeholder="Search rules by name, description, or expression..."
              className="pl-12 py-4 border-blue-300"
              defaultValue="response time"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filtered Results */}
      <Card>
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
          <CardTitle className="flex items-center gap-3 text-xl font-semibold">
            <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Search Results (1)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <TableHead className="w-32 font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="w-32 font-semibold">Severity</TableHead>
                  <TableHead className="font-semibold">Expression</TableHead>
                  <TableHead className="w-36 font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="py-4">
                    <Badge className="bg-green-600 text-white border-green-700 inline-flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      Active
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900 dark:text-white py-4">
                    High <mark className="bg-yellow-200 dark:bg-yellow-900">Response Time</mark> Alert
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400 py-4">
                    Trigger when <mark className="bg-yellow-200 dark:bg-yellow-900">response time</mark> exceeds 500ms
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                      Critical
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 block">
                      <mark className="bg-yellow-200 dark:bg-yellow-900">responseTime</mark> &gt; 500
                    </code>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="outline">
                        <Pause className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};
