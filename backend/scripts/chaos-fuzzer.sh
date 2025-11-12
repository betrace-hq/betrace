#!/bin/bash
# Run thousands of CHAOS-level fuzzing tests
cd "$(dirname "$0")/.."

TOTAL_TESTS=5000
BUG_FILE="internal/simulation/.chaos-bugs.json"
rm -f "$BUG_FILE" && echo "[]" > "$BUG_FILE"

echo "💥 CHAOS FUZZING CAMPAIGN"
echo "Target: $TOTAL_TESTS tests (30% crash, 20% disk full, 10% corruption)"
echo ""

run_count=0
pass_count=0
fail_count=0
start_time=$(date +%s)

while [ $run_count -lt $TOTAL_TESTS ]; do
  seed=$RANDOM
  run_count=$((run_count + 1))

  if env CHAOS_SEED=$seed go test -run TestFuzzChaosMode ./internal/simulation 2>&1 | grep -q "PASS"; then
    result="✅"
    pass_count=$((pass_count + 1))
  else
    result="❌"
    fail_count=$((fail_count + 1))
    echo "  💾 Bug at seed $seed"
    tmp=$(mktemp)
    jq --arg seed "$seed" '. += [{seed: $seed, timestamp: now | strftime("%Y-%m-%d %H:%M:%S")}]' "$BUG_FILE" > "$tmp" && mv "$tmp" "$BUG_FILE"
  fi

  elapsed=$(($(date +%s) - start_time))
  rate=$(echo "scale=1; $run_count / ($elapsed + 1)" | bc)
  progress=$(echo "scale=1; ($run_count * 100) / $TOTAL_TESTS" | bc)

  printf "[%d/%d] (%s%%) seed=%d %s | Rate:%.1f/s | ✅%d ❌%d\n" "$run_count" "$TOTAL_TESTS" "$progress" "$seed" "$result" "$rate" "$pass_count" "$fail_count"

  if [ $((run_count % 100)) -eq 0 ]; then
    success_rate=$(echo "scale=1; ($pass_count * 100) / $run_count" | bc)
    echo "━━━ Progress: $run_count/$TOTAL_TESTS | Success: ${success_rate}% | Elapsed: ${elapsed}s ━━━"
  fi
done

elapsed=$(($(date +%s) - start_time))
success_rate=$(echo "scale=1; ($pass_count * 100) / $TOTAL_TESTS" | bc)

echo ""
echo "═══════════════════════════════════════════════"
echo "🏁 CHAOS FUZZING COMPLETE"
echo "═══════════════════════════════════════════════"
echo "Total tests:   $TOTAL_TESTS"
echo "Passed:        $pass_count (${success_rate}%)"
echo "Failed:        $fail_count"
echo "Duration:      ${elapsed}s ($(echo "scale=1; $elapsed / 60" | bc) min)"
echo "Rate:          $(echo "scale=2; $TOTAL_TESTS / $elapsed" | bc) tests/s"
echo ""

if [ $fail_count -gt 0 ]; then
  echo "❌ Bugs found under CHAOS: $fail_count"
  echo "   See: $BUG_FILE"
else
  echo "✅ NO BUGS FOUND! System survived $TOTAL_TESTS chaos tests"
fi
echo "═══════════════════════════════════════════════"
