#!/usr/bin/env bash
set -euo pipefail

# FLUO RAG System Setup Script
# Sets up the complete RAG documentation system

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🤖 FLUO RAG Documentation System Setup"
echo "======================================="
echo ""

# Check if we're in the right directory
if [[ ! -f "$PROJECT_ROOT/flake.nix" ]] || [[ ! -d "$PROJECT_ROOT/ADRs" ]]; then
    echo "❌ Error: Please run this script from the FLUO project root"
    echo "Expected to find flake.nix and ADRs/ directory"
    exit 1
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is required but not found"
    echo "💡 Install Python 3 or use the Nix development shell"
    exit 1
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
if [[ ! -f "$PROJECT_ROOT/venv/bin/activate" ]]; then
    echo "🐍 Creating virtual environment..."
    python3 -m venv "$PROJECT_ROOT/venv"
fi

source "$PROJECT_ROOT/venv/bin/activate"
pip install -r "$PROJECT_ROOT/requirements-rag.txt"
echo "✅ Python dependencies installed"
echo ""

# Check if we can connect to Chroma
echo "🔍 Checking Chroma database connection..."
CHROMA_HOST="${CHROMA_HOST:-localhost}"
CHROMA_PORT="${CHROMA_PORT:-8000}"

if curl -s "http://$CHROMA_HOST:$CHROMA_PORT/api/v1/heartbeat" > /dev/null; then
    echo "✅ Chroma database is running at $CHROMA_HOST:$CHROMA_PORT"
else
    echo "⚠️  Chroma database not accessible at $CHROMA_HOST:$CHROMA_PORT"
    echo "💡 To deploy Chroma:"
    echo "   cd $PROJECT_ROOT/infra"
    echo "   nix run .#deploy-all"
    echo "   # Or just Chroma:"
    echo "   nix run ./components/chroma#deploy"
    echo "   kubectl port-forward -n fluo-chroma svc/chroma 8000:8000"
    echo ""
fi

# Ingest documentation
echo "📚 Ingesting FLUO documentation..."
cd "$PROJECT_ROOT"

python3 scripts/ingest-docs.py \
    --base-path . \
    --chroma-host "$CHROMA_HOST" \
    --chroma-port "$CHROMA_PORT" \
    --force-update \
    --test-query "service deployment patterns"

echo ""
echo "✅ RAG system setup complete!"
echo ""
echo "🎯 Quick Start Commands:"
echo ""
echo "# Search all documentation"
echo "./tools/rag-query.py 'kubernetes deployment'"
echo ""
echo "# Search specific document types"
echo "./tools/rag-query.py 'security protocols' --type SOP"
echo "./tools/rag-query.py 'service deployment' --type ADR"
echo ""
echo "# Interactive mode"
echo "./tools/rag-query.py --interactive"
echo ""
echo "# Generate context for prompts"
echo "./tools/rag-query.py 'tanstack architecture' --context"
echo ""
echo "# Show statistics"
echo "./tools/rag-query.py --stats"
echo ""
echo "📖 For more information, see ADR-010: RAG Documentation System"
echo "🔗 ADRs/010-rag-documentation-system.md"