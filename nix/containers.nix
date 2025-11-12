# Container Image Definitions (Nix/Flox-First Approach)
#
# This file defines OCI container images using pkgs.dockerTools.
# No Dockerfiles - declarative image generation with Nix.
#
# Usage:
#   nix build .#container-backend
#   docker load < result
#   docker run betrace-backend:latest

{ pkgs
, system
, frontend-package
, backend-package
, grafana-plugin-package
, ports
}:

let
  # Common settings for all BeTrace containers
  commonConfig = {
    # Use UTC timezone
    TZ = "UTC";
    # Disable color output for logs (better for log aggregation)
    NO_COLOR = "1";
  };

  # Helper to create a non-root user
  mkUser = name: uid:
    pkgs.runCommand "user-${name}" {} ''
      mkdir -p $out/etc
      echo "${name}:x:${toString uid}:${toString uid}:${name}:/home/${name}:/sbin/nologin" > $out/etc/passwd
      echo "${name}:x:${toString uid}:" > $out/etc/group
    '';

in rec {
  # =========================================================================
  # Backend Container (Go API)
  # =========================================================================
  backend = pkgs.dockerTools.buildLayeredImage {
    name = "betrace-backend";
    tag = "latest";

    # Maximum number of layers (Docker limit is 128, but 100 is safer)
    maxLayers = 100;

    # Contents: What goes into the image
    contents = with pkgs; [
      # Application binary
      backend-package

      # Runtime dependencies
      cacert        # CA certificates for HTTPS
      tzdata        # Timezone data

      # Minimal filesystem structure
      fakeNss       # Provides /etc/passwd, /etc/group

      # Non-root user
      (mkUser "betrace" 10001)
    ];

    # Image configuration
    config = {
      # Command to run
      Cmd = [ "${backend-package}/bin/betrace-backend" ];

      # Environment variables
      Env = [
        "PATH=/bin"
        "PORT=${toString ports.backend}"
        "OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4317"
        "OTEL_SERVICE_NAME=betrace-backend"
      ] ++ (pkgs.lib.mapAttrsToList (k: v: "${k}=${v}") commonConfig);

      # Exposed ports
      ExposedPorts = {
        "${toString ports.backend}/tcp" = {};
      };

      # Run as non-root user
      User = "betrace:betrace";

      # Working directory
      WorkingDir = "/app";

      # Labels for metadata
      Labels = {
        "org.opencontainers.image.title" = "BeTrace Backend";
        "org.opencontainers.image.description" = "BeTrace API server with OpenTelemetry";
        "org.opencontainers.image.vendor" = "BeTrace";
        "org.opencontainers.image.source" = "https://github.com/org/betrace";
      };
    };
  };

  # =========================================================================
  # Frontend Container (Caddy serving static files)
  # =========================================================================
  frontend =
    let
      # Caddyfile configuration
      caddyfile = pkgs.writeTextFile {
        name = "Caddyfile";
        text = ''
          :${toString ports.frontend} {
            root * /srv
            file_server
            try_files {path} /index.html

            # CORS headers for API requests
            header {
              Access-Control-Allow-Origin *
              Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
              Access-Control-Allow-Headers "Content-Type, Authorization"
            }

            # Gzip compression
            encode gzip

            # Logging
            log {
              output stdout
              format json
            }
          }
        '';
      };
    in
    pkgs.dockerTools.buildLayeredImage {
      name = "betrace-frontend";
      tag = "latest";
      maxLayers = 100;

      contents = with pkgs; [
        # Caddy web server
        caddy

        # Frontend static files
        frontend-package

        # Caddyfile
        caddyfile

        # Runtime dependencies
        cacert
        tzdata
        fakeNss
        (mkUser "caddy" 10002)
      ];

      config = {
        Cmd = [
          "${pkgs.caddy}/bin/caddy"
          "run"
          "--config"
          "${caddyfile}"
        ];

        Env = [
          "PATH=/bin"
        ] ++ (pkgs.lib.mapAttrsToList (k: v: "${k}=${v}") commonConfig);

        ExposedPorts = {
          "${toString ports.frontend}/tcp" = {};
        };

        User = "caddy:caddy";
        WorkingDir = "/srv";

        Labels = {
          "org.opencontainers.image.title" = "BeTrace Frontend";
          "org.opencontainers.image.description" = "BeTrace web UI served by Caddy";
          "org.opencontainers.image.vendor" = "BeTrace";
        };
      };
    };

  # =========================================================================
  # Grafana Container (with BeTrace plugin)
  # =========================================================================
  grafana =
    let
      # Grafana configuration
      grafanaIni = pkgs.writeTextFile {
        name = "grafana.ini";
        text = ''
          [server]
          http_port = ${toString ports.grafana}
          protocol = http

          [paths]
          plugins = /var/lib/grafana/plugins

          [security]
          admin_user = admin
          admin_password = admin

          [auth.anonymous]
          enabled = true
          org_role = Viewer

          [log]
          mode = console
          level = info

          [analytics]
          reporting_enabled = false
          check_for_updates = false
        '';
      };

      # Datasource provisioning
      yamlFormat = pkgs.formats.yaml {};
      datasources = yamlFormat.generate "datasources.yaml" {
        apiVersion = 1;
        datasources = [
          {
            name = "Loki";
            type = "loki";
            access = "proxy";
            url = "http://loki:${toString ports.loki}";
            isDefault = false;
          }
          {
            name = "Tempo";
            type = "tempo";
            access = "proxy";
            url = "http://tempo:${toString ports.tempo}";
            isDefault = true;
          }
          {
            name = "Prometheus";
            type = "prometheus";
            access = "proxy";
            url = "http://prometheus:${toString ports.prometheus}";
            isDefault = false;
          }
          {
            name = "Pyroscope";
            type = "pyroscope";
            access = "proxy";
            url = "http://pyroscope:${toString ports.pyroscope}";
            isDefault = false;
          }
        ];
      };

      # Plugin provisioning
      pluginDir = pkgs.linkFarm "grafana-plugins" [
        {
          name = "betrace-app";
          path = grafana-plugin-package;
        }
      ];

    in
    pkgs.dockerTools.buildLayeredImage {
      name = "betrace-grafana";
      tag = "latest";
      maxLayers = 100;

      contents = with pkgs; [
        grafana
        pluginDir
        grafanaIni
        datasources
        cacert
        tzdata
        fakeNss
        (mkUser "grafana" 10003)
      ];

      config = {
        Cmd = [
          "${pkgs.grafana}/bin/grafana-server"
          "--config=${grafanaIni}"
          "--homepath=${pkgs.grafana}/share/grafana"
        ];

        Env = [
          "PATH=/bin"
          "GF_PATHS_PLUGINS=${pluginDir}"
          "GF_PATHS_PROVISIONING=/etc/grafana/provisioning"
        ] ++ (pkgs.lib.mapAttrsToList (k: v: "${k}=${v}") commonConfig);

        ExposedPorts = {
          "${toString ports.grafana}/tcp" = {};
        };

        User = "grafana:grafana";
        WorkingDir = "/usr/share/grafana";

        Labels = {
          "org.opencontainers.image.title" = "BeTrace Grafana";
          "org.opencontainers.image.description" = "Grafana with BeTrace app plugin";
          "org.opencontainers.image.vendor" = "BeTrace";
        };
      };
    };

  # =========================================================================
  # Loki Container (Log aggregation)
  # =========================================================================
  loki =
    let
      yamlFormat = pkgs.formats.yaml {};
      lokiConfig = yamlFormat.generate "loki-config.yaml" {
        auth_enabled = false;

        server = {
          http_listen_port = ports.loki;
        };

        common = {
          path_prefix = "/tmp/loki";
          storage = {
            filesystem = {
              chunks_directory = "/tmp/loki/chunks";
              rules_directory = "/tmp/loki/rules";
            };
          };
          replication_factor = 1;
          ring = {
            kvstore = {
              store = "inmemory";
            };
          };
        };

        schema_config = {
          configs = [
            {
              from = "2024-01-01";
              store = "tsdb";
              object_store = "filesystem";
              schema = "v13";
              index = {
                prefix = "index_";
                period = "24h";
              };
            }
          ];
        };

        limits_config = {
          retention_period = "744h";  # 31 days
        };
      };
    in
    pkgs.dockerTools.buildLayeredImage {
      name = "betrace-loki";
      tag = "latest";
      maxLayers = 100;

      contents = with pkgs; [
        grafana-loki
        lokiConfig
        cacert
        tzdata
        fakeNss
        (mkUser "loki" 10004)
      ];

      config = {
        Cmd = [
          "${pkgs.grafana-loki}/bin/loki"
          "-config.file=${lokiConfig}"
        ];

        Env = [
          "PATH=/bin"
        ] ++ (pkgs.lib.mapAttrsToList (k: v: "${k}=${v}") commonConfig);

        ExposedPorts = {
          "${toString ports.loki}/tcp" = {};
        };

        User = "loki:loki";

        Labels = {
          "org.opencontainers.image.title" = "BeTrace Loki";
          "org.opencontainers.image.description" = "Loki log aggregation for BeTrace";
        };
      };
    };

  # =========================================================================
  # Tempo Container (Distributed tracing)
  # =========================================================================
  tempo =
    let
      yamlFormat = pkgs.formats.yaml {};
      tempoConfig = yamlFormat.generate "tempo-config.yaml" {
        server = {
          http_listen_port = ports.tempo;
        };

        distributor = {
          receivers = {
            otlp = {
              protocols = {
                grpc = {
                  endpoint = "0.0.0.0:4317";
                };
                http = {
                  endpoint = "0.0.0.0:4318";
                };
              };
            };
          };
        };

        storage = {
          trace = {
            backend = "local";
            local = {
              path = "/tmp/tempo/traces";
            };
            wal = {
              path = "/tmp/tempo/wal";
            };
          };
        };

        metrics_generator = {
          storage = {
            path = "/tmp/tempo/generator";
          };
        };
      };
    in
    pkgs.dockerTools.buildLayeredImage {
      name = "betrace-tempo";
      tag = "latest";
      maxLayers = 100;

      contents = with pkgs; [
        tempo
        tempoConfig
        cacert
        tzdata
        fakeNss
        (mkUser "tempo" 10005)
      ];

      config = {
        Cmd = [
          "${pkgs.tempo}/bin/tempo"
          "-config.file=${tempoConfig}"
        ];

        Env = [
          "PATH=/bin"
        ] ++ (pkgs.lib.mapAttrsToList (k: v: "${k}=${v}") commonConfig);

        ExposedPorts = {
          "${toString ports.tempo}/tcp" = {};
          "4317/tcp" = {};  # OTLP gRPC
          "4318/tcp" = {};  # OTLP HTTP
        };

        User = "tempo:tempo";

        Labels = {
          "org.opencontainers.image.title" = "BeTrace Tempo";
          "org.opencontainers.image.description" = "Tempo distributed tracing for BeTrace";
        };
      };
    };

  # =========================================================================
  # Prometheus Container (Metrics)
  # =========================================================================
  prometheus =
    let
      yamlFormat = pkgs.formats.yaml {};
      prometheusConfig = yamlFormat.generate "prometheus.yaml" {
        global = {
          scrape_interval = "15s";
          evaluation_interval = "15s";
        };

        scrape_configs = [
          {
            job_name = "betrace-backend";
            static_configs = [
              {
                targets = [ "backend:${toString ports.backend}" ];
              }
            ];
          }
          {
            job_name = "grafana";
            static_configs = [
              {
                targets = [ "grafana:${toString ports.grafana}" ];
              }
            ];
          }
          {
            job_name = "prometheus";
            static_configs = [
              {
                targets = [ "localhost:${toString ports.prometheus}" ];
              }
            ];
          }
        ];
      };
    in
    pkgs.dockerTools.buildLayeredImage {
      name = "betrace-prometheus";
      tag = "latest";
      maxLayers = 100;

      contents = with pkgs; [
        prometheus
        prometheusConfig
        cacert
        tzdata
        fakeNss
        (mkUser "prometheus" 10006)
      ];

      config = {
        Cmd = [
          "${pkgs.prometheus}/bin/prometheus"
          "--config.file=${prometheusConfig}"
          "--storage.tsdb.path=/tmp/prometheus"
          "--web.listen-address=:${toString ports.prometheus}"
        ];

        Env = [
          "PATH=/bin"
        ] ++ (pkgs.lib.mapAttrsToList (k: v: "${k}=${v}") commonConfig);

        ExposedPorts = {
          "${toString ports.prometheus}/tcp" = {};
        };

        User = "prometheus:prometheus";

        Labels = {
          "org.opencontainers.image.title" = "BeTrace Prometheus";
          "org.opencontainers.image.description" = "Prometheus metrics for BeTrace";
        };
      };
    };

  # =========================================================================
  # Convenience: All containers
  # =========================================================================
  all = pkgs.symlinkJoin {
    name = "betrace-containers-all";
    paths = [
      backend
      frontend
      grafana
      loki
      tempo
      prometheus
    ];
  };
}
