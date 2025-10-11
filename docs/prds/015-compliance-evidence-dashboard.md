# PRD-015: Compliance Evidence Dashboard

**Priority:** P1 (User Workflows - Needed for Production Use)
**Complexity:** Medium-Complex
**Personas:** Compliance Officers, Auditors, Security Teams
**Dependencies:** PRD-002 (Persistence), PRD-003 (Compliance Signing), ADR-015 (Tiered Storage)

## Problem

Compliance officers and auditors cannot effectively query and analyze compliance evidence:

**Current State:**
- Compliance spans emitted to OpenTelemetry/Grafana
- Evidence stored in tiered storage (DuckDB hot, Parquet cold per ADR-015)
- No dedicated UI for compliance workflows
- Auditors must learn TraceQL syntax to query evidence
- No filtering by framework (SOC2, HIPAA, GDPR) or control (CC6.1, CC6.2, etc.)
- No signature verification status visible
- No export functionality for audit reports

**Pain Points:**
1. **Compliance Officers:** Cannot quickly prove controls are working during audits
2. **Auditors:** Need CSV/JSON exports for their tools, not raw TraceQL queries
3. **Security Teams:** Cannot track security event trends (validation failures, injection attempts)
4. **Management:** No compliance dashboard for reporting to board/investors

**Documented Gap:** `docs/compliance-status.md` - "Evidence export API for auditors" (Not Implemented)

## Solution

**Build a dedicated Compliance Evidence Dashboard with:**
- Query compliance spans by framework, control, tenant, date range
- Display signature verification status (integrated with PRD-003)
- Export evidence to CSV/JSON for auditor tools
- Real-time compliance metrics (span counts, control coverage)
- Unified queries across hot (DuckDB) and cold (Parquet) storage (ADR-015)

### Architecture Overview

```
Frontend (React + Tanstack)
        ↓
   Camel REST API
        ↓
   Named Processors
        ↓
   Query Processors
   ├── QueryHotStorageProcessor (DuckDB 0-7 days)
   ├── QueryColdStorageProcessor (Parquet 7-365 days)
   └── MergeResultsProcessor (Unified results)
        ↓
   Signature Verification (PRD-003)
        ↓
   Export Processors
   ├── ExportToCSVProcessor
   └── ExportToJSONProcessor
```

### User Workflows

**Workflow 1: Query Compliance Spans by Control**
```
1. User selects framework (SOC2, HIPAA, GDPR)
2. User selects control (CC6.1, CC6.2, CC7.1, etc.)
3. User selects date range (last 7 days, last 30 days, custom)
4. System queries hot storage (DuckDB) and cold storage (Parquet)
5. System merges results and displays in table
6. System shows signature verification status for each span
```

**Workflow 2: Export Evidence for Auditors**
```
1. User applies filters (framework, control, date range)
2. User clicks "Export to CSV" or "Export to JSON"
3. System queries compliance spans from tiered storage
4. System verifies signatures using PRD-003 verification routes
5. System generates export file with verification status
6. User downloads file for auditor submission
```

**Workflow 3: Compliance Metrics Dashboard**
```
1. User navigates to Compliance Dashboard
2. System displays:
   - Total compliance spans by framework
   - Control coverage (which controls have evidence)
   - Signature verification rate (% valid signatures)
   - Security events (validation failures, injection attempts)
   - Trend charts (evidence volume over time)
3. User drills into specific control for details
```

## Backend Implementation

### 1. Compliance Query Routes (Camel REST DSL)

**`com/fluo/routes/ComplianceQueryRoutes.java`:**
```java
package com.fluo.routes;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Camel REST routes for compliance evidence queries.
 * Integrates with tiered storage (ADR-015) and signature verification (PRD-003).
 */
@ApplicationScoped
public class ComplianceQueryRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // REST API for compliance evidence queries
        rest("/api/compliance")
            .description("Compliance evidence query API")
            .produces("application/json")
            .consumes("application/json")

            // Query compliance spans by filters
            .get("/evidence/query")
                .description("Query compliance spans with filters")
                .param().name("framework").type(RestParamType.query).description("Framework: soc2, hipaa, gdpr")
                    .defaultValue("").endParam()
                .param().name("control").type(RestParamType.query).description("Control ID: CC6_1, CC6_2, etc.")
                    .defaultValue("").endParam()
                .param().name("tenantId").type(RestParamType.query).description("Tenant UUID").required(true).endParam()
                .param().name("startDate").type(RestParamType.query).description("Start date (ISO-8601)")
                    .defaultValue("").endParam()
                .param().name("endDate").type(RestParamType.query).description("End date (ISO-8601)")
                    .defaultValue("").endParam()
                .param().name("limit").type(RestParamType.query).description("Result limit").defaultValue("100").endParam()
                .to("direct:queryComplianceEvidence")

            // Get compliance metrics for dashboard
            .get("/metrics/{tenantId}")
                .description("Get compliance metrics for dashboard")
                .to("direct:getComplianceMetrics")

            // Export compliance evidence to CSV
            .post("/evidence/export/csv")
                .description("Export compliance evidence to CSV")
                .to("direct:exportComplianceCSV")

            // Export compliance evidence to JSON
            .post("/evidence/export/json")
                .description("Export compliance evidence to JSON")
                .to("direct:exportComplianceJSON")

            // Get control coverage for framework
            .get("/coverage/{tenantId}/{framework}")
                .description("Get control coverage for framework")
                .to("direct:getControlCoverage");

        // Query compliance evidence (hot + cold storage unified)
        from("direct:queryComplianceEvidence")
            .routeId("queryComplianceEvidence")
            .log("Querying compliance evidence with filters")
            .process("parseComplianceQueryParametersProcessor")
            .process("validateQueryParametersProcessor")
            .multicast()
                .parallelProcessing()
                .to("direct:queryHotComplianceStorage", "direct:queryColdComplianceStorage")
            .end()
            .process("mergeComplianceResultsProcessor")
            .process("verifyComplianceSignaturesProcessor")  // PRD-003 integration
            .process("sortAndLimitResultsProcessor")
            .marshal().json();

        // Query hot storage (DuckDB 0-7 days)
        from("direct:queryHotComplianceStorage")
            .routeId("queryHotComplianceStorage")
            .process("queryDuckDBComplianceProcessor")
            .log("Hot storage returned ${body.size()} compliance spans");

        // Query cold storage (Parquet 7-365 days)
        from("direct:queryColdComplianceStorage")
            .routeId("queryColdComplianceStorage")
            .process("queryColdStorageComplianceProcessor")
            .log("Cold storage returned ${body.size()} compliance spans");

        // Get compliance metrics
        from("direct:getComplianceMetrics")
            .routeId("getComplianceMetrics")
            .process("calculateComplianceMetricsProcessor")
            .marshal().json();

        // Export to CSV
        from("direct:exportComplianceCSV")
            .routeId("exportComplianceCSV")
            .process("parseComplianceExportRequestProcessor")
            .to("direct:queryComplianceEvidence")
            .unmarshal().json()
            .process("formatComplianceCSVProcessor")
            .setHeader("Content-Type", constant("text/csv"))
            .setHeader("Content-Disposition", simple("attachment; filename=compliance-evidence-${date:now:yyyyMMdd}.csv"));

        // Export to JSON
        from("direct:exportComplianceJSON")
            .routeId("exportComplianceJSON")
            .process("parseComplianceExportRequestProcessor")
            .to("direct:queryComplianceEvidence")
            .setHeader("Content-Type", constant("application/json"))
            .setHeader("Content-Disposition", simple("attachment; filename=compliance-evidence-${date:now:yyyyMMdd}.json"));

        // Get control coverage
        from("direct:getControlCoverage")
            .routeId("getControlCoverage")
            .process("calculateControlCoverageProcessor")
            .marshal().json();
    }
}
```

### 2. Query Processors (Named Processors per ADR-014)

**`com/fluo/processors/compliance/query/ParseComplianceQueryParametersProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Parses and validates compliance query parameters from HTTP request.
 */
@Named("parseComplianceQueryParametersProcessor")
@ApplicationScoped
public class ParseComplianceQueryParametersProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        String framework = exchange.getIn().getHeader("framework", String.class);
        String control = exchange.getIn().getHeader("control", String.class);
        String tenantIdStr = exchange.getIn().getHeader("tenantId", String.class);
        String startDateStr = exchange.getIn().getHeader("startDate", String.class);
        String endDateStr = exchange.getIn().getHeader("endDate", String.class);
        Integer limit = exchange.getIn().getHeader("limit", Integer.class);

        // Parse tenant ID
        UUID tenantId = UUID.fromString(tenantIdStr);

        // Parse date range (default to last 7 days)
        LocalDate startDate = startDateStr != null && !startDateStr.isEmpty()
            ? LocalDate.parse(startDateStr)
            : LocalDate.now().minusDays(7);

        LocalDate endDate = endDateStr != null && !endDateStr.isEmpty()
            ? LocalDate.parse(endDateStr)
            : LocalDate.now();

        // Build query filter
        ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
            .framework(framework != null && !framework.isEmpty() ? framework : null)
            .control(control != null && !control.isEmpty() ? control : null)
            .tenantId(tenantId)
            .startDate(startDate)
            .endDate(endDate)
            .limit(limit != null ? limit : 100)
            .build();

        exchange.getIn().setHeader("queryFilter", filter);
        exchange.getIn().setBody(filter);
    }
}
```

**`com/fluo/processors/compliance/query/QueryDuckDBComplianceProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.fluo.services.DuckDBService;
import com.fluo.model.ComplianceSpanRecord;
import java.util.List;

/**
 * Queries compliance spans from DuckDB hot storage (0-7 days).
 * Per ADR-015, uses per-tenant DuckDB files for isolation.
 */
@Named("queryDuckDBComplianceProcessor")
@ApplicationScoped
public class QueryDuckDBComplianceProcessor implements Processor {

    @Inject
    DuckDBService duckDB;

    @Override
    public void process(Exchange exchange) throws Exception {
        ComplianceQueryFilter filter = exchange.getIn().getBody(ComplianceQueryFilter.class);

        // Query compliance spans from tenant's DuckDB file
        String sql = buildComplianceQuery(filter);
        List<ComplianceSpanRecord> spans = duckDB.executeQuery(filter.tenantId(), sql);

        exchange.getIn().setBody(spans);
        exchange.setProperty("hotStorageResults", spans);
    }

    private String buildComplianceQuery(ComplianceQueryFilter filter) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT * FROM compliance_spans WHERE 1=1");

        if (filter.framework() != null) {
            sql.append(" AND framework = '").append(filter.framework()).append("'");
        }

        if (filter.control() != null) {
            sql.append(" AND control = '").append(filter.control()).append("'");
        }

        sql.append(" AND timestamp >= '").append(filter.startDate()).append("'");
        sql.append(" AND timestamp <= '").append(filter.endDate()).append("'");
        sql.append(" ORDER BY timestamp DESC");
        sql.append(" LIMIT ").append(filter.limit());

        return sql.toString();
    }
}
```

**`com/fluo/processors/compliance/query/QueryColdStorageComplianceProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.fluo.services.ColdStorageService;
import com.fluo.services.DuckDBService;
import com.fluo.model.ComplianceSpanRecord;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Queries compliance spans from Parquet cold storage (7-365 days).
 * Per ADR-015, uses ColdStorageService abstraction (deployment-agnostic).
 * Uses DuckDB's ability to query Parquet files directly.
 */
@Named("queryColdStorageComplianceProcessor")
@ApplicationScoped
public class QueryColdStorageComplianceProcessor implements Processor {

    @Inject
    ColdStorageService coldStorage;

    @Inject
    DuckDBService duckDB;

    @Override
    public void process(Exchange exchange) throws Exception {
        ComplianceQueryFilter filter = exchange.getIn().getBody(ComplianceQueryFilter.class);

        // Only query cold storage if date range extends beyond hot storage retention (7 days)
        LocalDate coldStorageCutoff = LocalDate.now().minusDays(7);
        if (filter.startDate().isAfter(coldStorageCutoff)) {
            // Query entirely within hot storage, no cold storage needed
            exchange.getIn().setBody(List.of());
            return;
        }

        // List Parquet files for date range
        List<String> parquetPaths = coldStorage.listParquetFiles(
            filter.tenantId(),
            filter.startDate(),
            Math.min(filter.endDate(), coldStorageCutoff)
        );

        if (parquetPaths.isEmpty()) {
            exchange.getIn().setBody(List.of());
            return;
        }

        // Use DuckDB to query Parquet files directly
        String sql = buildParquetQuery(filter, parquetPaths);
        List<ComplianceSpanRecord> spans = duckDB.executeParquetQuery(sql);

        exchange.getIn().setBody(spans);
        exchange.setProperty("coldStorageResults", spans);
    }

    private String buildParquetQuery(ComplianceQueryFilter filter, List<String> parquetPaths) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT * FROM read_parquet([");

        // Add quoted Parquet file paths
        for (int i = 0; i < parquetPaths.size(); i++) {
            sql.append("'").append(parquetPaths.get(i)).append("'");
            if (i < parquetPaths.size() - 1) sql.append(", ");
        }

        sql.append("]) WHERE 1=1");

        if (filter.framework() != null) {
            sql.append(" AND framework = '").append(filter.framework()).append("'");
        }

        if (filter.control() != null) {
            sql.append(" AND control = '").append(filter.control()).append("'");
        }

        sql.append(" AND timestamp >= '").append(filter.startDate()).append("'");
        sql.append(" AND timestamp <= '").append(filter.endDate()).append("'");
        sql.append(" ORDER BY timestamp DESC");
        sql.append(" LIMIT ").append(filter.limit());

        return sql.toString();
    }
}
```

**`com/fluo/processors/compliance/query/MergeComplianceResultsProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.fluo.model.ComplianceSpanRecord;
import java.util.ArrayList;
import java.util.List;
import java.util.Comparator;

/**
 * Merges results from hot storage (DuckDB) and cold storage (Parquet).
 * Sorts by timestamp descending and applies limit.
 */
@Named("mergeComplianceResultsProcessor")
@ApplicationScoped
public class MergeComplianceResultsProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        List<ComplianceSpanRecord> hotResults = exchange.getProperty("hotStorageResults", List.class);
        List<ComplianceSpanRecord> coldResults = exchange.getProperty("coldStorageResults", List.class);
        ComplianceQueryFilter filter = exchange.getIn().getHeader("queryFilter", ComplianceQueryFilter.class);

        // Merge results
        List<ComplianceSpanRecord> merged = new ArrayList<>();
        if (hotResults != null) merged.addAll(hotResults);
        if (coldResults != null) merged.addAll(coldResults);

        // Sort by timestamp descending
        merged.sort(Comparator.comparing(ComplianceSpanRecord::timestamp).reversed());

        // Apply limit
        if (merged.size() > filter.limit()) {
            merged = merged.subList(0, filter.limit());
        }

        exchange.getIn().setBody(merged);
    }
}
```

**`com/fluo/processors/compliance/query/VerifyComplianceSignaturesProcessor.java`:**
```java
package com.fluo.processors.compliance.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.apache.camel.ProducerTemplate;
import com.fluo.model.ComplianceSpanRecord;
import com.fluo.model.ComplianceSpanVerificationRequest;
import com.fluo.model.VerificationResult;
import java.util.List;

/**
 * Verifies cryptographic signatures for compliance spans.
 * Integrates with PRD-003 verification routes.
 */
@Named("verifyComplianceSignaturesProcessor")
@ApplicationScoped
public class VerifyComplianceSignaturesProcessor implements Processor {

    @Inject
    ProducerTemplate template;

    @Override
    public void process(Exchange exchange) throws Exception {
        List<ComplianceSpanRecord> spans = exchange.getIn().getBody(List.class);

        // Verify signatures for each span
        for (ComplianceSpanRecord span : spans) {
            if (span.signature() != null && !span.signature().isEmpty()) {
                try {
                    // Call PRD-003 verification route
                    ComplianceSpanVerificationRequest request = new ComplianceSpanVerificationRequest(
                        span.spanAttributes(),
                        span.signature()
                    );

                    VerificationResult result = template.requestBody(
                        "direct:verifyComplianceSpan",
                        request,
                        VerificationResult.class
                    );

                    span.setSignatureValid(result.valid());
                } catch (Exception e) {
                    // If verification fails, mark as invalid
                    span.setSignatureValid(false);
                    span.setVerificationError(e.getMessage());
                }
            } else {
                // No signature present (old spans before PRD-003)
                span.setSignatureValid(null);
            }
        }

        exchange.getIn().setBody(spans);
    }
}
```

### 3. Export Processors

**`com/fluo/processors/compliance/export/FormatComplianceCSVProcessor.java`:**
```java
package com.fluo.processors.compliance.export;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.fluo.model.ComplianceSpanRecord;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Formats compliance spans as CSV for auditor export.
 */
@Named("formatComplianceCSVProcessor")
@ApplicationScoped
public class FormatComplianceCSVProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        List<ComplianceSpanRecord> spans = exchange.getIn().getBody(List.class);

        StringBuilder csv = new StringBuilder();

        // CSV header
        csv.append("Timestamp,Framework,Control,Evidence Type,Tenant ID,Outcome,Signature Valid,Trace ID,Details\n");

        // CSV rows
        for (ComplianceSpanRecord span : spans) {
            csv.append(formatCSVValue(span.timestamp().toString())).append(",");
            csv.append(formatCSVValue(span.framework())).append(",");
            csv.append(formatCSVValue(span.control())).append(",");
            csv.append(formatCSVValue(span.evidenceType())).append(",");
            csv.append(formatCSVValue(span.tenantId().toString())).append(",");
            csv.append(formatCSVValue(span.outcome())).append(",");
            csv.append(formatCSVValue(span.signatureValid() != null ? span.signatureValid().toString() : "N/A")).append(",");
            csv.append(formatCSVValue(span.traceId())).append(",");
            csv.append(formatCSVValue(span.details())).append("\n");
        }

        exchange.getIn().setBody(csv.toString());
    }

    private String formatCSVValue(String value) {
        if (value == null) return "";
        // Escape quotes and wrap in quotes if contains comma
        if (value.contains(",") || value.contains("\"")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
```

### 4. Metrics Processors

**`com/fluo/processors/compliance/metrics/CalculateComplianceMetricsProcessor.java`:**
```java
package com.fluo.processors.compliance.metrics;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.fluo.services.DuckDBService;
import com.fluo.model.ComplianceMetrics;
import java.util.UUID;
import java.util.Map;

/**
 * Calculates compliance metrics for dashboard display.
 */
@Named("calculateComplianceMetricsProcessor")
@ApplicationScoped
public class CalculateComplianceMetricsProcessor implements Processor {

    @Inject
    DuckDBService duckDB;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = UUID.fromString(exchange.getIn().getHeader("tenantId", String.class));

        // Query metrics from DuckDB
        String sql = """
            SELECT
                framework,
                COUNT(*) as span_count,
                COUNT(DISTINCT control) as control_count,
                SUM(CASE WHEN signature_valid = true THEN 1 ELSE 0 END) as valid_signatures,
                SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successful_events
            FROM compliance_spans
            WHERE timestamp >= CURRENT_DATE - INTERVAL 30 DAY
            GROUP BY framework
            """;

        List<Map<String, Object>> results = duckDB.executeQueryAsMaps(tenantId, sql);

        // Build metrics object
        ComplianceMetrics metrics = ComplianceMetrics.builder()
            .tenantId(tenantId)
            .frameworkMetrics(results)
            .totalSpans(results.stream().mapToLong(r -> (Long) r.get("span_count")).sum())
            .signatureVerificationRate(calculateSignatureRate(results))
            .lastUpdated(java.time.Instant.now())
            .build();

        exchange.getIn().setBody(metrics);
    }

    private double calculateSignatureRate(List<Map<String, Object>> results) {
        long totalSpans = results.stream().mapToLong(r -> (Long) r.get("span_count")).sum();
        long validSignatures = results.stream().mapToLong(r -> (Long) r.get("valid_signatures")).sum();

        return totalSpans > 0 ? (double) validSignatures / totalSpans : 0.0;
    }
}
```

## Frontend Implementation

### 1. Compliance Evidence Page

**`bff/src/routes/compliance/evidence.tsx`:**
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ComplianceEvidenceTable } from '@/components/compliance/compliance-evidence-table';
import { ComplianceFilters } from '@/components/compliance/compliance-filters';
import { ExportButtons } from '@/components/compliance/export-buttons';
import { useComplianceEvidence } from '@/lib/api/compliance';

export const Route = createFileRoute('/compliance/evidence')({
  component: ComplianceEvidencePage,
});

function ComplianceEvidencePage() {
  const [filters, setFilters] = useState({
    framework: '',
    control: '',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    limit: 100,
  });

  const { data: evidence, isLoading, error } = useComplianceEvidence(filters);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Compliance Evidence</h1>
        <p className="text-muted-foreground">
          Query and export compliance spans for audit reporting
        </p>
      </div>

      <ComplianceFilters filters={filters} onChange={setFilters} />

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {evidence && `${evidence.length} compliance spans found`}
        </div>
        <ExportButtons filters={filters} />
      </div>

      {isLoading && <div>Loading compliance evidence...</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
      {evidence && <ComplianceEvidenceTable evidence={evidence} />}
    </div>
  );
}
```

### 2. Compliance Evidence Table

**`bff/src/components/compliance/compliance-evidence-table.tsx`:**
```tsx
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, ShieldAlert, ShieldX } from 'lucide-react';
import type { ComplianceSpanRecord } from '@/lib/api/compliance';

interface ComplianceEvidenceTableProps {
  evidence: ComplianceSpanRecord[];
}

export function ComplianceEvidenceTable({ evidence }: ComplianceEvidenceTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Framework</TableHead>
          <TableHead>Control</TableHead>
          <TableHead>Evidence Type</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead>Signature</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {evidence.map((span) => (
          <TableRow key={span.spanId}>
            <TableCell className="font-mono text-sm">
              {new Date(span.timestamp).toLocaleString()}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{span.framework.toUpperCase()}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{span.control}</Badge>
            </TableCell>
            <TableCell className="text-sm">{span.evidenceType}</TableCell>
            <TableCell>
              <Badge variant={span.outcome === 'success' ? 'success' : 'destructive'}>
                {span.outcome}
              </Badge>
            </TableCell>
            <TableCell>
              {span.signatureValid === true && (
                <div className="flex items-center gap-1 text-green-600">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs">Verified</span>
                </div>
              )}
              {span.signatureValid === false && (
                <div className="flex items-center gap-1 text-red-600">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-xs">Invalid</span>
                </div>
              )}
              {span.signatureValid === null && (
                <div className="flex items-center gap-1 text-gray-400">
                  <ShieldX className="w-4 h-4" />
                  <span className="text-xs">N/A</span>
                </div>
              )}
            </TableCell>
            <TableCell className="text-sm max-w-xs truncate">
              {span.details}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 3. Compliance Filters

**`bff/src/components/compliance/compliance-filters.tsx`:**
```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ComplianceFiltersProps {
  filters: {
    framework: string;
    control: string;
    startDate: string;
    endDate: string;
    limit: number;
  };
  onChange: (filters: any) => void;
}

export function ComplianceFilters({ filters, onChange }: ComplianceFiltersProps) {
  const frameworks = ['', 'soc2', 'hipaa', 'gdpr', 'fedramp', 'iso27001', 'pci-dss'];
  const soc2Controls = ['', 'CC6_1', 'CC6_2', 'CC6_3', 'CC6_6', 'CC6_7', 'CC7_1', 'CC7_2', 'CC8_1'];
  const hipaaControls = ['', '164.312(a)', '164.312(b)', '164.312(a)(2)(i)', '164.312(a)(2)(iv)', '164.312(e)(2)(ii)'];

  const getControlsForFramework = () => {
    if (filters.framework === 'soc2') return soc2Controls;
    if (filters.framework === 'hipaa') return hipaaControls;
    return [''];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-4 border rounded-lg">
      <div>
        <Label htmlFor="framework">Framework</Label>
        <Select
          value={filters.framework}
          onValueChange={(value) => onChange({ ...filters, framework: value, control: '' })}
        >
          <SelectTrigger id="framework">
            <SelectValue placeholder="All Frameworks" />
          </SelectTrigger>
          <SelectContent>
            {frameworks.map((fw) => (
              <SelectItem key={fw} value={fw}>
                {fw === '' ? 'All Frameworks' : fw.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="control">Control</Label>
        <Select
          value={filters.control}
          onValueChange={(value) => onChange({ ...filters, control: value })}
          disabled={!filters.framework}
        >
          <SelectTrigger id="control">
            <SelectValue placeholder="All Controls" />
          </SelectTrigger>
          <SelectContent>
            {getControlsForFramework().map((control) => (
              <SelectItem key={control} value={control}>
                {control === '' ? 'All Controls' : control}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="startDate">Start Date</Label>
        <Input
          id="startDate"
          type="date"
          value={filters.startDate}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="endDate">End Date</Label>
        <Input
          id="endDate"
          type="date"
          value={filters.endDate}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="limit">Result Limit</Label>
        <Input
          id="limit"
          type="number"
          value={filters.limit}
          onChange={(e) => onChange({ ...filters, limit: parseInt(e.target.value) })}
          min={10}
          max={1000}
          step={10}
        />
      </div>

      <div className="col-span-full flex gap-2">
        <Button onClick={() => onChange(filters)}>Apply Filters</Button>
        <Button
          variant="outline"
          onClick={() =>
            onChange({
              framework: '',
              control: '',
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              endDate: new Date().toISOString().split('T')[0],
              limit: 100,
            })
          }
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
```

### 4. Export Buttons

**`bff/src/components/compliance/export-buttons.tsx`:**
```tsx
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportComplianceEvidence } from '@/lib/api/compliance';

interface ExportButtonsProps {
  filters: {
    framework: string;
    control: string;
    startDate: string;
    endDate: string;
  };
}

export function ExportButtons({ filters }: ExportButtonsProps) {
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const blob = await exportComplianceEvidence(filters, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-evidence-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => handleExport('csv')}>
        <Download className="w-4 h-4 mr-2" />
        Export CSV
      </Button>
      <Button variant="outline" onClick={() => handleExport('json')}>
        <Download className="w-4 h-4 mr-2" />
        Export JSON
      </Button>
    </div>
  );
}
```

### 5. API Client

**`bff/src/lib/api/compliance.ts`:**
```typescript
import { useQuery } from '@tanstack/react-query';

export interface ComplianceSpanRecord {
  spanId: string;
  traceId: string;
  timestamp: string;
  framework: string;
  control: string;
  evidenceType: string;
  tenantId: string;
  outcome: string;
  signatureValid: boolean | null;
  signature: string;
  details: string;
  spanAttributes: Record<string, any>;
}

export interface ComplianceQueryFilters {
  framework?: string;
  control?: string;
  startDate: string;
  endDate: string;
  limit?: number;
}

export function useComplianceEvidence(filters: ComplianceQueryFilters) {
  return useQuery({
    queryKey: ['compliance-evidence', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        tenantId: getTenantId(), // From auth context
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: (filters.limit || 100).toString(),
      });

      if (filters.framework) params.set('framework', filters.framework);
      if (filters.control) params.set('control', filters.control);

      const response = await fetch(`/api/compliance/evidence/query?${params}`);
      if (!response.ok) throw new Error('Failed to fetch compliance evidence');

      return response.json() as Promise<ComplianceSpanRecord[]>;
    },
  });
}

export async function exportComplianceEvidence(
  filters: ComplianceQueryFilters,
  format: 'csv' | 'json'
): Promise<Blob> {
  const response = await fetch(`/api/compliance/evidence/export/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: getTenantId(),
      ...filters,
    }),
  });

  if (!response.ok) throw new Error('Export failed');

  return response.blob();
}

function getTenantId(): string {
  // TODO: Get from auth context
  return 'tenant-uuid';
}
```

## Success Criteria

**Functional Requirements:**
- [ ] Query compliance spans by framework (SOC2, HIPAA, GDPR, FedRAMP, ISO27001, PCI-DSS)
- [ ] Query compliance spans by control (CC6.1, CC6.2, CC7.1, 164.312(a), etc.)
- [ ] Query compliance spans by date range (custom range selector)
- [ ] Unified queries across hot (DuckDB) and cold (Parquet) storage (ADR-015)
- [ ] Display signature verification status (PRD-003 integration)
- [ ] Export evidence to CSV format (auditor-friendly)
- [ ] Export evidence to JSON format (programmatic access)
- [ ] Compliance metrics dashboard (span counts, control coverage, signature rate)
- [ ] Control coverage report (which controls have evidence)

**Performance Requirements:**
- [ ] Query response time <1 second for 7-day range (hot storage)
- [ ] Query response time <5 seconds for 30-day range (hot + cold storage)
- [ ] Export 10,000 spans to CSV in <10 seconds
- [ ] Signature verification <100ms per span

**Integration Requirements:**
- [ ] Camel REST API routes (ADR-013 compliance)
- [ ] Named processors for all logic (ADR-014 compliance)
- [ ] TigerBeetle integration for query audit events
- [ ] PRD-003 signature verification routes integration
- [ ] ADR-015 tiered storage queries (DuckDB + Parquet)

**Testing Requirements:**
- [ ] 90% test coverage for processors (ADR-014)
- [ ] Route configuration tests
- [ ] Integration tests for hot + cold storage queries
- [ ] End-to-end export tests (CSV and JSON)
- [ ] Tenant isolation tests (cannot query other tenant's evidence)

## Testing Requirements

### Unit Tests (Processors)

**Query Processor Tests:**
```java
@Test
@DisplayName("Should parse compliance query parameters correctly")
void testParseComplianceQueryParametersProcessor() throws Exception {
    ParseComplianceQueryParametersProcessor processor = new ParseComplianceQueryParametersProcessor();
    Exchange exchange = new DefaultExchange(new DefaultCamelContext());

    exchange.getIn().setHeader("framework", "soc2");
    exchange.getIn().setHeader("control", "CC6_1");
    exchange.getIn().setHeader("tenantId", TEST_TENANT_ID.toString());
    exchange.getIn().setHeader("startDate", "2025-01-01");
    exchange.getIn().setHeader("endDate", "2025-01-31");
    exchange.getIn().setHeader("limit", 100);

    processor.process(exchange);

    ComplianceQueryFilter filter = exchange.getIn().getHeader("queryFilter", ComplianceQueryFilter.class);
    assertEquals("soc2", filter.framework());
    assertEquals("CC6_1", filter.control());
    assertEquals(TEST_TENANT_ID, filter.tenantId());
    assertEquals(LocalDate.of(2025, 1, 1), filter.startDate());
    assertEquals(LocalDate.of(2025, 1, 31), filter.endDate());
    assertEquals(100, filter.limit());
}

@Test
@DisplayName("Should query DuckDB hot storage correctly")
void testQueryDuckDBComplianceProcessor() throws Exception {
    QueryDuckDBComplianceProcessor processor = new QueryDuckDBComplianceProcessor();
    processor.duckDB = mockDuckDBService;

    ComplianceQueryFilter filter = ComplianceQueryFilter.builder()
        .framework("soc2")
        .control("CC6_1")
        .tenantId(TEST_TENANT_ID)
        .startDate(LocalDate.now().minusDays(7))
        .endDate(LocalDate.now())
        .limit(100)
        .build();

    Exchange exchange = new DefaultExchange(new DefaultCamelContext());
    exchange.getIn().setBody(filter);

    when(mockDuckDBService.executeQuery(eq(TEST_TENANT_ID), anyString()))
        .thenReturn(List.of(createTestComplianceSpan()));

    processor.process(exchange);

    List<ComplianceSpanRecord> results = exchange.getIn().getBody(List.class);
    assertNotNull(results);
    assertFalse(results.isEmpty());
    verify(mockDuckDBService).executeQuery(eq(TEST_TENANT_ID), contains("framework = 'soc2'"));
}

@Test
@DisplayName("Should merge hot and cold storage results correctly")
void testMergeComplianceResultsProcessor() throws Exception {
    MergeComplianceResultsProcessor processor = new MergeComplianceResultsProcessor();
    Exchange exchange = new DefaultExchange(new DefaultCamelContext());

    List<ComplianceSpanRecord> hotResults = List.of(
        createComplianceSpan("2025-01-15T10:00:00Z"),
        createComplianceSpan("2025-01-14T10:00:00Z")
    );

    List<ComplianceSpanRecord> coldResults = List.of(
        createComplianceSpan("2025-01-10T10:00:00Z"),
        createComplianceSpan("2025-01-08T10:00:00Z")
    );

    exchange.setProperty("hotStorageResults", hotResults);
    exchange.setProperty("coldStorageResults", coldResults);
    exchange.getIn().setHeader("queryFilter", ComplianceQueryFilter.builder()
        .limit(100)
        .build());

    processor.process(exchange);

    List<ComplianceSpanRecord> merged = exchange.getIn().getBody(List.class);
    assertEquals(4, merged.size());
    // Verify sorted by timestamp descending
    assertEquals("2025-01-15T10:00:00Z", merged.get(0).timestamp());
    assertEquals("2025-01-08T10:00:00Z", merged.get(3).timestamp());
}
```

**Export Processor Tests:**
```java
@Test
@DisplayName("Should format compliance spans as CSV correctly")
void testFormatComplianceCSVProcessor() throws Exception {
    FormatComplianceCSVProcessor processor = new FormatComplianceCSVProcessor();
    Exchange exchange = new DefaultExchange(new DefaultCamelContext());

    List<ComplianceSpanRecord> spans = List.of(
        createTestComplianceSpan("soc2", "CC6_1", "audit_trail", "success", true),
        createTestComplianceSpan("hipaa", "164.312(a)", "access_control", "blocked", false)
    );

    exchange.getIn().setBody(spans);

    processor.process(exchange);

    String csv = exchange.getIn().getBody(String.class);
    assertNotNull(csv);
    assertTrue(csv.contains("Timestamp,Framework,Control,Evidence Type"));
    assertTrue(csv.contains("soc2,CC6_1,audit_trail"));
    assertTrue(csv.contains("hipaa,164.312(a),access_control"));
    assertTrue(csv.contains("true")); // Signature valid
    assertTrue(csv.contains("false")); // Signature invalid
}
```

### Integration Tests

**End-to-End Query Tests:**
```java
@Test
@DisplayName("Should query compliance evidence across hot and cold storage")
void testEndToEndComplianceQuery() throws Exception {
    // Insert test data into hot storage (DuckDB)
    insertComplianceSpans(TEST_TENANT_ID, LocalDate.now().minusDays(3), 50);

    // Insert test data into cold storage (Parquet)
    insertComplianceSpans(TEST_TENANT_ID, LocalDate.now().minusDays(10), 50);

    // Query via Camel route
    Exchange response = template.request("direct:queryComplianceEvidence", exchange -> {
        exchange.getIn().setHeader("framework", "soc2");
        exchange.getIn().setHeader("control", "CC6_1");
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID.toString());
        exchange.getIn().setHeader("startDate", LocalDate.now().minusDays(30).toString());
        exchange.getIn().setHeader("endDate", LocalDate.now().toString());
        exchange.getIn().setHeader("limit", 100);
    });

    List<ComplianceSpanRecord> results = response.getIn().getBody(List.class);
    assertEquals(100, results.size()); // Both hot and cold results merged
}

@Test
@DisplayName("Should export compliance evidence as CSV via route")
void testEndToEndCSVExport() throws Exception {
    insertComplianceSpans(TEST_TENANT_ID, LocalDate.now().minusDays(3), 100);

    Exchange response = template.request("direct:exportComplianceCSV", exchange -> {
        exchange.getIn().setBody(Map.of(
            "framework", "soc2",
            "control", "CC6_1",
            "tenantId", TEST_TENANT_ID.toString(),
            "startDate", LocalDate.now().minusDays(7).toString(),
            "endDate", LocalDate.now().toString()
        ));
    });

    String csv = response.getIn().getBody(String.class);
    assertNotNull(csv);
    assertTrue(csv.startsWith("Timestamp,Framework,Control"));
    assertEquals("text/csv", response.getIn().getHeader("Content-Type"));
    assertTrue(response.getIn().getHeader("Content-Disposition", String.class).contains("attachment"));
}
```

**Tenant Isolation Tests:**
```java
@Test
@DisplayName("Should enforce tenant isolation in compliance queries")
void testTenantIsolationInComplianceQueries() throws Exception {
    UUID tenantA = UUID.randomUUID();
    UUID tenantB = UUID.randomUUID();

    // Insert data for both tenants
    insertComplianceSpans(tenantA, LocalDate.now().minusDays(1), 50);
    insertComplianceSpans(tenantB, LocalDate.now().minusDays(1), 50);

    // Query for tenant A
    Exchange response = template.request("direct:queryComplianceEvidence", exchange -> {
        exchange.getIn().setHeader("tenantId", tenantA.toString());
        exchange.getIn().setHeader("startDate", LocalDate.now().minusDays(7).toString());
        exchange.getIn().setHeader("endDate", LocalDate.now().toString());
        exchange.getIn().setHeader("limit", 100);
    });

    List<ComplianceSpanRecord> results = response.getIn().getBody(List.class);

    // Verify only tenant A's spans returned
    assertEquals(50, results.size());
    assertTrue(results.stream().allMatch(span -> span.tenantId().equals(tenantA)));
    assertFalse(results.stream().anyMatch(span -> span.tenantId().equals(tenantB)));
}
```

## Files to Create

**Backend - Camel Routes:**
- `backend/src/main/java/com/fluo/routes/ComplianceQueryRoutes.java`

**Backend - Query Processors:**
- `backend/src/main/java/com/fluo/processors/compliance/query/ParseComplianceQueryParametersProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/query/ValidateQueryParametersProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/query/QueryDuckDBComplianceProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/query/QueryColdStorageComplianceProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/query/MergeComplianceResultsProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/query/VerifyComplianceSignaturesProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/query/SortAndLimitResultsProcessor.java`

**Backend - Export Processors:**
- `backend/src/main/java/com/fluo/processors/compliance/export/ParseComplianceExportRequestProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/export/FormatComplianceCSVProcessor.java`

**Backend - Metrics Processors:**
- `backend/src/main/java/com/fluo/processors/compliance/metrics/CalculateComplianceMetricsProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/metrics/CalculateControlCoverageProcessor.java`

**Backend - Models:**
- `backend/src/main/java/com/fluo/model/ComplianceQueryFilter.java`
- `backend/src/main/java/com/fluo/model/ComplianceSpanRecord.java`
- `backend/src/main/java/com/fluo/model/ComplianceMetrics.java`
- `backend/src/main/java/com/fluo/model/ComplianceExportRequest.java`

**Backend - Services:**
- `backend/src/main/java/com/fluo/services/DuckDBService.java`
- `backend/src/main/java/com/fluo/services/ColdStorageService.java` (interface)
- `backend/src/main/java/com/fluo/services/FilesystemColdStorage.java` (default impl)

**Backend - Tests:**
- `backend/src/test/java/com/fluo/routes/ComplianceQueryRoutesTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/query/ParseComplianceQueryParametersProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/query/QueryDuckDBComplianceProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/query/QueryColdStorageComplianceProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/query/MergeComplianceResultsProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/export/FormatComplianceCSVProcessorTest.java`
- `backend/src/test/java/com/fluo/compliance/ComplianceQueryIntegrationTest.java`
- `backend/src/test/java/com/fluo/compliance/ComplianceExportIntegrationTest.java`
- `backend/src/test/java/com/fluo/compliance/ComplianceTenantIsolationTest.java`

**Frontend - Pages:**
- `bff/src/routes/compliance/evidence.tsx`
- `bff/src/routes/compliance/metrics.tsx`

**Frontend - Components:**
- `bff/src/components/compliance/compliance-evidence-table.tsx`
- `bff/src/components/compliance/compliance-filters.tsx`
- `bff/src/components/compliance/export-buttons.tsx`
- `bff/src/components/compliance/compliance-metrics-dashboard.tsx`
- `bff/src/components/compliance/control-coverage-chart.tsx`
- `bff/src/components/compliance/signature-verification-badge.tsx`

**Frontend - API:**
- `bff/src/lib/api/compliance.ts`

**Frontend - Tests:**
- `bff/src/components/compliance/compliance-evidence-table.test.tsx`
- `bff/src/components/compliance/compliance-filters.test.tsx`

## Files to Modify

**Backend:**
- `backend/pom.xml` - Add DuckDB and Parquet dependencies (if not already present from ADR-015)
- `backend/src/main/resources/application.properties` - Add compliance query configuration

**Frontend:**
- `bff/src/routeTree.gen.ts` - Add compliance routes (auto-generated)
- `bff/src/components/layout/header.tsx` - Add "Compliance" navigation link

## Implementation Phases

### Phase 1: Backend Query Infrastructure (Week 1)
1. Create `ComplianceQueryRoutes` with Camel REST DSL
2. Implement query processors (parse, validate, query hot/cold)
3. Implement merge and sort processors
4. Create `ComplianceQueryFilter` model
5. Add DuckDB query service integration

### Phase 2: Signature Verification Integration (Week 2)
6. Integrate `VerifyComplianceSignaturesProcessor` with PRD-003 routes
7. Add signature verification status to `ComplianceSpanRecord`
8. Test end-to-end signature verification in queries

### Phase 3: Export Functionality (Week 2)
9. Implement CSV export processor
10. Implement JSON export processor
11. Add export routes to `ComplianceQueryRoutes`
12. Test export functionality with large datasets (10K+ spans)

### Phase 4: Frontend UI (Week 3)
13. Create compliance evidence page with filters
14. Implement compliance evidence table with signature badges
15. Add export buttons (CSV and JSON)
16. Create compliance metrics dashboard
17. Add control coverage visualization

### Phase 5: Testing and Documentation (Week 4)
18. Write unit tests for all processors (90% coverage)
19. Write integration tests for end-to-end queries
20. Write tenant isolation tests
21. Write performance tests (query 10K spans <5 seconds)
22. Document query API for consumers
23. Update CLAUDE.md with compliance dashboard usage

## Configuration

**`backend/src/main/resources/application.properties`:**
```properties
# Compliance query configuration
fluo.compliance.query.default-limit=100
fluo.compliance.query.max-limit=1000
fluo.compliance.query.hot-storage-retention-days=7
fluo.compliance.query.cold-storage-retention-days=365

# Export configuration
fluo.compliance.export.max-spans=100000
fluo.compliance.export.timeout-seconds=60

# Signature verification
fluo.compliance.verify-signatures=true
fluo.compliance.verification-timeout-ms=100
```

## Implementation Notes

### Integration with ADR-015 Tiered Storage

**Query Flow:**
```
1. Parse query parameters (framework, control, date range)
2. Determine storage tier split:
   - Hot storage (DuckDB): startDate to min(endDate, now-7days)
   - Cold storage (Parquet): older than 7 days
3. Query both tiers in parallel (multicast pattern)
4. Merge results and sort by timestamp
5. Verify signatures (PRD-003)
6. Return to frontend
```

**DuckDB Query (Hot Storage):**
```sql
SELECT * FROM compliance_spans
WHERE framework = ? AND control = ?
  AND timestamp >= ? AND timestamp <= ?
ORDER BY timestamp DESC
LIMIT ?;
```

**Parquet Query (Cold Storage via DuckDB):**
```sql
SELECT * FROM read_parquet([
  '/data-cold-storage/tenant-uuid/2025/01/15/traces.parquet',
  '/data-cold-storage/tenant-uuid/2025/01/16/traces.parquet'
])
WHERE framework = ? AND control = ?
  AND timestamp >= ? AND timestamp <= ?
ORDER BY timestamp DESC
LIMIT ?;
```

### Integration with PRD-003 Signature Verification

**Verification Integration:**
```java
// For each compliance span, verify signature
ComplianceSpanVerificationRequest request = new ComplianceSpanVerificationRequest(
    span.spanAttributes(),
    span.signature()
);

VerificationResult result = template.requestBody(
    "direct:verifyComplianceSpan",  // PRD-003 route
    request,
    VerificationResult.class
);

span.setSignatureValid(result.valid());
```

### Performance Considerations

**Query Optimization:**
- Parallel queries to hot and cold storage (Camel multicast)
- DuckDB columnar storage enables fast filtering
- Parquet partition pruning (only reads relevant date partitions)
- Signature verification parallelized per span

**Export Optimization:**
- Stream large result sets (don't load all in memory)
- Use Camel streaming for CSV generation
- Limit exports to 100K spans (configurable)

### Tenant Isolation (ADR-012 Compliance)

**Physical Isolation:**
- DuckDB: Per-tenant database files (`./data-duckdb/tenant-uuid.duckdb`)
- Parquet: Per-tenant directories (`./data-cold-storage/tenant-uuid/...`)
- Query processor validates `tenantId` parameter matches authenticated tenant
- No cross-tenant queries possible (OS-level file isolation)

## Compliance Benefits

**SOC2 CC7.2 (System Monitoring):**
- Evidence: Compliance dashboard proves monitoring controls are working
- Audit Trail: Export functionality provides evidence for auditors
- Query Capability: Auditors can verify control effectiveness independently

**HIPAA 164.312(b) (Audit Controls):**
- Evidence: All PHI access logged as compliance spans
- Retention: 365-day retention meets HIPAA requirements
- Export: CSV exports for auditor review

**GDPR Article 30 (Records of Processing Activities):**
- Evidence: Compliance spans prove data processing controls
- Export: JSON exports for GDPR audits

**Query Examples for Auditors:**

**SOC2 CC6.1 (Access Control) Evidence:**
```
Framework: SOC2
Control: CC6.1
Date Range: Last 365 days
Export: CSV
Result: All authorization checks with signature verification
```

**HIPAA PHI Access Audit:**
```
Framework: HIPAA
Control: 164.312(a)
Date Range: Last 180 days
Export: JSON
Result: All PHI access events with audit trail
```

## Security Considerations

**Authentication:**
- All compliance query routes protected by authentication (PRD-001)
- Tenant ID extracted from JWT token (cannot query other tenants)

**Authorization:**
- Only users with "compliance_viewer" role can access dashboard
- Export functionality requires "compliance_exporter" role

**Signature Verification:**
- All compliance spans verified using PRD-003 cryptographic verification
- Invalid signatures clearly marked in UI and exports

**Audit Trail:**
- All compliance queries logged to TigerBeetle (code=8)
- All exports logged with user ID, timestamp, filters

## Related ADRs

- **[ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)** - Deployment-agnostic design
- **[ADR-012: Mathematical Tenant Isolation](../adrs/012-mathematical-tenant-isolation-architecture.md)** - Tenant isolation requirements
- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - Camel route implementation
- **[ADR-014: Camel Testing and Organization Standards](../adrs/014-camel-testing-and-organization-standards.md)** - Testing requirements (90% coverage)
- **[ADR-015: Tiered Storage Architecture](../adrs/015-tiered-storage-architecture.md)** - Hot/cold storage queries

## Dependencies

**Requires:**
- PRD-002: Persistence Layer (TigerBeetle + Tiered Storage)
- PRD-003: Compliance Span Cryptographic Signing (signature verification)
- ADR-015: Tiered Storage Architecture (DuckDB + Parquet queries)

**Blocks:**
- PRD-016: Audit Report Generation (uses compliance query API)

## Future Enhancements

- **Real-Time Compliance Dashboard:** WebSocket updates for live compliance span feed
- **Advanced Filters:** Full-text search in compliance span details
- **Compliance Templates:** Pre-built queries for common audit scenarios (SOC2 Type II checklist)
- **Scheduled Reports:** Email exports on schedule (weekly, monthly)
- **Grafana Integration:** Deep links from dashboard to Grafana trace viewer
- **Audit Trail Visualization:** Timeline view of compliance events
- **Control Gaps Detection:** Alert when controls have no evidence for X days
- **PDF Report Generation:** Formatted audit reports with charts and signature verification summary

## Public Examples

### 1. Vanta Compliance Dashboard
**URL:** https://www.vanta.com/

**Relevance:** Compliance monitoring platform demonstrating evidence collection and control mapping UI patterns. Shows how to present compliance status to auditors and management.

**Key Patterns:**
- Control status dashboard (implemented/not implemented/in progress)
- Evidence timeline view
- Framework selection (SOC2, ISO27001, HIPAA)
- Audit-ready export formats
- Automated evidence collection from integrations

**FLUO Context Clarification:**
> **Important:** Vanta focuses on **compliance certification evidence** by integrating with existing systems (GitHub, AWS, Okta).
> FLUO validates **control effectiveness through trace pattern analysis**—evidence is generated by observing actual system behavior, not system configuration.
> This example demonstrates evidence presentation patterns, not system integration approaches.

### 2. Drata Audit Hub
**URL:** https://drata.com/

**Relevance:** Automated compliance evidence aggregation platform. Demonstrates audit export formats, control coverage metrics, and evidence organization patterns.

**Key Patterns:**
- Continuous control monitoring
- Evidence artifacts with timestamps
- Audit report generation
- Control-to-evidence mapping
- Auditor collaboration portal

**FLUO Context Clarification:**
> **Important:** Drata automates **control evidence collection** from infrastructure and SaaS tools.
> FLUO validates **control effectiveness via behavioral patterns** in OpenTelemetry traces.
> This example demonstrates evidence export and audit presentation, not the evidence generation mechanism.

### 3. Grafana Dashboards
**URL:** https://grafana.com/grafana/dashboards/

**Relevance:** Metric visualization platform with extensive dashboard gallery. Directly applicable since FLUO emits compliance spans queryable in Grafana. Shows patterns for metrics aggregation, time-series visualization, and alerting.

**Key Patterns:**
- Panel-based dashboard layout
- Time-series graphs for trend analysis
- Table panels with filtering
- Stat panels for summary metrics
- Variable templates for framework/control selection

**FLUO Implementation:** FLUO's compliance evidence dashboard can be built as Grafana dashboards querying compliance spans. Alternatively, FLUO provides a React-based dashboard with similar visualization patterns.
