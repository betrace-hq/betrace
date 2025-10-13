# PRD-015g: Compliance Dashboard CSRF Token Refresh

**Parent PRD:** PRD-015f (Compliance Evidence Dashboard)
**Priority:** P2
**Status:** Backlog
**Estimated Effort:** 2 days

## Context

Security expert review identified that CSRF token refresh logic is missing. When tokens expire (typically after 1-2 hours), users must manually reload the page to get a new token.

## Problem Statement

**Current Behavior:**
- CSRF token fetched once on page load
- Cached for entire session
- No automatic refresh on 403 Forbidden responses
- Users see cryptic "Forbidden" errors when token expires

**Impact:**
- Poor user experience during long sessions
- Support burden (users don't understand the error)
- Lost work if forms are abandoned

## Requirements

### Functional Requirements

1. **Automatic Token Refresh**
   - Detect 403 responses that indicate expired CSRF tokens
   - Automatically fetch new token
   - Retry original request with fresh token
   - Transparent to user (no error shown)

2. **Retry Logic**
   - Maximum 1 retry attempt per request
   - Avoid infinite retry loops
   - Clear error after retry failure

3. **Token Caching**
   - Cache valid tokens in memory
   - Invalidate on 403 responses
   - Share token across concurrent requests

### Non-Functional Requirements

- Token refresh completes within 500ms
- No user-visible loading indicators for refresh
- Thread-safe token refresh (prevent race conditions)

## Implementation

### API Client Enhancement

**File:** `/Users/sscoble/Projects/fluo/bff/src/lib/api/compliance.ts`

```typescript
private csrfTokenRefreshInProgress: Promise<string> | null = null;

private async fetchWithCSRF<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let csrfToken = await this.getCSRFToken();

  const response = await fetch(`${this.baseUrl}${url}`, {
    ...options,
    headers: {
      ...options?.headers,
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
  });

  // Handle token expiration
  if (response.status === 403) {
    const errorBody = await response.json().catch(() => ({}));

    // Check if it's a CSRF token error (not a permission error)
    if (errorBody.error === 'CSRF_TOKEN_EXPIRED') {
      // Invalidate cached token
      this.csrfToken = null;

      // Refresh token
      csrfToken = await this.getCSRFToken();

      // Retry request once
      const retryResponse = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        headers: {
          ...options?.headers,
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      if (!retryResponse.ok) {
        throw new Error(`Request failed after token refresh: ${retryResponse.statusText}`);
      }

      return retryResponse.json();
    }
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

private async getCSRFToken(): Promise<string> {
  // Prevent concurrent token refresh requests
  if (this.csrfTokenRefreshInProgress) {
    return this.csrfTokenRefreshInProgress;
  }

  if (this.csrfToken) {
    return this.csrfToken;
  }

  this.csrfTokenRefreshInProgress = fetch(`${this.baseUrl}/csrf-token`, {
    credentials: 'include',
  })
    .then(res => res.json())
    .then(data => {
      this.csrfToken = data.token;
      this.csrfTokenRefreshInProgress = null;
      return data.token;
    });

  return this.csrfTokenRefreshInProgress;
}
```

### Testing Requirements

**File:** `/Users/sscoble/Projects/fluo/bff/src/lib/api/compliance.test.ts`

```typescript
describe('CSRF token refresh', () => {
  it('should refresh token on 403 with CSRF error', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        status: 403,
        json: async () => ({ error: 'CSRF_TOKEN_EXPIRED' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'success' }),
      });

    global.fetch = mockFetch;

    const result = await complianceApi.getEvidenceSpans({});

    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + retry + CSRF fetch
    expect(result).toEqual({ data: 'success' });
  });

  it('should not retry on permission 403 errors', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      status: 403,
      json: async () => ({ error: 'INSUFFICIENT_PERMISSIONS' }),
    });

    global.fetch = mockFetch;

    await expect(complianceApi.getEvidenceSpans({})).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
  });

  it('should prevent concurrent token refresh', async () => {
    // Test implementation...
  });
});
```

## Success Criteria

- [ ] Token automatically refreshes on expiration
- [ ] Users don't see errors during token refresh
- [ ] Maximum 1 retry per request
- [ ] No race conditions in token refresh
- [ ] Tests verify all scenarios
- [ ] Documentation updated

## Out of Scope

- Session timeout handling (separate feature)
- Multi-tab token synchronization (use localStorage if needed)
- Token pre-emptive refresh (refresh before expiration)

## Dependencies

- Backend must return `CSRF_TOKEN_EXPIRED` error code for expired tokens
- Backend must distinguish between CSRF errors and permission errors

## Timeline

**Week 1:**
- Day 1-2: Implement token refresh logic
- Day 3: Write comprehensive tests
- Day 4: Manual testing and edge cases
- Day 5: Documentation and PR

## Acceptance Criteria

1. User can work for 4+ hours without manual page refresh
2. Token refresh happens transparently (no user action)
3. Clear error messages if retry fails
4. 95%+ test coverage on token refresh logic
