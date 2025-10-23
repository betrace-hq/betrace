# ADR-023: Single-Tenant Deployment Model

## Status
**Accepted** - 2025-01-22

## Context

BeTrace was initially designed as a **multi-tenant SaaS platform** with:
- Per-tenant database isolation
- Per-tenant KMS encryption keys
- Per-tenant rate limiting
- Tenant onboarding/provisioning
- Team member management
- API key management per tenant

This multi-tenant architecture added significant complexity (~2,500 LOC) and operational overhead.

**Market Reality Check**:
- **Grafana**: Single-tenant deployment (one Grafana per customer)
- **Tempo**: Single-tenant deployment (one Tempo per customer)
- **Loki**: Single-tenant deployment (one Loki per customer)
- **Prometheus**: Single-tenant deployment (one Prometheus per customer)

**Key Insight**: Enterprise customers prefer **owning their deployment** for security, compliance, and control.

**Pure Application Framework** (ADR-011): BeTrace exports packages, deployment is consumer responsibility.

## Decision

We adopt a **single-tenant deployment model** where each customer deploys their own BeTrace instance.

### Architecture

**Before (Multi-Tenant)**:
```
                    ┌─────────────────────┐
                    │   BeTrace SaaS         │
                    │   Multi-Tenant      │
┌─────────────┐     │                     │
│ Customer A  ├────►│  Tenant A Database  │
└─────────────┘     │  Tenant A KMS Keys  │
                    │  Tenant A Rules     │
┌─────────────┐     │                     │
│ Customer B  ├────►│  Tenant B Database  │
└─────────────┘     │  Tenant B KMS Keys  │
                    │  Tenant B Rules     │
┌─────────────┐     │                     │
│ Customer C  ├────►│  Tenant C Database  │
└─────────────┘     │  Tenant C KMS Keys  │
                    │  Tenant C Rules     │
                    └─────────────────────┘
```

**After (Single-Tenant)**:
```
┌─────────────┐     ┌─────────────────────┐
│ Customer A  │────►│  BeTrace Instance A    │
└─────────────┘     │  - Own database     │
                    │  - Own KMS keys     │
                    │  - Own rules        │
                    └─────────────────────┘

┌─────────────┐     ┌─────────────────────┐
│ Customer B  │────►│  BeTrace Instance B    │
└─────────────┘     │  - Own database     │
                    │  - Own KMS keys     │
                    │  - Own rules        │
                    └─────────────────────┘

┌─────────────┐     ┌─────────────────────┐
│ Customer C  │────►│  BeTrace Instance C    │
└─────────────┘     │  - Own database     │
                    │  - Own KMS keys     │
                    │  - Own rules        │
                    └─────────────────────┘
```

### What Gets Removed

| Multi-Tenant Component | LOC | Status |
|------------------------|-----|--------|
| **Tenant Isolation** | ~800 | ❌ Remove |
| - Tenant database schema separation | 200 | ❌ Remove |
| - Tenant-scoped queries | 300 | ❌ Remove |
| - X-Tenant-ID header validation | 100 | ❌ Remove |
| - Tenant context propagation | 200 | ❌ Remove |
| **Tenant KMS Keys** | ~600 | ❌ Remove |
| - Per-tenant DEK generation | 150 | ❌ Remove |
| - Tenant key rotation | 200 | ❌ Remove |
| - Tenant key retrieval cache | 150 | ❌ Remove |
| - KMS health checks per tenant | 100 | ❌ Remove |
| **Tenant Management** | ~700 | ❌ Remove |
| - Tenant onboarding API | 150 | ❌ Remove |
| - Tenant settings CRUD | 150 | ❌ Remove |
| - Team member management | 200 | ❌ Remove |
| - API key management | 200 | ❌ Remove |
| **Tenant Rate Limiting** | ~400 | ❌ Remove |
| - Per-tenant token buckets | 150 | ❌ Remove |
| - Tenant usage tracking | 150 | ❌ Remove |
| - Quota enforcement | 100 | ❌ Remove |
| **TOTAL** | **~2,500 LOC** | **❌ Remove** |

### What Remains (Single-Tenant)

| Component | Purpose | LOC | Status |
|-----------|---------|-----|--------|
| **Rule Engine** | Evaluate BeTraceDSL | ~1,500 | ✅ Keep |
| **Violation Emission** | Emit violation spans | ~300 | ✅ Keep |
| **Compliance Pattern** | Emit compliance spans | ~400 | ✅ Keep |
| **Rules API** | CRUD rules | ~500 | ✅ Keep |
| **Violations API** | Query violations | ~300 | ✅ Keep |
| **TOTAL** | | **~3,000 LOC** | **✅ Keep** |

**Impact**: Remove **45% of backend codebase** (~2,500 / 5,500 LOC)

## Rationale

### 1. Security and Compliance

**Multi-Tenant Risks**:
- Tenant isolation bugs can leak data across customers
- Shared KMS master key violates SOC2 CC6.1 best practices
- Tenant X can potentially DoS Tenant Y via resource exhaustion

**Single-Tenant Benefits**:
- **Physical isolation**: Customer A's data never shares infrastructure with Customer B
- **Per-customer KMS keys**: Each customer owns encryption keys in their AWS/GCP account
- **Independent failures**: Customer A's outage doesn't affect Customer B

### 2. Deployment Flexibility

**Customer Requirements Vary**:
- **AWS-only customers**: Deploy BeTrace in AWS, use AWS KMS
- **GCP-only customers**: Deploy BeTrace in GCP, use GCP Cloud KMS
- **On-premise customers**: Deploy BeTrace on-premise, use HashiCorp Vault
- **Airgapped environments**: Deploy BeTrace without internet access

**Multi-Tenant Limitation**: One deployment model for all customers

**Single-Tenant Benefit**: Customer chooses deployment (Kubernetes, Docker, VM, Lambda)

### 3. Operational Simplicity

**Multi-Tenant Complexity**:
- Tenant provisioning workflows
- Tenant resource quotas
- Tenant isolation testing
- Cross-tenant security audits

**Single-Tenant Simplicity**:
- No tenant provisioning (customer deploys)
- No quotas (customer owns resources)
- No isolation testing (physical isolation)
- No cross-tenant risks

### 4. Aligns with Grafana O11y Stack

**Grafana Deployment Pattern**: Single-tenant
- One Grafana instance per customer
- Customer manages users, teams, authentication

**Tempo Deployment Pattern**: Single-tenant
- One Tempo instance per customer
- Customer configures storage backend (S3, GCS)

**BeTrace Alignment**: Single-tenant
- One BeTrace instance per customer
- Integrates with customer's Grafana/Tempo

### 5. Pure Application Framework (ADR-011)

**ADR-011 Principle**: BeTrace exports packages, deployment is consumer responsibility

**Multi-Tenant Contradicts This**:
- Implies BeTrace runs as SaaS (not pure application)
- Requires BeTrace to own infrastructure

**Single-Tenant Aligns**:
- Customer deploys BeTrace packages
- Customer owns infrastructure
- BeTrace is pure application

## Consequences

### Positive

1. **Reduced Complexity**: Remove ~2,500 LOC (45% of backend)
2. **Better Security**: Physical tenant isolation, per-customer KMS keys
3. **Deployment Flexibility**: AWS, GCP, Azure, on-premise, airgapped
4. **Operational Simplicity**: No tenant provisioning, no quotas, no cross-tenant risks
5. **Market Alignment**: Matches Grafana/Tempo/Loki deployment model

### Negative

1. **Per-Customer Deployment**: BeTrace team doesn't control infrastructure
2. **Support Complexity**: Each customer has unique deployment environment
3. **Update Distribution**: Customers manage BeTrace updates (not automatic)

### Mitigation Strategies

1. **Deployment Automation**:
   - Provide Helm charts for Kubernetes
   - Provide Terraform modules for AWS/GCP/Azure
   - Provide Docker Compose for local dev

2. **Documentation**:
   - Deployment guides per environment (AWS, GCP, Azure, on-premise)
   - Troubleshooting runbooks
   - Migration guides for multi-tenant → single-tenant

3. **Testing**:
   - Test BeTrace in multiple deployment environments
   - Provide reference architectures

## Implementation Plan

### Phase 1: Code Removal (Week 1)

**Remove Tenant Management**:
```bash
# Delete tenant-related PRDs
rm docs/prds/012a-tenant-onboarding.md
rm docs/prds/012b-tenant-settings-crud.md
rm docs/prds/012c-team-member-management.md
rm docs/prds/012d-usage-tracking-quotas.md
rm docs/prds/012e-api-key-management.md
rm docs/prds/012f-frontend-tenant-admin-ui.md
```

**Remove Backend Code**:
```bash
# Remove tenant context processors
rm backend/src/main/java/com/fluo/security/TenantSecurityProcessor.java

# Remove tenant KMS code
rm backend/src/main/java/com/fluo/services/TenantKeyService.java

# Remove tenant rate limiting
rm backend/src/main/java/com/fluo/services/TenantRateLimiter.java

# Remove tenant API routes
rm backend/src/main/java/com/fluo/routes/TenantApiRoute.java
```

**Simplify Configuration**:
```diff
# application.properties
- fluo.security.tenant.isolation=true
- fluo.security.tenant.header=X-Tenant-ID
- fluo.kms.per-tenant-keys=true
```

### Phase 2: Simplify Rule Engine (Week 2)

**Before** (Multi-Tenant):
```java
TenantSessionManager sessionManager;
KieSession session = sessionManager.getSessionForEvaluation(tenantId);
```

**After** (Single-Tenant):
```java
KieSession session = kieSessionFactory.newKieSession();
```

**Impact**: Remove `TenantSessionManager` (~300 LOC)

### Phase 3: Update Documentation (Week 3)

**New Deployment Guides**:
- `docs/deployment/kubernetes.md` - Helm chart
- `docs/deployment/docker-compose.md` - Docker Compose
- `docs/deployment/aws.md` - EKS + AWS KMS
- `docs/deployment/gcp.md` - GKE + GCP Cloud KMS

### Phase 4: Testing (Week 4)

**Test Deployment Scenarios**:
- [ ] Kubernetes (Helm chart)
- [ ] Docker Compose (local dev)
- [ ] AWS EKS + AWS KMS
- [ ] GCP GKE + GCP Cloud KMS
- [ ] On-premise (no cloud KMS)

## Alternatives Considered

### 1. Keep Multi-Tenant Architecture
**Rejected**: Adds ~2,500 LOC complexity, doesn't match market deployment model

### 2. Hybrid (Support Both)
**Rejected**: Doubles testing surface, confuses users

### 3. Per-Customer Namespaces in Shared Cluster
**Rejected**: Logical isolation ≠ physical isolation, compliance risks

## Impact on Other ADRs

### ADR-012: Mathematical Tenant Isolation Architecture
**Status**: **SUPERSEDED** by this ADR

**Rationale**: ADR-012 describes cryptographic tenant isolation (per-tenant accounts, disjoint key spaces). This is unnecessary in single-tenant model where customers own their deployment.

### ADR-022: Grafana-First Architecture
**Status**: **REINFORCED** by this ADR

**Rationale**: Single-tenant aligns with Grafana/Tempo deployment model

### Related PRDs (Archived)

**Tenant Management (12 PRDs)**:
- `012a-tenant-onboarding.md` → ❌ Archived
- `012b-tenant-settings-crud.md` → ❌ Archived
- `012c-team-member-management.md` → ❌ Archived
- `012d-usage-tracking-quotas.md` → ❌ Archived
- `012e-api-key-management.md` → ❌ Archived
- `012f-frontend-tenant-admin-ui.md` → ❌ Archived

**Per-Tenant KMS (Partial - simplified)**:
- `006b-key-generation-service.md` → Simplified (one key, not per-tenant)
- `006c-key-retrieval-service.md` → Simplified (one key, not per-tenant)
- `006d-key-cache.md` → Simplified (one key, not per-tenant)
- `006e-key-rotation-scheduler.md` → Simplified (one key, not per-tenant)

## Deployment Model

### Customer Deployment Options

**Option 1: Kubernetes (Recommended)**:
```bash
helm repo add fluo https://charts.betrace.dev
helm install fluo fluo/fluo \
  --set grafana.url=http://grafana:3000 \
  --set tempo.endpoint=http://tempo:4317 \
  --set kms.provider=aws \
  --set kms.masterKeyId=arn:aws:kms:us-east-1:123456789:key/abc
```

**Option 2: Docker Compose (Local Dev)**:
```yaml
services:
  fluo-backend:
    image: fluo/backend:latest
    environment:
      - KMS_PROVIDER=local
      - GRAFANA_URL=http://grafana:3000
    ports:
      - 8080:8080

  grafana:
    image: grafana/grafana:latest
    ports:
      - 3000:3000
```

**Option 3: Serverless (AWS Lambda)**:
```bash
# Deploy BeTrace backend as Lambda function
serverless deploy \
  --stage prod \
  --region us-east-1
```

### User Management

**Before** (Multi-Tenant):
- BeTrace manages users, teams, API keys
- Tenant admin creates users

**After** (Single-Tenant):
- **Grafana manages users** (OAuth, LDAP, SAML)
- BeTrace inherits Grafana authentication
- No user management in BeTrace

## References

- **ADR-011**: Pure Application Framework (BeTrace exports packages)
- **ADR-012**: Mathematical Tenant Isolation Architecture (SUPERSEDED)
- **ADR-022**: Grafana-First Architecture (REINFORCED)
- **Grafana Deployment**: https://grafana.com/docs/grafana/latest/setup-grafana/installation/
- **Tempo Deployment**: https://grafana.com/docs/tempo/latest/setup/deployment/
- **Helm Charts**: https://helm.sh/docs/topics/charts/
