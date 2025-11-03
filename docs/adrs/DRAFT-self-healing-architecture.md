# ADR-XXX: Self-Healing Architecture

**Status**: DRAFT
**Date**: 2025-11-02
**Deciders**: Engineering team
**Context**: If incident response can be codified in runbooks, it can be automated

---

## Context and Problem Statement

BeTrace runbooks document predictable failure modes and their resolutions. Many of these resolutions are mechanical and don't require human judgment. We should automate what we can while giving customers control over automation behavior.

**Key Insight**: If we can write a runbook for it, we can automate it.

## Decision Drivers

1. **Reduce MTTR**: Automated responses are faster than human responses
2. **Reduce On-Call Burden**: Fewer pages for predictable issues
3. **Customer Control**: Must be opt-in and configurable
4. **Safety**: Never make things worse through automation

## Considered Options

### Option 1: No Self-Healing (Status Quo)
- Rely on customers to follow runbooks manually
- Simple, no new complexity
- ❌ Slow MTTR, high on-call burden

### Option 2: Full Self-Healing (Autonomous)
- Auto-heal everything without human intervention
- Fast response times
- ❌ Risk of automation making incidents worse
- ❌ Customers lose control

### Option 3: Configurable Self-Healing (Recommended)
- Auto-heal common issues, customer can configure policies
- Default: conservative (safe actions only)
- Customer can enable aggressive mode or disable entirely

---

## Decision: Option 3 - Configurable Self-Healing

### Scope: What BeTrace Can Auto-Heal

#### 1. Rule Management (BeTrace's Responsibility)

**Problem**: New rule causes violation storm (> 1000 viol/sec)

**Auto-Healing**:
```go
// backend/internal/autohealing/rule_circuit_breaker.go
type RuleCircuitBreaker struct {
    baseline map[string]float64  // rule_id -> typical violations/sec
    threshold float64             // e.g., 3.0 (3x baseline)
}

func (rcb *RuleCircuitBreaker) CheckRule(ruleID string, currentRate float64) Action {
    baseline := rcb.baseline[ruleID]
    if baseline == 0 {
        baseline = 10.0  // Default for new rules
    }

    if currentRate > baseline * rcb.threshold {
        return DisableRule{
            RuleID: ruleID,
            Reason: fmt.Sprintf("Violation rate %.0f/sec exceeds baseline %.0f by %.1fx",
                currentRate, baseline, currentRate/baseline),
            Duration: 15 * time.Minute,  // Re-enable after cooldown
        }
    }
    return nil
}
```

**Customer Config**:
```yaml
autohealing:
  rules:
    enabled: true
    circuit_breaker:
      threshold: 3.0  # Disable if violations > 3x baseline
      cooldown: 15m   # Re-enable after cooldown
      notify: true    # Send notification when rule auto-disabled
```

#### 2. Performance Management (BeTrace's Responsibility)

**Problem**: CPU > 90%, span ingestion falling behind

**Auto-Healing**:
```go
// backend/internal/autohealing/load_shedder.go
type LoadShedder struct {
    cpuThreshold float64  // e.g., 0.90
    sampleRate   float64  // Start dropping spans when overloaded
}

func (ls *LoadShedder) ShouldIngestSpan(ctx context.Context, span *Span) bool {
    cpu := getCurrentCPU()

    if cpu > ls.cpuThreshold {
        // Drop low-priority spans (MEDIUM/LOW severity rules only)
        if span.Priority == "LOW" || span.Priority == "MEDIUM" {
            sampleRate := 1.0 - ((cpu - ls.cpuThreshold) / (1.0 - ls.cpuThreshold))
            return rand.Float64() < sampleRate
        }
    }

    return true  // Always process HIGH/CRITICAL
}
```

**Customer Config**:
```yaml
autohealing:
  performance:
    enabled: true
    load_shedding:
      cpu_threshold: 0.90
      priority_order: [CRITICAL, HIGH, MEDIUM, LOW]
      sample_low_priority: true
```

#### 3. Failure Recovery (BeTrace's Responsibility)

**Problem**: Tempo unavailable, violations not exported

**Auto-Healing**:
```go
// backend/internal/autohealing/otlp_failover.go
type OTLPFailover struct {
    primary   string
    secondary []string
    buffer    *ViolationBuffer  // Disk-backed queue
}

func (of *OTLPFailover) ExportViolations(ctx context.Context, violations []Violation) error {
    // Try primary
    if err := of.exportToEndpoint(ctx, of.primary, violations); err == nil {
        return nil
    }

    // Try secondaries
    for _, endpoint := range of.secondary {
        if err := of.exportToEndpoint(ctx, endpoint, violations); err == nil {
            return nil
        }
    }

    // All endpoints failed - buffer to disk
    return of.buffer.Enqueue(violations)
}

func (of *OTLPFailover) ReplayBufferedViolations(ctx context.Context) error {
    // Called on startup or when endpoints recover
    violations := of.buffer.Dequeue()
    return of.ExportViolations(ctx, violations)
}
```

**Customer Config**:
```yaml
autohealing:
  otlp:
    enabled: true
    failover:
      endpoints:
        - primary: tempo-primary:4317
        - secondary: tempo-backup:4317
      buffer:
        disk_path: /var/lib/betrace/violation-buffer
        max_size: 1GB
        replay_on_recovery: true
```

### Scope: What Customers Must Handle

#### 1. Infrastructure (Customer's Responsibility)
- Pod crashes → Kubernetes restarts (customer's HPA)
- Node failures → Cluster autoscaling (customer's cloud config)
- Network issues → Service mesh / load balancer (customer's infra)

**Why**: BeTrace can't manage infrastructure it doesn't control

#### 2. Observability Backend (Customer's Responsibility)
- Tempo down → Customer's Tempo HA setup
- Grafana down → Customer's Grafana HA setup

**Why**: BeTrace is a plugin, not the platform

**But**: BeTrace can buffer violations and replay when backend recovers

#### 3. Application Issues (Customer's Responsibility)
- Service crashes → Customer's deployment strategy
- Code bugs → Customer's CI/CD and testing

**Why**: BeTrace monitors applications, doesn't manage them

---

## Auto-Healing Policies

### Conservative (Default)
```yaml
autohealing:
  mode: conservative
  rules:
    circuit_breaker: true      # ✅ Auto-disable noisy rules
    auto_rollback: false       # ❌ Require manual rollback
  performance:
    load_shedding: true        # ✅ Sample low-priority spans
    auto_scale: false          # ❌ Customer handles scaling
  otlp:
    failover: true             # ✅ Failover to backup endpoints
    buffer_on_failure: true    # ✅ Buffer violations to disk
```

### Aggressive
```yaml
autohealing:
  mode: aggressive
  rules:
    circuit_breaker: true
    auto_rollback: true        # ✅ Auto-delete rules created in last 10min
    threshold: 2.0             # More sensitive (2x baseline, not 3x)
  performance:
    load_shedding: true
    auto_scale: true           # ✅ Tell K8s to scale (via HPA)
  otlp:
    failover: true
    buffer_on_failure: true
```

### Disabled
```yaml
autohealing:
  mode: disabled  # Customer handles everything manually
```

---

## Notification Strategy

All auto-healing actions must be observable:

1. **Logs**: Structured logs for every action
2. **Metrics**: `betrace_autohealing_actions_total{action="disable_rule", reason="circuit_breaker"}`
3. **Alerts**: Optional Slack/PagerDuty notifications
4. **Audit Trail**: Every action recorded with timestamp, reason, outcome

**Example Log**:
```json
{
  "timestamp": "2025-11-02T10:30:00Z",
  "level": "INFO",
  "component": "autohealing.rule_circuit_breaker",
  "action": "disable_rule",
  "rule_id": "slow-requests",
  "rule_name": "slow-requests",
  "reason": "Violation rate 1500/sec exceeds baseline 100/sec by 15.0x",
  "duration": "15m",
  "notification_sent": true
}
```

---

## Safety Mechanisms

1. **Cooldown Periods**: Never take same action twice within X minutes
2. **Maximum Actions**: Limit auto-healing to N actions per hour
3. **Rollback on Failure**: If action makes metrics worse, undo it
4. **Human Override**: Customers can always disable auto-healing via config or API

**Example**:
```go
type SafetyLimits struct {
    MaxActionsPerHour int           // e.g., 10
    CooldownPeriod    time.Duration // e.g., 15 minutes
    RollbackOnWorse   bool          // true
}

func (ah *AutoHealer) TakeAction(action Action) error {
    // Check rate limit
    if ah.actionsInLastHour() >= ah.limits.MaxActionsPerHour {
        return ErrRateLimitExceeded
    }

    // Check cooldown
    if ah.lastAction(action.Type()).Add(ah.limits.CooldownPeriod).After(time.Now()) {
        return ErrCooldownActive
    }

    // Take action
    before := ah.getCurrentMetrics()
    if err := action.Execute(); err != nil {
        return err
    }

    // Monitor for 5 minutes
    time.Sleep(5 * time.Minute)
    after := ah.getCurrentMetrics()

    // Rollback if worse
    if ah.limits.RollbackOnWorse && after.IsWorseThan(before) {
        action.Rollback()
        return ErrMetricsWorsened
    }

    return nil
}
```

---

## Implementation Phases

### Phase 1: Monitoring (No Actions)
- Detect auto-healing opportunities
- Log what *would* have been done
- Collect data on false positives
- **Duration**: 2 weeks

### Phase 2: Conservative Actions
- Implement circuit breaker (auto-disable noisy rules)
- Implement load shedding
- Implement OTLP failover/buffering
- **Duration**: 3 weeks

### Phase 3: Aggressive Actions (Opt-in)
- Auto-rollback rules
- Auto-scaling integration
- Advanced failure recovery
- **Duration**: 3 weeks

---

## Consequences

### Positive
- ✅ Faster incident response (MTTR: 15min → 30sec for auto-healable issues)
- ✅ Reduced on-call burden
- ✅ Better reliability (automatic recovery from transient issues)
- ✅ Competitive differentiator

### Negative
- ⚠️ Increased complexity (new failure modes from automation)
- ⚠️ Risk of automation making things worse (mitigated by safety mechanisms)
- ⚠️ Customer confusion if not well-documented

### Neutral
- Customer must understand what is/isn't auto-healed
- Clear documentation critical

---

## References

- Runbooks: [docs/runbooks/](../runbooks/)
- Alert Rules: [docs/deployment/alert-rules.yaml](../deployment/alert-rules.yaml)
- Google SRE Book - Chapter 7: "The Evolution of Automation at Google"
- Netflix Chaos Engineering: https://netflix.github.io/chaosmonkey/

---

## Status

**DRAFT** - Needs team review and customer validation before implementation

**Next Steps**:
1. Review with team
2. Prototype circuit breaker in dev environment
3. A/B test with pilot customers
4. Document customer-facing configuration
5. Add to v2.1.0 roadmap
