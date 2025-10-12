#!/usr/bin/env bash
# Stateful test monitoring with progress tracking
# Usage: ./watch-tests.sh <log-file>

set -euo pipefail

LOG_FILE="${1:-}"

if [ -z "$LOG_FILE" ]; then
    echo "Usage: $0 <log-file>"
    echo ""
    echo "Example:"
    echo "  Terminal 1: mvn test 2>&1 | tee /tmp/test-run.log"
    echo "  Terminal 2: $0 /tmp/test-run.log"
    exit 1
fi

# Check if gum is available
if ! command -v gum &> /dev/null; then
    echo "⚠️  gum not found. Using fallback display..."
    HAVE_GUM=false
else
    HAVE_GUM=true
fi

# State tracking
declare -A ALL_TESTS       # All discovered tests
declare -A TEST_STATUS     # pending, running, passed, failed
declare -A TEST_RESULTS    # Test counts (runs|failures|errors)
declare -A TEST_START_TIME # When test started running

# Discover all tests in the project
discover_tests() {
    local test_dir="src/test/java"
    if [ -d "$test_dir" ]; then
        while IFS= read -r test_file; do
            local test_name=$(basename "$test_file" .java)
            ALL_TESTS["$test_name"]=1
            TEST_STATUS["$test_name"]="pending"
        done < <(find "$test_dir" -name "*Test.java" 2>/dev/null)
    fi
}

# Parse log file and update test states
parse_log() {
    if [ ! -f "$LOG_FILE" ]; then
        return
    fi

    # Find tests that started running
    while IFS= read -r line; do
        if [[ "$line" =~ Running[[:space:]]+([a-zA-Z0-9_.]+) ]]; then
            local test_name="${BASH_REMATCH[1]##*.}"
            if [ "${TEST_STATUS[$test_name]:-}" != "passed" ] && [ "${TEST_STATUS[$test_name]:-}" != "failed" ]; then
                if [ "${TEST_STATUS[$test_name]:-}" != "running" ]; then
                    TEST_START_TIME["$test_name"]=$SECONDS
                fi
                TEST_STATUS["$test_name"]="running"
            fi
        fi
    done < <(grep "\[INFO\] Running" "$LOG_FILE" 2>/dev/null || true)

    # Find completed tests
    while IFS= read -r line; do
        if [[ "$line" =~ Tests\ run:\ ([0-9]+),\ Failures:\ ([0-9]+),\ Errors:\ ([0-9]+).*in\ ([a-zA-Z0-9_.]+) ]]; then
            local runs="${BASH_REMATCH[1]}"
            local failures="${BASH_REMATCH[2]}"
            local errors="${BASH_REMATCH[3]}"
            local test_name="${BASH_REMATCH[4]##*.}"

            TEST_RESULTS["$test_name"]="$runs|$failures|$errors"

            if [ "$failures" -eq 0 ] && [ "$errors" -eq 0 ]; then
                TEST_STATUS["$test_name"]="passed"
            else
                TEST_STATUS["$test_name"]="failed"
            fi
        fi
    done < <(grep "Tests run:" "$LOG_FILE" 2>/dev/null || true)
}

# Calculate statistics
calc_stats() {
    local pending=0 running=0 passed=0 failed=0 total=0
    local total_tests=0 total_failures=0 total_errors=0

    for test in "${!ALL_TESTS[@]}"; do
        total=$((total + 1))
        case "${TEST_STATUS[$test]}" in
            pending) pending=$((pending + 1)) ;;
            running) running=$((running + 1)) ;;
            passed)
                passed=$((passed + 1))
                if [ -n "${TEST_RESULTS[$test]:-}" ]; then
                    IFS='|' read -r runs fails errs <<< "${TEST_RESULTS[$test]}"
                    total_tests=$((total_tests + runs))
                fi
                ;;
            failed)
                failed=$((failed + 1))
                if [ -n "${TEST_RESULTS[$test]:-}" ]; then
                    IFS='|' read -r runs fails errs <<< "${TEST_RESULTS[$test]}"
                    total_tests=$((total_tests + runs))
                    total_failures=$((total_failures + fails))
                    total_errors=$((total_errors + errs))
                fi
                ;;
        esac
    done

    echo "$total|$pending|$running|$passed|$failed|$total_tests|$total_failures|$total_errors"
}

# Display status with gum
display_tui() {
    local stats=$(calc_stats)
    IFS='|' read -r total pending running passed failed total_tests total_failures total_errors <<< "$stats"

    local completed=$((passed + failed))
    local progress=$(( total > 0 ? completed * 100 / total : 0 ))

    # Use tput for clean updates (no flicker)
    tput cup 0 0  # Move cursor to top

    # Header
    gum style \
        --border double \
        --border-foreground 212 \
        --padding "1 2" \
        --width 80 \
        "$(gum style --foreground 212 --bold '🧪 FLUO Test Monitor')" \
        "$(date '+%H:%M:%S')"

    # Progress bar
    local bar_width=60
    local filled=$(( progress * bar_width / 100 ))
    local bar=$(printf "%-${bar_width}s" "$(printf '%*s' "$filled" | tr ' ' '█')" | tr ' ' '░')

    gum style \
        --border rounded \
        --border-foreground 14 \
        --padding "1" \
        --width 80 \
        "$(gum style --foreground 14 --bold 'Progress')" \
        "$(gum style --foreground 212 "$bar") $(gum style --foreground 14 --bold "${progress}%")" \
        "" \
        "$(gum style --foreground 10 "✓ $passed")  $(gum style --foreground 9 "✗ $failed")  $(gum style --foreground 11 "⏳ $running")  $(gum style --foreground 8 "○ $pending")"

    # Stats
    gum style \
        --border rounded \
        --border-foreground 212 \
        --padding "1" \
        --width 80 \
        "$(gum style --foreground 212 --bold '📊 Stats')" \
        "$(gum style --foreground 14 "Suites: $completed/$total • Tests: $total_tests • Failures: $total_failures")"

    # Currently Running
    if [ "$running" -gt 0 ]; then
        echo ""
        gum style --foreground 11 --bold "⏳ Running ($running):"
        for test in $(printf '%s\n' "${!ALL_TESTS[@]}" | sort); do
            if [ "${TEST_STATUS[$test]}" = "running" ]; then
                local elapsed=$(( SECONDS - ${TEST_START_TIME[$test]:-$SECONDS} ))
                gum style --foreground 11 "  • $test (${elapsed}s)"
            fi
        done
    fi

    # Pending (next 5)
    if [ "$pending" -gt 0 ]; then
        echo ""
        gum style --foreground 8 --bold "○ Next ($pending remaining):"
        local count=0
        for test in $(printf '%s\n' "${!ALL_TESTS[@]}" | sort); do
            [ "$count" -ge 5 ] && break
            if [ "${TEST_STATUS[$test]}" = "pending" ]; then
                gum style --foreground 8 "  • $test"
                count=$((count + 1))
            fi
        done
    fi

    # Recent completions
    if [ "$completed" -gt 0 ]; then
        echo ""
        gum style --foreground 14 --bold "✓ Recent (last 8):"
        local count=0
        for test in $(printf '%s\n' "${!ALL_TESTS[@]}" | sort -r); do
            [ "$count" -ge 8 ] && break
            if [ "${TEST_STATUS[$test]}" = "passed" ]; then
                IFS='|' read -r runs fails errs <<< "${TEST_RESULTS[$test]}"
                gum style --foreground 10 "  ✓ $test ($runs tests)"
                count=$((count + 1))
            elif [ "${TEST_STATUS[$test]}" = "failed" ]; then
                IFS='|' read -r runs fails errs <<< "${TEST_RESULTS[$test]}"
                gum style --foreground 9 "  ✗ $test ($runs tests, ${fails}F)"
                count=$((count + 1))
            fi
        done
    fi

    # Build status
    if grep -q "BUILD SUCCESS" "$LOG_FILE" 2>/dev/null; then
        echo ""
        gum style --foreground 10 --bold --border double --padding "0 2" --align center --width 80 "✅ BUILD SUCCESS"
    elif grep -q "BUILD FAILURE" "$LOG_FILE" 2>/dev/null; then
        echo ""
        gum style --foreground 9 --bold --border double --padding "0 2" --align center --width 80 "❌ BUILD FAILURE"
    fi

    # Footer
    echo ""
    gum style --foreground 8 --align center "Press Ctrl+C to exit"

    # Clear remaining lines
    tput ed
}

# Fallback display without gum
display_fallback() {
    local stats=$(calc_stats)
    IFS='|' read -r total pending running passed failed total_tests total_failures total_errors <<< "$stats"

    local completed=$((passed + failed))
    local progress=$(( total > 0 ? completed * 100 / total : 0 ))

    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "  🧪 FLUO Test Monitor - $(date '+%H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "Progress: $completed/$total ($progress%) • ✓$passed ✗$failed ⏳$running ○$pending"
    echo "Tests: $total_tests • Failures: $total_failures"
    echo ""

    if [ "$running" -gt 0 ]; then
        echo "⏳ Running ($running):"
        for test in "${!ALL_TESTS[@]}"; do
            if [ "${TEST_STATUS[$test]}" = "running" ]; then
                local elapsed=$(( SECONDS - ${TEST_START_TIME[$test]:-$SECONDS} ))
                echo "  • $test (${elapsed}s)"
            fi
        done
        echo ""
    fi

    if [ "$pending" -gt 0 ]; then
        echo "○ Next ($pending remaining): $(printf '%s\n' "${!ALL_TESTS[@]}" | while read t; do [ "${TEST_STATUS[$t]}" = "pending" ] && echo "$t"; done | head -3 | tr '\n' ', ' | sed 's/,$//')..."
        echo ""
    fi
}

# Main loop
main() {
    # Discover all tests
    discover_tests

    if [ "$HAVE_GUM" = true ]; then
        # Show startup message
        clear
        gum style \
            --foreground 212 \
            --bold \
            --border double \
            --padding "1 2" \
            --align center \
            "🧪 FLUO Test Monitor" \
            "" \
            "Watching: $LOG_FILE" \
            "" \
            "Discovered ${#ALL_TESTS[@]} test suites" \
            "" \
            "Initializing..."

        sleep 2

        # Clear screen and hide cursor
        clear
        tput civis  # Hide cursor

        # Trap to restore cursor on exit
        trap 'tput cnorm; clear' EXIT INT TERM
    fi

    # Main watch loop
    while true; do
        parse_log

        if [ "$HAVE_GUM" = true ]; then
            display_tui
        else
            clear
            display_fallback
        fi

        sleep 2
    done
}

# Run main
main
