{ buildNpmPackage, nodejs_20, python3, lib }:

buildNpmPackage {
  pname = "betrace-frontend";
  version = "0.1.0";

  src = lib.cleanSourceWith {
    filter = path: type:
      let baseName = baseNameOf path; in
      !(lib.hasInfix "node_modules" path) &&
      !(lib.hasInfix ".git" path) &&
      !(lib.hasInfix "dist" path) &&
      !(baseName == "result") &&
      !(baseName == ".env") &&
      !(baseName == ".env.local");
    src = ../../bff;
  };

  # Hash from existing flake
  npmDepsHash = "sha256-iDzSLtV7aXtZUggc54zQGWRUR8wqU4GYfe+Gbs/LI5o=";

  env = {
    PUPPETEER_SKIP_DOWNLOAD = "1";
  };

  buildInputs = [ nodejs_20 python3 ];

  buildPhase = ''
    export HOME=$TMPDIR
    export NODE_ENV=production

    echo "🔧 Generating route tree..."
    npx @tanstack/router-cli generate

    echo "📦 Building frontend application..."
    npm run build
  '';

  installPhase = ''
    mkdir -p $out
    cp -r dist/* $out/
  '';

  meta = {
    description = "BeTrace Frontend - React application with Tanstack Router";
    homepage = "https://github.com/betracehq/betrace";
  };
}
