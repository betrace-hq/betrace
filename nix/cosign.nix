# Cosign Image Signing for BeTrace Containers
#
# This module provides cosign signing capabilities for OCI container images.
# Supports both keyless (OIDC) and key-based signing.
#
# Usage:
#   signed = signImage {
#     image = containers.backend;
#     name = "betrace-backend";
#     keyless = true;  # or provide keyPath for key-based signing
#   };

{ pkgs }:

let
  # Helper to sign a container image with cosign
  signImage = {
    image,           # OCI image (from dockerTools.buildLayeredImage)
    name,            # Image name (e.g., "betrace-backend")
    tag ? "latest",  # Image tag
    keyless ? false, # Use keyless signing (OIDC)
    keyPath ? null,  # Path to signing key (for key-based signing)
    registry ? "",   # Optional: registry to push to after signing
  }:
    assert keyless -> keyPath == null;
    assert !keyless -> keyPath != null;

    pkgs.runCommand "signed-${name}" {
      nativeBuildInputs = with pkgs; [
        cosign
        skopeo
        docker
      ];

      # Pass through the original image
      passthru = {
        inherit image;
        unsigned = image;
      };
    } (
      if keyless then
        # Keyless signing (OIDC-based, requires interactive auth)
        ''
          echo "⚠️  Keyless signing requires interactive OIDC authentication"
          echo "This is designed for CI/CD environments with OIDC providers"
          echo ""
          echo "To sign manually after building:"
          echo "  1. Load image: docker load < ${image}"
          echo "  2. Sign: cosign sign ${name}:${tag}"
          echo ""

          # For now, just copy the unsigned image
          # In CI/CD, this would trigger OIDC flow
          cp ${image} $out

          echo "Image ready for keyless signing: ${name}:${tag}" > $out.signing-info
        ''
      else
        # Key-based signing
        ''
          # Load the image archive
          echo "Loading image ${name}:${tag}..."

          # Create a temporary directory for skopeo
          TMPDIR=$(mktemp -d)

          # Extract image to OCI directory layout
          echo "Extracting image..."
          skopeo copy docker-archive:${image} oci:$TMPDIR/image:${tag}

          # Sign with cosign (key-based)
          echo "Signing image with cosign..."
          cosign sign --key ${keyPath} \
            --tlog-upload=false \
            oci:$TMPDIR/image:${tag}

          # Re-package as docker archive
          echo "Packaging signed image..."
          skopeo copy oci:$TMPDIR/image:${tag} docker-archive:$out:${name}:${tag}

          # Create signing metadata
          cat > $out.signing-info <<EOF
          Image: ${name}:${tag}
          Signed: yes
          Method: key-based
          Key: ${keyPath}
          Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
          EOF

          echo "✅ Image signed successfully"

          # Cleanup
          rm -rf $TMPDIR
        ''
    );

  # Helper to generate cosign key pair
  generateKeyPair = {
    name ? "betrace-signing-key",
    outputDir ? "./cosign-keys",
  }:
    pkgs.runCommand "generate-cosign-keys" {
      nativeBuildInputs = [ pkgs.cosign ];
    } ''
      mkdir -p $out
      cd $out

      echo "Generating cosign key pair..."
      cosign generate-key-pair

      echo ""
      echo "✅ Keys generated:"
      echo "   Private: $out/cosign.key"
      echo "   Public:  $out/cosign.pub"
      echo ""
      echo "⚠️  IMPORTANT: Keep cosign.key secure!"
      echo "   - Add to .gitignore"
      echo "   - Store in secrets manager (CI/CD)"
      echo "   - Use for signing in production"
    '';

  # Helper to verify a signed image
  verifyImage = {
    image,
    name,
    tag ? "latest",
    publicKey ? null,  # Path to public key (for key-based verification)
    keyless ? false,   # Verify keyless signature
  }:
    pkgs.runCommand "verify-${name}" {
      nativeBuildInputs = with pkgs; [ cosign docker ];
    } (
      if keyless then
        ''
          echo "Verifying keyless signature for ${name}:${tag}..."

          # Load image
          docker load < ${image}

          # Verify (keyless)
          cosign verify ${name}:${tag} > $out

          echo "✅ Signature verified (keyless)"
        ''
      else
        assert publicKey != null;
        ''
          echo "Verifying signature for ${name}:${tag}..."

          # Load image
          docker load < ${image}

          # Verify with public key
          cosign verify --key ${publicKey} ${name}:${tag} > $out

          echo "✅ Signature verified"
        ''
    );

  # Helper to create a signed container bundle
  # Returns a set with unsigned and signed images
  signedBundle = {
    containers,      # Set of containers from containers.nix
    keyPath ? null,  # Optional: path to signing key
    keyless ? false, # Use keyless signing
  }:
    let
      shouldSign = keyPath != null || keyless;

      # Sign each container if signing is enabled
      signContainer = name: image:
        if shouldSign then
          signImage {
            inherit image name keyless keyPath;
          }
        else
          image;
    in
    pkgs.lib.mapAttrs signContainer containers;

in {
  inherit signImage generateKeyPair verifyImage signedBundle;

  # Export cosign package for convenience
  cosign = pkgs.cosign;

  # Documentation
  docs = {
    description = "Cosign signing utilities for BeTrace containers";

    examples = {
      # Example 1: Key-based signing
      keyBased = ''
        # Generate keys (once)
        nix build .#cosign-keys

        # Sign backend image
        nix build .#container-backend-signed \
          --arg keyPath ./cosign-keys/cosign.key
      '';

      # Example 2: Keyless signing (CI/CD)
      keyless = ''
        # In GitHub Actions with OIDC
        - uses: sigstore/cosign-installer@v3
        - run: |
            nix build .#container-backend
            docker load < result
            cosign sign betrace-backend:latest
      '';

      # Example 3: Verification
      verify = ''
        # Verify with public key
        nix build .#verify-backend \
          --arg publicKey ./cosign-keys/cosign.pub

        # Or verify keyless
        cosign verify betrace-backend:latest
      '';
    };

    ci_cd = {
      github_actions = ''
        name: Sign Containers

        on:
          push:
            branches: [main]

        jobs:
          sign:
            permissions:
              id-token: write  # For OIDC
              packages: write  # For registry push

            steps:
              - uses: actions/checkout@v4

              - uses: cachix/install-nix-action@v24

              - uses: sigstore/cosign-installer@v3

              - name: Build containers
                run: nix build .#containers-all

              - name: Load and sign images
                run: |
                  docker load < result/betrace-backend.tar.gz
                  cosign sign betrace-backend:latest

                  docker load < result/betrace-frontend.tar.gz
                  cosign sign betrace-frontend:latest
      '';
    };
  };
}
