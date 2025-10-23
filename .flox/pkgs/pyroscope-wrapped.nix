{ lib, pyroscope, writeTextFile, makeWrapper, symlinkJoin }:

let
  pyroscopeConfig = writeTextFile {
    name = "pyroscope.yaml";
    text = ''
      analytics:
        reporting-enabled: false

      server:
        # Pyroscope ports are Tempo+10 to avoid conflicts
        # Tempo HTTP: 3200, gRPC: 9095
        http_listen_port: 3210
        grpc_listen_port: 9105
    '';
  };

in
symlinkJoin {
  name = "pyroscope-wrapped";
  paths = [ pyroscope ];
  buildInputs = [ makeWrapper ];

  postBuild = ''
    wrapProgram $out/bin/pyroscope \
      --run 'mkdir -p .dev/data/pyroscope' \
      --add-flags "server" \
      --add-flags "--config=${pyroscopeConfig}" \
      --add-flags "--storage-path=.dev/data/pyroscope"

    cat > $out/bin/pyroscope-service <<EOF
#!/usr/bin/env bash
exec $out/bin/pyroscope "\$@"
EOF
    chmod +x $out/bin/pyroscope-service
  '';

  meta = {
    description = "Pyroscope wrapped with FLUO configuration";
    mainProgram = "pyroscope-service";
  };
}
