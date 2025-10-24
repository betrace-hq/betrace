#!/usr/bin/env bash
# BeTrace Services Startup Script
# Starts all observability services in a persistent flox environment

set -e

echo "🚀 Starting BeTrace Services..."
echo ""

# Start services within flox activate and keep shell alive
flox activate -- bash -c '
  echo "📦 Starting services..."
  flox services start

  echo ""
  echo "✅ Services started successfully!"
  echo ""
  flox services status
  echo ""
  echo "🌐 Service URLs:"
  echo "  Grafana:     http://localhost:12015"
  echo "  Loki:        http://localhost:3100"
  echo "  Tempo:       http://localhost:3200"
  echo "  Prometheus:  http://localhost:9090"
  echo "  Pyroscope:   http://localhost:4040"
  echo "  Backend:     http://localhost:8080"
  echo ""
  echo "💡 Press Ctrl+C to stop all services"
  echo "   Or run: flox services stop"
  echo ""

  # Keep shell alive
  exec bash
'
