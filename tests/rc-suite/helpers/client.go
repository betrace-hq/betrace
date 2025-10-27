// +build rc

package helpers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// TestClient provides HTTP and gRPC clients for BeTrace backend
type TestClient struct {
	HTTPClient *http.Client
	GRPCConn   *grpc.ClientConn
	BaseURL    string
	GRPCAddr   string
}

// NewTestClient creates a new test client
func NewTestClient(baseURL, grpcAddr string) (*TestClient, error) {
	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	// Wait for backend to be ready
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("timeout waiting for backend")
		default:
			resp, err := httpClient.Get(baseURL + "/v1/health")
			if err == nil && resp.StatusCode == 200 {
				resp.Body.Close()
				goto ready
			}
			if resp != nil {
				resp.Body.Close()
			}
			time.Sleep(1 * time.Second)
		}
	}

ready:
	// Connect gRPC
	conn, err := grpc.NewClient(grpcAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect gRPC: %w", err)
	}

	return &TestClient{
		HTTPClient: httpClient,
		GRPCConn:   conn,
		BaseURL:    baseURL,
		GRPCAddr:   grpcAddr,
	}, nil
}

// Close closes connections
func (c *TestClient) Close() error {
	if c.GRPCConn != nil {
		return c.GRPCConn.Close()
	}
	return nil
}

// CreateRule creates a rule via HTTP API
func (c *TestClient) CreateRule(ctx context.Context, rule map[string]interface{}) (*http.Response, error) {
	body, err := json.Marshal(rule)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/v1/rules", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	return c.HTTPClient.Do(req)
}

// GetRule fetches a rule by ID
func (c *TestClient) GetRule(ctx context.Context, id string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/v1/rules/"+id, nil)
	if err != nil {
		return nil, err
	}
	return c.HTTPClient.Do(req)
}

// DeleteRule deletes a rule by ID
func (c *TestClient) DeleteRule(ctx context.Context, id string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "DELETE", c.BaseURL+"/v1/rules/"+id, nil)
	if err != nil {
		return nil, err
	}
	return c.HTTPClient.Do(req)
}

// ListRules lists all rules
func (c *TestClient) ListRules(ctx context.Context) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/v1/rules", nil)
	if err != nil {
		return nil, err
	}
	return c.HTTPClient.Do(req)
}

// SendSpans sends spans via HTTP
func (c *TestClient) SendSpans(ctx context.Context, spans []map[string]interface{}) (*http.Response, error) {
	body, err := json.Marshal(map[string]interface{}{
		"spans": spans,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/v1/spans", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	return c.HTTPClient.Do(req)
}

// GetMetrics fetches Prometheus metrics
func (c *TestClient) GetMetrics(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/metrics", nil)
	if err != nil {
		return "", err
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

// ReadResponseBody reads and closes response body
func ReadResponseBody(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}
