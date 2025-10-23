# PRD-026A: Rule Versioning and History Management

**Priority:** P1 (High - Compliance Requirement)
**Complexity:** Medium
**Personas:** Developer, Compliance Officer
**Dependencies:** None
**Implements:** Immutable audit trail for rule changes (SOC2 CC8.1)

## Problem

BeTrace rules can be updated but lack version history:
- **No audit trail**: SOC2 CC8.1 requires documented change history for controls
- **No signal correlation**: Cannot determine which rule version generated historical signals
- **No change visibility**: Operators cannot see what changed between edits
- **Manual recovery**: If rule update breaks, must manually reconstruct previous version

**Impact:**
- Compliance risk: Missing SOC2 CC8.1 evidence fails audits
- Incident diagnosis: Cannot correlate signals to rule versions
- Operational blindness: No visibility into rule evolution

## Solution

### Deployment-Based Versioning

**Version Creation Triggers:**
- Version created ONLY when rule is deployed
- Draft edits stored as mutable working copy (not versioned)
- Deployment to any environment creates immutable version

**Version Metadata:**
```java
@Entity
@Table(name = "rule_versions")
public class RuleVersion {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID ruleId;

    @Column(nullable = false)
    private String version;  // "v1.2.3"

    @Column(nullable = false, columnDefinition = "TEXT")
    private String dslContent;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String compiledDrools;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private UUID createdBy;

    @Column
    private String changeNotes;  // Max 500 characters

    @Column
    private String previousVersion;

    @Column(nullable = false)
    private String contentHash;  // SHA-256

    @Column(nullable = false)
    private String signature;  // HMAC-SHA256 for tamper-evidence

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private VersionStatus status;  // ACTIVE, SUPERSEDED, ROLLED_BACK

    @ElementCollection
    @CollectionTable(name = "rule_version_deployments")
    private List<String> deployedTo;  // ["dev", "staging", "prod"]
}
```

## Implementation

### Version Service

**File:** `backend/src/main/java/com/betrace/services/RuleVersionService.java`

```java
@ApplicationScoped
@SOC2(controls = {CC8_1}, notes = "Immutable audit trail for rule changes")
public class RuleVersionService {
    @Inject RuleVersionRepository versionRepo;
    @Inject KMSService kms;
    @Inject AuditLogService auditLog;

    public RuleVersion createVersion(String ruleId, String dsl, User author, String changeNotes) {
        // Get current version
        Optional<RuleVersion> current = versionRepo.findLatestByRuleId(ruleId);

        // Calculate next version number
        String nextVersion = current.isPresent()
            ? incrementVersion(current.get().getVersion(), detectChangeType(current.get().getDslContent(), dsl))
            : "v1.0.0";

        // Compile DSL to Drools
        String compiledDrools = droolsCompiler.compile(dsl);

        // Generate content hash
        String contentHash = sha256(dsl);

        // P0 Security: Generate HMAC-SHA256 signature
        byte[] tenantKey = kms.getTenantKey(author.getTenantId(), "rule-versioning");
        String signature = hmacSha256(
            ruleId + dsl + author.getId() + Instant.now().toString(),
            tenantKey
        );

        RuleVersion version = new RuleVersion(
            UUID.randomUUID(),
            UUID.fromString(ruleId),
            nextVersion,
            dsl,
            compiledDrools,
            Instant.now(),
            author.getId(),
            changeNotes,
            current.map(RuleVersion::getVersion).orElse(null),
            contentHash,
            signature,
            VersionStatus.ACTIVE,
            List.of()
        );

        // Mark previous version as superseded
        current.ifPresent(prev -> {
            prev.setStatus(VersionStatus.SUPERSEDED);
            versionRepo.update(prev);
        });

        versionRepo.create(version);

        // P0 Security: Emit compliance span
        emitComplianceSpan(SOC2, CC8_1, "rule_version_created", Map.of(
            "rule_id", ruleId,
            "version", nextVersion,
            "author_id", author.getId().toString(),
            "content_hash", contentHash,
            "signature", signature
        ));

        // Audit log
        auditLog.info("Rule version created", Map.of(
            "rule_id", ruleId,
            "version", nextVersion,
            "author", author.getEmail(),
            "change_notes", changeNotes
        ));

        return version;
    }

    public boolean verifyIntegrity(RuleVersion version) {
        byte[] tenantKey = kms.getTenantKey(getTenantIdForRule(version.getRuleId()), "rule-versioning");
        String computed = hmacSha256(
            version.getRuleId() + version.getDslContent() + version.getCreatedBy() + version.getCreatedAt().toString(),
            tenantKey
        );
        return MessageDigest.isEqual(version.getSignature().getBytes(), computed.getBytes());
    }

    private String incrementVersion(String current, ChangeType changeType) {
        String[] parts = current.substring(1).split("\\.");  // Remove 'v' prefix
        int major = Integer.parseInt(parts[0]);
        int minor = Integer.parseInt(parts[1]);
        int patch = Integer.parseInt(parts[2]);

        return switch (changeType) {
            case BREAKING -> String.format("v%d.0.0", major + 1);
            case FEATURE -> String.format("v%d.%d.0", major, minor + 1);
            case BUGFIX -> String.format("v%d.%d.%d", major, minor, patch + 1);
        };
    }

    private ChangeType detectChangeType(String oldDsl, String newDsl) {
        // Semantic analysis of DSL changes
        // Breaking: Removes attributes, changes operators
        // Feature: Adds conditions, tunes thresholds
        // Bugfix: Fixes syntax errors, no semantic change

        // Simplified heuristic:
        if (oldDsl.length() > newDsl.length() * 1.2) {
            return ChangeType.BREAKING;  // Significant reduction
        } else if (newDsl.contains("and") && !oldDsl.contains("and")) {
            return ChangeType.FEATURE;  // Added conditions
        } else {
            return ChangeType.BUGFIX;
        }
    }
}

enum ChangeType {
    BREAKING, FEATURE, BUGFIX
}

enum VersionStatus {
    ACTIVE, SUPERSEDED, ROLLED_BACK
}
```

### Signal-Version Correlation

**File:** `backend/src/main/java/com/betrace/models/Signal.java`

```java
@Entity
@Table(name = "signals")
public class Signal {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID ruleId;

    @Column(nullable = false)
    private String ruleVersion;  // "v1.2.3"

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private VersionStatus ruleVersionStatus;  // ACTIVE, ROLLED_BACK

    @Column(nullable = false)
    private String traceId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Severity severity;

    @Column(nullable = false)
    private Instant createdAt;

    // ... other fields
}
```

**Integration with Signal Service:**

```java
@ApplicationScoped
public class SignalService {
    @Inject RuleVersionService versionService;

    public Signal createSignal(String ruleId, RuleMatch match) {
        // Get current active version
        RuleVersion currentVersion = versionService.getActiveVersion(ruleId);

        Signal signal = new Signal(
            UUID.randomUUID(),
            UUID.fromString(ruleId),
            currentVersion.getVersion(),
            currentVersion.getStatus(),
            match.getTraceId(),
            match.getSeverity(),
            Instant.now()
        );

        signalRepository.create(signal);
        return signal;
    }

    public void markVersionSignalsAsRolledBack(String ruleId, String version) {
        List<Signal> signals = signalRepository.findByRuleVersion(ruleId, version);
        for (Signal signal : signals) {
            signal.setRuleVersionStatus(VersionStatus.ROLLED_BACK);
            signalRepository.update(signal);
        }
    }
}
```

### Version History API

**File:** `backend/src/main/java/com/betrace/routes/RuleVersionRoute.java`

```java
@Path("/api/rules/{ruleId}/versions")
@ApplicationScoped
public class RuleVersionRoute {
    @Inject RuleVersionService versionService;
    @Inject AuthorizationService authz;

    @GET
    @RolesAllowed("rules:versions:read")
    @SOC2(controls = {CC6_1}, notes = "Authorization for version history access")
    public Response listVersions(
        @PathParam("ruleId") String ruleId,
        @QueryParam("limit") @DefaultValue("100") int limit,
        @Context SecurityContext ctx
    ) {
        String tenantId = ctx.getUserPrincipal().getName();

        // P0 Security: Verify rule ownership
        if (!ruleService.ownsRule(tenantId, ruleId)) {
            throw new ForbiddenException("Cross-tenant access denied");
        }

        // P2 Security: Limit query size
        if (limit > 100) {
            throw new BadRequestException("Max limit: 100");
        }

        List<RuleVersion> versions = versionService.getVersionHistory(ruleId, limit);

        // P0 Security: Verify integrity before returning
        for (RuleVersion version : versions) {
            if (!versionService.verifyIntegrity(version)) {
                log.error("Version integrity check failed: {}", version.getId());
                throw new SecurityException("Version tampering detected");
            }
        }

        // P0 Security: Audit access
        auditLog.info("Version history accessed", Map.of(
            "rule_id", ruleId,
            "user_id", ctx.getUserPrincipal().getName(),
            "version_count", versions.size()
        ));

        return Response.ok(versions.stream()
            .map(this::toVersionSummary)
            .collect(Collectors.toList())
        ).build();
    }

    @GET
    @Path("/{version}")
    @RolesAllowed("rules:versions:read")
    public Response getVersion(
        @PathParam("ruleId") String ruleId,
        @PathParam("version") String version,
        @Context SecurityContext ctx
    ) {
        String tenantId = ctx.getUserPrincipal().getName();

        if (!ruleService.ownsRule(tenantId, ruleId)) {
            throw new ForbiddenException("Cross-tenant access denied");
        }

        RuleVersion ruleVersion = versionService.getVersion(ruleId, version)
            .orElseThrow(() -> new NotFoundException("Version not found"));

        // P0 Security: Verify integrity
        if (!versionService.verifyIntegrity(ruleVersion)) {
            throw new SecurityException("Version tampering detected");
        }

        return Response.ok(ruleVersion).build();
    }

    private VersionSummary toVersionSummary(RuleVersion version) {
        long signalCount = signalRepository.countByRuleVersion(
            version.getRuleId().toString(),
            version.getVersion()
        );

        return new VersionSummary(
            version.getVersion(),
            version.getCreatedAt(),
            version.getCreatedBy().toString(),
            version.getStatus(),
            signalCount,
            version.getChangeNotes()
        );
    }
}

record VersionSummary(
    String version,
    Instant createdAt,
    String createdBy,
    VersionStatus status,
    long signalCount,
    String changeNotes
) {}
```

## Security Requirements

### P0 (Blocking)

**1. Cryptographic Integrity**
- HMAC-SHA256 signature for every version
- Per-tenant signing keys from KMS
- Signature verified before version use
- Test:
```java
@Test
void versionIntegrityVerified() {
    RuleVersion version = versionService.createVersion(ruleId, dsl, author, "notes");

    // Tamper with content
    version.setDslContent("malicious DSL");

    assertFalse(versionService.verifyIntegrity(version));
}
```

**2. Authorization**
- `rules:versions:read` permission required
- Tenant ownership verified
- Cross-tenant access blocked
- Test:
```java
@Test
void crossTenantAccessDenied() {
    User tenantBUser = new User("tenant-b");

    assertThatThrownBy(() ->
        versionRoute.listVersions("tenant-a-rule", 100, tenantBUser)
    ).isInstanceOf(ForbiddenException.class);
}
```

**3. Audit Logging**
- All version creations logged
- All version accesses logged
- Log format:
```json
{
  "event": "rule_version_created",
  "rule_id": "rule-123",
  "version": "v1.2.3",
  "author_id": "user-456",
  "content_hash": "sha256...",
  "signature": "hmac...",
  "timestamp": "2025-10-11T10:23:45.123Z"
}
```

### P1 (High Priority)

**4. Retention Policy**
- 7-year minimum retention (SOC2 CC8.1)
- Cannot delete versions within retention period
- Implementation:
```java
public void deleteVersion(String versionId, User user) {
    RuleVersion version = versionRepo.findById(versionId);

    if (version.getCreatedAt().plus(Duration.ofDays(365 * 7)).isAfter(Instant.now())) {
        throw new RetentionPolicyViolationException("Version must be retained for 7 years per SOC2 CC8.1");
    }

    versionRepo.delete(versionId);
}
```

**5. Version Immutability**
- Once deployed, version DSL cannot be edited
- Only new versions can be created
- Test:
```java
@Test
void deployedVersionImmutable() {
    RuleVersion version = versionService.createVersion(ruleId, dsl, author, "notes");

    assertThatThrownBy(() -> version.setDslContent("new DSL"))
        .isInstanceOf(UnsupportedOperationException.class);
}
```

## Configuration

**File:** `application.properties`

```properties
# Version management
rule.version.retention-years=7
rule.version.max-history-size=1000
rule.version.signature-algorithm=HmacSHA256

# Change notes
rule.version.change-notes.max-length=500
rule.version.change-notes.required=true

# Integrity
rule.version.integrity-check.enabled=true
rule.version.integrity-check.on-access=true
```

## Acceptance Criteria

### Functional Requirements

**Version Creation:**
```gherkin
Scenario: Version created on deployment
  Given rule "R1" with DSL "trace.has(error)"
  When rule is deployed by user "admin"
  Then new version "v1.0.0" created
  And version status = ACTIVE
  And version.createdBy = "admin"
  And version.signature is valid

Scenario: Draft edits do not create versions
  Given rule "R1" with version "v1.0.0"
  When DSL is edited in draft mode
  Then no new version created
  And version count remains 1
```

**Version Numbering:**
```gherkin
Scenario: Major version on breaking change
  Given rule "R1" version "v1.2.3"
  When DSL changes from 100 to 50 lines (significant reduction)
  Then next version = "v2.0.0"

Scenario: Minor version on feature addition
  Given rule "R1" version "v1.2.3"
  When DSL adds new condition "and trace.has(timeout)"
  Then next version = "v1.3.0"

Scenario: Patch version on bugfix
  Given rule "R1" version "v1.2.3"
  When DSL fixes typo (no semantic change)
  Then next version = "v1.2.4"
```

**Signal Correlation:**
```gherkin
Scenario: Signals record rule version
  Given rule "R1" version "v1.2.3" is active
  When trace matches rule and signal generated
  Then signal.ruleVersion = "v1.2.3"
  And signal.ruleVersionStatus = ACTIVE
```

### Security Requirements

```gherkin
Scenario: Version integrity verified
  Given version "v1.2.3" with valid signature
  When version DSL is tampered with
  Then integrity check fails
  And SecurityException thrown

Scenario: Authorization enforced
  Given tenant "A" owns rule "R1"
  When tenant "B" queries /rules/R1/versions
  Then 403 Forbidden response returned

Scenario: Version access audited
  Given user queries version history
  When query completes
  Then audit log contains:
    - event: version_history_accessed
    - user_id: <user>
    - rule_id: R1
```

## Testing Strategy

### Unit Tests

**Version Creation:**
```java
@Test
void versionCreatedWithSignature() {
    RuleVersion version = versionService.createVersion(ruleId, dsl, author, "Initial version");

    assertThat(version.getVersion()).isEqualTo("v1.0.0");
    assertThat(version.getSignature()).isNotEmpty();
    assertTrue(versionService.verifyIntegrity(version));
}
```

**Version Numbering:**
```java
@Test
void versionIncrementedCorrectly() {
    versionService.createVersion(ruleId, dsl1, author, "V1");
    RuleVersion v2 = versionService.createVersion(ruleId, dsl2, author, "V2");

    assertThat(v2.getVersion()).isEqualTo("v1.1.0");  // Feature change
}
```

### Integration Tests

**Database Persistence:**
```java
@QuarkusTest
class RuleVersionIntegrationTest {
    @Test
    void versionPersistedImmutably() {
        RuleVersion version = versionService.createVersion(ruleId, dsl, author, "notes");

        RuleVersion fetched = versionRepo.findById(version.getId()).orElseThrow();
        assertThat(fetched.getDslContent()).isEqualTo(dsl);
        assertTrue(versionService.verifyIntegrity(fetched));
    }
}
```

## Files to Create/Modify

**New Files:**
- `backend/src/main/java/com/betrace/services/RuleVersionService.java`
- `backend/src/main/java/com/betrace/models/RuleVersion.java`
- `backend/src/main/java/com/betrace/repositories/RuleVersionRepository.java`
- `backend/src/main/java/com/betrace/routes/RuleVersionRoute.java`
- `backend/src/test/java/com/betrace/services/RuleVersionServiceTest.java`

**Modified Files:**
- `backend/src/main/java/com/betrace/models/Signal.java` (add ruleVersion field)
- `backend/src/main/java/com/betrace/services/SignalService.java` (add version tracking)
- `backend/src/main/resources/application.properties`

**Database Migrations:**
- `V1__create_rule_versions_table.sql`
- `V2__add_rule_version_to_signals.sql`

## Dependencies

**Maven:**
```xml
<dependency>
    <groupId>javax.crypto</groupId>
    <artifactId>javax.crypto-api</artifactId>
    <version>1.0</version>
</dependency>
```

## Success Criteria

- [ ] Version created on deployment (not drafts)
- [ ] Semantic versioning (MAJOR.MINOR.PATCH)
- [ ] HMAC-SHA256 signatures for tamper-evidence
- [ ] Signature verification before version use
- [ ] Authorization: `rules:versions:read` permission
- [ ] Audit logging for version creation/access
- [ ] Signal-version correlation
- [ ] 7-year retention policy enforced
- [ ] Test coverage >90%
- [ ] SOC2 CC8.1 audit evidence export
