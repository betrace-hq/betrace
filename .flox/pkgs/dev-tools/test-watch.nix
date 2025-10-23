{ writeShellApplication, fswatch, nodejs_20, go, gum }:

writeShellApplication {
  name = "test-watch";
  runtimeInputs = [ fswatch nodejs_20 go gum ];

  text = ''
    #!/usr/bin/env bash

    gum style --border double --padding "1 2" --bold \
      "🔄 FLUO Test Watcher" \
      "" \
      "Watching for changes in:" \
      "  • bff/src/" \
      "  • backend-go/**/*.go"

    # Run tests once on start
    test-runner all

    # Watch for changes
    fswatch -o bff/src backend-go | while read -r; do
      clear
      gum style --foreground 212 "🔄 Changes detected, running tests..."
      test-runner all
    done
  '';
}
