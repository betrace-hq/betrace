package observability

import (
	"context"
	"log"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// ComplianceSpan represents a compliance evidence span to be emitted
type ComplianceSpan struct {
	ControlID string
	EventType string
	Metadata  map[string]interface{}
	Timestamp time.Time
}

// AsyncEmitter provides non-blocking compliance span emission
type AsyncEmitter struct {
	buffer chan ComplianceSpan
	wg     sync.WaitGroup
	ctx    context.Context
	cancel context.CancelFunc
}

// NewAsyncEmitter creates a new async compliance span emitter
func NewAsyncEmitter(bufferSize int) *AsyncEmitter {
	ctx, cancel := context.WithCancel(context.Background())
	return &AsyncEmitter{
		buffer: make(chan ComplianceSpan, bufferSize),
		ctx:    ctx,
		cancel: cancel,
	}
}

// Start begins the background worker that exports spans
func (e *AsyncEmitter) Start() {
	e.wg.Add(1)
	go func() {
		defer e.wg.Done()
		for {
			select {
			case span := <-e.buffer:
				e.exportSpan(span)
			case <-e.ctx.Done():
				// Drain buffer before exit
				e.drainBuffer()
				return
			}
		}
	}()
	log.Println("✓ Async telemetry emitter started (buffer size: 1000)")
}

// EmitComplianceEvidence queues a compliance span for async export
// This is non-blocking - if buffer is full, span is dropped with warning
func (e *AsyncEmitter) EmitComplianceEvidence(ctx context.Context, control ComplianceControl, eventType string, metadata map[string]interface{}) {
	span := ComplianceSpan{
		ControlID: control.ControlID,
		EventType: eventType,
		Metadata:  metadata,
		Timestamp: time.Now(),
	}

	select {
	case e.buffer <- span:
		// Span buffered successfully (fast path)
	default:
		// Buffer full - log warning and drop span
		// This prevents blocking the request path
		log.Printf("⚠️ Compliance span buffer full, dropping span: %s/%s", control.ControlID, eventType)
	}
}

// Stop gracefully shuts down the emitter, draining the buffer
func (e *AsyncEmitter) Stop() {
	e.cancel()
	e.wg.Wait()
	log.Println("✓ Async telemetry emitter stopped")
}

// drainBuffer attempts to export all buffered spans within timeout
func (e *AsyncEmitter) drainBuffer() {
	timeout := time.After(5 * time.Second)
	drained := 0

	for {
		select {
		case span := <-e.buffer:
			e.exportSpan(span)
			drained++
		case <-timeout:
			remaining := len(e.buffer)
			if remaining > 0 {
				log.Printf("⚠️ Timeout draining compliance spans, %d spans dropped", remaining)
			}
			log.Printf("✓ Drained %d compliance spans before shutdown", drained)
			return
		default:
			// Buffer empty
			log.Printf("✓ Drained %d compliance spans before shutdown", drained)
			return
		}
	}
}

// exportSpan exports a single compliance span to OpenTelemetry
func (e *AsyncEmitter) exportSpan(span ComplianceSpan) {
	// Use the existing Tracer to emit the span
	_, otSpan := Tracer.Start(context.Background(), "compliance.evidence")
	defer otSpan.End()

	// Add compliance attributes
	otSpan.SetAttributes(
		attribute.String("compliance.control_id", span.ControlID),
		attribute.String("compliance.event_type", span.EventType),
		attribute.Int64("compliance.timestamp", span.Timestamp.Unix()),
	)

	// Add metadata as attributes
	for key, value := range span.Metadata {
		switch v := value.(type) {
		case string:
			otSpan.SetAttributes(attribute.String("compliance."+key, v))
		case int:
			otSpan.SetAttributes(attribute.Int("compliance."+key, v))
		case bool:
			otSpan.SetAttributes(attribute.Bool("compliance."+key, v))
		default:
			// Skip unsupported types
		}
	}

	// Record compliance event
	otSpan.AddEvent("compliance_evidence_recorded", trace.WithAttributes(
		attribute.String("control_id", span.ControlID),
		attribute.String("event_type", span.EventType),
	))
}

// BufferSize returns the current number of buffered spans
func (e *AsyncEmitter) BufferSize() int {
	return len(e.buffer)
}

// BufferCapacity returns the maximum buffer capacity
func (e *AsyncEmitter) BufferCapacity() int {
	return cap(e.buffer)
}
