# Error Handling & Graceful Degradation

## Overview

The BeTrace Grafana plugin implements standardized error handling with graceful degradation to provide a resilient user experience during backend outages or resource spikes.

## Key Features

### 1. Standardized Error Messages

All error messages follow a consistent format defined in `src/utils/errorHandling.ts`:

```typescript
interface ErrorResponse {
  message: string;           // User-friendly description
  type: 'network' | 'timeout' | 'server' | 'unknown';
  retryable: boolean;        // Whether auto-retry should occur
  statusCode?: number;       // HTTP status code if applicable
}
```

**Error Types:**
- **Network**: Connection failures (backend unreachable)
- **Timeout**: Request timeouts (backend slow/overloaded)
- **Server**: HTTP 4xx/5xx errors (backend errors)
- **Unknown**: Unexpected errors

### 2. Automatic Retry with Exponential Backoff

The `retryWithBackoff` utility automatically retries failed requests:

```typescript
retryWithBackoff(fetchFunction, {
  maxRetries: 2,           // Default: 3
  initialDelay: 500,       // Default: 1000ms
  maxDelay: 5000,          // Default: 10000ms
  backoffMultiplier: 2,    // Default: 2
});
```

**Retry Strategy:**
- Attempt 1: Immediate
- Attempt 2: Wait 500ms
- Attempt 3: Wait 1000ms (500 × 2)
- Attempt 4: Wait 2000ms (1000 × 2)
- Max wait: 5000ms

### 3. Graceful Degradation with Cached Data

When the backend is temporarily unavailable:

1. **Cached Data Display**: Shows last known good data
2. **Visual Indicators**: Orange badge indicates cached data mode
3. **Auto-Retry**: Background retries every 30 seconds
4. **Retry Counter**: Shows user how many retries have occurred

**Example:**
```
┌─────────────────────────────────────────────┐
│ ⚠️  Using Cached Data                       │
│ Backend unavailable. Showing last known     │
│ data. Auto-retry #3                         │
└─────────────────────────────────────────────┘
```

### 4. ErrorDisplay Component

Reusable component for consistent error UI across all pages:

```tsx
<ErrorDisplay
  error={parsedError}
  onRetry={fetchData}
  context="Dashboard Metrics"
  showDetails={true}  // Optional: show HTTP status codes
/>
```

**Features:**
- Automatic severity detection (error/warning/info)
- Retry button for retryable errors
- Status code display (optional)
- Context-aware titles

## Error Messages by Scenario

### Network Errors
```
Unable to connect to BeTrace backend.
Check that the backend service is running.
```
- **Type**: Network
- **Retryable**: Yes
- **Severity**: Info
- **Action**: Auto-retry with backoff

### Timeout Errors
```
Request timed out.
The backend may be experiencing high load.
```
- **Type**: Timeout
- **Retryable**: Yes
- **Severity**: Warning
- **Action**: Auto-retry with backoff

### Service Unavailable (503)
```
Backend service temporarily unavailable.
Data will refresh automatically.
```
- **Type**: Server
- **Retryable**: Yes
- **Severity**: Info
- **Action**: Auto-retry + show cached data

### Rate Limited (429)
```
Too many requests.
Please wait a moment before refreshing.
```
- **Type**: Server
- **Retryable**: Yes
- **Severity**: Warning
- **Action**: Auto-retry with longer delays

### Not Found (404)
```
Resource not found.
This may be expected for new installations.
```
- **Type**: Server
- **Retryable**: No
- **Severity**: Error
- **Action**: User must investigate

### Server Error (500)
```
Backend error occurred.
Showing cached data if available.
```
- **Type**: Server
- **Retryable**: Yes
- **Severity**: Error
- **Action**: Auto-retry + show cached data

## Implementation by Page

### HomePage
- ✅ Cached metrics during outages
- ✅ Retry with backoff
- ✅ Visual indicator for stale data
- ✅ Auto-refresh every 30 seconds

### SignalsPage (InvariantsPage)
- ✅ Cached violations during outages
- ✅ Cached statistics during partial failures
- ✅ Retry with backoff
- ✅ Visual indicators (badges + alerts)
- ✅ Auto-refresh every 10 seconds

### RulesPage
- ✅ Retry with backoff for rule fetching
- ✅ Error logging for debugging
- ⚠️  No cached data (rules are mutable)

## Testing Error Scenarios

### Storybook Stories

View all error states in Storybook:
```bash
npm run storybook
# Navigate to: Components > ErrorDisplay
```

**Available Stories:**
- Network Error
- Timeout Error
- Service Unavailable (503)
- Rate Limited (429)
- Not Found (404)
- With Custom Context

### Manual Testing

1. **Network Failure**: Stop backend → Observe cached data + retry
2. **Slow Backend**: Add delay in backend → Observe timeout warnings
3. **Partial Failure**: Break one API endpoint → Observe partial data
4. **Recovery**: Restart backend → Observe automatic recovery

## Best Practices

### When to Use Cached Data

✅ **Use Cached Data:**
- Metrics that change slowly (violation counts, active rules)
- Data that's helpful even if stale
- Non-critical display data

❌ **Don't Cache:**
- Mutable user input (rules being edited)
- Critical real-time data (active incidents)
- Write operations (create/update/delete)

### Error Message Guidelines

1. **Be Specific**: "Unable to connect to BeTrace backend" not "Error occurred"
2. **Suggest Action**: "Check that backend is running" not just "Connection failed"
3. **Set Expectations**: "Data will refresh automatically" not "Please refresh"
4. **Avoid Jargon**: "Backend unavailable" not "HTTP 503 Service Unavailable"

### Retry Configuration

**Fast Operations** (sub-second):
```typescript
maxRetries: 2,
initialDelay: 500,
maxDelay: 5000,
```

**Slow Operations** (multi-second):
```typescript
maxRetries: 3,
initialDelay: 1000,
maxDelay: 10000,
```

**Background Operations**:
```typescript
maxRetries: 5,
initialDelay: 2000,
maxDelay: 30000,
```

## Monitoring & Debugging

### Console Logging

Retry attempts are logged to console:
```
Retry attempt 1/3 after 500ms
Retry attempt 2/3 after 1000ms
```

### Error Tracking

All errors are logged with:
- Error type
- Status code (if applicable)
- Retryable flag
- Timestamp

### User Feedback

Users see:
- Retry counter in UI
- Cached data badge
- Error message with context
- Auto-retry indicator

## Future Enhancements

- [ ] Exponential backoff with jitter (randomization)
- [ ] Circuit breaker pattern (stop retrying after N failures)
- [ ] Partial data loading (fetch what's available)
- [ ] Offline mode detection
- [ ] Error reporting to backend
- [ ] User-configurable retry settings
