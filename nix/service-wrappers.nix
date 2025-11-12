{ pkgs, lib, grafana-plugin-package }:

let
  # Reusable port configuration
  ports = {
    frontend = 12010;
    backend = 12011;
    grafana = 12015;
    loki = 3100;
    loki_grpc = 9096;
    tempo = 3200;
    tempo_grpc = 9097;
    prometheus = 9090;
    pyroscope = 3210;
    pyroscope_grpc = 9105;
    alloy_http = 12345;
    otel_grpc = 4317;
    otel_http = 4318;
  };

  # Format generators
  yamlFormat = pkgs.formats.yaml {};
  iniFormat = pkgs.formats.ini {};

in
{
  # =========================================================================
  # Loki Service Wrapper
  # =========================================================================
  loki-wrapped =
    let
      lokiConfig = yamlFormat.generate "loki.yaml" {
        auth_enabled = false;

        server = {
          http_listen_port = ports.loki;
          grpc_listen_port = ports.loki_grpc;
        };

        analytics = {
          reporting_enabled = false;
        };

        common = {
          instance_addr = "127.0.0.1";
          path_prefix = ".dev/data/loki";
          storage = {
            filesystem = {
              chunks_directory = ".dev/data/loki/chunks";
              rules_directory = ".dev/data/loki/rules";
            };
          };
          replication_factor = 1;
          ring = {
            kvstore = {
              store = "inmemory";
            };
          };
        };

        query_range = {
          results_cache = {
            cache = {
              embedded_cache = {
                enabled = true;
                max_size_mb = 100;
              };
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

        ruler = {
          alertmanager_url = "http://localhost:9093";
        };
      };
    in
    pkgs.symlinkJoin {
      name = "loki-wrapped";
      paths = [ pkgs.grafana-loki ];
      buildInputs = [ pkgs.makeWrapper ];

      postBuild = ''
        wrapProgram $out/bin/loki \
          --run 'mkdir -p .dev/data/loki/{chunks,rules}' \
          --add-flags "--config.file=${lokiConfig}"
      '';

      meta = {
        description = "Loki with BeTrace configuration";
        mainProgram = "loki";
      };
    };

  # =========================================================================
  # Tempo Service Wrapper
  # =========================================================================
  tempo-wrapped =
    let
      tempoConfig = yamlFormat.generate "tempo.yaml" {
        server = {
          http_listen_port = ports.tempo;
          grpc_listen_port = ports.tempo_grpc;
        };

        distributor = {
          receivers = {
            otlp = {
              protocols = {
                grpc = {
                  endpoint = "0.0.0.0:${toString ports.otel_grpc}";
                };
                http = {
                  endpoint = "0.0.0.0:${toString ports.otel_http}";
                };
              };
            };
          };
        };

        storage = {
          trace = {
            backend = "local";
            local = {
              path = ".dev/data/tempo/traces";
            };
            wal = {
              path = ".dev/data/tempo/wal";
            };
          };
        };

        metrics_generator = {
          registry = {
            external_labels = {
              source = "tempo";
            };
          };
          storage = {
            path = ".dev/data/tempo/generator";
            remote_write = [
              {
                url = "http://localhost:${toString ports.prometheus}/api/v1/write";
                send_exemplars = true;
              }
            ];
          };
        };
      };
    in
    pkgs.symlinkJoin {
      name = "tempo-wrapped";
      paths = [ pkgs.tempo ];
      buildInputs = [ pkgs.makeWrapper ];

      postBuild = ''
        wrapProgram $out/bin/tempo \
          --run 'mkdir -p .dev/data/tempo/{traces,wal,generator}' \
          --add-flags "-config.file=${tempoConfig}"
      '';

      meta = {
        description = "Tempo with BeTrace configuration";
        mainProgram = "tempo";
      };
    };

  # =========================================================================
  # Prometheus Service Wrapper
  # =========================================================================
  prometheus-wrapped =
    let
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
                targets = [ "localhost:${toString ports.backend}" ];
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
          {
            job_name = "grafana";
            static_configs = [
              {
                targets = [ "localhost:${toString ports.grafana}" ];
              }
            ];
          }
        ];
      };
    in
    pkgs.symlinkJoin {
      name = "prometheus-wrapped";
      paths = [ pkgs.prometheus ];
      buildInputs = [ pkgs.makeWrapper ];

      postBuild = ''
        wrapProgram $out/bin/prometheus \
          --run 'mkdir -p .dev/data/prometheus' \
          --add-flags "--config.file=${prometheusConfig}" \
          --add-flags "--storage.tsdb.path=.dev/data/prometheus" \
          --add-flags "--web.listen-address=:${toString ports.prometheus}"
      '';

      meta = {
        description = "Prometheus with BeTrace configuration";
        mainProgram = "prometheus";
      };
    };

  # =========================================================================
  # Pyroscope Service Wrapper
  # =========================================================================
  pyroscope-wrapped =
    let
      pyroscopeConfig = yamlFormat.generate "pyroscope.yaml" {
        analytics = {
          reporting_enabled = false;
        };

        server = {
          http_listen_port = ports.pyroscope;
        };

        storage = {
          path = ".dev/data/pyroscope";
        };
      };
    in
    pkgs.symlinkJoin {
      name = "pyroscope-wrapped";
      paths = [ pkgs.pyroscope ];
      buildInputs = [ pkgs.makeWrapper ];

      postBuild = ''
        wrapProgram $out/bin/pyroscope \
          --run 'mkdir -p .dev/data/pyroscope' \
          --add-flags "server" \
          --add-flags "--config=${pyroscopeConfig}"
      '';

      meta = {
        description = "Pyroscope with BeTrace configuration";
        mainProgram = "pyroscope";
      };
    };

  # =========================================================================
  # Grafana Alloy Service Wrapper
  # =========================================================================
  alloy-wrapped =
    let
      # Alloy uses River format (not YAML/INI/JSON), so we keep it as a file
      alloyConfig = pkgs.writeTextFile {
        name = "alloy.river";
        text = ''
          // OTLP receivers
          otelcol.receiver.otlp "default" {
            grpc {
              endpoint = "0.0.0.0:${toString ports.otel_grpc}"
            }
            http {
              endpoint = "0.0.0.0:${toString ports.otel_http}"
            }

            output {
              logs    = [otelcol.processor.batch.default.input]
              traces  = [otelcol.processor.batch.default.input]
              metrics = [otelcol.processor.batch.default.input]
            }
          }

          // Batch processor
          otelcol.processor.batch "default" {
            output {
              logs    = [otelcol.exporter.loki.default.input]
              traces  = [otelcol.exporter.otlp.tempo.input]
              metrics = [otelcol.exporter.prometheus.default.input]
            }
          }

          // Loki exporter (logs)
          otelcol.exporter.loki "default" {
            forward_to = [loki.write.default.receiver]
          }

          loki.write "default" {
            endpoint {
              url = "http://localhost:${toString ports.loki}/loki/api/v1/push"
            }
          }

          // Tempo exporter (traces)
          otelcol.exporter.otlp "tempo" {
            client {
              endpoint = "localhost:${toString ports.tempo_grpc}"
              tls {
                insecure = true
              }
            }
          }

          // Prometheus exporter (metrics)
          otelcol.exporter.prometheus "default" {
            forward_to = [prometheus.remote_write.default.receiver]
          }

          prometheus.remote_write "default" {
            endpoint {
              url = "http://localhost:${toString ports.prometheus}/api/v1/write"
            }
          }
        '';
      };
    in
    pkgs.symlinkJoin {
      name = "alloy-wrapped";
      paths = [ pkgs.grafana-alloy ];
      buildInputs = [ pkgs.makeWrapper ];

      postBuild = ''
        wrapProgram $out/bin/alloy \
          --run 'mkdir -p .dev/data/alloy' \
          --add-flags "run" \
          --add-flags "${alloyConfig}" \
          --add-flags "--server.http.listen-addr=0.0.0.0:${toString ports.alloy_http}" \
          --add-flags "--storage.path=.dev/data/alloy"
      '';

      meta = {
        description = "Alloy with BeTrace telemetry pipeline configuration";
        mainProgram = "alloy";
      };
    };

  # =========================================================================
  # Grafana Service Wrapper
  # =========================================================================
  grafana-wrapped =
    let
      # Grafana INI config
      grafanaConfig = iniFormat.generate "grafana.ini" {
        paths = {
          data = ".dev/data/grafana/db";
          logs = ".dev/logs/grafana";
          plugins = ".dev/data/grafana/plugins";
          provisioning = ".dev/data/grafana/provisioning";
        };

        server = {
          http_port = toString ports.grafana;
          protocol = "http";
        };

        security = {
          admin_user = "admin";
          admin_password = "admin";
          disable_initial_admin_creation = false;
        };

        "auth.anonymous" = {
          enabled = true;
          org_role = "Admin";
        };

        users = {
          allow_sign_up = false;
          auto_assign_org = true;
          auto_assign_org_role = "Admin";
        };

        log = {
          mode = "console";
          level = "info";
        };

        analytics = {
          reporting_enabled = false;
          check_for_updates = false;
        };

        plugins = {
          allow_loading_unsigned_plugins = "betrace-app";
        };
      };

      # Datasources provisioning
      datasourcesYaml = yamlFormat.generate "datasources.yaml" {
        apiVersion = 1;
        datasources = [
          {
            name = "Loki";
            type = "loki";
            url = "http://localhost:${toString ports.loki}";
            uid = "loki";
            isDefault = true;
          }
          {
            name = "Tempo";
            type = "tempo";
            url = "http://localhost:${toString ports.tempo}";
            uid = "tempo";
            isDefault = false;
          }
          {
            name = "Prometheus";
            type = "prometheus";
            url = "http://localhost:${toString ports.prometheus}";
            uid = "prometheus";
            isDefault = false;
          }
          {
            name = "Pyroscope";
            type = "pyroscope";
            url = "http://localhost:${toString ports.pyroscope}";
            uid = "pyroscope";
            isDefault = false;
          }
        ];
      };

      # Dashboards provisioning
      dashboardsYaml = yamlFormat.generate "dashboards.yaml" {
        apiVersion = 1;
        providers = [
          {
            name = "BeTrace Dashboards";
            orgId = 1;
            folder = "";
            type = "file";
            disableDeletion = false;
            updateIntervalSeconds = 10;
            options = {
              path = ".dev/data/grafana/dashboards";
            };
          }
        ];
      };

      # Provisioning directory structure
      provisioningDir = pkgs.symlinkJoin {
        name = "grafana-provisioning";
        paths = [
          (pkgs.writeTextFile {
            name = "provisioning-datasources";
            destination = "/datasources/datasources.yaml";
            text = builtins.readFile datasourcesYaml;
          })
          (pkgs.writeTextFile {
            name = "provisioning-dashboards";
            destination = "/dashboards/dashboards.yaml";
            text = builtins.readFile dashboardsYaml;
          })
        ];
      };
    in
    pkgs.symlinkJoin {
      name = "grafana-wrapped";
      paths = [ pkgs.grafana ];
      buildInputs = [ pkgs.makeWrapper ];

      postBuild = ''
        wrapProgram $out/bin/grafana-server \
          --run 'mkdir -p .dev/data/grafana/{db,plugins,provisioning,dashboards}' \
          --run 'mkdir -p .dev/logs/grafana' \
          --run 'cp -r ${provisioningDir}/* .dev/data/grafana/provisioning/' \
          --run 'chmod -R u+w .dev/data/grafana/provisioning' \
          --run 'if [ -d grafana-betrace-app/dist ]; then rm -rf .dev/data/grafana/plugins/betrace-app && cp -r grafana-betrace-app/dist .dev/data/grafana/plugins/betrace-app && chmod -R u+w .dev/data/grafana/plugins/betrace-app; fi' \
          --add-flags "--config=${grafanaConfig}" \
          --add-flags "--homepath=${pkgs.grafana}/share/grafana"
      '';

      meta = {
        description = "Grafana with BeTrace plugin and datasources";
        mainProgram = "grafana-server";
      };
    };
}
