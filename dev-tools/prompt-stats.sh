#!/usr/bin/env bash
# BeTrace Test Stats for Shell Prompt
# Fetches latest test results and formats for display

TEST_RESULT_DIR="/tmp/betrace-test-results"
RESULTS_FILE="$TEST_RESULT_DIR/reports/summary.json"
COVERAGE_FILE="$TEST_RESULT_DIR/coverage/summary.json"

# Check if test results exist and are recent (within last 30 minutes)
if [ ! -f "$RESULTS_FILE" ]; then
  echo ""
  exit 0
fi

# Check age of results (skip if older than 30 minutes)
if [ "$(uname)" = "Darwin" ]; then
  FILE_AGE=$(($(date +%s) - $(stat -f %m "$RESULTS_FILE")))
else
  FILE_AGE=$(($(date +%s) - $(stat -c %Y "$RESULTS_FILE")))
fi

if [ $FILE_AGE -gt 1800 ]; then
  echo ""
  exit 0
fi

# Parse test results
if command -v jq >/dev/null 2>&1; then
  TOTAL=$(jq -r '.overall.total // 0' "$RESULTS_FILE" 2>/dev/null)
  PASSED=$(jq -r '.overall.passed // 0' "$RESULTS_FILE" 2>/dev/null)
  FAILED=$(jq -r '.overall.failed // 0' "$RESULTS_FILE" 2>/dev/null)

  # Parse coverage if available
  if [ -f "$COVERAGE_FILE" ]; then
    INST_COV=$(jq -r '.overall.instruction // 0' "$COVERAGE_FILE" 2>/dev/null)
    BRANCH_COV=$(jq -r '.overall.branch // 0' "$COVERAGE_FILE" 2>/dev/null)
  else
    INST_COV=0
    BRANCH_COV=0
  fi

  # Format output based on results
  if [ "$TOTAL" -eq 0 ]; then
    echo ""
  elif [ "$FAILED" -eq 0 ]; then
    # All tests passed - show green checkmark with coverage
    printf "✅ %d/%d %.0f%%" "$PASSED" "$TOTAL" "$INST_COV"
  else
    # Some tests failed - show red X
    printf "❌ %d/%d" "$FAILED" "$TOTAL"
  fi
fi
