#!/usr/bin/env bash
# Quick test status viewer - shows current state of running tests
# Usage: ./test-status.sh [log-file]

set -euo pipefail

LOG_FILE="${1:-target/surefire-reports}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}              FLUO Test Status - $(date '+%H:%M:%S')${NC}"
echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$LOG_FILE" ]; then
    # Monitoring a log file
    echo -e "${BLUE}📋 Log file: ${YELLOW}$LOG_FILE${NC}"
    echo ""

    # Show last test that started
    last_running=$(grep "Running" "$LOG_FILE" | tail -1)
    if [ -n "$last_running" ]; then
        echo -e "${CYAN}⏳ Currently running:${NC}"
        echo "   $last_running"
        echo ""
    fi

    # Show completed tests with results
    echo -e "${BOLD}Completed tests:${NC}"
    grep "Tests run:" "$LOG_FILE" | tail -10 | while IFS= read -r line; do
        if [[ "$line" =~ "Failures: 0" ]] && [[ "$line" =~ "Errors: 0" ]]; then
            echo -e "${GREEN}✓${NC} $line"
        else
            echo -e "${RED}✗${NC} $line"
        fi
    done
    echo ""

    # Show any failures
    failures=$(grep -c "FAILURE" "$LOG_FILE" 2>/dev/null || echo "0")
    if [ "$failures" -gt 0 ]; then
        echo -e "${RED}❌ Found $failures test failures${NC}"
        echo ""
        echo -e "${BOLD}Recent failures:${NC}"
        grep -A 5 "FAILURE" "$LOG_FILE" | tail -20
    fi

    # Show build status if present
    if grep -q "BUILD SUCCESS" "$LOG_FILE" 2>/dev/null; then
        echo -e "${GREEN}${BOLD}✅ BUILD SUCCESS${NC}"
    elif grep -q "BUILD FAILURE" "$LOG_FILE" 2>/dev/null; then
        echo -e "${RED}${BOLD}❌ BUILD FAILURE${NC}"
    else
        echo -e "${YELLOW}⏳ Tests still running...${NC}"
    fi

elif [ -d "$LOG_FILE" ]; then
    # Monitoring surefire reports directory
    REPORT_DIR="$LOG_FILE"
    echo -e "${BLUE}📊 Report directory: ${YELLOW}$REPORT_DIR${NC}"
    echo ""

    if [ ! -d "$REPORT_DIR" ] || [ -z "$(ls -A "$REPORT_DIR" 2>/dev/null)" ]; then
        echo -e "${YELLOW}⚠ No test reports found yet${NC}"
        exit 0
    fi

    total_tests=0
    total_failures=0
    total_errors=0
    passing=0
    failing=0

    for report in "$REPORT_DIR"/*.txt; do
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
                    echo -e "${GREEN}✓${NC} ${test_name}: ${runs} tests"
                    passing=$((passing + 1))
                else
                    echo -e "${RED}✗${NC} ${test_name}: ${runs} tests (${RED}${failures}F ${errors}E${NC})"
                    failing=$((failing + 1))
                fi
            else
                echo -e "${YELLOW}⏳${NC} ${test_name}: Running..."
            fi
        fi
    done

    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Summary:${NC}"
    echo -e "  Test Classes: ${passing} passing, ${failing} failing"
    echo -e "  Total Tests: ${CYAN}$total_tests${NC}"

    if [ "$total_failures" -eq 0 ] && [ "$total_errors" -eq 0 ]; then
        echo -e "  ${GREEN}${BOLD}✓ All tests passing!${NC}"
    else
        [ "$total_failures" -gt 0 ] && echo -e "  ${RED}✗ Failures: $total_failures${NC}"
        [ "$total_errors" -gt 0 ] && echo -e "  ${RED}✗ Errors: $total_errors${NC}"
    fi
else
    echo -e "${RED}Error: $LOG_FILE not found${NC}"
    exit 1
fi
