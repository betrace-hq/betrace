{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Use the most stable, well-cached Node.js version
    nodejs_18

    # Basic tools
    git
    curl
  ];

  shellHook = ''
    echo "🚀 FLUO Tanstack BFF Development Environment (Simple)"
    echo "📦 Node.js version: $(node --version)"
    echo "📦 npm version: $(npm --version)"
    echo ""
    echo "This shell provides Node.js 18 from binary cache."
    echo "Use 'npm run dev' to start development server."
    echo ""

    # Install npm dependencies if needed
    if [ ! -d "node_modules" ]; then
      echo "Installing npm dependencies..."
      npm install
    fi
  '';
}