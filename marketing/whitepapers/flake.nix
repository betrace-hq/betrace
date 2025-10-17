{
  description = "FLUO Whitepapers - PDF Generation";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Pandoc with extensions
        pandocFull = pkgs.pandoc;

        # Build a single whitepaper PDF
        buildWhitepaper = name: markdown: pkgs.stdenv.mkDerivation {
          name = "${name}.pdf";
          src = ./.;

          buildInputs = [
            pandocFull
            pkgs.texlive.combined.scheme-full
          ];

          buildPhase = ''
            export HOME=$TMPDIR
            mkdir -p $HOME/.cache/fontconfig

            pandoc ${markdown} \
              --from=markdown \
              --to=pdf \
              --template=templates/fluo-whitepaper.latex \
              --bibliography=references.bib \
              --citeproc \
              --number-sections \
              --toc \
              --pdf-engine=xelatex \
              -o ${name}.pdf
          '';

          installPhase = ''
            mkdir -p $out
            cp ${name}.pdf $out/
          '';
        };

      in {
        packages = {
          # Individual whitepapers
          economics = buildWhitepaper "economics-of-observability" "economics-of-observability.md";
          invariants = buildWhitepaper "hidden-cost-invariants" "hidden-cost-undocumented-invariants.md";
          security = buildWhitepaper "multi-tenant-security" "multi-tenant-security.md";
          compliance = buildWhitepaper "compliance-evidence-automation" "compliance-evidence-automation.md";

          # Build all whitepapers
          all = pkgs.symlinkJoin {
            name = "fluo-whitepapers";
            paths = [
              (buildWhitepaper "economics-of-observability" "economics-of-observability.md")
              (buildWhitepaper "hidden-cost-invariants" "hidden-cost-undocumented-invariants.md")
              (buildWhitepaper "multi-tenant-security" "multi-tenant-security.md")
              (buildWhitepaper "compliance-evidence-automation" "compliance-evidence-automation.md")
            ];
          };

          default = self.packages.${system}.all;
        };

        # Development shell with Pandoc and LaTeX
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pandocFull
            pkgs.texlive.combined.scheme-full
          ];

          shellHook = ''
            echo "FLUO Whitepaper PDF Build Environment"
            echo ""
            echo "Build commands:"
            echo "  nix build .#economics     - Build Economics whitepaper"
            echo "  nix build .#invariants    - Build Invariants whitepaper"
            echo "  nix build .#security      - Build Security whitepaper"
            echo "  nix build .#compliance    - Build Compliance whitepaper"
            echo "  nix build .#all           - Build all whitepapers"
            echo ""
            echo "Manual build:"
            echo "  pandoc economics-of-observability.md \\"
            echo "    --template=templates/fluo-whitepaper.latex \\"
            echo "    --bibliography=references.bib \\"
            echo "    --citeproc --toc -o economics.pdf"
          '';
        };
      }
    );
}
