{ pkgs, lib, ... }:

let
  # Import the backend flake to get the pre-built package
  backendFlake = (builtins.getFlake (toString ../../backend));
  backendPkg = backendFlake.packages.${pkgs.system}.backend;
in

pkgs.writeShellScriptBin "backend-wrapped" ''
  set -e

  echo "🚀 Starting BeTrace backend on port ''${PORT:-12011}..."
  exec ${backendPkg}/bin/betrace-backend
''
