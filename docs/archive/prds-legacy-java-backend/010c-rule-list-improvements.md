# PRD-010c: Rule List Component Improvements

**Parent PRD:** PRD-010 (Rule Management UI)
**Unit:** C
**Priority:** P0
**Dependencies:** None (works with existing rule API)

## Scope

Enhance the existing rule list component with improved filtering, bulk actions, and better UX. The current `rules-page.tsx` has basic CRUD operations but lacks advanced filtering and bulk management features.

**Current State:** Basic rule table with search, sort, and individual enable/disable/edit/delete actions.

**Goal:** Professional rule management interface with:
- Advanced filtering (severity, status, tags, date ranges)
- Bulk operations (enable/disable multiple rules, bulk delete)
- Rule templates and quick actions
- Improved visual hierarchy and status indicators
- Keyboard shortcuts for power users

## Implementation

### Enhanced Rule List Component

```typescript
// src/components/rules/rule-list-filters.tsx
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, Filter, X, Calendar } from 'lucide-react';
import { useState } from 'react';

export interface RuleFilters {
  search: string;
  severity: 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'all' | 'active' | 'inactive';
  tags: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
}

interface RuleListFiltersProps {
  filters: RuleFilters;
  onFiltersChange: (filters: RuleFilters) => void;
  availableTags: string[];
}

export function RuleListFilters({
  filters,
  onFiltersChange,
  availableTags,
}: RuleListFiltersProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeFilterCount = [
    filters.severity !== 'all',
    filters.status !== 'all',
    filters.tags.length > 0,
    filters.dateRange !== undefined,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search rules by name, description, or expression..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>

        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-2 bg-blue-600 text-white">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-4" align="end">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Severity</h4>
                <Select
                  value={filters.severity}
                  onValueChange={(value: any) =>
                    onFiltersChange({ ...filters, severity: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Status</h4>
                <Select
                  value={filters.status}
                  onValueChange={(value: any) =>
                    onFiltersChange({ ...filters, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = filters.tags.includes(tag);
                    return (
                      <Badge
                        key={tag}
                        variant={isSelected ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          const newTags = isSelected
                            ? filters.tags.filter((t) => t !== tag)
                            : [...filters.tags, tag];
                          onFiltersChange({ ...filters, tags: newTags });
                        }}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onFiltersChange({
                    search: '',
                    severity: 'all',
                    status: 'all',
                    tags: [],
                  });
                  setIsFilterOpen(false);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.severity !== 'all' && (
            <Badge variant="secondary">
              Severity: {filters.severity}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, severity: 'all' })}
              />
            </Badge>
          )}
          {filters.status !== 'all' && (
            <Badge variant="secondary">
              Status: {filters.status}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, status: 'all' })}
              />
            </Badge>
          )}
          {filters.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              Tag: {tag}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    tags: filters.tags.filter((t) => t !== tag),
                  })
                }
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Bulk Actions Component

```typescript
// src/components/rules/rule-bulk-actions.tsx
import { Button } from '@/components/ui/button';
import { Play, Pause, Trash2, Copy, Download } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

interface RuleBulkActionsProps {
  selectedRuleIds: string[];
  onEnableSelected: () => Promise<void>;
  onDisableSelected: () => Promise<void>;
  onDeleteSelected: () => Promise<void>;
  onDuplicateSelected: () => Promise<void>;
  onExportSelected: () => void;
  isLoading?: boolean;
}

export function RuleBulkActions({
  selectedRuleIds,
  onEnableSelected,
  onDisableSelected,
  onDeleteSelected,
  onDuplicateSelected,
  onExportSelected,
  isLoading,
}: RuleBulkActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (selectedRuleIds.length === 0) return null;

  return (
    <>
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedRuleIds.length} rule{selectedRuleIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onEnableSelected}
              disabled={isLoading}
            >
              <Play className="h-4 w-4 mr-1" />
              Enable
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDisableSelected}
              disabled={isLoading}
            >
              <Pause className="h-4 w-4 mr-1" />
              Disable
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDuplicateSelected}
              disabled={isLoading}
            >
              <Copy className="h-4 w-4 mr-1" />
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onExportSelected}
              disabled={isLoading}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedRuleIds.length} rule(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected rules will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onDeleteSelected();
                setShowDeleteConfirm(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Enhanced Rules Table with Selection

```typescript
// Update rules-page.tsx to support selection and bulk actions

import { Checkbox } from '@/components/ui/checkbox';
import { RuleListFilters, type RuleFilters } from './rule-list-filters';
import { RuleBulkActions } from './rule-bulk-actions';

export function RulesPage() {
  // ... existing state

  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<RuleFilters>({
    search: '',
    severity: 'all',
    status: 'all',
    tags: [],
  });

  // Apply filters to rules
  const filteredRules = ((rules || []) as any[])
    .filter((rule: any) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          rule.name?.toLowerCase().includes(searchLower) ||
          rule.description?.toLowerCase().includes(searchLower) ||
          rule.expression?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Severity filter
      if (filters.severity !== 'all' && rule.severity !== filters.severity) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all') {
        const isActive = filters.status === 'active';
        if (rule.active !== isActive) return false;
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const ruleTags = rule.tags || [];
        const hasAllTags = filters.tags.every((tag) => ruleTags.includes(tag));
        if (!hasAllTags) return false;
      }

      return true;
    })
    .sort(/* existing sort logic */);

  // Extract all unique tags from rules
  const availableTags = Array.from(
    new Set((rules || []).flatMap((r: any) => r.tags || []))
  );

  // Bulk action handlers
  const handleEnableSelected = async () => {
    await Promise.all(
      selectedRuleIds.map((id) => activateRule.mutateAsync(id))
    );
    setSelectedRuleIds([]);
  };

  const handleDisableSelected = async () => {
    await Promise.all(
      selectedRuleIds.map((id) => deactivateRule.mutateAsync(id))
    );
    setSelectedRuleIds([]);
  };

  const handleDeleteSelected = async () => {
    await Promise.all(
      selectedRuleIds.map((id) => deleteRule.mutateAsync(id))
    );
    setSelectedRuleIds([]);
  };

  const handleDuplicateSelected = async () => {
    const selectedRules = filteredRules.filter((r) =>
      selectedRuleIds.includes(r.id)
    );
    await Promise.all(
      selectedRules.map((rule) =>
        createRule.mutateAsync({
          ...rule,
          name: `${rule.name} (Copy)`,
          id: undefined,
        })
      )
    );
    setSelectedRuleIds([]);
  };

  const handleExportSelected = () => {
    const selectedRules = filteredRules.filter((r) =>
      selectedRuleIds.includes(r.id)
    );
    const dataStr = JSON.stringify(selectedRules, null, 2);
    const dataUri =
      'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'betrace-rules-export.json');
    linkElement.click();
  };

  const toggleRuleSelection = (ruleId: string) => {
    setSelectedRuleIds((prev) =>
      prev.includes(ruleId)
        ? prev.filter((id) => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRuleIds.length === filteredRules.length) {
      setSelectedRuleIds([]);
    } else {
      setSelectedRuleIds(filteredRules.map((r) => r.id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header ... */}

        {/* Filters */}
        <RuleListFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableTags={availableTags}
        />

        {/* Bulk Actions */}
        <RuleBulkActions
          selectedRuleIds={selectedRuleIds}
          onEnableSelected={handleEnableSelected}
          onDisableSelected={handleDisableSelected}
          onDeleteSelected={handleDeleteSelected}
          onDuplicateSelected={handleDuplicateSelected}
          onExportSelected={handleExportSelected}
          isLoading={
            activateRule.isPending ||
            deactivateRule.isPending ||
            deleteRule.isPending
          }
        />

        {/* Table with selection */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="w-12">
                    <Checkbox
                      checked={
                        filteredRules.length > 0 &&
                        selectedRuleIds.length === filteredRules.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableCell>
                  {/* ... existing columns */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRuleIds.includes(rule.id)}
                        onCheckedChange={() => toggleRuleSelection(rule.id)}
                      />
                    </TableCell>
                    {/* ... existing cells */}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

## Success Criteria

- [ ] Advanced filtering works for severity, status, and tags
- [ ] Search filters across name, description, and expression
- [ ] Bulk selection with checkbox in table header and rows
- [ ] Bulk enable/disable/delete/duplicate/export actions
- [ ] Active filters are displayed as removable badges
- [ ] Filter popover shows active filter count
- [ ] Keyboard shortcuts (Cmd/Ctrl+A to select all, Delete to bulk delete)
- [ ] Export creates JSON file with selected rules

## Testing Requirements

### Unit Tests (Vitest)
```typescript
// src/components/rules/rule-list-filters.test.tsx
describe('RuleListFilters', () => {
  it('renders search input', () => {
    render(<RuleListFilters filters={...} onFiltersChange={...} availableTags={[]} />);
    expect(screen.getByPlaceholderText(/search rules/i)).toBeInTheDocument();
  });

  it('calls onFiltersChange when search changes', () => {
    const onFiltersChange = vi.fn();
    render(<RuleListFilters filters={...} onFiltersChange={onFiltersChange} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'payment' },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'payment' })
    );
  });

  it('displays active filter count badge', () => {
    const filters = { severity: 'CRITICAL', status: 'active', tags: ['prod'] };
    render(<RuleListFilters filters={filters} onFiltersChange={...} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 active filters
  });
});

// src/components/rules/rule-bulk-actions.test.tsx
describe('RuleBulkActions', () => {
  it('does not render when no rules selected', () => {
    const { container } = render(<RuleBulkActions selectedRuleIds={[]} ... />);
    expect(container.firstChild).toBeNull();
  });

  it('shows selected count', () => {
    render(<RuleBulkActions selectedRuleIds={['1', '2', '3']} ... />);
    expect(screen.getByText('3 rules selected')).toBeInTheDocument();
  });

  it('calls onDeleteSelected after confirmation', async () => {
    const onDeleteSelected = vi.fn();
    render(<RuleBulkActions selectedRuleIds={['1']} onDeleteSelected={onDeleteSelected} ... />);

    fireEvent.click(screen.getByText(/delete/i));
    await screen.findByText(/delete 1 rule/i);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(onDeleteSelected).toHaveBeenCalled();
  });
});
```

### Storybook Stories
```typescript
// src/stories/RuleListFilters.stories.tsx
export const Default: Story = {
  args: {
    filters: {
      search: '',
      severity: 'all',
      status: 'all',
      tags: [],
    },
    availableTags: ['production', 'staging', 'compliance', 'security'],
    onFiltersChange: (filters) => console.log('Filters changed:', filters),
  },
};

export const WithActiveFilters: Story = {
  args: {
    filters: {
      search: 'payment',
      severity: 'CRITICAL',
      status: 'active',
      tags: ['production'],
    },
    availableTags: ['production', 'staging'],
    onFiltersChange: (filters) => console.log('Filters changed:', filters),
  },
};
```

## Files to Create

- `/Users/sscoble/Projects/betrace/bff/src/components/rules/rule-list-filters.tsx` - Advanced filtering component
- `/Users/sscoble/Projects/betrace/bff/src/components/rules/rule-bulk-actions.tsx` - Bulk action toolbar
- `/Users/sscoble/Projects/betrace/bff/src/components/rules/rule-list-filters.test.tsx` - Filter tests
- `/Users/sscoble/Projects/betrace/bff/src/components/rules/rule-bulk-actions.test.tsx` - Bulk action tests
- `/Users/sscoble/Projects/betrace/bff/src/stories/RuleListFilters.stories.tsx` - Filter stories
- `/Users/sscoble/Projects/betrace/bff/src/stories/RuleBulkActions.stories.tsx` - Bulk action stories

## Files to Modify

- `/Users/sscoble/Projects/betrace/bff/src/components/rules/rules-page.tsx` - Add selection state, integrate filters and bulk actions

## Integration Notes

- **Checkbox Component**: Use shadcn/ui `Checkbox` for consistent styling
- **Keyboard Shortcuts**: Consider adding keyboard shortcuts for power users (Cmd+A for select all)
- **Performance**: For large rule lists (>100 rules), consider virtualization with `@tanstack/react-virtual`
- **Export Format**: Export to JSON for easy import/backup and rule sharing
