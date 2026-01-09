#!/bin/bash
# BeTrace Quick Start Script
#
# This script helps you get BeTrace running quickly with Docker Compose.
#
# Usage:
#   ./quickstart.sh          # Start BeTrace
#   ./quickstart.sh stop     # Stop BeTrace
#   ./quickstart.sh logs     # View logs
#   ./quickstart.sh status   # Check service status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

# Default ports (can be overridden via environment)
BACKEND_PORT="${BETRACE_PORT_BACKEND:-12011}"
GRAFANA_PORT="${BETRACE_PORT_GRAFANA:-12015}"

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║              BeTrace - Behavioral Assurance                ║${NC}"
    echo -e "${BLUE}║         Pattern matching for OpenTelemetry traces          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed.${NC}"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} Docker installed"

    # Check Docker Compose (v2)
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}Error: Docker Compose v2 is not available.${NC}"
        echo "Please update Docker or install Docker Compose plugin."
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} Docker Compose v2 available"

    # Check if ports are available
    if lsof -Pi :${BACKEND_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Port ${BACKEND_PORT} is in use. Backend may not start.${NC}"
    fi
    if lsof -Pi :${GRAFANA_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Port ${GRAFANA_PORT} is in use. Grafana may not start.${NC}"
    fi

    echo ""
}

start_services() {
    echo -e "${YELLOW}Starting BeTrace services...${NC}"

    cd "${SCRIPT_DIR}"
    docker compose up -d

    echo ""
    echo -e "${YELLOW}Waiting for services to become healthy...${NC}"

    # Wait for backend
    echo -n "  Backend: "
    for i in {1..30}; do
        if curl -sf "http://localhost:${BACKEND_PORT}/v1/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ healthy${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}✗ failed to start${NC}"
            echo "Check logs with: ./quickstart.sh logs"
            exit 1
        fi
        echo -n "."
        sleep 2
    done

    # Wait for Grafana
    echo -n "  Grafana: "
    for i in {1..30}; do
        if curl -sf "http://localhost:${GRAFANA_PORT}/api/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ healthy${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${YELLOW}⚠ slow start (may still be loading)${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done

    echo ""
    print_access_info
}

stop_services() {
    echo -e "${YELLOW}Stopping BeTrace services...${NC}"
    cd "${SCRIPT_DIR}"
    docker compose down
    echo -e "${GREEN}Services stopped.${NC}"
}

show_logs() {
    cd "${SCRIPT_DIR}"
    docker compose logs -f
}

show_status() {
    echo -e "${YELLOW}Service Status:${NC}"
    cd "${SCRIPT_DIR}"
    docker compose ps

    echo ""
    echo -e "${YELLOW}Health Checks:${NC}"

    # Backend health
    echo -n "  Backend (localhost:${BACKEND_PORT}): "
    if curl -sf "http://localhost:${BACKEND_PORT}/v1/health" > /dev/null 2>&1; then
        echo -e "${GREEN}healthy${NC}"
    else
        echo -e "${RED}unreachable${NC}"
    fi

    # Grafana health
    echo -n "  Grafana (localhost:${GRAFANA_PORT}): "
    if curl -sf "http://localhost:${GRAFANA_PORT}/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}healthy${NC}"
    else
        echo -e "${RED}unreachable${NC}"
    fi
}

print_access_info() {
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                   BeTrace is Ready!                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BLUE}Grafana:${NC}  http://localhost:${GRAFANA_PORT}"
    echo -e "           Username: admin"
    echo -e "           Password: admin"
    echo ""
    echo -e "  ${BLUE}Backend:${NC}  http://localhost:${BACKEND_PORT}"
    echo -e "           Health:  http://localhost:${BACKEND_PORT}/v1/health"
    echo -e "           Rules:   http://localhost:${BACKEND_PORT}/v1/rules"
    echo ""
    echo -e "  ${YELLOW}Quick Commands:${NC}"
    echo "    ./quickstart.sh stop    - Stop all services"
    echo "    ./quickstart.sh logs    - View service logs"
    echo "    ./quickstart.sh status  - Check service health"
    echo ""
}

# Main
print_header

case "${1:-start}" in
    start)
        check_prerequisites
        start_services
        ;;
    stop)
        stop_services
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {start|stop|logs|status}"
        exit 1
        ;;
esac
