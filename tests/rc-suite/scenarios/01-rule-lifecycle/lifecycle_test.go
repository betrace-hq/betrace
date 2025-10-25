// +build rc

package rule_lifecycle

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
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

func TestRuleCreation_Valid(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	validRules := helpers.ValidRules()
	for _, fixture := range validRules {
		t.Run(fixture.Name, func(t *testing.T) {
			rule := map[string]interface{}{
				"name":        fixture.Name,
				"description": fixture.Description,
				"expression":  fixture.Expression,
				"severity":    fixture.Severity,
				"enabled":     fixture.Enabled,
				"tags":        fixture.Tags,
			}

			resp, err := client.CreateRule(ctx, rule)
			require.NoError(t, err)
			defer resp.Body.Close()

			assert.Equal(t, http.StatusOK, resp.StatusCode, "Rule creation should succeed")

			// Verify rule was created
			getResp, err := client.GetRule(ctx, fixture.Name)
			require.NoError(t, err)
			defer getResp.Body.Close()

			assert.Equal(t, http.StatusOK, getResp.StatusCode)

			var retrieved map[string]interface{}
			err = json.NewDecoder(getResp.Body).Decode(&retrieved)
			require.NoError(t, err)

			assert.Equal(t, fixture.Name, retrieved["name"])
			assert.Equal(t, fixture.Expression, retrieved["expression"])

			// Cleanup
			delResp, _ := client.DeleteRule(ctx, fixture.Name)
			if delResp != nil {
				delResp.Body.Close()
			}
		})
	}
}

func TestRuleCreation_Invalid(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	invalidRules := helpers.InvalidRules()
	for _, fixture := range invalidRules {
		t.Run(fixture.Name, func(t *testing.T) {
			rule := map[string]interface{}{
				"name":        fixture.Name,
				"description": fixture.Description,
				"expression":  fixture.Expression,
				"severity":    fixture.Severity,
				"enabled":     fixture.Enabled,
			}

			resp, err := client.CreateRule(ctx, rule)
			require.NoError(t, err)
			defer resp.Body.Close()

			if fixture.ShouldFail {
				assert.NotEqual(t, http.StatusOK, resp.StatusCode,
					"Invalid rule should be rejected")
				assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
					"Should return 4xx client error")
			}
		})
	}
}

func TestRuleUpdate(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create initial rule
	ruleName := "updatable-rule"
	initialRule := map[string]interface{}{
		"name":        ruleName,
		"description": "Initial description",
		"expression":  "span.duration > 1000",
		"severity":    "LOW",
		"enabled":     true,
	}

	resp, err := client.CreateRule(ctx, initialRule)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	defer func() {
		delResp, _ := client.DeleteRule(ctx, ruleName)
		if delResp != nil {
			delResp.Body.Close()
		}
	}()

	// Update rule
	updatedRule := map[string]interface{}{
		"name":        ruleName,
		"description": "Updated description",
		"expression":  "span.duration > 2000", // Changed threshold
		"severity":    "HIGH",                  // Changed severity
		"enabled":     false,                   // Disabled
	}

	updateResp, err := client.CreateRule(ctx, updatedRule) // PUT /api/rules/{id} or POST with existing name
	require.NoError(t, err)
	defer updateResp.Body.Close()

	assert.Equal(t, http.StatusOK, updateResp.StatusCode)

	// Verify updates
	getResp, err := client.GetRule(ctx, ruleName)
	require.NoError(t, err)
	defer getResp.Body.Close()

	var retrieved map[string]interface{}
	err = json.NewDecoder(getResp.Body).Decode(&retrieved)
	require.NoError(t, err)

	assert.Equal(t, "Updated description", retrieved["description"])
	assert.Equal(t, "span.duration > 2000", retrieved["expression"])
	assert.Equal(t, "HIGH", retrieved["severity"])
	assert.Equal(t, false, retrieved["enabled"])
}

func TestRuleDeletion(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create rule
	ruleName := "deletable-rule"
	rule := map[string]interface{}{
		"name":        ruleName,
		"description": "To be deleted",
		"expression":  "span.duration > 1000",
		"severity":    "LOW",
		"enabled":     true,
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	// Delete rule
	delResp, err := client.DeleteRule(ctx, ruleName)
	require.NoError(t, err)
	defer delResp.Body.Close()

	assert.Equal(t, http.StatusOK, delResp.StatusCode)

	// Verify deletion
	getResp, err := client.GetRule(ctx, ruleName)
	require.NoError(t, err)
	defer getResp.Body.Close()

	assert.Equal(t, http.StatusNotFound, getResp.StatusCode)
}

func TestRuleDeletion_NonExistent(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Try to delete non-existent rule
	delResp, err := client.DeleteRule(ctx, "non-existent-rule")
	require.NoError(t, err)
	defer delResp.Body.Close()

	assert.Equal(t, http.StatusNotFound, delResp.StatusCode)
}

func TestRuleLimit_100K(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping long-running test in short mode")
	}

	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	t.Log("Creating 100K rules (this will take several minutes)...")

	// Create rules up to limit
	successCount := 0
	for i := 0; i < 100000; i++ {
		ruleName := fmt.Sprintf("rule-%d", i)
		rule := map[string]interface{}{
			"name":        ruleName,
			"description": "Limit test rule",
			"expression":  fmt.Sprintf("span.duration > %d", i%1000+100),
			"severity":    "LOW",
			"enabled":     false, // Disabled to avoid evaluation overhead
		}

		resp, err := client.CreateRule(ctx, rule)
		if err != nil {
			t.Logf("Error creating rule %d: %v", i, err)
			break
		}
		resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			successCount++
		} else {
			t.Logf("Failed to create rule %d: status %d", i, resp.StatusCode)
			break
		}

		if i%1000 == 0 {
			t.Logf("Created %d rules...", i)
		}
	}

	t.Logf("Successfully created %d rules", successCount)
	assert.GreaterOrEqual(t, successCount, 99000, "Should create at least 99K rules")

	// Try to create one more (should fail)
	extraRule := map[string]interface{}{
		"name":        "rule-100001",
		"description": "Should exceed limit",
		"expression":  "span.duration > 1000",
		"severity":    "LOW",
		"enabled":     false,
	}

	resp, err := client.CreateRule(ctx, extraRule)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode,
		"Should reject rule exceeding limit")
}

func TestRuleConcurrency_RaceConditions(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Test concurrent creates/deletes for race conditions
	var wg sync.WaitGroup
	errors := make(chan error, 100)

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			for j := 0; j < 10; j++ {
				ruleName := fmt.Sprintf("concurrent-rule-%d-%d", id, j)
				rule := map[string]interface{}{
					"name":        ruleName,
					"description": "Concurrency test",
					"expression":  "span.duration > 1000",
					"severity":    "LOW",
					"enabled":     true,
				}

				// Create
				resp, err := client.CreateRule(ctx, rule)
				if err != nil {
					errors <- err
					return
				}
				resp.Body.Close()

				// Immediately delete
				delResp, err := client.DeleteRule(ctx, ruleName)
				if err != nil {
					errors <- err
					return
				}
				delResp.Body.Close()
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	// Check for errors
	var errs []error
	for err := range errors {
		errs = append(errs, err)
	}

	assert.Empty(t, errs, "Should handle concurrent operations without errors")
}

func TestEnterpriseScaleRule(t *testing.T) {
	client, err := helpers.NewTestClient(backendURL, backendGRPC)
	require.NoError(t, err)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	fixture := helpers.EnterpriseScaleRule()
	rule := map[string]interface{}{
		"name":        fixture.Name,
		"description": fixture.Description,
		"expression":  fixture.Expression,
		"severity":    fixture.Severity,
		"enabled":     fixture.Enabled,
		"tags":        fixture.Tags,
	}

	resp, err := client.CreateRule(ctx, rule)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode,
		"Enterprise-scale rule should be accepted")

	defer func() {
		delResp, _ := client.DeleteRule(ctx, fixture.Name)
		if delResp != nil {
			delResp.Body.Close()
		}
	}()

	// Verify rule is queryable
	getResp, err := client.GetRule(ctx, fixture.Name)
	require.NoError(t, err)
	defer getResp.Body.Close()

	assert.Equal(t, http.StatusOK, getResp.StatusCode)
}
