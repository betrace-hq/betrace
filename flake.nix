{
  description = "BeTrace - Pure Application Framework (Frontend + Backend)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    grafana-nix.url = "github:wscoble/grafana-nix";

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

  outputs = { self, nixpkgs, flake-utils, grafana-nix, betrace-frontend, betrace-backend, betrace-grafana-plugin, dev-tools }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Helper to run frontend serve
        frontendServe = pkgs.writeShellScriptBin "frontend-serve" ''
          PORT=''${PORT:-8080}
          echo "🌐 Starting Frontend on http://localhost:$PORT..."
          # Use Caddy for efficient static file serving
          exec ${pkgs.caddy}/bin/caddy file-server \
            --root ${betrace-frontend.packages.${system}.app} \
            --listen :$PORT \
            --browse
        '';

        # Helper to run backend serve
        backendServe = pkgs.writeShellScriptBin "backend-serve" ''
          echo "🚀 Starting Backend on port ''${PORT:-8081}..."
          exec ${betrace-backend.packages.${system}.app}/bin/betrace-backend
        '';

        # Helper script to run frontend dev from root
        frontendDevScript = pkgs.writeShellScriptBin "frontend-dev-from-root" ''
          cd bff && exec nix run .#dev
        '';

        # Helper script to build and watch Grafana plugin
        grafanaPluginDevScript = pkgs.writeShellScriptBin "grafana-plugin-dev" ''
          cd grafana-betrace-app

          # Install dependencies if needed
          if [ ! -d "node_modules" ]; then
            echo "📦 Installing Grafana plugin dependencies..."
            ${pkgs.nodejs}/bin/npm install
          fi

          echo "🔨 Building Grafana BeTrace plugin in watch mode..."
          echo "📂 Plugin will be available in dist/"
          exec ${pkgs.nodejs}/bin/npm run dev
        '';

        # RAG embeddings database builder
        buildEmbeddingsScript = pkgs.writeShellScriptBin "build-embeddings" ''
          echo "🔨 Building RAG embeddings database..."
          cd marketing && exec ${pkgs.nodejs}/bin/npm run build:embeddings
        '';

        # Helper script to run backend dev from root
        # Go backend with hot reload
        backendDevScript = pkgs.writeShellScriptBin "backend-dev-from-root" ''
          export BACKEND_PORT=${toString ports.backend}
          export PYROSCOPE_SERVER_ADDRESS=http://localhost:${toString ports.pyroscope}
          export PYROSCOPE_APPLICATION_NAME=betrace-backend

          # Use backend flake's dev app
          cd backend
          exec nix run .#dev
        '';

        # MCP Server dev script
        mcpServerDevScript = pkgs.writeShellScriptBin "mcp-server-dev" ''
          cd mcp-server

          # Build TypeScript if needed
          if [ ! -d "dist" ] || [ ! -f "node_modules/.bin/tsc" ]; then
            echo "📦 Installing MCP server dependencies..."
            ${pkgs.nodejs}/bin/npm install
            echo "🔨 Building MCP server..."
            ${pkgs.nodejs}/bin/npm run build
          fi

          echo "🤖 Starting BeTrace MCP Server (Streamable HTTP)"
          echo "📚 Provides AI assistants access to:"
          echo "   - BeTrace documentation (setup, DSL, AI safety, compliance)"
          echo "   - DSL creation tools"
          echo "   - Setup assistance"
          echo "   - Troubleshooting guides"
          echo ""

          # Run the server
          exec ${pkgs.nodejs}/bin/node dist/index.js
        '';

        # Backend test script - direct app execution
        backendTestScript = betrace-backend.apps.${system}.test;

        # Caddy reverse proxy configuration as Nix expression
        caddyConfigData = {
          apps = {
            http = {
              servers = {
                betrace-dev = {
                  listen = [ ":${toString ports.caddy}" ];
                  automatic_https = {
                    disable = true;
                  };
                  routes = [
                    # Telemetry API routes (path-based, must come before subdomains)
                    {
                      match = [{ path = [ "/api/otlp/*" ]; }];
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.otelCollectorHttp}"; }];
                        rewrite = {
                          strip_path_prefix = "/api/otlp";
                        };
                      }];
                      terminal = true;
                    }
                    {
                      match = [{ path = [ "/api/pyroscope/*" ]; }];
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.pyroscope}"; }];
                        rewrite = {
                          strip_path_prefix = "/api/pyroscope";
                        };
                      }];
                      terminal = true;
                    }
                    # Subdomain routes (more specific, must come first)
                    # API subdomain route
                    {
                      match = [{ host = [ "api.localhost" ]; }];
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.backend}"; }];
                        headers = {
                          request = {
                            set = {
                              Host = ["localhost:${toString ports.backend}"];
                              X-Forwarded-Host = ["{http.request.host}"];
                              X-Forwarded-Proto = ["{http.request.scheme}"];
                            };
                          };
                        };
                      }];
                      terminal = true;
                    }
                    # Process compose UI subdomain route
                    {
                      match = [{ host = [ "process-compose.localhost" ]; }];
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.processComposeUI}"; }];
                      }];
                      terminal = true;
                    }
                    # Grafana subdomain route
                    {
                      match = [{ host = [ "grafana.localhost" ]; }];
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.grafana}"; }];
                      }];
                      terminal = true;
                    }
                    # Main frontend route (catch-all, must come last)
                    {
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.frontend}"; }];
                      }];
                    }
                  ];
                };
              };
            };
          };
        };

        # Generate Caddy JSON config from Nix expression
        caddyConfig = (pkgs.formats.json {}).generate "caddy.json" caddyConfigData;

        # Grafana datasource provisioning (immutable)
        grafanaDatasourcesYaml = (pkgs.formats.yaml {}).generate "datasources.yaml" {
          apiVersion = 1;
          datasources = [
            {
              name = "Loki";
              type = "loki";
              access = "proxy";
              url = "http://localhost:${toString ports.loki}";
              uid = "loki";
              isDefault = true;
              editable = true;
              jsonData = {
                maxLines = 1000;
              };
            }
            {
              name = "Tempo";
              type = "tempo";
              access = "proxy";
              url = "http://localhost:${toString ports.tempo}";
              uid = "tempo";
              isDefault = false;
              editable = true;
              jsonData = {
                httpMethod = "GET";
                tracesToLogsV2 = {
                  datasourceUid = "loki";
                  spanStartTimeShift = "-1h";  # Look back 1h from span start
                  spanEndTimeShift = "1h";     # Look forward 1h from span end
                  filterByTraceID = true;
                  filterBySpanID = false;
                  tags = [
                    { key = "service.name"; value = "service_name"; }
                  ];
                };
                # Service map and node graph require Tempo metrics-generator
                # Disabled for now since we don't have it configured
                nodeGraph = {
                  enabled = false;
                };
              };
            }
            {
              name = "Prometheus";
              type = "prometheus";
              access = "proxy";
              url = "http://localhost:${toString ports.prometheus}";
              uid = "prometheus";
              isDefault = false;
              editable = true;
              jsonData = {
                httpMethod = "POST";
                prometheusType = "Prometheus";
                prometheusVersion = "2.40.0";
                customQueryParameters = "";
                timeInterval = "15s";
              };
            }
            {
              name = "Pyroscope";
              type = "grafana-pyroscope-datasource";
              access = "proxy";
              url = "http://localhost:${toString ports.pyroscope}";
              uid = "pyroscope";
              isDefault = false;
              editable = true;
            }
          ];
        };

        # Copy dashboard JSON files to Nix store
        grafanaDashboards = pkgs.runCommand "grafana-dashboards" {} ''
          mkdir -p $out
          cp ${./grafana-dashboards}/*.json $out/
        '';

        # Grafana dashboard provisioning YAML (immutable)
        grafanaDashboardsYaml = (pkgs.formats.yaml {}).generate "dashboards.yaml" {
          apiVersion = 1;
          providers = [
            {
              name = "BeTrace Dashboards";
              type = "file";
              options = {
                path = "${grafanaDashboards}";
              };
            }
          ];
        };

        # Grafana provisioning directory (immutable)
        grafanaProvisioning = pkgs.runCommand "grafana-provisioning" {} ''
          mkdir -p $out/datasources $out/dashboards
          ln -s ${grafanaDatasourcesYaml} $out/datasources/datasources.yaml
          ln -s ${grafanaDashboardsYaml} $out/dashboards/dashboards.yaml
        '';

        # Grafana configuration (immutable, uses GF_ env vars for runtime paths)
        # Note: Using writeText instead of formats.ini because Grafana uses dotted section names
        # like [auth.anonymous] which aren't well-supported by Nix INI generators
        grafanaIni = pkgs.writeText "grafana.ini" ''
          [paths]
          provisioning = ${grafanaProvisioning}

          [server]
          http_port = ${toString ports.grafana}

          [log]
          mode = console

          [analytics]
          reporting_enabled = false

          [security]
          admin_user = admin
          admin_password = admin

          [auth.anonymous]
          enabled = true
          org_role = Admin

          [auth]
          disable_login_form = false
        '';

        # Grafana Alloy configuration (River format)
        # Hybrid approach: ALL traces to compliance backend, sampled traces to Tempo
        alloyConfig = pkgs.writeText "alloy-config.river" ''
          // Local file discovery for log tailing
          local.file_match "logs" {
            path_targets = [
              {
                __path__ = "/tmp/betrace-*.log",
                job      = "betrace-services",
              },
            ]
          }

          // Log file tailing
          loki.source.file "logs" {
            targets    = local.file_match.logs.targets
            forward_to = [loki.process.logs.receiver]
          }

          // Process logs - parse process-compose JSON wrapper and extract inner log level
          loki.process "logs" {
            // Parse outer JSON from process-compose
            stage.json {
              expressions = {
                pc_level    = "level",
                log_message = "message",
                log_process = "process",
              }
            }

            // Set service label from process name
            stage.labels {
              values = {
                service = "log_process",
              }
            }

            // Extract log level from Maven/Quarkus style: [INFO], [WARN], [ERROR], [DEBUG]
            stage.regex {
              source     = "log_message"
              expression = "\\[(?P<maven_level>INFO|WARN|ERROR|DEBUG)\\]"
            }

            // Extract log level from observability tools: level=info, level=warn, level=error
            stage.regex {
              source     = "log_message"
              expression = "level=(?P<app_level>\\w+)"
            }

            // Use maven_level if present, otherwise app_level, otherwise default to info
            stage.template {
              source   = "level"
              template = "{{ if .maven_level }}{{ .maven_level }}{{ else if .app_level }}{{ .app_level }}{{ else }}info{{ end }}"
            }

            stage.labels {
              values = {
                level = "",
              }
            }

            // Replace line with just the message content (unwrap from JSON)
            stage.output {
              source = "log_message"
            }

            forward_to = [loki.write.default.receiver]
          }

          // OTLP receiver for traces and logs
          otelcol.receiver.otlp "default" {
            grpc {
              endpoint = "0.0.0.0:${toString ports.otelCollector}"
            }
            http {
              endpoint = "0.0.0.0:${toString ports.otelCollectorHttp}"
              cors {
                allowed_origins = ["http://localhost:3000", "http://localhost:12010"]
                allowed_headers = ["*"]
              }
            }

            output {
              traces  = [otelcol.processor.batch.traces.input]
              logs    = [otelcol.processor.batch.logs.input]
            }
          }

          // Batch processor for traces before sampling
          otelcol.processor.batch "traces" {
            timeout          = "1s"
            send_batch_size  = 1024

            output {
              traces = [otelcol.processor.tail_sampling.default.input]
            }
          }

          // Batch processor for logs
          otelcol.processor.batch "logs" {
            timeout          = "1s"
            send_batch_size  = 1024

            output {
              logs = [otelcol.exporter.loki.default.input]
            }
          }

          // Tail-based sampling: Keep errors, slow requests, and interesting traces
          otelcol.processor.tail_sampling "default" {
            // Decision wait time (how long to wait for full trace)
            decision_wait = "10s"

            // Sample 100% of errors
            policy {
              name = "errors"
              type = "status_code"
              status_code {
                status_codes = ["ERROR"]
              }
            }

            // Sample slow requests (>1s)
            policy {
              name = "slow"
              type = "latency"
              latency {
                threshold_ms = 1000
              }
            }

            // Sample 10% of normal requests
            policy {
              name = "probabilistic"
              type = "probabilistic"
              probabilistic {
                sampling_percentage = 10
              }
            }

            // Always sample traces with compliance signals
            policy {
              name = "compliance_signals"
              type = "string_attribute"
              string_attribute {
                key    = "betrace.compliance.violated"
                values = ["true"]
              }
            }

            output {
              traces = [
                otelcol.exporter.otlp.tempo.input,
                otelcol.connector.servicegraph.default.input,
              ]
            }
          }

          // Service graph connector: Generate RED metrics from traces
          otelcol.connector.servicegraph "default" {
            dimensions = [
              "tenant_id",
              "service.name",
              "service.version",
            ]

            // Store config for service graph
            store {
              ttl      = "2s"
              max_items = 1000
            }

            output {
              metrics = [otelcol.exporter.prometheus.servicegraph.input]
            }
          }

          // Export to Tempo (sampled traces only) - use gRPC port
          otelcol.exporter.otlp "tempo" {
            client {
              endpoint = "localhost:${toString ports.tempoGrpc}"
              tls {
                insecure = true
              }
            }
          }

          // Export logs to Loki
          otelcol.exporter.loki "default" {
            forward_to = [loki.write.default.receiver]
          }

          // Loki write endpoint
          loki.write "default" {
            endpoint {
              url = "http://localhost:${toString ports.loki}/loki/api/v1/push"
            }
          }

          // Service graph metrics - export as internal metrics for now
          // Backend will be scraped directly by Grafana's Prometheus datasource
          otelcol.exporter.prometheus "servicegraph" {
            forward_to = []  // Metrics available via internal endpoint
          }
        '';

        # Helper script to restart services after config changes
        restartServices = pkgs.writeShellScriptBin "restart-services" ''
          set -e

          echo "🔄 Restarting services with updated configs..."

          # Restart observability services
          ${pkgs.process-compose}/bin/process-compose process restart loki || true
          ${pkgs.process-compose}/bin/process-compose process restart tempo || true
          ${pkgs.process-compose}/bin/process-compose process restart alloy || true
          ${pkgs.process-compose}/bin/process-compose process restart pyroscope || true
          ${pkgs.process-compose}/bin/process-compose process restart prometheus || true
          ${pkgs.process-compose}/bin/process-compose process restart grafana || true

          echo "✅ Services restarted"
        '';

        # Grafana Tempo configuration
        # Grafana Loki configuration
        lokiConfig = (pkgs.formats.yaml {}).generate "config.yaml" {
          auth_enabled = false;

          server = {
            http_listen_port = ports.loki;
            grpc_listen_port = ports.lokiGrpc;
          };

          analytics = {
            reporting_enabled = false;
          };

          common = {
            instance_addr = "127.0.0.1";
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
            configs = [{
              from = "2024-01-01";
              store = "tsdb";
              object_store = "filesystem";
              schema = "v13";
              index = {
                prefix = "index_";
                period = "24h";
              };
            }];
          };

          ruler = {
            alertmanager_url = "http://localhost:9093";
          };
        };

        # Grafana Pyroscope configuration
        pyroscopeConfig = (pkgs.formats.yaml {}).generate "pyroscope-config.yaml" {
          server = {
            http_listen_port = ports.pyroscope;
            grpc_listen_port = ports.pyroscopeGrpc;
          };

          storage = {
            backend = "filesystem";
            filesystem = {
              dir = "/tmp/pyroscope/data";
            };
          };

          analytics = {
            reporting_enabled = false;
          };
        };

        # Prometheus configuration
        prometheusConfig = (pkgs.formats.yaml {}).generate "prometheus.yaml" {
          global = {
            scrape_interval = "15s";
            evaluation_interval = "15s";
          };

          scrape_configs = [
            {
              job_name = "betrace-backend";
              static_configs = [{
                targets = [ "localhost:${toString ports.backend}" ];
                labels = {
                  service = "betrace-backend";
                };
              }];
              metrics_path = "/metrics";
            }
            {
              job_name = "prometheus";
              static_configs = [{
                targets = [ "localhost:${toString ports.prometheus}" ];
              }];
            }
          ];
        };

        # Grafana Tempo configuration
        tempoConfig = (pkgs.formats.yaml {}).generate "tempo-config.yaml" {
          server = {
            http_listen_port = ports.tempo;
            grpc_listen_port = ports.tempoGrpc;
          };

          usage_report = {
            reporting_enabled = false;
          };

          distributor = {
            receivers = {
              otlp = {
                protocols = {
                  grpc = { };
                };
              };
            };
            ring = {
              kvstore = {
                store = "inmemory";
              };
            };
          };

          ingester = {
            trace_idle_period = "10s";
            max_block_bytes = 1000000;
            max_block_duration = "5m";
            lifecycler = {
              ring = {
                replication_factor = 1;
                kvstore = {
                  store = "inmemory";
                };
              };
            };
          };

          compactor = {
            ring = {
              kvstore = {
                store = "inmemory";
              };
            };
            compaction = {
              compaction_window = "1h";
              max_compaction_objects = 1000000;
              block_retention = "1h";
              compacted_block_retention = "10m";
            };
          };

          metrics_generator = {
            ring = {
              kvstore = {
                store = "inmemory";
              };
            };
            processor = {
              service_graphs = { };
              span_metrics = { };
              local_blocks = {
                flush_to_storage = false;
                complete_block_timeout = "30m";  # Allow 30min queries
              };
            };
            storage = {
              path = "/tmp/tempo/generator/wal";
              remote_write = [];
            };
            traces_storage = {
              path = "/tmp/tempo/wal";
            };
          };

          querier = {
            frontend_worker = {
              frontend_address = "127.0.0.1:${toString ports.tempoGrpc}";
            };
          };

          query_frontend = {
            search = {
              duration_slo = "5s";
              throughput_bytes_slo = 1.073741824e+09;
            };
            trace_by_id = {
              duration_slo = "5s";
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
              pool = {
                max_workers = 100;
                queue_depth = 10000;
              };
            };
          };

          overrides = {
            defaults = {
              metrics_generator = {
                processors = ["service-graphs" "span-metrics" "local-blocks"];
              };
            };
          };
        };

        # Caddy proxy server
        caddyProxy = pkgs.writeShellScriptBin "caddy-proxy" ''
          echo "🌐 Starting Caddy Reverse Proxy"
          echo "=============================="
          echo "🏠 Main:           http://localhost:${toString ports.caddy} → Frontend"
          echo "🔗 API:            http://api.localhost:${toString ports.caddy} → Backend"
          echo "🎛️  Process UI:     http://process-compose.localhost:${toString ports.caddy}"
          echo "📊 Grafana:        http://grafana.localhost:${toString ports.caddy}"
          echo ""

          exec ${pkgs.caddy}/bin/caddy run --config ${caddyConfig}
        '';

        # Port configuration as Nix expressions
        ports = {
          caddy = 3000;
          frontend = 12010;
          backend = 12011;
          processComposeUI = 12013;
          grafana = 12015;
          mcpServer = 12016;         # MCP Server (HTTP for health checks)
          prometheus = 9090;         # Prometheus HTTP
          loki = 3100;               # Loki HTTP
          lokiGrpc = 9096;           # Loki gRPC
          otelCollector = 4317;      # OTLP gRPC receiver
          otelCollectorHttp = 4318;  # OTLP HTTP receiver
          tempo = 3200;              # Tempo HTTP
          tempoGrpc = 9095;          # Tempo gRPC
          pyroscope = 4040;          # Pyroscope HTTP
          pyroscopeGrpc = 9097;      # Pyroscope gRPC
        };

        # Process-compose configuration for development
        devProcessCompose = (pkgs.formats.yaml {}).generate "process-compose-dev.yaml" {
            version = "0.5";

            # Process-compose UI configuration - non-conflicting port
            server = {
              host = "127.0.0.1";
              port = ports.processComposeUI;
            };

            processes = {
              # Frontend (Vite dev server)
              frontend = {
                command = "${frontendDevScript}/bin/frontend-dev-from-root";
                environment = [
                  "PORT=${toString ports.frontend}"
                ];
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.frontend;
                    path = "/";
                  };
                  initial_delay_seconds = 5;
                  period_seconds = 10;
                };
                availability = {
                  restart = "always";
                };
                log_location = "/tmp/betrace-frontend.log";
                description = "BeTrace Frontend (React + Vite) - Port ${toString ports.frontend}";
              };

              # Backend API
              backend = {
                command = "${backendDevScript}/bin/backend-dev-from-root";
                environment = [ "BACKEND_PORT=${toString ports.backend}" ];
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.backend;
                    path = "/health";
                  };
                  initial_delay_seconds = 5;
                  period_seconds = 10;
                };
                availability = {
                  restart = "always";
                };
                log_location = "/tmp/betrace-backend.log";
                description = "BeTrace Backend (Go API) - Port ${toString ports.backend}";
              };

              # Infrastructure services (Grafana observability stack)

              # Grafana for observability
              # Grafana Tempo for trace storage
              # Loki log aggregation
              loki = {
                command = ''
                  # Create Loki directories
                  mkdir -p /tmp/loki/{chunks,rules}

                  # Start Loki with immutable config from Nix store
                  exec ${pkgs.grafana-loki}/bin/loki -config.file ${lokiConfig}
                '';
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.loki;
                    path = "/ready";
                  };
                  initial_delay_seconds = 10;
                  period_seconds = 10;
                  failure_threshold = 5;
                };
                availability = {
                  restart = "always";
                };
                log_location = "/tmp/betrace-loki.log";
                description = "Grafana Loki - Log Aggregation - Port ${toString ports.loki}";
              };

              tempo = {
                command = ''
                  # Create Tempo directories
                  mkdir -p /tmp/tempo/{traces,wal,generator/wal}

                  # Start Tempo
                  exec ${pkgs.tempo}/bin/tempo \
                    -config.file=${tempoConfig}
                '';
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.tempo;
                    path = "/ready";
                  };
                  initial_delay_seconds = 90;  # Tempo compactor waits 1-5min for ring stability
                  period_seconds = 10;
                  failure_threshold = 10;  # Allow 100s of failures before restart
                };
                availability = {
                  restart = "always";
                };
                log_location = "/tmp/betrace-tempo.log";
                description = "Grafana Tempo - Trace Storage - Port ${toString ports.tempo}";
              };

              # Pyroscope for continuous profiling
              pyroscope = {
                command = ''
                  # Create Pyroscope data directory
                  mkdir -p /tmp/pyroscope/data

                  # Start Pyroscope
                  exec ${pkgs.pyroscope}/bin/pyroscope -config.file=${pyroscopeConfig}
                '';
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.pyroscope;
                    path = "/ready";
                  };
                  initial_delay_seconds = 10;
                  period_seconds = 10;
                  failure_threshold = 5;
                };
                availability = {
                  restart = "always";
                };
                log_location = "/tmp/betrace-pyroscope.log";
                description = "Grafana Pyroscope - Continuous Profiling - Port ${toString ports.pyroscope}";
              };

              # Prometheus for metrics storage and querying
              prometheus = {
                command = ''
                  # Create Prometheus data directory
                  mkdir -p /tmp/prometheus/data

                  # Start Prometheus
                  exec ${pkgs.prometheus}/bin/prometheus --config.file=${prometheusConfig} --storage.tsdb.path=/tmp/prometheus/data --web.listen-address=:${toString ports.prometheus} --web.enable-lifecycle
                '';
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.prometheus;
                    path = "/-/ready";
                  };
                  initial_delay_seconds = 5;
                  period_seconds = 10;
                  failure_threshold = 5;
                };
                availability = {
                  restart = "always";
                };
                log_location = "/tmp/betrace-prometheus.log";
                description = "Prometheus - Metrics Storage - Port ${toString ports.prometheus}";
              };

              # Grafana Alloy (replaces OTEL Collector)
              alloy = {
                command = ''
                  # Create writable storage directory for Alloy
                  ALLOY_STORAGE=$(mktemp -d -p /tmp alloy-storage.XXXXXX)
                  trap "rm -rf $ALLOY_STORAGE" EXIT

                  # Alloy 'run' subcommand ONLY accepts config path - no flags!
                  # Use environment variables for server configuration
                  export CUSTOM_STORAGE_PATH="$ALLOY_STORAGE"

                  exec ${pkgs.grafana-alloy}/bin/alloy run --disable-reporting ${alloyConfig}
                '';
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = 12345;
                    path = "/-/ready";
                  };
                  initial_delay_seconds = 5;
                  period_seconds = 10;
                };
                availability = {
                  restart = "always";
                };
                log_location = "/tmp/betrace-alloy.log";
                description = "Grafana Alloy - Telemetry Pipeline - Ports ${toString ports.otelCollector}/${toString ports.otelCollectorHttp}";
              };

              grafana = {
                command = ''
                  # Create writable directory with mktemp
                  GRAFANA_DATA=$(mktemp -d -p /tmp grafana-data.XXXXXX)
                  trap "rm -rf $GRAFANA_DATA" EXIT

                  mkdir -p $GRAFANA_DATA/{logs,plugins}

                  # Symlink BeTrace plugin from workspace (dev mode only)
                  WORKSPACE_PLUGIN="$(pwd)/grafana-betrace-app/dist"
                  if [ -d "$WORKSPACE_PLUGIN" ] && [ -f "$WORKSPACE_PLUGIN/plugin.json" ]; then
                    echo "🔌 Using BeTrace plugin from workspace: $WORKSPACE_PLUGIN"
                    ln -sf "$WORKSPACE_PLUGIN" "$GRAFANA_DATA/plugins/betrace-app"
                  else
                    echo "⚠️  BeTrace plugin not built. Run 'grafana-plugin' process to build."
                  fi

                  # Use immutable config, override writable paths with env vars
                  export GF_PATHS_DATA="$GRAFANA_DATA"
                  export GF_PATHS_LOGS="$GRAFANA_DATA/logs"
                  export GF_PATHS_PLUGINS="$GRAFANA_DATA/plugins"
                  export GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS="betrace-app"

                  # Start Grafana with immutable config from Nix store
                  ${pkgs.grafana}/bin/grafana server --homepath ${pkgs.grafana}/share/grafana --config ${grafanaIni}
                '';
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.grafana;
                    path = "/api/health";
                  };
                  initial_delay_seconds = 5;
                  period_seconds = 5;
                };
                availability = {
                  restart = "always";
                };
                log_location = "/tmp/betrace-grafana.log";
                description = "Grafana Observability - Port ${toString ports.grafana}";
              };

              # Caddy reverse proxy
              caddy-proxy = {
                command = ''
                  # Kill any existing Caddy processes
                  pkill -9 caddy || true
                  sleep 1
                  # Start Caddy
                  ${caddyProxy}/bin/caddy-proxy
                '';
                availability = {
                  restart = "always";
                };
                log_location = "/tmp/betrace-caddy.log";
                description = "Caddy Reverse Proxy - Port ${toString ports.caddy}";
              };

              # MCP Server for AI documentation access
              mcp-server = {
                command = "${mcpServerDevScript}/bin/mcp-server-dev";
                environment = [
                  "MCP_PORT=${toString ports.mcpServer}"
                ];
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.mcpServer;
                    path = "/health";
                  };
                  initial_delay_seconds = 5;
                  period_seconds = 10;
                };
                availability = {
                  restart = "on_failure";
                };
                log_location = "/tmp/betrace-mcp-server.log";
                description = "BeTrace MCP Server (AI Documentation & DSL Tools) - Port ${toString ports.mcpServer}";
              };

              # Grafana Plugin (webpack watch mode)
              grafana-plugin = {
                command = "${grafanaPluginDevScript}/bin/grafana-plugin-dev";
                availability = {
                  restart = "on_failure";
                };
                log_location = "/tmp/betrace-grafana-plugin.log";
                description = "BeTrace Grafana App Plugin (Webpack Watch Mode)";
              };
            };
          };

        # Local development environment orchestrator using process-compose
        devOrchestrator = pkgs.writeShellScriptBin "dev-orchestrator" ''
          echo "🚀 BeTrace Development Orchestrator"
          echo "=============================="
          echo ""
          echo "📋 Starting services with process-compose..."
          echo "🌐 Caddy Proxy:   http://localhost:${toString ports.caddy} (main access point)"
          echo ""
          echo "🔗 Service URLs (via Caddy proxy):"
          echo "   🏠 Frontend:        http://localhost:${toString ports.caddy}"
          echo "   🔗 API:             http://api.localhost:${toString ports.caddy}"
          echo "   📊 Grafana + BeTrace:  http://grafana.localhost:${toString ports.caddy}"
          echo "   🎛️  Process UI:      http://process-compose.localhost:${toString ports.caddy}"
          echo ""
          echo "🔧 Direct Service Ports:"
          echo "   🌐 Frontend:       http://localhost:${toString ports.frontend}"
          echo "   ☕ Backend:        http://localhost:${toString ports.backend}"
          echo "   📊 Grafana:        http://localhost:${toString ports.grafana}"
          echo "   🎛️  Process UI:     http://localhost:${toString ports.processComposeUI}"
          echo "   🤖 MCP Server:     http://localhost:${toString ports.mcpServer}"
          echo ""
          echo "📊 Grafana Observability Stack:"
          echo "   Loki:       http://localhost:${toString ports.loki}"
          echo "   Tempo:      http://localhost:${toString ports.tempo}"
          echo "   Prometheus: http://localhost:${toString ports.prometheus}"
          echo "   Pyroscope:  http://localhost:${toString ports.pyroscope}"
          echo ""
          echo "💡 BeTrace Grafana Plugin:"
          echo "   Access at: http://grafana.localhost:${toString ports.caddy}/a/betrace-app"
          echo "   Login: admin/admin"
          echo "   Test backend connectivity from plugin UI"
          echo ""
          echo "🎮 Controls:"
          echo "  • Press Ctrl+C to stop all services"
          echo "  • Web UI: http://process-compose.localhost:${toString ports.caddy}"
          echo ""

          # Auto-detect if we should use TUI (interactive) or logs (non-interactive)
          if [ -t 0 ]; then
            exec ${pkgs.process-compose}/bin/process-compose -f ${devProcessCompose} --tui=true
          else
            exec ${pkgs.process-compose}/bin/process-compose -f ${devProcessCompose} --tui=false
          fi
        '';

        # Individual development helpers
        frontendDev = pkgs.writeShellScriptBin "frontend-dev" ''
          echo "🌐 Starting BeTrace Frontend development..."
          cd bff && nix run .#dev
        '';

        backendDev = pkgs.writeShellScriptBin "backend-dev" ''
          echo "☕ Starting BeTrace Backend development..."
          cd backend && nix run .#dev
        '';

        # Build orchestrator
        buildAll = pkgs.writeShellScriptBin "build-all" ''
          echo "🔨 Building BeTrace Applications"
          echo "============================"
          echo ""

          echo "📦 Building Frontend..."
          cd bff && nix build
          FRONTEND_BUILD=$?

          echo ""
          echo "☕ Building Backend..."
          cd ../backend && nix build
          BACKEND_BUILD=$?

          echo ""
          if [ $FRONTEND_BUILD -eq 0 ] && [ $BACKEND_BUILD -eq 0 ]; then
            echo "✅ All builds successful!"
            echo "📦 Frontend artifacts: ./bff/result/"
            echo "☕ Backend artifacts:  ./backend/result/"
          else
            echo "❌ Build failed!"
            [ $FRONTEND_BUILD -ne 0 ] && echo "  Frontend build failed"
            [ $BACKEND_BUILD -ne 0 ] && echo "  Backend build failed"
            exit 1
          fi
        '';

        # Import test-runner infrastructure
        testRunnerInfra = import ./.flox/pkgs/dev-tools/test-runner.nix {
          inherit pkgs system betrace-frontend betrace-backend;
          inherit dev-tools;
        };

        # Test orchestrator (simple version for backward compatibility)
        testAll = testRunnerInfra.test;

        # Process-compose configuration for production
        prodProcessCompose = (pkgs.formats.yaml {}).generate "process-compose-prod.yaml" {
          version = "0.5";

          processes = {
            frontend = {
              command = "PORT=8080 ${frontendServe}/bin/frontend-serve";
              readiness_probe = {
                http_get = {
                  host = "127.0.0.1";
                  port = 8080;
                  path = "/";
                };
              };
              availability = {
                restart = "always";
              };
              log_location = "/tmp/betrace-frontend-prod.log";
              description = "BeTrace Frontend (Static Server)";
            };

            backend = {
              command = "PORT=8081 ${backendServe}/bin/backend-serve";
              readiness_probe = {
                http_get = {
                  host = "127.0.0.1";
                  port = 8081;
                  path = "/q/health";
                };
              };
              availability = {
                restart = "always";
              };
              log_location = "/tmp/betrace-backend-prod.log";
              description = "BeTrace Backend (Production JAR)";
            };
          };
        };

        # Production server (serves both apps locally)
        productionServe = pkgs.writeShellScriptBin "production-serve" ''
          echo "🚀 BeTrace Production Preview"
          echo "========================"
          echo ""
          echo "📦 Using built applications..."
          echo "🌐 Frontend: http://localhost:8080"
          echo "☕ Backend:  http://localhost:8081"
          echo ""
          echo "🎮 Controls:"
          echo "  • Press 'h' for help"
          echo "  • Press 'q' to quit"
          echo "  • Press 'r' to restart a process"
          echo ""

          exec ${pkgs.process-compose}/bin/process-compose -f ${prodProcessCompose}
        '';

        # Status checker
        statusChecker = pkgs.writeShellScriptBin "status-checker" ''
          echo "📊 BeTrace Application Status"
          echo "========================="
          echo ""

          # Check git status
          echo "📋 Git Status:"
          git status --porcelain | head -5
          echo ""

          # Check build status
          echo "🔨 Build Status:"
          if [ -f "bff/result" ]; then
            echo "  ✅ Frontend: Built"
          else
            echo "  ❌ Frontend: Not built (run: nix build)"
          fi

          if [ -f "backend/result" ]; then
            echo "  ✅ Backend: Built"
          else
            echo "  ❌ Backend: Not built (run: nix build)"
          fi

          echo ""
          echo "🚀 Quick Start:"
          echo "  nix run .#dev        - Start development servers"
          echo "  nix run .#build      - Build both applications"
          echo "  nix run .#test       - Run all tests"
          echo "  nix run .#serve      - Production preview"
        '';

        # Setup prompt with test stats
        setupPrompt = pkgs.writeShellScriptBin "setup-betrace-prompt" ''
          # Create .betrace-dev directory in home
          mkdir -p "$HOME/.betrace-dev"

          # Copy prompt stats script
          cat > "$HOME/.betrace-dev/prompt-stats.sh" <<'EOF'
          ${builtins.readFile ./dev-tools/prompt-stats.sh}
          EOF
          chmod +x "$HOME/.betrace-dev/prompt-stats.sh"

          # Copy ZSH theme
          cat > "$HOME/.betrace-dev/betrace-prompt-theme.zsh" <<'EOF'
          ${builtins.readFile ./dev-tools/betrace-prompt-theme.zsh}
          EOF

          # Add to .zshrc if not already present
          if [ -f "$HOME/.zshrc" ]; then
            if ! grep -q "betrace-prompt-theme.zsh" "$HOME/.zshrc"; then
              echo "" >> "$HOME/.zshrc"
              echo "# BeTrace development prompt" >> "$HOME/.zshrc"
              echo "source \$HOME/.betrace-dev/betrace-prompt-theme.zsh" >> "$HOME/.zshrc"
              echo "✅ Added BeTrace prompt to ~/.zshrc"
              echo "   Run 'source ~/.zshrc' or restart your shell to activate"
            else
              echo "✅ BeTrace prompt already configured in ~/.zshrc"
            fi
          else
            echo "⚠️  ~/.zshrc not found. Creating it..."
            cat > "$HOME/.zshrc" <<'ZSHRC'
          # BeTrace development prompt
          source $HOME/.betrace-dev/betrace-prompt-theme.zsh
          ZSHRC
            echo "✅ Created ~/.zshrc with BeTrace prompt"
          fi

          echo ""
          echo "📊 Your prompt will now show:"
          echo "   • Current directory (blue)"
          echo "   • Git branch (green/yellow with *)"
          echo "   • Test results: ✅ passed/total coverage%"
          echo "   • Or: ❌ failed/total (if tests fail)"
          echo ""
          echo "Test stats appear when results are < 30 min old"
        '';

      in {
        # Development shells
        devShells = {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_20
              openjdk21
              maven
              git
              curl
              jq
              process-compose
              netcat
              postgresql
              grafana-loki
              # Test runner dependencies
              gum
              fswatch
              xmlstarlet
              bc
              caddy
              # Marketing automation
              ollama
              # Development tools
              dev-tools.packages.${system}.test-tui
              dev-tools.packages.${system}.prompt-stats
              dev-tools.packages.${system}.setup-prompt
            ];

            shellHook = ''
              # Setup custom prompt with test stats
              if [ ! -f "$HOME/.betrace-dev/betrace-prompt-theme.zsh" ]; then
                ${setupPrompt}/bin/setup-betrace-prompt
              else
                # Source the prompt if already set up
                source "$HOME/.betrace-dev/betrace-prompt-theme.zsh" 2>/dev/null || true
              fi

              echo "🎯 BeTrace Pure Application Framework"
              echo "=================================="
              echo ""
              echo "📁 Applications:"
              echo "  bff/        - React Frontend (Tanstack ecosystem)"
              echo "  backend/    - Go API (stdlib net/http)"
              echo "  marketing/  - n8n + Ollama automation (Node.js)"
              echo ""
              echo "🚀 Development Commands:"
              echo "  nix run .#dev        - Start both apps with hot reload"
              echo "  nix run .#frontend   - Frontend only"
              echo "  nix run .#backend    - Backend only"
              echo ""
              echo "🔨 Build Commands:"
              echo "  nix build .#all      - Build both applications"
              echo "  nix run .#build      - Build with progress output"
              echo ""
              echo "🧪 Testing:"
              echo "  nix run .#test              - Run all test suites once"
              echo "  nix run .#test-watch        - Continuous testing with file watch"
              echo "  nix run .#test-tui          - Interactive TUI with live results"
              echo "  nix run .#test-coverage     - Serve HTML coverage reports"
              echo "  nix run .#validate-coverage - Check coverage thresholds"
              echo ""
              echo "🗄️  Database:"
              echo "  nix run .#migrate    - Run database migrations"
              echo ""
              echo "🚀 Production:"
              echo "  nix run .#serve      - Production preview"
              echo ""
              echo "📊 Status:"
              echo "  nix run .#status     - Check application status"
              echo "  nix run .#restart    - Restart services after config changes"
              echo ""
              echo "💡 Prompt Features:"
              echo "  Your prompt shows test stats: ✅ 94/94 89% or ❌ 2/94"
              echo "  Run 'nix run .#setup-prompt' to reconfigure"
              echo ""
              echo "💡 After changing configs:"
              echo "  1. Save your changes to flake.nix"
              echo "  2. Run: nix run .#restart"
              echo "  (Services will pick up new configs without restarting process-compose)"
              echo ""
            '';
          };

          frontend = betrace-frontend.devShells.${system}.default;
          backend = betrace-backend.devShells.${system}.default;
        };

        # Packages
        packages = {
          # Built applications
          frontend = betrace-frontend.packages.${system}.app;
          backend = betrace-backend.packages.${system}.app;

          # Combined package
          all = pkgs.symlinkJoin {
            name = "betrace-complete";
            paths = [
              betrace-frontend.packages.${system}.app
              betrace-backend.packages.${system}.app
            ];
          };

          # Default package
          default = pkgs.symlinkJoin {
            name = "betrace-complete";
            paths = [
              betrace-frontend.packages.${system}.app
              betrace-backend.packages.${system}.app
            ];
          };
        };

        # Apps for nix run
        apps = {
          # Default: development orchestrator
          default = flake-utils.lib.mkApp { drv = devOrchestrator; };

          # Development
          dev = flake-utils.lib.mkApp { drv = devOrchestrator; };
          frontend = flake-utils.lib.mkApp { drv = frontendDev; };
          backend = flake-utils.lib.mkApp { drv = backendDev; };

          # Build and test
          build = flake-utils.lib.mkApp { drv = buildAll; };
          test = flake-utils.lib.mkApp { drv = testAll; };

          # Advanced test runners
          test-watch = flake-utils.lib.mkApp { drv = testRunnerInfra.test-watch; };
          test-coverage = flake-utils.lib.mkApp { drv = testRunnerInfra.serve-reports; };
          test-tui = flake-utils.lib.mkApp { drv = testRunnerInfra.test-orchestrator; };
          validate-coverage = flake-utils.lib.mkApp { drv = testRunnerInfra.validate-coverage; };

          # Production
          serve = flake-utils.lib.mkApp { drv = productionServe; };

          # Database operations
          migrate = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScriptBin "migrate-wrapper" ''
              echo "🗄️  Running BeTrace database migrations..."
              cd backend && nix run .#migrate
            '';
          };

          # Utility
          status = flake-utils.lib.mkApp { drv = statusChecker; };
          restart = flake-utils.lib.mkApp { drv = restartServices; };
          setup-prompt = flake-utils.lib.mkApp { drv = setupPrompt; };

          # Tenant management
          newTenant = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScriptBin "new-tenant-wrapper" ''
              echo "🏢 BeTrace Tenant Creation Wizard"
              echo "==============================="
              echo
              cd backend && nix run .#newTenant
            '';
          };

          # Marketing automation
          build-embeddings = flake-utils.lib.mkApp { drv = buildEmbeddingsScript; };
        };

        # Formatter
        formatter = pkgs.nixpkgs-fmt;
      });
}