# BeTrace Production Readiness - PRD Roadmap

This document outlines all PRDs needed to make BeTrace production-ready, ordered by dependency and priority.

## PRD Index

### Foundation (P0 - Must Have Before Production)
001. **Authentication & Authorization System** - WorkOS integration, JWT validation, RBAC
002. **Persistence Layer** - PostgreSQL for signals, rules, tenants (currently all in-memory)
003. **Compliance Span Cryptographic Signing** - Tamper-evident compliance evidence
004. **PII Redaction Enforcement** - Enforce @Redact before OpenTelemetry export
005. **Rule Engine Sandboxing** - Capability-based security for Drools globals
006. **KMS Integration** - Per-tenant encryption keys via AWS KMS/HashiCorp Vault
007. **API Input Validation & Rate Limiting** - Prevent injection attacks, DoS protection

### Core Features (P0 - Essential for MVP)
008. **Signal Management System** - CRUD APIs + persistence for signals
009. **Trace Ingestion Pipeline** - Receive OTel spans, correlate into traces, evaluate rules
010. **Rule Management UI** - Create, test, edit, delete BeTrace DSL rules
011. **Signal Investigation Workflow** - View signals, drill into traces, mark as resolved/false positive
012. **Tenant Management System** - Multi-tenant onboarding, configuration, isolation

### User Workflows (P1 - Needed for Production Use)
013. **SRE Dashboard** - Real-time signal feed, incident correlation, rule creation from traces
014. **Developer Rule Testing** - Test rules against sample traces before deploying
015. **Compliance Evidence Dashboard** - Query compliance spans, filter by framework/control
016. **Audit Report Generation** - Export compliance evidence for auditors (PDF/CSV)
017. **Alert & Notification System** - Webhook/Slack/Email when rules fire

### Quality & Operations (P1 - Production Hygiene)
018. **Comprehensive Test Suite** - E2E tests for all workflows, >80% coverage
019. **Observability for BeTrace** - BeTrace's own metrics, traces, logs instrumented
020. **Performance Optimization** - Handle 100K+ spans/sec, long-lived traces
021. **Graceful Degradation** - Circuit breakers, backpressure, health checks
022. **Backup & Recovery** - Database backups, disaster recovery procedures

### Polish & Scale (P2 - Nice to Have)
023. **Rule Analytics** - Track rule performance, false positive rates, refinement suggestions
024. **Grafana Integration** - Click from BeTrace signal → Grafana trace viewer
025. **CI/CD Integration** - GitHub Actions for rule validation, deployment
026. **Rule Versioning & Rollback** - Track rule changes, rollback on issues
027. **Advanced Query Language** - Filter signals by complex criteria

## Implementation Order

Follow the numeric order - each PRD can only start after its dependencies are complete.

**Wave 1 (Weeks 1-4): Foundation**
- PRDs 001-007 establish security, auth, persistence

**Wave 2 (Weeks 5-8): Core Features**
- PRDs 008-012 build essential BeTrace functionality

**Wave 3 (Weeks 9-12): User Workflows**
- PRDs 013-017 complete persona-specific workflows

**Wave 4 (Weeks 13-16): Production Readiness**
- PRDs 018-022 ensure quality, ops, performance

**Wave 5 (Post-MVP): Enhancements**
- PRDs 023-027 add analytics, integrations, polish

## Critical Path

The absolute minimum for a usable MVP:
- 001-007 (Security & Foundation)
- 008-011 (Core features)
- 013 (SRE Dashboard)
- 018 (Testing)

All other PRDs can be prioritized based on user feedback after MVP launch.
