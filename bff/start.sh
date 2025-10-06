#!/usr/bin/env bash

# FLUO Tanstack BFF startup script for production

set -euo pipefail

# Default environment variables
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"

# Check if required environment variables are set
required_vars=(
    "WORKOS_API_KEY"
    "WORKOS_CLIENT_ID"
    "WORKOS_REDIRECT_URI"
    "JWT_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo "❌ Error: Missing required environment variables:"
    printf "   %s\n" "${missing_vars[@]}"
    echo ""
    echo "Please set these environment variables before starting the application."
    echo "See .env.example for reference."
    exit 1
fi

echo "🚀 Starting FLUO Tanstack BFF..."
echo "📍 Environment: $NODE_ENV"
echo "🌐 Host: $HOST"
echo "🔗 Port: $PORT"

# Build the application if needed
if [ ! -d "dist" ]; then
    echo "📦 Building application..."
    npm run build
fi

# Start the Vite application in preview mode
exec npm run preview -- --host $HOST --port $PORT