# PRD-014f: Test History View

**Priority:** P1 (User Workflow)
**Complexity:** Simple (Component)
**Type:** Unit PRD
**Parent:** PRD-014 (Developer Rule Testing)
**Dependencies:** PRD-014c (Test Result Recording)

## Problem

Developers need to see test history for a rule to track testing progress and run regression tests. Without test history visibility, developers cannot verify that all test cases passed or identify when rules broke.

## Solution

Implement test history dashboard showing all test executions for a rule. Display pass/fail status, execution time, and test source. Provide "Run All Tests" button for regression testing with summary results.

## Unit Description

**File:** `bff/src/components/rules/test-history.tsx`
**Type:** React Component
**Purpose:** Display test execution history and regression test runner

## Implementation

```tsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Play, TrendingUp } from 'lucide-react';
import { getTestHistory, runRegressionTests } from '@/lib/api/rule-testing';

interface TestHistoryProps {
  ruleId: string;
}

interface TestExecutionRecord {
  testId: string;
  userId: string;
  ruleFired: boolean;
  matchedSpanCount: number;
  executionTimeMs: number;
  traceSource: string;
  testPassed: boolean;
  timestamp: string;
}

interface TestStatistics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  avgExecutionTimeMs: number;
}

interface RegressionTestResult {
  totalTestCases: number;
  passedTestCases: number;
  failedTestCases: number;
  executionTimeMs: number;
  failedTests: Array<{
    testCaseName: string;
    expected: boolean;
    actual: boolean;
  }>;
}

export function TestHistory({ ruleId }: TestHistoryProps) {
  const [history, setHistory] = useState<TestExecutionRecord[]>([]);
  const [statistics, setStatistics] = useState<TestStatistics | null>(null);
  const [regressionResult, setRegressionResult] = useState<RegressionTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [regressionLoading, setRegressionLoading] = useState(false);

  useEffect(() => {
    loadTestHistory();
  }, [ruleId]);

  const loadTestHistory = async () => {
    setLoading(true);
    try {
      const data = await getTestHistory(ruleId);
      setHistory(data.history);
      setStatistics(data.statistics);
    } catch (err) {
      console.error('Failed to load test history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunRegressionTests = async () => {
    setRegressionLoading(true);
    setRegressionResult(null);
    try {
      const result = await runRegressionTests(ruleId);
      setRegressionResult(result);
      // Reload history to show new test executions
      loadTestHistory();
    } catch (err) {
      console.error('Failed to run regression tests:', err);
    } finally {
      setRegressionLoading(false);
    }
  };

  if (loading) {
    return <div>Loading test history...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Card */}
      {statistics && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Test Statistics</h3>
            <Button
              onClick={handleRunRegressionTests}
              disabled={regressionLoading}
              variant="outline"
            >
              <Play className="w-4 h-4 mr-2" />
              {regressionLoading ? 'Running...' : 'Run All Tests'}
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Total Tests"
              value={statistics.totalTests}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              label="Passed"
              value={statistics.passedTests}
              icon={<CheckCircle className="w-5 h-5 text-green-500" />}
            />
            <StatCard
              label="Failed"
              value={statistics.failedTests}
              icon={<XCircle className="w-5 h-5 text-red-500" />}
            />
            <StatCard
              label="Avg Time"
              value={`${statistics.avgExecutionTimeMs}ms`}
              icon={<Clock className="w-5 h-5" />}
            />
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Pass Rate:</span>
              <Badge variant={statistics.passRate >= 0.8 ? 'default' : 'destructive'}>
                {(statistics.passRate * 100).toFixed(1)}%
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Regression Test Results */}
      {regressionResult && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Regression Test Results</h3>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">Test Cases:</span>
              <Badge variant="secondary">{regressionResult.totalTestCases}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm">Passed: {regressionResult.passedTestCases}</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm">Failed: {regressionResult.failedTestCases}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Total Time: {regressionResult.executionTimeMs}ms</span>
            </div>
          </div>

          {regressionResult.failedTests.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-sm mb-2">Failed Tests:</h4>
              <div className="space-y-1">
                {regressionResult.failedTests.map((test, idx) => (
                  <div key={idx} className="text-sm text-red-600">
                    {test.testCaseName}: Expected {test.expected ? 'fire' : 'no fire'},
                    got {test.actual ? 'fire' : 'no fire'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Test History Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Test Execution History</h3>

        {history.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No test executions yet
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((record) => (
              <div
                key={record.testId}
                className="flex items-center justify-between p-3 border rounded hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  {record.testPassed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {record.ruleFired ? 'Rule Fired' : 'Rule Did Not Fire'}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {record.traceSource}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(record.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {record.matchedSpanCount} spans
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    {record.executionTimeMs}ms
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Frontend only - queries backend API for test history
**ADR-013 (Camel-First):** Not applicable (frontend component)
**ADR-014 (Named Processors):** Not applicable (frontend component)
**ADR-015 (Tiered Storage):** Not applicable (frontend component)

## API Integration

```typescript
// bff/src/lib/api/rule-testing.ts
export async function getTestHistory(ruleId: string) {
  const response = await fetch(`/api/rules/${ruleId}/test-history`);

  if (!response.ok) {
    throw new Error('Failed to load test history');
  }

  return response.json();
}

export async function runRegressionTests(ruleId: string) {
  const response = await fetch(`/api/rules/${ruleId}/regression-test`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Regression tests failed');
  }

  return response.json();
}
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testRender_InitialState - renders statistics and empty history
- testLoadTestHistory - fetches and displays test executions
- testStatistics_Display - shows total, passed, failed, avg time
- testStatistics_PassRate - displays pass rate percentage with color
- testRunRegressionTests - clicking button runs all test cases
- testRegressionResult_Display - shows regression test summary
- testRegressionResult_FailedTests - lists failed test cases with details
- testTestHistory_EmptyState - displays message when no tests
- testTestHistory_RecordDisplay - shows test record with pass/fail icon
- testTestHistory_Timestamp - formats timestamp correctly

**Integration Tests:**
- testFullWorkflow_LoadHistory - load test history from API
- testFullWorkflow_RegressionTest - run regression → see results → updated history

**Test Coverage:** 80% minimum (frontend testing standards)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Unauthorized history access - mitigate with RBAC checks on API
- Tenant data leakage - mitigate with tenant filtering in backend
- XSS via test data - mitigate with React auto-escaping
- API abuse (mass regression runs) - mitigate with rate limiting

**Compliance:**
- SOC2 CC6.1 (Access Control) - only rule owners see test history
- SOC2 CC8.1 (Change Management) - test history proves testing process

## Success Criteria

- [ ] Display test execution history for rule
- [ ] Show test statistics (total, passed, failed, pass rate, avg time)
- [ ] Run regression tests (all saved test cases)
- [ ] Display regression test results with failed test details
- [ ] Format timestamps correctly
- [ ] Show pass/fail icons
- [ ] All tests pass with 80% coverage
