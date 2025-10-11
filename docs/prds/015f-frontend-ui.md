# PRD-015f: Frontend UI

**Parent PRD:** PRD-015 (Compliance Evidence Dashboard)
**Unit:** F
**Priority:** P1
**Dependencies:** Units A, B, C, D, E (all backend units)

## Scope

Build frontend UI for compliance evidence dashboard:
- Compliance evidence page with filters
- Compliance evidence table with signature badges
- Export buttons (CSV and JSON)
- Compliance metrics dashboard
- Control coverage visualization

## Implementation

### 1. Compliance Evidence Page

**`bff/src/routes/compliance/evidence.tsx`:**
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ComplianceEvidenceTable } from '@/components/compliance/compliance-evidence-table';
import { ComplianceFilters } from '@/components/compliance/compliance-filters';
import { ExportButtons } from '@/components/compliance/export-buttons';
import { useComplianceEvidence } from '@/lib/api/compliance';

export const Route = createFileRoute('/compliance/evidence')({
  component: ComplianceEvidencePage,
});

function ComplianceEvidencePage() {
  const [filters, setFilters] = useState({
    framework: '',
    control: '',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    limit: 100,
  });

  const { data: evidence, isLoading, error } = useComplianceEvidence(filters);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Compliance Evidence</h1>
        <p className="text-muted-foreground">
          Query and export compliance spans for audit reporting
        </p>
      </div>

      <ComplianceFilters filters={filters} onChange={setFilters} />

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {evidence && `${evidence.length} compliance spans found`}
        </div>
        <ExportButtons filters={filters} />
      </div>

      {isLoading && <div>Loading compliance evidence...</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
      {evidence && <ComplianceEvidenceTable evidence={evidence} />}
    </div>
  );
}
```

### 2. Compliance Evidence Table

**`bff/src/components/compliance/compliance-evidence-table.tsx`:**
```tsx
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, ShieldAlert, ShieldX } from 'lucide-react';
import type { ComplianceSpanRecord } from '@/lib/api/compliance';

interface ComplianceEvidenceTableProps {
  evidence: ComplianceSpanRecord[];
}

export function ComplianceEvidenceTable({ evidence }: ComplianceEvidenceTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Framework</TableHead>
            <TableHead>Control</TableHead>
            <TableHead>Evidence Type</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Signature</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {evidence.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No compliance evidence found for selected filters
              </TableCell>
            </TableRow>
          )}
          {evidence.map((span) => (
            <TableRow key={span.spanId}>
              <TableCell className="font-mono text-sm">
                {new Date(span.timestamp).toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{span.framework.toUpperCase()}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{span.control}</Badge>
              </TableCell>
              <TableCell className="text-sm">{span.evidenceType}</TableCell>
              <TableCell>
                <Badge variant={span.outcome === 'success' ? 'default' : 'destructive'}>
                  {span.outcome}
                </Badge>
              </TableCell>
              <TableCell>
                {span.signatureValid === true && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs">Verified</span>
                  </div>
                )}
                {span.signatureValid === false && (
                  <div className="flex items-center gap-1 text-red-600">
                    <ShieldAlert className="w-4 h-4" />
                    <span className="text-xs">Invalid</span>
                  </div>
                )}
                {span.signatureValid === null && (
                  <div className="flex items-center gap-1 text-gray-400">
                    <ShieldX className="w-4 h-4" />
                    <span className="text-xs">N/A</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm max-w-xs truncate">
                {span.details}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### 3. Compliance Filters

**`bff/src/components/compliance/compliance-filters.tsx`:**
```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ComplianceFiltersProps {
  filters: {
    framework: string;
    control: string;
    startDate: string;
    endDate: string;
    limit: number;
  };
  onChange: (filters: any) => void;
}

export function ComplianceFilters({ filters, onChange }: ComplianceFiltersProps) {
  const frameworks = ['', 'soc2', 'hipaa', 'gdpr', 'fedramp', 'iso27001', 'pci-dss'];
  const soc2Controls = ['', 'CC6_1', 'CC6_2', 'CC6_3', 'CC6_6', 'CC6_7', 'CC7_1', 'CC7_2', 'CC8_1'];
  const hipaaControls = ['', '164.312(a)', '164.312(b)', '164.312(a)(2)(i)', '164.312(a)(2)(iv)', '164.312(e)(2)(ii)'];

  const getControlsForFramework = () => {
    if (filters.framework === 'soc2') return soc2Controls;
    if (filters.framework === 'hipaa') return hipaaControls;
    return [''];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-4 border rounded-lg bg-card">
      <div>
        <Label htmlFor="framework">Framework</Label>
        <Select
          value={filters.framework}
          onValueChange={(value) => onChange({ ...filters, framework: value, control: '' })}
        >
          <SelectTrigger id="framework">
            <SelectValue placeholder="All Frameworks" />
          </SelectTrigger>
          <SelectContent>
            {frameworks.map((fw) => (
              <SelectItem key={fw} value={fw}>
                {fw === '' ? 'All Frameworks' : fw.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="control">Control</Label>
        <Select
          value={filters.control}
          onValueChange={(value) => onChange({ ...filters, control: value })}
          disabled={!filters.framework}
        >
          <SelectTrigger id="control">
            <SelectValue placeholder="All Controls" />
          </SelectTrigger>
          <SelectContent>
            {getControlsForFramework().map((control) => (
              <SelectItem key={control} value={control}>
                {control === '' ? 'All Controls' : control}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="startDate">Start Date</Label>
        <Input
          id="startDate"
          type="date"
          value={filters.startDate}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="endDate">End Date</Label>
        <Input
          id="endDate"
          type="date"
          value={filters.endDate}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="limit">Result Limit</Label>
        <Input
          id="limit"
          type="number"
          value={filters.limit}
          onChange={(e) => onChange({ ...filters, limit: parseInt(e.target.value) })}
          min={10}
          max={1000}
          step={10}
        />
      </div>

      <div className="col-span-full flex gap-2">
        <Button onClick={() => onChange(filters)}>Apply Filters</Button>
        <Button
          variant="outline"
          onClick={() =>
            onChange({
              framework: '',
              control: '',
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              endDate: new Date().toISOString().split('T')[0],
              limit: 100,
            })
          }
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
```

### 4. Export Buttons

**`bff/src/components/compliance/export-buttons.tsx`:**
```tsx
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportComplianceEvidence } from '@/lib/api/compliance';
import { useState } from 'react';

interface ExportButtonsProps {
  filters: {
    framework: string;
    control: string;
    startDate: string;
    endDate: string;
  };
}

export function ExportButtons({ filters }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setIsExporting(true);
      const blob = await exportComplianceEvidence(filters, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-evidence-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => handleExport('csv')} disabled={isExporting}>
        <Download className="w-4 h-4 mr-2" />
        Export CSV
      </Button>
      <Button variant="outline" onClick={() => handleExport('json')} disabled={isExporting}>
        <Download className="w-4 h-4 mr-2" />
        Export JSON
      </Button>
    </div>
  );
}
```

### 5. Compliance Metrics Dashboard Page

**`bff/src/routes/compliance/metrics.tsx`:**
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useComplianceMetrics, useControlCoverage } from '@/lib/api/compliance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const Route = createFileRoute('/compliance/metrics')({
  component: ComplianceMetricsPage,
});

function ComplianceMetricsPage() {
  const { data: metrics, isLoading: metricsLoading } = useComplianceMetrics();
  const [selectedFramework, setSelectedFramework] = useState('soc2');
  const { data: coverage, isLoading: coverageLoading } = useControlCoverage(selectedFramework);

  if (metricsLoading) return <div>Loading metrics...</div>;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Compliance Metrics</h1>
        <p className="text-muted-foreground">
          Overview of compliance evidence and control coverage
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Spans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSpans.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Signature Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? (metrics.signatureVerificationRate * 100).toFixed(1) : '0'}%
            </div>
            <p className="text-xs text-muted-foreground">Valid signatures</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Frameworks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.frameworkMetrics.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active frameworks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {metrics?.lastUpdated ? new Date(metrics.lastUpdated).toLocaleString() : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Real-time data</p>
          </CardContent>
        </Card>
      </div>

      {/* Framework Metrics */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Framework Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Framework</TableHead>
                <TableHead>Spans</TableHead>
                <TableHead>Controls</TableHead>
                <TableHead>Valid Signatures</TableHead>
                <TableHead>Invalid Signatures</TableHead>
                <TableHead>Success Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics?.frameworkMetrics.map((fw) => (
                <TableRow key={fw.framework}>
                  <TableCell>
                    <Badge variant="outline">{fw.framework.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>{fw.spanCount.toLocaleString()}</TableCell>
                  <TableCell>{fw.controlCount}</TableCell>
                  <TableCell className="text-green-600">{fw.validSignatures}</TableCell>
                  <TableCell className="text-red-600">{fw.invalidSignatures}</TableCell>
                  <TableCell>
                    {fw.spanCount > 0
                      ? ((fw.successfulEvents / fw.spanCount) * 100).toFixed(1)
                      : '0'}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Control Coverage */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Control Coverage</CardTitle>
            <Select value={selectedFramework} onValueChange={setSelectedFramework}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soc2">SOC2</SelectItem>
                <SelectItem value="hipaa">HIPAA</SelectItem>
                <SelectItem value="gdpr">GDPR</SelectItem>
                <SelectItem value="fedramp">FedRAMP</SelectItem>
                <SelectItem value="iso27001">ISO27001</SelectItem>
                <SelectItem value="pci-dss">PCI-DSS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {coverageLoading ? (
            <div>Loading control coverage...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Control</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Span Count</TableHead>
                  <TableHead>Last Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coverage?.controls.map((control) => (
                  <TableRow key={control.control}>
                    <TableCell>
                      <Badge variant="secondary">{control.control}</Badge>
                    </TableCell>
                    <TableCell>
                      {control.hasCoverage ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs">Covered</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs">No Evidence</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{control.spanCount.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">
                      {control.lastEvidence
                        ? new Date(control.lastEvidence).toLocaleString()
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6. API Client

**`bff/src/lib/api/compliance.ts`:**
```typescript
import { useQuery } from '@tanstack/react-query';

export interface ComplianceSpanRecord {
  spanId: string;
  traceId: string;
  timestamp: string;
  framework: string;
  control: string;
  evidenceType: string;
  tenantId: string;
  outcome: string;
  signatureValid: boolean | null;
  signature: string;
  details: string;
  spanAttributes: Record<string, any>;
}

export interface ComplianceQueryFilters {
  framework?: string;
  control?: string;
  startDate: string;
  endDate: string;
  limit?: number;
}

export interface ComplianceMetrics {
  tenantId: string;
  totalSpans: number;
  signatureVerificationRate: number;
  frameworkMetrics: FrameworkMetrics[];
  lastUpdated: string;
}

export interface FrameworkMetrics {
  framework: string;
  spanCount: number;
  controlCount: number;
  validSignatures: number;
  invalidSignatures: number;
  successfulEvents: number;
  failedEvents: number;
}

export interface ControlCoverage {
  tenantId: string;
  framework: string;
  controls: ControlCoverageItem[];
  lastUpdated: string;
}

export interface ControlCoverageItem {
  control: string;
  spanCount: number;
  lastEvidence: string | null;
  hasCoverage: boolean;
}

export function useComplianceEvidence(filters: ComplianceQueryFilters) {
  return useQuery({
    queryKey: ['compliance-evidence', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        tenantId: getTenantId(),
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: (filters.limit || 100).toString(),
      });

      if (filters.framework) params.set('framework', filters.framework);
      if (filters.control) params.set('control', filters.control);

      const response = await fetch(`/api/compliance/evidence/query?${params}`);
      if (!response.ok) throw new Error('Failed to fetch compliance evidence');

      return response.json() as Promise<ComplianceSpanRecord[]>;
    },
  });
}

export function useComplianceMetrics() {
  return useQuery({
    queryKey: ['compliance-metrics'],
    queryFn: async () => {
      const response = await fetch(`/api/compliance/metrics/${getTenantId()}`);
      if (!response.ok) throw new Error('Failed to fetch compliance metrics');

      return response.json() as Promise<ComplianceMetrics>;
    },
  });
}

export function useControlCoverage(framework: string) {
  return useQuery({
    queryKey: ['control-coverage', framework],
    queryFn: async () => {
      const response = await fetch(`/api/compliance/coverage/${getTenantId()}/${framework}`);
      if (!response.ok) throw new Error('Failed to fetch control coverage');

      return response.json() as Promise<ControlCoverage>;
    },
    enabled: !!framework,
  });
}

export async function exportComplianceEvidence(
  filters: ComplianceQueryFilters,
  format: 'csv' | 'json'
): Promise<Blob> {
  const response = await fetch(`/api/compliance/evidence/export/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: getTenantId(),
      ...filters,
    }),
  });

  if (!response.ok) throw new Error('Export failed');

  return response.blob();
}

function getTenantId(): string {
  // TODO: Get from auth context
  return 'tenant-uuid';
}
```

### 7. Update Navigation

**Update `bff/src/components/layout/header.tsx`:**
```tsx
// Add Compliance navigation link
<nav className="flex gap-4">
  <Link to="/" className="hover:text-primary">Home</Link>
  <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
  <Link to="/rules" className="hover:text-primary">Rules</Link>
  <Link to="/signals" className="hover:text-primary">Signals</Link>
  <Link to="/compliance/evidence" className="hover:text-primary">Compliance</Link>
</nav>
```

## Success Criteria

- [ ] Compliance evidence page renders with filters
- [ ] Evidence table displays compliance spans
- [ ] Signature verification status shown (Verified, Invalid, N/A)
- [ ] Export CSV button downloads CSV file
- [ ] Export JSON button downloads JSON file
- [ ] Compliance metrics dashboard renders
- [ ] Framework breakdown table displays metrics
- [ ] Control coverage table displays per-control evidence
- [ ] Framework selector changes control coverage
- [ ] Date range filter works correctly
- [ ] Framework/control filters work correctly
- [ ] Loading states displayed during queries
- [ ] Error states displayed on failures
- [ ] Responsive design (mobile, tablet, desktop)

## Testing Requirements

### Component Tests

**`bff/src/components/compliance/compliance-evidence-table.test.tsx`:**
```tsx
import { render, screen } from '@testing-library/react';
import { ComplianceEvidenceTable } from './compliance-evidence-table';

describe('ComplianceEvidenceTable', () => {
  const mockEvidence = [
    {
      spanId: 'span-1',
      traceId: 'trace-1',
      timestamp: '2025-01-15T10:00:00Z',
      framework: 'soc2',
      control: 'CC6_1',
      evidenceType: 'audit_trail',
      tenantId: 'tenant-1',
      outcome: 'success',
      signatureValid: true,
      signature: 'sig-1',
      details: 'Test details',
      spanAttributes: {},
    },
  ];

  it('should render compliance evidence', () => {
    render(<ComplianceEvidenceTable evidence={mockEvidence} />);

    expect(screen.getByText('SOC2')).toBeInTheDocument();
    expect(screen.getByText('CC6_1')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('should display empty state when no evidence', () => {
    render(<ComplianceEvidenceTable evidence={[]} />);

    expect(screen.getByText('No compliance evidence found')).toBeInTheDocument();
  });

  it('should display signature status correctly', () => {
    const evidence = [
      { ...mockEvidence[0], signatureValid: true },
      { ...mockEvidence[0], spanId: 'span-2', signatureValid: false },
      { ...mockEvidence[0], spanId: 'span-3', signatureValid: null },
    ];

    render(<ComplianceEvidenceTable evidence={evidence} />);

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
```

**Test Coverage Target:** 90% (ADR-014 compliance)

## Files to Create

**Frontend - Pages:**
- `bff/src/routes/compliance/evidence.tsx`
- `bff/src/routes/compliance/metrics.tsx`

**Frontend - Components:**
- `bff/src/components/compliance/compliance-evidence-table.tsx`
- `bff/src/components/compliance/compliance-filters.tsx`
- `bff/src/components/compliance/export-buttons.tsx`

**Frontend - API:**
- `bff/src/lib/api/compliance.ts`

**Frontend - Tests:**
- `bff/src/components/compliance/compliance-evidence-table.test.tsx`
- `bff/src/components/compliance/compliance-filters.test.tsx`

## Files to Modify

**Frontend:**
- `bff/src/components/layout/header.tsx` - Add "Compliance" navigation link
- `bff/src/routeTree.gen.ts` - Add compliance routes (auto-generated by Tanstack Router)

## Implementation Notes

**Component Design:**
- Compliance evidence page: Query + Table + Export
- Compliance metrics page: Summary cards + Framework table + Control coverage
- Reusable components: Filters, Table, Export buttons
- Responsive design with Tailwind CSS

**State Management:**
- React Query for server state
- Local state for filters
- Loading and error states

**User Experience:**
- Clear loading indicators
- Error messages on failures
- Empty states for no data
- Responsive design (mobile, tablet, desktop)
- Export progress indicator

**Accessibility:**
- Semantic HTML
- ARIA labels for icons
- Keyboard navigation
- Color contrast compliance

## Next Steps

After completing Unit F:
- **E2E Testing:** End-to-end tests for compliance workflows
- **Performance Testing:** Load testing for large result sets
- **Documentation:** User guide for compliance dashboard
- **Storybook Stories:** Visual component documentation
