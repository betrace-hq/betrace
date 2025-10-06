package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ChromaClient handles communication with Chroma vector database
type ChromaClient struct {
	baseURL string
	client  *http.Client
}

// Collection represents a Chroma collection
type Collection struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Metadata map[string]interface{} `json:"metadata"`
}

// QueryResult represents a query result from Chroma
type QueryResult struct {
	ID       string            `json:"id"`
	Content  string            `json:"content"`
	Metadata map[string]string `json:"metadata"`
	Distance float64           `json:"distance"`
}

// NewChromaClient creates a new Chroma client
func NewChromaClient(host string, port int) *ChromaClient {
	return &ChromaClient{
		baseURL: fmt.Sprintf("http://%s:%d", host, port),
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// TestConnection tests the connection to Chroma
func (c *ChromaClient) TestConnection() error {
	resp, err := c.client.Get(c.baseURL + "/api/v1/heartbeat")
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("heartbeat failed with status %d", resp.StatusCode)
	}

	return nil
}

// EnsureCollection creates or gets a collection
func (c *ChromaClient) EnsureCollection(name string, forceUpdate bool) (string, error) {
	// If force update, try to delete existing collection first
	if forceUpdate {
		c.deleteCollection(name) // Ignore errors
	}

	// Try to create collection
	collection, err := c.createCollection(name)
	if err != nil {
		// If creation failed, try to get existing collection
		collections, getErr := c.listCollections()
		if getErr != nil {
			return "", fmt.Errorf("failed to create and list collections: create=%v, list=%v", err, getErr)
		}

		for _, col := range collections {
			if col.Name == name {
				return col.ID, nil
			}
		}

		return "", fmt.Errorf("collection not found and could not be created: %w", err)
	}

	return collection.ID, nil
}

// createCollection creates a new collection
func (c *ChromaClient) createCollection(name string) (*Collection, error) {
	payload := map[string]interface{}{
		"name": name,
		"metadata": map[string]string{
			"description": "FLUO Documentation for RAG",
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	resp, err := c.client.Post(
		c.baseURL+"/api/v1/collections",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("create collection failed with status %d: %s", resp.StatusCode, string(body))
	}

	var collection Collection
	if err := json.NewDecoder(resp.Body).Decode(&collection); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &collection, nil
}

// listCollections lists all collections
func (c *ChromaClient) listCollections() ([]*Collection, error) {
	resp, err := c.client.Get(c.baseURL + "/api/v1/collections")
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("list collections failed with status %d", resp.StatusCode)
	}

	var collections []*Collection
	if err := json.NewDecoder(resp.Body).Decode(&collections); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return collections, nil
}

// deleteCollection deletes a collection by name
func (c *ChromaClient) deleteCollection(name string) error {
	collections, err := c.listCollections()
	if err != nil {
		return err
	}

	for _, col := range collections {
		if col.Name == name {
			req, err := http.NewRequest("DELETE", c.baseURL+"/api/v1/collections/"+col.ID, nil)
			if err != nil {
				return err
			}

			resp, err := c.client.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			return nil
		}
	}

	return nil // Collection doesn't exist
}

// IngestChunks adds chunks to a collection
func (c *ChromaClient) IngestChunks(collectionID string, chunks []*Chunk) error {
	if len(chunks) == 0 {
		return nil
	}

	// Prepare batch data
	ids := make([]string, len(chunks))
	documents := make([]string, len(chunks))
	metadatas := make([]map[string]string, len(chunks))

	for i, chunk := range chunks {
		ids[i] = chunk.ID
		documents[i] = chunk.Content
		metadatas[i] = chunk.Metadata
	}

	payload := map[string]interface{}{
		"ids":       ids,
		"documents": documents,
		"metadatas": metadatas,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/collections/%s/add", c.baseURL, collectionID)
	resp, err := c.client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("add chunks failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// QueryCollection performs a simple text search in collection
func (c *ChromaClient) QueryCollection(collectionID, query string, nResults int) ([]*QueryResult, error) {
	// For now, get all documents and filter by content
	// This is a simple implementation - in production would use proper embedding search

	payload := map[string]interface{}{
		"include": []string{"documents", "metadatas"},
		"limit":   100, // Get more docs to search through
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/collections/%s/get", c.baseURL, collectionID)
	resp, err := c.client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var getResponse struct {
		IDs       []string              `json:"ids"`
		Documents []string              `json:"documents"`
		Metadatas []map[string]string   `json:"metadatas"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&getResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Simple text matching (case-insensitive)
	var results []*QueryResult
	queryLower := strings.ToLower(query)

	for i, doc := range getResponse.Documents {
		docLower := strings.ToLower(doc)
		if strings.Contains(docLower, queryLower) {
			result := &QueryResult{
				Content:  doc,
				Distance: 0.0, // No real distance for text search
			}

			if i < len(getResponse.IDs) {
				result.ID = getResponse.IDs[i]
			}

			if i < len(getResponse.Metadatas) {
				result.Metadata = getResponse.Metadatas[i]
			}

			results = append(results, result)

			if len(results) >= nResults {
				break
			}
		}
	}

	return results, nil
}