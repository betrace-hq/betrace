{ lib, pyroscope, writeTextFile, makeWrapper, symlinkJoin }:

let
  pyroscopeConfig = writeTextFile {
    name = "pyroscope.yaml";
    text = ''
      analytics:
        reporting-enabled: false

      server:
        http-listen-port: 4040
        grpc-listen-port: 9097
    '';
  };

in
symlinkJoin {
  name = "pyroscope-wrapped";
  paths = [ pyroscope ];
  buildInputs = [ makeWrapper ];

  postBuild = ''
    wrapProgram $out/bin/pyroscope \
      --run 'mkdir -p /tmp/pyroscope' \
      --add-flags "server" \
      --add-flags "--config=${pyroscopeConfig}" \
      --add-flags "--storage-path=/tmp/pyroscope" \
      --add-flags "--server.grpc-port=9097"

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
