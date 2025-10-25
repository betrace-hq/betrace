package observability

import (
	"context"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

// OpenTelemetry metrics for BeTrace rule engine and compliance
// Platform-agnostic: works with Prometheus, SigNoz, Kibana, Grafana, etc.

var (
	meter = otel.Meter("betrace.rule-engine")

	// Metrics are initialized lazily
	metricsOnce sync.Once

	// Rule Engine Performance Metrics
	ruleEvaluationDuration metric.Float64Histogram
	ruleEvaluationTotal    metric.Int64Counter
	spansProcessedTotal    metric.Int64Counter
	spanAttributesCount    metric.Int64Histogram
	spanSizeBytes          metric.Int64Histogram
	ruleLoadDuration       metric.Float64Histogram
	ruleLoadTotal          metric.Int64Counter
	rulesActive            metric.Int64UpDownCounter

	// Lazy Evaluation Metrics
	lazyFieldsLoaded  metric.Int64Histogram
	lazyCacheHits     metric.Int64Counter

	// Compliance Evidence Metrics
	complianceSpansEmitted  metric.Int64Counter
	soc2AccessControlChecks metric.Int64Counter
	soc2DataIsolationChecks metric.Int64Counter
	hipaaAccessLogEntries   metric.Int64Counter
	gdprDataAccessRequests  metric.Int64Counter
	fedrampAccessControls   metric.Int64Counter
)

// InitMetrics initializes all OpenTelemetry metrics
// Call this once during application startup
func InitMetrics() error {
	var err error
	metricsOnce.Do(func() {
		// Rule Engine Performance Metrics
		ruleEvaluationDuration, err = meter.Float64Histogram(
			"betrace.rule_evaluation_duration",
			metric.WithDescription("Time taken to evaluate a single rule against a span"),
			metric.WithUnit("s"),
		)
		if err != nil {
			return
		}

		ruleEvaluationTotal, err = meter.Int64Counter(
			"betrace.rule_evaluation_total",
			metric.WithDescription("Total number of rule evaluations"),
		)
		if err != nil {
			return
		}

		spansProcessedTotal, err = meter.Int64Counter(
			"betrace.rule_engine_spans_processed_total",
			metric.WithDescription("Total number of spans processed by rule engine"),
		)
		if err != nil {
			return
		}

		spanAttributesCount, err = meter.Int64Histogram(
			"betrace.rule_engine_span_attributes",
			metric.WithDescription("Number of attributes in processed spans"),
		)
		if err != nil {
			return
		}

		spanSizeBytes, err = meter.Int64Histogram(
			"betrace.rule_engine_span_size_bytes",
			metric.WithDescription("Estimated size of processed spans in bytes"),
			metric.WithUnit("By"),
		)
		if err != nil {
			return
		}

		ruleLoadDuration, err = meter.Float64Histogram(
			"betrace.rule_load_duration",
			metric.WithDescription("Time taken to parse and load a rule"),
			metric.WithUnit("s"),
		)
		if err != nil {
			return
		}

		ruleLoadTotal, err = meter.Int64Counter(
			"betrace.rule_load_total",
			metric.WithDescription("Total number of rule load attempts"),
		)
		if err != nil {
			return
		}

		rulesActive, err = meter.Int64UpDownCounter(
			"betrace.rules_active",
			metric.WithDescription("Number of currently active rules"),
		)
		if err != nil {
			return
		}

		// Lazy Evaluation Metrics
		lazyFieldsLoaded, err = meter.Int64Histogram(
			"betrace.lazy_evaluation_fields_loaded",
			metric.WithDescription("Number of span fields actually loaded during lazy evaluation"),
		)
		if err != nil {
			return
		}

		lazyCacheHits, err = meter.Int64Counter(
			"betrace.lazy_evaluation_cache_hits_total",
			metric.WithDescription("Number of lazy evaluation cache hits"),
		)
		if err != nil {
			return
		}

		// Compliance Evidence Metrics
		complianceSpansEmitted, err = meter.Int64Counter(
			"betrace.compliance_spans_emitted_total",
			metric.WithDescription("Total number of compliance evidence spans emitted"),
		)
		if err != nil {
			return
		}

		soc2AccessControlChecks, err = meter.Int64Counter(
			"betrace.soc2_access_control_checks_total",
			metric.WithDescription("SOC2 CC6.1 access control checks"),
		)
		if err != nil {
			return
		}

		soc2DataIsolationChecks, err = meter.Int64Counter(
			"betrace.soc2_data_isolation_checks_total",
			metric.WithDescription("SOC2 CC6.3 data isolation checks"),
		)
		if err != nil {
			return
		}

		hipaaAccessLogEntries, err = meter.Int64Counter(
			"betrace.hipaa_access_log_entries_total",
			metric.WithDescription("HIPAA 164.312(b) audit log entries"),
		)
		if err != nil {
			return
		}

		gdprDataAccessRequests, err = meter.Int64Counter(
			"betrace.gdpr_data_access_requests_total",
			metric.WithDescription("GDPR Art. 15 data access requests"),
		)
		if err != nil {
			return
		}

		fedrampAccessControls, err = meter.Int64Counter(
			"betrace.fedramp_access_controls_total",
			metric.WithDescription("FedRAMP AC-3 access control checks"),
		)
	})
	return err
}

// RecordRuleEvaluation records a rule evaluation with duration and result
func RecordRuleEvaluation(ctx context.Context, ruleID string, result string, durationSeconds float64) {
	attrs := metric.WithAttributes(
		attribute.String("rule_id", ruleID),
		attribute.String("result", result), // match|no_match|error
	)

	ruleEvaluationDuration.Record(ctx, durationSeconds, attrs)
	ruleEvaluationTotal.Add(ctx, 1, attrs)
}

// RecordSpanProcessed increments the span processing counter
func RecordSpanProcessed(ctx context.Context) {
	spansProcessedTotal.Add(ctx, 1)
}

// RecordSpanAttributes records the number of attributes in a span
func RecordSpanAttributes(ctx context.Context, count int64) {
	spanAttributesCount.Record(ctx, count)
}

// RecordSpanSize records the estimated size of a span in bytes
func RecordSpanSize(ctx context.Context, sizeBytes int64) {
	spanSizeBytes.Record(ctx, sizeBytes)
}

// RecordRuleLoad records a rule load operation
func RecordRuleLoad(ctx context.Context, status string, durationSeconds float64) {
	ruleLoadDuration.Record(ctx, durationSeconds)
	ruleLoadTotal.Add(ctx, 1, metric.WithAttributes(
		attribute.String("status", status), // success|error
	))
}

// UpdateActiveRules updates the active rules gauge
func UpdateActiveRules(ctx context.Context, delta int64) {
	rulesActive.Add(ctx, delta)
}

// RecordLazyFieldsLoaded records the number of fields loaded during lazy evaluation
func RecordLazyFieldsLoaded(ctx context.Context, ruleID string, count int64) {
	lazyFieldsLoaded.Record(ctx, count, metric.WithAttributes(
		attribute.String("rule_id", ruleID),
	))
}

// RecordLazyCacheHit increments the lazy evaluation cache hit counter
func RecordLazyCacheHit(ctx context.Context, fieldType string) {
	lazyCacheHits.Add(ctx, 1, metric.WithAttributes(
		attribute.String("field_type", fieldType), // scalar|attribute
	))
}

// RecordComplianceSpan records a compliance evidence span emission
func RecordComplianceSpan(ctx context.Context, framework, control, outcome string) {
	attrs := metric.WithAttributes(
		attribute.String("framework", framework), // soc2|hipaa|gdpr|fedramp
		attribute.String("control", control),
		attribute.String("outcome", outcome),
	)
	complianceSpansEmitted.Add(ctx, 1, attrs)

	// Also increment framework-specific counters
	switch framework {
	case "soc2":
		if control == "CC6.1" {
			soc2AccessControlChecks.Add(ctx, 1, metric.WithAttributes(
				attribute.String("outcome", outcome),
			))
		} else if control == "CC6.3" {
			soc2DataIsolationChecks.Add(ctx, 1, metric.WithAttributes(
				attribute.String("outcome", outcome),
			))
		}
	case "hipaa":
		if control == "164.312(b)" {
			hipaaAccessLogEntries.Add(ctx, 1, metric.WithAttributes(
				attribute.String("outcome", outcome),
			))
		}
	case "gdpr":
		if control == "Art. 15" {
			gdprDataAccessRequests.Add(ctx, 1, metric.WithAttributes(
				attribute.String("outcome", outcome),
			))
		}
	case "fedramp":
		if control == "AC-3" {
			fedrampAccessControls.Add(ctx, 1, metric.WithAttributes(
				attribute.String("outcome", outcome),
			))
		}
	}
}
