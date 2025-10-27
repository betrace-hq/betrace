package services

import (
	"context"
	"sync"
	"time"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// TraceBuffer buffers spans by trace_id and triggers evaluation when traces complete
type TraceBuffer struct {
	mu sync.RWMutex

	// traces maps trace_id -> list of spans
	traces map[string][]*models.Span

	// lastActivity maps trace_id -> last span received time
	lastActivity map[string]time.Time

	// completionTimeout is how long to wait after last span before considering trace complete
	completionTimeout time.Duration

	// onTraceComplete is called when a trace is considered complete
	onTraceComplete func(ctx context.Context, traceID string, spans []*models.Span)

	// stopCh is used to signal the cleanup goroutine to stop
	stopCh chan struct{}
}

// NewTraceBuffer creates a new trace buffer
func NewTraceBuffer(completionTimeout time.Duration, onTraceComplete func(ctx context.Context, traceID string, spans []*models.Span)) *TraceBuffer {
	tb := &TraceBuffer{
		traces:            make(map[string][]*models.Span),
		lastActivity:      make(map[string]time.Time),
		completionTimeout: completionTimeout,
		onTraceComplete:   onTraceComplete,
		stopCh:            make(chan struct{}),
	}

	// Start background goroutine to detect completed traces
	go tb.cleanupLoop()

	return tb
}

// AddSpan adds a span to the trace buffer
func (tb *TraceBuffer) AddSpan(span *models.Span) {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	traceID := span.TraceID
	tb.traces[traceID] = append(tb.traces[traceID], span)
	tb.lastActivity[traceID] = time.Now()
}

// cleanupLoop runs in background and detects completed traces
func (tb *TraceBuffer) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			tb.checkCompletedTraces()
		case <-tb.stopCh:
			return
		}
	}
}

// checkCompletedTraces finds traces that haven't received spans recently and marks them complete
func (tb *TraceBuffer) checkCompletedTraces() {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	var completedTraces []string

	for traceID, lastActivity := range tb.lastActivity {
		if now.Sub(lastActivity) >= tb.completionTimeout {
			completedTraces = append(completedTraces, traceID)
		}
	}

	// Process completed traces
	for _, traceID := range completedTraces {
		spans := tb.traces[traceID]
		delete(tb.traces, traceID)
		delete(tb.lastActivity, traceID)

		// Call completion callback (outside lock to avoid deadlock)
		if tb.onTraceComplete != nil {
			go tb.onTraceComplete(context.Background(), traceID, spans)
		}
	}
}

// Stop stops the trace buffer's background goroutine
func (tb *TraceBuffer) Stop() {
	close(tb.stopCh)
}

// GetTrace returns all spans for a trace (mainly for testing)
func (tb *TraceBuffer) GetTrace(traceID string) []*models.Span {
	tb.mu.RLock()
	defer tb.mu.RUnlock()
	return tb.traces[traceID]
}
