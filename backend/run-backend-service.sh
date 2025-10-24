#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "🔨 Building BeTrace backend..."
CGO_ENABLED=1 GOFLAGS="-mod=vendor" go build -o betrace-backend-bin ./cmd/betrace-backend

echo "🚀 Starting BeTrace backend on port ${PORT:-12011}..."
exec ./betrace-backend-bin
