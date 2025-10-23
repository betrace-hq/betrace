package models

import "time"

// Violation represents a rule violation detected in telemetry traces
type Violation struct {
	ID          string    `json:"id"`
	RuleID      string    `json:"ruleId"`
	RuleName    string    `json:"ruleName"`
	Severity    string    `json:"severity"` // HIGH, MEDIUM, LOW
	Message     string    `json:"message"`
	TraceIDs    []string  `json:"traceIds"`
	SpanRefs    []SpanRef `json:"spanReferences"`
	CreatedAt   time.Time `json:"createdAt"`
	Signature   string    `json:"signature"` // HMAC-SHA256
}

// SpanRef references a specific span involved in the violation
type SpanRef struct {
	TraceID     string `json:"traceId"`
	SpanID      string `json:"spanId"`
	ServiceName string `json:"serviceName"`
}
