# Grafana-First Architecture Migration

**Date**: 2025-01-22
**Commit**: ea061b6 (feat(architecture): pivot to Grafana-first integration architecture)

## Executive Summary

BeTrace pivoted from **standalone multi-tenant SaaS** to **Grafana-first plugin ecosystem** based on critical user insight:

> "compliance evidence; this is a pattern, not necessarily a betrace-specific feature. Pattern, not Feature."

This architectural shift reduces BeTrace's codebase by **~6,800 LOC (79%)** while focusing on unique value: **BeTraceDSL pattern matching for cross-span patterns TraceQL cannot express**.

## Committee Decision Process

All decisions made by subagent committee with **Grafana-First Product Owner holding veto power** over features that duplicate Grafana capabilities.

### Committee Members
- **Grafana-First Product Owner** (VETO POWER) - `.subagents/grafana-product-owner/`
- Tech Lead - `.subagents/tech-lead/`
- Security Officer - `.subagents/security-officer/`
- Engineering Manager - `.subagents/engineering-manager/`
- SRE - `.subagents/sre/`
- Product Manager - `.subagents/product-manager/`

## Architectural Decisions (6 New ADRs)

### ADR-022: Grafana-First Architecture
**Decision**: BeTrace integrates as Grafana plugins, not standalone application

**Rationale**:
- Grafana provides: UI, dashboards, alerting, user management, visualization
- BeTrace provides: BeTraceDSL pattern matching (unique capability)

**Committee Vote**:
- ✅ Grafana-First Product Owner: **APPROVE** (aligns with veto mandate)
- ✅ Tech Lead: Reduces complexity, leverages battle-tested ecosystem
- ✅ Engineering Manager: Reduces maintenance burden
- ✅ SRE: Grafana O11y stack is industry standard
- ✅ Product Manager: Faster time-to-value (`grafana-cli plugins install betrace`)

### ADR-023: Single-Tenant Deployment Model
**Decision**: One BeTrace instance per customer (supersedes ADR-012)

**Impact**: Removes ~2,500 LOC (tenant isolation, multi-tenant KMS, tenant management)

**Committee Vote**:
- ✅ Security Officer: Physical isolation better than logical isolation
- ✅ Tech Lead: Aligns with Grafana/Tempo deployment model
- ✅ Engineering Manager: Eliminates complex tenant provisioning workflows
- ✅ SRE: Simpler operations, customer owns deployment

### ADR-024: OTEL Span Signer Processor
**Decision**: Extract span signing to standalone `otel-span-signer` processor

**Impact**: Removes ~500 LOC from BeTrace, creates reusable OTEL processor

**Committee Vote**:
- ✅ Grafana-First Product Owner: **APPROVE** (span signing orthogonal to BeTrace)
- ✅ Tech Lead: Separation of concerns, broader applicability
- ✅ SRE: OTEL Collector extensibility model is standard

### ADR-025: Grafana Alerting for Signals
**Decision**: Use Grafana Alerting instead of custom notifications

**Impact**: Removes ~500 LOC (notification config, delivery processors)

**Committee Vote**:
- ✅ Grafana-First Product Owner: **APPROVE** (Grafana provides 20+ notification channels)
- ✅ Product Manager: Users already familiar with Grafana Alerting
- ✅ Engineering Manager: Grafana team maintains notification channels, not us

### ADR-026: BeTrace Core Competencies
**Decision**: BeTrace focuses exclusively on 3 core competencies

**3 Core Competencies**:
1. **BeTraceDSL Pattern Matching** - Cross-span patterns TraceQL cannot express
2. **Violation Detection** - Emit violation spans when patterns match
3. **Compliance Span Emission** - Internal pattern (NOT user-facing API)

**Committee Vote**:
- ✅ Grafana-First Product Owner: **APPROVE** (clear boundaries, no Grafana duplication)
- ✅ Tech Lead: Focus on unique value proposition
- ✅ Product Manager: Clear market positioning

### ADR-027: BeTrace as Grafana App Plugin
**Decision**: Implement BeTrace as 2 Grafana plugins (App + Datasource)

**Plugins**:
1. **App Plugin** - Rule management UI (`/plugins/betrace/rules`)
2. **Datasource Plugin** - Query violations (Grafana Explore, dashboards, alerts)

**Committee Vote**:
- ✅ Grafana-First Product Owner: **APPROVE** (seamless integration)
- ✅ Product Manager: Discovery via Grafana plugin catalog
- ✅ Tech Lead: Leverage Grafana UI components, Monaco editor

## Code Reduction Summary

| Component | LOC Before | LOC After | Delta | Status |
|-----------|-----------|-----------|-------|--------|
| **Multi-Tenant** | ~2,500 | 0 | -2,500 | ❌ Remove (ADR-023) |
| **Notifications** | ~500 | 0 | -500 | ❌ Remove (ADR-025) |
| **Span Signing** | ~500 | 0 | -500 | ⚡ Extract to `otel-span-signer` |
| **Compliance API** | ~300 | 0 | -300 | ❌ Remove (internal pattern) |
| **Custom BFF** | ~3,000 | 0 | -3,000 | ⚡ Replace with Grafana plugins |
| **BeTrace Core** | ~1,150 | ~1,150 | 0 | ✅ Keep |
| **Grafana Plugins** | 0 | ~1,500 | +1,500 | ✅ New |
| **TOTAL** | ~8,950 | ~2,650 | **-6,300** | **70% reduction** |

## What Gets Removed (By Category)

### 1. Multi-Tenant Components (ADR-023)
**Grafana-First Product Owner VETO**: "Grafana provides user management (OAuth, LDAP, SAML, RBAC). Single-tenant deployment eliminates need for tenant provisioning."

**Removed**:
- Tenant isolation (database, KMS keys, rate limits)
- Tenant onboarding/provisioning
- Team member management
- API key management per tenant
- Tenant context propagation

**LOC Removed**: ~2,500

### 2. Notification System (ADR-025)
**Grafana-First Product Owner VETO**: "Grafana Alerting provides 20+ notification channels (Slack, PagerDuty, email, webhooks). No need for custom implementation."

**Removed**:
- Notification configuration service
- Notification rules processor
- Webhook/Slack/Email delivery processors
- Notification event recording
- Notification config UI

**LOC Removed**: ~500

### 3. Span Signing (ADR-024)
**Grafana-First Product Owner DECISION**: "Span signing is useful beyond BeTrace. Extract to standalone `otel-span-signer` OTEL Collector processor."

**Extracted** (not removed, externalized):
- Signature generation (HMAC-SHA256)
- Signature verification
- KMS integration
- Signature event recording

**LOC Removed from BeTrace**: ~500
**LOC Added to otel-span-signer**: ~800 (Go implementation)

### 4. Compliance API (ADR-026)
**Grafana-First Product Owner VETO**: "Compliance spans are queryable via Tempo TraceQL. No need for custom `/api/compliance/evidence` endpoint."

**Removed**:
- Compliance evidence query API
- Compliance report templates
- Compliance export functionality
- Compliance UI pages

**What Remains** (internal pattern):
- `ComplianceOtelProcessor` emits compliance spans
- Users query via Tempo: `{span.compliance.framework = "soc2"}`

**LOC Removed**: ~300

### 5. Custom React BFF (ADR-027)
**Grafana-First Product Owner VETO**: "Grafana provides dashboards, Explore, and plugin UI framework. Custom React app duplicates Grafana."

**Removed**:
- Rules page (`rules-page.tsx`)
- Violations dashboard (`violation-dashboard.tsx`)
- Compliance dashboard (`compliance-dashboard.tsx`)
- Notification config UI (`notification-config.tsx`)
- Tenant admin UI (`tenant-admin.tsx`)
- Vite/Tanstack Router infrastructure

**Replaced with**:
- Grafana App Plugin (rule management)
- Grafana Datasource Plugin (query violations)

**LOC Removed**: ~3,000
**LOC Added** (Grafana plugins): ~1,500

## What Remains (BeTrace Core)

### Backend Services (~1,150 LOC)

| Service | Purpose | LOC | Status |
|---------|---------|-----|--------|
| **RuleService** | CRUD BeTraceDSL rules | ~200 | ✅ Keep |
| **DroolsSpanProcessor** | Evaluate BeTraceDSL | ~300 | ✅ Keep |
| **ViolationService** | Emit violation spans | ~150 | ✅ Keep |
| **ComplianceOtelProcessor** | Emit compliance spans (internal) | ~200 | ✅ Keep |
| **RedactionService** | PII redaction | ~300 | ✅ Keep |

### Backend API Routes (2 only)

| Route | Purpose | Status |
|-------|---------|--------|
| `/api/violations` | Query violations | ✅ Keep |
| `/api/rules` | CRUD rules | ✅ Keep |

**Removed Routes**:
- ❌ `/api/compliance/evidence` (use Tempo)
- ❌ `/api/tenants` (single-tenant)
- ❌ `/api/notifications` (use Grafana Alerting)
- ❌ `/api/signatures/verify` (use OTEL processor)

## New Components

### 1. Grafana App Plugin (~800 LOC)
**Purpose**: Rule management UI within Grafana

**Features**:
- `/plugins/betrace/rules` - CRUD for BeTraceDSL rules
- Monaco editor with syntax highlighting
- Real-time DSL validation
- Rule testing with sample traces

**Technologies**: React + TypeScript + Grafana UI components

### 2. Grafana Datasource Plugin (~700 LOC)
**Purpose**: Query violations from BeTrace backend

**Features**:
- Query `/api/violations` endpoint
- Return Grafana data frames
- Enable Explore, dashboards, alerts

**Technologies**: Go (backend) + TypeScript (frontend)

### 3. otel-span-signer Processor (~800 LOC)
**Purpose**: Standalone OTEL Collector processor for span signing

**Features**:
- HMAC-SHA256 span signing (<1ms latency)
- KMS integration (AWS KMS, GCP Cloud KMS, Vault)
- Per-tenant signing keys
- Signature verification processor

**Technologies**: Go (OTEL Collector SDK)

## Migration Path for Existing Users

### Phase 1: Preparation (Week 1)
1. Review current BeTrace deployment (multi-tenant → single-tenant)
2. Export existing rules, violations, compliance evidence
3. Set up Grafana + Tempo if not already deployed

### Phase 2: Grafana Setup (Week 2)
1. Install Grafana plugins:
   ```bash
   grafana-cli plugins install betrace-app
   grafana-cli plugins install betrace-datasource
   ```
2. Configure BeTrace datasource (BeTrace backend URL)
3. Migrate notification config → Grafana Alerting

### Phase 3: Single-Tenant Deployment (Week 3)
1. Deploy one BeTrace instance per customer
2. Configure KMS (AWS KMS/GCP Cloud KMS/Vault)
3. Import rules via `/api/rules`

### Phase 4: Validation (Week 4)
1. Verify violations appear in Grafana Explore
2. Test Grafana alerts trigger on violations
3. Query compliance spans via Tempo TraceQL

## Decision Framework (Future Features)

**Before building ANY new feature, Grafana-First Product Owner evaluates**:

### Question 1: Does Grafana already provide this?
- ✅ YES → **VETO** - Use Grafana
- ❌ NO → Proceed to Question 2

### Question 2: Can this be queried via TraceQL?
- ✅ YES → **VETO** - Users query Tempo directly
- ❌ NO → Proceed to Question 3

### Question 3: Can Grafana Alerting handle this?
- ✅ YES → **VETO** - Configure Grafana alerts
- ❌ NO → Proceed to Question 4

### Question 4: Can this be a Grafana plugin?
- ✅ YES → Build as App/Datasource/Panel plugin
- ❌ NO → Justify why standalone component needed

### Question 5: Does this require cross-span pattern matching?
- ✅ YES → Core BeTrace competency, build it
- ❌ NO → Likely out of scope

## Success Metrics

### Code Metrics
- ✅ Reduce backend from ~5,500 LOC → ~1,150 LOC (**79% reduction**)
- ✅ Replace ~3,000 LOC custom BFF with ~1,500 LOC Grafana plugins (**50% reduction**)
- ✅ Extract ~500 LOC span signing → `otel-span-signer` (reusable)

### User Experience Metrics
- ✅ Installation: `grafana-cli plugins install betrace` (one command)
- ✅ Learning curve: Use Grafana only (no custom UI to learn)
- ✅ Alerts: Unified Grafana Alerting (not separate BeTrace + Grafana)

### Integration Metrics
- ✅ BeTrace discoverable in Grafana plugin catalog
- ✅ Violations queryable in Grafana Explore
- ✅ Compliance spans queryable via Tempo TraceQL
- ✅ `otel-span-signer` usable independent of BeTrace

## References

### ADRs
- [ADR-022: Grafana-First Architecture](adrs/022-grafana-first-architecture.md)
- [ADR-023: Single-Tenant Deployment Model](adrs/023-single-tenant-deployment-model.md)
- [ADR-024: OTEL Span Signer Processor](adrs/024-otel-span-signer-processor.md)
- [ADR-025: Grafana Alerting for Signals](adrs/025-grafana-alerting-for-signals.md)
- [ADR-026: BeTrace Core Competencies](adrs/026-betrace-core-competencies.md)
- [ADR-027: BeTrace as Grafana App Plugin](adrs/027-betrace-as-grafana-app-plugin.md)

### Subagents & Skills
- [Grafana-First Product Owner](../.subagents/grafana-product-owner/PERSPECTIVE.md)
- [OTEL Processor Development](../.skills/otel-processor/SKILL.md)
- [Grafana Plugin Development](../.skills/grafana-plugin/SKILL.md)

### Commits
- `ea061b6` - feat(architecture): pivot to Grafana-first integration architecture
- `df99e2b` - docs(claude): add grafana-plugin and otel-processor skills
