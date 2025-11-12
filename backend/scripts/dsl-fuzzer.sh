#!/usr/bin/env bash
# DSL Parser Fuzzing Campaign
# Runs deterministic fuzzing with 1000 random seeds to find edge cases

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$BACKEND_DIR"

TOTAL_TESTS=5000
FAILED_SEEDS=()

echo "🔍 Starting DSL parser fuzzing campaign..."
echo "Running $TOTAL_TESTS tests with random seeds"
echo ""

start_time=$(date +%s)

for i in $(seq 1 $TOTAL_TESTS); do
	# Generate random seed
	SEED=$RANDOM$RANDOM$RANDOM

	# Progress indicator every 50 tests
	if [ $((i % 50)) -eq 0 ]; then
		elapsed=$(($(date +%s) - start_time))
		echo "Progress: $i/$TOTAL_TESTS (${elapsed}s elapsed)"
	fi

	# Run test with this seed
	if ! DSL_FUZZ_SEED=$SEED go test ./internal/dsl/... -run TestFuzzDSLParser -count=1 >/dev/null 2>&1; then
		echo "❌ FAILURE at seed $SEED (test $i/$TOTAL_TESTS)"
		FAILED_SEEDS+=($SEED)
	fi
done

end_time=$(date +%s)
elapsed=$((end_time - start_time))

echo ""
echo "================================================"
echo "DSL Fuzzing Campaign Complete"
echo "================================================"
echo "Tests run: $TOTAL_TESTS"
echo "Time elapsed: ${elapsed}s"
echo "Tests per second: $(($TOTAL_TESTS / $elapsed))"
echo ""

if [ ${#FAILED_SEEDS[@]} -eq 0 ]; then
	echo "✅ SUCCESS: All $TOTAL_TESTS tests passed!"
	echo ""
	echo "No bugs found. Parser is robust across $TOTAL_TESTS random executions."
else
	echo "❌ FAILURES: ${#FAILED_SEEDS[@]} tests failed"
	echo ""
	echo "Failed seeds (reproduce with: DSL_FUZZ_SEED=<seed> go test ./internal/dsl/... -run TestFuzzDSLParser -v):"
	for seed in "${FAILED_SEEDS[@]}"; do
		echo "  - $seed"
	done
	echo ""
	echo "To reproduce first failure:"
	echo "  DSL_FUZZ_SEED=${FAILED_SEEDS[0]} go test ./internal/dsl/... -run TestFuzzDSLParser -v"
	exit 1
fi
