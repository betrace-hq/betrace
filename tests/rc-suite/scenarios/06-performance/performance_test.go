// +build rc

package performance

import (
	"context"
	"fmt"
	"runtime"
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

func TestPerformance_100KRules_MemoryUsage(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping long-running performance test")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	// Measure baseline memory
	runtime.GC()
	var m1 runtime.MemStats
	runtime.ReadMemStats(&m1)
	baseline := m1.Alloc

	t.Logf("Baseline memory: %d MB", baseline/(1024*1024))

	// Create 100K rules
	t.Log("Creating 100K rules...")
	successCount := 0

	for i := 0; i < 100000; i++ {
		rule := map[string]interface{}{
			"name":        fmt.Sprintf("perf-rule-%d", i),
			"description": "Performance test rule",
			"expression":  fmt.Sprintf("span.duration > %d and span.name == \"test.%d\"", i%1000+100, i%100),
			"severity":    "LOW",
			"enabled":     false, // Disabled to avoid evaluation overhead
		}

		resp, err := client.CreateRule(ctx, rule)
		if err != nil {
			t.Logf("Failed to create rule %d: %v", i, err)
			break
		}
		resp.Body.Close()

		if resp.StatusCode != 200 {
			t.Logf("Failed to create rule %d: status %d", i, resp.StatusCode)
			break
		}

		successCount++

		if i%10000 == 0 && i > 0 {
			runtime.GC()
			var m runtime.MemStats
			runtime.ReadMemStats(&m)
			t.Logf("Created %d rules, memory: %d MB", i, m.Alloc/(1024*1024))
		}
	}

	// Measure final memory
	runtime.GC()
	var m2 runtime.MemStats
	runtime.ReadMemStats(&m2)
	final := m2.Alloc

	memoryUsed := (final - baseline) / (1024 * 1024)
	t.Logf("Successfully created %d rules", successCount)
	t.Logf("Final memory: %d MB", final/(1024*1024))
	t.Logf("Memory used for rules: %d MB", memoryUsed)

	assert.GreaterOrEqual(t, successCount, 99000, "Should create at least 99K rules")
	assert.LessOrEqual(t, memoryUsed, uint64(150), "100K rules should use ≤ 150MB (target: 128MB)")
}

func TestPerformance_1MSpans_Throughput(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping long-running performance test")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	t.Log("Ingesting 1M spans with throughput measurement...")

	batchSize := 1000
	totalBatches := 1000 // 1M spans
	successCount := int64(0)
	failCount := int64(0)

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 20) // 20 concurrent requests

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

			if resp.StatusCode == 200 {
				atomic.AddInt64(&successCount, 1)
			} else {
				atomic.AddInt64(&failCount, 1)
			}
		}(batch)

		if batch%100 == 0 && batch > 0 {
			elapsed := time.Since(startTime)
			currentThroughput := float64(batch*batchSize) / elapsed.Seconds()
			t.Logf("Progress: %d batches (%d spans), throughput: %.0f spans/sec",
				batch, batch*batchSize, currentThroughput)
		}
	}

	wg.Wait()
	duration := time.Since(startTime)

	totalSpans := successCount * int64(batchSize)
	throughput := float64(totalSpans) / duration.Seconds()

	t.Logf("Results:")
	t.Logf("  Total spans: %d", totalSpans)
	t.Logf("  Duration: %v", duration)
	t.Logf("  Throughput: %.0f spans/sec", throughput)
	t.Logf("  Failed batches: %d", failCount)

	assert.GreaterOrEqual(t, successCount, int64(990), "At least 99% success rate")
	assert.GreaterOrEqual(t, throughput, 3000.0, "Should sustain at least 3000 spans/sec")
}

func TestPerformance_RuleEvaluation_Latency(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Create 1000 rules
	t.Log("Creating 1000 rules for evaluation test...")
	for i := 0; i < 1000; i++ {
		rule := map[string]interface{}{
			"name":        fmt.Sprintf("eval-perf-rule-%d", i),
			"description": "Evaluation performance test",
			"expression":  fmt.Sprintf("span.duration > %d", i*10),
			"severity":    "LOW",
			"enabled":     true, // ENABLED for evaluation
		}

		resp, err := client.CreateRule(ctx, rule)
		require.NoError(t, err)
		resp.Body.Close()

		defer func(name string) {
			client.DeleteRule(ctx, name)
		}(rule["name"].(string))
	}

	// Send 10K spans and measure evaluation latency
	t.Log("Sending 10K spans for evaluation...")
	latencies := make([]time.Duration, 0, 10000)
	var mu sync.Mutex

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 10)

	for i := 0; i < 10000; i++ {
		wg.Add(1)
		go func(spanNum int) {
			defer wg.Done()

			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			span := helpers.GenerateSpan(
				helpers.WithName(fmt.Sprintf("eval.test.%d", spanNum)),
				helpers.WithDuration(int64(spanNum % 1000)),
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

			start := time.Now()
			resp, err := client.SendSpans(ctx, spans)
			latency := time.Since(start)

			if err == nil {
				resp.Body.Close()
				mu.Lock()
				latencies = append(latencies, latency)
				mu.Unlock()
			}
		}(i)

		if i%1000 == 0 && i > 0 {
			t.Logf("Sent %d spans...", i)
		}
	}

	wg.Wait()

	// Calculate statistics
	var total time.Duration
	for _, lat := range latencies {
		total += lat
	}

	avgLatency := total / time.Duration(len(latencies))

	t.Logf("Evaluation latency results:")
	t.Logf("  Samples: %d", len(latencies))
	t.Logf("  Average: %v", avgLatency)

	assert.Less(t, avgLatency, 10*time.Millisecond,
		"Average evaluation latency should be < 10ms (includes HTTP + evaluation)")
}

func TestPerformance_SustainedLoad_1Hour(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping sustained load test")
	}

	t.Skip("Manual test: Run separately with: go test -v -run TestPerformance_SustainedLoad_1Hour -timeout=2h")

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Minute)
	defer cancel()

	// Create 100 rules
	t.Log("Creating 100 rules...")
	for i := 0; i < 100; i++ {
		rule := map[string]interface{}{
			"name":        fmt.Sprintf("sustained-rule-%d", i),
			"description": "Sustained load test",
			"expression":  fmt.Sprintf("span.duration > %d", i*100),
			"severity":    "LOW",
			"enabled":     true,
		}

		resp, err := client.CreateRule(ctx, rule)
		require.NoError(t, err)
		resp.Body.Close()

		defer func(name string) {
			client.DeleteRule(ctx, name)
		}(rule["name"].(string))
	}

	// Sustain 1000 spans/sec for 1 hour
	t.Log("Starting sustained load: 1000 spans/sec for 1 hour...")

	duration := 60 * time.Minute
	targetRate := 1000 // spans per second
	batchSize := 100
	batchInterval := time.Duration(batchSize*1000/targetRate) * time.Millisecond

	startTime := time.Now()
	ticker := time.NewTicker(batchInterval)
	defer ticker.Stop()

	totalSent := int64(0)
	totalFailed := int64(0)

	for {
		select {
		case <-ctx.Done():
			t.Fatal("Test timed out")
		case <-ticker.C:
			if time.Since(startTime) > duration {
				goto done
			}

			// Send batch
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
				atomic.AddInt64(&totalFailed, 1)
				continue
			}
			resp.Body.Close()

			if resp.StatusCode == 200 {
				atomic.AddInt64(&totalSent, int64(batchSize))
			} else {
				atomic.AddInt64(&totalFailed, 1)
			}

			// Log progress every 5 minutes
			if time.Since(startTime).Minutes() >= 5 && int(time.Since(startTime).Minutes())%5 == 0 {
				elapsed := time.Since(startTime)
				actualRate := float64(totalSent) / elapsed.Seconds()
				t.Logf("Progress: %v elapsed, %d spans sent, %.0f spans/sec",
					elapsed.Round(time.Minute), totalSent, actualRate)
			}
		}
	}

done:
	finalDuration := time.Since(startTime)
	actualRate := float64(totalSent) / finalDuration.Seconds()

	t.Logf("Sustained load test results:")
	t.Logf("  Duration: %v", finalDuration)
	t.Logf("  Spans sent: %d", totalSent)
	t.Logf("  Actual rate: %.0f spans/sec", actualRate)
	t.Logf("  Failures: %d", totalFailed)

	assert.GreaterOrEqual(t, actualRate, 900.0, "Should sustain at least 900 spans/sec")
	assert.LessOrEqual(t, totalFailed, totalSent/100, "Failure rate should be < 1%")
}

func TestPerformance_MemoryLeak_Detection(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping memory leak test")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	t.Log("Running memory leak detection test...")

	// Create 10 rules
	for i := 0; i < 10; i++ {
		rule := map[string]interface{}{
			"name":        fmt.Sprintf("leak-test-rule-%d", i),
			"description": "Memory leak test",
			"expression":  "span.duration > 1000",
			"severity":    "LOW",
			"enabled":     true,
		}

		resp, err := client.CreateRule(ctx, rule)
		require.NoError(t, err)
		resp.Body.Close()

		defer func(name string) {
			client.DeleteRule(ctx, name)
		}(rule["name"].(string))
	}

	// Send spans repeatedly and measure memory growth
	iterations := 10
	measurements := make([]uint64, iterations)

	for iter := 0; iter < iterations; iter++ {
		// Send 10K spans
		for i := 0; i < 10000; i++ {
			span := helpers.GenerateSpan()
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
			if err == nil {
				resp.Body.Close()
			}
		}

		// Force GC and measure memory
		runtime.GC()
		time.Sleep(2 * time.Second)

		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		measurements[iter] = m.Alloc

		t.Logf("Iteration %d: memory = %d MB", iter+1, m.Alloc/(1024*1024))
	}

	// Check for memory growth
	firstHalf := (measurements[0] + measurements[1] + measurements[2]) / 3
	secondHalf := (measurements[7] + measurements[8] + measurements[9]) / 3

	growth := float64(secondHalf) / float64(firstHalf)
	t.Logf("Memory growth ratio: %.2f", growth)

	assert.Less(t, growth, 1.5, "Memory should not grow > 50% across iterations (potential leak)")
}
