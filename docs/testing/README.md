# BeTrace Testing Documentation

BeTrace uses **deterministic simulation testing (DST)** with random seed fuzzing to ensure production-grade reliability.

## Quick Links

- **[Fuzzing & Resilience](../fuzzing-improved-resilience.md)** - How we found 16 bugs and improved reliability from 50% → 99.9998%
- **[Backend Fuzzing Tests](../../backend/internal/simulation/)** - Go tests with CHAOS-level fault injection
- **[Fuzzing Scripts](../../backend/scripts/)** - Automated fuzzing campaigns

## Testing Strategy

### Traditional Testing
```bash
# Unit tests
cd backend && go test ./...                    # Go: 83.2% coverage, 138 tests
cd bff && npm test                              # TypeScript: Vitest

# Integration tests
flox services start && go test ./tests/...     # End-to-end scenarios
```

### Deterministic Simulation Testing (DST)
```bash
# Run with specific seed (reproducible)
CHAOS_SEED=12345 go test -run TestFuzzChaosMode ./internal/simulation -v

# Run with random seed (explore new paths)
CHAOS_SEED=$RANDOM go test -run TestFuzzChaosMode ./internal/simulation -v
```

### Fuzzing Campaigns
```bash
# Backend: 2500 tests with random seeds
cd backend && bash scripts/fuzz-backend.sh

# CHAOS mode: 30% crash, 20% disk full, 10% corruption
cd backend && bash scripts/chaos-fuzzer.sh

# Check for bugs
cat backend/internal/simulation/.fuzz-bugs.json
cat backend/internal/simulation/.chaos-bugs.json
```

## Why This Matters

**Fixed seeds hide bugs:**
```go
// This only tests ONE execution path
sim := NewSimulator(12345)  // ❌ Same path every time
```

**Random seeds find bugs:**
```go
// This tests THOUSANDS of execution paths
seed := getSeedFromEnv()    // ✅ Different path each run
sim := NewSimulator(seed)
```

## Testing Metrics

### Before Fuzzing
- ✅ 85% code coverage
- ✅ All tests passing
- ❌ **16 hidden bugs** in fault recovery
- ❌ **50% failure rate** under network faults

### After Fuzzing
- ✅ 200+ random seeds tested
- ✅ All 16 bugs fixed
- ✅ **99.9998% success rate**
- ✅ CHAOS mode: 100% recovery under extreme faults

## Test Types

### Unit Tests
- **Purpose:** Validate individual components
- **Coverage:** 83.2% (backend), 85%+ (frontend)
- **Speed:** Fast (milliseconds)

### Integration Tests
- **Purpose:** Validate component interactions
- **Location:** `tests/rc-suite/`
- **Speed:** Medium (seconds)

### Deterministic Simulation Tests
- **Purpose:** Validate fault tolerance and crash recovery
- **Deterministic:** Same seed = same execution
- **Reproducible:** `CHAOS_SEED=12345` always tests same path
- **Speed:** Fast (simulated time runs 77-2280x faster than real time)

### Fuzzing Campaigns
- **Purpose:** Find edge cases and hidden bugs
- **Strategy:** Run thousands of tests with random seeds
- **Output:** `.fuzz-bugs.json` with failing seeds
- **Speed:** Slow (hours for full campaign)

## Fuzzing Infrastructure

### Backend Tests

**[backend/internal/simulation/fuzz_test.go](../../backend/internal/simulation/fuzz_test.go)**
- Basic crash recovery testing
- 20 crashes per test
- Validates no data loss

**[backend/internal/simulation/chaos_fuzz_test.go](../../backend/internal/simulation/chaos_fuzz_test.go)**
- CHAOS-level fault injection
- 30% crash + 20% disk full + 10% corruption
- Allows up to 50% failure rate (realistic for chaos)

### Fuzzing Scripts

**[backend/scripts/fuzz-backend.sh](../../backend/scripts/fuzz-backend.sh)**
- Runs 2500 tests with unique random seeds
- Tracks failing seeds to `.fuzz-bugs.json`
- Progress reporting every 100 tests

**[backend/scripts/chaos-fuzzer.sh](../../backend/scripts/chaos-fuzzer.sh)**
- CHAOS-level fuzzing campaign
- Extreme fault rates (30% crash, 20% disk full)
- Tests system under catastrophic conditions

## Reproducing Bugs

### 1. Check for Bugs
```bash
cat backend/internal/simulation/.chaos-bugs.json
```

### 2. Reproduce Specific Bug
```bash
# Use seed from bug file
CHAOS_SEED=12345 go test -run TestFuzzChaosMode ./internal/simulation -v
```

### 3. Fix Bug
Improve crash recovery, add retries, fix data loss, etc.

### 4. Verify Fix
```bash
# Re-run all previously failing seeds
jq -r '.[].seed' .chaos-bugs.json | while read seed; do
  CHAOS_SEED=$seed go test -run TestFuzzChaosMode ./internal/simulation || \
    echo "Still fails: $seed"
done
```

### 5. Clear Bug File
```bash
rm .chaos-bugs.json
```

## Results

### Frontend (TypeScript)
- **Bugs found:** 16
- **Root cause:** Single retry with 50% success rate
- **Fix:** 5 retries with exponential backoff (40% → 70% → 90% → 98% → 99.5%)
- **Improvement:** 50% → 99.9998% recovery rate

### Backend (Go)
- **Bugs found:** 0
- **Why:** Atomic write-rename pattern from the start
- **CHAOS test:** 20 crashes, 100% recovery
- **Validation:** Production-ready under extreme faults

## Best Practices

### 1. Always Use Seed Environment Variables
```go
func TestMyFeature(t *testing.T) {
    seed := getSeedFromEnv(t)  // ✅ Allows fuzzing
    // NOT: seed := 12345       // ❌ Fixed seed hides bugs
}
```

### 2. Actually Fail Tests on Errors
```go
if err := recoverFromFault(); err != nil {
    t.Fatalf("Recovery failed: %v", err)  // ✅ Test fails
    // NOT: log.Printf("Failed")          // ❌ Test still passes
}
```

### 3. Track Failing Seeds
```bash
# Save to JSON for reproduction
echo "{\"seed\": $seed}" >> .fuzz-bugs.json
```

### 4. Run Fuzzing in CI/CD
```yaml
# .github/workflows/fuzzing.yml
- name: Nightly Fuzzing
  run: bash backend/scripts/chaos-fuzzer.sh
```

## Resources

- **Article:** [How Fuzzing Improved Our Resilience](../fuzzing-improved-resilience.md)
- **Compliance Status:** [docs/compliance-status.md](../compliance-status.md)
- **CLAUDE.md:** [Development commands](../../CLAUDE.md#development-commands)

## Questions?

**"Why fuzzing and not property-based testing?"**
- We use both! Fuzzing with seeds is deterministic property testing
- Property: "System must recover from all crashes"
- Fuzzing: Test property with thousands of random inputs (seeds)

**"How long does a full fuzzing campaign take?"**
- 2500 tests at ~0.6 tests/second = ~70 minutes
- Run nightly in CI, not on every commit

**"What if I find a bug?"**
- Seed is automatically saved to `.fuzz-bugs.json`
- Reproduce with: `CHAOS_SEED=<seed> go test -run TestFuzz... -v`
- Fix bug, verify seed passes, commit fix

**"Do I need to run fuzzing locally?"**
- No - CI runs nightly fuzzing campaigns
- Yes - If you change crash recovery or fault handling code
- Yes - To verify bug fixes before committing
