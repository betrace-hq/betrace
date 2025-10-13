#!/usr/bin/env bash
set -e

echo "🚀 Setting up FLUO Marketing Automation"
echo "========================================"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "✅ Ollama already installed"
fi

# Check if Ollama server is running
if ! curl -s http://localhost:11434/api/version &> /dev/null; then
    echo "🔄 Starting Ollama server..."
    ollama serve &
    OLLAMA_PID=$!
    sleep 3
    echo "✅ Ollama server started (PID: $OLLAMA_PID)"
else
    echo "✅ Ollama server already running"
fi

# Pull required models
echo ""
echo "📦 Pulling Ollama models (this may take a few minutes)..."
echo ""

models=("llama3.1:8b" "mistral:7b" "codellama:7b")
for model in "${models[@]}"; do
    if ollama list | grep -q "$model"; then
        echo "✅ $model already installed"
    else
        echo "⬇️  Pulling $model..."
        ollama pull "$model"
    fi
done

echo ""
echo "✅ All models installed!"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created (please update with your API keys)"
else
    echo "✅ .env already exists"
fi

# Install npm dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "  1. Update .env with your API keys"
echo "  2. Run: npm run dev"
echo "  3. Access n8n: http://localhost:5678"
echo "  4. Import workflows: npm run workflows:import"
echo ""
