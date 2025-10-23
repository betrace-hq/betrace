{ lib, grafana, writeTextFile, makeWrapper, symlinkJoin }:

let
  # Generate grafana.ini configuration
  grafanaConfig = writeTextFile {
    name = "grafana.ini";
    text = ''
      [paths]
      data = .dev/data/grafana/db
      logs = .dev/logs/grafana
      plugins = .dev/data/grafana/plugins
      provisioning = .dev/data/grafana/provisioning

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
      allow_loading_unsigned_plugins = grafana-pyroscope-app,grafana-pyroscope-datasource,fluo-app

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
          url: http://localhost:3210
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
            path: .dev/data/grafana-dashboards
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
      --run 'mkdir -p .dev/data/grafana/{db,plugins}' \
      --run 'mkdir -p .dev/logs/grafana' \
      --run 'mkdir -p .dev/data/grafana-dashboards' \
      --run 'rm -f .dev/data/grafana/provisioning && ln -sf ${provisioningDir} .dev/data/grafana/provisioning' \
      --run 'if [ -n "$FLOX_ENV_PROJECT" ] && [ -d "$FLOX_ENV_PROJECT/grafana-betrace-app/dist" ]; then rm -f .dev/data/grafana/plugins/fluo-app && ln -sf "$FLOX_ENV_PROJECT/grafana-betrace-app/dist" .dev/data/grafana/plugins/fluo-app; fi' \
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
