{ lib, buildNpmPackage }:

buildNpmPackage {
  pname = "betrace-grafana-plugin";
  version = "0.1.0";

  src = ../../grafana-betrace-app;

  npmDepsHash = "sha256-z6J4+FVLYo3d9e1OTFnI5QyIKLXLgehtDB2gaxqutME=";

  npmFlags = [ "--legacy-peer-deps" ];

  buildPhase = ''
    runHook preBuild
    npm run build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    echo "Installing BeTrace plugin files..."
    ls -la dist/
    mkdir -p $out
    for file in dist/*; do
      echo "Copying: $file"
      cp -v "$file" $out/
    done
    ls -la $out/
    runHook postInstall
  '';

  meta = {
    description = "BeTrace Grafana plugin with Monaco editor";
    platforms = lib.platforms.all;
  };
}
