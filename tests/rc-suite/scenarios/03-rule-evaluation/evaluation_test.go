// +build rc

package rule_evaluation

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

func TestRuleEvaluation_SimpleMatch(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create rule: detect slow spans (>1000ms)
	ruleName := "slow-span-detector"
	rule := map[string]interface{}{
		"name":        ruleName,
		"description": "Detect slow spans",
		"expression":  "span.duration > 1000",
		"severity":    "HIGH",
		"enabled":     true,
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	defer func() {
		client.DeleteRule(ctx, ruleName)
	}()

	// Send matching span (duration > 1000ms)
	matchingSpan := helpers.GenerateSpan(
		helpers.WithName("slow.operation"),
		helpers.WithDuration(1500), // 1500ms - SHOULD MATCH
	)

	spans := []map[string]interface{}{
		{
			"traceId":    matchingSpan.TraceID,
			"spanId":     matchingSpan.SpanID,
			"name":       matchingSpan.Name,
			"startTime":  matchingSpan.StartTime,
			"endTime":    matchingSpan.EndTime,
			"status":     matchingSpan.Status,
			"attributes": matchingSpan.Attributes,
		},
	}

	spanResp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	spanResp.Body.Close()

	// Wait for rule evaluation
	time.Sleep(2 * time.Second)

	// Query violations (implementation-specific endpoint)
	violationsResp, err := client.HTTPClient.Get(backendURL + "/v1/violations?ruleId=" + ruleName)
	require.NoError(t, err)
	defer violationsResp.Body.Close()

	var result map[string]interface{}
	err = json.NewDecoder(violationsResp.Body).Decode(&result)
	require.NoError(t, err)

	violations := result["violations"].([]interface{})

	assert.NotEmpty(t, violations, "Should have at least one violation")
	if len(violations) > 0 {
		violation := violations[0].(map[string]interface{})
		assert.Equal(t, ruleName, violation["ruleId"])
	}
}

func TestRuleEvaluation_NoMatch(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create rule: detect slow spans (>1000ms)
	ruleName := "slow-span-detector-nomatch"
	rule := map[string]interface{}{
		"name":        ruleName,
		"description": "Detect slow spans",
		"expression":  "span.duration > 1000",
		"severity":    "HIGH",
		"enabled":     true,
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	defer func() {
		client.DeleteRule(ctx, ruleName)
	}()

	// Send NON-matching span (duration < 1000ms)
	nonMatchingSpan := helpers.GenerateSpan(
		helpers.WithName("fast.operation"),
		helpers.WithDuration(100), // 100ms - SHOULD NOT MATCH
	)

	spans := []map[string]interface{}{
		{
			"traceId":    nonMatchingSpan.TraceID,
			"spanId":     nonMatchingSpan.SpanID,
			"name":       nonMatchingSpan.Name,
			"startTime":  nonMatchingSpan.StartTime,
			"endTime":    nonMatchingSpan.EndTime,
			"status":     nonMatchingSpan.Status,
			"attributes": nonMatchingSpan.Attributes,
		},
	}

	spanResp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	spanResp.Body.Close()

	// Wait for rule evaluation
	time.Sleep(2 * time.Second)

	// Query violations
	violationsResp, err := client.HTTPClient.Get(backendURL + "/v1/violations?ruleId=" + ruleName)
	require.NoError(t, err)
	defer violationsResp.Body.Close()

	var result map[string]interface{}
	err = json.NewDecoder(violationsResp.Body).Decode(&result)
	require.NoError(t, err)

	violations := result["violations"].([]interface{})

	assert.Empty(t, violations, "Should have no violations for non-matching span")
}

func TestRuleEvaluation_AttributeMatch(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create rule: detect HTTP 500 errors
	ruleName := "http-500-detector"
	rule := map[string]interface{}{
		"name":        ruleName,
		"description": "Detect HTTP 500 errors",
		"expression":  `span.attributes["http.status_code"] == "500"`,
		"severity":    "CRITICAL",
		"enabled":     true,
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	defer func() {
		client.DeleteRule(ctx, ruleName)
	}()

	// Send matching span with http.status_code=500
	matchingSpan := helpers.GenerateSpan(
		helpers.WithName("http.request"),
		helpers.WithAttribute("http.status_code", "500"),
	)

	spans := []map[string]interface{}{
		{
			"traceId":    matchingSpan.TraceID,
			"spanId":     matchingSpan.SpanID,
			"name":       matchingSpan.Name,
			"startTime":  matchingSpan.StartTime,
			"endTime":    matchingSpan.EndTime,
			"status":     matchingSpan.Status,
			"attributes": matchingSpan.Attributes,
		},
	}

	spanResp, err := client.SendSpans(ctx, spans)
	require.NoError(t, err)
	spanResp.Body.Close()

	// Wait for evaluation
	time.Sleep(2 * time.Second)

	// Verify violation
	violationsResp, err := client.HTTPClient.Get(backendURL + "/v1/violations?ruleId=" + ruleName)
	require.NoError(t, err)
	defer violationsResp.Body.Close()

	var result map[string]interface{}
	err = json.NewDecoder(violationsResp.Body).Decode(&result)
	require.NoError(t, err)

	violations := result["violations"].([]interface{})

	assert.NotEmpty(t, violations, "Should detect HTTP 500 error")
}

func TestRuleEvaluation_MultiTrace(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create rule: detect traces with both auth and database operations
	ruleName := "auth-db-pattern"
	rule := map[string]interface{}{
		"name":        ruleName,
		"description": "Detect auth + db pattern",
		"expression":  `trace.has(span.name == "auth.check") and trace.has(span.name == "db.query")`,
		"severity":    "LOW",
		"enabled":     true,
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	defer func() {
		client.DeleteRule(ctx, ruleName)
	}()

	// Generate trace with auth + db spans
	trace := helpers.GenerateTrace([]string{"auth.check", "db.query", "http.response"})

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

	// Wait for trace completion and evaluation
	time.Sleep(3 * time.Second)

	// Verify violation
	violationsResp, err := client.HTTPClient.Get(backendURL + "/v1/violations?ruleId=" + ruleName)
	require.NoError(t, err)
	defer violationsResp.Body.Close()

	var result map[string]interface{}
	err = json.NewDecoder(violationsResp.Body).Decode(&result)
	require.NoError(t, err)

	violations := result["violations"].([]interface{})

	assert.NotEmpty(t, violations, "Should match multi-span trace pattern")
}

func TestRuleEvaluation_MultipleRulesOneSpan(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create multiple rules that match the same condition
	rules := []map[string]interface{}{
		{
			"name":        "rule-1-slow",
			"description": "Slow span rule 1",
			"expression":  "span.duration > 1000",
			"severity":    "HIGH",
			"enabled":     true,
		},
		{
			"name":        "rule-2-slow",
			"description": "Slow span rule 2",
			"expression":  "span.duration > 500",
			"severity":    "MEDIUM",
			"enabled":     true,
		},
		{
			"name":        "rule-3-any",
			"description": "Any span",
			"expression":  "span.duration >= 0",
			"severity":    "LOW",
			"enabled":     true,
		},
	}

	for _, rule := range rules {
		resp, err := client.CreateRule(ctx, rule)
		require.NoError(t, err)
		resp.Body.Close()

		defer func(name string) {
			client.DeleteRule(ctx, name)
		}(rule["name"].(string))
	}

	// Send span that matches all three rules
	span := helpers.GenerateSpan(
		helpers.WithName("slow.operation"),
		helpers.WithDuration(1500), // Matches all three rules
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

	// Wait for evaluation
	time.Sleep(3 * time.Second)

	// Verify all three rules fired
	for _, rule := range rules {
		ruleName := rule["name"].(string)
		violationsResp, err := client.HTTPClient.Get(backendURL + "/v1/violations?ruleId=" + ruleName)
		require.NoError(t, err)

		var result map[string]interface{}
		err = json.NewDecoder(violationsResp.Body).Decode(&result)
		violationsResp.Body.Close()
		require.NoError(t, err)

		violations := result["violations"].([]interface{})

		assert.NotEmpty(t, violations, fmt.Sprintf("Rule %s should have fired", ruleName))
	}
}

func TestRuleEvaluation_Performance(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Create 1000 rules
	t.Log("Creating 1000 rules...")
	for i := 0; i < 1000; i++ {
		rule := map[string]interface{}{
			"name":        fmt.Sprintf("perf-rule-%d", i),
			"description": "Performance test rule",
			"expression":  fmt.Sprintf("span.duration > %d", i*10),
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

	// Send 1000 spans and measure evaluation time
	t.Log("Sending 1000 spans for evaluation...")
	startTime := time.Now()

	for i := 0; i < 1000; i++ {
		span := helpers.GenerateSpan(
			helpers.WithName(fmt.Sprintf("perf.span.%d", i)),
			helpers.WithDuration(int64(i * 5)),
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
	}

	duration := time.Since(startTime)
	avgPerTrace := duration / 1000

	t.Logf("Evaluated 1000 traces against 1000 rules in %v", duration)
	t.Logf("Average time per trace: %v", avgPerTrace)

	// Rule engine should evaluate in < 1ms per trace
	assert.Less(t, avgPerTrace, 1*time.Millisecond,
		"Rule evaluation should be < 1ms per trace")
}

func TestRuleEvaluation_DisabledRule(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create DISABLED rule
	ruleName := "disabled-rule"
	rule := map[string]interface{}{
		"name":        ruleName,
		"description": "This rule is disabled",
		"expression":  "span.duration > 0", // Matches everything
		"severity":    "HIGH",
		"enabled":     false, // DISABLED
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	defer func() {
		client.DeleteRule(ctx, ruleName)
	}()

	// Send span that would match if rule was enabled
	span := helpers.GenerateSpan(
		helpers.WithName("test.operation"),
		helpers.WithDuration(500),
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

	// Wait for evaluation
	time.Sleep(2 * time.Second)

	// Verify NO violations (rule is disabled)
	violationsResp, err := client.HTTPClient.Get(backendURL + "/v1/violations?ruleId=" + ruleName)
	require.NoError(t, err)
	defer violationsResp.Body.Close()

	var result map[string]interface{}
	err = json.NewDecoder(violationsResp.Body).Decode(&result)
	require.NoError(t, err)

	violations := result["violations"].([]interface{})

	assert.Empty(t, violations, "Disabled rule should not generate violations")
}
