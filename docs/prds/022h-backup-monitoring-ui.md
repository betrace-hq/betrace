# PRD-022h: Backup Monitoring UI

**Parent:** [PRD-022: Backup and Recovery](./022-backup-recovery.md)
**Unit:** BackupMonitoringUI
**Complexity:** Medium
**Est. Lines:** ~350
**Dependencies:** PRD-022e, PRD-022g

## Purpose

Provide dashboard for monitoring backup status, verification results, and triggering on-demand backups/restores through React UI.

## Architecture Integration

- **ADR-013 (Camel-First):** UI calls backup APIs exposed as Camel REST routes
- **Frontend Stack:** React + TypeScript + shadcn/ui

## Implementation

### Backup Monitoring Page

```typescript
// bff/src/routes/backups.tsx
import { createFileRoute } from '@tanstack/react-router';
import { BackupDashboard } from '@/components/backups/backup-dashboard';

export const Route = createFileRoute('/backups')({
  component: BackupsPage,
});

function BackupsPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Backup & Recovery</h1>
      <BackupDashboard />
    </div>
  );
}
```

### Backup Dashboard Component

```typescript
// bff/src/components/backups/backup-dashboard.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackupScheduleStatus } from './backup-schedule-status';
import { BackupHistory } from './backup-history';
import { BackupVerificationResults } from './backup-verification-results';
import { TriggerBackupDialog } from './trigger-backup-dialog';
import { TriggerRestoreDialog } from './trigger-restore-dialog';
import { Database, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface BackupSummary {
  lastTigerBeetleBackup: string | null;
  lastDuckDBBackup: string | null;
  lastParquetReplication: string | null;
  lastKMSBackup: string | null;
  lastVerification: string | null;
  verificationStatus: 'passed' | 'failed';
}

export function BackupDashboard() {
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggerBackupOpen, setTriggerBackupOpen] = useState(false);
  const [triggerRestoreOpen, setTriggerRestoreOpen] = useState(false);

  useEffect(() => {
    fetchBackupSummary();
    const interval = setInterval(fetchBackupSummary, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchBackupSummary = async () => {
    try {
      const response = await fetch('/api/backups/summary');
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch backup summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading backup status...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TigerBeetle</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.lastTigerBeetleBackup ? 'Backed Up' : 'No Backup'}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.lastTigerBeetleBackup
                ? `Last: ${formatRelativeTime(summary.lastTigerBeetleBackup)}`
                : 'Never backed up'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DuckDB</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.lastDuckDBBackup ? 'Backed Up' : 'No Backup'}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.lastDuckDBBackup
                ? `Last: ${formatRelativeTime(summary.lastDuckDBBackup)}`
                : 'Never backed up'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parquet</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.lastParquetReplication ? 'Replicated' : 'No Replication'}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.lastParquetReplication
                ? `Last: ${formatRelativeTime(summary.lastParquetReplication)}`
                : 'Never replicated'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verification</CardTitle>
            {summary?.verificationStatus === 'passed' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.verificationStatus === 'passed' ? 'Passed' : 'Failed'}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.lastVerification
                ? `Last: ${formatRelativeTime(summary.lastVerification)}`
                : 'Never verified'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={() => setTriggerBackupOpen(true)}>
          Trigger Backup
        </Button>
        <Button onClick={() => setTriggerRestoreOpen(true)} variant="outline">
          Trigger Restore
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <BackupScheduleStatus />
        </TabsContent>

        <TabsContent value="history">
          <BackupHistory />
        </TabsContent>

        <TabsContent value="verification">
          <BackupVerificationResults />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TriggerBackupDialog
        open={triggerBackupOpen}
        onOpenChange={setTriggerBackupOpen}
        onSuccess={fetchBackupSummary}
      />
      <TriggerRestoreDialog
        open={triggerRestoreOpen}
        onOpenChange={setTriggerRestoreOpen}
      />
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
```

### Backup Schedule Status Component

```typescript
// bff/src/components/backups/backup-schedule-status.tsx
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface Schedule {
  name: string;
  interval: string;
  lastBackup: string | null;
  nextBackup: string | null;
}

interface ScheduleStatus {
  enabled: boolean;
  schedules: Schedule[];
}

export function BackupScheduleStatus() {
  const [status, setStatus] = useState<ScheduleStatus | null>(null);

  useEffect(() => {
    fetchScheduleStatus();
  }, []);

  const fetchScheduleStatus = async () => {
    const response = await fetch('/api/backups/schedule');
    const data = await response.json();
    setStatus(data);
  };

  if (!status) {
    return <div>Loading schedule...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <span className={status.enabled ? 'text-green-600' : 'text-gray-500'}>
              {status.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="space-y-2">
            {status.schedules.map((schedule) => (
              <div key={schedule.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{schedule.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Interval: {schedule.interval}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {schedule.lastBackup && (
                      <div>Last: {new Date(schedule.lastBackup).toLocaleString()}</div>
                    )}
                    {schedule.nextBackup && (
                      <div className="text-muted-foreground">
                        Next: {new Date(schedule.nextBackup).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Backup History Component

```typescript
// bff/src/components/backups/backup-history.tsx
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface BackupRecord {
  id: string;
  backupType: string;
  backupScope: string;
  startTime: string;
  endTime: string;
  status: string;
  backupSizeBytes: number;
}

export function BackupHistory() {
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/backups/history?limit=50');
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading history...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup History (Last 50)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((backup) => (
              <TableRow key={backup.id}>
                <TableCell className="font-medium">{backup.backupType}</TableCell>
                <TableCell>{backup.backupScope}</TableCell>
                <TableCell>{new Date(backup.startTime).toLocaleString()}</TableCell>
                <TableCell>
                  {calculateDuration(backup.startTime, backup.endTime)}
                </TableCell>
                <TableCell>{formatBytes(backup.backupSizeBytes)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      backup.status === 'completed' ? 'default' : 'destructive'
                    }
                  >
                    {backup.status === 'completed' ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    {backup.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function calculateDuration(start: string, end: string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 1) return `${diffSecs}s`;
  return `${diffMins}m ${diffSecs % 60}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
```

### Trigger Backup Dialog Component

```typescript
// bff/src/components/backups/trigger-backup-dialog.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TriggerBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TriggerBackupDialog({
  open,
  onOpenChange,
  onSuccess,
}: TriggerBackupDialogProps) {
  const [backupType, setBackupType] = useState<string>('tigerbeetle');
  const [triggering, setTriggering] = useState(false);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const response = await fetch('/api/backups/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupType }),
      });

      if (response.ok) {
        onSuccess();
        onOpenChange(false);
      } else {
        const error = await response.text();
        alert(`Backup failed: ${error}`);
      }
    } catch (error) {
      alert(`Backup failed: ${error}`);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger Backup</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="backupType">Backup Type</Label>
            <Select value={backupType} onValueChange={setBackupType}>
              <SelectTrigger id="backupType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tigerbeetle">TigerBeetle Snapshot</SelectItem>
                <SelectItem value="duckdb">DuckDB Full Export</SelectItem>
                <SelectItem value="parquet">Parquet Replication</SelectItem>
                <SelectItem value="kms">KMS Key Backup</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleTrigger} disabled={triggering}>
            {triggering ? 'Triggering...' : 'Trigger Backup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Testing Requirements

- [ ] Component test: Backup dashboard displays summary cards
- [ ] Component test: Schedule status shows next backup times
- [ ] Component test: History table displays last 50 backups
- [ ] Component test: Trigger backup dialog submits correct payload
- [ ] E2E test: Full backup monitoring workflow
- [ ] Accessibility test: Dashboard keyboard navigation
- [ ] Coverage: 80% (frontend target)

## Security Considerations

- **RBAC enforcement** - Only admins can trigger backups/restores
- **Sensitive data** - Don't display backup file paths or checksums to non-admins
- **Rate limiting** - Prevent rapid backup trigger spam

## Success Criteria

- Real-time backup status visibility
- One-click on-demand backup triggers
- Historical backup analytics (success rate, size trends)
- Verification status at a glance
- Mobile-responsive dashboard

## Public Examples

### shadcn/ui Dashboard Templates
- **shadcn/ui Examples - Dashboard**: [https://ui.shadcn.com/examples/dashboard](https://ui.shadcn.com/examples/dashboard)
  - Official shadcn/ui dashboard example
  - Card-based layout with stats, tables, and charts
  - Demonstrates tabs, buttons, badges, and table components
  - Example of clean, accessible dashboard design

- **satnaing/shadcn-admin**: [https://github.com/satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin)
  - Admin dashboard UI built with Shadcn and Vite
  - Responsive and accessible design
  - Custom components based on shadcn/ui examples
  - Production-ready admin panel structure

- **silicondeck/shadcn-dashboard-landing-template**: [https://github.com/silicondeck/shadcn-dashboard-landing-template](https://github.com/silicondeck/shadcn-dashboard-landing-template)
  - Open-source admin dashboard with Vite-React and shadcn/ui
  - Fully customizable and production-ready
  - Includes task management, calendar, and data tables
  - Example of feature-rich dashboard similar to backup monitoring

- **Kiranism/next-shadcn-dashboard-starter**: [https://github.com/Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter)
  - Next.js 15 admin dashboard with shadcn/ui
  - Forms with react-hook-form + zod validation
  - Drag-and-drop task board with dnd-kit
  - State persistence with zustand

### React Dashboard Components and Patterns
- **awesome-shadcn-ui**: [https://github.com/birobirobiro/awesome-shadcn-ui](https://github.com/birobirobiro/awesome-shadcn-ui)
  - Curated list of shadcn/ui resources
  - Interactive components for admin panels and dashboards
  - Professional dashboard templates with analytics and data visualization
  - Monitoring, CMS, and internal tools UI examples

- **shadcn.io Dashboard Templates**: [https://www.shadcn.io/template/category/dashboard](https://www.shadcn.io/template/category/dashboard)
  - Collection of professional dashboard templates
  - Analytics dashboards and admin panels
  - Data visualization interfaces
  - Feature-rich monitoring dashboards

### Status Card Patterns
- Summary cards with icon, title, value, and secondary text
- Color-coded status indicators (green for success, red for failure)
- Relative time formatting ("2h ago", "Just now")
- Card hover effects and responsive grid layouts

### Data Table Implementations
- **shadcn/ui Table Component**: [https://ui.shadcn.com/docs/components/table](https://ui.shadcn.com/docs/components/table)
  - Accessible table component with TanStack Table
  - Sorting, filtering, pagination support
  - Column resizing and row selection
  - Example of backup history table pattern

### React Chart Libraries
- **Recharts**: [https://recharts.org/](https://recharts.org/)
  - Seamless integration with React
  - Native SVG support with diverse chart types
  - Ideal for analytics dashboards
  - Line graphs, pie charts, bar charts for backup trends

- **MUI X Charts**: [https://mui.com/x/react-charts/](https://mui.com/x/react-charts/)
  - Material Design charts for React
  - Line, bar, scatter, and pie charts
  - Responsive and customizable

### State Management Patterns
- React Context + useReducer (used in this PRD)
- Zustand for lightweight state management
- TanStack Query (React Query) for server state
- Real-time updates with polling (60-second intervals)

### Form Validation Examples
- react-hook-form + zod schema validation
- Type-safe form handling
- Example from TriggerBackupDialog:
  ```typescript
  const handleTrigger = async () => {
    const response = await fetch('/api/backups/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupType }),
    });
  }
  ```

### Accessibility Best Practices
- Keyboard navigation support
- ARIA labels and roles
- Screen reader compatibility
- Focus management in dialogs and modals
- Color contrast compliance (WCAG AA)
