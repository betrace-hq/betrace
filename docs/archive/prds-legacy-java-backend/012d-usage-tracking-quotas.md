# PRD-012d: Usage Tracking and Quotas

**Parent PRD:** PRD-012 (Tenant Management System)
**Unit:** D
**Priority:** P0
**Dependencies:** PRD-012a (Tenant Onboarding), PRD-012b (Tenant Settings)

## Scope

Track tenant resource usage (API calls, signals created, rules evaluated, spans ingested) in TigerBeetle. Enforce usage quotas based on tenant tier (free, pro, enterprise). Reject requests when quotas exceeded. Frontend usage dashboard displays current usage, limits, and billing cycle. No SQL database required per ADR-011.

## Architecture

```
Every API call / span ingestion / rule evaluation
        ↓
   UsageTrackingProcessor (Camel interceptor on all routes)
        ├── Extract tenantId from exchange property (set by PRD-001)
        ├── Determine resource type (api_call, span, rule_eval, signal)
        ├── Query current usage from TigerBeetle (code=12)
        ├── Check against quota for tenant tier
        ├── If quota exceeded: throw QuotaExceededException (429)
        ├── Increment usage transfer (debit from quota account)
        └── Continue route processing
        ↓
GET /api/tenants/{tenantId}/usage
        ↓
   GetUsageDashboardProcessor
        ├── Query TigerBeetle accounts (code=12) for tenant
        ├── Calculate current billing cycle (month start to now)
        ├── Query transfers in current cycle
        ├── Aggregate usage by resource type
        ├── Fetch quota limits based on tenant tier
        └── Return usage breakdown + limits + percentage used
```

## TigerBeetle Schema (ADR-011 Compliance)

**Usage Quota Account (code=12):**
```java
Account usageQuota = new Account(
    id: UUID (tenantId + "-quota-" + resourceType),
    code: 12,  // Usage quota
    debits: currentUsage,  // Monotonically increasing usage counter
    credits: 0,  // Unused (quota enforced in processor logic)
    userData128: pack(
        resource_type: 8 bits (1=api_call, 2=span, 3=rule_eval, 4=signal),
        quota_limit: 64 bits (max allowed per billing cycle),
        cycle_start: 64 bits (Unix timestamp ms of cycle start)
    ),
    userData64: tier (8 bits) + reserved,
    ledger: tenantToLedgerId(tenantId)
);
```

**Usage Increment Transfer (code=12):**
```java
Transfer usageIncrement = new Transfer(
    id: UUID (event ID),
    debitAccountId: usageQuota,  // Debit from quota account
    creditAccountId: 0,  // System account
    amount: incrementAmount,  // E.g., 1 API call, 100 spans
    code: 12,  // Usage tracking
    userData128: pack(
        resource_type: 8 bits,
        route_hash: 120 bits (SHA-256 of route ID, first 120 bits)
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

## Quota Definitions by Tier

| Tier | API Calls/Month | Spans/Month | Rules | Signals/Month |
|------|----------------|-------------|-------|---------------|
| **Free** | 10,000 | 100,000 | 10 | 1,000 |
| **Pro** | 1,000,000 | 10,000,000 | 100 | 100,000 |
| **Enterprise** | Unlimited | Unlimited | Unlimited | Unlimited |

## Implementation

### Backend Files

**Processor (Camel Interceptor):**
```java
// backend/src/main/java/com/betrace/processors/UsageTrackingProcessor.java
@Named("usageTrackingProcessor")
@ApplicationScoped
public class UsageTrackingProcessor implements Processor {

    @Inject
    TigerBeetleClient client;

    @Inject
    TenantService tenantService;

    private static final Map<String, Long> FREE_LIMITS = Map.of(
        "api_call", 10_000L,
        "span", 100_000L,
        "rule_eval", 10L,  // Max 10 rules
        "signal", 1_000L
    );

    private static final Map<String, Long> PRO_LIMITS = Map.of(
        "api_call", 1_000_000L,
        "span", 10_000_000L,
        "rule_eval", 100L,
        "signal", 100_000L
    );

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getProperty("tenantId", String.class);
        if (tenantId == null) {
            // Unauthenticated request, skip usage tracking
            return;
        }

        // Determine resource type from route
        String routeId = exchange.getFromRouteId();
        String resourceType = determineResourceType(routeId);
        long incrementAmount = determineIncrementAmount(exchange, resourceType);

        // Get tenant tier
        TenantMetadata tenant = tenantService.getTenantMetadata(tenantId);
        byte tier = tenant.tier();

        // Check quota
        UUID quotaAccountId = buildQuotaAccountId(tenantId, resourceType);
        Account quotaAccount = client.getAccount(quotaAccountId);

        if (quotaAccount == null) {
            // Initialize quota account for new tenant
            quotaAccount = initializeQuotaAccount(tenantId, resourceType, tier);
            client.createAccount(quotaAccount);
        }

        // Check if current billing cycle
        long cycleStart = extractCycleStart(quotaAccount);
        long now = Instant.now().toEpochMilli();
        if (isBillingCycleReset(cycleStart, now)) {
            // Reset usage for new billing cycle
            resetQuotaAccount(quotaAccount);
        }

        // Get current usage
        long currentUsage = quotaAccount.debits;
        long quotaLimit = extractQuotaLimit(quotaAccount);

        // Enforce quota (unless enterprise tier)
        if (tier != 3 && currentUsage + incrementAmount > quotaLimit) {
            throw new QuotaExceededException(
                String.format("Quota exceeded for %s: %d/%d used", resourceType, currentUsage, quotaLimit)
            );
        }

        // Increment usage
        Transfer usageTransfer = buildUsageTransfer(
            quotaAccountId,
            incrementAmount,
            resourceType,
            routeId,
            tenantId
        );
        client.createTransfer(usageTransfer);
    }

    private String determineResourceType(String routeId) {
        if (routeId.startsWith("direct:")) {
            routeId = routeId.substring(7);  // Strip "direct:"
        }
        if (routeId.contains("span") || routeId.contains("otlp")) {
            return "span";
        } else if (routeId.contains("rule")) {
            return "rule_eval";
        } else if (routeId.contains("signal")) {
            return "signal";
        } else {
            return "api_call";
        }
    }

    private long determineIncrementAmount(Exchange exchange, String resourceType) {
        if ("span".equals(resourceType)) {
            // Count spans in batch
            Object body = exchange.getIn().getBody();
            if (body instanceof List<?> spans) {
                return spans.size();
            }
            return 1;
        }
        return 1;  // 1 API call, 1 rule eval, 1 signal
    }

    private UUID buildQuotaAccountId(String tenantId, String resourceType) {
        return UUID.nameUUIDFromBytes((tenantId + "-quota-" + resourceType).getBytes());
    }

    private Account initializeQuotaAccount(String tenantId, String resourceType, byte tier) {
        byte resourceTypeCode = resourceTypeToCode(resourceType);
        long quotaLimit = getQuotaLimit(tier, resourceType);
        long cycleStart = getMonthStartTimestamp();

        return new Account(
            buildQuotaAccountId(tenantId, resourceType),
            12,  // code: usage quota
            packUserData128(resourceTypeCode, quotaLimit, cycleStart),
            packUserData64(tier),
            tenantToLedgerId(tenantId),
            0,  // debits (initial usage)
            0   // credits
        );
    }

    private long getQuotaLimit(byte tier, String resourceType) {
        if (tier == 3) return Long.MAX_VALUE;  // Enterprise unlimited
        Map<String, Long> limits = (tier == 2) ? PRO_LIMITS : FREE_LIMITS;
        return limits.getOrDefault(resourceType, 0L);
    }

    private boolean isBillingCycleReset(long cycleStart, long now) {
        LocalDate cycleDate = LocalDate.ofInstant(Instant.ofEpochMilli(cycleStart), ZoneId.of("UTC"));
        LocalDate nowDate = LocalDate.ofInstant(Instant.ofEpochMilli(now), ZoneId.of("UTC"));
        return cycleDate.getMonth() != nowDate.getMonth() || cycleDate.getYear() != nowDate.getYear();
    }

    private void resetQuotaAccount(Account account) {
        // Create new account with debits=0, updated cycleStart
        Account reset = account.withDebits(0).withUpdatedCycleStart(getMonthStartTimestamp());
        client.updateAccount(reset);
    }

    private Transfer buildUsageTransfer(UUID quotaAccountId, long amount, String resourceType, String routeId, String tenantId) {
        byte resourceTypeCode = resourceTypeToCode(resourceType);
        byte[] routeHash = hashRoute(routeId);

        return new Transfer(
            UUID.randomUUID(),
            quotaAccountId,  // Debit from quota
            new UUID(0, 0),  // System account
            amount,
            12,  // code: usage tracking
            packTransferUserData128(resourceTypeCode, routeHash),
            Instant.now().toEpochMilli(),
            tenantToLedgerId(tenantId)
        );
    }

    private byte resourceTypeToCode(String resourceType) {
        return switch (resourceType) {
            case "api_call" -> 1;
            case "span" -> 2;
            case "rule_eval" -> 3;
            case "signal" -> 4;
            default -> 0;
        };
    }

    // Helper methods: packUserData128, extractCycleStart, getMonthStartTimestamp, etc.
}

// backend/src/main/java/com/betrace/exceptions/QuotaExceededException.java
public class QuotaExceededException extends RuntimeException {
    public QuotaExceededException(String message) {
        super(message);
    }
}
```

**Usage Dashboard Processor:**
```java
// backend/src/main/java/com/betrace/processors/GetUsageDashboardProcessor.java
@Named("getUsageDashboardProcessor")
@ApplicationScoped
public class GetUsageDashboardProcessor implements Processor {

    @Inject
    TigerBeetleClient client;

    @Inject
    TenantService tenantService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getProperty("tenantId", String.class);
        String authTenantId = exchange.getProperty("authTenantId", String.class);

        // Enforce tenant isolation
        if (!tenantId.equals(authTenantId)) {
            throw new SecurityException("Cannot access other tenant's usage");
        }

        // Get tenant tier
        TenantMetadata tenant = tenantService.getTenantMetadata(tenantId);
        byte tier = tenant.tier();

        // Query all quota accounts for tenant
        List<String> resourceTypes = List.of("api_call", "span", "rule_eval", "signal");
        Map<String, UsageMetric> usage = new HashMap<>();

        for (String resourceType : resourceTypes) {
            UUID quotaAccountId = buildQuotaAccountId(tenantId, resourceType);
            Account quotaAccount = client.getAccount(quotaAccountId);

            if (quotaAccount == null) {
                // No usage yet
                usage.put(resourceType, new UsageMetric(0, getQuotaLimit(tier, resourceType), 0.0));
                continue;
            }

            long currentUsage = quotaAccount.debits;
            long quotaLimit = extractQuotaLimit(quotaAccount);
            double percentage = (tier == 3) ? 0.0 : (double) currentUsage / quotaLimit * 100.0;

            usage.put(resourceType, new UsageMetric(currentUsage, quotaLimit, percentage));
        }

        // Build response
        UsageDashboardResponse response = new UsageDashboardResponse(
            tenantId,
            tierToString(tier),
            getBillingCycleStart(),
            getBillingCycleEnd(),
            usage
        );

        exchange.getMessage().setBody(response);
    }

    private String tierToString(byte tier) {
        return switch (tier) {
            case 1 -> "free";
            case 2 -> "pro";
            case 3 -> "enterprise";
            default -> "unknown";
        };
    }

    private LocalDate getBillingCycleStart() {
        LocalDate now = LocalDate.now(ZoneId.of("UTC"));
        return now.withDayOfMonth(1);
    }

    private LocalDate getBillingCycleEnd() {
        return getBillingCycleStart().plusMonths(1).minusDays(1);
    }
}
```

**Route:**
```java
// backend/src/main/java/com/betrace/routes/UsageRoute.java
@ApplicationScoped
public class UsageRoute extends RouteBuilder {
    @Override
    public void configure() {
        rest("/api/tenants/{tenantId}/usage")
            .get()
            .produces("application/json")
            .to("direct:getUsageDashboard");

        from("direct:getUsageDashboard")
            .process("getUsageDashboardProcessor")
            .marshal().json();
    }
}
```

**Models:**
```java
// backend/src/main/java/com/betrace/model/UsageMetric.java
public record UsageMetric(
    long current,
    long limit,
    double percentageUsed
) {}

// backend/src/main/java/com/betrace/model/UsageDashboardResponse.java
public record UsageDashboardResponse(
    String tenantId,
    String tier,
    LocalDate billingCycleStart,
    LocalDate billingCycleEnd,
    Map<String, UsageMetric> usage  // resourceType -> metric
) {}
```

### Frontend Files

**Usage Dashboard Page:**
```tsx
// bff/src/routes/settings/usage.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/settings/usage')({
  component: UsageDashboard,
});

function UsageDashboard() {
  const tenantId = useTenantId();

  const { data: usage, isLoading } = useQuery({
    queryKey: ['tenant', tenantId, 'usage'],
    queryFn: () => api.getUsage(tenantId),
    refetchInterval: 60000,  // Refresh every minute
  });

  if (isLoading) return <div>Loading...</div>;

  const metrics = [
    { key: 'api_call', label: 'API Calls', icon: '🔌' },
    { key: 'span', label: 'Spans Ingested', icon: '📊' },
    { key: 'rule_eval', label: 'Rules', icon: '📏' },
    { key: 'signal', label: 'Signals Created', icon: '🚨' },
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Usage & Quotas</h1>
        <Badge variant="outline" className="text-lg">
          {usage.tier.toUpperCase()} Plan
        </Badge>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        Billing Cycle: {new Date(usage.billingCycleStart).toLocaleDateString()} - {new Date(usage.billingCycleEnd).toLocaleDateString()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metrics.map((metric) => {
          const data = usage.usage[metric.key];
          const isUnlimited = usage.tier === 'enterprise';

          return (
            <Card key={metric.key} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{metric.icon}</span>
                  <h3 className="text-lg font-semibold">{metric.label}</h3>
                </div>
                <Badge variant={data.percentageUsed > 80 ? 'destructive' : 'success'}>
                  {isUnlimited ? 'Unlimited' : `${data.percentageUsed.toFixed(1)}%`}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Used: {data.current.toLocaleString()}</span>
                  {!isUnlimited && <span>Limit: {data.limit.toLocaleString()}</span>}
                </div>
                {!isUnlimited && (
                  <Progress value={data.percentageUsed} className="h-2" />
                )}
              </div>

              {data.percentageUsed > 80 && !isUnlimited && (
                <div className="mt-4 text-sm text-destructive">
                  Warning: Approaching quota limit. Upgrade to Pro for higher limits.
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

**API Client:**
```typescript
// bff/src/lib/api/usage-client.ts
export const api = {
  getUsage: async (tenantId: string) => {
    const response = await fetch(`/api/tenants/${tenantId}/usage`, {
      headers: { Authorization: `Bearer ${getJwt()}` },
    });
    if (!response.ok) throw new Error('Failed to fetch usage');
    return response.json();
  },
};
```

## Success Criteria

**Functional:**
- [ ] Usage tracked for API calls, spans, rule evaluations, signals
- [ ] Quotas enforced based on tenant tier
- [ ] Quota exceeded returns 429 with clear error message
- [ ] Billing cycle resets monthly (1st of month)
- [ ] GET /api/tenants/{tenantId}/usage returns dashboard data
- [ ] Frontend displays usage metrics with progress bars
- [ ] Enterprise tier has unlimited usage

**Performance:**
- [ ] Usage tracking adds <5ms overhead per request
- [ ] Usage dashboard query <100ms

**Security:**
- [ ] Tenant isolation enforced (cannot query other tenant's usage)
- [ ] Usage data stored in per-tenant ledger

## Testing Requirements

**Unit Tests (90% coverage):**
```java
@Test
void testUsageTracking_ApiCall() {
    // Simulate API call
    // Verify usage transfer created (code=12)
    // Verify quota account debits incremented
}

@Test
void testUsageTracking_QuotaExceeded() {
    // Free tier tenant at 9,999/10,000 API calls
    // Make one more API call
    // Verify QuotaExceededException thrown (429)
}

@Test
void testUsageTracking_BillingCycleReset() {
    // Quota account with last month's cycleStart
    // Trigger usage tracking
    // Verify account reset (debits=0, new cycleStart)
}

@Test
void testUsageTracking_EnterpriseTier() {
    // Enterprise tenant exceeds "limits"
    // Verify no exception thrown (unlimited)
}

@Test
void testGetUsageDashboard_TenantIsolation() {
    // Tenant A queries usage
    // Verify only sees own usage (ledger isolation)
}
```

**Integration Tests:**
```java
@Test
void testEndToEndUsageEnforcement() {
    // Create free tier tenant (PRD-012a)
    // Make 10,000 API calls
    // Verify 10,001st call returns 429
    // Query usage dashboard
    // Verify shows 10,000/10,000
}
```

## Files to Create

**Backend:**
- `backend/src/main/java/com/betrace/processors/UsageTrackingProcessor.java`
- `backend/src/main/java/com/betrace/processors/GetUsageDashboardProcessor.java`
- `backend/src/main/java/com/betrace/routes/UsageRoute.java`
- `backend/src/main/java/com/betrace/exceptions/QuotaExceededException.java`
- `backend/src/main/java/com/betrace/model/UsageMetric.java`
- `backend/src/main/java/com/betrace/model/UsageDashboardResponse.java`
- `backend/src/test/java/com/betrace/processors/UsageTrackingProcessorTest.java`
- `backend/src/test/java/com/betrace/integration/UsageEnforcementIntegrationTest.java`

**Frontend:**
- `bff/src/routes/settings/usage.tsx`
- `bff/src/lib/api/usage-client.ts`
- `bff/src/stories/UsageDashboard.stories.tsx`

## Files to Modify

**Backend:**
- `backend/src/main/java/com/betrace/routes/ApiRoutes.java` - Add UsageTrackingProcessor interceptor
- `backend/src/main/java/com/betrace/services/TenantService.java` - Add `getTenantMetadata(tenantId)` method
- `backend/src/main/resources/application.properties` - Add usage tracking config

**Frontend:**
- `bff/src/routes/settings/index.tsx` - Add usage tab

## Integration Points

**Depends On:**
- **PRD-012a:** Tenant must exist with tier defined
- **PRD-012b:** Tenant tier from settings determines quota limits
- **PRD-001:** JWT provides tenantId for usage attribution
- **PRD-002:** TigerBeetle client

**Consumed By:**
- All API routes (usage tracking interceptor)
- **PRD-012f:** Frontend displays usage widget

## ADR Compliance

- **ADR-011 (TigerBeetle-First):** Usage in TigerBeetle accounts (code=12), NOT SQL
- **ADR-012 (Mathematical Tenant Isolation):** Per-tenant ledger, quota accounts
- **ADR-013 (Camel-First):** Implemented as Camel interceptor
- **ADR-014 (Named Processors):** All logic in named CDI processors
- **ADR-015 (Workflow Standards):** 90% test coverage

## Compliance Benefits

**Audit Trail:**
- Every API call, span ingestion, rule evaluation recorded in TigerBeetle
- Immutable usage history for billing disputes
- Query transfers (code=12) to reconstruct usage timeline

## Future Enhancements

- Real-time usage webhooks (alert at 80%, 90%, 100%)
- Usage-based billing integration (Stripe metered billing)
- Custom quota overrides per tenant
- Historical usage analytics (year-over-year trends)
- Granular usage by user within tenant
