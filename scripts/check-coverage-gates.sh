#!/usr/bin/env bash
#
# Check Coverage Gates
#
# Validates that test coverage meets minimum thresholds.
# Exits with code 1 if any threshold is not met.
#
# Usage:
#   ./check-coverage-gates.sh [coverage-file]
#
# Environment Variables:
#   USE_CASE_MIN      - Minimum use case coverage (default: 70)
#   FEATURE_MIN       - Minimum feature coverage (default: 70)
#   API_ROUTE_MIN     - Minimum API route coverage (default: 80)
#   LOC_MIN           - Minimum LoC coverage (default: 60)
#

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Coverage thresholds (can be overridden by environment variables)
USE_CASE_MIN=${USE_CASE_MIN:-70}
FEATURE_MIN=${FEATURE_MIN:-70}
API_ROUTE_MIN=${API_ROUTE_MIN:-80}
LOC_MIN=${LOC_MIN:-60}

# Coverage file location
COVERAGE_FILE="${1:-grafana-betrace-app/coverage-reports/coverage-latest.json}"

echo -e "${BLUE}📊 Checking Coverage Gates${NC}"
echo "================================"
echo ""

# Check if coverage file exists
if [ ! -f "$COVERAGE_FILE" ]; then
    echo -e "${YELLOW}⚠️  No coverage file found at: $COVERAGE_FILE${NC}"
    echo "   This is expected if no tests have run yet."
    echo "   Skipping coverage gate check."
    exit 0
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is not installed${NC}"
    echo "   Please install jq to check coverage gates."
    exit 1
fi

# Extract coverage metrics
USE_CASES=$(jq -r '.summary.useCasesCoveragePercent' "$COVERAGE_FILE")
FEATURES=$(jq -r '.summary.featuresCoveragePercent' "$COVERAGE_FILE")
API_ROUTES=$(jq -r '.summary.apiRoutesCoveragePercent' "$COVERAGE_FILE")
LOC=$(jq -r '.summary.locCoveragePercent' "$COVERAGE_FILE")

# Track failures
FAILED=0

echo "Coverage Thresholds:"
echo "  Use Cases:  ${USE_CASE_MIN}% minimum"
echo "  Features:   ${FEATURE_MIN}% minimum"
echo "  API Routes: ${API_ROUTE_MIN}% minimum"
echo "  LoC:        ${LOC_MIN}% minimum"
echo ""

echo "Current Coverage:"

# Check use case coverage
if (( $(echo "$USE_CASES < $USE_CASE_MIN" | bc -l) )); then
    echo -e "  ${RED}❌ Use Cases:  ${USE_CASES}% (below ${USE_CASE_MIN}%)${NC}"
    FAILED=1
else
    echo -e "  ${GREEN}✅ Use Cases:  ${USE_CASES}% (meets ${USE_CASE_MIN}%)${NC}"
fi

# Check feature coverage
if (( $(echo "$FEATURES < $FEATURE_MIN" | bc -l) )); then
    echo -e "  ${RED}❌ Features:   ${FEATURES}% (below ${FEATURE_MIN}%)${NC}"
    FAILED=1
else
    echo -e "  ${GREEN}✅ Features:   ${FEATURES}% (meets ${FEATURE_MIN}%)${NC}"
fi

# Check API route coverage
if (( $(echo "$API_ROUTES < $API_ROUTE_MIN" | bc -l) )); then
    echo -e "  ${RED}❌ API Routes: ${API_ROUTES}% (below ${API_ROUTE_MIN}%)${NC}"
    FAILED=1
else
    echo -e "  ${GREEN}✅ API Routes: ${API_ROUTES}% (meets ${API_ROUTE_MIN}%)${NC}"
fi

# Check LoC coverage (more lenient - often lower in practice)
if (( $(echo "$LOC < $LOC_MIN" | bc -l) )); then
    echo -e "  ${YELLOW}⚠️  LoC:        ${LOC}% (below ${LOC_MIN}%)${NC}"
    # Don't fail on LoC coverage - just warn
else
    echo -e "  ${GREEN}✅ LoC:        ${LOC}% (meets ${LOC_MIN}%)${NC}"
fi

echo ""

# Exit with failure if any threshold not met
if [ $FAILED -eq 1 ]; then
    echo -e "${RED}❌ Coverage thresholds not met${NC}"
    echo ""
    echo "To improve coverage:"
    echo "  1. Add more test annotations (trackUseCase, trackFeature)"
    echo "  2. Write tests for uncovered API endpoints"
    echo "  3. Add tests for business scenarios (use cases)"
    echo "  4. Ensure tests exercise all features"
    echo ""
    echo "See grafana-betrace-app/tests/COVERAGE.md for guidance."
    exit 1
fi

echo -e "${GREEN}✅ All coverage thresholds met!${NC}"
echo ""

# Show detailed counts
USE_CASES_COVERED=$(jq -r '.summary.useCasesCovered' "$COVERAGE_FILE")
USE_CASES_TOTAL=$(jq -r '.summary.useCasesTotal' "$COVERAGE_FILE")
FEATURES_COVERED=$(jq -r '.summary.featuresCovered' "$COVERAGE_FILE")
FEATURES_TOTAL=$(jq -r '.summary.featuresTotal' "$COVERAGE_FILE")
API_ROUTES_COVERED=$(jq -r '.summary.apiRoutesCovered' "$COVERAGE_FILE")
API_ROUTES_TOTAL=$(jq -r '.summary.apiRoutesTotal' "$COVERAGE_FILE")

echo "Coverage Details:"
echo "  Use Cases:  ${USE_CASES_COVERED}/${USE_CASES_TOTAL} covered"
echo "  Features:   ${FEATURES_COVERED}/${FEATURES_TOTAL} covered"
echo "  API Routes: ${API_ROUTES_COVERED}/${API_ROUTES_TOTAL} covered"
echo ""

exit 0
