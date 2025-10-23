{ pkgs }:

let
  test-runner = pkgs.callPackage ./test-runner.nix {};
  test-watch = pkgs.callPackage ./test-watch.nix {};
  serve-coverage = pkgs.callPackage ./serve-coverage.nix {};
in
pkgs.buildEnv {
  name = "betrace-dev-tools";
  paths = [
    test-runner
    test-watch
    serve-coverage
  ];
}
