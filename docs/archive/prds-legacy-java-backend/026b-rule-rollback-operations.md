# PRD-026B: Rule Rollback Operations

**Priority:** P1 (High - Incident Response)
**Complexity:** High
**Personas:** SRE, DevOps
**Dependencies:** PRD-026A (version history)
**Implements:** Manual and automatic rule rollback

## Problem

When rule updates cause issues, recovery is manual and slow:
- **No rollback**: Must manually reconstruct previous DSL and redeploy (10-15 minutes)
- **No change comparison**: Cannot see what changed between versions
- **No impact estimation**: Unknown how rollback affects signal volume
- **No auto-recovery**: Bad rules continue generating false positives until manually fixed

**Impact:**
- MTTR: 10-15 minutes to rollback broken rules
- Alert fatigue: False positives flood system during incident
- Operational risk: SREs hesitant to tune rules (fear of breaking production)

## Solution

### Manual Rollback

**Rollback API:**
```http
POST /api/rules/{ruleId}/rollback
{
  "targetVersion": "v1.2.2",
  "reason": "v1.2.3 causing 500 false positives"
}
```

**Rollback Behavior:**
1. Verify target version exists and integrity check passes
2. Create new version pointing to target version's DSL
3. Reload Drools KIE session with target version
4. Mark signals from bad version as `ROLLED_BACK`
5. Emit compliance span (SOC2 CC6.2)

**Rollback Constraints:**
- Cannot rollback beyond 30 days (prevent accidental ancient rule restoration)
- Target version must pass integrity check (signature verification)
- Requires `rules:rollback` permission

### Auto-Rollback

**Trigger Conditions:**
- Signal rate increase >50% compared to baseline
- Evaluation window: First 10 minutes after deployment
- Minimum signals for comparison: 10

**Baseline Calculation:**
- Previous version's signal rate over last 24 hours
- Example: v1.2.2 generated 100 signals/hour → baseline = 100

**Auto-Rollback Flow:**
1. New version (v1.2.3) deployed
2. Monitor signal rate for 10 minutes
3. If rate > 150/hour (50% increase) for 5 consecutive minutes
4. Trigger notification: "Auto-rollback will occur in 5 minutes"
5. If spike continues, rollback to v1.2.2
6. If spike resolves, cancel auto-rollback

### Diff Visualization

**Diff API:**
```http
GET /api/rules/{ruleId}/diff?from=v1.2.2&to=v1.2.3
```

**Response:**
```json
{
  "ruleId": "rule_123",
  "fromVersion": "v1.2.2",
  "toVersion": "v1.2.3",
  "dslDiff": [
    {
      "line": 5,
      "type": "removed",
      "content": "trace.count(http.status = 500) > 10"
    },
    {
      "line": 5,
      "type": "added",
      "content": "trace.count(http.status = 500) > 5"
    }
  ],
  "semanticChanges": [
    {
      "type": "threshold_change",
      "attribute": "http.status",
      "before": "> 10",
      "after": "> 5",
      "impact": "Will match 2x more traces"
    }
  ],
  "impactEstimation": {
    "historicalSignalRate": 100,  // signals/hour from v1.2.2
    "estimatedSignalRate": 200,   // estimated for v1.2.3
    "confidenceLevel": 0.85
  }
}
```

## Implementation

### Rollback Service

**File:** `backend/src/main/java/com/betrace/services/RuleRollbackService.java`

```java
@ApplicationScoped
@SOC2(controls = {CC6_2}, notes = "Privileged rollback operations")
public class RuleRollbackService {
    @Inject RuleVersionService versionService;
    @Inject DroolsEngine droolsEngine;
    @Inject SignalService signalService;
    @Inject TenantSessionManager sessionManager;
    @Inject AuditLogService auditLog;

    @RateLimited(maxRollbacks = 3, window = "1h")
    public RuleVersion rollback(String ruleId, String targetVersion, User operator, String reason) {
        // P0 Security: Verify permission
        if (!authz.hasPermission(operator, "rules:rollback")) {
            throw new ForbiddenException("Requires rules:rollback permission");
        }

        // P1 Security: Require detailed justification
        if (reason.length() < 20) {
            throw new ValidationException("Rollback requires detailed justification (min 20 characters)");
        }

        // Get target version
        RuleVersion target = versionService.getVersion(ruleId, targetVersion)
            .orElseThrow(() -> new NotFoundException("Target version not found"));

        // P0 Security: Verify integrity
        if (!versionService.verifyIntegrity(target)) {
            throw new SecurityException("Cannot rollback to tampered version");
        }

        // P1: Validate rollback age (max 30 days)
        if (target.getCreatedAt().isBefore(Instant.now().minus(Duration.ofDays(30)))) {
            throw new RollbackConstraintException("Cannot rollback to version older than 30 days");
        }

        // Get current version
        RuleVersion current = versionService.getActiveVersion(ruleId);

        // Create new version pointing to target DSL
        RuleVersion rolledBackVersion = versionService.createVersion(
            ruleId,
            target.getDslContent(),
            operator,
            String.format("Rolled back from %s to %s. Reason: %s", current.getVersion(), targetVersion, reason)
        );

        // Reload Drools session
        String tenantId = ruleService.getTenantForRule(ruleId);
        droolsEngine.reloadRule(tenantId, ruleId, target.getCompiledDrools());

        // Invalidate tenant cache
        sessionManager.invalidateCache(tenantId);

        // Mark signals from bad version as rolled back
        signalService.markVersionSignalsAsRolledBack(ruleId, current.getVersion());

        // P0 Security: Emit compliance span
        emitComplianceSpan(SOC2, CC6_2, "rule_rollback", Map.of(
            "rule_id", ruleId,
            "from_version", current.getVersion(),
            "to_version", targetVersion,
            "operator_id", operator.getId().toString(),
            "reason", reason
        ));

        // Audit log
        auditLog.warning("Rule rolled back", Map.of(
            "rule_id", ruleId,
            "from_version", current.getVersion(),
            "to_version", targetVersion,
            "operator", operator.getEmail(),
            "reason", reason
        ));

        // P1: Alert on suspicious patterns (downgrade)
        if (isVersionDowngrade(current.getVersion(), targetVersion)) {
            alertSecurityTeam("Rollback to older version detected", operator, ruleId);
        }

        return rolledBackVersion;
    }

    private boolean isVersionDowngrade(String current, String target) {
        // Parse semantic versions
        int[] currentParts = parseVersion(current);
        int[] targetParts = parseVersion(target);

        // Compare major.minor.patch
        for (int i = 0; i < 3; i++) {
            if (targetParts[i] < currentParts[i]) {
                return true;  // Downgrade detected
            }
        }
        return false;
    }

    private int[] parseVersion(String version) {
        String[] parts = version.substring(1).split("\\.");  // Remove 'v' prefix
        return new int[] {
            Integer.parseInt(parts[0]),
            Integer.parseInt(parts[1]),
            Integer.parseInt(parts[2])
        };
    }
}
```

### Auto-Rollback Detector

**File:** `backend/src/main/java/com/betrace/jobs/AutoRollbackDetector.java`

```java
@ApplicationScoped
public class AutoRollbackDetector {
    @Inject PrometheusClient prometheus;
    @Inject RuleRollbackService rollbackService;
    @Inject NotificationService notifications;

    @ConfigProperty(name = "auto-rollback.enabled", defaultValue = "true")
    boolean enabled;

    @ConfigProperty(name = "auto-rollback.signal-increase-threshold", defaultValue = "0.5")
    double signalIncreaseThreshold;  // 50%

    @ConfigProperty(name = "auto-rollback.evaluation-window-minutes", defaultValue = "10")
    int evaluationWindowMinutes;

    @ConfigProperty(name = "auto-rollback.grace-period-minutes", defaultValue = "5")
    int gracePeriodMinutes;

    @Scheduled(every = "1m")
    public void detectSpikes() {
        if (!enabled) {
            return;
        }

        List<RuleDeployment> recentDeployments = getDeploymentsInWindow(Duration.ofMinutes(evaluationWindowMinutes));

        for (RuleDeployment deployment : recentDeployments) {
            analyzeDeployment(deployment);
        }
    }

    private void analyzeDeployment(RuleDeployment deployment) {
        String ruleId = deployment.getRuleId();
        String newVersion = deployment.getVersion();
        String previousVersion = deployment.getPreviousVersion();

        // Calculate baseline signal rate (previous version, last 24h)
        double baselineRate = prometheus.query(
            "rate(betrace_rule_signals_generated_total{rule_id='" + ruleId + "', rule_version='" + previousVersion + "'}[24h])"
        );

        // Calculate current signal rate (new version, last 10 minutes)
        double currentRate = prometheus.query(
            "rate(betrace_rule_signals_generated_total{rule_id='" + ruleId + "', rule_version='" + newVersion + "'}[10m])"
        );

        // Skip if insufficient data
        if (baselineRate == 0 || currentRate == 0) {
            return;
        }

        // Calculate increase percentage
        double increasePercent = (currentRate - baselineRate) / baselineRate;

        // Check if spike exceeds threshold
        if (increasePercent > signalIncreaseThreshold) {
            handleSpikeDetected(deployment, baselineRate, currentRate, increasePercent);
        }
    }

    private void handleSpikeDetected(RuleDeployment deployment, double baseline, double current, double increase) {
        String ruleId = deployment.getRuleId();

        // Check if already scheduled for rollback
        if (isRollbackScheduled(ruleId)) {
            return;
        }

        // Schedule grace period notification
        notifications.send(NotificationType.AUTO_ROLLBACK_WARNING, Map.of(
            "rule_id", ruleId,
            "version", deployment.getVersion(),
            "baseline_rate", baseline,
            "current_rate", current,
            "increase_percent", Math.round(increase * 100),
            "grace_period_minutes", gracePeriodMinutes,
            "message", String.format(
                "Rule %s will auto-rollback in %d minutes due to %.0f%% signal increase",
                ruleId, gracePeriodMinutes, increase * 100
            )
        ));

        // Schedule rollback after grace period
        scheduleRollback(deployment, gracePeriodMinutes);
    }

    private void scheduleRollback(RuleDeployment deployment, int delayMinutes) {
        scheduler.schedule(() -> {
            try {
                // Re-check spike still exists
                if (spikeStillExists(deployment)) {
                    User systemUser = createSystemUser();
                    rollbackService.rollback(
                        deployment.getRuleId(),
                        deployment.getPreviousVersion(),
                        systemUser,
                        String.format("Auto-rollback triggered: Signal rate increased %.0f%% above baseline",
                            deployment.getIncreasePercent() * 100)
                    );

                    notifications.send(NotificationType.AUTO_ROLLBACK_EXECUTED, Map.of(
                        "rule_id", deployment.getRuleId(),
                        "version", deployment.getVersion()
                    ));
                } else {
                    notifications.send(NotificationType.AUTO_ROLLBACK_CANCELLED, Map.of(
                        "rule_id", deployment.getRuleId(),
                        "reason", "Signal rate normalized"
                    ));
                }
            } catch (Exception e) {
                log.error("Auto-rollback failed", e);
                notifications.send(NotificationType.AUTO_ROLLBACK_FAILED, Map.of(
                    "rule_id", deployment.getRuleId(),
                    "error", e.getMessage()
                ));
            }
        }, Duration.ofMinutes(delayMinutes));
    }
}
```

### Diff Service

**File:** `backend/src/main/java/com/betrace/services/RuleDiffService.java`

```java
@ApplicationScoped
public class RuleDiffService {
    @Inject RuleVersionService versionService;
    @Inject PrometheusClient prometheus;

    @RolesAllowed("rules:versions:diff")
    public RuleDiff getDiff(String ruleId, String fromVersion, String toVersion, User user) {
        // P0 Security: Verify ownership
        if (!ruleService.ownsRule(user.getTenantId(), ruleId)) {
            throw new ForbiddenException("Cross-tenant access denied");
        }

        RuleVersion from = versionService.getVersion(ruleId, fromVersion)
            .orElseThrow(() -> new NotFoundException("Version not found: " + fromVersion));

        RuleVersion to = versionService.getVersion(ruleId, toVersion)
            .orElseThrow(() -> new NotFoundException("Version not found: " + toVersion));

        // P0 Security: Verify integrity
        if (!versionService.verifyIntegrity(from) || !versionService.verifyIntegrity(to)) {
            throw new SecurityException("Version tampering detected");
        }

        // Generate line-by-line DSL diff
        List<DiffLine> dslDiff = computeLineDiff(from.getDslContent(), to.getDslContent());

        // Semantic analysis
        List<SemanticChange> semanticChanges = analyzeSemanticChanges(from.getDslContent(), to.getDslContent());

        // Impact estimation
        ImpactEstimation impact = estimateImpact(ruleId, fromVersion);

        return new RuleDiff(
            ruleId,
            fromVersion,
            toVersion,
            dslDiff,
            semanticChanges,
            impact
        );
    }

    private ImpactEstimation estimateImpact(String ruleId, String version) {
        // Query historical signal rate for version
        double historicalRate = prometheus.query(
            "avg_over_time(rate(betrace_rule_signals_generated_total{rule_id='" + ruleId + "', rule_version='" + version + "'}[1h])[7d:])"
        );

        return new ImpactEstimation(
            historicalRate,
            historicalRate * 2,  // Simplified estimation
            0.85  // Confidence level
        );
    }

    private List<SemanticChange> analyzeSemanticChanges(String fromDsl, String toDsl) {
        List<SemanticChange> changes = new ArrayList<>();

        // Extract threshold changes
        Pattern thresholdPattern = Pattern.compile("(\\w+)\\s*([<>=]+)\\s*(\\d+)");
        Matcher fromMatcher = thresholdPattern.matcher(fromDsl);
        Matcher toMatcher = thresholdPattern.matcher(toDsl);

        while (fromMatcher.find() && toMatcher.find()) {
            String attribute = fromMatcher.group(1);
            String fromThreshold = fromMatcher.group(3);
            String toThreshold = toMatcher.group(3);

            if (!fromThreshold.equals(toThreshold)) {
                changes.add(new SemanticChange(
                    "threshold_change",
                    attribute,
                    "> " + fromThreshold,
                    "> " + toThreshold,
                    "Will match " + calculateImpact(fromThreshold, toThreshold) + " more traces"
                ));
            }
        }

        return changes;
    }

    private String calculateImpact(String fromThreshold, String toThreshold) {
        int from = Integer.parseInt(fromThreshold);
        int to = Integer.parseInt(toThreshold);
        double ratio = (double) from / to;
        return String.format("%.1fx", ratio);
    }
}

record RuleDiff(
    String ruleId,
    String fromVersion,
    String toVersion,
    List<DiffLine> dslDiff,
    List<SemanticChange> semanticChanges,
    ImpactEstimation impactEstimation
) {}

record DiffLine(
    int line,
    String type,  // "added", "removed", "unchanged"
    String content
) {}

record SemanticChange(
    String type,
    String attribute,
    String before,
    String after,
    String impact
) {}

record ImpactEstimation(
    double historicalSignalRate,
    double estimatedSignalRate,
    double confidenceLevel
) {}
```

## Security Requirements

### P0 (Blocking)

**1. Rollback Authorization**
- Require `rules:rollback` permission
- Test:
```java
@Test
void rollbackRequiresPermission() {
    User userWithoutPermission = new User("viewer");

    assertThatThrownBy(() ->
        rollbackService.rollback(ruleId, "v1.2.2", userWithoutPermission, "rollback reason")
    ).isInstanceOf(ForbiddenException.class);
}
```

**2. Audit Trail**
- Emit compliance span for every rollback
- Log format:
```json
{
  "event": "rule_rollback",
  "rule_id": "rule-123",
  "from_version": "v1.2.3",
  "to_version": "v1.2.2",
  "operator_id": "user-456",
  "reason": "False positive spike",
  "timestamp": "2025-10-11T10:23:45.123Z"
}
```

### P1 (High Priority)

**3. Rate Limiting**
- Max 3 rollbacks/hour per operator
- Implementation:
```java
@RateLimited(maxRollbacks = 3, window = "1h")
public void rollback(...) { }
```

**4. Justification Requirement**
- Minimum 20 characters for rollback reason
- Test:
```java
@Test
void rollbackRequiresJustification() {
    assertThatThrownBy(() ->
        rollbackService.rollback(ruleId, "v1.2.2", admin, "bad")
    ).isInstanceOf(ValidationException.class)
     .hasMessageContaining("min 20 characters");
}
```

**5. Alert on Downgrades**
- Security team notified on version downgrades
- Example: v2.0.0 → v1.0.0

## Configuration

**File:** `application.properties`

```properties
# Manual rollback
rollback.max-age-days=30
rollback.rate-limit-per-hour=3
rollback.justification-min-length=20

# Auto-rollback
auto-rollback.enabled=true
auto-rollback.signal-increase-threshold=0.5
auto-rollback.evaluation-window-minutes=10
auto-rollback.grace-period-minutes=5
auto-rollback.min-signals-for-comparison=10

# Diff
diff.max-dsl-size=10000
diff.semantic-analysis.enabled=true
```

## Acceptance Criteria

### Functional Requirements

**Manual Rollback:**
```gherkin
Scenario: Rollback creates new version
  Given rule "R1" with active version "v1.2.3"
  When rollback to "v1.2.2" with reason "False positives"
  Then new version "v1.2.4" created
  And v1.2.4 DSL matches v1.2.2 DSL
  And v1.2.3 status = ROLLED_BACK

Scenario: Rollback completes within 2 seconds
  Given rule "R1" with version "v1.2.3"
  When rollback to "v1.2.2" requested
  Then rollback completes in <2 seconds (P95)
  And Drools session reloaded with v1.2.2
```

**Auto-Rollback:**
```gherkin
Scenario: Auto-rollback triggered by spike
  Given rule "R1" v1.2.2 generated 100 signals/hour
  When v1.2.3 deployed and generates 200 signals/hour (100% increase)
  And spike persists for 10 minutes
  Then auto-rollback scheduled with 5-minute grace period
  And notification sent to operator

Scenario: Auto-rollback cancelled on spike resolution
  Given auto-rollback scheduled for rule "R1"
  When signal rate returns to baseline before grace period
  Then auto-rollback cancelled
  And notification sent: "Spike resolved"
```

**Diff Visualization:**
```gherkin
Scenario: Diff shows DSL changes
  Given versions v1.2.2 and v1.2.3
  When GET /rules/R1/diff?from=v1.2.2&to=v1.2.3
  Then response shows line-by-line diff
  And highlights threshold change: "> 10" → "> 5"
  And impact estimation: "~200 signals/hour (2x baseline)"
```

### Security Requirements

```gherkin
Scenario: Rollback requires permission
  Given user without "rules:rollback" permission
  When POST /rules/R1/rollback
  Then 403 Forbidden response returned

Scenario: Rollback audited
  Given rollback executed
  When audit log queried
  Then log contains:
    - event: rule_rollback
    - operator_id: <user>
    - reason: <justification>

Scenario: Rate limit enforced
  Given operator performs 3 rollbacks in 1 hour
  When 4th rollback attempted
  Then 429 Too Many Requests returned
```

## Testing Strategy

### Unit Tests

**Rollback Logic:**
```java
@Test
void rollbackCreatesNewVersion() {
    RuleVersion v1 = versionService.createVersion(ruleId, "dsl1", author, "V1");
    RuleVersion v2 = versionService.createVersion(ruleId, "dsl2", author, "V2");

    RuleVersion rolled = rollbackService.rollback(ruleId, v1.getVersion(), admin, "Rollback reason");

    assertThat(rolled.getDslContent()).isEqualTo(v1.getDslContent());
    assertThat(v2.getStatus()).isEqualTo(VersionStatus.ROLLED_BACK);
}
```

### Integration Tests

**Performance:**
```java
@Test
void rollbackLatencyUnder2Seconds() {
    long start = System.currentTimeMillis();
    rollbackService.rollback(ruleId, targetVersion, admin, "Performance test");
    long duration = System.currentTimeMillis() - start;

    assertThat(duration).isLessThan(2000);
}
```

## Files to Create/Modify

**New Files:**
- `backend/src/main/java/com/betrace/services/RuleRollbackService.java`
- `backend/src/main/java/com/betrace/services/RuleDiffService.java`
- `backend/src/main/java/com/betrace/jobs/AutoRollbackDetector.java`
- `backend/src/main/java/com/betrace/routes/RuleRollbackRoute.java`
- `backend/src/test/java/com/betrace/services/RuleRollbackServiceTest.java`

**Modified Files:**
- `backend/src/main/resources/application.properties`

## Success Criteria

- [ ] Manual rollback <2 seconds (P95)
- [ ] Auto-rollback spike detection
- [ ] 5-minute grace period with notification
- [ ] Diff visualization with semantic analysis
- [ ] Impact estimation (historical signal rate)
- [ ] Rate limiting (3 rollbacks/hour)
- [ ] Audit logging for all rollbacks
- [ ] Test coverage >85%
