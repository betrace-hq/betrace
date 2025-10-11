# PRD-027e: Documentation & Polish

**Parent PRD:** PRD-027 (Advanced Query Language for Signal Search)
**Unit:** E
**Priority:** P2
**Dependencies:** Unit A (Core Query Infrastructure), Unit B (Saved Queries), Unit C (Frontend Query UI), Unit D (Performance Optimization)

## Scope

Complete the query system with comprehensive documentation, UI polish, and developer experience enhancements. This unit ensures the feature is production-ready and user-friendly.

## Core Functionality

1. **API Documentation**: OpenAPI spec for query endpoints
2. **User Guide**: SQL query tutorial with examples
3. **Monaco Editor**: Syntax highlighting for SQL
4. **Query Autocomplete**: Field name suggestions
5. **Query History**: Last 10 executed queries
6. **Error Catalog**: Clear, actionable error messages
7. **Video Tutorial**: Query usage walkthrough

## Implementation

### 1. API Documentation

**File:** `docs/api/signal-query-api.md`

```markdown
# Signal Query API

## Overview

Execute SQL queries on signals with automatic tenant isolation and security validation.

## Endpoints

### Execute Query

**POST** `/api/signals/query`

Execute SQL query on signals.

**Request:**
```json
{
  "sql": "SELECT * FROM signals WHERE severity = 'HIGH' LIMIT 100",
  "limit": 1000,
  "timeoutSeconds": 10
}
```

**Response:**
```json
{
  "results": [...],
  "totalCount": 150,
  "executionTimeMs": 234,
  "queryId": "query-abc123",
  "fromCache": false,
  "metadata": {
    "hotStorageCount": 150,
    "coldStorageCount": 0
  }
}
```

**Error Codes:**
- `400 Bad Request`: Invalid SQL syntax
- `403 Forbidden`: Security violation (SQL injection detected)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Query execution failed

### Save Query

**POST** `/api/signals/query/save`

Save SQL query for reuse.

**Request:**
```json
{
  "name": "High Severity Last 7 Days",
  "description": "Find all high severity signals from the last week",
  "sql": "SELECT * FROM signals WHERE severity = 'HIGH' AND created_at > CURRENT_DATE - INTERVAL '7 days'"
}
```

**Response:**
```json
{
  "id": "query-xyz789",
  "tenantId": "tenant-abc123",
  "name": "High Severity Last 7 Days",
  "sql": "...",
  "createdAt": "2025-01-15T10:30:00Z",
  "executionCount": 0
}
```

### List Saved Queries

**GET** `/api/signals/query/saved`

List all saved queries for tenant.

**Response:**
```json
[
  {
    "id": "query-xyz789",
    "name": "High Severity Last 7 Days",
    "sql": "...",
    "executionCount": 5
  }
]
```

### Execute Saved Query

**POST** `/api/signals/query/saved/{id}/execute`

Execute saved query by ID.

**Response:** Same as Execute Query

### Delete Saved Query

**DELETE** `/api/signals/query/saved/{id}`

Delete saved query.

**Response:**
```json
{
  "deleted": true
}
```

## Queryable Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | String | Signal UUID | `sig-abc123` |
| `tenant_id` | String | Tenant UUID (auto-filtered) | `tenant-xyz` |
| `rule_id` | String | Rule UUID | `rule-123` |
| `severity` | Enum | CRITICAL, HIGH, MEDIUM, LOW, INFO | `HIGH` |
| `status` | Enum | OPEN, INVESTIGATING, RESOLVED | `OPEN` |
| `message` | String | Signal message | `Database timeout` |
| `created_at` | Timestamp | Signal creation time | `2025-01-15 10:30:00` |
| `trace_id` | String | OpenTelemetry trace ID | `abc123` |
| `span_id` | String | OpenTelemetry span ID | `def456` |
| `rule_name` | String | Rule name | `database-timeout` |

## SQL Examples

### High Severity Last 7 Days
```sql
SELECT * FROM signals
WHERE severity = 'HIGH'
  AND created_at > CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100
```

### Stale Open Signals
```sql
SELECT * FROM signals
WHERE status = 'OPEN'
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY created_at ASC
```

### Date Range Query
```sql
SELECT * FROM signals
WHERE created_at BETWEEN '2025-01-01' AND '2025-01-31'
  AND severity IN ('CRITICAL', 'HIGH')
ORDER BY severity DESC, created_at DESC
```

### Full-Text Search
```sql
SELECT * FROM signals
WHERE message LIKE '%timeout%'
   OR rule_name LIKE '%timeout%'
ORDER BY created_at DESC
```

## Security

### Tenant Isolation
All queries automatically filtered by `tenant_id` extracted from JWT token:

**User query:**
```sql
SELECT * FROM signals WHERE severity = 'HIGH'
```

**Executed query:**
```sql
SELECT * FROM signals WHERE tenant_id = 'tenant-abc123' AND severity = 'HIGH'
```

### SQL Injection Prevention
- Only SELECT queries allowed
- Dangerous keywords blocked (DROP, DELETE, UPDATE, etc.)
- Multiple statements rejected
- Query timeout: 10 seconds
- Row limit: 10,000 rows

### Rate Limiting
- 10 queries per minute per tenant
- Rate limit resets every minute

## Performance

### Query Caching
- Cache TTL: 60 seconds
- Cache key: SHA-256(tenantId + sql)
- Cached queries return in <50ms

### Query Cost Estimation
- Expensive queries rejected before execution
- Maximum cost: 1000 (heuristic)

### Recommended Indexes
```sql
CREATE INDEX idx_signals_severity ON signals(severity);
CREATE INDEX idx_signals_created_at ON signals(created_at);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_severity_created_at ON signals(severity, created_at);
```
```

### 2. User Guide

**File:** `docs/guides/signal-queries.md`

```markdown
# Signal Query User Guide

## Introduction

FLUO's Advanced Query Language allows you to search signals using SQL queries. This guide covers query syntax, examples, and best practices.

## Quick Start

1. Navigate to **Signals** → **Query** in the FLUO dashboard
2. Write your SQL query in the editor
3. Click **Execute Query** to run
4. View results in the table below

## Basic Query Syntax

### SELECT All Signals
```sql
SELECT * FROM signals LIMIT 100
```

### Filter by Severity
```sql
SELECT * FROM signals WHERE severity = 'HIGH'
```

### Multiple Conditions (AND)
```sql
SELECT * FROM signals
WHERE severity = 'HIGH'
  AND status = 'OPEN'
```

### Multiple Conditions (OR)
```sql
SELECT * FROM signals
WHERE severity = 'CRITICAL'
   OR severity = 'HIGH'
```

### Date Range
```sql
SELECT * FROM signals
WHERE created_at BETWEEN '2025-01-01' AND '2025-01-31'
```

### Relative Dates
```sql
SELECT * FROM signals
WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
```

### Pattern Matching (LIKE)
```sql
SELECT * FROM signals
WHERE rule_name LIKE '%database%'
```

### IN Operator
```sql
SELECT * FROM signals
WHERE severity IN ('CRITICAL', 'HIGH')
```

### NOT Operator
```sql
SELECT * FROM signals
WHERE NOT (rule_name LIKE '%test%')
```

## Common Use Cases

### 1. SRE Investigation: High Severity Signals
**Scenario:** Find all high severity signals from the last 7 days

```sql
SELECT * FROM signals
WHERE severity = 'HIGH'
  AND created_at > CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100
```

### 2. Compliance Audit: Date Range Query
**Scenario:** Show signals for specific date range

```sql
SELECT * FROM signals
WHERE created_at BETWEEN '2025-01-01' AND '2025-01-31'
  AND severity IN ('CRITICAL', 'HIGH')
ORDER BY severity DESC, created_at DESC
```

### 3. Pattern Analysis: Stale Signals
**Scenario:** Find signals open for more than 24 hours

```sql
SELECT * FROM signals
WHERE status = 'OPEN'
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY created_at ASC
```

### 4. Performance Debugging: Specific Rule
**Scenario:** Find signals from specific rule

```sql
SELECT * FROM signals
WHERE rule_name = 'database-timeout'
ORDER BY created_at DESC
```

### 5. Full-Text Search: Find by Trace ID
**Scenario:** Search for specific trace

```sql
SELECT * FROM signals
WHERE trace_id = 'abc123-def456-ghi789'
```

## Saved Queries

### Save a Query
1. Write your SQL query
2. Click **Save Query**
3. Enter name and description
4. Click **Save**

### Load a Saved Query
1. Find query in **Saved Queries** sidebar
2. Click query name to load into editor
3. Click **Execute** to run

### Execute Saved Query Directly
1. Find query in **Saved Queries** sidebar
2. Click **Play** icon to execute without loading

## Best Practices

### Performance
- **Always use LIMIT**: Prevent large result sets
- **Index-friendly queries**: Use indexed fields (severity, created_at, status)
- **Avoid LIKE '%pattern'**: Prefix wildcards are slow

### Security
- **Never share queries with sensitive data**: Avoid hardcoding tenant-specific values
- **Test queries before saving**: Ensure they work correctly

### Organization
- **Descriptive names**: Use clear names for saved queries
- **Add descriptions**: Explain what the query does

## Limitations

- **10 queries per minute**: Rate limit per tenant
- **10 second timeout**: Long-running queries will be cancelled
- **10,000 row limit**: Maximum result size
- **SELECT only**: No DELETE, UPDATE, or INSERT allowed
- **Single statement**: No multiple queries (semicolons)

## Troubleshooting

### "Query contains dangerous operations"
**Cause:** Query uses forbidden keywords (DROP, DELETE, UPDATE)
**Fix:** Use only SELECT queries

### "Rate limit exceeded"
**Cause:** More than 10 queries per minute
**Fix:** Wait 60 seconds and try again

### "Query timeout"
**Cause:** Query took longer than 10 seconds
**Fix:** Optimize query (add WHERE filters, use indexes)

### "Saved query not found"
**Cause:** Query was deleted or doesn't exist
**Fix:** Check saved queries list

## Advanced Features

### Query Cost Estimation
FLUO estimates query cost before execution. Expensive queries (cost >1000) are rejected.

### Query Caching
Identical queries return cached results (60 second TTL) for faster response.

### Automatic Tenant Isolation
All queries are automatically filtered to your tenant - you cannot access other tenants' signals.
```

### 3. Monaco Editor Integration

**File:** `bff/src/components/signals/sql-editor.tsx`

```tsx
import React from 'react';
import Editor from '@monaco-editor/react';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function SqlEditor({ value, onChange }: SqlEditorProps) {
  return (
    <Editor
      height="200px"
      language="sql"
      value={value}
      onChange={(value) => onChange(value || '')}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly: false,
        automaticLayout: true,
      }}
    />
  );
}
```

### 4. Query History

**File:** `bff/src/components/signals/query-history.tsx`

```tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClockIcon } from 'lucide-react';

interface QueryHistoryItem {
  sql: string;
  timestamp: Date;
  executionTimeMs: number;
  resultCount: number;
}

interface QueryHistoryProps {
  history: QueryHistoryItem[];
  onLoadQuery: (sql: string) => void;
}

export function QueryHistory({ history, onLoadQuery }: QueryHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4" />
          Query History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {history.slice(0, 10).map((item, index) => (
            <Button
              key={index}
              variant="ghost"
              className="w-full justify-start text-left"
              onClick={() => onLoadQuery(item.sql)}
            >
              <div className="truncate w-full">
                <div className="text-xs font-mono truncate">{item.sql}</div>
                <div className="text-xs text-muted-foreground">
                  {item.resultCount} results in {item.executionTimeMs}ms
                </div>
              </div>
            </Button>
          ))}

          {history.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No query history yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 5. Error Catalog

**File:** `docs/guides/query-errors.md`

```markdown
# Query Error Catalog

## SQL Syntax Errors

### "SQL query is required"
**Error Code:** 400
**Cause:** Empty or null SQL query
**Fix:** Provide a valid SQL query

### "Only SELECT queries are allowed"
**Error Code:** 400
**Cause:** Query does not start with SELECT
**Fix:** Use SELECT queries only

## Security Errors

### "Query contains dangerous operations"
**Error Code:** 403
**Cause:** Query uses forbidden keywords (DROP, DELETE, UPDATE, ALTER, etc.)
**Fix:** Remove dangerous keywords, use SELECT only

### "Multiple SQL statements are not allowed"
**Error Code:** 403
**Cause:** Query contains multiple statements (semicolons)
**Fix:** Use single SELECT statement

### "Query too long"
**Error Code:** 400
**Cause:** Query exceeds 10,000 characters
**Fix:** Simplify query or split into multiple queries

## Rate Limiting Errors

### "Rate limit exceeded: max 10 queries per minute"
**Error Code:** 429
**Cause:** More than 10 queries executed in last minute
**Fix:** Wait 60 seconds before retrying

## Performance Errors

### "Query timeout"
**Error Code:** 500
**Cause:** Query execution took longer than 10 seconds
**Fix:** Optimize query (add WHERE filters, use indexes, reduce result size)

### "Query too expensive"
**Error Code:** 400
**Cause:** Estimated query cost exceeds maximum (1000)
**Fix:** Simplify query (remove cartesian products, avoid LIKE '%...', reduce JOINs)

### "Limit must be between 1 and 10,000"
**Error Code:** 400
**Cause:** Invalid LIMIT value
**Fix:** Use LIMIT between 1 and 10,000

## Data Errors

### "Tenant ID is required for query isolation"
**Error Code:** 403
**Cause:** Missing tenant ID in request headers
**Fix:** Ensure JWT token is valid and contains tenant claim

### "Saved query not found"
**Error Code:** 404
**Cause:** Query ID does not exist or was deleted
**Fix:** Check saved queries list for valid IDs
```

### 6. Enhanced Query Page

**File:** `bff/src/components/signals/signal-query-page.tsx` (updated with Monaco + History)

Add imports:
```tsx
import { SqlEditor } from './sql-editor';
import { QueryHistory } from './query-history';
```

Replace Textarea with SqlEditor:
```tsx
<SqlEditor value={sql} onChange={setSql} />
```

Add query history state:
```tsx
const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);

// After query execution:
setQueryHistory(prev => [
  {
    sql,
    timestamp: new Date(),
    executionTimeMs: response.executionTimeMs,
    resultCount: response.totalCount
  },
  ...prev
]);
```

Add QueryHistory component to sidebar:
```tsx
<QueryHistory
  history={queryHistory}
  onLoadQuery={(sql) => setSql(sql)}
/>
```

## Success Criteria

### Documentation
- [ ] API documentation complete (OpenAPI spec)
- [ ] User guide covers all query scenarios
- [ ] Error catalog documents all error codes
- [ ] Video tutorial recorded (5-10 minutes)

### UI Polish
- [ ] Monaco editor integrated with syntax highlighting
- [ ] Query history shows last 10 queries
- [ ] Field autocomplete suggests column names
- [ ] Error messages are clear and actionable

### Developer Experience
- [ ] Storybook stories for all components
- [ ] API examples in documentation
- [ ] Query templates for common use cases

## Testing Requirements

### Documentation Tests
- [ ] All API examples execute successfully
- [ ] User guide queries work correctly
- [ ] Error messages match error catalog

### UI Tests
- [ ] Monaco editor loads correctly
- [ ] Query history updates after execution
- [ ] Autocomplete suggests valid fields

## Files to Create

### Documentation
- `docs/api/signal-query-api.md`
- `docs/guides/signal-queries.md`
- `docs/guides/query-errors.md`
- `docs/videos/query-tutorial.md` (script)

### Frontend Components
- `bff/src/components/signals/sql-editor.tsx`
- `bff/src/components/signals/query-history.tsx`

### Frontend Stories
- `bff/src/stories/SqlEditor.stories.tsx`
- `bff/src/stories/QueryHistory.stories.tsx`

## Files to Modify

- `bff/src/components/signals/signal-query-page.tsx` - Integrate Monaco + History
- `bff/package.json` - Add @monaco-editor/react dependency

## Architecture Compliance

- **Documentation First**: Comprehensive API and user documentation
- **User Experience**: Monaco editor, query history, autocomplete
- **Developer Experience**: Storybook stories, code examples

## Future Enhancements

1. **Advanced Autocomplete**: Context-aware field suggestions
2. **Query Validation**: Real-time SQL syntax checking
3. **Query Templates**: Pre-built queries for common scenarios
4. **Query Sharing**: Share queries with team members
5. **Query Analytics**: Track most used queries

## Timeline

**Duration:** Week 5 (5 days)

**Day 1:** Write API documentation and user guide
**Day 2:** Integrate Monaco editor
**Day 3:** Implement query history and autocomplete
**Day 4:** Create Storybook stories
**Day 5:** Record video tutorial and polish UI
