package services

import (
	"context"
	"testing"
	"time"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
)

// TestHealthService_Check tests the Check endpoint
func TestHealthService_Check(t *testing.T) {
	service := NewHealthService("2.0.0-test")

	// Wait 1 second to ensure uptime is measurable
	time.Sleep(1 * time.Second)

	ctx := context.Background()
	resp, err := service.Check(ctx, &pb.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Check failed: %v", err)
	}

	if resp.Status != pb.HealthCheckResponse_HEALTHY {
		t.Errorf("Expected HEALTHY status, got %v", resp.Status)
	}

	if resp.Version != "2.0.0-test" {
		t.Errorf("Expected version '2.0.0-test', got %s", resp.Version)
	}

	// UptimeSeconds should be >= 1 after 1 second delay
	if resp.UptimeSeconds < 1 {
		t.Errorf("Expected uptime >= 1 second, got %d", resp.UptimeSeconds)
	}

	if resp.Metadata == nil {
		t.Fatal("Expected metadata map, got nil")
	}

	if resp.Metadata["storage"] != "in-memory" {
		t.Errorf("Expected storage='in-memory', got %s", resp.Metadata["storage"])
	}
}

// TestHealthService_Ready tests the Ready endpoint
func TestHealthService_Ready(t *testing.T) {
	service := NewHealthService("2.0.0-test")

	ctx := context.Background()
	resp, err := service.Ready(ctx, &pb.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Ready failed: %v", err)
	}

	if resp.Status != pb.HealthCheckResponse_HEALTHY {
		t.Errorf("Expected HEALTHY status, got %v", resp.Status)
	}

	if resp.Version != "2.0.0-test" {
		t.Errorf("Expected version '2.0.0-test', got %s", resp.Version)
	}
}

// TestHealthService_UptimeIncreases tests that uptime increases over time
func TestHealthService_UptimeIncreases(t *testing.T) {
	service := NewHealthService("2.0.0-test")

	ctx := context.Background()

	// Wait 1 second for initial uptime
	time.Sleep(1 * time.Second)

	// First check
	resp1, err := service.Check(ctx, &pb.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("First Check failed: %v", err)
	}

	uptime1 := resp1.UptimeSeconds

	// Wait another second
	time.Sleep(1 * time.Second)

	// Second check
	resp2, err := service.Check(ctx, &pb.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Second Check failed: %v", err)
	}

	uptime2 := resp2.UptimeSeconds

	// Uptime should increase by at least 1 second
	if uptime2 <= uptime1 {
		t.Errorf("Expected uptime to increase: %d -> %d", uptime1, uptime2)
	}
}

// TestHealthService_VersionPersistence tests that version is persistent
func TestHealthService_VersionPersistence(t *testing.T) {
	version := "1.2.3-custom"
	service := NewHealthService(version)

	ctx := context.Background()

	// Multiple checks should return same version
	for i := 0; i < 5; i++ {
		resp, err := service.Check(ctx, &pb.HealthCheckRequest{})
		if err != nil {
			t.Fatalf("Check %d failed: %v", i, err)
		}

		if resp.Version != version {
			t.Errorf("Check %d: expected version %s, got %s", i, version, resp.Version)
		}
	}
}

// TestHealthService_ReadySameAsCheck tests that Ready returns same as Check
func TestHealthService_ReadySameAsCheck(t *testing.T) {
	service := NewHealthService("2.0.0-test")

	ctx := context.Background()

	checkResp, err := service.Check(ctx, &pb.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Check failed: %v", err)
	}

	readyResp, err := service.Ready(ctx, &pb.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Ready failed: %v", err)
	}

	if checkResp.Status != readyResp.Status {
		t.Errorf("Status mismatch: Check=%v Ready=%v", checkResp.Status, readyResp.Status)
	}

	if checkResp.Version != readyResp.Version {
		t.Errorf("Version mismatch: Check=%s Ready=%s", checkResp.Version, readyResp.Version)
	}

	// Uptime may differ slightly due to time between calls, but should be close
	uptimeDiff := checkResp.UptimeSeconds - readyResp.UptimeSeconds
	if uptimeDiff < -1 || uptimeDiff > 1 {
		t.Errorf("Uptime differs by more than 1 second: Check=%d Ready=%d", checkResp.UptimeSeconds, readyResp.UptimeSeconds)
	}
}
