# Docker Compose Generator for BeTrace
#
# Generates docker-compose.yaml from Nix configuration.
# Single source of truth for service configuration.
#
# Usage:
#   nix build .#docker-compose
#   cp result docker-compose.yaml
#   docker-compose up -d

{ pkgs, ports }:

let
  # Service configuration
  services = {
    backend = {
      image = "betrace-backend:latest";
      container_name = "betrace-backend";
      ports = [ "${toString ports.backend}:${toString ports.backend}" ];
      environment = {
        PORT = toString ports.backend;
        OTEL_EXPORTER_OTLP_ENDPOINT = "http://alloy:4317";
        OTEL_SERVICE_NAME = "betrace-backend";
      };
      depends_on = [ "loki" "tempo" "prometheus" "alloy" ];
      restart = "unless-stopped";
      healthcheck = {
        test = [ "CMD" "curl" "-f" "http://localhost:${toString ports.backend}/health" ];
        interval = "30s";
        timeout = "10s";
        retries = 3;
        start_period = "10s";
      };
    };

    frontend = {
      image = "betrace-frontend:latest";
      container_name = "betrace-frontend";
      ports = [ "${toString ports.frontend}:${toString ports.frontend}" ];
      depends_on = [ "backend" ];
      restart = "unless-stopped";
      healthcheck = {
        test = [ "CMD" "curl" "-f" "http://localhost:${toString ports.frontend}" ];
        interval = "30s";
        timeout = "10s";
        retries = 3;
      };
    };

    grafana = {
      image = "betrace-grafana:latest";
      container_name = "betrace-grafana";
      ports = [ "${toString ports.grafana}:${toString ports.grafana}" ];
      environment = {
        GF_SERVER_HTTP_PORT = toString ports.grafana;
        GF_PATHS_PLUGINS = "/var/lib/grafana/plugins";
        GF_SECURITY_ADMIN_USER = "admin";
        GF_SECURITY_ADMIN_PASSWORD = "admin";
      };
      depends_on = [ "loki" "tempo" "prometheus" "pyroscope" ];
      restart = "unless-stopped";
      healthcheck = {
        test = [ "CMD" "curl" "-f" "http://localhost:${toString ports.grafana}/api/health" ];
        interval = "30s";
        timeout = "10s";
        retries = 3;
      };
    };

    loki = {
      image = "betrace-loki:latest";
      container_name = "betrace-loki";
      ports = [ "${toString ports.loki}:${toString ports.loki}" ];
      restart = "unless-stopped";
      healthcheck = {
        test = [ "CMD" "curl" "-f" "http://localhost:${toString ports.loki}/ready" ];
        interval = "30s";
        timeout = "10s";
        retries = 3;
      };
    };

    tempo = {
      image = "betrace-tempo:latest";
      container_name = "betrace-tempo";
      ports = [
        "${toString ports.tempo}:${toString ports.tempo}"
        "4317:4317"  # OTLP gRPC
        "4318:4318"  # OTLP HTTP
      ];
      restart = "unless-stopped";
      healthcheck = {
        test = [ "CMD" "curl" "-f" "http://localhost:${toString ports.tempo}/ready" ];
        interval = "30s";
        timeout = "10s";
        retries = 3;
      };
    };

    prometheus = {
      image = "betrace-prometheus:latest";
      container_name = "betrace-prometheus";
      ports = [ "${toString ports.prometheus}:${toString ports.prometheus}" ];
      restart = "unless-stopped";
      healthcheck = {
        test = [ "CMD" "curl" "-f" "http://localhost:${toString ports.prometheus}/-/ready" ];
        interval = "30s";
        timeout = "10s";
        retries = 3;
      };
    };

    # Note: Pyroscope and Alloy would be added here
    # For now, using official images from Docker Hub
  };

  # Docker Compose configuration
  composeConfig = {
    version = "3.8";

    inherit services;

    # Networks
    networks = {
      betrace = {
        driver = "bridge";
      };
    };

    # Volumes for persistence
    volumes = {
      loki-data = {};
      tempo-data = {};
      prometheus-data = {};
      grafana-data = {};
    };
  };

  # Convert to YAML using Nix's built-in YAML generator
  yamlFormat = pkgs.formats.yaml {};

in yamlFormat.generate "docker-compose.yaml" composeConfig
