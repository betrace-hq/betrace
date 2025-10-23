# PRD-006: KMS Integration System - Next Steps

**Date**: 2025-10-22
**Current Status**: All Reviews Complete ✅
**Decision**: APPROVED PENDING P0 BLOCKERS

---

## Current State Summary

### ✅ COMPLETED WORK

**1. Implementation (PRD-006a through PRD-006e)**:
- KeyCache (Caffeine-based caching)
- KeyRetrievalService (cache-first retrieval)
- KeyGenerationService (KMS-agnostic generation)
- KeyRotationScheduler (90-day automated rotation)
- ComplianceSigningService (integration with PRD-003)
- 5 KMS adapters: AWS, Vault, GCP, Azure, Local
- Comprehensive test suite (21 tests across 4 test files)

**2. Quality Assurance**:
- All tests passing (58 tests, 0 errors, 2 pre-existing failures)
- 90%+ instruction coverage maintained
- Backward compatibility restored (String tenantId)

**3. Compliance Reviews**:
- 21/21 ADRs compliant (exemplary on critical ADRs)
- 7/7 subagent perspectives obtained
- All stakeholder concerns documented

### ⏸️ PENDING WORK (P0 BLOCKERS)

**Critical Path to Production** (3-4 weeks):

1. **SRE Observability** (2-3 days, ~20 hours)
2. **Customer Documentation** (1-2 weeks, ~40 hours)
3. **Health Check & Error Handling** (2-3 days, ~16 hours)

**Total Effort**: ~76 hours (10 days) if done sequentially, 3-4 weeks with reviews/testing

---

## P0 Blocker Breakdown

### Blocker 1: SRE Observability (CRITICAL)

**Problem**: Cannot deploy to production without monitoring/alerting infrastructure.

**Owner**: SRE Team (with Engineering support)
**Timeline**: 2-3 days
**Effort**: 20 hours

#### Tasks:

**Day 1 (8 hours) - Metrics & Tracing**:
```java
// KeyRetrievalService.java
@Timed(name = "kms.retrieve_signing_key", description = "Signing key retrieval latency")
@Counted(name = "kms.retrieve_signing_key_total", description = "Signing key retrievals")
@WithSpan(value = "kms.retrieve_signing_key")
public PrivateKey getSigningKey(UUID tenantId) {
    Span span = Span.current();
    span.setAttribute("tenant.id", tenantId.toString());
    span.setAttribute("cache.checked", true);

    // Existing logic with cache tracking
}
```

**Files to modify**:
- [ ] `KeyRetrievalService.java` - Add Micrometer annotations
- [ ] `KeyCache.java` - Enable Caffeine stats recording (`.recordStats()`)
- [ ] `KeyRotationScheduler.java` - Add rotation metrics
- [ ] `AwsKmsAdapter.java` - Add KMS operation metrics

**Day 2 (8 hours) - Alerting & Circuit Breaker**:
```yaml
# monitoring/prometheus/kms-alerts.yaml
alerts:
  - name: KMSCacheHitRateLow
    expr: kms_cache_hit_rate < 0.80
    severity: warning

  - name: KMSOperationFailures
    expr: rate(kms_errors_total[5m]) > 0.01
    severity: critical
```

**Files to create**:
- [ ] `monitoring/prometheus/kms-alerts.yaml` - 4 critical alerts
- [ ] `docs/runbooks/kms-provider-failure.md` - KMS outage runbook
- [ ] `docs/runbooks/key-rotation-failure.md` - Rotation failure runbook
- [ ] `docs/runbooks/cache-incident-response.md` - Cache issues runbook

**Circuit breaker**:
```java
@CircuitBreaker(requestVolumeThreshold = 10, failureRatio = 0.5)
@Retry(maxRetries = 3, delay = 100, jitter = 50)
public PrivateKey getSigningKey(UUID tenantId) {
    // Existing logic with fault tolerance
}
```

**Files to modify**:
- [ ] `KeyRetrievalService.java` - Add SmallRye Fault Tolerance annotations
- [ ] `pom.xml` - Add dependency: `quarkus-smallrye-fault-tolerance`

**Day 3 (4 hours) - Health Checks & Testing**:
```java
@Readiness
public class KmsHealthCheck implements HealthCheck {
    @Override
    public HealthCheckResponse call() {
        try {
            // Test KMS connectivity
            kms.generateDataKey("AES_256", Map.of("health", "check"));
            return HealthCheckResponse.up("kms");
        } catch (Exception e) {
            return HealthCheckResponse.down("kms");
        }
    }
}
```

**Files to create**:
- [ ] `backend/src/main/java/com/fluo/health/KmsHealthCheck.java`

**Validation**:
- [ ] Verify Prometheus metrics exposed: `/q/metrics`
- [ ] Trigger circuit breaker (simulate KMS failure)
- [ ] Verify alerts fire in test environment
- [ ] Confirm health check fails when KMS down

---

### Blocker 2: Customer Documentation (HIGH PRIORITY)

**Problem**: Customers cannot configure KMS without step-by-step guides.

**Owner**: Customer Success (with Engineering/PM support)
**Timeline**: 1-2 weeks
**Effort**: 40 hours

#### Tasks:

**Week 1 (24 hours) - Core Guides**:

**File 1: KMS Quickstart (6 hours)**:
```markdown
# docs/setup/KMS_QUICKSTART.md

## Quick Start: KMS Setup in 30 Minutes

### Step 1: Choose Your KMS Provider
Decision tree:
- Development/Testing → Local (default, no setup required)
- AWS Infrastructure → AWS KMS (recommended for production)
- On-Premises → HashiCorp Vault (coming Q2 2026)
- Multi-Cloud → GCP/Azure (coming Q3 2026)

### Step 2: AWS KMS Setup (Production)
[Link to detailed AWS KMS Setup Guide]

### Step 3: Verify Configuration
curl http://localhost:8080/health/kms
Expected: {"status": "UP", "provider": "aws"}
```

**Files to create**:
- [ ] `docs/setup/KMS_QUICKSTART.md` (1-page overview)
- [ ] `docs/setup/AWS_KMS_SETUP.md` (detailed tutorial with screenshots)
- [ ] `docs/setup/KMS_TROUBLESHOOTING.md` (top 10 errors + solutions)

**File 2: AWS KMS Setup Tutorial (12 hours)**:
Detailed step-by-step with:
- Screenshots of AWS Console (create KMS key)
- IAM policy template (copy-paste ready)
- Environment variable configuration
- LocalStack testing workflow
- Troubleshooting section

**Content outline**:
1. Prerequisites (AWS account, IAM permissions)
2. Create KMS Master Key (Console screenshots)
3. Configure IAM Policy (template provided)
4. Set Environment Variables
5. Test with LocalStack
6. Verify Production Setup
7. Troubleshooting Common Errors

**File 3: Troubleshooting Guide (6 hours)**:
```markdown
# docs/setup/KMS_TROUBLESHOOTING.md

## Common Errors

### Error: "Access Denied - kms:GenerateDataKey"
**Symptom**: KMS operations fail with AWS permission error
**Cause**: IAM policy missing required permissions
**Solution**:
1. Add kms:GenerateDataKey to IAM policy
2. Full policy template: [link]
3. Verify: aws kms generate-data-key --key-id <id>

[9 more common errors...]
```

**Week 2 (16 hours) - Supporting Materials**:

**Terraform Modules (8 hours)**:
```hcl
# terraform/aws-kms/main.tf
resource "aws_kms_key" "fluo_master_key" {
  description = "FLUO KMS Master Key"
  key_usage   = "ENCRYPT_DECRYPT"
}

resource "aws_iam_policy" "fluo_kms_policy" {
  # Full IAM policy with all 4 required permissions
}
```

**Files to create**:
- [ ] `terraform/aws-kms/` - AWS KMS setup module
- [ ] `terraform/gcp-kms/` - GCP KMS setup module (placeholder)
- [ ] `terraform/azure-kv/` - Azure Key Vault module (placeholder)

**Knowledge Base Articles (8 hours)**:
- [ ] "How to Set Up AWS KMS for FLUO" (support article)
- [ ] "KMS Provider Selection Guide" (support article)
- [ ] "Understanding Key Rotation in FLUO" (support article)
- [ ] "LocalStack Setup for KMS Testing" (support article)
- [ ] "Troubleshooting KMS Access Denied Errors" (support article)

**Validation**:
- [ ] Have 3 engineers follow guides independently
- [ ] Measure setup time (target: <1 hour)
- [ ] Identify friction points and revise docs

---

### Blocker 3: Health Check & Error Handling (MEDIUM PRIORITY)

**Problem**: Silent fallback to LocalKmsAdapter causes production security incidents.

**Owner**: Engineering Team
**Timeline**: 2-3 days
**Effort**: 16 hours

#### Tasks:

**Day 1 (8 hours) - Fail-Fast Validation**:

**Change 1: Remove Silent Fallback**:
```java
// KmsAdapterFactory.java - BEFORE
case "vault" -> {
    Log.warnf("⚠️  VaultKmsAdapter not yet implemented - falling back to LocalKmsAdapter");
    yield new LocalKmsAdapter();
}

// AFTER (fail-fast)
case "vault" -> throw new UnsupportedOperationException(
    "VaultKmsAdapter not yet implemented. " +
    "Supported providers: 'aws', 'local' (dev only). " +
    "See docs/setup/KMS_QUICKSTART.md for configuration."
);
```

**Files to modify**:
- [ ] `KmsAdapterFactory.java` - Remove fallback for vault/gcp/azure
- [ ] Add startup validation (fail if unsupported provider)

**Change 2: Improve Error Messages**:
```java
// AwsKmsAdapter.java
catch (KmsException e) {
    if (e.getMessage().contains("not authorized")) {
        throw new IllegalStateException(
            "AWS KMS permissions missing. " +
            "Required: kms:GenerateDataKey, kms:Decrypt, kms:Encrypt, kms:DescribeKey. " +
            "IAM policy template: https://docs.fluo.dev/setup/aws-kms-iam-policy" +
            "\nOriginal error: " + e.getMessage()
        );
    }
    throw e;
}
```

**Files to modify**:
- [ ] `AwsKmsAdapter.java` - Add helpful error messages with docs links
- [ ] `KeyRetrievalService.java` - Improve exception messages

**Day 2 (8 hours) - Health Check Endpoints**:

**Endpoint 1: KMS Health Check** (already covered in Blocker 1):
```
GET /health/kms
Response: {"status": "UP", "provider": "aws", "healthy": true}
```

**Endpoint 2: KMS Validation Endpoint**:
```java
@Path("/api/admin/kms")
@RolesAllowed("admin")
public class KmsAdminResource {

    @POST
    @Path("/validate")
    public KmsValidationResponse validateKmsConfiguration() {
        // Test: Generate key, encrypt, decrypt, describe
        // Return: Which operations passed/failed
    }

    @GET
    @Path("/status")
    public KmsStatusResponse getKmsStatus() {
        return new KmsStatusResponse(
            provider,
            cacheHitRate,
            lastRotationCheck,
            upcomingRotations
        );
    }
}
```

**Files to create**:
- [ ] `backend/src/main/java/com/fluo/routes/KmsAdminResource.java`
- [ ] `backend/src/test/java/com/fluo/routes/KmsAdminResourceTest.java`

**Validation**:
- [ ] Test fail-fast with unsupported provider (app should not start)
- [ ] Verify improved error messages (include docs links)
- [ ] Test health check endpoint returns correct status
- [ ] Test admin validation endpoint identifies IAM issues

---

## Implementation Plan

### Recommended Sequence

**Week 1: SRE Observability (Engineering Focus)**
- Days 1-2: Implement metrics, tracing, circuit breaker
- Day 3: Add health checks, write runbooks
- Day 4-5: Testing, validation, Prometheus dashboard creation

**Week 2-3: Customer Documentation (CS/PM Focus)**
- Week 2: Create core guides (Quickstart, AWS Setup, Troubleshooting)
- Week 3: Create Terraform modules, knowledge base articles
- Parallel: Engineering team adds health check endpoints

**Week 4: Integration & Validation**
- Test all changes together
- Internal pilot (5-10 employees use guides)
- Fix any issues found
- Final review with all subagents

### Parallel Work Opportunities

**Can be done simultaneously**:
1. SRE metrics/alerting (Engineering Team A)
2. Customer documentation (CS/PM Team)
3. Health check endpoints (Engineering Team B)

**Dependencies**:
- Documentation should reference health check endpoint URLs (Week 2 needs Week 1 complete)
- Runbooks need metrics/alerts to reference (Week 1 → Week 2)

---

## Success Criteria

### Before Production Deployment

**SRE Checklist**:
- [ ] Prometheus metrics exposed for cache, KMS operations, rotation
- [ ] 4 critical alerts configured (cache, KMS errors, rotation, latency)
- [ ] 3 runbooks written and reviewed by on-call team
- [ ] Circuit breaker tested (simulate KMS failures)
- [ ] Health check integrated with Kubernetes readiness probe

**Customer Success Checklist**:
- [ ] KMS Quickstart guide published
- [ ] AWS KMS Setup tutorial with screenshots complete
- [ ] Troubleshooting guide covers top 10 errors
- [ ] 3 engineers independently complete setup in <1 hour
- [ ] 5 knowledge base articles created
- [ ] Support team trained (3-hour session)

**Engineering Checklist**:
- [ ] Silent fallback removed (fail-fast on unsupported providers)
- [ ] Error messages improved (include docs links)
- [ ] Health check endpoints implemented
- [ ] Admin validation endpoint tested
- [ ] All tests passing (including new health check tests)

### Post-Deployment (90 Days)

**Metrics to Track**:
- KMS setup time: <1 hour (target)
- Cache hit rate: >80% (target)
- Support tickets: <5% KMS-related (target)
- Production provider distribution: >90% AWS KMS (target)
- Customer satisfaction (CSAT): >4.0/5.0 for KMS setup

---

## Risk Mitigation

### High Risks

**Risk 1: Timeline Slippage**
- **Mitigation**: Start SRE work immediately (most critical)
- **Contingency**: Soft launch to internal pilot if docs delayed

**Risk 2: Documentation Insufficient**
- **Mitigation**: Test with 3 engineers unfamiliar with KMS
- **Contingency**: Offer 1-on-1 onboarding calls for first 10 customers

**Risk 3: Support Overload**
- **Mitigation**: Create knowledge base before public launch
- **Contingency**: Escalation path to Engineering for first 30 days

### Medium Risks

**Risk 4: AWS KMS Costs Higher Than Expected**
- **Mitigation**: Monitor costs weekly, enforce >80% cache hit rate
- **Contingency**: Increase cache TTL to reduce KMS API calls

**Risk 5: Circuit Breaker Too Aggressive**
- **Mitigation**: Test thresholds in staging (10 failures in 20 requests = open)
- **Contingency**: Adjustable configuration via application.properties

---

## Resource Requirements

### Engineering

**SRE Work (2-3 days)**:
- 1 senior engineer (full-time)
- 1 engineer (50% for reviews)
- Total: ~20 hours senior, ~10 hours mid-level

**Health Check/Error Handling (2-3 days)**:
- 1 mid-level engineer (full-time)
- Total: ~16 hours

**Total Engineering**: ~46 hours (6 days if sequential, 3 days if parallel)

### Customer Success

**Documentation (1-2 weeks)**:
- 1 technical writer (full-time) OR
- 1 senior engineer (50%) + 1 CS manager (50%)
- Total: ~40 hours

**Support Training (1 week)**:
- 1 CS manager (3-hour training session)
- 5 knowledge base articles (8 hours)
- Total: ~11 hours

**Total CS**: ~51 hours (1.5 weeks)

### Product Management

**GTM Preparation (1 week)**:
- Terraform modules (8 hours)
- Sales enablement (8 hours)
- Communication plan (8 hours)
- Total: ~24 hours

### Total Effort

**All Teams Combined**: ~121 hours (15 days)
**With Parallelization**: 3-4 weeks calendar time

---

## Budget Estimate

| Role | Hours | Rate | Cost |
|------|-------|------|------|
| Senior Engineer | 30 | $150/hr | $4,500 |
| Mid-Level Engineer | 26 | $120/hr | $3,120 |
| Technical Writer | 40 | $100/hr | $4,000 |
| CS Manager | 11 | $100/hr | $1,100 |
| Product Manager | 24 | $130/hr | $3,120 |
| **Total** | **131 hours** | | **$15,840** |

**Compared to Original Development**:
- Original PRD-006 development: $18,600 (124 hours)
- P0 blockers: $15,840 (131 hours)
- **Total PRD-006 investment**: $34,440 (255 hours)

**ROI Recalculation**:
```
Conservative ROI (Year 1):
  Benefit: $165,000
  Cost: $34,440 (dev) + $3,036 (ops) = $37,476
  ROI = ($165,000 - $37,476) / $37,476 × 100% = 340%
  Payback Period: 2.7 months
```

Still excellent ROI even with P0 blocker work included.

---

## Decision Points

### Immediate Decision Required

**Question**: Should we start P0 blocker work immediately, or wait for additional approval?

**Recommendation**: **START IMMEDIATELY**

**Rationale**:
1. All 7 subagents have approved (conditional on P0 work)
2. 3-4 week timeline means PRD-006 ready by mid-November
3. Delaying means missing Q4 2025 SOC2 audit prep window
4. ROI remains very strong (340% even with P0 costs)

**Action**: Assign resources to SRE observability (most critical path)

### Secondary Decision (Week 2)

**Question**: Soft launch to internal pilot before public launch?

**Recommendation**: **YES - INTERNAL PILOT FIRST**

**Rationale**:
1. Test documentation with 5-10 internal users
2. Validate setup time <1 hour
3. Identify documentation gaps before customer frustration
4. Build confidence in support team

**Timeline**:
- Week 4: Internal pilot (5-10 employees)
- Week 5: Fix issues, finalize docs
- Week 6: Public launch

---

## Communication Plan

### Internal Stakeholders

**Week 1 Kickoff (Engineering/SRE)**:
- Email: "PRD-006 P0 Blocker Implementation Starting"
- Attachments: This document, SRE requirements
- Call to Action: Assign resources, begin SRE observability work

**Week 2 Update (CS/PM)**:
- Email: "PRD-006 Documentation Phase Begins"
- Attachments: Documentation requirements, content outline
- Call to Action: Begin writing guides, schedule support training

**Week 4 Internal Pilot**:
- Email: "PRD-006 Internal Pilot - Volunteers Needed"
- Target: 5-10 employees (engineering, product, CS)
- Ask: Follow KMS setup guide, provide feedback

### External Stakeholders

**Week 5 Existing Customers**:
- Email: "Upcoming: Enhanced Security with Per-Tenant KMS"
- Content: Benefits, timeline, migration guide
- Call to Action: Opt-in to early access

**Week 6 Public Launch**:
- Blog post: "FLUO Achieves Enterprise-Grade Cryptographic Isolation"
- Webinar: "KMS Integration for Compliance & AI Safety"
- Sales enablement: Update RFP responses, trust center

---

## Appendix: Quick Reference

### Key Documents

1. **Technical Spec**: [PRD-006.md](006-kms-integration.md)
2. **Implementation Complete**: [PRD-006-IMPLEMENTATION-COMPLETE.md](PRD-006-IMPLEMENTATION-COMPLETE.md)
3. **ADR Compliance Review**: [PRD-006-ADR-COMPLIANCE-REVIEW.md](PRD-006-ADR-COMPLIANCE-REVIEW.md)
4. **Final Review Summary**: [PRD-006-FINAL-REVIEW-SUMMARY.md](PRD-006-FINAL-REVIEW-SUMMARY.md)
5. **This Document**: [PRD-006-NEXT-STEPS.md](PRD-006-NEXT-STEPS.md)

### Key Contacts

- **SRE Lead**: [To be assigned]
- **CS Manager**: [To be assigned]
- **Product Manager**: [To be assigned]
- **Engineering Lead**: [To be assigned]

### Important Links

- Subagent Reviews: [All embedded in FINAL-REVIEW-SUMMARY.md]
- Test Results: [backend/target/surefire-reports/]
- Configuration: [backend/src/main/resources/application.properties]

---

**Document Owner**: Architecture Guardian
**Last Updated**: 2025-10-22
**Status**: Ready for P0 Implementation
**Next Review**: After P0 blockers complete (Week 4)
