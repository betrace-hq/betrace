{
  description = "FLUO Backend V2 - Clean Architecture with Transformers";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        jdk = pkgs.openjdk21;

        mavenWithJdk = pkgs.maven;
        # Filter source files only (exclude target/, .git, IDE files)
        src = pkgs.lib.cleanSourceWith {
          src = ./.;
          filter = path: type:
            let
              baseName = baseNameOf path;
              relPath = pkgs.lib.removePrefix (toString ./. + "/") (toString path);
            in
            # Exclude build artifacts and caches
            !(pkgs.lib.hasPrefix "target/" relPath) &&
            !(baseName == ".git") &&
            !(baseName == ".idea") &&
            !(baseName == ".vscode") &&
            !(pkgs.lib.hasSuffix ".iml" baseName);
        };
      in
      {
        packages = {
          # Compiled classes + Maven artifacts (used by dev mode)
          target = pkgs.stdenv.mkDerivation {
            pname = "fluo-backend-target";
            version = "1.0.0";

            inherit src;

            nativeBuildInputs = [ mavenWithJdk jdk ];

            buildPhase = ''
              export JAVA_HOME=${jdk}
              export HOME=$(mktemp -d)
              mvn clean compile -DskipTests
            '';

            installPhase = ''
              # Copy entire target/ directory to output
              mkdir -p $out
              cp -r target/* $out/
            '';
          };

          # Production JAR package
          app = pkgs.stdenv.mkDerivation {
            pname = "fluo-backend-v2";
            version = "1.0.0";

            inherit src;

            nativeBuildInputs = [ mavenWithJdk jdk ];

            buildPhase = ''
              export JAVA_HOME=${jdk}
              export HOME=$(mktemp -d)
              mvn clean package -DskipTests
            '';

            installPhase = ''
              mkdir -p $out/bin $out/lib
              cp target/quarkus-app/quarkus-run.jar $out/lib/
              cp -r target/quarkus-app/lib $out/lib/
              cp -r target/quarkus-app/app $out/lib/
              cp -r target/quarkus-app/quarkus $out/lib/

              cat > $out/bin/fluo-backend-v2 <<EOF
              #!/bin/sh
              exec ${jdk}/bin/java -jar $out/lib/quarkus-run.jar "\$@"
              EOF

              chmod +x $out/bin/fluo-backend-v2
            '';
          };

          # Default package points to app
          default = self.packages.${system}.app;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            jdk
            mavenWithJdk
            git
          ];

          shellHook = ''
            export JAVA_HOME=${jdk}
            echo "FLUO Backend V2 Development Environment"
            echo "Java version: $(java -version 2>&1 | head -n 1)"
            echo "Maven version: $(mvn -version | head -n 1)"
            echo ""
            echo "Available commands:"
            echo "  mvn quarkus:dev    - Start development server with hot reload"
            echo "  mvn test           - Run tests"
            echo "  mvn package        - Build the application"
            echo ""
          '';
        };

        apps = {
          default = flake-utils.lib.mkApp {
            drv = self.packages.${system}.default;
            exePath = "/bin/fluo-backend-v2";
          };

          dev = {
            type = "app";
            program = toString (pkgs.writeShellScript "dev-server" ''
              export JAVA_HOME=${jdk}
              export PATH=${mavenWithJdk}/bin:${pkgs.async-profiler}/bin:$PATH

              # Work in the current directory (not Nix store)
              if [ -f "pom.xml" ]; then
                echo "🚀 Starting FLUO Backend V2 in development mode with profiler..."

                # Symlink Nix-built target/ directory to workspace
                # This ensures Maven's incremental cache is always fresh
                if [ -L "target" ]; then
                  rm target
                elif [ -d "target" ]; then
                  echo "⚠️  Removing stale target/ directory..."
                  rm -rf target
                fi

                echo "🔗 Symlinking target/ → ${self.packages.${system}.target}"
                ln -sf ${self.packages.${system}.target} target

                echo "📊 Profiler: async-profiler available at http://localhost:12011/q/dev/io.quarkus.quarkus-vertx-http/profiler"
                mkdir -p profiler-results

                # Detect platform-specific library extension
                if [[ "$OSTYPE" == "darwin"* ]]; then
                  PROFILER_LIB="${pkgs.async-profiler}/lib/libasyncProfiler.dylib"
                else
                  PROFILER_LIB="${pkgs.async-profiler}/lib/libasyncProfiler.so"
                fi

                # Start Quarkus with async-profiler JVM agent
                exec mvn quarkus:dev \
                  -Djvm.args="-agentpath:$PROFILER_LIB=start,event=cpu,file=profiler-results/profile-%t.jfr -XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints"
              else
                echo "Error: pom.xml not found. Please run this command from the backend directory."
                exit 1
              fi
            '');
          };

          test = {
            type = "app";
            program = toString (pkgs.writeShellScript "run-tests" ''
              export JAVA_HOME=${jdk}
              export PATH=${mavenWithJdk}/bin:$PATH
              cd ${./.}
              echo "Running tests..."
              exec mvn test
            '');
          };

          profile = {
            type = "app";
            program = toString (pkgs.writeShellScript "profile-backend" ''
              export JAVA_HOME=${jdk}
              export PATH=${mavenWithJdk}/bin:${pkgs.async-profiler}/bin:$PATH

              echo "🔬 FLUO Backend Profiler"
              echo "======================="
              echo ""
              echo "Starting Quarkus with async-profiler agent..."
              echo "Profiler output will be saved to: ./profiler-results/"
              echo ""
              mkdir -p profiler-results

              # Work in the current directory (not Nix store)
              if [ -f "pom.xml" ]; then
                exec mvn quarkus:dev \
                  -Dquarkus.javaagent.path=${pkgs.async-profiler}/lib/libasyncProfiler.so \
                  -Djvm.args="-XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints"
              else
                echo "Error: pom.xml not found. Please run this command from the backend directory."
                exit 1
              fi
            '');
          };

          compliance = {
            type = "app";
            program = toString (pkgs.writeShellScript "compliance-evidence" ''
              export JAVA_HOME=${jdk}
              export PATH=${mavenWithJdk}/bin:${pkgs.curl}/bin:${pkgs.jq}/bin:$PATH

              echo "=========================================="
              echo "FLUO COMPLIANCE EVIDENCE GENERATOR"
              echo "=========================================="
              echo ""
              echo "This will generate comprehensive compliance evidence"
              echo "demonstrating all implemented controls across:"
              echo "- SOC 2 Trust Service Criteria"
              echo "- HIPAA Security Rule"
              echo "- FedRAMP Moderate Baseline"
              echo "- ISO 27001:2022"
              echo "- PCI-DSS v4.0"
              echo ""

              # Check if backend is running
              if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
                echo "Starting FLUO backend..."
                mvn quarkus:dev &
                BACKEND_PID=$!

                # Wait for backend to start
                echo "Waiting for backend to start..."
                for i in {1..30}; do
                  if curl -s http://localhost:8080/health > /dev/null 2>&1; then
                    echo "Backend started successfully"
                    break
                  fi
                  sleep 1
                done
              else
                echo "Backend already running"
              fi

              echo ""
              echo "Generating compliance evidence..."
              echo ""

              # Generate evidence
              RESPONSE=$(curl -s http://localhost:8080/api/compliance/evidence/generate)

              if [ $? -eq 0 ]; then
                echo "$RESPONSE" | jq '.'

                # Save to file
                TIMESTAMP=$(date +%Y%m%d_%H%M%S)
                echo "$RESPONSE" > "compliance_evidence_$TIMESTAMP.json"
                echo ""
                echo "✓ Evidence saved to: compliance_evidence_$TIMESTAMP.json"
                echo ""
                echo "View control mappings: curl http://localhost:8080/api/compliance/controls | jq"
                echo "Generate audit report: curl -X POST http://localhost:8080/api/compliance/audit | jq"
              else
                echo "Failed to generate evidence. Check backend logs."
              fi

              # Cleanup if we started the backend
              if [ ! -z "$BACKEND_PID" ]; then
                echo ""
                echo "Stopping backend..."
                kill $BACKEND_PID 2>/dev/null
              fi
            '');
          };
        };
      });
}