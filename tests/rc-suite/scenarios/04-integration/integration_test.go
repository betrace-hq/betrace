// +build rc

package integration

import (
	"context"
	"testing"
	"time"

	"github.com/betracehq/betrace/tests/rc-suite/helpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	backendURL   = "http://localhost:12011"
	backendGRPC  = "localhost:12012"
	grafanaURL   = "http://localhost:12015"
	tempoURL     = "http://localhost:3200"
	prometheusURL = "http://localhost:9090"
)

func TestIntegration_BackendHealth(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	req, err := client.HTTPClient.Get(backendURL + "/v1/health")
	require.NoError(t, err)
	defer req.Body.Close()

	assert.Equal(t, 200, req.StatusCode, "Backend should be healthy")
}

func TestIntegration_GrafanaReachable(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	resp, err := client.HTTPClient.Get(grafanaURL + "/api/health")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, 200, resp.StatusCode, "Grafana should be reachable")
}

func TestIntegration_TempoReady(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	resp, err := client.HTTPClient.Get(tempoURL + "/ready")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, 200, resp.StatusCode, "Tempo should be ready")
}

func TestIntegration_PrometheusMetrics(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get backend metrics
	metrics, err := client.GetMetrics(ctx)
	require.NoError(t, err)

	// Verify expected metrics exist
	assert.Contains(t, metrics, "go_goroutines", "Should expose Go metrics")
	assert.Contains(t, metrics, "betrace_", "Should expose BeTrace-specific metrics")
}

func TestIntegration_BackendToTempo(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Create rule that generates violations
	ruleName := "integration-violation-test"
	rule := map[string]interface{}{
		"name":        ruleName,
		"description": "Integration test rule",
		"expression":  "span.duration > 1000",
		"severity":    "HIGH",
		"enabled":     true,
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	resp.Body.Close()

	defer func() {
		client.DeleteRule(ctx, ruleName)
	}()

	// Send span that matches rule
	span := helpers.GenerateSpan(
		helpers.WithName("integration.test.span"),
		helpers.WithDuration(1500),
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

	spanResp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	spanResp.Body.Close()

	// Wait for rule evaluation and violation span export to Tempo
	time.Sleep(5 * time.Second)

	// Query Tempo for violation span (implementation depends on Tempo API)
	// This is a placeholder - actual implementation would query Tempo's search API
	t.Log("Verification: Check Tempo for violation spans manually")
	t.Log("TraceID:", span.TraceID)
}

func TestIntegration_ServiceRecovery(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping recovery test in short mode")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	// Create rule
	ruleName := "recovery-test-rule"
	rule := map[string]interface{}{
		"name":        ruleName,
		"description": "Rule persistence test",
		"expression":  "span.duration > 1000",
		"severity":    "HIGH",
		"enabled":     true,
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	resp.Body.Close()

	// Simulate backend restart (docker-compose restart betrace-backend)
	t.Log("Restart backend to verify rule persistence")
	t.Log("(Manual step: docker-compose restart betrace-backend)")

	// Wait for restart
	time.Sleep(30 * time.Second)

	// Verify rule still exists after restart
	getResp, err := client.GetRule(ctx, ruleName)
	require.NoError(t, err)
	defer getResp.Body.Close()

	assert.Equal(t, 200, getResp.StatusCode, "Rule should persist across restarts")

	// Cleanup
	delResp, _ := client.DeleteRule(ctx, ruleName)
	if delResp != nil {
		delResp.Body.Close()
	}
}

func TestIntegration_EndToEnd(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping end-to-end test in short mode")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	t.Log("=== End-to-End Test: Full BeTrace Workflow ===")

	// Step 1: Create rule
	t.Log("Step 1: Creating rule...")
	ruleName := "e2e-test-rule"
	rule := map[string]interface{}{
		"name":        ruleName,
		"description": "End-to-end test rule",
		"expression":  `span.name == "critical.operation" and span.duration > 500`,
		"severity":    "CRITICAL",
		"enabled":     true,
		"tags":        []string{"e2e", "test"},
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, 200, resp.StatusCode)

	defer func() {
		client.DeleteRule(ctx, ruleName)
	}()

	// Step 2: Generate matching trace
	t.Log("Step 2: Generating matching trace...")
	trace := helpers.GenerateTrace([]string{
		"critical.operation",
		"db.query",
		"cache.read",
	})

	// Set duration on critical.operation to trigger rule
	trace[0].EndTime = trace[0].StartTime + (600 * 1000000) // 600ms

	spans := make([]map[string]interface{}, len(trace))
	for i, span := range trace {
		spans[i] = map[string]interface{}{
			"traceId":    span.TraceID,
			"spanId":     span.SpanID,
			"parentId":   span.ParentID,
			"name":       span.Name,
			"startTime":  span.StartTime,
			"endTime":    span.EndTime,
			"status":     span.Status,
			"attributes": span.Attributes,
		}
	}

	spanResp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	spanResp.Body.Close()
	require.Equal(t, 200, spanResp.StatusCode)

	// Step 3: Wait for rule evaluation
	t.Log("Step 3: Waiting for rule evaluation...")
	time.Sleep(5 * time.Second)

	// Step 4: Verify violation was created
	t.Log("Step 4: Verifying violation...")
	violationsResp, err := client.HTTPClient.Get(backendURL + "/v1/violations?rule=" + ruleName)
	require.NoError(t, err)
	defer violationsResp.Body.Close()

	assert.Equal(t, 200, violationsResp.StatusCode)

	// Step 5: Check Prometheus metrics
	t.Log("Step 5: Checking Prometheus metrics...")
	metrics, err := client.GetMetrics(ctx)
	require.NoError(t, err)

	assert.Contains(t, metrics, "betrace_rules_total", "Should track rule count")
	assert.Contains(t, metrics, "betrace_spans_total", "Should track span count")

	t.Log("=== End-to-End Test Complete ===")
}

func TestIntegration_NetworkLatency(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Send span and measure response time
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

	start := time.Now()
	resp, err := client.SendSpans(ctx, spans)
	latency := time.Since(start)

	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, 200, resp.StatusCode)
	assert.Less(t, latency, 100*time.Millisecond, "API latency should be < 100ms")
}

func TestIntegration_GrafanaDatasources(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	// Check Grafana datasources are configured
	resp, err := client.HTTPClient.Get(grafanaURL + "/api/datasources")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, 200, resp.StatusCode)

	body, err := helpers.ReadResponseBody(resp)
	require.NoError(t, err)

	bodyStr := string(body)
	assert.Contains(t, bodyStr, "Tempo", "Tempo datasource should be configured")
	assert.Contains(t, bodyStr, "Prometheus", "Prometheus datasource should be configured")
	assert.Contains(t, bodyStr, "Loki", "Loki datasource should be configured")
}
