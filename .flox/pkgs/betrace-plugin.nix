{ lib, buildNpmPackage }:

buildNpmPackage {
  pname = "betrace-grafana-plugin";
  version = "0.1.0";

  src = ../../grafana-betrace-app;

  npmDepsHash = "sha256-/KjTJAfGsohymz+fICNcIRwI4wCLqfnS8msC5SZUneA=";

  npmFlags = [ "--legacy-peer-deps" ];

  buildPhase = ''
    npm run build
  '';

  installPhase = ''
    mkdir -p $out
    cp -r dist/* $out/
  '';

  meta = {
    description = "BeTrace Grafana plugin for trace pattern matching";
    platforms = lib.platforms.all;
  };
}
