# Runbook: KMS Cache Hit Rate Low

**Alert**: `KMSCacheHitRateLow`
**Severity**: WARNING
**Response Time**: 1 hour (during business hours)

---

## Symptoms

- Alert: `KMSCacheHitRateLow` firing (hit rate <80%)
- Grafana dashboard shows declining cache performance
- KMS operation latency increasing (P99 >50ms)
- AWS KMS costs higher than expected
- Logs show frequent cache misses

---

## Impact

**Performance**:
- Increased request latency (cache: <1ms, KMS: ~100ms)
- Poor user experience (slow compliance span signing)
- Higher P99 latency spikes

**Cost**:
- Increased AWS KMS API costs ($0.03 per 10,000 requests)
- Potential KMS API throttling (>1,000 req/sec limit)

**Example Cost Impact**:
```
Baseline (80% cache hit rate):
- 1,000 requests/sec → 200 KMS calls/sec
- Monthly cost: $0.03 * (200 * 86400 * 30) / 10000 = $15.55

Degraded (50% cache hit rate):
- 1,000 requests/sec → 500 KMS calls/sec
- Monthly cost: $0.03 * (500 * 86400 * 30) / 10000 = $38.88
- Extra cost: $23.33/month (+150%)
```

---

## Diagnosis

### Step 1: Check Current Cache Hit Rate

```bash
# Query cache metrics
hits=$(curl -s http://localhost:8080/q/metrics | grep 'kms_cache_hit_total{key_type="signing"}' | awk '{print $2}')
misses=$(curl -s http://localhost:8080/q/metrics | grep 'kms_cache_miss_total{key_type="signing"}' | awk '{print $2}')

# Calculate hit rate
hit_rate=$(echo "scale=2; $hits / ($hits + $misses) * 100" | bc)
echo "Cache hit rate: ${hit_rate}%"
echo "Target: >80%"

# Check hit rate by key type
for key_type in signing public encryption; do
  hits=$(curl -s http://localhost:8080/q/metrics | grep "kms_cache_hit_total{key_type=\"$key_type\"}" | awk '{print $2}')
  misses=$(curl -s http://localhost:8080/q/metrics | grep "kms_cache_miss_total{key_type=\"$key_type\"}" | awk '{print $2}')
  hit_rate=$(echo "scale=2; $hits / ($hits + $misses) * 100" | bc)
  echo "$key_type cache hit rate: ${hit_rate}%"
done
```

### Step 2: Check Cache Eviction Rate

```bash
# Caffeine cache stats (if stats recording enabled)
curl -s http://localhost:8080/q/metrics | grep cache_eviction

# High eviction rate indicates:
# - Cache too small (SIZE eviction policy)
# - TTL too short (TIME eviction policy)
# - Memory pressure (WEAK/SOFT reference eviction)
```

### Step 3: Analyze Cache Access Patterns

```bash
# Check cache size
cache_size=$(curl -s http://localhost:8080/q/metrics | grep 'cache_size{cache="privateKeys"}' | awk '{print $2}')
echo "Private key cache size: $cache_size entries"

# Check for unusual tenant access patterns
grep "Cache miss" /var/log/betrace/backend.log | awk '{print $NF}' | sort | uniq -c | sort -rn | head -n 20

# Output shows top 20 tenants causing cache misses
# Look for:
# - Single tenant dominating (>50% of misses) → Attack or bug
# - Distributed misses → Legitimate load increase
```

### Step 4: Identify Root Cause

| Symptom | Root Cause | Solution |
|---------|------------|----------|
| Evictions = 0, but low hit rate | TTL too short | Increase cache TTL (Solution 1) |
| High eviction rate (SIZE policy) | Cache too small | Increase cache size (Solution 2) |
| Single tenant causing misses | Cache poisoning attack | Rate limit tenant (Solution 3) |
| Misses spike after deployment | Cache warming needed | Pre-populate cache (Solution 4) |
| Random misses, no pattern | Normal behavior | Accept or optimize (Solution 5) |

---

## Resolution

### Solution 1: Increase Cache TTL

**Problem**: Keys expiring too quickly, forcing KMS lookups

**Current Configuration**:
```properties
kms.cache.private-key-ttl-minutes=60   # 1 hour
kms.cache.public-key-ttl-hours=24      # 24 hours
kms.cache.encryption-key-ttl-minutes=60
```

**Recommendation** (based on usage patterns):

**High-frequency signing** (>100 req/min per tenant):
```properties
kms.cache.private-key-ttl-minutes=120  # 2 hours
kms.cache.public-key-ttl-hours=48      # 48 hours
```

**Low-frequency signing** (<10 req/min per tenant):
```properties
# Current TTL is fine, issue is elsewhere
```

**Security Consideration**:
- Longer TTL = higher key exposure risk
- Balance: Performance vs. Security
- Recommendation: Max 4 hours for private keys, 72 hours for public keys

**Apply Change**:
```bash
# Edit application.properties
vim /opt/betrace/application.properties

# Restart application (zero-downtime rolling restart)
kubectl rollout restart deployment/betrace-backend

# Verify new TTL
curl -s http://localhost:8080/api/admin/cache/config | jq '.privateKeyTTL'
```

### Solution 2: Increase Cache Size

**Problem**: Cache full, evicting entries prematurely

**Check Current Cache Size**:
```bash
# Query cache metrics
curl -s http://localhost:8080/q/metrics | grep 'cache_size{cache="privateKeys"}'
curl -s http://localhost:8080/q/metrics | grep 'cache_evictions_total{cache="privateKeys",cause="size"}'

# If evictions > 0 and cause=size, cache is too small
```

**Current Configuration**:
```properties
kms.cache.max-size=1000  # 1000 entries (default)
```

**Sizing Calculation**:
```
Required cache size = active_tenants * 1.2 (20% buffer)

Example:
- 500 active tenants
- Required size: 500 * 1.2 = 600

If cache size < required size → Increase
```

**Apply Change**:
```properties
# Edit application.properties
kms.cache.max-size=2000  # Double capacity

# Memory impact: ~200KB per 1000 entries (signing keys are small)
# 2000 entries = ~400KB (negligible)
```

**Restart and Verify**:
```bash
# Restart application
kubectl rollout restart deployment/betrace-backend

# Verify no more SIZE evictions
watch -n 30 'curl -s http://localhost:8080/q/metrics | grep "cache_evictions_total.*size"'
```

### Solution 3: Mitigate Cache Poisoning Attack

**Problem**: Single tenant making excessive cache requests

**Identify Attacker**:
```bash
# Find tenant causing most cache misses
grep "Cache miss" /var/log/betrace/backend.log | \
  grep -oP 'tenant \K[0-9a-f\-]+' | \
  sort | uniq -c | sort -rn | head -n 5

# Output (example):
# 5432 tenant-abc-123
# 234 tenant-def-456
# 178 tenant-ghi-789

# If one tenant >>50% of misses → Likely attack or misconfigured client
```

**Temporary Mitigation** (rate limit):
```bash
# Add rate limit for suspicious tenant
curl -X POST http://localhost:8080/api/admin/tenants/rate-limit \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-abc-123",
    "maxRequestsPerMinute": 100,
    "duration": "1h"
  }'

# Monitor impact
watch -n 30 'curl -s http://localhost:8080/q/metrics | grep kms_cache_hit_total'
```

**Permanent Fix** (investigate client):
```bash
# Identify client causing issue
grep "tenant-abc-123" /var/log/betrace/backend.log | \
  grep -oP 'client_ip=\K[0-9.]+' | \
  sort | uniq -c | sort -rn

# Contact customer to fix misconfigured client:
# - Client not caching responses?
# - Client retrying excessively?
# - Client iterating through invalid tenant IDs?
```

### Solution 4: Implement Cache Warming

**Problem**: Cold cache after deployment causes miss spike

**Current Behavior** (cold start):
```
Deployment → Cache empty → All requests miss KMS → High latency
```

**Improved Behavior** (warm start):
```
Deployment → Pre-populate cache → Most requests hit cache → Normal latency
```

**Implementation**:
```java
// Add to KeyRetrievalService.java
@Startup
public class CacheWarmer {

    @Inject
    KeyRetrievalService keyRetrieval;

    @Inject
    TenantRepository tenants;

    void warmCache(@Observes StartupEvent event) {
        Log.info("Warming KMS cache...");

        // Get top 100 most active tenants
        List<UUID> activeTenants = tenants.getMostActive(100);

        // Pre-load signing keys into cache
        for (UUID tenantId : activeTenants) {
            try {
                keyRetrieval.getSigningKey(tenantId);
                keyRetrieval.getPublicKey(tenantId);
            } catch (Exception e) {
                Log.warnf("Cache warming failed for tenant %s: %s", tenantId, e.getMessage());
            }
        }

        Log.infof("KMS cache warmed (%d tenants)", activeTenants.size());
    }
}
```

**Verify Cache Warming**:
```bash
# Check startup logs
grep "Warming KMS cache" /var/log/betrace/backend.log
grep "KMS cache warmed" /var/log/betrace/backend.log

# Verify cache populated before traffic
curl -s http://localhost:8080/q/metrics | grep 'cache_size{cache="privateKeys"}'
# Should show >0 immediately after startup
```

### Solution 5: Optimize Cache Usage (Code Changes)

**Problem**: Application not using cache effectively

**Inefficient Pattern** (cache bypass):
```java
// ❌ BAD: Bypasses cache
PrivateKey key = kms.getTenantSigningKey(tenantId);
```

**Efficient Pattern** (cache-first):
```java
// ✅ GOOD: Uses KeyRetrievalService cache
PrivateKey key = keyRetrieval.getSigningKey(tenantId);
```

**Audit Cache Usage**:
```bash
# Find direct KMS calls (cache bypass)
grep -r "kms.getTenantSigningKey" backend/src/main/java/ | grep -v KeyRetrievalService

# Should return 0 results (all calls should go through KeyRetrievalService)
```

**Fix Cache Bypasses**:
```bash
# Replace direct KMS calls with KeyRetrievalService
find backend/src/main/java/ -name "*.java" -exec sed -i '' \
  's/kms\.getTenantSigningKey/keyRetrieval.getSigningKey/g' {} \;

# Recompile and test
mvn clean test
```

---

## Verification

### Confirm Resolution

```bash
# 1. Check cache hit rate is >80%
hits=$(curl -s http://localhost:8080/q/metrics | grep 'kms_cache_hit_total{key_type="signing"}' | awk '{print $2}')
misses=$(curl -s http://localhost:8080/q/metrics | grep 'kms_cache_miss_total{key_type="signing"}' | awk '{print $2}')
hit_rate=$(echo "scale=2; $hits / ($hits + $misses) * 100" | bc)
echo "Cache hit rate: ${hit_rate}%"
# Expected: >80%

# 2. Verify P99 latency is <10ms
curl -s http://localhost:8080/q/metrics | grep 'kms_retrieve_signing_key_seconds{quantile="0.99"}'
# Expected: <0.010 (10ms)

# 3. Check SIZE evictions are zero
curl -s http://localhost:8080/q/metrics | grep 'cache_evictions_total{cache="privateKeys",cause="size"}'
# Expected: 0 or no increase

# 4. Confirm alert is resolved
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname == "KMSCacheHitRateLow")'
# Expected: No results (alert cleared)
```

### Monitor for Regression

```bash
# Watch cache hit rate for 30 minutes
watch -n 60 'bash -c "
hits=\$(curl -s http://localhost:8080/q/metrics | grep \"kms_cache_hit_total{key_type=\\\"signing\\\"}\" | awk \"{print \\\$2}\")
misses=\$(curl -s http://localhost:8080/q/metrics | grep \"kms_cache_miss_total{key_type=\\\"signing\\\"}\" | awk \"{print \\\$2}\")
hit_rate=\$(echo \"scale=2; \$hits / (\$hits + \$misses) * 100\" | bc)
echo \"Cache hit rate: \${hit_rate}%\"
"'

# Should remain >80% consistently
```

---

## Escalation

### When to Escalate

Escalate to **Engineering Lead** if:
- Cache hit rate remains <80% after 2 hours
- Cache evictions increasing despite size increase
- Identified cache poisoning attack (security incident)
- Cannot determine root cause

### Escalation Contact

- **Slack**: `#betrace-oncall`
- **PagerDuty**: "Performance" escalation policy
- **Engineering Lead**: [Contact info in PagerDuty]

---

## Post-Incident

### Cost Analysis

```bash
# Calculate cost savings from fix
# Before fix (e.g., 50% hit rate):
before_kms_calls_per_day=$((1000 * 86400 / 2))  # 43.2M calls/day
before_monthly_cost=$(echo "scale=2; $before_kms_calls_per_day * 30 * 0.03 / 10000" | bc)

# After fix (80% hit rate):
after_kms_calls_per_day=$((1000 * 86400 / 5))   # 17.28M calls/day
after_monthly_cost=$(echo "scale=2; $after_kms_calls_per_day * 30 * 0.03 / 10000" | bc)

echo "Cost savings: \$$(echo "$before_monthly_cost - $after_monthly_cost" | bc)/month"
```

### Preventive Actions

- [ ] Add cache hit rate to Grafana dashboard
- [ ] Set up PagerDuty alert for 70% threshold (early warning)
- [ ] Implement cache warming for all deployments
- [ ] Audit code for cache bypasses (add to CI/CD)
- [ ] Document cache sizing formula for capacity planning

---

## Related Documentation

- [KMS Cache Architecture](../../docs/prds/006-kms-integration.md#keycache)
- [Caffeine Cache Documentation](https://github.com/ben-manes/caffeine/wiki)
- [AWS KMS Pricing](https://aws.amazon.com/kms/pricing/)
- [KMS Provider Failure Runbook](kms-provider-failure.md)

---

**Runbook Version**: 1.0
**Last Updated**: 2025-10-22
**Owner**: SRE Team
