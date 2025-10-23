{
  description = "FLUO service wrappers and build outputs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f {
        pkgs = import nixpkgs { inherit system; };
      });
    in
    {
      packages = forAllSystems ({ pkgs }:
        let
          betracePlugin = pkgs.callPackage ./betrace-plugin.nix {};
        in {
        # Application builds
        frontend = pkgs.callPackage ./frontend.nix {};
        backend = pkgs.callPackage ./backend.nix {};

        # Dev tools
        test-runner = pkgs.callPackage ./dev-tools/test-runner.nix {};
        test-watch = pkgs.callPackage ./dev-tools/test-watch.nix {};
        serve-coverage = pkgs.callPackage ./dev-tools/serve-coverage.nix {};

        # BeTrace Grafana plugin
        betrace-plugin = betracePlugin;

        # Wrapped observability services (grafana depends on betrace plugin)
        grafana-wrapped = pkgs.callPackage ./grafana-wrapped.nix { inherit betracePlugin; };
        loki-wrapped = pkgs.callPackage ./loki-wrapped.nix {};
        tempo-wrapped = pkgs.callPackage ./tempo-wrapped.nix {};
        prometheus-wrapped = pkgs.callPackage ./prometheus-wrapped.nix {};
        pyroscope-wrapped = pkgs.callPackage ./pyroscope-wrapped.nix {};
        alloy-wrapped = pkgs.callPackage ./alloy-wrapped.nix {};
      });
    };
}
