# Configuration Files

These configuration files need to be extracted from the root `flake.nix`:

## Files to create:
- `loki.yaml` - from `lokiConfig` variable (lines ~590-646)
- `tempo.yaml` - from `tempoConfig` variable (lines ~695-810)
- `prometheus.yaml` - from `prometheusConfig` variable (lines ~668-692)
- `pyroscope.yaml` - from `pyroscopeConfig` variable (lines ~649-665)
- `alloy.river` - from `alloyConfig` variable (lines ~367-569)
- `grafana.ini` - from `grafanaIni` variable (lines ~340-363)

## Port variables to replace:
- `${toString ports.loki}` → `$FLUO_PORT_LOKI`
- `${toString ports.tempo}` → `$FLUO_PORT_TEMPO`
- etc.

## Next step:
Extract these configs and create static files with environment variable substitution.
