// +build rc

package span_ingestion

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/betracehq/betrace/tests/rc-suite/helpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	backendURL  = "http://localhost:12011"
	backendGRPC = "localhost:12012"
)

func TestSpanIngestion_SingleSpan(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	span := helpers.GenerateSpan(
		helpers.WithName("test.operation"),
		helpers.WithDuration(150),
		helpers.WithStatus("ok"),
	)

	spans := []map[string]interface{}{
		{
			"traceId":    span.TraceID,
			"spanId":     span.SpanID,
			"name":       span.Name,
			"startTime":  span.StartTime,
			"endTime":    span.EndTime,
			"status":     span.Status,
			"attributes": span.Attributes,
		},
	}

	resp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Single span should be ingested")
}

func TestSpanIngestion_BatchSmall(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Generate 100 spans
	spanFixtures := helpers.GenerateSpanBatch(100)
	spans := make([]map[string]interface{}, len(spanFixtures))
	for i, span := range spanFixtures {
		spans[i] = map[string]interface{}{
			"traceId":    span.TraceID,
			"spanId":     span.SpanID,
			"name":       span.Name,
			"startTime":  span.StartTime,
			"endTime":    span.EndTime,
			"status":     span.Status,
			"attributes": span.Attributes,
		}
	}

	resp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Batch of 100 spans should be ingested")
}

func TestSpanIngestion_HighVolume(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping high-volume test in short mode")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	t.Log("Ingesting 1M spans in batches of 1000...")

	batchSize := 1000
	totalBatches := 1000 // 1M spans total
	successCount := int64(0)
	failCount := int64(0)

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 10) // Limit concurrent requests

	startTime := time.Now()

	for batch := 0; batch < totalBatches; batch++ {
		wg.Add(1)
		go func(batchNum int) {
			defer wg.Done()

			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			spanFixtures := helpers.GenerateSpanBatch(batchSize)
			spans := make([]map[string]interface{}, len(spanFixtures))
			for i, span := range spanFixtures {
				spans[i] = map[string]interface{}{
					"traceId":    span.TraceID,
					"spanId":     span.SpanID,
					"name":       span.Name,
					"startTime":  span.StartTime,
					"endTime":    span.EndTime,
					"status":     span.Status,
					"attributes": span.Attributes,
				}
			}

			resp, err := client.SendSpans(ctx, spans)
			if err != nil {
				atomic.AddInt64(&failCount, 1)
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode == http.StatusOK {
				atomic.AddInt64(&successCount, 1)
			} else {
				atomic.AddInt64(&failCount, 1)
			}

			if batchNum%100 == 0 {
				t.Logf("Processed %d batches (%d spans)...", batchNum, batchNum*batchSize)
			}
		}(batch)
	}

	wg.Wait()
	duration := time.Since(startTime)

	t.Logf("Ingested %d batches (%d spans) in %v", successCount, successCount*int64(batchSize), duration)
	t.Logf("Failed batches: %d", failCount)
	t.Logf("Throughput: %.2f spans/sec", float64(successCount*int64(batchSize))/duration.Seconds())

	assert.GreaterOrEqual(t, successCount, int64(990), "At least 99% of batches should succeed")
	assert.LessOrEqual(t, duration, 6*time.Minute, "Should complete within 6 minutes")
}

func TestSpanIngestion_Sporadic(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping sporadic test in short mode")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	t.Log("Sending 1 span per 5 seconds for 2 minutes...")

	duration := 2 * time.Minute
	interval := 5 * time.Second
	startTime := time.Now()
	count := 0

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			t.Fatal("Test timed out")
		case <-ticker.C:
			if time.Since(startTime) > duration {
				goto done
			}

			span := helpers.GenerateSpan(
				helpers.WithName(fmt.Sprintf("sporadic.span.%d", count)),
			)

			spans := []map[string]interface{}{
				{
					"traceId":    span.TraceID,
					"spanId":     span.SpanID,
					"name":       span.Name,
					"startTime":  span.StartTime,
					"endTime":    span.EndTime,
					"status":     span.Status,
					"attributes": span.Attributes,
				},
			}

			resp, err := client.SendSpans(ctx, spans)
			require.NoError(t, err)
			resp.Body.Close()

			assert.Equal(t, http.StatusOK, resp.StatusCode)
			count++
		}
	}

done:
	t.Logf("Successfully sent %d sporadic spans", count)
	assert.GreaterOrEqual(t, count, 20, "Should send at least 20 spans")
}

func TestSpanIngestion_Malformed(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	malformed := helpers.GenerateMalformedSpans()

	for i, span := range malformed {
		t.Run(fmt.Sprintf("malformed-%d", i), func(t *testing.T) {
			resp, err := client.SendSpans(ctx, []map[string]interface{}{span})
			require.NoError(t, err)
			defer resp.Body.Close()

			assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
				"Malformed span should be rejected with 4xx error")
		})
	}
}

func TestSpanIngestion_OversizedBody(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create a span with huge attributes (>10MB total body)
	largeValue := strings.Repeat("x", 11*1024*1024) // 11MB string
	span := helpers.GenerateSpan(
		helpers.WithAttribute("large_field", largeValue),
	)

	spans := []map[string]interface{}{
		{
			"traceId":    span.TraceID,
			"spanId":     span.SpanID,
			"name":       span.Name,
			"startTime":  span.StartTime,
			"endTime":    span.EndTime,
			"status":     span.Status,
			"attributes": span.Attributes,
		},
	}

	resp, err := client.SendSpans(ctx, spans)
	if err != nil {
		// Connection may be closed by server
		assert.Contains(t, err.Error(), "EOF", "Should get connection error for oversized body")
		return
	}
	defer resp.Body.Close()

	assert.Equal(t, http.StatusRequestEntityTooLarge, resp.StatusCode,
		"Oversized body should be rejected")
}

func TestSpanIngestion_TooManyAttributes(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create span with 150 attributes (exceeds 128 limit)
	span := helpers.GenerateSpan()
	span.Attributes = make(map[string]string)
	for i := 0; i < 150; i++ {
		span.Attributes[fmt.Sprintf("attr_%d", i)] = fmt.Sprintf("value_%d", i)
	}

	spans := []map[string]interface{}{
		{
			"traceId":    span.TraceID,
			"spanId":     span.SpanID,
			"name":       span.Name,
			"startTime":  span.StartTime,
			"endTime":    span.EndTime,
			"status":     span.Status,
			"attributes": span.Attributes,
		},
	}

	resp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode,
		"Span with too many attributes should be rejected")
}

func TestSpanIngestion_OutOfOrder(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create spans with timestamps out of order
	now := time.Now()
	spans := []map[string]interface{}{
		{
			"traceId":   "trace-1",
			"spanId":    "span-3",
			"name":      "third",
			"startTime": now.Add(20 * time.Second).UnixNano(),
			"endTime":   now.Add(21 * time.Second).UnixNano(),
			"status":    "ok",
		},
		{
			"traceId":   "trace-1",
			"spanId":    "span-1",
			"name":      "first",
			"startTime": now.UnixNano(),
			"endTime":   now.Add(1 * time.Second).UnixNano(),
			"status":    "ok",
		},
		{
			"traceId":   "trace-1",
			"spanId":    "span-2",
			"name":      "second",
			"startTime": now.Add(10 * time.Second).UnixNano(),
			"endTime":   now.Add(11 * time.Second).UnixNano(),
			"status":    "ok",
		},
	}

	resp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode,
		"Out-of-order spans should be accepted (backend handles ordering)")
}

func TestSpanIngestion_DuplicateSpanIDs(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	spanID := "duplicate-span-id"
	spans := []map[string]interface{}{
		{
			"traceId":   "trace-1",
			"spanId":    spanID,
			"name":      "duplicate-1",
			"startTime": time.Now().UnixNano(),
			"endTime":   time.Now().Add(100 * time.Millisecond).UnixNano(),
			"status":    "ok",
		},
		{
			"traceId":   "trace-1",
			"spanId":    spanID, // Same span ID
			"name":      "duplicate-2",
			"startTime": time.Now().UnixNano(),
			"endTime":   time.Now().Add(100 * time.Millisecond).UnixNano(),
			"status":    "ok",
		},
	}

	resp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Behavior depends on implementation:
	// - Accept and deduplicate (idempotent)
	// - Reject as invalid
	// Both are valid responses
	if resp.StatusCode != http.StatusOK {
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode,
			"Duplicate span IDs should either be deduplicated or rejected")
	}
}
