package models

import "time"

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
