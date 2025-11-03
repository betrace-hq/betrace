#!/bin/bash
# BeTrace Load Testing Script
#
# Tests end-to-end trace flow: Alloy → Backend → Tempo
# Generates realistic trace patterns with violations

set -e

# Configuration
ALLOY_OTLP_ENDPOINT="${ALLOY_OTLP_ENDPOINT:-http://localhost:4318}"
BACKEND_API="${BACKEND_API:-http://localhost:12011}"
DURATION_SECONDS="${DURATION_SECONDS:-60}"
SPANS_PER_SECOND="${SPANS_PER_SECOND:-100}"
VIOLATION_RATE="${VIOLATION_RATE:-0.1}"  # 10% of traces violate rules

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
  echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
  echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1"
}

warn() {
  echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARN:${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  log "Checking prerequisites..."

  # Check if services are running
  if ! curl -s "${BACKEND_API}/health" > /dev/null; then
    error "BeTrace backend not reachable at ${BACKEND_API}"
    error "Start with: flox services start backend"
    exit 1
  fi

  if ! curl -s "${ALLOY_OTLP_ENDPOINT}/v1/traces" -X POST -d '{}' 2>/dev/null; then
    error "Alloy OTLP endpoint not reachable at ${ALLOY_OTLP_ENDPOINT}"
    error "Start with: flox services start alloy"
    exit 1
  fi

  log "✓ Backend is healthy"
  log "✓ Alloy OTLP endpoint is reachable"
}

# Create test rules
create_test_rules() {
  log "Creating test rules..."

  # Rule 1: Slow requests (>500ms)
  curl -s -X POST "${BACKEND_API}/v1/rules" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "load-test-slow-requests",
      "description": "Detects requests slower than 500ms",
      "expression": "span.duration > 500000000",
      "enabled": true,
      "severity": "HIGH",
      "tags": ["load-test", "performance"]
    }' > /dev/null || warn "Rule 'load-test-slow-requests' may already exist"

  # Rule 2: Error status
  curl -s -X POST "${BACKEND_API}/v1/rules" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "load-test-errors",
      "description": "Detects error status codes",
      "expression": "span.status == \"error\"",
      "enabled": true,
      "severity": "CRITICAL",
      "tags": ["load-test", "errors"]
    }' > /dev/null || warn "Rule 'load-test-errors' may already exist"

  # Rule 3: Missing authentication
  curl -s -X POST "${BACKEND_API}/v1/rules" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "load-test-missing-auth",
      "description": "Detects API calls without auth token",
      "expression": "span.attributes[\"http.route\"] and not span.attributes[\"auth.token\"]",
      "enabled": true,
      "severity": "HIGH",
      "tags": ["load-test", "security"]
    }' > /dev/null || warn "Rule 'load-test-missing-auth' may already exist"

  log "✓ Test rules created"
}

# Generate OTLP trace JSON
generate_trace() {
  local trace_id="$1"
  local should_violate="$2"
  local duration_ms="${3:-100}"
  local status="${4:-ok}"

  local now_ns=$(date +%s%N)
  local start_ns=$now_ns
  local end_ns=$((start_ns + duration_ms * 1000000))

  # Generate span attributes
  local attributes='{"http.method":"POST","http.route":"/api/users","http.status_code":"200"}'

  if [ "$should_violate" = "auth" ]; then
    # Missing auth token (violates load-test-missing-auth)
    attributes='{"http.method":"POST","http.route":"/api/users"}'
  fi

  cat <<EOF
{
  "resourceSpans": [{
    "resource": {
      "attributes": [{
        "key": "service.name",
        "value": {"stringValue": "load-test-service"}
      }]
    },
    "scopeSpans": [{
      "spans": [{
        "traceId": "${trace_id}",
        "spanId": "$(openssl rand -hex 8)",
        "name": "api.request",
        "kind": 2,
        "startTimeUnixNano": "${start_ns}",
        "endTimeUnixNano": "${end_ns}",
        "status": {
          "code": "$([ "$status" = "error" ] && echo 2 || echo 0)"
        },
        "attributes": $(echo "$attributes" | jq -c 'to_entries | map({key: .key, value: {stringValue: .value}})')
      }]
    }]
  }]
}
EOF
}

# Send traces to Alloy OTLP endpoint
send_trace() {
  local trace_id="$1"
  local should_violate="$2"

  # Determine trace characteristics
  local duration=100
  local status="ok"

  if [ "$should_violate" = "slow" ]; then
    duration=600  # 600ms (violates load-test-slow-requests)
  elif [ "$should_violate" = "error" ]; then
    status="error"  # Violates load-test-errors
  fi

  local trace_json=$(generate_trace "$trace_id" "$should_violate" "$duration" "$status")

  curl -s -X POST "${ALLOY_OTLP_ENDPOINT}/v1/traces" \
    -H "Content-Type: application/json" \
    -d "$trace_json" > /dev/null
}

# Main load test loop
run_load_test() {
  log "Starting load test..."
  log "Duration: ${DURATION_SECONDS}s"
  log "Target: ${SPANS_PER_SECOND} spans/sec"
  log "Violation rate: ${VIOLATION_RATE} (${VIOLATION_RATE}%)"

  local end_time=$(($(date +%s) + DURATION_SECONDS))
  local total_spans=0
  local violation_spans=0

  while [ $(date +%s) -lt $end_time ]; do
    # Send batch of spans
    for i in $(seq 1 $SPANS_PER_SECOND); do
      local trace_id=$(openssl rand -hex 16)

      # Randomly introduce violations
      local rand=$(awk -v seed=$RANDOM 'BEGIN {srand(seed); print rand()}')
      local should_violate="none"

      if awk "BEGIN {exit !($rand < $VIOLATION_RATE)}"; then
        # Pick violation type
        local viol_rand=$(awk -v seed=$RANDOM 'BEGIN {srand(seed); print int(rand() * 3)}')
        case $viol_rand in
          0) should_violate="slow" ;;
          1) should_violate="error" ;;
          2) should_violate="auth" ;;
        esac
        ((violation_spans++))
      fi

      send_trace "$trace_id" "$should_violate" &
      ((total_spans++))
    done

    # Wait 1 second
    sleep 1

    # Progress indicator
    local elapsed=$(($(date +%s) - (end_time - DURATION_SECONDS)))
    log "Progress: ${elapsed}s / ${DURATION_SECONDS}s | Spans: ${total_spans} | Expected violations: ${violation_spans}"
  done

  # Wait for background jobs
  wait

  log "✓ Load test complete"
  log "Total spans sent: ${total_spans}"
  log "Expected violations: ${violation_spans}"
}

# Verify violations were detected
verify_violations() {
  log "Waiting 10s for span processing..."
  sleep 10

  log "Querying violations..."

  # Get violations from last 5 minutes
  local start_time=$(($(date +%s) - 300))
  local violations=$(curl -s "${BACKEND_API}/v1/violations?start_time=${start_time}" | jq '.violations | length')

  log "Violations detected: ${violations}"

  if [ "$violations" -gt 0 ]; then
    log "✓ Violations successfully detected!"

    # Show breakdown by rule
    curl -s "${BACKEND_API}/v1/violations?start_time=${start_time}" | \
      jq -r '.violations | group_by(.rule_name) | map({rule: .[0].rule_name, count: length}) | .[] | "\(.rule): \(.count)"' | \
      while read line; do
        log "  - $line"
      done
  else
    error "No violations detected! Expected at least some violations."
    exit 1
  fi
}

# Cleanup test rules
cleanup() {
  log "Cleaning up test rules..."

  curl -s -X DELETE "${BACKEND_API}/v1/rules/load-test-slow-requests" > /dev/null || true
  curl -s -X DELETE "${BACKEND_API}/v1/rules/load-test-errors" > /dev/null || true
  curl -s -X DELETE "${BACKEND_API}/v1/rules/load-test-missing-auth" > /dev/null || true

  log "✓ Cleanup complete"
}

# Main execution
main() {
  log "=== BeTrace Load Test ==="

  check_prerequisites
  create_test_rules

  # Trap cleanup on exit
  trap cleanup EXIT

  run_load_test
  verify_violations

  log "=== Load Test Successful ==="
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  main "$@"
fi
