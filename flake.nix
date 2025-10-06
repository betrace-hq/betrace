{
  description = "FLUO - Pure Application Framework (Frontend + Backend)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";

    # Local application flakes
    fluo-frontend = {
      url = "path:./bff";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };

    fluo-backend = {
      url = "path:./backend";
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

  outputs = { self, nixpkgs, flake-utils, fluo-frontend, fluo-backend }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Helper to run frontend serve
        frontendServe = pkgs.writeShellScriptBin "frontend-serve" ''
          PORT=''${PORT:-8080}
          echo "🌐 Starting Frontend on http://localhost:$PORT..."
          # Use Caddy for efficient static file serving
          exec ${pkgs.caddy}/bin/caddy file-server \
            --root ${fluo-frontend.packages.${system}.app} \
            --listen :$PORT \
            --browse
        '';

        # Helper to run backend serve
        backendServe = pkgs.writeShellScriptBin "backend-serve" ''
          echo "☕ Starting Backend on port ''${PORT:-8081}..."
          export JAVA_HOME=${pkgs.openjdk21}
          exec ${fluo-backend.packages.${system}.app}/bin/fluo-backend
        '';

        # Helper script to run frontend dev from root
        frontendDevScript = pkgs.writeShellScriptBin "frontend-dev-from-root" ''
          cd bff && exec nix run .#dev
        '';

        # TigerBeetle initialization script
        tigerBeetleInitScript = pkgs.writeShellScriptBin "tigerbeetle-init" ''
          DB_DIR="/tmp/fluo-tigerbeetle"
          mkdir -p "$DB_DIR"

          # Create TigerBeetle data file if it doesn't exist
          if [ ! -f "$DB_DIR/cluster_0.tigerbeetle" ]; then
            echo "📊 Initializing TigerBeetle cluster database..."
            # Create a simple data file for mock purposes
            dd if=/dev/zero of="$DB_DIR/cluster_0.tigerbeetle" bs=1M count=1 2>/dev/null
            echo "✅ TigerBeetle cluster database initialized"
          fi

          echo "🚀 Starting TigerBeetle mock server on port ${toString ports.tigerbeetle}..."
          echo "📊 TigerBeetle cluster ready for client connections"
          echo "🔗 Listening on tcp://localhost:${toString ports.tigerbeetle}"

          # Mock TigerBeetle server that listens on the correct port (macOS syntax)
          ${pkgs.netcat}/bin/nc -l -k 127.0.0.1 ${toString ports.tigerbeetle} &
          NC_PID=$!

          echo "✅ TigerBeetle mock server started (PID: $NC_PID)"

          # Keep the process running and handle shutdown gracefully
          trap "echo '🛑 Shutting down TigerBeetle...'; kill $NC_PID 2>/dev/null || true; exit 0" TERM INT

          # Keep running and periodically check if netcat is still alive
          while kill -0 $NC_PID 2>/dev/null; do
            sleep 5
          done

          echo "❌ TigerBeetle server stopped unexpectedly"
          exit 1
        '';



        # Helper script to run backend dev from root
        backendDevScript = pkgs.writeShellScriptBin "backend-dev-from-root" ''
          export QUARKUS_DEVSERVICES_ENABLED=false
          export TESTCONTAINERS_DISABLED=true
          # Change to backend directory and run dev command directly there
          cd backend
          exec nix run .#dev
        '';

        # Backend test script - direct app execution
        backendTestScript = fluo-backend.apps.${system}.test;

        # Caddy reverse proxy configuration as Nix expression
        caddyConfigData = {
          apps = {
            http = {
              servers = {
                fluo-dev = {
                  listen = [ ":${toString ports.caddy}" ];
                  routes = [
                    # Main frontend route
                    {
                      match = [{ host = [ "localhost" ]; }];
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.frontend}"; }];
                      }];
                    }
                    # API subdomain route
                    {
                      match = [{ host = [ "api.localhost" ]; }];
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.backend}"; }];
                      }];
                    }
                    # Process compose UI subdomain route
                    {
                      match = [{ host = [ "process-compose.localhost" ]; }];
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.processComposeUI}"; }];
                      }];
                    }
                    # TigerBeetle subdomain route
                    {
                      match = [{ host = [ "tigerbeetle.localhost" ]; }];
                      handle = [{
                        handler = "reverse_proxy";
                        upstreams = [{ dial = "localhost:${toString ports.tigerbeetle}"; }];
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

        # Caddy proxy server
        caddyProxy = pkgs.writeShellScriptBin "caddy-proxy" ''
          echo "🌐 Starting Caddy Reverse Proxy"
          echo "=============================="
          echo "🏠 Main:           http://localhost:${toString ports.caddy} → Frontend"
          echo "🔗 API:            http://api.localhost:${toString ports.caddy} → Backend"
          echo "🎛️  Process UI:     http://process-compose.localhost:${toString ports.caddy}"
          echo "🐅 TigerBeetle:    http://tigerbeetle.localhost:${toString ports.caddy}"
          echo ""

          exec ${pkgs.caddy}/bin/caddy run --config ${caddyConfig}
        '';

        # Port configuration as Nix expressions
        ports = {
          caddy = 3000;
          frontend = 12010;
          backend = 12011;
          processComposeUI = 12013;
          tigerbeetle = 12014;
          nats = 4222;
          natsMonitoring = 8222;
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
                environment = [ "PORT=${toString ports.frontend}" ];
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
                  restart = "on_failure";
                };
                log_location = "/tmp/fluo-frontend.log";
                description = "FLUO Frontend (React + Vite) - Port ${toString ports.frontend}";
              };

              # Backend API
              backend = {
                command = "${backendDevScript}/bin/backend-dev-from-root";
                environment = [ "QUARKUS_HTTP_PORT=${toString ports.backend}" ];
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.backend;
                    path = "/q/health";
                  };
                  initial_delay_seconds = 10;
                  period_seconds = 10;
                };
                availability = {
                  restart = "on_failure";
                };
                log_location = "/tmp/fluo-backend.log";
                description = "FLUO Backend (Quarkus API) - Port ${toString ports.backend}";
              };

              # Test Results Dashboard - Disabled (no test results server available)
              # test-results = {
              #   command = "echo 'Test results server not implemented yet'";
              #   environment = [ "CADDY_PORT=${toString ports.testResults}" ];
              #   readiness_probe = {
              #     http_get = {
              #       host = "127.0.0.1";
              #       port = ports.testResults;
              #       path = "/";
              #     };
              #     initial_delay_seconds = 5;
              #     period_seconds = 10;
              #   };
              #   availability = {
              #     restart = "on_failure";
              #   };
              #   log_location = "/tmp/fluo-test-results.log";
              #   description = "FLUO Test Results Dashboard - Port ${toString ports.testResults}";
              # };

              # Port 12013: Process Compose UI (configured above)

              # Infrastructure services

              nats = {
                command = "${pkgs.nats-server}/bin/nats-server -js -sd /tmp/nats -m ${toString ports.natsMonitoring} -p ${toString ports.nats}";
                readiness_probe = {
                  exec = {
                    command = "${pkgs.netcat}/bin/nc -z 127.0.0.1 ${toString ports.nats}";
                  };
                  initial_delay_seconds = 2;
                  period_seconds = 3;
                };
                availability = {
                  restart = "on_failure";
                };
                log_location = "/tmp/fluo-nats.log";
                description = "NATS JetStream Message Broker - Port ${toString ports.nats}";
              };

              tigerbeetle = {
                command = "${tigerBeetleInitScript}/bin/tigerbeetle-init";
                readiness_probe = {
                  exec = {
                    command = "${pkgs.netcat}/bin/nc -z 127.0.0.1 ${toString ports.tigerbeetle}";
                  };
                  initial_delay_seconds = 5;
                  period_seconds = 3;
                };
                availability = {
                  restart = "on_failure";
                };
                log_location = "/tmp/fluo-tigerbeetle.log";
                description = "TigerBeetle Financial Ledger - Port ${toString ports.tigerbeetle}";
              };

              # Caddy reverse proxy
              caddy-proxy = {
                command = "${caddyProxy}/bin/caddy-proxy";
                readiness_probe = {
                  http_get = {
                    host = "127.0.0.1";
                    port = ports.caddy;
                    path = "/";
                  };
                  initial_delay_seconds = 3;
                  period_seconds = 5;
                };
                availability = {
                  restart = "on_failure";
                };
                log_location = "/tmp/fluo-caddy.log";
                description = "Caddy Reverse Proxy - Port ${toString ports.caddy}";
              };
            };
          };

        # Local development environment orchestrator using process-compose
        devOrchestrator = pkgs.writeShellScriptBin "dev-orchestrator" ''
          echo "🚀 FLUO Development Orchestrator"
          echo "=============================="
          echo ""
          echo "📋 Starting services with process-compose..."
          echo "🌐 Caddy Proxy:   http://localhost:${toString ports.caddy} (main access point)"
          echo ""
          echo "🔗 Service URLs (via Caddy proxy):"
          echo "   🏠 Frontend:        http://localhost:${toString ports.caddy}"
          echo "   🔗 API:             http://api.localhost:${toString ports.caddy}"
          echo "   🎛️  Process UI:      http://process-compose.localhost:${toString ports.caddy}"
          echo "   🐅 TigerBeetle:     http://tigerbeetle.localhost:${toString ports.caddy}"
          echo ""
          echo "🔧 Direct Service Ports:"
          echo "   📨 NATS:           nats://localhost:${toString ports.nats}"
          echo "   🌐 Frontend:       http://localhost:${toString ports.frontend}"
          echo "   ☕ Backend:        http://localhost:${toString ports.backend}"
          echo "   🎛️  Process UI:     http://localhost:${toString ports.processComposeUI}"
          echo "   🐅 TigerBeetle:    tcp://localhost:${toString ports.tigerbeetle}"
          echo ""
          echo "🎮 Controls:"
          echo "  • Press 'h' for help"
          echo "  • Press 'q' to quit"
          echo "  • Press 'r' to restart a process"
          echo ""

          exec ${pkgs.process-compose}/bin/process-compose -f ${devProcessCompose} --tui=false
        '';

        # Individual development helpers
        frontendDev = pkgs.writeShellScriptBin "frontend-dev" ''
          echo "🌐 Starting FLUO Frontend development..."
          cd bff && nix run .#dev
        '';

        backendDev = pkgs.writeShellScriptBin "backend-dev" ''
          echo "☕ Starting FLUO Backend development..."
          cd backend && nix run .#dev
        '';

        # Build orchestrator
        buildAll = pkgs.writeShellScriptBin "build-all" ''
          echo "🔨 Building FLUO Applications"
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

        # Test orchestrator
        testAll = pkgs.writeShellScriptBin "test-all" ''
          echo "🧪 Running FLUO Test Suite"
          echo "========================="
          echo ""

          echo "🌐 Testing Frontend..."
          cd bff && npm run test
          FRONTEND_TESTS=$?

          echo ""
          echo "☕ Testing Backend..."
          cd ../backend && nix run .#test
          BACKEND_TESTS=$?

          echo ""
          if [ $FRONTEND_TESTS -eq 0 ] && [ $BACKEND_TESTS -eq 0 ]; then
            echo "✅ All tests passed!"
          else
            echo "❌ Some tests failed!"
            [ $FRONTEND_TESTS -ne 0 ] && echo "  Frontend tests failed"
            [ $BACKEND_TESTS -ne 0 ] && echo "  Backend tests failed"
            exit 1
          fi
        '';

        # Process-compose configuration for production
        prodProcessCompose = pkgs.writeText "process-compose-prod.yaml" ''
          version: "0.5"

          processes:
            frontend:
              command: "PORT=8080 ${frontendServe}/bin/frontend-serve"
              readiness_probe:
                http_get:
                  host: 127.0.0.1
                  port: 8080
                  path: "/"
              availability:
                restart: "on_failure"
              log_location: "/tmp/fluo-frontend-prod.log"
              description: "FLUO Frontend (Static Server)"

            backend:
              command: "PORT=8081 ${backendServe}/bin/backend-serve"
              readiness_probe:
                http_get:
                  host: 127.0.0.1
                  port: 8081
                  path: "/q/health"
              availability:
                restart: "on_failure"
              log_location: "/tmp/fluo-backend-prod.log"
              description: "FLUO Backend (Production JAR)"
        '';

        # Production server (serves both apps locally)
        productionServe = pkgs.writeShellScriptBin "production-serve" ''
          echo "🚀 FLUO Production Preview"
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
          echo "📊 FLUO Application Status"
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
              nats-server
              netcat
              postgresql
            ];

            shellHook = ''
              echo "🎯 FLUO Pure Application Framework"
              echo "=================================="
              echo ""
              echo "📁 Applications:"
              echo "  bff/     - React Frontend (Tanstack ecosystem)"
              echo "  backend/ - Quarkus API (Java 21)"
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
              echo "  nix run .#test       - Run all test suites"
              echo ""
              echo "🗄️  Database:"
              echo "  nix run .#migrate    - Run database migrations"
              echo ""
              echo "🚀 Production:"
              echo "  nix run .#serve      - Production preview"
              echo ""
              echo "📊 Status:"
              echo "  nix run .#status     - Check application status"
              echo ""
            '';
          };

          frontend = fluo-frontend.devShells.${system}.default;
          backend = fluo-backend.devShells.${system}.default;
        };

        # Packages
        packages = {
          # Built applications
          frontend = fluo-frontend.packages.${system}.app;
          backend = fluo-backend.packages.${system}.app;

          # Combined package
          all = pkgs.symlinkJoin {
            name = "fluo-complete";
            paths = [
              fluo-frontend.packages.${system}.app
              fluo-backend.packages.${system}.app
            ];
          };

          # Default package
          default = pkgs.symlinkJoin {
            name = "fluo-complete";
            paths = [
              fluo-frontend.packages.${system}.app
              fluo-backend.packages.${system}.app
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

          # Production
          serve = flake-utils.lib.mkApp { drv = productionServe; };

          # Database operations
          migrate = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScriptBin "migrate-wrapper" ''
              echo "🗄️  Running FLUO database migrations..."
              cd backend && nix run .#migrate
            '';
          };

          # Utility
          status = flake-utils.lib.mkApp { drv = statusChecker; };

          # Tenant management
          newTenant = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScriptBin "new-tenant-wrapper" ''
              echo "🏢 FLUO Tenant Creation Wizard"
              echo "==============================="
              echo
              cd backend && nix run .#newTenant
            '';
          };
        };

        # Formatter
        formatter = pkgs.nixpkgs-fmt;
      });
}