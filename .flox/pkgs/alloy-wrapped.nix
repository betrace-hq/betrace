{ lib, grafana-alloy, writeTextFile, makeWrapper, symlinkJoin }:

let
  alloyConfig = writeTextFile {
    name = "alloy.river";
    text = builtins.readFile ../../.flox/configs/alloy.river;
  };

in
symlinkJoin {
  name = "alloy-wrapped";
  paths = [ grafana-alloy ];
  buildInputs = [ makeWrapper ];

  postBuild = ''
    wrapProgram $out/bin/alloy \
      --add-flags "run" \
      --add-flags "${alloyConfig}" \
      --add-flags "--server.http.listen-addr=0.0.0.0:12345" \
      --add-flags "--storage.path=.dev/data/alloy"

    cat > $out/bin/alloy-service <<EOF
#!/usr/bin/env bash
mkdir -p .dev/data/alloy
exec $out/bin/alloy "\$@"
EOF
    chmod +x $out/bin/alloy-service
  '';

  meta = {
    description = "Alloy wrapped with BeTrace configuration";
    mainProgram = "alloy-service";
  };
}
