package models

import (
	"fmt"
	"time"
)

// Span represents an OpenTelemetry span
type Span struct {
	SpanID        string            `json:"spanId"`
	TraceID       string            `json:"traceId"`
	ParentSpanID  string            `json:"parentSpanId,omitempty"`
	OperationName string            `json:"operationName"`
	ServiceName   string            `json:"serviceName"`
	StartTime     time.Time         `json:"startTime"`
	EndTime       time.Time         `json:"endTime,omitempty"`
	Duration      int64             `json:"duration"` // nanoseconds
	Attributes    map[string]string `json:"attributes"`
	Status        string            `json:"status"` // OK, ERROR
}

// SpanLimits defines validation limits for spans
type SpanLimits struct {
	MaxAttributesPerSpan    int
	MaxAttributeKeyLength   int
	MaxAttributeValueLength int
}

// Validate checks if span meets configured limits
func (s *Span) Validate(limits SpanLimits) error {
	// Check attribute count
	if len(s.Attributes) > limits.MaxAttributesPerSpan {
		return fmt.Errorf("span has %d attributes, exceeds limit of %d", len(s.Attributes), limits.MaxAttributesPerSpan)
	}

	// Check attribute key/value lengths
	for key, value := range s.Attributes {
		if len(key) > limits.MaxAttributeKeyLength {
			return fmt.Errorf("attribute key '%s' length %d exceeds limit of %d bytes", key, len(key), limits.MaxAttributeKeyLength)
		}
		if len(value) > limits.MaxAttributeValueLength {
			return fmt.Errorf("attribute value for key '%s' length %d exceeds limit of %d bytes", key, len(value), limits.MaxAttributeValueLength)
		}
	}

	return nil
}
