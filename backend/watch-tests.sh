#!/usr/bin/env bash
# Beautiful test monitoring with gum
# Usage: ./watch-tests.sh [log-file|surefire-dir]

set -euo pipefail

TARGET="${1:-target/surefire-reports}"

# Check if gum is available
if ! command -v gum &> /dev/null; then
    echo "⚠️  gum not found. Install with: nix-shell -p gum"
    echo "Falling back to basic display..."
    HAVE_GUM=false
else
    HAVE_GUM=true
fi

show_status() {
    local log_file="$1"

    if [ -f "$log_file" ]; then
        # Monitoring a log file
        local last_running=$(grep "Running" "$log_file" | tail -1 || echo "")
        local completed=$(grep -c "Tests run:" "$log_file" 2>/dev/null || echo "0")
        local failures=$(grep -c "FAILURE" "$log_file" 2>/dev/null || echo "0")

        if [ "$HAVE_GUM" = true ]; then
            gum style \
                --border double \
                --border-foreground 212 \
                --padding "1 2" \
                --margin "1" \
                "$(gum style --foreground 212 --bold 'FLUO Test Monitor') $(date '+%H:%M:%S')"

            if [ -n "$last_running" ]; then
                echo ""
                gum style --foreground 33 "⏳ Currently running:"
                echo "   $(echo "$last_running" | sed 's/\[INFO\] Running //')"
            fi

            echo ""
            gum style --foreground 212 --bold "📊 Progress:"
            gum style --foreground 10 "  ✓ Completed: $completed test suites"

            if [ "$failures" -gt 0 ]; then
                gum style --foreground 9 "  ✗ Failures: $failures"
            fi

            # Show recent test results
            echo ""
            gum style --foreground 212 --bold "Recent results:"
            grep "Tests run:" "$log_file" | tail -5 | while IFS= read -r line; do
                if [[ "$line" =~ "Failures: 0" ]] && [[ "$line" =~ "Errors: 0" ]]; then
                    gum style --foreground 10 "  ✓ ${line##*in }"
                else
                    gum style --foreground 9 "  ✗ ${line##*in }"
                fi
            done

            # Check build status
            if grep -q "BUILD SUCCESS" "$log_file" 2>/dev/null; then
                echo ""
                gum style --foreground 10 --bold --border double --padding "0 2" "✅ BUILD SUCCESS"
            elif grep -q "BUILD FAILURE" "$log_file" 2>/dev/null; then
                echo ""
                gum style --foreground 9 --bold --border double --padding "0 2" "❌ BUILD FAILURE"

                # Show failure summary
                echo ""
                gum style --foreground 9 --bold "Failures:"
                grep "Failures:" "$log_file" | tail -3 | while IFS= read -r line; do
                    echo "  $line"
                done
            fi
        else
            # Fallback without gum
            echo "════════════════════════════════════════════════════════════════"
            echo "  FLUO Test Monitor - $(date '+%H:%M:%S')"
            echo "════════════════════════════════════════════════════════════════"
            echo ""
            [ -n "$last_running" ] && echo "⏳ $last_running"
            echo "📊 Completed: $completed | Failures: $failures"
        fi

    elif [ -d "$log_file" ]; then
        # Monitoring surefire reports
        local report_dir="$log_file"

        if [ ! -d "$report_dir" ] || [ -z "$(ls -A "$report_dir" 2>/dev/null)" ]; then
            if [ "$HAVE_GUM" = true ]; then
                gum style --foreground 11 "⚠️  Waiting for tests to start..."
            else
                echo "⚠️  Waiting for tests to start..."
            fi
            return
        fi

        local total_tests=0
        local total_failures=0
        local total_errors=0
        local passing_suites=0
        local failing_suites=0
        local running_suites=()
        local completed_suites=()

        for report in "$report_dir"/*.txt; do
            if [ -f "$report" ]; then
                test_name=$(basename "$report" .txt)

                if grep -q "Tests run:" "$report" 2>/dev/null; then
                    results=$(grep "Tests run:" "$report" | tail -1)
                    runs=$(echo "$results" | grep -oP 'Tests run: \K\d+' || echo "0")
                    failures=$(echo "$results" | grep -oP 'Failures: \K\d+' || echo "0")
                    errors=$(echo "$results" | grep -oP 'Errors: \K\d+' || echo "0")

                    total_tests=$((total_tests + runs))
                    total_failures=$((total_failures + failures))
                    total_errors=$((total_errors + errors))

                    if [ "$failures" -eq 0 ] && [ "$errors" -eq 0 ]; then
                        completed_suites+=("✓ $test_name ($runs tests)")
                        passing_suites=$((passing_suites + 1))
                    else
                        completed_suites+=("✗ $test_name ($runs tests, ${failures}F ${errors}E)")
                        failing_suites=$((failing_suites + 1))
                    fi
                else
                    running_suites+=("$test_name")
                fi
            fi
        done

        if [ "$HAVE_GUM" = true ]; then
            gum style \
                --border double \
                --border-foreground 212 \
                --padding "1 2" \
                --margin "1" \
                "$(gum style --foreground 212 --bold 'FLUO Test Monitor') $(date '+%H:%M:%S')"

            if [ ${#running_suites[@]} -gt 0 ]; then
                echo ""
                gum style --foreground 33 --bold "⏳ Currently running (${#running_suites[@]}):"
                for suite in "${running_suites[@]}"; do
                    gum style --foreground 33 "   $suite"
                done
            fi

            echo ""
            gum join --vertical \
                "$(gum style --foreground 212 --bold '📊 Summary')" \
                "$(gum style --foreground 14 "   Test Suites: $passing_suites passing, $failing_suites failing")" \
                "$(gum style --foreground 14 "   Total Tests: $total_tests")"

            if [ "$total_failures" -gt 0 ] || [ "$total_errors" -gt 0 ]; then
                gum style --foreground 9 "   ✗ Failures: $total_failures | Errors: $total_errors"
            else
                gum style --foreground 10 --bold "   ✓ All tests passing!"
            fi

            if [ ${#completed_suites[@]} -gt 0 ]; then
                echo ""
                gum style --foreground 212 --bold "Completed test suites:"
                for suite in "${completed_suites[@]}"; do
                    if [[ "$suite" =~ ^✓ ]]; then
                        gum style --foreground 10 "  $suite"
                    else
                        gum style --foreground 9 "  $suite"
                    fi
                done
            fi
        else
            # Fallback without gum
            echo "════════════════════════════════════════════════════════════════"
            echo "  FLUO Test Monitor - $(date '+%H:%M:%S')"
            echo "════════════════════════════════════════════════════════════════"
            echo ""
            echo "Summary: $passing_suites passing, $failing_suites failing"
            echo "Total: $total_tests tests"
        fi
    fi
}

# Watch mode - update every 2 seconds
if [ "$HAVE_GUM" = true ]; then
    gum style \
        --foreground 212 --bold \
        --border double \
        --padding "1 2" \
        --align center \
        "🧪 Starting Test Monitor..." \
        "" \
        "Watching: $TARGET" \
        "" \
        "Press Ctrl+C to exit"

    sleep 2
fi

while true; do
    clear
    show_status "$TARGET"
    sleep 2
done
