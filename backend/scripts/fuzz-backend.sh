#!/bin/bash
# Backend Go fuzzing campaign
# Runs simulation tests with random seeds to find bugs

cd "$(dirname "$0")/.."

TOTAL_TESTS=5000
MAX_SEED=1000000
TESTED_SEEDS_FILE="internal/simulation/.tested-seeds.txt"
BUG_FILE="internal/simulation/.fuzz-bugs.json"

# Initialize files
mkdir -p internal/simulation
rm -f "$BUG_FILE" "$TESTED_SEEDS_FILE"
echo "[]" > "$BUG_FILE"
touch "$TESTED_SEEDS_FILE"

echo "🚀 Backend Go Fuzzing Campaign"
echo "Target: $TOTAL_TESTS tests with unique seeds"
echo "Tests: Crashes, Faults, Invariants"
echo "Press Ctrl+C to stop"
echo ""

run_count=0
pass_count=0
fail_count=0
start_time=$(date +%s)

while [ $run_count -lt $TOTAL_TESTS ]; do
  # Generate unique seed
  while true; do
    seed=$((RANDOM * RANDOM % MAX_SEED))
    if ! grep -q "^$seed$" "$TESTED_SEEDS_FILE"; then
      echo "$seed" >> "$TESTED_SEEDS_FILE"
      break
    fi
  done

  run_count=$((run_count + 1))

  # Run all fuzz tests with this seed
  output=$(SIMULATION_SEED=$seed go test -run "TestFuzz" ./internal/simulation -v 2>&1)

  # Check if tests passed
  if echo "$output" | grep -q "PASS"; then
    result="✅"
    is_failure=false
    pass_count=$((pass_count + 1))
  else
    result="❌"
    is_failure=true
    fail_count=$((fail_count + 1))
  fi

  # Calculate progress
  progress=$(echo "scale=1; ($run_count * 100) / $TOTAL_TESTS" | bc)
  elapsed=$(($(date +%s) - start_time))
  rate=$(echo "scale=1; $run_count / ($elapsed + 1)" | bc)

  # Print one-line summary
  timestamp=$(date +"%H:%M:%S")
  printf "[%s] #%-5d (%s%%) seed=%-7d %s | Rate:%.1f/s | Total: ✅%-4d ❌%-4d\n" \
    "$timestamp" "$run_count" "$progress" "$seed" "$result" "$rate" "$pass_count" "$fail_count"

  # Save failing seed
  if [ "$is_failure" = true ]; then
    error_msg=$(echo "$output" | grep -A2 "Test failed" | tail -1)

    tmp_file=$(mktemp)
    jq --arg seed "$seed" \
       --arg error "$error_msg" \
       --arg output "$output" \
       '. += [{seed: $seed, error: $error, timestamp: now | strftime("%Y-%m-%d %H:%M:%S")}]' \
       "$BUG_FILE" > "$tmp_file" && mv "$tmp_file" "$BUG_FILE"

    echo "  💾 Bug saved - Reproduce: SIMULATION_SEED=$seed go test -run TestFuzz ./internal/simulation -v"
  fi

  # Progress milestones
  if [ $((run_count % 100)) -eq 0 ] || [ $run_count -eq $TOTAL_TESTS ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Progress: $run_count/$TOTAL_TESTS ($progress%) | Elapsed: ${elapsed}s | Rate: ${rate} tests/s"
    echo "   ✅ Passed: $pass_count | ❌ Failed: $fail_count | Success rate: $(echo "scale=1; ($pass_count * 100) / $run_count" | bc)%"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
  fi
done

# Final summary
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🏁 BACKEND FUZZING CAMPAIGN COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo "Tests run:     $TOTAL_TESTS"
echo "Passed:        $pass_count ($(echo "scale=1; ($pass_count * 100) / $TOTAL_TESTS" | bc)%)"
echo "Failed:        $fail_count ($(echo "scale=1; ($fail_count * 100) / $TOTAL_TESTS" | bc)%)"
echo "Duration:      ${elapsed}s ($(echo "scale=1; $elapsed / 60" | bc) minutes)"
echo "Average rate:  $(echo "scale=2; $TOTAL_TESTS / $elapsed" | bc) tests/second"
echo ""

if [ $fail_count -gt 0 ]; then
  echo "❌ Bugs found: $fail_count"
  echo "   See: $BUG_FILE"
  echo "   Reproduce with: SIMULATION_SEED=<seed> go test -run TestFuzz ./internal/simulation -v"
else
  echo "✅ No bugs found! All tests passed."
fi
echo "═══════════════════════════════════════════════════════════════"
