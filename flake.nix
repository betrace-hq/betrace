{
  description = "BeTrace - Pure Application Framework (Packages + Dev Shells)";

  # NOTE: Service orchestration (Grafana, Loki, Tempo, etc.) managed by Flox
  # See .flox/env/manifest.toml for service configuration
  # Run: flox services start

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    # Local application flakes
    betrace-frontend = {
      url = "path:./bff";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };

    betrace-backend = {
      url = "path:./backend";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };

    betrace-grafana-plugin = {
      url = "path:./grafana-betrace-app";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };

    # Development tools
    dev-tools = {
      url = "path:./dev-tools";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };
  };

  nixConfig = {
    substituters = [
      "https://cache.nixos.org/"
      "https://nix-community.cachix.org"
    ];
    trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
    builders-use-substitutes = true;
  };

  outputs = { self, nixpkgs, flake-utils, betrace-frontend, betrace-backend, betrace-grafana-plugin, dev-tools }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Port configuration matching .flox/env/manifest.toml
        ports = {
          caddy = 3000;
          frontend = 12010;
          backend = 12011;
          grafana = 12015;
          mcpServer = 12016;
          prometheus = 9090;
          loki = 3100;
          tempo = 3200;
          pyroscope = 3210;
        };

        # Test runners with shell script orchestration
        testRunners = import ./nix/shell-test-runner.nix {
          inherit pkgs;
          inherit (pkgs) lib nodejs;
          playwright-driver = pkgs.playwright-driver;
        };

        # Container images (OCI/Docker)
        containers = import ./nix/containers.nix {
          inherit pkgs system ports;
          frontend-package = betrace-frontend.packages.${system}.app;
          backend-package = betrace-backend.packages.${system}.app;
          grafana-plugin-package = betrace-grafana-plugin.packages.${system}.default;
        };

        # Cosign signing utilities
        cosign = import ./nix/cosign.nix { inherit pkgs; };

        # Docker Compose generator
        dockerCompose = import ./nix/docker-compose.nix { inherit pkgs ports; };

        # Service wrappers for Flox/local development
        serviceWrappers = import ./nix/service-wrappers.nix {
          inherit pkgs;
          inherit (pkgs) lib;
          grafana-plugin-package = betrace-grafana-plugin.packages.${system}.default;
        };

      in {
        # ===================================================================
        # PACKAGES (Build Outputs)
        # ===================================================================
        packages = {
          # Application packages
          frontend = betrace-frontend.packages.${system}.app;
          backend = betrace-backend.packages.${system}.app;
          grafana-plugin = betrace-grafana-plugin.packages.${system}.default;

          # Convenience package: all applications
          all = pkgs.symlinkJoin {
            name = "betrace-complete";
            paths = [
              betrace-frontend.packages.${system}.app
              betrace-backend.packages.${system}.app
            ];
          };

          # Container images (OCI/Docker)
          container-backend = containers.backend;
          container-frontend = containers.frontend;
          container-grafana = containers.grafana;
          container-loki = containers.loki;
          container-tempo = containers.tempo;
          container-prometheus = containers.prometheus;
          containers-all = containers.all;

          # Cosign utilities
          cosign-keygen = cosign.generateKeyPair {
            name = "betrace-signing-key";
          };

          # Note: Signed containers require a signing key
          # Generate keys with: nix build .#cosign-keygen
          # Then sign with: cosign sign --key ./result/cosign.key <image>

          # Docker Compose configuration
          docker-compose = dockerCompose;

          # Service wrappers (for Flox and local dev)
          loki-wrapped = serviceWrappers.loki-wrapped;
          tempo-wrapped = serviceWrappers.tempo-wrapped;
          prometheus-wrapped = serviceWrappers.prometheus-wrapped;
          pyroscope-wrapped = serviceWrappers.pyroscope-wrapped;
          alloy-wrapped = serviceWrappers.alloy-wrapped;
          grafana-wrapped = serviceWrappers.grafana-wrapped;

          default = self.packages.${system}.all;
        };

        # ===================================================================
        # APPS (nix run .#<app>)
        # ===================================================================
        apps = {
          # Development: Delegate to Flox for service management
          dev = {
            type = "app";
            program = toString (pkgs.writeShellScript "dev" ''
              echo "🎯 BeTrace Development Environment"
              echo "==================================="
              echo ""
              echo "⚠️  Service management handled by Flox"
              echo ""
              echo "📋 Start all services:"
              echo "   flox services start"
              echo ""
              echo "📊 Access points:"
              echo "   Frontend:  http://localhost:${toString ports.frontend}"
              echo "   Backend:   http://localhost:${toString ports.backend}"
              echo "   Grafana:   http://localhost:${toString ports.grafana}"
              echo ""
              echo "🔍 Check service status:"
              echo "   flox services status"
              echo ""
              echo "📚 See .flox/env/manifest.toml for service configuration"
              exit 0
            '');
          };

          # Individual component dev servers
          frontend = {
            type = "app";
            program = toString (pkgs.writeShellScript "frontend-dev" ''
              cd bff && exec ${pkgs.nodejs}/bin/npm run dev
            '');
          };

          backend = {
            type = "app";
            program = toString (pkgs.writeShellScript "backend-dev" ''
              cd backend && exec ${pkgs.go}/bin/go run ./cmd/betrace-backend
            '');
          };

          # Production serving (built packages)
          serve = {
            type = "app";
            program = toString (pkgs.writeShellScript "serve" ''
              echo "🌐 Serving Production Builds"
              echo "=============================="
              echo ""
              echo "Frontend: http://localhost:8080"
              echo "Backend:  http://localhost:8081"
              echo ""

              # Serve frontend
              PORT=8080 ${pkgs.caddy}/bin/caddy file-server \
                --root ${betrace-frontend.packages.${system}.app} \
                --listen :8080 &

              # Serve backend
              PORT=8081 ${betrace-backend.packages.${system}.app}/bin/betrace-backend &

              wait
            '');
          };

          # Utility apps
          build = {
            type = "app";
            program = toString (pkgs.writeShellScript "build" ''
              echo "🔨 Building all BeTrace applications..."
              nix build .#all
              echo "✅ Build complete: ./result"
            '');
          };

          status = {
            type = "app";
            program = toString (pkgs.writeShellScript "status" ''
              echo "📊 BeTrace Project Status"
              echo "========================="
              echo ""
              echo "📦 Packages:"
              echo "   nix build .#frontend"
              echo "   nix build .#backend"
              echo "   nix build .#grafana-plugin"
              echo ""
              echo "🚀 Development:"
              echo "   flox services start    - Start all services"
              echo "   flox services status   - Check service status"
              echo "   nix run .#frontend     - Frontend dev server only"
              echo "   nix run .#backend      - Backend dev server only"
              echo ""
              echo "🧪 Testing:"
              echo "   nix run .#test-grafana-e2e     - Grafana E2E tests (auto-starts services)"
              echo "   nix run .#test-backend         - Backend integration tests"
              echo "   nix run .#test-monaco          - Monaco editor tests"
              echo "   cd bff && npm test             - Frontend unit tests"
              echo "   cd backend && go test          - Backend unit tests"
              echo ""
              echo "📚 Documentation:"
              echo "   CLAUDE.md              - AI assistant instructions"
              echo "   .flox/env/manifest.toml - Flox service configuration"
              echo "   docs/adrs/             - Architecture decisions"
            '');
          };

          # Test runners with process-compose orchestration
          test-grafana-e2e = {
            type = "app";
            program = "${testRunners.grafana-e2e}/bin/test-grafana-e2e";
          };

          test-backend = {
            type = "app";
            program = "${testRunners.backend-integration}/bin/test-backend-integration";
          };

          test-monaco = {
            type = "app";
            program = "${testRunners.monaco-tests}/bin/test-monaco";
          };

          test-backend-api = {
            type = "app";
            program = "${testRunners.backend-api}/bin/test-backend-api";
          };

          # Coverage gate checker
          check-coverage-gates =
            let
              script = pkgs.writeShellScriptBin "check-coverage-gates" ''
                export PATH="${pkgs.jq}/bin:${pkgs.bc}/bin:$PATH"

                ${builtins.readFile ./scripts/check-coverage-gates.sh}
              '';
            in {
              type = "app";
              program = "${script}/bin/check-coverage-gates";
            };

          default = self.apps.${system}.dev;
        };

        # ===================================================================
        # DEV SHELLS (nix develop)
        # ===================================================================
        devShells = {
          # Default: Minimal shell (Flox handles packages)
          default = pkgs.mkShell {
            name = "betrace-shell";
            buildInputs = with pkgs; [
              # Core tools (Flox provides the rest)
              git
              nix
            ];
            shellHook = ''
              echo "🎯 BeTrace Development Shell"
              echo "=============================="
              echo ""
              echo "⚠️  Packages managed by Flox (.flox/env/manifest.toml)"
              echo ""
              echo "💡 Activate Flox environment:"
              echo "   flox activate"
              echo ""
              echo "   Or use direnv (.envrc already configured)"
            '';
          };

          # Frontend-specific shell
          frontend = betrace-frontend.devShells.${system}.default;

          # Backend-specific shell
          backend = betrace-backend.devShells.${system}.default;
        };

        # ===================================================================
        # FORMATTER
        # ===================================================================
        formatter = pkgs.nixpkgs-fmt;
      }
    );
}
