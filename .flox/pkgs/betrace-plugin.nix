{ lib, stdenv }:

# BeTrace plugin - uses pre-built dist directory
# To rebuild: cd grafana-betrace-app && npm install && npm run build
stdenv.mkDerivation {
  pname = "betrace-grafana-plugin";
  version = "0.1.0";

  src = ../../grafana-betrace-app/dist;

  installPhase = ''
    mkdir -p $out
    cp -r * $out/
  '';

  meta = {
    description = "BeTrace Grafana plugin for trace pattern matching";
    platforms = lib.platforms.all;
  };
}
