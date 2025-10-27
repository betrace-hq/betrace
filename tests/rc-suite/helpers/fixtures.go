// +build rc

package helpers

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

// RuleFixture represents a test rule
type RuleFixture struct {
	Name        string
	Description string
	Expression  string
	Severity    string
	Tags        []string
	Enabled     bool
	ShouldFail  bool // For negative testing
}

// ValidRules returns various valid rule patterns
func ValidRules() []RuleFixture {
	return []RuleFixture{
		{
			Name:        "simple-duration",
			Description: "Detect slow requests",
			Expression:  "span.duration > 1000",
			Severity:    "HIGH",
			Tags:        []string{"performance"},
			Enabled:     true,
		},
		{
			Name:        "error-detection",
			Description: "Detect error responses",
			Expression:  `span.status == "error"`,
			Severity:    "CRITICAL",
			Tags:        []string{"errors", "alerts"},
			Enabled:     true,
		},
		{
			Name:        "multi-condition",
			Description: "Complex rule with AND/OR",
			Expression:  `(span.duration > 500 and span.name == "db.query") or span.status == "error"`,
			Severity:    "MEDIUM",
			Tags:        []string{"database", "performance"},
			Enabled:     true,
		},
		{
			Name:        "attribute-matching",
			Description: "Match specific attribute values",
			Expression:  `span.attributes["http.status_code"] == "500"`,
			Severity:    "HIGH",
			Tags:        []string{"http", "errors"},
			Enabled:     true,
		},
		{
			Name:        "grouping-pattern",
			Description: "Multi-span trace pattern",
			Expression:  `trace.has(span.name == "auth") and trace.has(span.name == "database")`,
			Severity:    "LOW",
			Tags:        []string{"security", "audit"},
			Enabled:     true,
		},
	}
}

// InvalidRules returns rules that should fail validation
func InvalidRules() []RuleFixture {
	return []RuleFixture{
		{
			Name:        "syntax-error",
			Description: "Invalid syntax",
			Expression:  "span.duration > > 1000", // Double operator
			Severity:    "HIGH",
			ShouldFail:  true,
		},
		{
			Name:        "oversized-expression",
			Description: "Expression exceeds 64KB limit",
			Expression:  generateLargeExpression(70000), // Exceeds 64KB limit
			Severity:    "HIGH",
			ShouldFail:  true,
		},
		{
			Name:        string(make([]byte, 300)), // Name exceeds 256 byte limit
			Description: "Name too long",
			Expression:  "span.duration > 1000",
			Severity:    "HIGH",
			ShouldFail:  true,
		},
		{
			Name:        "invalid-field",
			Description: "Reference non-existent field",
			Expression:  "span.nonexistent_field > 100",
			Severity:    "HIGH",
			ShouldFail:  false, // Parser may accept, runtime may fail
		},
	}
}

// EnterpriseScaleRule returns a realistic complex enterprise rule
func EnterpriseScaleRule() RuleFixture {
	return RuleFixture{
		Name:        "enterprise-compliance-check",
		Description: "SOC2 compliance pattern with multiple conditions",
		Expression: `
			(span.name == "user.login" and span.attributes["auth.method"] == "mfa") and
			trace.has(span.name == "audit.log") and
			trace.has(span.name == "security.check") and
			(span.duration < 5000 or span.attributes["retry.count"] < "3") and
			span.attributes["tenant.id"] != "" and
			span.status != "error"
		`,
		Severity: "CRITICAL",
		Tags:     []string{"compliance", "soc2", "audit"},
		Enabled:  true,
	}
}

// SpanFixture represents a test span
type SpanFixture struct {
	TraceID    string            `json:"traceId"`
	SpanID     string            `json:"spanId"`
	ParentID   string            `json:"parentSpanId,omitempty"`
	Name       string            `json:"name"`
	StartTime  int64             `json:"startTime,omitempty"`
	EndTime    int64             `json:"endTime,omitempty"`
	DurationMs int64             `json:"durationMs,omitempty"`
	Status     string            `json:"status,omitempty"`
	Attributes map[string]string `json:"attributes,omitempty"`
}

// GenerateSpan creates a span with optional customization
func GenerateSpan(opts ...func(*SpanFixture)) SpanFixture {
	now := time.Now()
	span := SpanFixture{
		TraceID:   uuid.New().String(),
		SpanID:    uuid.New().String(),
		Name:      "test.span",
		StartTime: now.UnixNano(),
		EndTime:   now.Add(100 * time.Millisecond).UnixNano(),
		Status:    "ok",
		Attributes: map[string]string{
			"service.name": "test-service",
		},
	}

	for _, opt := range opts {
		opt(&span)
	}

	return span
}

// WithName sets span name
func WithName(name string) func(*SpanFixture) {
	return func(s *SpanFixture) {
		s.Name = name
	}
}

// WithDuration sets span duration
func WithDuration(ms int64) func(*SpanFixture) {
	return func(s *SpanFixture) {
		s.EndTime = s.StartTime + (ms * 1000000) // Convert ms to ns
	}
}

// WithStatus sets span status
func WithStatus(status string) func(*SpanFixture) {
	return func(s *SpanFixture) {
		s.Status = status
	}
}

// WithAttribute adds an attribute
func WithAttribute(key, value string) func(*SpanFixture) {
	return func(s *SpanFixture) {
		if s.Attributes == nil {
			s.Attributes = make(map[string]string)
		}
		s.Attributes[key] = value
	}
}

// WithTraceID sets trace ID (for multi-span traces)
func WithTraceID(traceID string) func(*SpanFixture) {
	return func(s *SpanFixture) {
		s.TraceID = traceID
	}
}

// WithParentID sets parent span ID
func WithParentID(parentID string) func(*SpanFixture) {
	return func(s *SpanFixture) {
		s.ParentID = parentID
	}
}

// GenerateSpanBatch creates a batch of spans
func GenerateSpanBatch(count int, opts ...func(*SpanFixture)) []SpanFixture {
	spans := make([]SpanFixture, count)
	for i := 0; i < count; i++ {
		spans[i] = GenerateSpan(opts...)
	}
	return spans
}

// GenerateTrace creates a multi-span trace
func GenerateTrace(spanNames []string) []SpanFixture {
	traceID := uuid.New().String()
	spans := make([]SpanFixture, len(spanNames))

	var parentID string
	for i, name := range spanNames {
		span := GenerateSpan(
			WithName(name),
			WithTraceID(traceID),
		)
		if parentID != "" {
			span.ParentID = parentID
		}
		parentID = span.SpanID
		spans[i] = span
	}

	return spans
}

// GenerateMalformedSpans returns spans with various issues
func GenerateMalformedSpans() []map[string]interface{} {
	return []map[string]interface{}{
		{
			// Missing required fields
			"name": "incomplete-span",
		},
		{
			// Invalid timestamp
			"traceId":   uuid.New().String(),
			"spanId":    uuid.New().String(),
			"name":      "invalid-time",
			"startTime": "not-a-number",
			"endTime":   time.Now().UnixNano(),
		},
		{
			// Too many attributes (>128)
			"traceId":    uuid.New().String(),
			"spanId":     uuid.New().String(),
			"name":       "too-many-attrs",
			"startTime":  time.Now().UnixNano(),
			"endTime":    time.Now().Add(100 * time.Millisecond).UnixNano(),
			"attributes": generateTooManyAttributes(150),
		},
	}
}

// generateLargeExpression creates an expression of specified byte size
func generateLargeExpression(size int) string {
	expr := "span.duration > 1000"
	for len(expr) < size {
		expr += " and span.duration > 1000"
	}
	return expr
}

// generateTooManyAttributes creates more attributes than allowed
func generateTooManyAttributes(count int) map[string]string {
	attrs := make(map[string]string)
	for i := 0; i < count; i++ {
		attrs[fmt.Sprintf("attr_%d", i)] = fmt.Sprintf("value_%d", i)
	}
	return attrs
}

// RandomDelay adds random jitter for sporadic testing
func RandomDelay(minMs, maxMs int) {
	delay := time.Duration(rand.Intn(maxMs-minMs)+minMs) * time.Millisecond
	time.Sleep(delay)
}
