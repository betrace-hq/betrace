.PHONY: help setup teardown test test-quick test-full report clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Start full test stack (process-compose)
	@echo "Starting BeTrace RC test stack with process-compose..."
	@echo "Starting process-compose in headless mode..."
	@process-compose up --tui=false > logs/process-compose.log 2>&1 &
	@echo "Waiting for services to be healthy..."
	@sleep 20
	@echo "✓ Test environment ready"

teardown: ## Stop test stack
	@echo "Stopping test stack..."
	process-compose down
	@echo "✓ Test environment stopped"

status: ## Show service status
	process-compose process list

test-quick: ## Run quick tests only (skip slow/performance tests)
	@echo "Running quick RC tests..."
	go test -v -tags=rc -short ./scenarios/... -timeout=10m

test-full: ## Run full RC test suite (requires setup)
	@echo "Running full RC test suite..."
	go test -v -tags=rc ./scenarios/... -timeout=2h -json | tee reports/rc-$(shell date +%Y%m%d-%H%M%S).json
	@echo "✓ Full test suite completed"

test-lifecycle: ## Run rule lifecycle tests only
	go test -v -tags=rc ./scenarios/01-rule-lifecycle -timeout=30m

test-ingestion: ## Run span ingestion tests only
	go test -v -tags=rc ./scenarios/02-span-ingestion -timeout=30m

test-evaluation: ## Run rule evaluation tests only
	go test -v -tags=rc ./scenarios/03-rule-evaluation -timeout=30m

report: ## Generate HTML test report (requires test run with -json)
	@echo "Generating HTML report..."
	@if [ -z "$(JSON_FILE)" ]; then \
		echo "Usage: make report JSON_FILE=reports/rc-YYYYMMDD-HHMMSS.json"; \
		exit 1; \
	fi
	@go-test-report -i $(JSON_FILE) -o reports/rc-report.html || echo "Install: go install github.com/vakenbolt/go-test-report@latest"
	@echo "✓ Report generated at reports/rc-report.html"

clean: ## Clean test artifacts
	@echo "Cleaning test artifacts..."
	rm -rf reports/*.json reports/*.html
	@echo "✓ Cleaned"

ci: setup test-full teardown ## Run full CI pipeline (setup + test + teardown)

# Prerequisites check
check-deps: ## Check required dependencies
	@echo "Checking dependencies..."
	@command -v docker >/dev/null 2>&1 || (echo "✗ docker not found" && exit 1)
	@command -v docker-compose >/dev/null 2>&1 || (echo "✗ docker-compose not found" && exit 1)
	@command -v go >/dev/null 2>&1 || (echo "✗ go not found" && exit 1)
	@echo "✓ All dependencies satisfied"

# Dev helpers
logs: ## Follow backend logs
	docker-compose logs -f betrace-backend

logs-all: ## Follow all service logs
	docker-compose logs -f

status: ## Show service status
	docker-compose ps

health: ## Check service health
	@echo "Checking service health..."
	@curl -s http://localhost:12011/health && echo " ✓ Backend healthy" || echo " ✗ Backend unhealthy"
	@curl -s http://localhost:3200/ready && echo " ✓ Tempo healthy" || echo " ✗ Tempo unhealthy"
	@curl -s http://localhost:12015/api/health && echo " ✓ Grafana healthy" || echo " ✗ Grafana unhealthy"
