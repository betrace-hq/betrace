#!/usr/bin/env bash
# Test Monitor TUI - Shows real-time progress of Maven tests
# Usage: ./test-monitor.sh [log-file]
#   If no log file specified, monitors target/surefire-reports/*.txt

set -euo pipefail

LOG_FILE="${1:-}"
REPORT_DIR="target/surefire-reports"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear

echo -e "${BOLD}${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║              FLUO Test Monitor - Real-Time View               ║${NC}"
echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -n "$LOG_FILE" ]; then
    echo -e "${BLUE}📋 Monitoring log file: ${YELLOW}$LOG_FILE${NC}"
    echo ""

    # Monitor specific log file
    tail -f "$LOG_FILE" | while IFS= read -r line; do
        if [[ "$line" =~ "Running" ]]; then
            echo -e "${CYAN}▶  ${BOLD}$line${NC}"
        elif [[ "$line" =~ "Tests run:" ]]; then
            if [[ "$line" =~ "Failures: 0" ]] && [[ "$line" =~ "Errors: 0" ]]; then
                echo -e "${GREEN}✓  $line${NC}"
            else
                echo -e "${RED}✗  $line${NC}"
            fi
        elif [[ "$line" =~ "FAILURE" ]]; then
            echo -e "${RED}${BOLD}❌ $line${NC}"
        elif [[ "$line" =~ "SUCCESS" ]]; then
            echo -e "${GREEN}${BOLD}✅ $line${NC}"
        elif [[ "$line" =~ "BUILD" ]]; then
            echo -e "${BOLD}$line${NC}"
        elif [[ "$line" =~ "ERROR" ]]; then
            echo -e "${RED}$line${NC}"
        elif [[ "$line" =~ "WARN" ]]; then
            echo -e "${YELLOW}$line${NC}"
        else
            echo "$line"
        fi
    done
else
    echo -e "${BLUE}📊 Monitoring Surefire reports in: ${YELLOW}$REPORT_DIR${NC}"
    echo ""

    # Monitor surefire reports directory
    while true; do
        clear
        echo -e "${BOLD}${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BOLD}${CYAN}║              FLUO Test Monitor - Real-Time View               ║${NC}"
        echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${BLUE}📊 Last update: ${YELLOW}$(date '+%H:%M:%S')${NC}"
        echo ""

        if [ -d "$REPORT_DIR" ]; then
            total_tests=0
            total_failures=0
            total_errors=0
            total_skipped=0
            current_test=""

            # Parse all test report files
            for report in "$REPORT_DIR"/*.txt; do
                if [ -f "$report" ]; then
                    test_name=$(basename "$report" .txt)

                    # Extract test results
                    if grep -q "Tests run:" "$report" 2>/dev/null; then
                        results=$(grep "Tests run:" "$report" | tail -1)

                        runs=$(echo "$results" | grep -oP 'Tests run: \K\d+' || echo "0")
                        failures=$(echo "$results" | grep -oP 'Failures: \K\d+' || echo "0")
                        errors=$(echo "$results" | grep -oP 'Errors: \K\d+' || echo "0")
                        skipped=$(echo "$results" | grep -oP 'Skipped: \K\d+' || echo "0")

                        total_tests=$((total_tests + runs))
                        total_failures=$((total_failures + failures))
                        total_errors=$((total_errors + errors))
                        total_skipped=$((total_skipped + skipped))

                        if [ "$failures" -eq 0 ] && [ "$errors" -eq 0 ]; then
                            echo -e "${GREEN}✓${NC} ${test_name}: ${runs} tests"
                        else
                            echo -e "${RED}✗${NC} ${test_name}: ${runs} tests (${RED}${failures}F ${errors}E${NC})"
                        fi
                    else
                        echo -e "${YELLOW}⏳${NC} ${test_name}: Running..."
                        current_test="$test_name"
                    fi
                fi
            done

            echo ""
            echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${BOLD}Summary:${NC}"
            echo -e "  Total Tests: ${CYAN}$total_tests${NC}"

            if [ "$total_failures" -eq 0 ] && [ "$total_errors" -eq 0 ]; then
                echo -e "  ${GREEN}✓ All tests passing${NC}"
            else
                [ "$total_failures" -gt 0 ] && echo -e "  ${RED}✗ Failures: $total_failures${NC}"
                [ "$total_errors" -gt 0 ] && echo -e "  ${RED}✗ Errors: $total_errors${NC}"
            fi

            [ "$total_skipped" -gt 0 ] && echo -e "  ${YELLOW}⊘ Skipped: $total_skipped${NC}"

            if [ -n "$current_test" ]; then
                echo ""
                echo -e "${YELLOW}⏳ Currently running: ${BOLD}$current_test${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ No test reports found yet. Waiting for tests to start...${NC}"
        fi

        sleep 2
    done
fi
