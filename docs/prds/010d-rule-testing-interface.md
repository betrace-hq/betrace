# PRD-010d: Rule Testing Interface

**Parent PRD:** PRD-010 (Rule Management UI)
**Unit:** D
**Priority:** P0
**Dependencies:** Unit A (Monaco editor), Unit B (validation)

## Scope

Implement a rule testing interface that allows users to validate FLUO DSL rules against sample traces before activating them. This ensures rules work as expected and helps users understand the DSL behavior.

**Current State:** Basic mock testing exists in `rule-editor.tsx` but doesn't use real FLUO backend evaluation or actual trace data.

**Goal:** Production-ready testing interface with:
- Test rule against sample traces (fetch from backend or user-provided)
- Show which spans matched and why
- Display trace visualization with matched spans highlighted
- Save test cases for regression testing
- Quick test templates for common scenarios

## Implementation

### Test Interface Component

```typescript
// src/components/rules/rule-test-interface.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Play, CheckCircle, XCircle, AlertCircle, Save, Download } from 'lucide-react';
import { MonacoDslEditor } from './monaco-dsl-editor';
import { useTestRule } from '@/lib/hooks/use-test-rule';

interface RuleTestInterfaceProps {
  expression: string;
  onExpressionChange?: (expression: string) => void;
  readOnly?: boolean;
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  traceJson: string;
  expectedResult: 'match' | 'no-match';
}

const SAMPLE_TEST_CASES: TestCase[] = [
  {
    id: 'payment-fraud-check',
    name: 'Payment without Fraud Check',
    description: 'Should detect missing fraud check on high-value payment',
    expectedResult: 'match',
    traceJson: JSON.stringify(
      {
        traceId: 'trace-001',
        spans: [
          {
            spanId: 'span-001',
            operationName: 'payment.charge_card',
            attributes: {
              amount: 5000,
              currency: 'USD',
              processor: 'stripe',
            },
          },
          // Missing fraud check span
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'pii-with-audit',
    name: 'PII Access with Audit Log',
    description: 'Should NOT match when audit log is present',
    expectedResult: 'no-match',
    traceJson: JSON.stringify(
      {
        traceId: 'trace-002',
        spans: [
          {
            spanId: 'span-001',
            operationName: 'database.query',
            attributes: {
              data: { contains_pii: true },
              query: 'SELECT * FROM users WHERE email = ?',
            },
          },
          {
            spanId: 'span-002',
            operationName: 'audit.log',
            attributes: {
              action: 'pii_access',
              userId: 'user-123',
            },
          },
        ],
      },
      null,
      2
    ),
  },
];

export function RuleTestInterface({
  expression,
  onExpressionChange,
  readOnly = false,
}: RuleTestInterfaceProps) {
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [customTraceJson, setCustomTraceJson] = useState('');
  const [testMode, setTestMode] = useState<'sample' | 'custom' | 'live'>('sample');

  const { mutate: testRule, data: testResult, isPending, error } = useTestRule();

  const handleRunTest = () => {
    const traceJson =
      testMode === 'sample'
        ? selectedTestCase?.traceJson
        : testMode === 'custom'
        ? customTraceJson
        : undefined;

    if (!traceJson) {
      alert('Please select a test case or provide custom trace JSON');
      return;
    }

    try {
      const trace = JSON.parse(traceJson);
      testRule({
        expression,
        trace,
      });
    } catch (err) {
      alert('Invalid trace JSON: ' + err);
    }
  };

  const handleSaveTestCase = () => {
    // Save to local storage or backend
    const testCase: TestCase = {
      id: `custom-${Date.now()}`,
      name: prompt('Test case name:') || 'Untitled Test',
      description: prompt('Description:') || '',
      traceJson: customTraceJson,
      expectedResult: testResult?.matched ? 'match' : 'no-match',
    };

    // TODO: Persist to backend or local storage
    console.log('Saving test case:', testCase);
  };

  const handleExportTestCases = () => {
    // Export all test cases to JSON file
    const dataStr = JSON.stringify(SAMPLE_TEST_CASES, null, 2);
    const dataUri =
      'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'fluo-rule-test-cases.json');
    linkElement.click();
  };

  return (
    <div className="space-y-4">
      <Tabs value={testMode} onValueChange={(value: any) => setTestMode(value)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sample">Sample Test Cases</TabsTrigger>
          <TabsTrigger value="custom">Custom Trace JSON</TabsTrigger>
          <TabsTrigger value="live">Live Traces (Recent)</TabsTrigger>
        </TabsList>

        <TabsContent value="sample" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Test Case</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedTestCase?.id}
                onValueChange={(id) => {
                  const testCase = SAMPLE_TEST_CASES.find((tc) => tc.id === id);
                  setSelectedTestCase(testCase || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a test case..." />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_TEST_CASES.map((tc) => (
                    <SelectItem key={tc.id} value={tc.id}>
                      {tc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTestCase && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedTestCase.description}
                  </p>
                  <div>
                    <p className="text-sm font-semibold mb-1">Expected Result:</p>
                    <Badge
                      variant={
                        selectedTestCase.expectedResult === 'match'
                          ? 'destructive'
                          : 'default'
                      }
                    >
                      {selectedTestCase.expectedResult === 'match'
                        ? 'Should Match (Signal)'
                        : 'Should Not Match'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">Trace JSON:</p>
                    <Textarea
                      value={selectedTestCase.traceJson}
                      readOnly
                      className="font-mono text-xs"
                      rows={12}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Trace JSON</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Paste OpenTelemetry trace JSON to test your rule against custom data.
              </p>
              <Textarea
                value={customTraceJson}
                onChange={(e) => setCustomTraceJson(e.target.value)}
                placeholder={JSON.stringify(
                  {
                    traceId: 'trace-001',
                    spans: [
                      {
                        spanId: 'span-001',
                        operationName: 'operation.name',
                        attributes: { key: 'value' },
                      },
                    ],
                  },
                  null,
                  2
                )}
                className="font-mono text-sm"
                rows={16}
              />
              <Button size="sm" variant="outline" onClick={handleSaveTestCase}>
                <Save className="h-4 w-4 mr-2" />
                Save as Test Case
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Against Live Traces</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Coming Soon</AlertTitle>
                <AlertDescription>
                  Test your rule against recent production traces. This feature
                  requires backend integration with trace storage.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Run Test Button */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleExportTestCases}>
          <Download className="h-4 w-4 mr-2" />
          Export Test Cases
        </Button>
        <Button
          onClick={handleRunTest}
          disabled={
            isPending ||
            !expression ||
            (testMode === 'sample' && !selectedTestCase) ||
            (testMode === 'custom' && !customTraceJson)
          }
        >
          <Play className="h-4 w-4 mr-2" />
          Run Test
        </Button>
      </div>

      {/* Test Result */}
      {testResult && (
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResult.matched ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-600" />
              )}
              Test Result: {testResult.matched ? 'Rule Matched' : 'No Match'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Execution Details:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Execution Time:
                  </span>{' '}
                  {testResult.executionTimeMs}ms
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Spans Evaluated:
                  </span>{' '}
                  {testResult.spansEvaluated}
                </div>
              </div>
            </div>

            {testResult.matchedSpans && testResult.matchedSpans.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Matched Spans:</p>
                <div className="space-y-2">
                  {testResult.matchedSpans.map((span: any, index: number) => (
                    <div
                      key={index}
                      className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-3"
                    >
                      <p className="font-mono text-sm font-semibold">
                        {span.operationName}
                      </p>
                      <pre className="text-xs mt-2 text-gray-700 dark:text-gray-300">
                        {JSON.stringify(span.attributes, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {testResult.explanation && (
              <div>
                <p className="text-sm font-semibold mb-2">Explanation:</p>
                <Alert>
                  <AlertDescription>{testResult.explanation}</AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Test Error</AlertTitle>
          <AlertDescription>
            {error.message || 'Failed to run test'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

### Backend API Hook

```typescript
// src/lib/hooks/use-test-rule.ts
import { useMutation } from '@tanstack/react-query';

interface TestRuleRequest {
  expression: string;
  trace: {
    traceId: string;
    spans: Array<{
      spanId: string;
      operationName: string;
      attributes: Record<string, any>;
    }>;
  };
}

interface TestRuleResponse {
  matched: boolean;
  executionTimeMs: number;
  spansEvaluated: number;
  matchedSpans?: Array<{
    spanId: string;
    operationName: string;
    attributes: Record<string, any>;
  }>;
  explanation?: string;
}

export function useTestRule() {
  return useMutation({
    mutationFn: async (request: TestRuleRequest): Promise<TestRuleResponse> => {
      // TODO: Replace with actual backend API call
      // POST /api/rules/test
      // Body: { expression: string, trace: object }

      // Mock implementation for now
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simple mock evaluation
      const matched = Math.random() > 0.5;
      const matchedSpans = matched
        ? request.trace.spans.filter((s) => s.operationName.includes('payment'))
        : [];

      return {
        matched,
        executionTimeMs: Math.random() * 100,
        spansEvaluated: request.trace.spans.length,
        matchedSpans: matchedSpans.length > 0 ? matchedSpans : undefined,
        explanation: matched
          ? 'Rule matched the trace pattern'
          : 'Trace did not satisfy the rule conditions',
      };
    },
  });
}
```

## Success Criteria

- [ ] Users can test rules against sample test cases
- [ ] Custom trace JSON can be pasted and tested
- [ ] Test results show matched/no-match with execution time
- [ ] Matched spans are highlighted with their attributes
- [ ] Test cases can be saved for regression testing
- [ ] Test results include helpful explanations of why rule matched/didn't match
- [ ] Export test cases to JSON for sharing

## Testing Requirements

### Unit Tests (Vitest)
```typescript
// src/components/rules/rule-test-interface.test.tsx
describe('RuleTestInterface', () => {
  it('renders sample test cases', () => {
    render(<RuleTestInterface expression="trace.has(test)" />);
    expect(screen.getByText(/sample test cases/i)).toBeInTheDocument();
  });

  it('runs test when button clicked', async () => {
    const { user } = setup(<RuleTestInterface expression="trace.has(payment)" />);

    // Select a test case
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText(/payment without fraud check/i));

    // Run test
    await user.click(screen.getByRole('button', { name: /run test/i }));

    // Verify result displayed
    await screen.findByText(/test result/i);
  });

  it('displays matched spans', async () => {
    // Mock successful test result
    const { container } = render(<RuleTestInterface expression="..." />);
    // ... verify matched spans are displayed
  });
});

// src/lib/hooks/use-test-rule.test.ts
describe('useTestRule', () => {
  it('calls backend API with expression and trace', async () => {
    const { result } = renderHook(() => useTestRule());

    act(() => {
      result.current.mutate({
        expression: 'trace.has(test)',
        trace: { traceId: '123', spans: [] },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
```

### Storybook Stories
```typescript
// src/stories/RuleTestInterface.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { RuleTestInterface } from '@/components/rules/rule-test-interface';

const meta: Meta<typeof RuleTestInterface> = {
  title: 'Rules/Rule Test Interface',
  component: RuleTestInterface,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RuleTestInterface>;

export const Default: Story = {
  args: {
    expression: 'trace.has(payment.charge_card).where(amount > 1000)\n  and trace.has(payment.fraud_check)',
  },
};

export const WithTestResult: Story = {
  args: {
    expression: 'trace.has(database.query).where(data.contains_pii == true)\n  and trace.has(audit.log)',
  },
  // Mock test result displayed
};
```

## Files to Create

- `/Users/sscoble/Projects/fluo/bff/src/components/rules/rule-test-interface.tsx` - Main testing UI
- `/Users/sscoble/Projects/fluo/bff/src/lib/hooks/use-test-rule.ts` - API hook for testing
- `/Users/sscoble/Projects/fluo/bff/src/components/rules/rule-test-interface.test.tsx` - Component tests
- `/Users/sscoble/Projects/fluo/bff/src/lib/hooks/use-test-rule.test.ts` - Hook tests
- `/Users/sscoble/Projects/fluo/bff/src/stories/RuleTestInterface.stories.tsx` - Storybook stories

## Files to Modify

- `/Users/sscoble/Projects/fluo/bff/src/components/rules/rule-editor.tsx` - Add Test tab with RuleTestInterface

## Backend API Requirements

The backend must implement:

```
POST /api/rules/test
Request:
{
  "expression": "trace.has(payment.charge_card) and trace.has(fraud.check)",
  "trace": {
    "traceId": "trace-001",
    "spans": [
      {
        "spanId": "span-001",
        "operationName": "payment.charge_card",
        "attributes": { "amount": 5000 }
      }
    ]
  }
}

Response:
{
  "matched": true,
  "executionTimeMs": 42.5,
  "spansEvaluated": 3,
  "matchedSpans": [
    {
      "spanId": "span-001",
      "operationName": "payment.charge_card",
      "attributes": { "amount": 5000 }
    }
  ],
  "explanation": "Rule matched because trace contains payment.charge_card span with amount > 1000 but missing fraud.check span"
}
```

## Integration Notes

- **Backend Integration**: Requires backend endpoint for rule evaluation against traces
- **Test Case Storage**: Consider backend storage for shared test cases across team
- **Live Trace Testing**: Future enhancement to test against recent production traces
- **Performance**: For large traces, consider streaming results or pagination
