{ lib, grafana-loki, writeTextFile, makeWrapper, symlinkJoin }:

let
  lokiConfig = writeTextFile {
    name = "loki.yaml";
    text = ''
      auth_enabled: false

      server:
        http_listen_port: 3100
        grpc_listen_port: 9096

      analytics:
        reporting_enabled: false

      common:
        instance_addr: 127.0.0.1
        path_prefix: .dev/data/loki
        storage:
          filesystem:
            chunks_directory: .dev/data/loki/chunks
            rules_directory: .dev/data/loki/rules
        replication_factor: 1
        ring:
          kvstore:
            store: inmemory

      query_range:
        results_cache:
          cache:
            embedded_cache:
              enabled: true
              max_size_mb: 100

      schema_config:
        configs:
          - from: "2024-01-01"
            store: tsdb
            object_store: filesystem
            schema: v13
            index:
              prefix: index_
              period: 24h

      ruler:
        alertmanager_url: http://localhost:9093
    '';
  };

in
symlinkJoin {
  name = "loki-wrapped";
  paths = [ grafana-loki ];
  buildInputs = [ makeWrapper ];

  postBuild = ''
    wrapProgram $out/bin/loki \
      --run 'mkdir -p .dev/data/loki/{chunks,rules}' \
      --add-flags "--config.file=${lokiConfig}"

    cat > $out/bin/loki-service <<EOF
#!/usr/bin/env bash
exec $out/bin/loki "\$@"
EOF
    chmod +x $out/bin/loki-service
  '';

  meta = {
    description = "Loki wrapped with FLUO configuration";
    mainProgram = "loki-service";
  };
}
