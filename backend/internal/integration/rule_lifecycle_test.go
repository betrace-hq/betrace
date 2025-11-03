package integration

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
	grpcServices "github.com/betracehq/betrace/backend/internal/grpc/services"
	"github.com/betracehq/betrace/backend/internal/rules"
	"github.com/betracehq/betrace/backend/internal/services"
	"github.com/betracehq/betrace/backend/internal/storage"
	"google.golang.org/grpc"
)

// TestServer is a helper that starts services in-process for testing
type TestServer struct {
	ruleClient      pb.RuleServiceClient
	spanClient      pb.SpanServiceClient
	violationClient pb.ViolationServiceClient
	healthClient    pb.HealthServiceClient
	conn            *grpc.ClientConn
}

// NewTestServer creates a test server without actual network listener
// Uses direct service calls instead of gRPC for integration tests
func NewTestServer(t *testing.T) *TestServer {
	// Create services
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	ruleStore, err := storage.NewDiskRuleStoreWithFS("test-data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create rule store: %v", err)
	}

	violationStore := services.NewViolationStoreMemory("test-signature-key")

	return &TestServer{
		ruleClient:      &directRuleClient{service: grpcServices.NewRuleService(engine, ruleStore)},
		spanClient:      &directSpanClient{service: grpcServices.NewSpanService(engine, violationStore)},
		violationClient: &directViolationClient{service: grpcServices.NewViolationService(violationStore)},
		healthClient:    &directHealthClient{service: grpcServices.NewHealthService("test")},
	}
}

func (ts *TestServer) Close() {
	if ts.conn != nil {
		ts.conn.Close()
	}
}

// Direct client implementations that bypass gRPC for testing

type directRuleClient struct {
	service *grpcServices.RuleService
}

func (c *directRuleClient) CreateRule(ctx context.Context, req *pb.CreateRuleRequest, opts ...grpc.CallOption) (*pb.Rule, error) {
	return c.service.CreateRule(ctx, req)
}

func (c *directRuleClient) UpdateRule(ctx context.Context, req *pb.UpdateRuleRequest, opts ...grpc.CallOption) (*pb.Rule, error) {
	return c.service.UpdateRule(ctx, req)
}

func (c *directRuleClient) DeleteRule(ctx context.Context, req *pb.DeleteRuleRequest, opts ...grpc.CallOption) (*pb.DeleteRuleResponse, error) {
	return c.service.DeleteRule(ctx, req)
}

func (c *directRuleClient) GetRule(ctx context.Context, req *pb.GetRuleRequest, opts ...grpc.CallOption) (*pb.Rule, error) {
	return c.service.GetRule(ctx, req)
}

func (c *directRuleClient) ListRules(ctx context.Context, req *pb.ListRulesRequest, opts ...grpc.CallOption) (*pb.ListRulesResponse, error) {
	return c.service.ListRules(ctx, req)
}

func (c *directRuleClient) EnableRule(ctx context.Context, req *pb.EnableRuleRequest, opts ...grpc.CallOption) (*pb.Rule, error) {
	return c.service.EnableRule(ctx, req)
}

func (c *directRuleClient) DisableRule(ctx context.Context, req *pb.DisableRuleRequest, opts ...grpc.CallOption) (*pb.Rule, error) {
	return c.service.DisableRule(ctx, req)
}

type directSpanClient struct {
	service *grpcServices.SpanService
}

func (c *directSpanClient) IngestSpans(ctx context.Context, req *pb.IngestSpansRequest, opts ...grpc.CallOption) (*pb.IngestSpansResponse, error) {
	return c.service.IngestSpans(ctx, req)
}

type directViolationClient struct {
	service *grpcServices.ViolationService
}

func (c *directViolationClient) ListViolations(ctx context.Context, req *pb.ListViolationsRequest, opts ...grpc.CallOption) (*pb.ListViolationsResponse, error) {
	return c.service.ListViolations(ctx, req)
}

type directHealthClient struct {
	service *grpcServices.HealthService
}

func (c *directHealthClient) Check(ctx context.Context, req *pb.HealthCheckRequest, opts ...grpc.CallOption) (*pb.HealthCheckResponse, error) {
	return c.service.Check(ctx, req)
}

func (c *directHealthClient) Ready(ctx context.Context, req *pb.HealthCheckRequest, opts ...grpc.CallOption) (*pb.HealthCheckResponse, error) {
	return c.service.Ready(ctx, req)
}

// TestRuleLifecycle_Complete tests the complete rule lifecycle
func TestRuleLifecycle_Complete(t *testing.T) {
	server := NewTestServer(t)
	defer server.Close()

	ctx := context.Background()

	// 1. Create rule
	t.Log("Step 1: Creating rule...")
	createReq := &pb.CreateRuleRequest{
		Name:        "integration-test-rule",
		Description: "Rule for integration testing",
		Expression:  "span.duration > 100ms",
		Enabled:     true,
		Severity:    "HIGH",
		Tags:        []string{"integration", "test"},
	}

	created, err := server.ruleClient.CreateRule(ctx, createReq)
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}
	t.Logf("✓ Rule created: %s", created.Id)

	// 2. Get rule
	t.Log("Step 2: Getting rule by ID...")
	retrieved, err := server.ruleClient.GetRule(ctx, &pb.GetRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("GetRule failed: %v", err)
	}
	if retrieved.Name != "integration-test-rule" {
		t.Errorf("Expected name 'integration-test-rule', got %s", retrieved.Name)
	}
	t.Log("✓ Rule retrieved successfully")

	// 3. List rules
	t.Log("Step 3: Listing rules...")
	listResp, err := server.ruleClient.ListRules(ctx, &pb.ListRulesRequest{})
	if err != nil {
		t.Fatalf("ListRules failed: %v", err)
	}
	if len(listResp.Rules) != 1 {
		t.Errorf("Expected 1 rule, got %d", len(listResp.Rules))
	}
	t.Log("✓ Rules listed successfully")

	// 4. Update rule
	t.Log("Step 4: Updating rule...")
	updateReq := &pb.UpdateRuleRequest{
		Id:          created.Id,
		Name:        "integration-test-rule",
		Description: "Updated description",
		Expression:  "span.duration > 200ms",
		Enabled:     true,
		Severity:    "MEDIUM",
		Tags:        []string{"integration"},
	}

	updated, err := server.ruleClient.UpdateRule(ctx, updateReq)
	if err != nil {
		t.Fatalf("UpdateRule failed: %v", err)
	}
	if updated.Description != "Updated description" {
		t.Errorf("Expected updated description, got %s", updated.Description)
	}
	t.Log("✓ Rule updated successfully")

	// 5. Disable rule
	t.Log("Step 5: Disabling rule...")
	disabled, err := server.ruleClient.DisableRule(ctx, &pb.DisableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("DisableRule failed: %v", err)
	}
	if disabled.Enabled {
		t.Error("Expected rule to be disabled")
	}
	t.Log("✓ Rule disabled successfully")

	// 6. Enable rule
	t.Log("Step 6: Enabling rule...")
	enabled, err := server.ruleClient.EnableRule(ctx, &pb.EnableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("EnableRule failed: %v", err)
	}
	if !enabled.Enabled {
		t.Error("Expected rule to be enabled")
	}
	t.Log("✓ Rule enabled successfully")

	// 7. Delete rule
	t.Log("Step 7: Deleting rule...")
	deleteResp, err := server.ruleClient.DeleteRule(ctx, &pb.DeleteRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("DeleteRule failed: %v", err)
	}
	if !deleteResp.Success {
		t.Error("Expected successful deletion")
	}
	t.Log("✓ Rule deleted successfully")

	// 8. Verify deletion
	t.Log("Step 8: Verifying deletion...")
	listResp, err = server.ruleClient.ListRules(ctx, &pb.ListRulesRequest{})
	if err != nil {
		t.Fatalf("ListRules failed: %v", err)
	}
	if len(listResp.Rules) != 0 {
		t.Errorf("Expected 0 rules after deletion, got %d", len(listResp.Rules))
	}
	t.Log("✓ Deletion verified")

	t.Log("✅ Complete rule lifecycle test PASSED")
}

// TestSpanIngestionWithViolation tests end-to-end span ingestion and violation detection
func TestSpanIngestionWithViolation(t *testing.T) {
	server := NewTestServer(t)
	defer server.Close()

	ctx := context.Background()

	// 1. Create rule
	t.Log("Creating rule that matches all spans...")
	rule, err := server.ruleClient.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "match-all-rule",
		Expression: "true", // Matches all spans
		Enabled:    true,
		Severity:   "HIGH",
	})
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}
	t.Logf("✓ Rule created: %s", rule.Id)

	// 2. Ingest span
	t.Log("Ingesting test span...")
	now := time.Now().UnixNano()
	ingestResp, err := server.spanClient.IngestSpans(ctx, &pb.IngestSpansRequest{
		Spans: []*pb.Span{
			{
				TraceId:   "test-trace-123",
				SpanId:    "test-span-456",
				Name:      "test-operation",
				StartTime: now,
				EndTime:   now + int64(100*time.Millisecond),
			},
		},
	})
	if err != nil {
		t.Fatalf("IngestSpans failed: %v", err)
	}

	if ingestResp.Accepted != 1 {
		t.Errorf("Expected 1 span accepted, got %d", ingestResp.Accepted)
	}
	t.Log("✓ Span ingested successfully")

	// 3. Query violations
	t.Log("Querying violations...")
	violations, err := server.violationClient.ListViolations(ctx, &pb.ListViolationsRequest{
		RuleId: rule.Id,
	})
	if err != nil {
		t.Fatalf("ListViolations failed: %v", err)
	}

	if len(violations.Violations) != 1 {
		t.Errorf("Expected 1 violation, got %d", len(violations.Violations))
	}
	t.Log("✓ Violation detected")

	// 4. Verify violation details
	if len(violations.Violations) > 0 {
		v := violations.Violations[0]
		if v.RuleId != rule.Id {
			t.Errorf("Expected rule ID %s, got %s", rule.Id, v.RuleId)
		}
		if v.Severity != "HIGH" {
			t.Errorf("Expected severity HIGH, got %s", v.Severity)
		}
		if v.TraceId != "test-trace-123" {
			t.Errorf("Expected trace ID test-trace-123, got %s", v.TraceId)
		}
		t.Log("✓ Violation details verified")
	}

	t.Log("✅ Span ingestion with violation test PASSED")
}

// TestConcurrentOperations tests concurrent rule operations
func TestConcurrentOperations(t *testing.T) {
	server := NewTestServer(t)
	defer server.Close()

	ctx := context.Background()

	const goroutines = 10
	const operationsPerGoroutine = 10

	var wg sync.WaitGroup
	errors := make(chan error, goroutines*operationsPerGoroutine)

	t.Logf("Starting %d goroutines with %d operations each...", goroutines, operationsPerGoroutine)

	start := time.Now()

	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			for i := 0; i < operationsPerGoroutine; i++ {
				ruleName := fmt.Sprintf("concurrent-rule-%d-%d", id, i)

				// Create rule
				_, err := server.ruleClient.CreateRule(ctx, &pb.CreateRuleRequest{
					Name:       ruleName,
					Expression: "true",
					Enabled:    true,
					Severity:   "MEDIUM",
				})
				if err != nil {
					errors <- fmt.Errorf("CreateRule failed: %w", err)
					return
				}

				// List rules (causes read contention)
				_, err = server.ruleClient.ListRules(ctx, &pb.ListRulesRequest{})
				if err != nil {
					errors <- fmt.Errorf("ListRules failed: %w", err)
					return
				}
			}
		}(g)
	}

	wg.Wait()
	close(errors)
	elapsed := time.Since(start)

	errorCount := 0
	for err := range errors {
		t.Logf("Error: %v", err)
		errorCount++
	}

	t.Logf("Completed %d operations in %v", goroutines*operationsPerGoroutine, elapsed)
	t.Logf("Average: %v per operation", elapsed/time.Duration(goroutines*operationsPerGoroutine))

	if errorCount > 0 {
		t.Errorf("Got %d errors during concurrent operations", errorCount)
	}

	// Verify all rules created
	listResp, err := server.ruleClient.ListRules(ctx, &pb.ListRulesRequest{})
	if err != nil {
		t.Fatalf("Final ListRules failed: %v", err)
	}

	expectedRules := goroutines * operationsPerGoroutine
	if len(listResp.Rules) != expectedRules {
		t.Errorf("Expected %d rules, got %d", expectedRules, len(listResp.Rules))
	}

	t.Log("✅ Concurrent operations test PASSED")
}

// TestHealthEndpoints tests health check endpoints
func TestHealthEndpoints(t *testing.T) {
	server := NewTestServer(t)
	defer server.Close()

	ctx := context.Background()

	// Test Check
	t.Log("Testing /health endpoint...")
	checkResp, err := server.healthClient.Check(ctx, &pb.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Check failed: %v", err)
	}

	if checkResp.Status != pb.HealthCheckResponse_HEALTHY {
		t.Errorf("Expected HEALTHY status, got %v", checkResp.Status)
	}
	t.Log("✓ Health check passed")

	// Test Ready
	t.Log("Testing /ready endpoint...")
	readyResp, err := server.healthClient.Ready(ctx, &pb.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Ready failed: %v", err)
	}

	if readyResp.Status != pb.HealthCheckResponse_HEALTHY {
		t.Errorf("Expected HEALTHY status, got %v", readyResp.Status)
	}
	t.Log("✓ Readiness check passed")

	t.Log("✅ Health endpoints test PASSED")
}
