{
  description = "FLUO Frontend - Pure React application with Tanstack ecosystem";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
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

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Nix-managed node modules for reproducible builds
        nodeModules = pkgs.buildNpmPackage {
          pname = "fluo-frontend-node-modules";
          version = "0.1.0";
          src = ./.;
          npmDepsHash = "sha256-iDzSLtV7aXtZUggc54zQGWRUR8wqU4GYfe+Gbs/LI5o=";

          env = {
            PUPPETEER_SKIP_DOWNLOAD = "1";
          };

          dontBuild = true;
          installPhase = ''
            mkdir -p $out
            cp -r node_modules $out/
          '';
        };

        # Build the React application
        frontendApp = pkgs.stdenv.mkDerivation {
          pname = "fluo-frontend";
          version = "0.1.0";

          src = pkgs.lib.cleanSourceWith {
            filter = path: type:
              let baseName = baseNameOf path; in
              !(pkgs.lib.hasInfix "node_modules" path) &&
              !(pkgs.lib.hasInfix ".git" path) &&
              !(pkgs.lib.hasInfix "dist" path) &&
              !(baseName == "result") &&
              !(baseName == ".env") &&
              !(baseName == ".env.local");
            src = ./.;
          };

          buildInputs = with pkgs; [
            nodejs_20
            python3
          ];

          buildPhase = ''
            export HOME=$TMPDIR
            export NODE_ENV=production

            echo "🔒 Using Nix-managed node_modules..."
            ln -s ${nodeModules}/node_modules ./node_modules

            echo "🔧 Generating route tree..."
            npx @tanstack/router-cli generate

            echo "📦 Building frontend application..."
            npm run build
          '';

          installPhase = ''
            mkdir -p $out
            cp -r dist/* $out/
          '';

          meta = {
            description = "FLUO Frontend - React application with Tanstack Router";
          };
        };

        # Development server script
        devServer = pkgs.writeShellScriptBin "dev-server" ''
          echo "🚀 Starting FLUO Frontend development server..."
          echo "📦 Node.js: $(node --version)"
          echo "🔥 Vite with hot reload on http://localhost:3000"
          echo "📊 React Profiler: Open browser DevTools → Profiler tab"

          # Install dependencies if needed
          if [ ! -d "node_modules" ]; then
            echo "📦 Installing dependencies..."
            npm install
          fi

          # Generate routes
          if [ -d "src/routes" ]; then
            echo "🔧 Generating route tree..."
            npx @tanstack/router-cli generate
          fi

          # Start development server with React Profiler enabled
          export VITE_REACT_PROFILER=true
          exec npm run dev -- --host 0.0.0.0 --port ''${PORT:-3000}
        '';

        # Production static file server
        staticServer = pkgs.writeShellScriptBin "static-server" ''
          echo "🌐 Starting FLUO Frontend static server..."

          PORT=''${PORT:-8080}
          echo "📡 Serving on http://localhost:$PORT"

          # Use Python's built-in server for simplicity
          cd ${frontendApp}
          exec ${pkgs.python3}/bin/python -m http.server $PORT
        '';

        # Route generation utility
        routeGenerator = pkgs.writeShellScriptBin "generate-routes" ''
          echo "🔧 Generating Tanstack Router routes..."
          export NODE_PATH=${nodeModules}/node_modules
          ${nodeModules}/node_modules/.bin/tsr generate
          echo "✅ Route tree generated!"
        '';

        # Storybook development server
        storybookServer = pkgs.writeShellScriptBin "storybook-server" ''
          PORT=''${PORT:-6006}
          echo "📚 Starting FLUO Storybook..."
          echo "🎨 Live style guide on http://localhost:$PORT"

          # Install dependencies if needed
          if [ ! -d "node_modules" ]; then
            echo "📦 Installing dependencies..."
            npm install
          fi

          # Start Storybook on specified port
          exec npm run storybook -- --port $PORT
        '';

      in {
        # Development shell
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            git
            curl
            jq
          ];

          shellHook = ''
            echo "🚀 FLUO Frontend Development Environment"
            echo "📦 Node.js: $(node --version)"
            echo "📦 npm: $(npm --version)"
            echo ""
            echo "Commands:"
            echo "  npm run dev       - Start development server"
            echo "  npm run build     - Build for production"
            echo "  npm run preview   - Preview production build"
            echo "  npm run test      - Run tests"
            echo "  npm run lint      - Lint code"
            echo "  npm run format    - Format code"
            echo ""
            echo "Nix commands:"
            echo "  nix build         - Build frontend application"
            echo "  nix run .#dev     - Start development server"
            echo "  nix run .#serve   - Serve built application"
            echo ""

            # Set up environment
            export NODE_ENV=development
            export BROWSER=none
            export VITE_DEV=true

            # Install dependencies if needed
            if [ ! -d "node_modules" ]; then
              echo "📦 Installing dependencies..."
              npm install
            fi
          '';
        };

        # Packages
        packages = {
          # Built frontend application
          app = frontendApp;

          # Default package
          default = frontendApp;
        };

        # Apps for nix run
        apps = {
          # Default: development server
          default = flake-utils.lib.mkApp { drv = devServer; };

          # Development server
          dev = flake-utils.lib.mkApp { drv = devServer; };

          # Static file server for production
          serve = flake-utils.lib.mkApp { drv = staticServer; };

          # Route generation
          routes = flake-utils.lib.mkApp { drv = routeGenerator; };

          # Storybook
          storybook = flake-utils.lib.mkApp { drv = storybookServer; };
        };

        # Formatter
        formatter = pkgs.nixpkgs-fmt;
      });
}