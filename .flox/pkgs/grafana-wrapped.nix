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
        - name: 'BeTrace Dashboards'
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
    # Create wrapper that sets up directories and generates runtime config
    cat > $out/bin/grafana-service <<'WRAPPER'
#!/usr/bin/env bash
set -e

# Check FLOX_ENV_PROJECT is set
if [ -z "$FLOX_ENV_PROJECT" ]; then
  echo "Error: FLOX_ENV_PROJECT not set" >&2
  exit 1
fi

# Setup directories
cd "$FLOX_ENV_PROJECT"
mkdir -p .dev/data/grafana/{db,plugins} .dev/logs/grafana .dev/cache

# Setup provisioning symlink
rm -f .dev/data/grafana/provisioning
ln -sf PROVISIONING_DIR .dev/data/grafana/provisioning

# Setup BeTrace plugin symlink
if [ -d grafana-betrace-app/dist ]; then
  rm -f .dev/data/grafana/plugins/betrace-app
  ln -sf "$FLOX_ENV_PROJECT/grafana-betrace-app/dist" .dev/data/grafana/plugins/betrace-app
fi

# Create runtime config with absolute paths
RUNTIME_CONFIG="$FLOX_ENV_PROJECT/.dev/cache/grafana.ini"
cat > "$RUNTIME_CONFIG" <<'GRAFANA_INI'
[paths]
data = DATA_DIR
logs = LOGS_DIR
plugins = PLUGINS_DIR
provisioning = PROVISIONING_SYMLINK

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
GRAFANA_INI

# Substitute paths
sed -i.bak \
  -e "s|DATA_DIR|$FLOX_ENV_PROJECT/.dev/data/grafana/db|g" \
  -e "s|LOGS_DIR|$FLOX_ENV_PROJECT/.dev/logs/grafana|g" \
  -e "s|PLUGINS_DIR|$FLOX_ENV_PROJECT/.dev/data/grafana/plugins|g" \
  -e "s|PROVISIONING_SYMLINK|$FLOX_ENV_PROJECT/.dev/data/grafana/provisioning|g" \
  "$RUNTIME_CONFIG"
rm "$RUNTIME_CONFIG.bak"

# Run grafana-server
exec GRAFANA_BIN --homepath GRAFANA_HOME --config "$RUNTIME_CONFIG" "$@"
WRAPPER

    # Replace placeholders in wrapper
    sed -i.tmp \
      -e "s|GRAFANA_BIN|${grafana}/bin/grafana-server|g" \
      -e "s|GRAFANA_HOME|${grafana}/share/grafana|g" \
      -e "s|PROVISIONING_DIR|${provisioningDir}|g" \
      $out/bin/grafana-service
    rm $out/bin/grafana-service.tmp

    chmod +x $out/bin/grafana-service
  '';

  meta = {
    description = "Grafana wrapped with BeTrace configuration";
    mainProgram = "grafana-service";
  };
}
