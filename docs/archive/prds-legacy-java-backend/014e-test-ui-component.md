# PRD-014e: Test UI Component

**Priority:** P1 (User Workflow)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-014 (Developer Rule Testing)
**Dependencies:** PRD-010 (Rule Management UI), PRD-014a (Test Execution Service), PRD-014b (Sample Trace Library)

## Problem

Developers need UI to test rules against sample traces before deployment. Without visual feedback on test results, developers cannot debug rules or verify behavior.

## Solution

Implement test panel in rule editor with three modes: upload trace JSON, select from library, or copy from production signal. Display test results with matched spans highlighted, signal preview, and execution metrics.

## Unit Description

**File:** `bff/src/components/rules/rule-testing-panel.tsx`
**Type:** React Component
**Purpose:** Interactive UI for testing rules against sample traces

## Implementation

```tsx
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Upload, Library, Clock, AlertTriangle } from 'lucide-react';
import { executeRuleTest, getSampleTraces } from '@/lib/api/rule-testing';

interface RuleTestingPanelProps {
  ruleDsl: string;
  ruleId?: string;
}

interface TestResult {
  ruleFired: boolean;
  matchedSpans: Array<{
    spanId: string;
    name: string;
    attributes: Record<string, any>;
  }>;
  signalGenerated: {
    severity: string;
    message: string;
  } | null;
  executionTimeMs: number;
  ruleDetails: Record<string, any>;
}

interface SampleTrace {
  id: string;
  name: string;
  description: string;
  category: string;
  traceJson: string;
  expectedSignals: string;
}

export function RuleTestingPanel({ ruleDsl, ruleId }: RuleTestingPanelProps) {
  const [testMode, setTestMode] = useState<'upload' | 'library'>('upload');
  const [traceJson, setTraceJson] = useState('');
  const [selectedTrace, setSelectedTrace] = useState<SampleTrace | null>(null);
  const [sampleTraces, setSampleTraces] = useState<SampleTrace[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load sample traces when library tab opened
  React.useEffect(() => {
    if (testMode === 'library') {
      loadSampleTraces();
    }
  }, [testMode]);

  const loadSampleTraces = async () => {
    try {
      const traces = await getSampleTraces();
      setSampleTraces(traces);
    } catch (err) {
      setError('Failed to load sample traces');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTraceJson(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleRunTest = async () => {
    setLoading(true);
    setError(null);
    setTestResult(null);

    try {
      const trace = testMode === 'upload' ? traceJson : selectedTrace?.traceJson;

      if (!trace) {
        setError('Please provide a trace JSON');
        return;
      }

      const result = await executeRuleTest({
        ruleDsl,
        ruleId,
        traceSource: testMode,
        traceJson: trace,
      });

      setTestResult(result);
    } catch (err: any) {
      setError(err.message || 'Test execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Test Rule</h3>

      <Tabs value={testMode} onValueChange={(v) => setTestMode(v as 'upload' | 'library')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload Trace
          </TabsTrigger>
          <TabsTrigger value="library">
            <Library className="w-4 h-4 mr-2" />
            Sample Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Upload OTLP Trace JSON
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90"
            />
          </div>

          {traceJson && (
            <div className="text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
              Trace loaded ({Math.round(traceJson.length / 1024)}KB)
            </div>
          )}
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {sampleTraces.map((trace) => (
              <div
                key={trace.id}
                className={`p-3 border rounded cursor-pointer hover:bg-accent ${
                  selectedTrace?.id === trace.id ? 'border-primary bg-accent' : ''
                }`}
                onClick={() => setSelectedTrace(trace)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{trace.name}</div>
                    <div className="text-sm text-muted-foreground">{trace.description}</div>
                  </div>
                  <Badge variant="secondary">{trace.category}</Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Button
        onClick={handleRunTest}
        disabled={loading || (!traceJson && !selectedTrace)}
        className="w-full mt-4"
      >
        {loading ? 'Running Test...' : 'Run Test'}
      </Button>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {testResult && <TestResultViewer result={testResult} />}
    </Card>
  );
}

function TestResultViewer({ result }: { result: TestResult }) {
  return (
    <div className="mt-6 space-y-4">
      {/* Test Status */}
      <div className="flex items-center gap-4">
        {result.ruleFired ? (
          <div className="flex items-center text-green-600">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span className="font-semibold">Rule Fired</span>
          </div>
        ) : (
          <div className="flex items-center text-gray-500">
            <XCircle className="w-5 h-5 mr-2" />
            <span className="font-semibold">Rule Did Not Fire</span>
          </div>
        )}

        <div className="flex items-center text-muted-foreground">
          <Clock className="w-4 h-4 mr-1" />
          <span className="text-sm">{result.executionTimeMs}ms</span>
        </div>
      </div>

      {/* Signal Preview */}
      {result.signalGenerated && (
        <Alert>
          <AlertDescription>
            <div className="font-semibold">Signal Generated:</div>
            <div className="text-sm mt-1">
              Severity: <Badge>{result.signalGenerated.severity}</Badge>
            </div>
            <div className="text-sm mt-1">{result.signalGenerated.message}</div>
          </AlertDescription>
        </Alert>
      )}

      {/* Matched Spans */}
      {result.matchedSpans.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">
            Matched Spans ({result.matchedSpans.length})
          </h4>
          <div className="space-y-2">
            {result.matchedSpans.map((span, idx) => (
              <div key={idx} className="p-3 bg-accent rounded border">
                <div className="font-medium text-sm">{span.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Span ID: {span.spanId}
                </div>
                <div className="mt-2">
                  <details>
                    <summary className="text-sm font-medium cursor-pointer">
                      Attributes
                    </summary>
                    <pre className="mt-2 text-xs bg-background p-2 rounded overflow-auto">
                      {JSON.stringify(span.attributes, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rule Details */}
      <div>
        <details>
          <summary className="font-semibold cursor-pointer">Rule Details</summary>
          <pre className="mt-2 text-xs bg-background p-3 rounded overflow-auto">
            {JSON.stringify(result.ruleDetails, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Frontend only - test execution backend handles persistence
**ADR-013 (Camel-First):** Not applicable (frontend component)
**ADR-014 (Named Processors):** Not applicable (frontend component)
**ADR-015 (Tiered Storage):** Not applicable (frontend component)

## API Integration

```typescript
// bff/src/lib/api/rule-testing.ts
export async function executeRuleTest(params: {
  ruleDsl: string;
  ruleId?: string;
  traceSource: 'upload' | 'library' | 'production_copy';
  traceJson: string;
}) {
  const response = await fetch('/api/rules/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Test execution failed');
  }

  return response.json();
}

export async function getSampleTraces(category?: string) {
  const url = category
    ? `/api/sample-traces?category=${category}`
    : '/api/sample-traces';

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to load sample traces');
  }

  return response.json();
}
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testRender_InitialState - renders upload and library tabs
- testFileUpload_LoadsJson - file upload populates traceJson state
- testLibraryTab_LoadsSampleTraces - switching to library tab fetches traces
- testSelectSampleTrace - clicking trace selects it
- testRunTest_Upload - run test with uploaded trace calls API
- testRunTest_Library - run test with library trace calls API
- testRunTest_Disabled - button disabled when no trace selected
- testTestResult_RuleFired - displays green check when rule fired
- testTestResult_RuleDidNotFire - displays gray X when rule did not fire
- testTestResult_MatchedSpans - displays list of matched spans
- testTestResult_SignalPreview - displays signal severity and message
- testError_Display - displays error alert on API failure

**Integration Tests:**
- testFullWorkflow_UploadAndTest - upload JSON → run test → see results
- testFullWorkflow_LibraryAndTest - select from library → run test → see results

**Test Coverage:** 80% minimum (frontend testing standards)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- XSS via trace JSON display - mitigate with React auto-escaping
- Large file uploads - mitigate with client-side size validation (1MB max)
- API request forgery - mitigate with CSRF tokens
- Sensitive data in traces - mitigate with warning before upload

**Compliance:**
- SOC2 CC6.1 (Access Control) - only authenticated users can test rules
- GDPR Article 25 (Data Protection by Design) - warning about PII in test traces

## Success Criteria

- [ ] Upload trace JSON from file
- [ ] Select sample trace from library
- [ ] Run test and display results
- [ ] Show matched spans with attributes
- [ ] Display signal preview if rule fired
- [ ] Show execution time
- [ ] Display error messages
- [ ] All tests pass with 80% coverage
