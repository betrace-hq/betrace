{ pkgs, lib, nodejs, playwright-driver }:

# Playwright Test Runner with Service Orchestration
#
# Creates a test runner that:
# 1. Starts required services (Grafana, Backend, etc.)
# 2. Waits for health checks
# 3. Runs Playwright tests
# 4. Cleans up services
#
# Usage:
#   nix run .#test-grafana-e2e
#   nix run .#test-all

let
  # Helper to create a test script with service management
  mkPlaywrightTest = {
    name,
    workDir,
    testPattern ? "**/*.spec.ts",
    services ? {}, # { serviceName = { command, healthCheck, port } }
    env ? {},
  }:
    pkgs.writeShellScriptBin "playwright-test-${name}" ''
      set -euo pipefail

      echo "🧪 Playwright Test Runner: ${name}"
      echo "================================"

      # Create temp directory for service management (in /tmp for write access)
      RUNTIME_DIR=$(mktemp -d /tmp/betrace-test-XXXXXX)
      SERVICE_PIDS="$RUNTIME_DIR/pids"
      SERVICE_LOGS="$RUNTIME_DIR/logs"
      mkdir -p "$SERVICE_LOGS"

      # Create backend data directory in temp
      BACKEND_DATA_DIR="$RUNTIME_DIR/backend-data"
      mkdir -p "$BACKEND_DATA_DIR"

      # Cleanup function
      cleanup() {
        echo ""
        echo "🧹 Cleaning up services..."
        if [ -f "$SERVICE_PIDS" ]; then
          while IFS= read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
              kill "$pid" 2>/dev/null || true
              echo "  Stopped PID $pid"
            fi
          done < "$SERVICE_PIDS"
        fi
        rm -rf "$RUNTIME_DIR"
        echo "✅ Cleanup complete"
      }

      # Set trap for cleanup on exit
      trap cleanup EXIT INT TERM

      # Export environment variables
      export SKIP_GLOBAL_SETUP=1  # Services managed by Nix orchestration
      ${lib.concatStringsSep "\n" (lib.mapAttrsToList (k: v: "export ${k}=${v}") env)}

      # Start services
      echo ""
      echo "🚀 Starting services..."
      ${lib.concatStringsSep "\n" (lib.mapAttrsToList (name: cfg: ''
        echo "  Starting ${name}..."
        ${cfg.command} > "$SERVICE_LOGS/${name}.log" 2>&1 &
        echo $! >> "$SERVICE_PIDS"
        echo "    PID: $!"
      '') services)}

      # Wait for services to be healthy
      echo ""
      echo "⏳ Waiting for services to become healthy..."
      ${lib.concatStringsSep "\n" (lib.mapAttrsToList (name: cfg: ''
        echo "  Checking ${name}..."
        MAX_ATTEMPTS=30
        ATTEMPT=0
        while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
          if ${cfg.healthCheck}; then
            echo "    ✅ ${name} is healthy"
            break
          fi
          ATTEMPT=$((ATTEMPT + 1))
          if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo "    ❌ ${name} failed health check after 30 attempts"
            echo "    📋 Service logs:"
            tail -50 "$SERVICE_LOGS/${name}.log"
            exit 1
          fi
          sleep 1
        done
      '') services)}

      # Run Playwright tests
      echo ""
      echo "🎭 Running Playwright tests..."

      # Run tests from current directory (assume deps already installed)
      # User must run from grafana-betrace-app directory with node_modules present
      ${nodejs}/bin/npx playwright test ${testPattern} --reporter=list || {
        echo ""
        echo "❌ Tests failed!"
        echo "📋 Service logs:"
        for log in "$SERVICE_LOGS"/*.log; do
          echo ""
          echo "=== $(basename $log) ==="
          tail -50 "$log"
        done
        exit 1
      }

      echo ""
      echo "✅ All tests passed!"
    '';

in {
  inherit mkPlaywrightTest;

  # Grafana E2E tests with full stack
  grafana-e2e = mkPlaywrightTest {
    name = "grafana-e2e";
    workDir = ../grafana-betrace-app;
    testPattern = "tests/e2e-*.spec.ts";

    services = {
      backend = {
        command = "cd ${../backend} && PORT=12011 BETRACE_DATA_DIR=$BACKEND_DATA_DIR ${pkgs.go}/bin/go run ./cmd/betrace-backend";
        healthCheck = "${pkgs.curl}/bin/curl -sf http://localhost:12011/v1/rules > /dev/null";
        port = 12011;
      };

      # Add other services as needed:
      # grafana = { ... };
      # tempo = { ... };
      # loki = { ... };
    };

    env = {
      BETRACE_PORT_BACKEND = "12011";
      BETRACE_PORT_GRAFANA = "12015";
      NODE_ENV = "test";
    };
  };

  # Backend-only integration tests (faster)
  backend-integration = mkPlaywrightTest {
    name = "backend-integration";
    workDir = ../grafana-betrace-app;
    testPattern = "tests/**/*backend*.spec.ts";

    services = {
      backend = {
        command = "cd ${../backend} && PORT=12011 BETRACE_DATA_DIR=$BACKEND_DATA_DIR ${pkgs.go}/bin/go run ./cmd/betrace-backend";
        healthCheck = "${pkgs.curl}/bin/curl -sf http://localhost:12011/v1/rules > /dev/null";
        port = 12011;
      };
    };

    env = {
      BETRACE_PORT_BACKEND = "12011";
    };
  };

  # Monaco editor tests (requires Grafana + Backend)
  monaco-tests = mkPlaywrightTest {
    name = "monaco";
    workDir = ../grafana-betrace-app;
    testPattern = "tests/e2e-rules.spec.ts --grep 'Monaco'";

    services = {
      backend = {
        command = "cd ${../backend} && PORT=12011 BETRACE_DATA_DIR=$BACKEND_DATA_DIR ${pkgs.go}/bin/go run ./cmd/betrace-backend";
        healthCheck = "${pkgs.curl}/bin/curl -sf http://localhost:12011/v1/rules > /dev/null";
        port = 12011;
      };

      grafana = {
        command = ''
          # Setup Grafana directories
          GRAFANA_DATA_DIR="$RUNTIME_DIR/grafana-data"
          GRAFANA_PLUGINS_DIR="$GRAFANA_DATA_DIR/plugins"
          GRAFANA_PROVISIONING_DIR="$GRAFANA_DATA_DIR/provisioning"
          mkdir -p "$GRAFANA_PLUGINS_DIR" "$GRAFANA_PROVISIONING_DIR/datasources"

          # Copy BeTrace plugin (assumes dist/ already built in working directory)
          # Must be run from project root where grafana-betrace-app/dist exists
          if [ ! -d "grafana-betrace-app/dist" ]; then
            echo "ERROR: grafana-betrace-app/dist not found."
            echo "Run from project root: cd /path/to/betrace && nix run .#test-monaco"
            echo "Or build plugin: cd grafana-betrace-app && npm run build"
            exit 1
          fi

          cp -r grafana-betrace-app/dist "$GRAFANA_PLUGINS_DIR/betrace-app"
          chmod -R u+w "$GRAFANA_PLUGINS_DIR/betrace-app"

          # Create datasources config
          cat > "$GRAFANA_PROVISIONING_DIR/datasources/datasources.yaml" <<'EOF'
          apiVersion: 1
          datasources:
            - name: Tempo
              type: tempo
              url: http://localhost:3200
              uid: tempo
          EOF

          # Create grafana.ini
          GRAFANA_CONFIG="$RUNTIME_DIR/grafana.ini"
          cat > "$GRAFANA_CONFIG" <<EOF
          [paths]
          data = $GRAFANA_DATA_DIR
          plugins = $GRAFANA_PLUGINS_DIR
          provisioning = $GRAFANA_PROVISIONING_DIR

          [server]
          http_port = 12015

          [log]
          mode = console
          level = warn

          [analytics]
          reporting_enabled = false

          [security]
          admin_user = admin
          admin_password = admin

          [auth.anonymous]
          enabled = true
          org_role = Admin

          [plugins]
          allow_loading_unsigned_plugins = betrace-app
          EOF

          # Run Grafana
          exec ${pkgs.grafana}/bin/grafana-server --homepath ${pkgs.grafana}/share/grafana --config "$GRAFANA_CONFIG"
        '';
        healthCheck = "${pkgs.curl}/bin/curl -sf http://localhost:12015/api/health > /dev/null";
        port = 12015;
      };
    };

    env = {
      BETRACE_PORT_BACKEND = "12011";
      BETRACE_PORT_GRAFANA = "12015";
    };
  };
}
