# PRD-010e: Rule History and Version Tracking

**Parent PRD:** PRD-010 (Rule Management UI)
**Unit:** E
**Priority:** P1 (Nice-to-have, not blocking)
**Dependencies:** None (works with existing rule API)

## Scope

Implement rule version history tracking and audit trail to answer questions like "who changed this rule?" and "what was the previous version?". This is crucial for compliance, debugging, and team collaboration.

**Current State:** No version history tracking. Rule edits overwrite previous version with no audit trail.

**Goal:** Complete audit trail with:
- Version history for each rule (who, when, what changed)
- Diff view comparing versions
- Restore previous version capability
- Audit log of all rule operations (create, update, delete, enable, disable)
- Export audit trail for compliance reporting

## Implementation

### Rule History Component

```typescript
// src/components/rules/rule-history.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { History, Eye, RotateCcw, Download, User, Clock } from 'lucide-react';
import { useRuleHistory, useRestoreRuleVersion } from '@/lib/hooks/use-rule-history';
import { formatDistanceToNow } from 'date-fns';

interface RuleHistoryProps {
  ruleId: string;
}

interface RuleVersion {
  version: number;
  timestamp: Date;
  userId: string;
  userName: string;
  action: 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled';
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  snapshot: {
    name: string;
    description: string;
    expression: string;
    severity: string;
    active: boolean;
  };
}

export function RuleHistory({ ruleId }: RuleHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<RuleVersion | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);

  const { data: history, isLoading } = useRuleHistory(ruleId);
  const restoreVersion = useRestoreRuleVersion();

  const handleViewVersion = (version: RuleVersion) => {
    setSelectedVersion(version);
    setShowDiffDialog(true);
  };

  const handleRestoreVersion = async (version: RuleVersion) => {
    if (!confirm(`Restore rule to version ${version.version}?`)) return;

    try {
      await restoreVersion.mutateAsync({
        ruleId,
        version: version.version,
      });
      alert('Rule restored successfully');
    } catch (error) {
      alert('Failed to restore rule version');
    }
  };

  const handleExportHistory = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const dataUri =
      'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `rule-${ruleId}-history.json`);
    linkElement.click();
  };

  if (isLoading) {
    return <div>Loading history...</div>;
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          <History className="h-8 w-8 mx-auto mb-2" />
          <p>No version history available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </span>
            <Button variant="outline" size="sm" onClick={handleExportHistory}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell className="font-semibold">Version</TableCell>
                <TableCell className="font-semibold">Action</TableCell>
                <TableCell className="font-semibold">User</TableCell>
                <TableCell className="font-semibold">Time</TableCell>
                <TableCell className="font-semibold">Changes</TableCell>
                <TableCell className="font-semibold text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((version: RuleVersion) => (
                <TableRow key={version.version}>
                  <TableCell>
                    <Badge variant="outline">v{version.version}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        version.action === 'created'
                          ? 'default'
                          : version.action === 'deleted'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {version.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{version.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>
                        {formatDistanceToNow(new Date(version.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {version.changes.length === 0 ? (
                        <span className="text-gray-500">No changes</span>
                      ) : (
                        <span>
                          {version.changes.length} field
                          {version.changes.length !== 1 ? 's' : ''} changed
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewVersion(version)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {version.action !== 'deleted' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreVersion(version)}
                          disabled={restoreVersion.isPending}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diff Dialog */}
      {selectedVersion && (
        <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Version {selectedVersion.version} Details
              </DialogTitle>
              <DialogDescription>
                {selectedVersion.action} by {selectedVersion.userName} on{' '}
                {new Date(selectedVersion.timestamp).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Changes Summary */}
              {selectedVersion.changes.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Changes:</h4>
                  <div className="space-y-2">
                    {selectedVersion.changes.map((change, index) => (
                      <div
                        key={index}
                        className="border rounded p-3 bg-gray-50 dark:bg-gray-900"
                      >
                        <p className="font-semibold text-sm mb-1">
                          {change.field}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-2">
                            <p className="text-xs text-red-600 dark:text-red-400 font-semibold mb-1">
                              Before:
                            </p>
                            <pre className="text-xs whitespace-pre-wrap break-words">
                              {JSON.stringify(change.oldValue, null, 2)}
                            </pre>
                          </div>
                          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2">
                            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">
                              After:
                            </p>
                            <pre className="text-xs whitespace-pre-wrap break-words">
                              {JSON.stringify(change.newValue, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Snapshot */}
              <div>
                <h4 className="font-semibold mb-2">Full Rule Snapshot:</h4>
                <div className="border rounded p-3 bg-gray-50 dark:bg-gray-900">
                  <pre className="text-xs whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedVersion.snapshot, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
```

### History API Hooks

```typescript
// src/lib/hooks/use-rule-history.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useRuleHistory(ruleId: string) {
  return useQuery({
    queryKey: ['rule-history', ruleId],
    queryFn: async () => {
      // TODO: Replace with actual backend API call
      // GET /api/rules/:id/history

      // Mock data
      await new Promise((resolve) => setTimeout(resolve, 500));

      return [
        {
          version: 3,
          timestamp: new Date('2024-01-15T10:30:00Z'),
          userId: 'user-456',
          userName: 'Jane Smith',
          action: 'updated',
          changes: [
            {
              field: 'expression',
              oldValue: 'trace.has(payment.charge)',
              newValue:
                'trace.has(payment.charge).where(amount > 1000) and trace.has(fraud.check)',
            },
            {
              field: 'severity',
              oldValue: 'MEDIUM',
              newValue: 'CRITICAL',
            },
          ],
          snapshot: {
            name: 'Payment Fraud Check',
            description: 'Detect missing fraud checks on high-value payments',
            expression:
              'trace.has(payment.charge).where(amount > 1000) and trace.has(fraud.check)',
            severity: 'CRITICAL',
            active: true,
          },
        },
        {
          version: 2,
          timestamp: new Date('2024-01-10T14:20:00Z'),
          userId: 'user-123',
          userName: 'John Doe',
          action: 'enabled',
          changes: [
            {
              field: 'active',
              oldValue: false,
              newValue: true,
            },
          ],
          snapshot: {
            name: 'Payment Fraud Check',
            description: 'Detect missing fraud checks',
            expression: 'trace.has(payment.charge)',
            severity: 'MEDIUM',
            active: true,
          },
        },
        {
          version: 1,
          timestamp: new Date('2024-01-05T09:00:00Z'),
          userId: 'user-123',
          userName: 'John Doe',
          action: 'created',
          changes: [],
          snapshot: {
            name: 'Payment Fraud Check',
            description: 'Detect missing fraud checks',
            expression: 'trace.has(payment.charge)',
            severity: 'MEDIUM',
            active: false,
          },
        },
      ];
    },
  });
}

export function useRestoreRuleVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ruleId,
      version,
    }: {
      ruleId: string;
      version: number;
    }) => {
      // TODO: Replace with actual backend API call
      // POST /api/rules/:id/restore
      // Body: { version: number }

      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      queryClient.invalidateQueries({
        queryKey: ['rule-history', variables.ruleId],
      });
    },
  });
}
```

### Audit Log Component

```typescript
// src/components/rules/audit-log.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Download, Filter } from 'lucide-react';
import { useState } from 'react';
import { useAuditLog } from '@/lib/hooks/use-audit-log';
import { formatDistanceToNow } from 'date-fns';

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  ruleId?: string;
  ruleName?: string;
  details: string;
  ipAddress?: string;
}

export function AuditLog() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: auditLog, isLoading } = useAuditLog();

  const filteredLog = (auditLog || []).filter(
    (entry: AuditLogEntry) =>
      entry.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.ruleName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportLog = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Rule', 'Details', 'IP Address'],
      ...filteredLog.map((entry: AuditLogEntry) => [
        new Date(entry.timestamp).toISOString(),
        entry.userName,
        entry.action,
        entry.ruleName || 'N/A',
        entry.details,
        entry.ipAddress || 'N/A',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluo-audit-log-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Audit Log</span>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search audit log..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExportLog}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div>Loading audit log...</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredLog.map((entry: AuditLogEntry) => (
              <div
                key={entry.id}
                className="border rounded p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{entry.action}</Badge>
                      <span className="font-semibold">{entry.userName}</span>
                      {entry.ruleName && (
                        <span className="text-sm text-gray-600">
                          → {entry.ruleName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {entry.details}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(entry.timestamp), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## Success Criteria

- [ ] Version history displays all changes to a rule
- [ ] Diff view shows before/after for each field
- [ ] Users can restore previous versions
- [ ] Audit log tracks all rule operations (CRUD, enable/disable)
- [ ] Audit log is searchable and exportable to CSV
- [ ] Each version includes user, timestamp, and change details
- [ ] Compliance-ready audit trail (immutable, timestamped, signed)

## Testing Requirements

### Unit Tests (Vitest)
```typescript
// src/components/rules/rule-history.test.tsx
describe('RuleHistory', () => {
  it('displays version history', async () => {
    render(<RuleHistory ruleId="rule-123" />);
    await screen.findByText(/version history/i);
    expect(screen.getByText('v3')).toBeInTheDocument();
  });

  it('shows diff when version clicked', async () => {
    const { user } = setup(<RuleHistory ruleId="rule-123" />);
    await user.click(screen.getByRole('button', { name: /eye/i }));
    await screen.findByText(/changes:/i);
  });

  it('restores version after confirmation', async () => {
    // Test restore functionality
  });
});
```

### Storybook Stories
```typescript
// src/stories/RuleHistory.stories.tsx
export const WithMultipleVersions: Story = {
  args: {
    ruleId: 'rule-123',
  },
};

export const EmptyHistory: Story = {
  args: {
    ruleId: 'rule-new',
  },
};
```

## Files to Create

- `/Users/sscoble/Projects/fluo/bff/src/components/rules/rule-history.tsx` - Version history component
- `/Users/sscoble/Projects/fluo/bff/src/components/rules/audit-log.tsx` - Audit log component
- `/Users/sscoble/Projects/fluo/bff/src/lib/hooks/use-rule-history.ts` - History API hooks
- `/Users/sscoble/Projects/fluo/bff/src/lib/hooks/use-audit-log.ts` - Audit log hooks
- `/Users/sscoble/Projects/fluo/bff/src/components/rules/rule-history.test.tsx` - History tests
- `/Users/sscoble/Projects/fluo/bff/src/components/rules/audit-log.test.tsx` - Audit log tests
- `/Users/sscoble/Projects/fluo/bff/src/stories/RuleHistory.stories.tsx` - History stories
- `/Users/sscoble/Projects/fluo/bff/src/stories/AuditLog.stories.tsx` - Audit log stories

## Files to Modify

- `/Users/sscoble/Projects/fluo/bff/src/components/rules/rule-editor.tsx` - Add History tab
- `/Users/sscoble/Projects/fluo/bff/src/components/rules/rules-page.tsx` - Add link to audit log

## Backend API Requirements

```
GET /api/rules/:id/history
Response: Array of version objects with changes and snapshots

POST /api/rules/:id/restore
Body: { version: number }
Response: { success: boolean }

GET /api/audit-log
Query params: ?search=&limit=100&offset=0
Response: Array of audit log entries
```

## Integration Notes

- **Compliance**: Audit log should be immutable (append-only) for compliance
- **Performance**: Paginate history and audit log for large datasets
- **Storage**: Consider separate audit log database/table for performance
- **Retention**: Define retention policy for audit logs (e.g., 7 years for compliance)
- **Signatures**: For compliance, consider cryptographic signatures on audit entries
