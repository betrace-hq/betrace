# PRD-027c: Frontend Query UI

**Parent PRD:** PRD-027 (Advanced Query Language for Signal Search)
**Unit:** C
**Priority:** P2
**Dependencies:** Unit A (Core Query Infrastructure), Unit B (Saved Queries)

## Scope

Implement the frontend user interface for executing SQL queries on signals, displaying results, and managing saved queries. This unit provides the complete user experience for the query system.

## Core Functionality

1. **SQL Query Editor**: Textarea for writing SQL queries
2. **Query Execution**: Run queries and display loading states
3. **Results Table**: Display query results in sortable table
4. **Saved Queries Sidebar**: List and load saved queries
5. **Example Queries**: Pre-built query templates
6. **Error Handling**: Clear error messages for failed queries
7. **Query Management**: Save, load, and delete queries

## Implementation

### 1. Signal Query Page Component

**File:** `bff/src/components/signals/signal-query-page.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlayIcon, SaveIcon, BookmarkIcon, Trash2Icon } from 'lucide-react';
import {
  executeSignalQuery,
  listSavedQueries,
  saveQuery,
  executeSavedQuery,
  deleteSavedQuery
} from '@/lib/api/signal-query';
import { SignalQueryResponse, SavedQuery } from '@/lib/types/signal-query';
import { Signal } from '@/lib/types/signal';

export function SignalQueryPage() {
  const [sql, setSql] = useState('');
  const [results, setResults] = useState<SignalQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [queryDescription, setQueryDescription] = useState('');

  // Load saved queries on mount
  useEffect(() => {
    loadSavedQueries();
  }, []);

  const loadSavedQueries = async () => {
    try {
      const queries = await listSavedQueries();
      setSavedQueries(queries);
    } catch (err: any) {
      console.error('Failed to load saved queries:', err);
    }
  };

  const handleExecuteQuery = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await executeSignalQuery({
        sql,
        limit: 1000,
        timeoutSeconds: 10,
      });
      setResults(response);
    } catch (err: any) {
      setError(err.message || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuery = async () => {
    if (!queryName.trim()) {
      setError('Query name is required');
      return;
    }

    try {
      await saveQuery({
        name: queryName,
        description: queryDescription,
        sql,
      });
      setShowSaveDialog(false);
      setQueryName('');
      setQueryDescription('');
      loadSavedQueries();
    } catch (err: any) {
      setError(err.message || 'Failed to save query');
    }
  };

  const handleLoadSavedQuery = (query: SavedQuery) => {
    setSql(query.sql);
  };

  const handleExecuteSavedQuery = async (queryId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await executeSavedQuery(queryId);
      setResults(response);
    } catch (err: any) {
      setError(err.message || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSavedQuery = async (queryId: string) => {
    try {
      await deleteSavedQuery(queryId);
      loadSavedQueries();
    } catch (err: any) {
      setError(err.message || 'Failed to delete query');
    }
  };

  const exampleQueries = [
    {
      name: 'High severity signals (last 7 days)',
      sql: "SELECT * FROM signals WHERE severity = 'HIGH' AND created_at > CURRENT_DATE - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 100"
    },
    {
      name: 'Stale open signals (>24 hours)',
      sql: "SELECT * FROM signals WHERE status = 'OPEN' AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours' ORDER BY created_at ASC"
    },
    {
      name: 'Database-related signals',
      sql: "SELECT * FROM signals WHERE rule_name LIKE '%database%' ORDER BY created_at DESC LIMIT 100"
    },
    {
      name: 'Critical signals by date range',
      sql: "SELECT * FROM signals WHERE severity IN ('CRITICAL', 'HIGH') AND created_at BETWEEN '2025-01-01' AND '2025-01-31' ORDER BY severity DESC, created_at DESC"
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Advanced Signal Query</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Query Editor */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>SQL Query Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="SELECT * FROM signals WHERE severity = 'HIGH' ORDER BY created_at DESC LIMIT 100"
                className="min-h-[200px] font-mono text-sm"
              />

              <div className="flex gap-2 mt-4">
                <Button onClick={handleExecuteQuery} disabled={loading}>
                  <PlayIcon className="w-4 h-4 mr-2" />
                  {loading ? 'Executing...' : 'Execute Query'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={!sql.trim()}
                >
                  <SaveIcon className="w-4 h-4 mr-2" />
                  Save Query
                </Button>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200 rounded">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Query Dialog */}
          {showSaveDialog && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Save Query</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Query Name</label>
                    <Input
                      value={queryName}
                      onChange={(e) => setQueryName(e.target.value)}
                      placeholder="e.g., High Severity Last 7 Days"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description (optional)</label>
                    <Textarea
                      value={queryDescription}
                      onChange={(e) => setQueryDescription(e.target.value)}
                      placeholder="Describe what this query does..."
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveQuery}>Save</Button>
                    <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Query Results */}
          {results && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Query Results</CardTitle>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <span>{results.totalCount} signals found</span>
                  <span>•</span>
                  <span>{results.executionTimeMs}ms execution time</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {results.results.map((signal: Signal) => (
                        <tr key={signal.id}>
                          <td className="px-4 py-2">
                            <Badge variant={signal.severity === 'CRITICAL' ? 'destructive' : 'default'}>
                              {signal.severity}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 font-mono text-sm">{signal.ruleId}</td>
                          <td className="px-4 py-2">{signal.message}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {new Date(signal.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline">{signal.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Saved Queries Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookmarkIcon className="w-4 h-4" />
                Saved Queries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {savedQueries.map((query) => (
                  <div key={query.id} className="group relative">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left"
                      onClick={() => handleLoadSavedQuery(query)}
                    >
                      <div className="truncate w-full">
                        <div className="font-medium">{query.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {query.sql.substring(0, 50)}...
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Executed {query.executionCount} times
                        </div>
                      </div>
                    </Button>
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleExecuteSavedQuery(query.id)}
                      >
                        <PlayIcon className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSavedQuery(query.id)}
                      >
                        <Trash2Icon className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {savedQueries.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No saved queries yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Example Queries */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Example Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {exampleQueries.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left text-xs"
                    onClick={() => setSql(example.sql)}
                  >
                    {example.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

### 2. API Client

**File:** `bff/src/lib/api/signal-query.ts`

```typescript
import { apiClient } from './client';

export interface SignalQueryRequest {
  sql: string;
  limit?: number;
  timeoutSeconds?: number;
}

export interface SignalQueryResponse {
  results: Signal[];
  totalCount: number;
  executionTimeMs: number;
  queryId: string;
  fromCache: boolean;
  metadata: {
    hotStorageCount: number;
    coldStorageCount: number;
  };
}

export interface SavedQuery {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sql: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  executionCount: number;
}

export interface SavedQueryRequest {
  name: string;
  description?: string;
  sql: string;
}

/**
 * Execute SQL query on signals
 */
export async function executeSignalQuery(
  request: SignalQueryRequest
): Promise<SignalQueryResponse> {
  const response = await apiClient.post('/api/signals/query', request);
  return response.data;
}

/**
 * Save a query for reuse
 */
export async function saveQuery(request: SavedQueryRequest): Promise<SavedQuery> {
  const response = await apiClient.post('/api/signals/query/save', request);
  return response.data;
}

/**
 * List saved queries for tenant
 */
export async function listSavedQueries(): Promise<SavedQuery[]> {
  const response = await apiClient.get('/api/signals/query/saved');
  return response.data;
}

/**
 * Get saved query by ID
 */
export async function getSavedQuery(id: string): Promise<SavedQuery> {
  const response = await apiClient.get(`/api/signals/query/saved/${id}`);
  return response.data;
}

/**
 * Execute saved query by ID
 */
export async function executeSavedQuery(id: string): Promise<SignalQueryResponse> {
  const response = await apiClient.post(`/api/signals/query/saved/${id}/execute`);
  return response.data;
}

/**
 * Delete saved query
 */
export async function deleteSavedQuery(id: string): Promise<void> {
  await apiClient.delete(`/api/signals/query/saved/${id}`);
}
```

### 3. Type Definitions

**File:** `bff/src/lib/types/signal-query.ts`

```typescript
import { Signal } from './signal';

export interface SignalQueryRequest {
  sql: string;
  limit?: number;
  timeoutSeconds?: number;
}

export interface SignalQueryResponse {
  results: Signal[];
  totalCount: number;
  executionTimeMs: number;
  queryId: string;
  fromCache: boolean;
  metadata: {
    hotStorageCount: number;
    coldStorageCount: number;
  };
}

export interface SavedQuery {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sql: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  executionCount: number;
}

export interface SavedQueryRequest {
  name: string;
  description?: string;
  sql: string;
}
```

## Success Criteria

### Functional
- [ ] Users can write SQL queries in textarea editor
- [ ] Query execution shows loading state
- [ ] Results displayed in sortable table
- [ ] Saved queries listed in sidebar
- [ ] Users can save queries with name and description
- [ ] Users can load saved queries into editor
- [ ] Users can execute saved queries directly
- [ ] Users can delete saved queries
- [ ] Example queries populate editor on click
- [ ] Error messages displayed clearly

### User Experience
- [ ] Query editor has clear placeholder text
- [ ] Loading state prevents double-execution
- [ ] Error messages are actionable
- [ ] Results table is responsive
- [ ] Saved queries show execution count
- [ ] Example queries are helpful for beginners

## Testing Requirements

### Component Tests

**File:** `bff/src/components/signals/signal-query-page.test.tsx`

Required test cases:
- [ ] testRenderQueryEditor
- [ ] testExecuteQuery
- [ ] testDisplayQueryResults
- [ ] testShowErrorMessage
- [ ] testLoadSavedQueries
- [ ] testSaveQuery
- [ ] testLoadSavedQueryIntoEditor
- [ ] testExecuteSavedQuery
- [ ] testDeleteSavedQuery
- [ ] testLoadExampleQuery

### Storybook Stories

**File:** `bff/src/stories/SignalQuery.stories.tsx`

Required stories:
- [ ] Default (empty state)
- [ ] With SQL query
- [ ] Loading state
- [ ] With results
- [ ] With error
- [ ] With saved queries

## Files to Create

### Frontend - Components
- `bff/src/components/signals/signal-query-page.tsx`

### Frontend - API Client
- `bff/src/lib/api/signal-query.ts`

### Frontend - Types
- `bff/src/lib/types/signal-query.ts`

### Frontend - Tests
- `bff/src/components/signals/signal-query-page.test.tsx`

### Frontend - Stories
- `bff/src/stories/SignalQuery.stories.tsx`

## Files to Modify

- `bff/src/routes/signals.tsx` - Add query page route
- `bff/src/components/layout/navigation.tsx` - Add query page link

## Architecture Compliance

- **ADR-011 (Pure Application)**: React component with no external dependencies
- **Tanstack Router**: Route integration for /signals/query
- **shadcn/ui**: Uses existing UI components (Card, Button, Textarea, Badge)

## Future Enhancements

1. **Monaco Editor**: Syntax highlighting for SQL
2. **Query Autocomplete**: Field name suggestions
3. **Query History**: Last 10 executed queries
4. **Query Export**: Export results to CSV/JSON
5. **Query Sharing**: Share queries with team
6. **Query Validation**: Real-time SQL syntax validation

## Timeline

**Duration:** Week 3 (5 days)

**Day 1:** Implement SignalQueryPage component
**Day 2:** Implement API client and types
**Day 3:** Add saved queries functionality
**Day 4:** Write component tests
**Day 5:** Create Storybook stories and polish UI
