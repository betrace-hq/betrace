{ lib, tempo, writeTextFile, makeWrapper, symlinkJoin }:

let
  tempoConfig = writeTextFile {
    name = "tempo.yaml";
    text = ''
      server:
        http_listen_port: 3200
        grpc_listen_port: 9097

      distributor:
        receivers:
          otlp:
            protocols:
              grpc:
                endpoint: 0.0.0.0:4317
              http:
                endpoint: 0.0.0.0:4318

      storage:
        trace:
          backend: local
          local:
            path: .dev/data/tempo/traces
          wal:
            path: .dev/data/tempo/wal

      metrics_generator:
        registry:
          external_labels:
            source: tempo
        storage:
          path: .dev/data/tempo/generator/wal
          remote_write:
            - url: http://localhost:9090/api/v1/write
              send_exemplars: true
    '';
  };

in
symlinkJoin {
  name = "tempo-wrapped";
  paths = [ tempo ];
  buildInputs = [ makeWrapper ];

  postBuild = ''
    wrapProgram $out/bin/tempo \
      --run 'mkdir -p .dev/data/tempo/{traces,wal,generator/wal}' \
      --add-flags "--config.file=${tempoConfig}"

    cat > $out/bin/tempo-service <<EOF
#!/usr/bin/env bash
exec $out/bin/tempo "\$@"
EOF
    chmod +x $out/bin/tempo-service
  '';

  meta = {
    description = "Tempo wrapped with FLUO configuration";
    mainProgram = "tempo-service";
  };
}
