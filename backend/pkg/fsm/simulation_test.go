package fsm

import (
	"sync"
	"testing"
	"time"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// TestTraceLifecycleFSM_SimulationFuzzing runs deterministic simulation testing
// to find edge cases and race conditions in the FSM
func TestTraceLifecycleFSM_SimulationFuzzing(t *testing.T) {
	seed := getSimulationSeed(t)
	t.Logf("🎲 Running simulation fuzzing with seed=%d", seed)

	const iterations = 1000
	bugs := make([]string, 0)

	for i := 0; i < iterations; i++ {
		// Create new FSM for each iteration
		fsm := NewTraceLifecycleFSM("trace-123")
		rand := NewDeterministicRand(seed + int64(i))

		// Simulate random operations
		operations := rand.Intn(50) + 10 // 10-60 operations

		for op := 0; op < operations; op++ {
			action := rand.Intn(3)

			switch action {
			case 0: // Add span
				span := &models.Span{
					SpanID:  randSpanID(rand),
					TraceID: "trace-123",
				}
				err := fsm.AddSpan(span)
				// Check invariant: should only fail if evaluating
				if err != nil && fsm.State() != TraceEvaluating && fsm.State() != TraceProcessed {
					bugs = append(bugs, "AddSpan failed in unexpected state")
				}

			case 1: // Try transition
				validEvents := fsm.ValidEvents()
				if len(validEvents) > 0 {
					event := validEvents[rand.Intn(len(validEvents))]
					fsm.Transition(event)
				}

			case 2: // Check state consistency
				spans := fsm.Spans()
				state := fsm.State()

				// Invariant: Processed state should have spans
				if state == TraceProcessed && len(spans) == 0 {
					bugs = append(bugs, "Processed state with zero spans")
				}

				// Invariant: Evaluating should block AddSpan
				if state == TraceEvaluating {
					testSpan := &models.Span{SpanID: "test", TraceID: "trace-123"}
					if err := fsm.AddSpan(testSpan); err == nil {
						bugs = append(bugs, "AddSpan succeeded during evaluation!")
					}
				}
			}
		}
	}

	if len(bugs) > 0 {
		t.Fatalf("Found %d bugs in %d iterations with seed=%d:\n%v", len(bugs), iterations, seed, bugs)
	}

	t.Logf("✅ No bugs found in %d iterations", iterations)
}

// TestTraceLifecycleRegistry_ConcurrentFuzzing tests concurrent operations on registry
func TestTraceLifecycleRegistry_ConcurrentFuzzing(t *testing.T) {
	seed := getSimulationSeed(t)
	t.Logf("🎲 Running concurrent fuzzing with seed=%d", seed)

	registry := NewTraceLifecycleRegistry()

	const goroutines = 10
	const operationsPerGoroutine = 100

	var wg sync.WaitGroup
	inconsistencies := make(chan string, 100)

	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(gid int) {
			defer wg.Done()

			localRand := NewDeterministicRand(seed + int64(gid))

			for op := 0; op < operationsPerGoroutine; op++ {
				traceID := randTraceID(localRand)
				action := localRand.Intn(4)

				switch action {
				case 0: // Get or create FSM
					fsm := registry.Get(traceID)
					if fsm == nil {
						inconsistencies <- "Get returned nil FSM"
					}

				case 1: // Add span
					fsm := registry.Get(traceID)
					span := &models.Span{
						SpanID:  randSpanID(localRand),
						TraceID: traceID,
					}
					fsm.AddSpan(span)

				case 2: // Transition
					fsm := registry.Get(traceID)
					validEvents := fsm.ValidEvents()
					if len(validEvents) > 0 {
						event := validEvents[localRand.Intn(len(validEvents))]
						fsm.Transition(event)
					}

				case 3: // Remove
					// Only remove if in Processed state
					fsm := registry.Get(traceID)
					if fsm.State() == TraceProcessed {
						registry.Remove(traceID)
					}
				}

				// Check invariant: registry count should never be negative
				if registry.Count() < 0 {
					inconsistencies <- "Negative registry count!"
				}
			}
		}(g)
	}

	wg.Wait()
	close(inconsistencies)

	issues := make([]string, 0)
	for issue := range inconsistencies {
		issues = append(issues, issue)
	}

	if len(issues) > 0 {
		t.Fatalf("Found %d inconsistencies with seed=%d:\n%v", len(issues), seed, issues)
	}

	t.Logf("✅ No inconsistencies found (%d goroutines × %d ops = %d total operations)",
		goroutines, operationsPerGoroutine, goroutines*operationsPerGoroutine)
}

// TestTraceLifecycleFSM_ChaosMode injects random failures and delays
func TestTraceLifecycleFSM_ChaosMode(t *testing.T) {
	seed := getChaosSeed(t)
	t.Logf("🎲 Running chaos mode with seed=%d", seed)

	const iterations = 50
	bugs := make([]string, 0)

	for i := 0; i < iterations; i++ {
		fsm := NewTraceLifecycleFSM("trace-123")
		rand := NewDeterministicRand(seed + int64(i))

		// Chaos parameters
		failureProbability := 0.1 // 10% chance of injecting failure
		delayProbability := 0.2   // 20% chance of delay

		operations := rand.Intn(30) + 10

		for op := 0; op < operations; op++ {
			// Inject chaos: random delay
			if rand.Float64() < delayProbability {
				time.Sleep(time.Microsecond * time.Duration(rand.Intn(100)))
			}

			// Inject chaos: operation failure (simulate external error)
			if rand.Float64() < failureProbability {
				// Skip this operation to simulate failure
				continue
			}

			// Normal operation
			action := rand.Intn(3)
			switch action {
			case 0:
				span := &models.Span{SpanID: randSpanID(rand), TraceID: "trace-123"}
				fsm.AddSpan(span)

			case 1:
				validEvents := fsm.ValidEvents()
				if len(validEvents) > 0 {
					fsm.Transition(validEvents[rand.Intn(len(validEvents))])
				}

			case 2:
				// Verify state consistency
				state := fsm.State()
				spans := fsm.Spans()

				// Invariant check
				if state == TraceProcessed && len(spans) == 0 {
					bugs = append(bugs, "Chaos mode: processed with no spans")
				}
			}
		}
	}

	if len(bugs) > 0 {
		t.Fatalf("Chaos mode found %d bugs with seed=%d:\n%v", len(bugs), seed, bugs)
	}

	t.Logf("✅ Survived chaos mode (%d iterations)", iterations)
}

// TestTraceLifecycleFSM_LongRunningSimulation tests FSM under sustained load
func TestTraceLifecycleFSM_LongRunningSimulation(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping long-running simulation in short mode")
	}

	seed := getSimulationSeed(t)
	t.Logf("🎲 Running long simulation with seed=%d", seed)

	registry := NewTraceLifecycleRegistry()
	rand := NewDeterministicRand(seed)

	const duration = 5 * time.Second
	const traceCount = 100

	start := time.Now()
	deadline := start.Add(duration)

	operations := 0
	for time.Now().Before(deadline) {
		traceID := randTraceIDFromPool(rand, traceCount)
		fsm := registry.Get(traceID)

		// Simulate trace lifecycle
		if fsm.State() == TraceReceiving || fsm.State() == TraceComplete {
			span := &models.Span{SpanID: randSpanID(rand), TraceID: traceID}
			fsm.AddSpan(span)
		} else if fsm.State() == TraceProcessed {
			registry.Remove(traceID)
		} else {
			// Try to advance state
			validEvents := fsm.ValidEvents()
			if len(validEvents) > 0 {
				fsm.Transition(validEvents[rand.Intn(len(validEvents))])
			}
		}

		operations++
	}

	elapsed := time.Since(start)
	throughput := float64(operations) / elapsed.Seconds()

	t.Logf("✅ Long simulation completed:")
	t.Logf("   Operations: %d", operations)
	t.Logf("   Duration: %v", elapsed)
	t.Logf("   Throughput: %.0f ops/sec", throughput)
	t.Logf("   Active traces: %d", registry.Count())
}

// Helper functions

func getSimulationSeed(t *testing.T) int64 {
	return getSeedFromEnv(t, "SIMULATION_SEED", 12345)
}

func getChaosSeed(t *testing.T) int64 {
	return getSeedFromEnv(t, "CHAOS_SEED", 54321)
}

func randSpanID(rand *DeterministicRand) string {
	chars := "abcdefghijklmnopqrstuvwxyz0123456789"
	length := 8
	id := make([]byte, length)
	for i := 0; i < length; i++ {
		id[i] = chars[rand.Intn(len(chars))]
	}
	return string(id)
}

func randTraceID(rand *DeterministicRand) string {
	// Generate random trace ID from small pool to create contention
	traceNum := rand.Intn(5) // 0-4
	return "trace-" + string(rune('a'+traceNum))
}

func randTraceIDFromPool(rand *DeterministicRand, poolSize int) string {
	traceNum := rand.Intn(poolSize)
	return "trace-" + string(rune('a'+traceNum%26)) + string(rune('0'+traceNum/26))
}
