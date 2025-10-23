# PRD-025: CI/CD Integration

**Priority:** P1 (Infrastructure - Production Readiness)
**Complexity:** Complex (System)
**Type:** System Overview
**Personas:** Developer, DevOps, QA
**Dependencies:**
- PRD-018 (Comprehensive Test Suite)
- ADR-002 (Nix Flakes as Build System Foundation)
- ADR-011 (Pure Application Framework)

## Architecture Integration

This PRD complies with BeTrace's architectural standards:

- **ADR-002 (Nix Flakes):** CI/CD uses Nix for reproducible builds
- **ADR-011 (Pure Application):** CI/CD builds application packages, not infrastructure
- **ADR-014 (Named Processors):** CI/CD enforces 90% test coverage requirement
- PRD-018 (Test Suite): CI/CD runs all test levels (unit, integration, e2e, performance, security)

## Problem

**No automated CI/CD pipeline for BeTrace:**
- Manual build process (error-prone, slow)
- No automated testing on every commit
- No test coverage enforcement (90% requirement from ADR-014)
- No security scanning (SAST, DAST, dependency vulnerabilities)
- No performance regression detection
- No automated deployment to staging/production
- No rollback strategy for failed deployments
- Compliance gap: SOC2 CC8.1 requires change management controls

**Current State:**
- Developers run tests locally (inconsistent environments)
- No pre-commit hooks or code quality gates
- Manual deployment process
- No deployment audit trail
- No automated rollback

**Impact:**
- Bugs slip into production
- Security vulnerabilities undetected
- Performance regressions unnoticed
- Manual deployment errors
- Slow release cycles (days instead of hours)
- Compliance audit failures (SOC2 CC8.1)

## Solution

### CI/CD Pipeline Architecture

**GitHub Actions Workflow** (multi-stage pipeline):

```
[Git Push]
  ↓
[1. Code Quality Stage] (2 minutes)
  ├── Lint backend (Maven checkstyle)
  ├── Lint frontend (ESLint)
  ├── Format check (Prettier)
  └── Type check (TypeScript)
  ↓
[2. Build Stage] (5 minutes)
  ├── Build backend (nix build .#backend)
  ├── Build frontend (nix build .#frontend)
  └── Build Storybook (npm run build-storybook)
  ↓
[3. Unit Test Stage] (3 minutes)
  ├── Backend unit tests (mvn test)
  ├── Frontend unit tests (npm run test)
  └── Coverage report (JaCoCo + Vitest)
  ↓
[4. Integration Test Stage] (5 minutes)
  ├── Start Testcontainers (TigerBeetle, DuckDB)
  ├── Run integration tests
  └── Cleanup containers
  ↓
[5. Security Scan Stage] (3 minutes)
  ├── SAST (Semgrep, CodeQL)
  ├── Dependency scan (npm audit, OWASP Dependency Check)
  ├── Secret scan (Gitleaks)
  └── Container scan (Trivy)
  ↓
[6. End-to-End Test Stage] (10 minutes)
  ├── Start BeTrace stack (nix run .#dev)
  ├── Run Playwright tests
  └── Stop stack
  ↓
[7. Performance Test Stage] (5 minutes)
  ├── Run JMH benchmarks
  ├── Compare with baseline
  └── Fail if regression >10%
  ↓
[8. Deploy Stage] (10 minutes)
  ├── Deploy to staging
  ├── Run smoke tests
  ├── Deploy to production (manual approval)
  └── Record deployment event in TigerBeetle
```

**Total Pipeline Duration: ~43 minutes** (within 1 hour target)

### Deployment Strategy

**Blue-Green Deployment:**
- Deploy new version (green) alongside current (blue)
- Run smoke tests on green
- Switch traffic to green (atomic cutover)
- Keep blue running for quick rollback
- Drain blue after validation period (15 minutes)

**Rollback Strategy:**
- Automated rollback on health check failures
- Manual rollback via GitHub Actions workflow
- Rollback SLA: <5 minutes (switch traffic back to blue)

**Deployment Gates:**
- All tests pass (unit, integration, e2e)
- No critical security vulnerabilities
- Test coverage ≥90% (ADR-014)
- Performance benchmarks within threshold
- Manual approval for production (required)

## Unit PRD References

This PRD should be decomposed into the following unit PRDs:

| PRD | Unit | Purpose | Dependencies | Est. Lines |
|-----|------|---------|--------------|------------|
| 025a | GitHubActionsWorkflow | Main CI/CD pipeline definition | PRD-018 | ~400 |
| 025b | CodeQualityGates | Linting, formatting, type checking | None | ~300 |
| 025c | SecurityScanningPipeline | SAST, dependency scan, secrets | None | ~350 |
| 025d | PerformanceRegressionDetection | Benchmark comparison, alerts | PRD-018g | ~300 |
| 025e | DeploymentAutomation | Blue-green deployment, rollback | None | ~400 |
| 025f | CoverageEnforcement | Enforce 90% coverage requirement | PRD-018 | ~250 |
| 025g | DeploymentAuditTrail | Record deployments in TigerBeetle | PRD-002 | ~300 |
| 025h | CICDMonitoringDashboard | Pipeline metrics and alerts | PRD-025e | ~350 |

**Total estimated:** 8 unit PRDs, ~2,650 lines

## GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: BeTrace CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  code-quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Nix
        uses: cachix/install-nix-action@v25
        with:
          nix_path: nixpkgs=channel:nixos-unstable

      - name: Lint Backend
        run: cd backend && mvn checkstyle:check

      - name: Lint Frontend
        run: cd bff && npm run lint

      - name: Format Check
        run: cd bff && npm run format:check

      - name: Type Check
        run: cd bff && npm run type-check

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: code-quality
    steps:
      - uses: actions/checkout@v4

      - name: Setup Nix
        uses: cachix/install-nix-action@v25

      - name: Build Backend
        run: nix build .#backend

      - name: Build Frontend
        run: nix build .#frontend

      - name: Build Storybook
        run: cd bff && npm run build-storybook

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            result/
            bff/storybook-static/

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Setup Nix
        uses: cachix/install-nix-action@v25

      - name: Backend Unit Tests
        run: cd backend && mvn test

      - name: Frontend Unit Tests
        run: cd bff && npm run test

      - name: Generate Coverage Report
        run: |
          cd backend && mvn jacoco:report
          cd ../bff && npm run test:coverage

      - name: Upload Coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./backend/target/site/jacoco/jacoco.xml,./bff/coverage/coverage-final.json

      - name: Enforce Coverage Threshold
        run: |
          # Fail if backend coverage <90%
          # Fail if frontend coverage <80%

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4

      - name: Setup Nix
        uses: cachix/install-nix-action@v25

      - name: Start Testcontainers
        run: docker-compose -f test-compose.yml up -d

      - name: Run Integration Tests
        run: cd backend && mvn verify -Pintegration

      - name: Cleanup Testcontainers
        if: always()
        run: docker-compose -f test-compose.yml down

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: build
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: SAST - Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: auto

      - name: SAST - CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: java, javascript

      - name: CodeQL Analyze
        uses: github/codeql-action/analyze@v3

      - name: Dependency Scan - npm audit
        run: cd bff && npm audit --audit-level=moderate

      - name: Dependency Scan - OWASP
        run: cd backend && mvn dependency-check:check

      - name: Secret Scan - Gitleaks
        uses: gitleaks/gitleaks-action@v2

  e2e-tests:
    name: End-to-End Tests
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4

      - name: Setup Nix
        uses: cachix/install-nix-action@v25

      - name: Start BeTrace Stack
        run: nix run .#dev &

      - name: Wait for Services
        run: |
          timeout 60 bash -c 'until curl -f http://localhost:3000; do sleep 1; done'
          timeout 60 bash -c 'until curl -f http://localhost:8080/health; do sleep 1; done'

      - name: Run Playwright Tests
        run: cd bff && npm run test:e2e

      - name: Upload Playwright Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: bff/playwright-report/

      - name: Stop BeTrace Stack
        if: always()
        run: pkill -f "nix run"

  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4

      - name: Setup Nix
        uses: cachix/install-nix-action@v25

      - name: Run JMH Benchmarks
        run: cd backend && mvn test -Pbenchmark

      - name: Compare with Baseline
        run: |
          # Compare current benchmark results with baseline
          # Fail if regression >10%

      - name: Upload Benchmark Results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: backend/target/benchmarks/

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [e2e-tests, security-scan, performance-tests]
    if: github.ref == 'refs/heads/main'
    environment:
      name: staging
      url: https://staging.fluo.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Download Artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts

      - name: Deploy to Staging
        run: |
          # Blue-green deployment to staging
          # 1. Deploy green version
          # 2. Run smoke tests
          # 3. Switch traffic to green
          # 4. Drain blue after 15 minutes

      - name: Run Smoke Tests
        run: |
          curl -f https://staging.fluo.example.com/health
          # Additional smoke tests

      - name: Record Deployment Event
        run: |
          # Record deployment in TigerBeetle (code=13)

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://fluo.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Download Artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts

      - name: Deploy to Production
        run: |
          # Blue-green deployment to production
          # Manual approval gate required

      - name: Run Smoke Tests
        run: |
          curl -f https://fluo.example.com/health

      - name: Record Deployment Event
        run: |
          # Record deployment in TigerBeetle (code=13)

      - name: Notify Team
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## TigerBeetle Deployment Schema

**Deployment Event Transfer (code=13):**
```java
Transfer deploymentEvent = new Transfer(
    id: UUID (deployment event ID),
    debitAccountId: systemAccount,       // BeTrace system account
    creditAccountId: environmentAccount, // staging or production
    amount: 1,  // Deployment count
    code: 13,  // Deployment event type
    userData128: pack(
        environment: 8 bits (1=staging, 2=production),
        deployment_type: 8 bits (1=blue-green, 2=rolling, 3=canary),
        status: 8 bits (1=started, 2=completed, 3=failed, 4=rolled_back),
        version_major: 8 bits,
        version_minor: 8 bits,
        version_patch: 16 bits,
        commit_hash: 64 bits (first 8 bytes of git SHA)
    ),
    userData64: timestamp,
    ledger: 0  // System ledger
);
```

**Deployment Metadata Storage:**
```sql
-- DuckDB: Deployment metadata table
CREATE TABLE deployment_metadata (
    id UUID PRIMARY KEY,
    environment VARCHAR(50) NOT NULL,  -- staging, production
    deployment_type VARCHAR(50) NOT NULL,  -- blue-green, rolling, canary
    version VARCHAR(50) NOT NULL,  -- 1.2.3
    commit_hash VARCHAR(64) NOT NULL,  -- Full git SHA
    commit_message TEXT,
    deployed_by VARCHAR(255) NOT NULL,  -- GitHub username
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status VARCHAR(50) NOT NULL,  -- started, completed, failed, rolled_back
    rollback_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deployment_metadata_env ON deployment_metadata(environment);
CREATE INDEX idx_deployment_metadata_status ON deployment_metadata(status);
CREATE INDEX idx_deployment_metadata_version ON deployment_metadata(version);
```

## Coverage Enforcement

**Backend (JaCoCo):**
```xml
<!-- pom.xml -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <executions>
        <execution>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <execution>
            <id>check</id>
            <goals>
                <goal>check</goal>
            </goals>
            <configuration>
                <rules>
                    <rule>
                        <element>PACKAGE</element>
                        <limits>
                            <limit>
                                <counter>LINE</counter>
                                <value>COVEREDRATIO</value>
                                <minimum>0.90</minimum>
                            </limit>
                        </limits>
                    </rule>
                </rules>
            </configuration>
        </execution>
    </executions>
</plugin>
```

**Frontend (Vitest):**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      exclude: [
        '**/*.stories.tsx',
        '**/*.test.tsx',
        '**/node_modules/**',
      ],
    },
  },
});
```

## Success Criteria

**Functional Requirements:**
- [ ] Automated CI/CD pipeline on every commit
- [ ] Code quality gates (linting, formatting, type checking)
- [ ] Unit tests run automatically with coverage enforcement
- [ ] Integration tests run with Testcontainers
- [ ] End-to-end tests run with Playwright
- [ ] Security scans (SAST, dependency scan, secrets)
- [ ] Performance benchmarks with regression detection
- [ ] Blue-green deployment to staging/production
- [ ] Automated rollback on failure
- [ ] Deployment audit trail in TigerBeetle

**Performance Requirements:**
- [ ] Full CI pipeline completes in <45 minutes
- [ ] Deployment to staging in <10 minutes
- [ ] Deployment to production in <10 minutes
- [ ] Rollback completed in <5 minutes

**Compliance Requirements:**
- [ ] SOC2 CC8.1 (Change Management) evidence
- [ ] All deployments recorded in TigerBeetle audit trail
- [ ] Manual approval required for production deployments
- [ ] Deployment history queryable for audits

**Testing Requirements:**
- [ ] Unit tests: 90% backend, 80% frontend (enforced)
- [ ] Integration tests pass before deployment
- [ ] E2E tests pass before deployment
- [ ] Security scans find no critical vulnerabilities
- [ ] Performance benchmarks within threshold

## Integration with Existing PRDs

**PRD-018 (Test Suite):**
- CI/CD runs all test levels (unit, integration, e2e, performance, security)
- Coverage enforcement uses PRD-018 test infrastructure

**PRD-002 (TigerBeetle):**
- Deployment events recorded as TigerBeetle transfers (code=13)

**ADR-002 (Nix Flakes):**
- CI/CD uses Nix for reproducible builds
- All builds use `nix build` commands

**ADR-011 (Pure Application):**
- CI/CD builds application packages only
- Deployment is external to application code

## Compliance Benefits

**SOC2 CC8.1 (Change Management - Testing):**
- Evidence: Automated tests run on every commit
- Evidence: 90% test coverage enforced
- Evidence: Manual approval for production deployments
- Evidence: Deployment audit trail in TigerBeetle

**SOC2 CC7.2 (System Monitoring):**
- Evidence: Pipeline metrics tracked
- Evidence: Deployment success/failure monitored
- Evidence: Rollback procedures documented and automated

**Audit Trail:**
- Which version deployed (version in transfer)
- Where deployed (environment in transfer)
- When deployed (timestamp in transfer)
- Who deployed (deployed_by in metadata table)
- Deployment status (status in transfer)

## Security Considerations

**Threats & Mitigations:**
- **Pipeline compromise** - mitigate with GitHub Actions security best practices
- **Secret leakage** - mitigate with Gitleaks secret scanning
- **Dependency vulnerabilities** - mitigate with npm audit, OWASP Dependency Check
- **Malicious commits** - mitigate with branch protection, required reviews

**Security Scans:**
- SAST (Semgrep, CodeQL)
- Dependency scanning (npm audit, OWASP)
- Secret scanning (Gitleaks)
- Container scanning (Trivy)

## Recommendation

**This PRD should be decomposed into unit PRDs (025a-025h) before implementation** to maintain consistency with PRD-001 through PRD-022 decomposition patterns.

Each unit PRD should include:
- Full implementation code for CI/CD components
- GitHub Actions workflow definitions
- Deployment automation scripts
- <400 lines per unit PRD
