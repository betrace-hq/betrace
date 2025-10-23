{ lib, prometheus, writeTextFile, makeWrapper, symlinkJoin }:

let
  prometheusConfig = writeTextFile {
    name = "prometheus.yaml";
    text = ''
      global:
        scrape_interval: 15s
        evaluation_interval: 15s

      scrape_configs:
        - job_name: 'prometheus'
          static_configs:
            - targets: ['localhost:9090']

        - job_name: 'tempo'
          static_configs:
            - targets: ['localhost:3200']

        - job_name: 'loki'
          static_configs:
            - targets: ['localhost:3100']

        - job_name: 'grafana'
          static_configs:
            - targets: ['localhost:12015']

        - job_name: 'pyroscope'
          static_configs:
            - targets: ['localhost:4040']

        - job_name: 'alloy'
          static_configs:
            - targets: ['localhost:12345']
    '';
  };

in
symlinkJoin {
  name = "prometheus-wrapped";
  paths = [ prometheus ];
  buildInputs = [ makeWrapper ];

  postBuild = ''
    wrapProgram $out/bin/prometheus \
      --run 'mkdir -p /tmp/prometheus' \
      --add-flags "--config.file=${prometheusConfig}" \
      --add-flags "--storage.tsdb.path=/tmp/prometheus" \
      --add-flags "--web.listen-address=:9090"

    cat > $out/bin/prometheus-service <<EOF
#!/usr/bin/env bash
exec $out/bin/prometheus "\$@"
EOF
    chmod +x $out/bin/prometheus-service
  '';

  meta = {
    description = "Prometheus wrapped with FLUO configuration";
    mainProgram = "prometheus-service";
  };
}
