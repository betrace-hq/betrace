{
  description = "BeTrace Backend - Go API Server";

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
          app = pkgs.buildGoModule {
            pname = "betrace-backend";
            version = "2.0.0";

            src = ./.;

            # Disable vendoring for now - use go mod download
            vendorHash = null;

            # Build the binary
            subPackages = [ "cmd/betrace-backend" ];

            # Build flags
            ldflags = [
              "-s"
              "-w"
              "-X main.version=2.0.0"
            ];

            # Skip tests for now (container build only)
            doCheck = false;

            meta = with pkgs.lib; {
              description = "BeTrace Backend API Server";
              homepage = "https://github.com/org/betrace";
              license = licenses.mit;
              maintainers = [ ];
            };
          };

          default = self.packages.${system}.app;
        };

        # Development shell
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            go
            gotools
            gopls
          ];
        };
      }
    );
}
