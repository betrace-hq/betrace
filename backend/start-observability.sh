#!/bin/bash

echo "=========================================="
echo "FLUO Compliance Observability Stack"
echo "=========================================="
echo ""
echo "This will start:"
echo "  • Grafana Tempo (Distributed Tracing)"
echo "  • Prometheus (Metrics)"
echo "  • Grafana (Visualization)"
echo "  • Jaeger (Alternative Trace UI)"
echo "  • OTEL Collector (Advanced Routing)"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Create required directories
echo "Creating required directories..."
mkdir -p grafana/dashboards
mkdir -p /tmp/fluo-tempo
mkdir -p /tmp/fluo-prometheus

# Start the stack
echo "Starting observability stack..."
docker-compose up -d

# Wait for services to be ready
echo ""
echo "Waiting for services to start..."
sleep 5

# Check service health
echo ""
echo "Checking service health..."
echo -n "  • Grafana: "
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Ready"
else
    echo "⏳ Starting..."
fi

echo -n "  • Prometheus: "
if curl -s http://localhost:9090/-/ready > /dev/null; then
    echo "✅ Ready"
else
    echo "⏳ Starting..."
fi

echo -n "  • Tempo: "
if curl -s http://localhost:3200/ready > /dev/null; then
    echo "✅ Ready"
else
    echo "⏳ Starting..."
fi

echo -n "  • Jaeger: "
if curl -s http://localhost:16686/ > /dev/null; then
    echo "✅ Ready"
else
    echo "⏳ Starting..."
fi

echo ""
echo "=========================================="
echo "Access Points:"
echo "=========================================="
echo ""
echo "📊 Grafana UI:        http://localhost:3000"
echo "   Username:          admin"
echo "   Password:          admin"
echo ""
echo "🔍 Jaeger UI:         http://localhost:16686"
echo ""
echo "📈 Prometheus UI:     http://localhost:9090"
echo ""
echo "🔗 OTLP Endpoints:"
echo "   gRPC:             localhost:4317"
echo "   HTTP:             localhost:4318"
echo ""
echo "=========================================="
echo ""
echo "To view compliance traces in Grafana:"
echo "1. Go to http://localhost:3000"
echo "2. Navigate to Explore → Tempo"
echo "3. Use TraceQL queries like:"
echo "   { .compliance.framework = \"SOC2\" }"
echo "   { .compliance.control = \"CC6.3\" }"
echo "   { .compliance.sensitive_data = true }"
echo ""
echo "To stop the stack: docker-compose down"
echo ""