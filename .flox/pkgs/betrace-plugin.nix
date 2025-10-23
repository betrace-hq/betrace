{ lib, buildNpmPackage, nodejs_20 }:

buildNpmPackage {
  pname = "betrace-grafana-plugin";
  version = "0.1.0";

  src = lib.cleanSourceWith {
    filter = path: type:
      let baseName = baseNameOf path; in
      !(lib.hasInfix "node_modules" path) &&
      !(lib.hasInfix ".git" path) &&
      !(lib.hasInfix "dist" path);
    src = ../../grafana-betrace-app;
  };

  npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; # Will be updated

  buildInputs = [ nodejs_20 ];

  buildPhase = ''
    export HOME=$TMPDIR
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
