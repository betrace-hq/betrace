{
  description = "BeTrace Grafana App Plugin";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Filter source files only (exclude node_modules, dist)
        src = pkgs.lib.cleanSourceWith {
          src = ./.;
          filter = path: type:
            let
              baseName = baseNameOf path;
              relPath = pkgs.lib.removePrefix (toString ./. + "/") (toString path);
            in
            # Exclude build artifacts and dependencies
            !(pkgs.lib.hasPrefix "node_modules/" relPath) &&
            !(pkgs.lib.hasPrefix "dist/" relPath) &&
            !(baseName == ".git");
        };
      in
      {
        packages = {
          # Built plugin (dist/ directory)
          plugin = pkgs.stdenv.mkDerivation {
            pname = "betrace-grafana-plugin";
            version = "0.1.0";

            inherit src;

            nativeBuildInputs = [ pkgs.nodejs ];

            buildPhase = ''
              export HOME=$(mktemp -d)
              npm install
              npm run build
            '';

            installPhase = ''
              # Copy built plugin to output
              mkdir -p $out
              cp -r dist/* $out/
            '';
          };

          default = self.packages.${system}.plugin;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [ pkgs.nodejs ];

          shellHook = ''
            echo "BeTrace Grafana Plugin Development"
            echo "Node version: $(node --version)"
            echo ""
            echo "Available commands:"
            echo "  npm run dev     - Build in watch mode"
            echo "  npm run build   - Production build"
            echo "  npm test        - Run tests"
            echo ""
          '';
        };

        apps = {
          default = {
            type = "app";
            program = toString (pkgs.writeShellScript "build-plugin" ''
              cd ${./.}
              echo "🔨 Building BeTrace Grafana Plugin..."
              ${pkgs.nodejs}/bin/npm install
              ${pkgs.nodejs}/bin/npm run build
              echo "✅ Plugin built in dist/"
            '');
          };

          dev = {
            type = "app";
            program = toString (pkgs.writeShellScript "dev-plugin" ''
              cd ${./.}
              export PATH=${pkgs.nodejs}/bin:$PATH

              if [ ! -d "node_modules" ]; then
                echo "📦 Installing dependencies..."
                npm install
              fi

              echo "🔨 Building plugin in watch mode..."
              exec npm run dev
            '');
          };
        };
      });
}
