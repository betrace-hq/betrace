{ pkgs, lib, nodejs, playwright-driver }:

let
  # Create a process-compose configuration for test orchestration
  mkProcessComposeTest = {
    name,
    testPattern ? "**/*.spec.ts",
    services ? {},
    env ? {},
  }:
    let
      # Generate process-compose YAML configuration
      processComposeConfig = pkgs.writeTextFile {
        name = "process-compose-${name}.yaml";
        text = ''
version: "0.5"

processes:
${lib.concatStringsSep "\n" (lib.mapAttrsToList (serviceName: cfg: ''  ${serviceName}:
    command: |
      ${cfg.command}
    availability:
      restart: "on_failure"
      max_restarts: 3
    readiness_probe:
      exec:
        command: ${cfg.healthCheck}
      initial_delay_seconds: 1
      period_seconds: 1
      timeout_seconds: 5
      success_threshold: 1
      failure_threshold: 30'') services)}

  tests:
    command: |
      echo "⏳ Waiting for services to be ready..."
      sleep 5
      echo ""
      echo "🎭 Running Playwright tests..."
      ${nodejs}/bin/npx playwright test ${testPattern} --reporter=list
    depends_on:
${lib.concatStringsSep "\n" (map (name: "      ${name}:
        condition: process_healthy") (lib.attrNames services))}
        '';
      };

      testScript = pkgs.writeShellScriptBin "test-${name}" ''
        set -euo pipefail

        # Create temp directory for test runtime
        RUNTIME_DIR=$(mktemp -d /tmp/betrace-test-XXXXXX)
        trap "rm -rf $RUNTIME_DIR" EXIT

        # Create backend data directory
        export BACKEND_DATA_DIR="$RUNTIME_DIR/backend-data"
        mkdir -p "$BACKEND_DATA_DIR"

        # Setup Grafana directories if needed
        ${if services ? grafana then ''
          export GRAFANA_DATA_DIR="$RUNTIME_DIR/grafana-data"
          export GRAFANA_PLUGINS_DIR="$GRAFANA_DATA_DIR/plugins"
          export GRAFANA_PROVISIONING_DIR="$GRAFANA_DATA_DIR/provisioning/datasources"
          mkdir -p "$GRAFANA_PLUGINS_DIR" "$GRAFANA_PROVISIONING_DIR"

          # Copy BeTrace plugin
          if [ ! -d "grafana-betrace-app/dist" ]; then
            echo "ERROR: grafana-betrace-app/dist not found"
            echo "Run: cd grafana-betrace-app && npm run build"
            exit 1
          fi
          cp -r grafana-betrace-app/dist "$GRAFANA_PLUGINS_DIR/betrace-app"
          chmod -R u+w "$GRAFANA_PLUGINS_DIR/betrace-app"

          # Create datasources config
          cat > "$GRAFANA_PROVISIONING_DIR/datasources.yaml" <<'EOF'
          apiVersion: 1
          datasources:
            - name: Tempo
              type: tempo
              url: http://localhost:3200
              uid: tempo
          EOF

          # Create grafana.ini
          export GRAFANA_CONFIG="$RUNTIME_DIR/grafana.ini"
          cat > "$GRAFANA_CONFIG" <<EOF
          [paths]
          data = $GRAFANA_DATA_DIR
          plugins = $GRAFANA_PLUGINS_DIR
          provisioning = $GRAFANA_DATA_DIR/provisioning

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
        '' else ""}

        # Export environment variables
        export SKIP_GLOBAL_SETUP=1  # Skip Playwright global setup
        ${lib.concatStringsSep "\n" (lib.mapAttrsToList (k: v: "export ${k}=${v}") env)}

        # Run process-compose with test config
        echo "🧪 Process-Compose Test Runner: ${name}"
        echo "================================"
        echo ""

        ${pkgs.process-compose}/bin/process-compose up \
          -f ${processComposeConfig} \
          -t=false \
          --no-server

        EXIT_CODE=$?

        if [ $EXIT_CODE -eq 0 ]; then
          echo ""
          echo "✅ All tests passed!"
        else
          echo ""
          echo "❌ Tests failed with exit code: $EXIT_CODE"
        fi

        exit $EXIT_CODE
      '';
    in
    testScript;

in
{
  inherit mkProcessComposeTest;

  # Grafana E2E tests with full stack
  grafana-e2e = mkProcessComposeTest {
    name = "grafana-e2e";
    testPattern = "tests/e2e-*.spec.ts";

    services = {
      backend = {
        command = "cd ${toString ../backend} && PORT=12011 BETRACE_DATA_DIR=$BACKEND_DATA_DIR ${pkgs.go}/bin/go run ./cmd/betrace-backend";
        healthCheck = "${pkgs.curl}/bin/curl -sf http://localhost:12011/v1/rules > /dev/null";
      };

      grafana = {
        command = "${pkgs.grafana}/bin/grafana-server --homepath ${pkgs.grafana}/share/grafana --config $GRAFANA_CONFIG";
        healthCheck = "${pkgs.curl}/bin/curl -sf http://localhost:12015/api/health > /dev/null";
      };
    };

    env = {
      BETRACE_PORT_BACKEND = "12011";
      BETRACE_PORT_GRAFANA = "12015";
      NODE_ENV = "test";
    };
  };

  # Backend-only integration tests
  backend-integration = mkProcessComposeTest {
    name = "backend-integration";
    testPattern = "tests/**/*backend*.spec.ts";

    services = {
      backend = {
        command = "cd ${toString ../backend} && PORT=12011 BETRACE_DATA_DIR=$BACKEND_DATA_DIR ${pkgs.go}/bin/go run ./cmd/betrace-backend";
        healthCheck = "${pkgs.curl}/bin/curl -sf http://localhost:12011/v1/rules > /dev/null";
      };
    };

    env = {
      BETRACE_PORT_BACKEND = "12011";
    };
  };

  # Monaco editor tests
  monaco-tests = mkProcessComposeTest {
    name = "monaco";
    testPattern = "tests/e2e-rules.spec.ts --grep 'Monaco'";

    services = {
      backend = {
        command = "cd ${toString ../backend} && PORT=12011 BETRACE_DATA_DIR=$BACKEND_DATA_DIR ${pkgs.go}/bin/go run ./cmd/betrace-backend";
        healthCheck = "${pkgs.curl}/bin/curl -sf http://localhost:12011/v1/rules > /dev/null";
      };

      grafana = {
        command = "${pkgs.grafana}/bin/grafana-server --homepath ${pkgs.grafana}/share/grafana --config $GRAFANA_CONFIG";
        healthCheck = "${pkgs.curl}/bin/curl -sf http://localhost:12015/api/health > /dev/null";
      };
    };

    env = {
      BETRACE_PORT_BACKEND = "12011";
      BETRACE_PORT_GRAFANA = "12015";
    };
  };
}
