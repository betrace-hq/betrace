{ writeShellApplication, python3, gum }:

writeShellApplication {
  name = "serve-coverage";
  runtimeInputs = [ python3 gum ];

  text = ''
    #!/usr/bin/env bash

    PORT=''${PORT:-12099}
    COVERAGE_DIR="/tmp/fluo-test-results"

    if [ ! -d "$COVERAGE_DIR" ]; then
      gum style --foreground 196 "❌ No coverage reports found"
      echo "Run 'test-runner' first to generate coverage"
      exit 1
    fi

    gum style --border rounded --padding "1 2" \
      "📊 Coverage Reports Server" \
      "" \
      "Frontend: http://localhost:$PORT/frontend/coverage/index.html" \
      "Backend:  http://localhost:$PORT/backend/coverage.html" \
      "" \
      "Press Ctrl+C to stop"

    cd "$COVERAGE_DIR"
    exec python3 -m http.server "$PORT"
  '';
}
