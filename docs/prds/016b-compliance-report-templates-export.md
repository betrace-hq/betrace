# PRD-016b: Compliance Report Templates & Export

**Status:** Draft
**Priority:** P0
**Dependencies:** PRD-016a (Evidence Collection Query API)
**Relates To:** PRD-016c (uses this service)

## Problem Statement

Evidence Query API returns raw JSON. Auditors need:
- Human-readable PDF reports
- Excel-compatible CSV exports
- Pre-formatted SOC2/HIPAA templates
- Branded reports with logos and watermarks

Manual report generation is time-consuming and error-prone.

## Solution

Report generation system that:
- Consumes Evidence Query API (PRD-016a)
- Applies compliance framework templates
- Exports to PDF, CSV, JSON formats
- Enforces PII redaction in all outputs
- Supports custom branding

### Report Generation Service

```java
@ApplicationScoped
public class ReportGenerationService {

    @Inject EvidenceQueryResource evidenceApi;
    @Inject TemplateEngine templateEngine;
    @Inject ReportExporterFactory exporterFactory;

    public ReportGenerationResponse generateReport(ReportRequest request) {
        // 1. Query evidence via PRD-016a
        EvidenceQueryResponse evidence = evidenceApi.queryEvidence(request.toEvidenceQuery());

        // 2. Apply template
        Report report = templateEngine.render(request.getTemplate(), evidence);

        // 3. Export to format
        byte[] output = exporterFactory.export(report, request.getFormat());

        // 4. Save for download
        return saveReport(output, request);
    }
}
```

### Report Templates

1. **SOC2 Type II**
   - Executive summary
   - Control-by-control evidence
   - Violation summary
   - Coverage gaps

2. **HIPAA Technical Safeguards**
   - §164.312(a)-(d) evidence
   - PHI access audit trail

3. **Coverage Gap Report**
   - Unannotated operations
   - Zero-evidence controls
   - Rule effectiveness

4. **Executive Dashboard**
   - Compliance posture score
   - Trend analysis
   - Risk summary

### Export Formats

```java
public interface ReportExporter {
    byte[] export(Report report);
}

// PDF: Thymeleaf + Flying Saucer
// CSV: Apache Commons CSV
// JSON: Jackson serialization
```

## Acceptance Criteria

- **AC1**: SOC2 template generates valid PDF with all controls
- **AC2**: HIPAA template includes all §164.312 safeguards
- **AC3**: CSV export Excel-compatible
- **AC4**: PII redaction in all formats
- **AC5**: PDF includes ToC, page numbers, watermark
- **AC6**: Coverage gap identifies controls <50% coverage
- **AC7**: Generation < 30 seconds for 10K spans
- **AC8**: Branding applied when requested

## Security Requirements

- **PII Protection**: Redaction in all export formats
- **Watermark**: "CONFIDENTIAL" by default
- **Download URLs**: Expire after 24 hours
- **Tenant Isolation**: Cannot download other tenant's reports
- **Audit Trail**: Log generation and downloads

## Performance Requirements

- PDF generation: < 30 seconds for 10K spans
- CSV generation: < 10 seconds for 10K spans
- JSON generation: < 5 seconds for 10K spans
- Memory: < 512MB heap for rendering

## Test Requirements

- **Unit**: 20 tests (templates, exports, PII redaction)
- **Integration**: 15 tests (Evidence API → template → export)
- **Visual Regression**: 5 tests (PDF screenshots)

## Dependencies

- PRD-016a Evidence API
- Thymeleaf template engine
- Flying Saucer (PDF generation)
- Apache Commons CSV
- TenantService (branding)
