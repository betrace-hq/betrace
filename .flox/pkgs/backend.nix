{ buildGoModule, lib, duckdb }:

buildGoModule {
  pname = "fluo-backend";
  version = "2.0.0";

  src = ../../backend-go;

  vendorHash = "sha256-mcKkL1g12+lqOR/ADdRmnBcDvxDizVrYwDpPXNFUAqU=";

  # Enable CGO for DuckDB
  CGO_ENABLED = 1;

  buildInputs = [ duckdb ];

  # Set DuckDB library paths
  preBuild = ''
    export CGO_LDFLAGS="-L${duckdb}/lib"
    export CGO_CFLAGS="-I${duckdb.dev}/include"
  '';

  ldflags = [
    "-s"  # Strip debug symbols
    "-w"  # Strip DWARF
    "-X main.version=2.0.0"
    "-X main.commit=${lib.substring 0 7 (builtins.getEnv "FLOX_ENV_GIT_REV" or "dev")}"
  ];

  # Build both backend and CLI
  subPackages = [ "cmd/fluo-backend" "cmd/fluo-cli" ];

  meta = {
    description = "FLUO behavioral assurance backend (Go)";
    homepage = "https://github.com/fluohq/fluo";
    license = lib.licenses.mit;
    mainProgram = "fluo-backend";
  };
}
