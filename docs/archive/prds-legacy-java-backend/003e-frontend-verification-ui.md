# PRD-003e: Frontend Verification UI

**Parent PRD:** PRD-003 (Compliance Span Cryptographic Signing)
**Unit:** E
**Priority:** P0
**Dependencies:** PRD-003c (Verification API Routes)

## Scope

Implement React components for displaying signature verification status and triggering on-demand verification. This provides visual feedback to users and auditors about compliance span integrity.

## Implementation

### Verification Badge Component

**`bff/src/components/compliance/signature-verification-badge.tsx`:**
```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ShieldAlert, Loader2 } from "lucide-react";
import { useState } from "react";

interface SignatureVerificationBadgeProps {
  spanId: string;
  tenantId: string;
  signatureValid?: boolean;
  onVerify?: () => Promise<void>;
}

export function SignatureVerificationBadge({
  spanId,
  tenantId,
  signatureValid,
  onVerify
}: SignatureVerificationBadgeProps) {
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (!onVerify) return;

    setIsVerifying(true);
    try {
      await onVerify();
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {signatureValid !== undefined && (
        <Badge variant={signatureValid ? "success" : "destructive"}>
          {signatureValid ? (
            <>
              <Shield className="w-3 h-3 mr-1" />
              Verified
            </>
          ) : (
            <>
              <ShieldAlert className="w-3 h-3 mr-1" />
              Invalid Signature
            </>
          )}
        </Badge>
      )}

      {onVerify && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Verifying...
            </>
          ) : (
            "Re-verify"
          )}
        </Button>
      )}
    </div>
  );
}
```

### Verification API Client

**`bff/src/lib/api/compliance-verification.ts`:**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface ComplianceSpanVerificationRequest {
  spanAttributes: Record<string, unknown>;
  signature: string;
}

export interface VerificationResult {
  valid: boolean;
  message: string;
  tenantId: string;
  timestamp: string;
}

export interface VerificationEvent {
  verificationId: string;
  tenantId: string;
  valid: boolean;
  timestamp: string;
}

/**
 * Verify a single compliance span signature.
 */
export async function verifyComplianceSpan(
  request: ComplianceSpanVerificationRequest
): Promise<VerificationResult> {
  const response = await fetch(`${API_BASE}/api/compliance/verify/span`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Verification failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Verify multiple compliance spans in batch.
 */
export async function verifyComplianceSpanBatch(
  requests: ComplianceSpanVerificationRequest[]
): Promise<VerificationResult[]> {
  const response = await fetch(`${API_BASE}/api/compliance/verify/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requests),
  });

  if (!response.ok) {
    throw new Error(`Batch verification failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get verification history for a tenant.
 */
export async function getVerificationHistory(
  tenantId: string,
  limit: number = 100
): Promise<VerificationEvent[]> {
  const response = await fetch(
    `${API_BASE}/api/compliance/verify/history/${tenantId}?limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get verification history: ${response.statusText}`);
  }

  return response.json();
}
```

### Verification History Component

**`bff/src/components/compliance/verification-history.tsx`:**
```tsx
import { useQuery } from "@tanstack/react-query";
import { getVerificationHistory } from "@/lib/api/compliance-verification";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface VerificationHistoryProps {
  tenantId: string;
  limit?: number;
}

export function VerificationHistory({ tenantId, limit = 100 }: VerificationHistoryProps) {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ["verification-history", tenantId, limit],
    queryFn: () => getVerificationHistory(tenantId, limit),
  });

  if (isLoading) {
    return <div>Loading verification history...</div>;
  }

  if (error) {
    return <div>Failed to load verification history</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {history?.map((event) => (
            <div
              key={event.verificationId}
              className="flex items-center justify-between p-2 border rounded"
            >
              <div className="flex items-center gap-2">
                {event.valid ? (
                  <Shield className="w-4 h-4 text-green-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                )}
                <Badge variant={event.valid ? "success" : "destructive"}>
                  {event.valid ? "Valid" : "Invalid"}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
              </span>
            </div>
          ))}
          {history?.length === 0 && (
            <p className="text-sm text-muted-foreground">No verification events</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Usage Example in Signals Page

**`bff/src/components/signals/signal-detail-page.tsx`:**
```tsx
// Add to existing signal detail page

import { SignatureVerificationBadge } from "@/components/compliance/signature-verification-badge";
import { verifyComplianceSpan } from "@/lib/api/compliance-verification";

export function SignalDetailPage({ signal }: { signal: Signal }) {
  const [verificationStatus, setVerificationStatus] = useState<boolean>();

  const handleVerify = async () => {
    // Extract compliance span data from signal
    const verificationRequest = {
      spanAttributes: {
        "compliance.framework": signal.complianceFramework,
        "compliance.control": signal.complianceControl,
        "compliance.tenantId": signal.tenantId,
        "compliance.timestamp": signal.timestamp,
      },
      signature: signal.complianceSignature,
    };

    const result = await verifyComplianceSpan(verificationRequest);
    setVerificationStatus(result.valid);
  };

  return (
    <div>
      {/* ... existing signal details ... */}

      <div className="mt-4">
        <h3 className="text-sm font-medium mb-2">Compliance Evidence</h3>
        <SignatureVerificationBadge
          spanId={signal.id}
          tenantId={signal.tenantId}
          signatureValid={verificationStatus}
          onVerify={handleVerify}
        />
      </div>
    </div>
  );
}
```

## Success Criteria

- [ ] SignatureVerificationBadge displays verification status
- [ ] Badge shows "Verified" (green) for valid signatures
- [ ] Badge shows "Invalid Signature" (red) for invalid signatures
- [ ] Re-verify button triggers on-demand verification
- [ ] Loading state shown during verification
- [ ] VerificationHistory component displays past verifications
- [ ] API client handles errors gracefully
- [ ] Components integrate with existing signal detail page

## Testing Requirements

### Component Tests (Storybook)

**`bff/src/stories/SignatureVerificationBadge.stories.tsx`:**
```tsx
import { SignatureVerificationBadge } from "@/components/compliance/signature-verification-badge";
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof SignatureVerificationBadge> = {
  title: "Compliance/SignatureVerificationBadge",
  component: SignatureVerificationBadge,
};

export default meta;
type Story = StoryObj<typeof SignatureVerificationBadge>;

export const ValidSignature: Story = {
  args: {
    spanId: "span-123",
    tenantId: "tenant-123",
    signatureValid: true,
  },
};

export const InvalidSignature: Story = {
  args: {
    spanId: "span-123",
    tenantId: "tenant-123",
    signatureValid: false,
  },
};

export const WithVerifyButton: Story = {
  args: {
    spanId: "span-123",
    tenantId: "tenant-123",
    signatureValid: true,
    onVerify: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
  },
};

export const Unverified: Story = {
  args: {
    spanId: "span-123",
    tenantId: "tenant-123",
    signatureValid: undefined,
    onVerify: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
  },
};
```

**`bff/src/stories/VerificationHistory.stories.tsx`:**
```tsx
import { VerificationHistory } from "@/components/compliance/verification-history";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

const meta: Meta<typeof VerificationHistory> = {
  title: "Compliance/VerificationHistory",
  component: VerificationHistory,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VerificationHistory>;

export const WithEvents: Story = {
  args: {
    tenantId: "tenant-123",
  },
};

export const EmptyHistory: Story = {
  args: {
    tenantId: "tenant-empty",
  },
};
```

### Integration Tests

**`bff/src/components/compliance/__tests__/signature-verification-badge.test.tsx`:**
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignatureVerificationBadge } from "../signature-verification-badge";

describe("SignatureVerificationBadge", () => {
  it("should display verified badge for valid signature", () => {
    render(
      <SignatureVerificationBadge
        spanId="span-123"
        tenantId="tenant-123"
        signatureValid={true}
      />
    );

    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("should display invalid badge for invalid signature", () => {
    render(
      <SignatureVerificationBadge
        spanId="span-123"
        tenantId="tenant-123"
        signatureValid={false}
      />
    );

    expect(screen.getByText("Invalid Signature")).toBeInTheDocument();
  });

  it("should call onVerify when re-verify button is clicked", async () => {
    const onVerify = jest.fn().mockResolvedValue(undefined);

    render(
      <SignatureVerificationBadge
        spanId="span-123"
        tenantId="tenant-123"
        signatureValid={true}
        onVerify={onVerify}
      />
    );

    const button = screen.getByText("Re-verify");
    fireEvent.click(button);

    await waitFor(() => {
      expect(onVerify).toHaveBeenCalled();
    });
  });

  it("should show loading state during verification", async () => {
    const onVerify = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(
      <SignatureVerificationBadge
        spanId="span-123"
        tenantId="tenant-123"
        onVerify={onVerify}
      />
    );

    const button = screen.getByText("Re-verify");
    fireEvent.click(button);

    expect(screen.getByText("Verifying...")).toBeInTheDocument();
  });
});
```

## Files to Create

**Components:**
- `bff/src/components/compliance/signature-verification-badge.tsx`
- `bff/src/components/compliance/verification-history.tsx`

**API Client:**
- `bff/src/lib/api/compliance-verification.ts`

**Storybook:**
- `bff/src/stories/SignatureVerificationBadge.stories.tsx`
- `bff/src/stories/VerificationHistory.stories.tsx`

**Tests:**
- `bff/src/components/compliance/__tests__/signature-verification-badge.test.tsx`
- `bff/src/components/compliance/__tests__/verification-history.test.tsx`

## Files to Modify

**Existing Signal Detail Page:**
- `bff/src/components/signals/signal-detail-page.tsx`
  - Import and use SignatureVerificationBadge
  - Add verification trigger logic

**Badge Component (extend variants):**
- `bff/src/components/ui/badge.tsx`
  - Add "success" variant if not present

## Implementation Notes

### UI/UX Design
- Green badge with shield icon for valid signatures
- Red badge with shield-alert icon for invalid signatures
- Re-verify button for on-demand verification
- Loading spinner during verification
- Disabled state during verification

### Error Handling
- Display error messages if verification fails
- Retry logic for network failures
- Graceful degradation if API unavailable

### Performance
- Cache verification results (React Query)
- Debounce rapid re-verification requests
- Lazy load verification history

### Accessibility
- ARIA labels for badges and buttons
- Keyboard navigation support
- Screen reader friendly status messages

## Related ADRs

- **[ADR-006: Tanstack Frontend Architecture](../adrs/006-tanstack-frontend-architecture.md)** - React + Tanstack Query
- **[ADR-015: Development Workflow Standards](../adrs/015-development-workflow-and-quality-standards.md)** - Testing requirements
