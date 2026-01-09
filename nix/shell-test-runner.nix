{ pkgs, lib, nodejs, playwright-driver }:

let
  mkShellTest = {
    name,
    testPattern ? "**/*.spec.ts",
    needsBackend ? false,
    needsGrafana ? false,
    env ? {},
  }:
    pkgs.writeShellScriptBin "test-${name}" ''
      set -euo pipefail

      # Create temp directory for test runtime
      RUNTIME_DIR=$(mktemp -d /tmp/betrace-test-XXXXXX)
      SERVICE_PIDS=()

      # Cleanup function
      cleanup() {
        echo ""
        echo "🧹 Cleaning up services..."
        for pid in "''${SERVICE_PIDS[@]}"; do
          if kill -0 "$pid" 2>/dev/null; then
            echo "  Stopping PID $pid"
            kill "$pid" 2>/dev/null || true
          fi
        done
        rm -rf "$RUNTIME_DIR"
        echo "✅ Cleanup complete"
      }

      # Set trap for cleanup on exit
      trap cleanup EXIT INT TERM

      echo "🧪 Shell Test Runner: ${name}"
      echo "================================"
      echo "📂 Working directory: $PWD"
      echo ""

      # Save original directory
      ORIGINAL_PWD="$PWD"

      # Find available ports dynamically to avoid conflicts
      find_free_port() {
        python3 -c 'import socket; s=socket.socket(); s.bind(("", 0)); print(s.getsockname()[1]); s.close()'
      }

      ${if needsBackend then ''
        export BETRACE_PORT_BACKEND=$(find_free_port)
        echo "📡 Backend will use port: $BETRACE_PORT_BACKEND"
        export BETRACE_PORT_BACKEND_GRPC=$(find_free_port)
        echo "📡 Backend gRPC will use port: $BETRACE_PORT_BACKEND_GRPC"
      '' else ""}

      ${if needsGrafana then ''
        export BETRACE_PORT_GRAFANA=$(find_free_port)
        echo "📡 Grafana will use port: $BETRACE_PORT_GRAFANA"
      '' else ""}

      # Export other environment variables
      export SKIP_GLOBAL_SETUP=1  # Skip Playwright global setup
      ${lib.concatStringsSep "\n" (lib.mapAttrsToList (k: v:
        if k == "BETRACE_PORT_BACKEND" || k == "BETRACE_PORT_GRAFANA"
        then "# ${k} set dynamically above"
        else "export ${k}=${v}"
      ) env)}

      ${if needsBackend then ''
        # Setup backend
        export BACKEND_DATA_DIR="$RUNTIME_DIR/backend-data"
        mkdir -p "$BACKEND_DATA_DIR"

        echo "🚀 Starting backend..."
        (
          # Use ORIGINAL_PWD to get the checkout's source code, not the Nix store copy
          cd "$ORIGINAL_PWD/backend"
          PORT=$BETRACE_PORT_BACKEND \
          BETRACE_PORT_GRPC=$BETRACE_PORT_BACKEND_GRPC \
          BETRACE_DATA_DIR=$BACKEND_DATA_DIR \
            ${pkgs.go}/bin/go run ./cmd/betrace-backend > "$RUNTIME_DIR/backend.log" 2>&1 &
          echo $! > "$RUNTIME_DIR/backend.pid"
        )
        BACKEND_PID=$(cat "$RUNTIME_DIR/backend.pid")
        SERVICE_PIDS+=($BACKEND_PID)
        echo "  PID: $BACKEND_PID"

        # Wait for backend health
        echo "⏳ Waiting for backend..."
        for i in {1..30}; do
          if ${pkgs.curl}/bin/curl -sf http://localhost:$BETRACE_PORT_BACKEND/health > /dev/null 2>&1; then
            echo "  ✅ Backend is healthy (http://localhost:$BETRACE_PORT_BACKEND)"
            break
          fi
          if [ $i -eq 30 ]; then
            echo "  ❌ Backend failed to become healthy"
            echo "📋 Backend logs:"
            tail -50 "$RUNTIME_DIR/backend.log"
            exit 1
          fi
          sleep 1
        done
      '' else ""}

      ${if needsGrafana then ''
        # Setup Grafana
        export GRAFANA_DATA_DIR="$RUNTIME_DIR/grafana-data"
        export GRAFANA_PLUGINS_DIR="$GRAFANA_DATA_DIR/plugins"
        export GRAFANA_PROVISIONING_DIR="$GRAFANA_DATA_DIR/provisioning"
        mkdir -p "$GRAFANA_PLUGINS_DIR" "$GRAFANA_PROVISIONING_DIR/datasources" "$GRAFANA_PROVISIONING_DIR/plugins"

        # Copy BeTrace plugin from working directory
        # Tests must be run from project root where dist/ exists
        if [ ! -d "$ORIGINAL_PWD/grafana-betrace-app/dist" ]; then
          echo "ERROR: grafana-betrace-app/dist not found"
          echo "Working directory: $ORIGINAL_PWD"
          echo "Run from project root: cd /path/to/betrace && nix run .#test-monaco"
          echo "Or build plugin first: cd grafana-betrace-app && npm run build"
          exit 1
        fi
        cp -r "$ORIGINAL_PWD/grafana-betrace-app/dist" "$GRAFANA_PLUGINS_DIR/betrace-app"
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

        # Create plugins provisioning to enable betrace-app
        cat > "$GRAFANA_PROVISIONING_DIR/plugins/plugins.yaml" <<'EOF'
apiVersion: 1
apps:
  - type: betrace-app
    org_id: 1
    disabled: false
EOF

        # Create grafana.ini
        export GRAFANA_CONFIG="$RUNTIME_DIR/grafana.ini"
        cat > "$GRAFANA_CONFIG" <<EOF
[paths]
data = $GRAFANA_DATA_DIR
plugins = $GRAFANA_PLUGINS_DIR
provisioning = $GRAFANA_DATA_DIR/provisioning

[server]
http_port = $BETRACE_PORT_GRAFANA

[log]
mode = console
level = warn

[analytics]
reporting_enabled = false

[security]
admin_user = admin
admin_password = admin
disable_initial_admin_creation = false

[auth.anonymous]
enabled = true
org_role = Admin

[plugins]
allow_loading_unsigned_plugins = betrace-app
EOF

        echo "🚀 Starting Grafana..."
        ${pkgs.grafana}/bin/grafana-server \
          --homepath ${pkgs.grafana}/share/grafana \
          --config "$GRAFANA_CONFIG" \
          > "$RUNTIME_DIR/grafana.log" 2>&1 &
        GRAFANA_PID=$!
        SERVICE_PIDS+=($GRAFANA_PID)
        echo "  PID: $GRAFANA_PID"

        # Wait for Grafana health
        echo "⏳ Waiting for Grafana..."
        for i in {1..30}; do
          if ${pkgs.curl}/bin/curl -sf http://localhost:$BETRACE_PORT_GRAFANA/api/health > /dev/null 2>&1; then
            echo "  ✅ Grafana is healthy (http://localhost:$BETRACE_PORT_GRAFANA)"
            # Give Grafana a bit more time to fully initialize login system
            echo "  ⏳ Waiting for Grafana to fully initialize..."
            sleep 3
            break
          fi
          if [ $i -eq 30 ]; then
            echo "  ❌ Grafana failed to become healthy"
            echo "📋 Grafana logs:"
            tail -50 "$RUNTIME_DIR/grafana.log"
            exit 1
          fi
          sleep 1
        done
      '' else ""}

      echo ""
      echo "🎭 Running Playwright tests..."
      cd "$ORIGINAL_PWD/grafana-betrace-app"

      # Install dependencies if node_modules missing
      if [ ! -d "node_modules" ]; then
        echo "📦 Installing npm dependencies..."
        ${nodejs}/bin/npm ci
      fi

      # Run tests (npx handles playwright execution)
      if ${nodejs}/bin/npx playwright test ${testPattern} --reporter=list; then
        echo ""
        echo "✅ All tests passed!"
        exit 0
      else
        echo ""
        echo "❌ Tests failed!"
        ${if needsBackend then ''
          echo ""
          echo "📋 Backend logs:"
          tail -50 "$RUNTIME_DIR/backend.log"
        '' else ""}
        ${if needsGrafana then ''
          echo ""
          echo "📋 Grafana logs:"
          tail -50 "$RUNTIME_DIR/grafana.log"
        '' else ""}
        exit 1
      fi
    '';

in
{
  inherit mkShellTest;

  # Grafana E2E tests with full stack
  grafana-e2e = mkShellTest {
    name = "grafana-e2e";
    testPattern = "tests/e2e-*.spec.ts";
    needsBackend = true;
    needsGrafana = true;
    env = {
      NODE_ENV = "test";
      # Ports set dynamically to avoid conflicts
    };
  };

  # Backend-only integration tests
  backend-integration = mkShellTest {
    name = "backend-integration";
    testPattern = "tests/**/*backend*.spec.ts";
    needsBackend = true;
    env = {
      # Ports set dynamically to avoid conflicts
    };
  };

  # Monaco editor tests
  monaco-tests = mkShellTest {
    name = "monaco";
    testPattern = "tests/e2e-rules.spec.ts --grep 'Monaco'";
    needsBackend = true;
    needsGrafana = true;
    env = {
      # Ports set dynamically to avoid conflicts
    };
  };

  # Backend API tests (no Grafana needed)
  backend-api = mkShellTest {
    name = "backend-api";
    testPattern = "tests/backend-api.spec.ts";
    needsBackend = true;
    needsGrafana = false;
    env = {
      # Ports set dynamically to avoid conflicts
    };
  };
}
