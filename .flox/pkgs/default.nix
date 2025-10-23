{ pkgs ? import <nixpkgs> {} }:

{
  # Application builds
  frontend = pkgs.callPackage ./frontend.nix {};
  # Backend uses its own flake.nix (backend/flake.nix) accessed via `go run` in services

  # Dev tools
  test-runner = pkgs.callPackage ./dev-tools/test-runner.nix {};
  test-watch = pkgs.callPackage ./dev-tools/test-watch.nix {};
  serve-coverage = pkgs.callPackage ./dev-tools/serve-coverage.nix {};

  # Wrapped observability services
  grafana-wrapped = pkgs.callPackage ./grafana-wrapped.nix {};
  loki-wrapped = pkgs.callPackage ./loki-wrapped.nix {};
  tempo-wrapped = pkgs.callPackage ./tempo-wrapped.nix {};
  prometheus-wrapped = pkgs.callPackage ./prometheus-wrapped.nix {};
  pyroscope-wrapped = pkgs.callPackage ./pyroscope-wrapped.nix {};
  alloy-wrapped = pkgs.callPackage ./alloy-wrapped.nix {};
}
