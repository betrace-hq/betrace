{
  description = "BeTrace Backend (Go) - Behavioral Assurance System";

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
            pname = "betrace-backend";
            version = "2.0.0";
            src = ./.;

            vendorHash = "sha256-ujG4NKP6cq8KVzAn0lxzMQ+ij+hfF+QM0Bxu9vXSmtI=";

            ldflags = [
              "-s" # Strip debug symbols
              "-w" # Strip DWARF
              "-X main.version=2.0.0"
              "-X main.commit=${self.rev or "dev"}"
            ];

            meta = with pkgs.lib; {
              description = "BeTrace behavioral assurance backend";
              homepage = "https://github.com/betracehq/betrace";
              license = licenses.mit;
              mainProgram = "betrace-backend";
            };
          };

          # CLI tool
          betrace-cli = pkgs.buildGoModule {
            pname = "betrace-cli";
            version = "2.0.0";
            src = ./.;

            vendorHash = "sha256-ujG4NKP6cq8KVzAn0lxzMQ+ij+hfF+QM0Bxu9vXSmtI=";

            subPackages = [ "cmd/betrace-cli" ];

            ldflags = [
              "-s"
              "-w"
              "-X main.version=2.0.0"
            ];

            meta = with pkgs.lib; {
              description = "BeTrace CLI tool";
              mainProgram = "betrace-cli";
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
            echo "🚀 BeTrace Backend (Go) Development Environment"
            echo ""
            echo "Available commands:"
            echo "  go run ./cmd/betrace-backend   # Run backend server"
            echo "  go run ./cmd/betrace-cli       # Run CLI tool"
            echo "  go test ./...                  # Run tests"
            echo "  go build ./...                 # Build all packages"
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
            program = "${self.packages.${system}.backend}/bin/betrace-backend";
          };

          cli = {
            type = "app";
            program = "${self.packages.${system}.betrace-cli}/bin/betrace-cli";
          };

          default = self.apps.${system}.backend;
        };
      }
    );
}
