{ writeShellApplication, nodejs_20, go, jq, gum }:

writeShellApplication {
  name = "test-runner";
  runtimeInputs = [ nodejs_20 go jq gum ];

  text = ''
    #!/usr/bin/env bash
    set -e

    TEST_RESULTS_DIR="/tmp/fluo-test-results"
    mkdir -p "$TEST_RESULTS_DIR"/{frontend,backend,coverage}

    # Frontend tests (Vitest)
    run_frontend_tests() {
      gum spin --spinner dot --title "Running frontend tests..." -- bash -c '
        cd bff
        if [ ! -d "node_modules" ]; then
          npm install
        fi
        npm run test -- \
          --reporter=json \
          --outputFile=/tmp/fluo-test-results/frontend/results.json \
          --coverage \
          --coverage.reporter=json \
          --coverage.reporter=html
      '
      echo "✅ Frontend tests complete"
    }

    # Backend Go tests
    run_backend_tests() {
      gum spin --spinner dot --title "Running backend tests..." -- bash -c '
        cd backend
        go test -v -coverprofile=/tmp/fluo-test-results/backend/coverage.out ./...
        go tool cover -html=/tmp/fluo-test-results/backend/coverage.out \
          -o /tmp/fluo-test-results/backend/coverage.html
      '
      echo "✅ Backend tests complete"
    }

    # Parse and display results
    show_results() {
      echo ""
      gum style --border rounded --padding "1 2" --margin "1" \
        "$(gum style --bold 'Test Results')" \
        "" \
        "Frontend: $(jq -r '.numPassedTests // 0' /tmp/fluo-test-results/frontend/results.json 2>/dev/null || echo 0) passed" \
        "Backend:  $(grep -c PASS /tmp/fluo-test-results/backend/coverage.out 2>/dev/null || echo 0) passed" \
        "" \
        "Coverage reports: /tmp/fluo-test-results/"
    }

    case "''${1:-all}" in
      frontend)
        run_frontend_tests
        ;;
      backend)
        run_backend_tests
        ;;
      all|*)
        run_frontend_tests
        run_backend_tests
        show_results
        ;;
    esac
  '';
}
