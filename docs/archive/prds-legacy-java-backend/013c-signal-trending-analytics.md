# PRD-013c: Signal Trending Analytics

**Status:** Draft
**Created:** 2025-10-10
**Dependencies:** PRD-013a (Real-time Signal Transport)
**Depended By:** None

## Problem Statement

SREs need to identify emerging issues before they escalate. Current implementation lacks:

- **Trend Detection**: No way to identify rules firing more frequently
- **Baseline Comparison**: No historical context for signal volume
- **Service Health**: No visibility into which services generate most signals
- **Anomaly Detection**: No automated detection of unusual patterns

**Business Impact:**
- Reactive incident response (detect after impact, not before)
- Missed early warning signs of degrading service health
- No data-driven prioritization of investigation efforts

## Solution

### Trending Algorithm

**Definition**: A rule/service is "trending" if:
1. **Current signal rate > 20% increase** vs. 24-hour baseline
2. **Minimum 5 signals in past hour** (noise threshold)

```java
@ApplicationScoped
public class SignalTrendingService {

    @Inject SignalRepository signalRepository;

    private final Cache<String, List<TrendingRule>> cache = Caffeine.newBuilder()
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .build();

    public List<TrendingRule> getTrendingRules(String tenantId) {
        return cache.get(tenantId, key -> calculateTrendingRules(key));
    }

    private List<TrendingRule> calculateTrendingRules(String tenantId) {
        Instant now = Instant.now();
        Instant oneHourAgo = now.minus(1, ChronoUnit.HOURS);
        Instant oneDayAgo = now.minus(24, ChronoUnit.HOURS);
        Instant baselineStart = oneDayAgo.minus(1, ChronoUnit.HOURS);

        // Current window counts
        Map<String, Integer> currentCounts = signalRepository
            .countByRuleSince(tenantId, oneHourAgo);

        // Baseline window counts (24h ago)
        Map<String, Integer> baselineCounts = signalRepository
            .countByRuleBetween(tenantId, baselineStart, oneDayAgo);

        List<TrendingRule> trending = new ArrayList<>();

        for (Map.Entry<String, Integer> entry : currentCounts.entrySet()) {
            String ruleId = entry.getKey();
            int currentCount = entry.getValue();
            int baselineCount = baselineCounts.getOrDefault(ruleId, 0);

            // Apply noise threshold
            if (currentCount < 5) {
                continue;
            }

            // Calculate increase percentage
            double increasePercent = baselineCount == 0
                ? 100.0
                : ((currentCount - baselineCount) / (double) baselineCount) * 100;

            // Apply trending threshold
            if (increasePercent > 20) {
                trending.add(TrendingRule.builder()
                    .ruleId(ruleId)
                    .currentCount(currentCount)
                    .baselineCount(baselineCount)
                    .increasePercent(Math.round(increasePercent * 10) / 10.0)
                    .build());
            }
        }

        return trending.stream()
            .sorted(Comparator.comparingDouble(TrendingRule::getIncreasePercent).reversed())
            .limit(10)
            .collect(Collectors.toList());
    }

    public List<BusiestService> getBusiestServices(String tenantId) {
        Instant oneDayAgo = Instant.now().minus(24, ChronoUnit.HOURS);

        Map<String, Integer> serviceCounts = signalRepository
            .countByServiceSince(tenantId, oneDayAgo);

        return serviceCounts.entrySet().stream()
            .filter(entry -> entry.getValue() > 0)
            .map(entry -> BusiestService.builder()
                .serviceName(entry.getKey())
                .signalCount(entry.getValue())
                .build())
            .sorted(Comparator.comparingInt(BusiestService::getSignalCount).reversed())
            .limit(10)
            .collect(Collectors.toList());
    }
}
```

### REST API

```java
@Path("/api/v1/trending")
@Authenticated
public class TrendingResource {

    @Inject SignalTrendingService trendingService;
    @Inject SecurityContext securityContext;

    @GET
    @Path("/rules")
    public List<TrendingRule> getTrendingRules() {
        String tenantId = securityContext.getTenantId();
        return trendingService.getTrendingRules(tenantId);
    }

    @GET
    @Path("/services")
    public List<BusiestService> getBusiestServices() {
        String tenantId = securityContext.getTenantId();
        return trendingService.getBusiestServices(tenantId);
    }
}
```

### Frontend Integration

```tsx
export function TrendingSidebar() {
  const { data: trendingRules } = useQuery({
    queryKey: ['trending', 'rules'],
    queryFn: () => api.getTrendingRules(),
    refetchInterval: 5 * 60 * 1000 // 5 minutes
  });

  const { data: busiestServices } = useQuery({
    queryKey: ['trending', 'services'],
    queryFn: () => api.getBusiestServices(),
    refetchInterval: 5 * 60 * 1000
  });

  return (
    <aside className="trending-sidebar">
      <Card>
        <CardHeader>
          <CardTitle>Trending Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {trendingRules?.map(rule => (
            <div key={rule.ruleId}>
              <span>{rule.ruleName}</span>
              <Badge>+{rule.increasePercent}%</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Busiest Services</CardTitle>
        </CardHeader>
        <CardContent>
          {busiestServices?.map(service => (
            <div key={service.serviceName}>
              <span>{service.serviceName}</span>
              <span>{service.signalCount} signals</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
```

## Acceptance Criteria

### Trending Rules
- **AC1**: Rules with >20% increase flagged
- **AC2**: Minimum 5 signals in past hour required
- **AC3**: Baseline from 24 hours ago (1-hour window)
- **AC4**: Top 10 trending rules returned
- **AC5**: New rules show 100% increase if >5 signals

### Busiest Services
- **AC6**: Services ranked by signal count (24h)
- **AC7**: Top 10 services returned
- **AC8**: Zero-signal services excluded

### Performance
- **AC9**: Calculation completes in < 1 second
- **AC10**: Results cached for 5 minutes
- **AC11**: Cache per tenant
- **AC12**: Indexed queries on (tenantId, createdAt)

## Security Requirements

- **Authentication**: JWT required for all endpoints
- **Authorization**: Results scoped to caller's tenant
- **Data Privacy**: No PII in trending data
- **Rate Limiting**: 60 requests/minute per tenant

## Performance Requirements

- **Latency**: < 1 second for trending calculation
- **API Response**: < 100ms when cached
- **Caching**: 5-minute TTL per tenant

## Test Requirements

- **Unit Tests**: 15 tests (calculation, thresholds, caching)
- **Integration Tests**: 10 tests (end-to-end, tenant scoping)
- **Performance Tests**: 5 tests (10K signals, concurrent)
- **Edge Cases**: 8 tests (boundaries, empty data)

## Dependencies

- Signal repository with aggregation queries
- Caffeine cache for result caching
- Database indexes on (tenantId, createdAt, ruleId, serviceName)
