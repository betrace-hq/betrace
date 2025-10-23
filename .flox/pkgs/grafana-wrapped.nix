{ lib, grafana, writeTextFile, makeWrapper, symlinkJoin, betracePlugin }:

let
  # Generate grafana.ini configuration
  grafanaConfig = writeTextFile {
    name = "grafana.ini";
    text = ''
      [paths]
      data = /tmp/grafana-data/db
      logs = /tmp/grafana-data/logs
      plugins = /tmp/grafana-data/plugins
      provisioning = /tmp/grafana-data/provisioning

      [server]
      http_port = 12015

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

      [plugins]
      allow_loading_unsigned_plugins = grafana-pyroscope-app,grafana-pyroscope-datasource,betrace-app

      [unified_alerting]
      enabled = true

      [feature_toggles]
      kubernetesPlaylists = false
      externalServiceAccounts = false
      grafanaAPIServer = false
    '';
  };

  # Generate datasources provisioning
  datasourcesYaml = writeTextFile {
    name = "datasources.yaml";
    text = ''
      apiVersion: 1
      datasources:
        - name: Loki
          type: loki
          url: http://localhost:3100
          uid: loki
          isDefault: true
        - name: Tempo
          type: tempo
          url: http://localhost:3200
          uid: tempo
        - name: Prometheus
          type: prometheus
          url: http://localhost:9090
          uid: prometheus
        - name: Pyroscope
          type: grafana-pyroscope-datasource
          url: http://localhost:4040
          uid: pyroscope
    '';
  };

  # Generate dashboards provisioning
  dashboardsYaml = writeTextFile {
    name = "dashboards.yaml";
    text = ''
      apiVersion: 1
      providers:
        - name: 'FLUO Dashboards'
          orgId: 1
          folder: ""
          type: file
          disableDeletion: false
          updateIntervalSeconds: 10
          allowUiUpdates: true
          options:
            path: /tmp/grafana-dashboards
    '';
  };

  # Create provisioning directory structure
  provisioningDir = symlinkJoin {
    name = "grafana-provisioning";
    paths = [
      (writeTextFile {
        name = "provisioning-datasources";
        destination = "/datasources/datasources.yaml";
        text = builtins.readFile datasourcesYaml;
      })
      (writeTextFile {
        name = "provisioning-dashboards";
        destination = "/dashboards/dashboards.yaml";
        text = builtins.readFile dashboardsYaml;
      })
    ];
  };

in
symlinkJoin {
  name = "grafana-wrapped";
  paths = [ grafana ];
  buildInputs = [ makeWrapper ];

  postBuild = ''
    # Wrap grafana-server with config and runtime setup
    wrapProgram $out/bin/grafana-server \
      --run 'mkdir -p /tmp/grafana-data/{db,logs,plugins}' \
      --run 'mkdir -p /tmp/grafana-dashboards' \
      --run 'rm -f /tmp/grafana-data/provisioning && ln -sf ${provisioningDir} /tmp/grafana-data/provisioning' \
      --run 'rm -f /tmp/grafana-data/plugins/betrace-app && ln -sf ${betracePlugin} /tmp/grafana-data/plugins/betrace-app' \
      --add-flags "--homepath ${grafana}/share/grafana" \
      --add-flags "--config ${grafanaConfig}"

    # Create convenience wrapper
    cat > $out/bin/grafana-service <<EOF
#!/usr/bin/env bash
exec $out/bin/grafana-server "\$@"
EOF
    chmod +x $out/bin/grafana-service
  '';

  meta = {
    description = "Grafana wrapped with FLUO configuration";
    mainProgram = "grafana-service";
  };
}
