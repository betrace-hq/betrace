{ pkgs, system, fluo-frontend, fluo-backend, dev-tools }:

let
  # Test result directories
  testResultDir = "/tmp/fluo-test-results";
  coverageDir = "${testResultDir}/coverage";
  reportsDir = "${testResultDir}/reports";

  # Coverage thresholds (configurable via env vars)
  instructionThreshold = 90;
  branchThreshold = 80;

  # Frontend test runner script
  frontendRunner = pkgs.writeShellScriptBin "frontend-test-runner" ''
    set -e

    echo "Testing Frontend (Vitest)..."
    cd bff

    # Ensure node_modules exist
    if [ ! -d "node_modules" ]; then
      echo "Installing dependencies..."
      npm install
    fi

    # Run tests with coverage
    mkdir -p ${testResultDir}/frontend
    npm run test -- \
      --reporter=json \
      --outputFile=${testResultDir}/frontend/results.json \
      --coverage \
      --coverage.reporter=json \
      --coverage.reporter=html \
      --coverage.reporter=text

    echo "Frontend tests completed"
  '';

  # Backend test runner script
  backendRunner = pkgs.writeShellScriptBin "backend-test-runner" ''
    set -e

    echo "Testing Backend (JUnit/Maven)..."
    cd backend

    # Run tests with JaCoCo coverage
    mkdir -p ${testResultDir}/backend
    export JAVA_HOME=${pkgs.openjdk21}
    ${pkgs.maven}/bin/mvn test \
      -Djacoco.skip=false

    # Copy reports
    cp -r target/surefire-reports ${testResultDir}/backend/ 2>/dev/null || true
    cp -r target/site/jacoco ${testResultDir}/backend/coverage 2>/dev/null || true

    echo "Backend tests completed"
  '';

  # Coverage parser - extracts metrics from reports
  coverageParser = pkgs.writeShellScriptBin "coverage-parser" ''
    #!/usr/bin/env bash
    set -e

    # Parse backend JaCoCo XML
    parse_backend_coverage() {
      if [ -f "${testResultDir}/backend/coverage/jacoco.xml" ]; then
        ${pkgs.xmlstarlet}/bin/xmlstarlet sel -t \
          -v "sum(//counter[@type='INSTRUCTION']/@covered)" -n \
          -v "sum(//counter[@type='INSTRUCTION']/@missed)" -n \
          -v "sum(//counter[@type='BRANCH']/@covered)" -n \
          -v "sum(//counter[@type='BRANCH']/@missed)" -n \
          "${testResultDir}/backend/coverage/jacoco.xml" | \
        awk 'NR==1 {inst_cov=$1} NR==2 {inst_miss=$1} NR==3 {branch_cov=$1} NR==4 {branch_miss=$1} END {
          inst_total = inst_cov + inst_miss
          branch_total = branch_cov + branch_miss
          inst_pct = (inst_total > 0) ? (inst_cov / inst_total * 100) : 0
          branch_pct = (branch_total > 0) ? (branch_cov / branch_total * 100) : 0
          printf "{\"instruction\":%.2f,\"branch\":%.2f}\n", inst_pct, branch_pct
        }'
      else
        echo '{"instruction":0,"branch":0}'
      fi
    }

    # Parse frontend Istanbul/c8 JSON
    parse_frontend_coverage() {
      if [ -f "bff/coverage/coverage-summary.json" ]; then
        ${pkgs.jq}/bin/jq '.total | {
          instruction: .statements.pct,
          branch: .branches.pct
        }' bff/coverage/coverage-summary.json
      else
        echo '{"instruction":0,"branch":0}'
      fi
    }

    # Combine coverage data
    mkdir -p ${coverageDir}

    BACKEND_COV=$(parse_backend_coverage)
    FRONTEND_COV=$(parse_frontend_coverage)

    # Calculate weighted average (can adjust weights based on codebase size)
    ${pkgs.jq}/bin/jq -n \
      --argjson backend "$BACKEND_COV" \
      --argjson frontend "$FRONTEND_COV" \
      '{
        backend: $backend,
        frontend: $frontend,
        overall: {
          instruction: (($backend.instruction + $frontend.instruction) / 2),
          branch: (($backend.branch + $frontend.branch) / 2)
        }
      }' > ${coverageDir}/summary.json

    cat ${coverageDir}/summary.json
  '';

  # Test results parser - aggregates pass/fail counts
  resultsParser = pkgs.writeShellScriptBin "results-parser" ''
    #!/usr/bin/env bash
    set -e

    # Parse frontend Vitest JSON results
    parse_frontend_results() {
      if [ -f "${testResultDir}/frontend/results.json" ]; then
        ${pkgs.jq}/bin/jq '{
          total: (.numTotalTests // 0),
          passed: (.numPassedTests // 0),
          failed: (.numFailedTests // 0),
          skipped: (.numPendingTests // 0)
        }' "${testResultDir}/frontend/results.json"
      else
        echo '{"total":0,"passed":0,"failed":0,"skipped":0}'
      fi
    }

    # Parse backend Surefire XML reports
    parse_backend_results() {
      if [ -d "${testResultDir}/backend/surefire-reports" ]; then
        find "${testResultDir}/backend/surefire-reports" -name "TEST-*.xml" -type f | \
        ${pkgs.xmlstarlet}/bin/xmlstarlet sel -t \
          -v "sum(//testsuite/@tests)" -n \
          -v "sum(//testsuite/@failures)" -n \
          -v "sum(//testsuite/@errors)" -n \
          -v "sum(//testsuite/@skipped)" -n \
          /dev/stdin 2>/dev/null | \
        awk 'NR==1 {total=$1} NR==2 {fail=$1} NR==3 {err=$1} NR==4 {skip=$1} END {
          failed = fail + err
          passed = total - failed - skip
          printf "{\"total\":%d,\"passed\":%d,\"failed\":%d,\"skipped\":%d}\n", total, passed, failed, skip
        }'
      else
        echo '{"total":0,"passed":0,"failed":0,"skipped":0}'
      fi
    }

    mkdir -p ${reportsDir}

    FRONTEND_RESULTS=$(parse_frontend_results)
    BACKEND_RESULTS=$(parse_backend_results)

    ${pkgs.jq}/bin/jq -n \
      --argjson frontend "$FRONTEND_RESULTS" \
      --argjson backend "$BACKEND_RESULTS" \
      '{
        frontend: $frontend,
        backend: $backend,
        overall: {
          total: ($frontend.total + $backend.total),
          passed: ($frontend.passed + $backend.passed),
          failed: ($frontend.failed + $backend.failed),
          skipped: ($frontend.skipped + $backend.skipped)
        }
      }' > ${reportsDir}/summary.json

    cat ${reportsDir}/summary.json
  '';

  # TUI renderer using gum
  tuiRenderer = pkgs.writeShellScriptBin "test-tui" ''
    #!/usr/bin/env bash
    set -e

    # Colors and styling
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color

    # Clear screen and show header
    clear
    ${pkgs.gum}/bin/gum style \
      --border double \
      --border-foreground 212 \
      --padding "1 2" \
      --width 80 \
      "FLUO Test Runner" \
      "Real-time Testing & Coverage Monitoring"

    echo ""

    # Function to display test results
    display_results() {
      local results_file="$1"

      if [ ! -f "$results_file" ]; then
        ${pkgs.gum}/bin/gum style --foreground 208 "Waiting for test results..."
        return
      fi

      local frontend_total=$(${pkgs.jq}/bin/jq -r '.frontend.total' "$results_file")
      local frontend_passed=$(${pkgs.jq}/bin/jq -r '.frontend.passed' "$results_file")
      local frontend_failed=$(${pkgs.jq}/bin/jq -r '.frontend.failed' "$results_file")

      local backend_total=$(${pkgs.jq}/bin/jq -r '.backend.total' "$results_file")
      local backend_passed=$(${pkgs.jq}/bin/jq -r '.backend.passed' "$results_file")
      local backend_failed=$(${pkgs.jq}/bin/jq -r '.backend.failed' "$results_file")

      # Frontend results
      if [ "$frontend_total" -gt 0 ]; then
        local frontend_pct=$(awk "BEGIN {printf \"%.1f\", ($frontend_passed/$frontend_total)*100}")
        if [ "$frontend_failed" -eq 0 ]; then
          echo -e "''${GREEN}Frontend: $frontend_passed/$frontend_total tests passed ($frontend_pct%)''${NC}"
        else
          echo -e "''${RED}Frontend: $frontend_passed/$frontend_total tests passed, $frontend_failed failed''${NC}"
        fi
      fi

      # Backend results
      if [ "$backend_total" -gt 0 ]; then
        local backend_pct=$(awk "BEGIN {printf \"%.1f\", ($backend_passed/$backend_total)*100}")
        if [ "$backend_failed" -eq 0 ]; then
          echo -e "''${GREEN}Backend:  $backend_passed/$backend_total tests passed ($backend_pct%)''${NC}"
        else
          echo -e "''${RED}Backend:  $backend_passed/$backend_total tests passed, $backend_failed failed''${NC}"
        fi
      fi
    }

    # Function to display coverage
    display_coverage() {
      local coverage_file="$1"

      if [ ! -f "$coverage_file" ]; then
        ${pkgs.gum}/bin/gum style --foreground 208 "Waiting for coverage data..."
        return
      fi

      local inst_cov=$(${pkgs.jq}/bin/jq -r '.overall.instruction' "$coverage_file")
      local branch_cov=$(${pkgs.jq}/bin/jq -r '.overall.branch' "$coverage_file")

      echo ""
      ${pkgs.gum}/bin/gum style --bold "Code Coverage"
      echo ""

      # Instruction coverage bar
      local inst_threshold=${toString instructionThreshold}
      local inst_color=""
      if (( $(echo "$inst_cov >= $inst_threshold" | ${pkgs.bc}/bin/bc -l) )); then
        inst_color="--foreground 10"  # Green
      elif (( $(echo "$inst_cov >= 80" | ${pkgs.bc}/bin/bc -l) )); then
        inst_color="--foreground 11"  # Yellow
      else
        inst_color="--foreground 9"   # Red
      fi

      printf "Instruction: %.1f%% " "$inst_cov"
      ${pkgs.gum}/bin/gum style $inst_color "$(printf '█%.0s' $(seq 1 $(echo "$inst_cov/2" | ${pkgs.bc}/bin/bc)))"
      echo " (target: $inst_threshold%)"

      # Branch coverage bar
      local branch_threshold=${toString branchThreshold}
      local branch_color=""
      if (( $(echo "$branch_cov >= $branch_threshold" | ${pkgs.bc}/bin/bc -l) )); then
        branch_color="--foreground 10"  # Green
      elif (( $(echo "$branch_cov >= 70" | ${pkgs.bc}/bin/bc -l) )); then
        branch_color="--foreground 11"  # Yellow
      else
        branch_color="--foreground 9"   # Red
      fi

      printf "Branch:      %.1f%% " "$branch_cov"
      ${pkgs.gum}/bin/gum style $branch_color "$(printf '█%.0s' $(seq 1 $(echo "$branch_cov/2" | ${pkgs.bc}/bin/bc)))"
      echo " (target: $branch_threshold%)"
    }

    # Display results
    if [ -f "${reportsDir}/summary.json" ]; then
      display_results "${reportsDir}/summary.json"
    fi

    # Display coverage
    if [ -f "${coverageDir}/summary.json" ]; then
      display_coverage "${coverageDir}/summary.json"
    fi

    echo ""
    ${pkgs.gum}/bin/gum style --foreground 240 "Reports: ${testResultDir}"
  '';

  # Watch mode script
  testWatch = pkgs.writeShellScriptBin "test-watch" ''
    #!/usr/bin/env bash
    # Don't use set -e so watch mode continues even if tests fail

    echo "Starting FLUO Test Watch Mode..."
    echo ""

    # Initial test run (ignore exit code)
    ${testRunner}/bin/test-runner || true

    # Setup file watcher
    ${pkgs.fswatch}/bin/fswatch -o \
      bff/src \
      backend/src \
      --exclude '.*\.log$' \
      --exclude '.*node_modules.*' \
      --exclude '.*target.*' \
      --exclude '.*\.git.*' | \
    while read change; do
      echo ""
      echo "Changes detected, re-running tests..."
      ${testRunner}/bin/test-runner || true
    done
  '';

  # Coverage threshold validator
  coverageValidator = pkgs.writeShellScriptBin "validate-coverage" ''
    #!/usr/bin/env bash
    set -e

    if [ ! -f "${coverageDir}/summary.json" ]; then
      echo "Coverage data not found. Run tests first."
      exit 1
    fi

    inst_cov=$(${pkgs.jq}/bin/jq -r '.overall.instruction' ${coverageDir}/summary.json)
    branch_cov=$(${pkgs.jq}/bin/jq -r '.overall.branch' ${coverageDir}/summary.json)

    inst_threshold=''${FLUO_COVERAGE_INSTRUCTION_MIN:-${toString instructionThreshold}}
    branch_threshold=''${FLUO_COVERAGE_BRANCH_MIN:-${toString branchThreshold}}

    failed=0

    if (( $(echo "$inst_cov < $inst_threshold" | ${pkgs.bc}/bin/bc -l) )); then
      echo "Instruction coverage $inst_cov% is below threshold $inst_threshold%"
      failed=1
    fi

    if (( $(echo "$branch_cov < $branch_threshold" | ${pkgs.bc}/bin/bc -l) )); then
      echo "Branch coverage $branch_cov% is below threshold $branch_threshold%"
      failed=1
    fi

    if [ $failed -eq 0 ]; then
      echo "Coverage thresholds met!"
      echo "   Instruction: $inst_cov% >= $inst_threshold%"
      echo "   Branch: $branch_cov% >= $branch_threshold%"
    fi

    exit $failed
  '';

  # HTML report server
  reportServer = pkgs.writeShellScriptBin "serve-reports" ''
    #!/usr/bin/env bash
    set -e

    PORT=''${PORT:-12099}

    echo "Starting Test Reports Server..."
    echo "Frontend Coverage: http://localhost:$PORT/frontend/"
    echo "Backend Coverage:  http://localhost:$PORT/backend/"
    echo ""

    # Create index page
    cat > ${testResultDir}/index.html <<EOF
    <!DOCTYPE html>
    <html>
    <head>
      <title>FLUO Test Reports</title>
      <style>
        body { font-family: system-ui; max-width: 800px; margin: 50px auto; }
        h1 { color: #333; }
        .card { border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 8px; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>FLUO Test Reports</h1>
      <div class="card">
        <h2>Coverage Reports</h2>
        <p><a href="/frontend/coverage/lcov-report/index.html">Frontend Coverage (Istanbul)</a></p>
        <p><a href="/backend/coverage/index.html">Backend Coverage (JaCoCo)</a></p>
      </div>
      <div class="card">
        <h2>Test Results</h2>
        <p><a href="/reports/summary.json">Overall Summary (JSON)</a></p>
        <p><a href="/coverage/summary.json">Coverage Summary (JSON)</a></p>
      </div>
    </body>
    </html>
    EOF

    # Serve with Caddy
    cd ${testResultDir}
    ${pkgs.caddy}/bin/caddy file-server --listen :$PORT --browse
  '';

  # Desktop notification helper with icons
  notifyUser = pkgs.writeShellScriptBin "notify-test-completion" ''
    #!/usr/bin/env bash

    RESULTS_FILE="$1"

    if [ ! -f "$RESULTS_FILE" ]; then
      exit 0
    fi

    total=$(${pkgs.jq}/bin/jq -r '.overall.total' "$RESULTS_FILE")
    passed=$(${pkgs.jq}/bin/jq -r '.overall.passed' "$RESULTS_FILE")
    failed=$(${pkgs.jq}/bin/jq -r '.overall.failed' "$RESULTS_FILE")

    # Get coverage data for subtitle
    coverage_file="${testResultDir}/coverage/summary.json"
    if [ -f "$coverage_file" ]; then
      inst_cov=$(${pkgs.jq}/bin/jq -r '.overall.instruction' "$coverage_file")
      coverage_text=$(printf "Coverage: %.0f%%" "$inst_cov")
    else
      coverage_text=""
    fi

    if [ "$failed" -eq 0 ] && [ "$total" -gt 0 ]; then
      # All tests passed - use green checkmark with sound
      TITLE="✅ FLUO Tests Passed"
      MESSAGE="All $total tests passed successfully!"

      # macOS notification with custom icon and sound
      osascript -e "display notification \"$MESSAGE\" with title \"$TITLE\" subtitle \"$coverage_text\" sound name \"Glass\"" 2>/dev/null || \
      ${pkgs.libnotify}/bin/notify-send -i dialog-information -u normal "$TITLE" "$MESSAGE\\n$coverage_text" 2>/dev/null || true
    elif [ "$total" -eq 0 ]; then
      # No tests found
      TITLE="⚠️  FLUO Tests"
      MESSAGE="No tests were executed"

      osascript -e "display notification \"$MESSAGE\" with title \"$TITLE\" sound name \"Basso\"" 2>/dev/null || \
      ${pkgs.libnotify}/bin/notify-send -i dialog-warning -u normal "$TITLE" "$MESSAGE" 2>/dev/null || true
    else
      # Tests failed - use red X with alert sound
      TITLE="❌ FLUO Tests Failed"
      MESSAGE="$failed of $total tests failed"
      pass_pct=$(awk "BEGIN {printf \"%.0f\", ($passed/$total)*100}")
      SUBTITLE="$passed passed ($pass_pct%)"

      osascript -e "display notification \"$MESSAGE\" with title \"$TITLE\" subtitle \"$SUBTITLE\" sound name \"Sosumi\"" 2>/dev/null || \
      ${pkgs.libnotify}/bin/notify-send -i dialog-error -u critical "$TITLE" "$MESSAGE\\n$SUBTITLE" 2>/dev/null || true
    fi
  '';

  # Test history tracker
  historyTracker = pkgs.writeShellScriptBin "track-test-history" ''
    #!/usr/bin/env bash
    set -e

    HISTORY_DIR="${testResultDir}/history"
    mkdir -p "$HISTORY_DIR"

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    # Save current results to history
    if [ -f "${reportsDir}/summary.json" ]; then
      cp "${reportsDir}/summary.json" "$HISTORY_DIR/$TIMESTAMP-results.json"
    fi

    if [ -f "${coverageDir}/summary.json" ]; then
      cp "${coverageDir}/summary.json" "$HISTORY_DIR/$TIMESTAMP-coverage.json"
    fi

    # Keep only last 50 runs
    cd "$HISTORY_DIR"
    ls -t *-results.json 2>/dev/null | tail -n +51 | xargs rm 2>/dev/null || true
    ls -t *-coverage.json 2>/dev/null | tail -n +51 | xargs rm 2>/dev/null || true

    # Generate trend report
    if [ $(ls -1 *-coverage.json 2>/dev/null | wc -l) -gt 1 ]; then
      ${pkgs.jq}/bin/jq -s 'map({
        timestamp: input_filename | split("/")[-1] | split("-")[0],
        instruction: .overall.instruction,
        branch: .overall.branch
      })' *-coverage.json > "${testResultDir}/coverage-trend.json"
    fi
  '';

  # Enhanced TUI with history
  enhancedTui = pkgs.writeShellScriptBin "enhanced-test-tui" ''
    #!/usr/bin/env bash
    set -e

    # First run the standard TUI
    ${tuiRenderer}/bin/test-tui

    # Show coverage trend if available
    if [ -f "${testResultDir}/coverage-trend.json" ]; then
      echo ""
      ${pkgs.gum}/bin/gum style --bold "Coverage Trend (Last 10 Runs)"

      ${pkgs.jq}/bin/jq -r '.[-10:] | .[] |
        "\(.timestamp): Instruction \(.instruction | tonumber | round)%, Branch \(.branch | tonumber | round)%"' \
        "${testResultDir}/coverage-trend.json" | tail -5
    fi

    echo ""
    ${pkgs.gum}/bin/gum style --foreground 240 "History: ${testResultDir}/history/"
  '';

  # Main test runner
  testRunner = pkgs.writeShellScriptBin "test-runner" ''
    #!/usr/bin/env bash
    set -e

    # Setup directories
    mkdir -p ${testResultDir} ${coverageDir} ${reportsDir}

    # Run tests in parallel
    echo "Running FLUO Test Suite..."
    echo ""

    # Run frontend tests
    (
      ${frontendRunner}/bin/frontend-test-runner 2>&1 | \
      while IFS= read -r line; do echo "[frontend] $line"; done
    ) &
    FRONTEND_PID=$!

    # Run backend tests
    (
      ${backendRunner}/bin/backend-test-runner 2>&1 | \
      while IFS= read -r line; do echo "[backend]  $line"; done
    ) &
    BACKEND_PID=$!

    # Wait for both to complete
    wait $FRONTEND_PID
    FRONTEND_EXIT=$?

    wait $BACKEND_PID
    BACKEND_EXIT=$?

    echo ""
    echo "Parsing test results..."
    ${resultsParser}/bin/results-parser > /dev/null

    echo "Parsing coverage data..."
    ${coverageParser}/bin/coverage-parser > /dev/null

    echo ""
    ${enhancedTui}/bin/enhanced-test-tui

    echo ""
    echo "Reports saved to: ${testResultDir}"
    echo ""

    # Track test history
    ${historyTracker}/bin/track-test-history

    # Send notification
    ${notifyUser}/bin/notify-test-completion ${reportsDir}/summary.json

    # Validate coverage thresholds
    ${coverageValidator}/bin/validate-coverage
    COVERAGE_EXIT=$?

    # Exit with failure if any component failed
    if [ $FRONTEND_EXIT -ne 0 ] || [ $BACKEND_EXIT -ne 0 ] || [ $COVERAGE_EXIT -ne 0 ]; then
      exit 1
    fi

    echo ""
    echo "All tests passed!"
  '';

  # Interactive Test TUI - use Go/Bubbletea implementation from dev-tools
  testOrchestrator = pkgs.writeShellScriptBin "test-orchestrator" ''
    #!/usr/bin/env bash
    set -e

    # Ensure test result directories exist
    mkdir -p ${testResultDir} ${reportsDir} ${coverageDir}

    # Run the Go TUI in a loop to handle watch mode
    while true; do
      # Clear any previous watch mode flag
      rm -f ${testResultDir}/.watch-mode-requested

      # Run the Go TUI from dev-tools
      ${dev-tools.packages.${system}.test-tui}/bin/test-tui

      # Check if watch mode was requested
      if [ -f ${testResultDir}/.watch-mode-requested ]; then
        rm -f ${testResultDir}/.watch-mode-requested
        # Exec into watch mode (replaces this process)
        exec ${testWatch}/bin/test-watch
      else
        # Normal exit, break the loop
        break
      fi
    done
  '';

in {
  # Main test runner (run once)
  test = testRunner;

  # Watch mode (continuous testing)
  test-watch = testWatch;

  # Coverage validator
  validate-coverage = coverageValidator;

  # Report server
  serve-reports = reportServer;

  # Full orchestrator with TUI
  test-orchestrator = testOrchestrator;

  # Individual runners (for debugging)
  frontend-test = frontendRunner;
  backend-test = backendRunner;

  # Parsers (for scripting)
  parse-coverage = coverageParser;
  parse-results = resultsParser;

  # TUI renderers
  tui = enhancedTui;
  simple-tui = tuiRenderer;

  # History and notifications
  track-history = historyTracker;
  notify = notifyUser;
}
