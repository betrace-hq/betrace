{ pkgs, lib, ... }:

# Test Runner - Nix-Managed Test Orchestration
#
# Creates test derivations with service dependencies as buildInputs.
# Services are started in setupPhase, tests run in checkPhase,
# services are stopped in postCheck.
#
# Usage:
#   nix build .#tests.grafana-e2e
#   nix build .#tests.all
#
# Benefits:
# - Declarative: Test dependencies declared in Nix
# - Lifecycle: Nix manages service start/stop/cleanup
# - Reproducible: Same service versions every run
# - Cacheable: Test results can be cached by Nix
# - Parallel: Nix can run independent test suites in parallel

let
  # Create a test derivation with service dependencies
  mkTestWithServices = {
    name,
    src,
    services ? [],
    setupServices ? "",
    testCommand,
    healthChecks ? [],
    timeoutSeconds ? 300,
  }: pkgs.stdenv.mkDerivation {
    inherit name src;

    # Service binaries available in PATH
    buildInputs = services ++ [
      pkgs.nodejs
      pkgs.playwright-driver.browsers
      pkgs.curl
      pkgs.netcat
      pkgs.procps
    ];

    # Don't strip binaries (we need service executables intact)
    dontStrip = true;

    # Setup phase - start services and wait for health
    setupPhase = ''
      echo "🔧 Starting services for test: ${name}"

      # Create runtime directories
      export TMPDIR=$(mktemp -d)
      export SERVICE_PIDS=$TMPDIR/service.pids
      export SERVICE_LOGS=$TMPDIR/logs
      mkdir -p $SERVICE_LOGS

      # Custom service setup
      ${setupServices}

      # Wait for services to be healthy
      echo "⏳ Waiting for services to become healthy..."
      ${lib.concatMapStringsSep "\n" (check: ''
        echo "  Checking: ${check.name}"
        MAX_ATTEMPTS=30
        ATTEMPT=0
        while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
          if ${check.command}; then
            echo "  ✅ ${check.name} is healthy"
            break
          fi
          ATTEMPT=$((ATTEMPT + 1))
          if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo "  ❌ ${check.name} failed to become healthy"
            cat $SERVICE_LOGS/* || true
            exit 1
          fi
          sleep 1
        done
      '') healthChecks}

      echo "✅ All services healthy, ready for tests"
    '';

    # Check phase - run tests
    checkPhase = ''
      echo "🧪 Running tests: ${name}"

      # Set timeout
      timeout ${toString timeoutSeconds} bash -c '${testCommand}' || {
        echo "❌ Tests failed or timed out"
        cat $SERVICE_LOGS/* || true
        exit 1
      }

      echo "✅ Tests passed"
    '';

    # Post-check - cleanup services
    postCheck = ''
      echo "🧹 Cleaning up services"

      if [ -f "$SERVICE_PIDS" ]; then
        while read pid; do
          kill $pid 2>/dev/null || true
        done < "$SERVICE_PIDS"
      fi

      # Kill any remaining processes
      pkill -P $$ || true

      rm -rf $TMPDIR
      echo "✅ Cleanup complete"
    '';

    # Output test results
    installPhase = ''
      mkdir -p $out
      echo "Test ${name} passed at $(date)" > $out/result

      # Copy test artifacts if they exist
      if [ -d "playwright-report" ]; then
        cp -r playwright-report $out/
      fi

      if [ -f "playwright-results.json" ]; then
        cp playwright-results.json $out/
      fi
    '';
  };

  # Health check helpers
  httpHealthCheck = { url, name ? url }: {
    inherit name;
    command = "curl -sf ${url} > /dev/null 2>&1";
  };

  tcpPortCheck = { port, host ? "localhost", name ? "port-${toString port}" }: {
    inherit name;
    command = "nc -z ${host} ${toString port} 2>/dev/null";
  };

in {
  inherit mkTestWithServices httpHealthCheck tcpPortCheck;

  # Example: Grafana E2E tests with dependencies
  grafanaE2ETests = mkTestWithServices {
    name = "betrace-grafana-e2e-tests";
    src = ../grafana-betrace-app;

    # Service dependencies (from flake packages)
    services = [
      # These would be your service packages from flake.nix
      # For now, using system services via setupServices
    ];

    # Start services before tests
    setupServices = ''
      # Start Grafana
      echo "Starting Grafana on port 12015..."
      grafana-server \
        --config=${../grafana-betrace-app/grafana.ini} \
        --homepath=${pkgs.grafana} \
        > $SERVICE_LOGS/grafana.log 2>&1 &
      echo $! >> $SERVICE_PIDS

      # Start Backend
      echo "Starting Backend on port 12011..."
      ${../backend}/bin/betrace-backend \
        --port=12011 \
        > $SERVICE_LOGS/backend.log 2>&1 &
      echo $! >> $SERVICE_PIDS

      # Start Tempo
      echo "Starting Tempo on port 3200..."
      tempo \
        --config.file=${../tempo-config.yaml} \
        > $SERVICE_LOGS/tempo.log 2>&1 &
      echo $! >> $SERVICE_PIDS
    '';

    # Health checks for services
    healthChecks = [
      (httpHealthCheck { url = "http://localhost:12015/api/health"; name = "grafana"; })
      (httpHealthCheck { url = "http://localhost:12011/health"; name = "backend"; })
      (httpHealthCheck { url = "http://localhost:3200/ready"; name = "tempo"; })
    ];

    # Run Playwright tests
    testCommand = ''
      cd $src
      npm ci
      npx playwright test --reporter=list
    '';

    timeoutSeconds = 300;
  };

  # Fast unit tests (no service dependencies)
  unitTests = mkTestWithServices {
    name = "betrace-unit-tests";
    src = ../grafana-betrace-app;

    services = []; # No service dependencies

    setupServices = ''
      echo "No services needed for unit tests"
    '';

    healthChecks = [];

    testCommand = ''
      cd $src
      npm ci
      npm run test:unit
    '';

    timeoutSeconds = 60;
  };

  # Integration tests with Backend only
  backendIntegrationTests = mkTestWithServices {
    name = "betrace-backend-integration-tests";
    src = ../grafana-betrace-app;

    setupServices = ''
      echo "Starting Backend on port 12011..."
      ${../backend}/bin/betrace-backend \
        --port=12011 \
        > $SERVICE_LOGS/backend.log 2>&1 &
      echo $! >> $SERVICE_PIDS
    '';

    healthChecks = [
      (httpHealthCheck { url = "http://localhost:12011/health"; name = "backend"; })
    ];

    testCommand = ''
      cd $src
      npm ci
      npx playwright test --grep "@requires-backend" --reporter=list
    '';

    timeoutSeconds = 120;
  };

  # All tests (runs all test suites)
  allTests = pkgs.runCommand "betrace-all-tests" {
    buildInputs = [
      grafanaE2ETests
      unitTests
      backendIntegrationTests
    ];
  } ''
    echo "All tests passed!" > $out
  '';
}
