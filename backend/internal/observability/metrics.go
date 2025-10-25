package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Prometheus metrics for BeTrace rule engine and compliance

var (
	// Rule Engine Performance Metrics
	RuleEvaluationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "betrace_rule_evaluation_duration_seconds",
			Help:    "Time taken to evaluate a single rule against a span",
			Buckets: prometheus.ExponentialBuckets(0.000001, 2, 20), // 1μs to 1s
		},
		[]string{"rule_id", "result"}, // result: match|no_match|error
	)

	RuleEvaluationTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_rule_evaluation_total",
			Help: "Total number of rule evaluations",
		},
		[]string{"rule_id", "result"},
	)

	RuleEngineSpansProcessed = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "betrace_rule_engine_spans_processed_total",
			Help: "Total number of spans processed by rule engine",
		},
	)

	RuleEngineSpanAttributes = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "betrace_rule_engine_span_attributes",
			Help:    "Number of attributes in processed spans",
			Buckets: prometheus.ExponentialBuckets(1, 2, 12), // 1 to 4096
		},
	)

	RuleEngineSpanSize = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "betrace_rule_engine_span_size_bytes",
			Help:    "Estimated size of processed spans in bytes",
			Buckets: prometheus.ExponentialBuckets(100, 2, 20), // 100B to 100MB
		},
	)

	RuleLoadDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "betrace_rule_load_duration_seconds",
			Help:    "Time taken to parse and load a rule",
			Buckets: prometheus.ExponentialBuckets(0.000001, 2, 20),
		},
	)

	RuleLoadTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_rule_load_total",
			Help: "Total number of rule load attempts",
		},
		[]string{"status"}, // status: success|error
	)

	RulesActive = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "betrace_rules_active",
			Help: "Number of currently active rules",
		},
	)

	// Lazy Evaluation Metrics
	LazyEvaluationFieldsLoaded = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "betrace_lazy_evaluation_fields_loaded",
			Help:    "Number of span fields actually loaded during lazy evaluation",
			Buckets: prometheus.LinearBuckets(0, 5, 20), // 0 to 100 fields
		},
		[]string{"rule_id"},
	)

	LazyEvaluationCacheHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_lazy_evaluation_cache_hits_total",
			Help: "Number of lazy evaluation cache hits",
		},
		[]string{"field_type"}, // field_type: scalar|attribute
	)

	// Compliance Evidence Metrics
	ComplianceSpansEmitted = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_compliance_spans_emitted_total",
			Help: "Total number of compliance evidence spans emitted",
		},
		[]string{"framework", "control", "outcome"}, // framework: soc2|hipaa|gdpr|fedramp
	)

	ComplianceViolationsDetected = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_compliance_violations_detected_total",
			Help: "Total number of compliance violations detected",
		},
		[]string{"framework", "control", "severity"}, // severity: critical|high|medium|low
	)

	ComplianceEvidenceSize = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "betrace_compliance_evidence_size_bytes",
			Help:    "Size of compliance evidence spans in bytes",
			Buckets: prometheus.ExponentialBuckets(100, 2, 15), // 100B to 1.6MB
		},
		[]string{"framework"},
	)

	ComplianceAuditTrailGaps = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_compliance_audit_trail_gaps_total",
			Help: "Number of detected gaps in compliance audit trail",
		},
		[]string{"framework", "gap_type"}, // gap_type: missing_evidence|unsigned_span|timestamp_gap
	)

	// SOC2 Specific Metrics
	SOC2AccessControlChecks = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_soc2_access_control_checks_total",
			Help: "Total number of SOC2 access control checks (CC6.1)",
		},
		[]string{"outcome"}, // outcome: granted|denied
	)

	SOC2DataIsolationChecks = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_soc2_data_isolation_checks_total",
			Help: "Total number of SOC2 data isolation checks (CC6.3)",
		},
		[]string{"tenant_id", "outcome"},
	)

	// HIPAA Specific Metrics
	HIPAAAccessLogEntries = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "betrace_hipaa_access_log_entries_total",
			Help: "Total number of HIPAA access log entries (164.312(b))",
		},
	)

	HIPAAEncryptionEvents = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_hipaa_encryption_events_total",
			Help: "Total number of HIPAA encryption/decryption events (164.312(a)(2)(iv))",
		},
		[]string{"operation"}, // operation: encrypt|decrypt
	)

	// GDPR Specific Metrics
	GDPRDataAccessRequests = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_gdpr_data_access_requests_total",
			Help: "Total number of GDPR data access requests (Art. 15)",
		},
		[]string{"outcome"}, // outcome: granted|denied
	)

	GDPRDataDeletionRequests = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_gdpr_data_deletion_requests_total",
			Help: "Total number of GDPR data deletion requests (Art. 17)",
		},
		[]string{"status"}, // status: completed|pending|failed
	)

	GDPRConsentEvents = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_gdpr_consent_events_total",
			Help: "Total number of GDPR consent events (Art. 7)",
		},
		[]string{"action"}, // action: granted|revoked|updated
	)

	// FedRAMP Specific Metrics
	FedRAMPAuditEvents = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_fedramp_audit_events_total",
			Help: "Total number of FedRAMP audit events (AU-2)",
		},
		[]string{"event_type"}, // event_type: access|change|admin
	)

	FedRAMPAccessControlDecisions = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "betrace_fedramp_access_control_decisions_total",
			Help: "Total number of FedRAMP access control decisions (AC-3)",
		},
		[]string{"outcome"},
	)

	// Performance Metrics
	MemoryUsageBytes = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "betrace_memory_usage_bytes",
			Help: "Memory usage of BeTrace components",
		},
		[]string{"component"}, // component: rule_engine|span_context|ast_cache
	)

	GoroutinesActive = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "betrace_goroutines_active",
			Help: "Number of active goroutines in BeTrace",
		},
	)

	GCPauseDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "betrace_gc_pause_duration_seconds",
			Help:    "Duration of garbage collection pauses",
			Buckets: prometheus.ExponentialBuckets(0.00001, 2, 20), // 10μs to 10s
		},
	)
)
