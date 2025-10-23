{
  description = "FLUO Backend (Go) - Behavioral Assurance System";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages = {
          # Main backend application
          backend = pkgs.buildGoModule {
            pname = "fluo-backend";
            version = "2.0.0";
            src = ./.;

            vendorHash = "sha256-mcKkL1g12+lqOR/ADdRmnBcDvxDizVrYwDpPXNFUAqU=";

            ldflags = [
              "-s" # Strip debug symbols
              "-w" # Strip DWARF
              "-X main.version=2.0.0"
              "-X main.commit=${self.rev or "dev"}"
            ];

            meta = with pkgs.lib; {
              description = "FLUO behavioral assurance backend";
              homepage = "https://github.com/fluohq/fluo";
              license = licenses.mit;
              mainProgram = "fluo-backend";
            };
          };

          # CLI tool
          fluo-cli = pkgs.buildGoModule {
            pname = "fluo-cli";
            version = "2.0.0";
            src = ./.;

            vendorHash = "sha256-mcKkL1g12+lqOR/ADdRmnBcDvxDizVrYwDpPXNFUAqU=";

            subPackages = [ "cmd/fluo-cli" ];

            ldflags = [
              "-s"
              "-w"
              "-X main.version=2.0.0"
            ];

            meta = with pkgs.lib; {
              description = "FLUO CLI tool";
              mainProgram = "fluo-cli";
            };
          };

          # Alias for convenience
          app = self.packages.${system}.backend;
        };

        # Development shell
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            go
            gopls        # Go language server
            gotools      # goimports, etc.
            go-tools     # staticcheck
            golangci-lint
            delve        # Debugger

            # DuckDB dependencies
            arrow-cpp    # Apache Arrow C++ library
            duckdb       # DuckDB library
          ];

          shellHook = ''
            echo "🚀 FLUO Backend (Go) Development Environment"
            echo ""
            echo "Available commands:"
            echo "  go run ./cmd/fluo-backend   # Run backend server"
            echo "  go run ./cmd/fluo-cli       # Run CLI tool"
            echo "  go test ./...               # Run tests"
            echo "  go build ./...              # Build all packages"
            echo ""
            export GOFLAGS="-mod=vendor"

            # Set CGO flags for DuckDB
            export CGO_ENABLED=1
            export CGO_LDFLAGS="-L${pkgs.duckdb}/lib"
            export CGO_CFLAGS="-I${pkgs.duckdb.dev}/include"
          '';
        };

        # Development server app
        apps = {
          backend = {
            type = "app";
            program = "${self.packages.${system}.backend}/bin/fluo-backend";
          };

          cli = {
            type = "app";
            program = "${self.packages.${system}.fluo-cli}/bin/fluo-cli";
          };

          default = self.apps.${system}.backend;
        };
      }
    );
}
