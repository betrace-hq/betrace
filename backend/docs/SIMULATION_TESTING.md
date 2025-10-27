# BeTrace Simulation Testing Framework

**Status**: Design Phase
**Inspired by**: TigerBeetle's VOPR, FoundationDB's simulation, Antithesis platform
**Goal**: Find bugs through deterministic simulation before they reach production

## Overview

BeTrace will implement a **deterministic simulation testing** (DST) framework that enables testing complex failure scenarios on a single laptop with perfect reproducibility. The framework will test the entire rule engine, trace buffer, and persistence layer under extreme conditions.

## Design Principles

### 1. Deterministic Execution
- **Seeded Randomness**: All random behavior controlled by a seed value
- **Virtual Time**: Simulated time progression instead of real time
- **Mocked I/O**: All file system, network, and time operations mocked
- **Reproducibility**: Same seed → same execution → same result

### 2. Extreme Fault Injection
- **Storage Faults**: Disk full, corrupted writes, partial reads, fsync failures
- **Network Faults**: Packet loss, reordering, delays, partitions
- **Time Anomalies**: Clock skew, NTP failures, leap seconds
- **Resource Exhaustion**: Memory pressure, CPU throttling, OOM kills
- **Crash Recovery**: Ungraceful shutdowns at any point

### 3. Property-Based Testing
- **Invariants**: System properties that must always hold
- **Assertions**: Explicit checks at key decision points
- **State Validation**: Verify data consistency after operations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Simulation Harness                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Workload     │  │ Fault        │  │ Invariant    │      │
│  │ Generator    │  │ Injector     │  │ Checker      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Deterministic Simulator (DST)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Virtual      │  │ Mock         │  │ Mock         │      │
│  │ Clock        │  │ FileSystem   │  │ Network      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                BeTrace Components (Under Test)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Rule Engine  │  │ Trace Buffer │  │ Rule Store   │      │
│  │              │  │              │  │              │      │
│  │ Evaluator    │  │ Completion   │  │ Persistence  │      │
│  │ Compiler     │  │ Detection    │  │ Recovery     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal**: Basic deterministic execution

**Deliverables**:
1. `internal/simulation/` package structure
2. `VirtualClock` - deterministic time source
3. `MockFileSystem` - already exists, enhance for fault injection
4. `Simulator` - main harness that orchestrates tests
5. Basic workload generator (create rules, send spans)

**Files to Create**:
- `backend/internal/simulation/clock.go` - Virtual time control
- `backend/internal/simulation/simulator.go` - Test harness
- `backend/internal/simulation/workload.go` - Span/rule generation
- `backend/internal/simulation/seed.go` - Deterministic randomness

**Test Coverage**: Run 1,000 simulations with different seeds

### Phase 2: Fault Injection (Week 2)
**Goal**: Inject realistic failures

**Deliverables**:
1. Storage fault injection (disk full, corruption, slow I/O)
2. Crash recovery testing (kill at random points)
3. Resource exhaustion (memory limits, slow operations)
4. Concurrent access stress testing

**Files to Create**:
- `backend/internal/simulation/faults.go` - Fault injection engine
- `backend/internal/simulation/crashes.go` - Crash scenarios
- `backend/internal/storage/filesystem_mock.go` - Enhanced with fault modes

**Test Coverage**: 10,000 simulations with 20% fault injection rate

### Phase 3: Invariant Checking (Week 3)
**Goal**: Automated correctness verification

**Deliverables**:
1. Rule persistence invariants (no data loss after crash)
2. Trace buffer invariants (no duplicate/missing spans)
3. Evaluation invariants (same trace → same result)
4. Signature invariants (tampering detection)

**Files to Create**:
- `backend/internal/simulation/invariants.go` - Property checkers
- `backend/internal/simulation/assertions.go` - Runtime checks
- `backend/internal/simulation/reporter.go` - Failure reporting

**Test Coverage**: 50,000 simulations with full invariant suite

### Phase 4: Integration & CI (Week 4)
**Goal**: Continuous simulation testing

**Deliverables**:
1. CI pipeline integration (nightly simulation runs)
2. Regression test corpus (save seeds that found bugs)
3. Performance benchmarks (simulations/second)
4. Failure minimization (shrink failing seeds)

**Files to Create**:
- `.github/workflows/simulation-tests.yml` - CI integration
- `backend/cmd/simulate/main.go` - Standalone simulator CLI
- `tests/simulation/` - Regression test corpus

**Test Coverage**: 100,000+ simulations nightly, 1M+ weekly

## Key Invariants to Test

### Rule Persistence Invariants
```go
// INV-1: Rules survive crashes
func RulePersistenceInvariant(sim *Simulator) bool {
    // Create rule → crash → restart → verify rule exists
    rulesBefore := sim.GetRules()
    sim.CrashAndRestart()
    rulesAfter := sim.GetRules()
    return reflect.DeepEqual(rulesBefore, rulesAfter)
}

// INV-2: No duplicate rules after concurrent writes
func NoDuplicateRulesInvariant(sim *Simulator) bool {
    rules := sim.GetRules()
    seen := make(map[string]bool)
    for _, r := range rules {
        if seen[r.ID] {
            return false // Duplicate found!
        }
        seen[r.ID] = true
    }
    return true
}
```

### Trace Buffer Invariants
```go
// INV-3: Trace completion is eventually detected
func TraceCompletionInvariant(sim *Simulator) bool {
    traceID := sim.SendSpans(3) // Send 3 spans
    sim.AdvanceTime(5 * time.Second) // Past completion timeout
    return !sim.HasBufferedTrace(traceID) // Should be processed
}

// INV-4: No span loss before timeout
func NoSpanLossInvariant(sim *Simulator) bool {
    spanIDs := sim.SendSpans(10)
    buffered := sim.GetBufferedSpanIDs()
    for _, id := range spanIDs {
        if !contains(buffered, id) {
            return false // Span lost!
        }
    }
    return true
}
```

### Evaluation Invariants
```go
// INV-5: Deterministic evaluation (same input → same output)
func DeterministicEvaluationInvariant(sim *Simulator) bool {
    trace := sim.GenerateTrace()
    result1 := sim.EvaluateTrace(trace)
    result2 := sim.EvaluateTrace(trace)
    return reflect.DeepEqual(result1, result2)
}

// INV-6: Trace-level rules match correctly
func TraceLevelMatchingInvariant(sim *Simulator) bool {
    // Rule: trace.has(span.name == "auth") and trace.has(span.name == "db")
    rule := sim.CreateRule("trace.has(span.name == \"auth\") and trace.has(span.name == \"db\")")

    trace1 := sim.GenerateTrace(spans("auth", "db", "http"))
    trace2 := sim.GenerateTrace(spans("auth", "http"))

    // Should match: has both auth and db
    if !sim.Matches(rule, trace1) {
        return false
    }

    // Should NOT match: missing db
    if sim.Matches(rule, trace2) {
        return false
    }

    return true
}
```

### Crash Recovery Invariants
```go
// INV-7: Atomic writes (either all or nothing persisted)
func AtomicWriteInvariant(sim *Simulator) bool {
    rule := sim.CreateRule("test-rule")
    sim.CrashDuringPersist() // Kill during file write
    sim.Restart()

    // Rule should either exist (write completed) or not (rollback)
    // But file should NEVER be corrupted
    _, err := sim.GetRule(rule.ID)
    return err == nil || err == ErrNotFound // No corruption
}

// INV-8: Recovery is idempotent
func IdempotentRecoveryInvariant(sim *Simulator) bool {
    sim.CreateRule("rule1")
    sim.CreateRule("rule2")
    sim.Restart()
    rules1 := sim.GetRules()
    sim.Restart()
    rules2 := sim.GetRules()
    return reflect.DeepEqual(rules1, rules2)
}
```

## Workload Patterns

### Steady State Workload
- 100 rules active
- 1,000 spans/second across 50 traces
- Mix of span-level and trace-level rules
- 10% rule CRUD operations

### Burst Workload
- Sudden spike: 10,000 spans in 1 second
- Many incomplete traces (stress buffer)
- Rule updates during burst

### Adversarial Workload
- Malformed spans (missing fields)
- Invalid rule expressions
- Duplicate span IDs
- Clock skew between spans
- Extreme attribute counts (1,000+ per span)

## Success Metrics

### Coverage Metrics
- **Simulations/day**: Target 100,000+
- **Fault scenarios**: 50+ unique fault types
- **Invariant checks**: 8+ properties per simulation
- **Seed space explored**: 1M+ unique seeds per month

### Quality Metrics
- **Bugs found**: Track pre-production bugs discovered
- **False positives**: < 1% of reported failures
- **Reproducibility**: 100% of failures reproducible from seed
- **Time to minimize**: < 1 minute to shrink failing seed

### Performance Metrics
- **Simulation speed**: > 100x real-time speedup
- **Parallel efficiency**: > 80% CPU utilization
- **Memory usage**: < 500MB per simulation
- **Crash overhead**: < 50ms restart time

## Comparison with TigerBeetle's VOPR

| Metric | TigerBeetle VOPR | BeTrace Simulator (Target) |
|--------|------------------|---------------------------|
| Speedup | 712x | 100x (simpler system) |
| Corruption Rate | 8-9% per operation | 10% per operation |
| Duration | 39 minutes simulated in 3.3s | 30 minutes simulated in 18s |
| Clock Ticks | 235,000 per run | 50,000 per run |
| Invariants | Consensus + Storage | Rules + Traces + Persistence |
| Language | Zig | Go |

## Example Simulation Run

```go
func TestSimulation_RulePersistence(t *testing.T) {
    seed := int64(12345) // Reproducible seed
    sim := NewSimulator(seed)

    // Workload: Create 100 rules over 60 seconds
    for i := 0; i < 100; i++ {
        rule := sim.CreateRule(fmt.Sprintf("rule-%d", i))
        sim.AdvanceTime(600 * time.Millisecond)

        // 20% chance of crash at any point
        if sim.ShouldInjectFault(0.2) {
            sim.CrashAndRestart()
        }
    }

    // Final validation: All rules persisted
    sim.CheckInvariant(RulePersistenceInvariant)

    // Chaos: 10 random crashes with recovery
    for i := 0; i < 10; i++ {
        sim.CrashAndRestart()
        sim.CheckInvariant(NoDuplicateRulesInvariant)
    }

    // Final count should match (allowing for crash-time losses)
    finalCount := len(sim.GetRules())
    if finalCount < 80 { // At least 80% survived
        t.Errorf("Too many rules lost: %d/100", 100-finalCount)
    }
}
```

## Integration with Existing Tests

### Unit Tests (Remain)
- Fast feedback (< 1s)
- Component-level correctness
- Pure logic (no I/O)
- **Coverage**: 80%+ code coverage

### Simulation Tests (New)
- Deep property testing (minutes to hours)
- System-level correctness
- All I/O mocked deterministically
- **Coverage**: Fault scenarios, edge cases

### Integration Tests (Complement)
- Real dependencies (Grafana, Tempo)
- End-to-end workflows
- Non-deterministic (flakiness expected)
- **Coverage**: User journeys

## Future Enhancements

### Phase 5: Distributed Simulation
- Simulate multiple backend instances
- Network partition testing
- Eventual consistency verification
- Race condition detection

### Phase 6: State Space Exploration
- Guided exploration (prioritize interesting states)
- Coverage-guided fuzzing (maximize code paths)
- Symbolic execution (explore all branches)

### Phase 7: Production Feedback Loop
- Capture production workloads
- Replay in simulation
- Verify invariants hold under real traffic

## References

- [TigerBeetle VOPR](https://tigerbeetle.com/blog/2025-02-13-a-descent-into-the-vortex/)
- [FoundationDB Simulation](https://apple.github.io/foundationdb/testing.html)
- [Antithesis Platform](https://antithesis.com/docs/introduction/how_antithesis_works/)
- [Deterministic Simulation Testing (Phil Eaton)](https://notes.eatonphil.com/2024-08-20-deterministic-simulation-testing.html)
- [WarpStream DST](https://www.warpstream.com/blog/deterministic-simulation-testing-for-our-entire-saas)
