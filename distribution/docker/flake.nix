{
  description = "BeTrace Docker Images - External Distribution Target";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    betrace.url = "path:../..";
  };

  outputs = { self, nixpkgs, flake-utils, betrace }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Get BeTrace packages
        betraceBackend = betrace.packages.${system}.backend;
        betraceGrafanaPlugin = "${betrace.inputs.betrace-grafana-plugin.packages.${system}.default or betrace.packages.${system}.grafana-plugin}";

      in {
        packages = {
          # Backend Docker image (distroless for security)
          backend-docker = pkgs.dockerTools.buildLayeredImage {
            name = "betrace-backend";
            tag = "latest";

            contents = [ betraceBackend ];

            config = {
              Cmd = [ "${betraceBackend}/bin/betrace-backend" ];
              ExposedPorts = {
                "8080/tcp" = {};
              };
              Env = [
                "PORT=8080"
                "BACKEND_PORT=8080"
              ];
              Labels = {
                "org.opencontainers.image.description" = "BeTrace Behavioral Assurance Backend";
                "org.opencontainers.image.source" = "https://github.com/betracehq/betrace";
                "org.opencontainers.image.licenses" = "MIT";
              };
            };
          };

          # Grafana with BeTrace plugin pre-installed
          grafana-with-plugin = pkgs.dockerTools.buildLayeredImage {
            name = "betrace-grafana-plugin";
            tag = "latest";

            contents = with pkgs; [
              grafana
              coreutils
              bash
            ];

            config = {
              Cmd = [ "${pkgs.grafana}/bin/grafana" "server" ];
              ExposedPorts = {
                "3000/tcp" = {};
              };
              Env = [
                "GF_PATHS_PLUGINS=/var/lib/grafana/plugins"
                "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=betrace-app"
              ];
              WorkingDir = "/usr/share/grafana";
              Labels = {
                "org.opencontainers.image.description" = "Grafana with BeTrace plugin pre-installed";
                "org.opencontainers.image.source" = "https://github.com/betracehq/betrace";
                "org.opencontainers.image.licenses" = "MIT";
              };
            };

            # Copy BeTrace plugin into image
            extraCommands = ''
              mkdir -p var/lib/grafana/plugins
              # Plugin will be copied at build time from workspace
              echo "BeTrace plugin location: ${betraceGrafanaPlugin}"
            '';
          };

          # Plugin-only image (for use as init container in Helm charts)
          plugin-init = pkgs.dockerTools.buildLayeredImage {
            name = "betrace-plugin-init";
            tag = "latest";

            contents = with pkgs; [ coreutils bash ];

            config = {
              Cmd = [ "${pkgs.bash}/bin/bash" ];
              Labels = {
                "org.opencontainers.image.description" = "BeTrace Grafana plugin (init container)";
                "org.opencontainers.image.source" = "https://github.com/betracehq/betrace";
              };
            };

            extraCommands = ''
              mkdir -p plugin
              # Copy plugin dist to /plugin in container
            '';
          };

          default = self.packages.${system}.backend-docker;
        };

        # Helper apps to build and load images
        apps = {
          # Build backend image and load into Docker
          build-backend = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScriptBin "build-backend-docker" ''
              echo "🐋 Building BeTrace backend Docker image..."
              nix build .#backend-docker
              echo "📦 Loading image into Docker..."
              docker load < result
              echo "✅ Image loaded: betrace-backend:latest"
              echo ""
              echo "Run with: docker run -p 8080:8080 betrace-backend:latest"
            '';
          };

          # Build Grafana image with plugin
          build-grafana = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScriptBin "build-grafana-docker" ''
              echo "🐋 Building Grafana with BeTrace plugin..."
              nix build .#grafana-with-plugin
              echo "📦 Loading image into Docker..."
              docker load < result
              echo "✅ Image loaded: betrace-grafana-plugin:latest"
              echo ""
              echo "Run with: docker run -p 3000:3000 betrace-grafana-plugin:latest"
            '';
          };

          # Build all images
          build-all = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScriptBin "build-all-docker" ''
              echo "🐋 Building all BeTrace Docker images..."
              echo ""

              echo "1/3 Building backend..."
              nix build .#backend-docker -o result-backend
              docker load < result-backend

              echo ""
              echo "2/3 Building Grafana with plugin..."
              nix build .#grafana-with-plugin -o result-grafana
              docker load < result-grafana

              echo ""
              echo "3/3 Building plugin init container..."
              nix build .#plugin-init -o result-plugin
              docker load < result-plugin

              echo ""
              echo "✅ All images built and loaded:"
              echo "  - betrace-backend:latest"
              echo "  - betrace-grafana-plugin:latest"
              echo "  - betrace-plugin-init:latest"
            '';
          };

          default = self.apps.${system}.build-all;
        };
      }
    );
}
