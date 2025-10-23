package storage

import (
	"context"
	"fmt"
	"sync"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// MemoryStore provides in-memory storage for development
// TODO: Replace with DuckDB when CGO issues are resolved
type MemoryStore struct {
	violations map[string]models.Violation
	mu         sync.RWMutex
}

// NewMemoryStore creates a new in-memory store
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		violations: make(map[string]models.Violation),
	}
}

// StoreViolation stores a violation in memory
func (s *MemoryStore) StoreViolation(ctx context.Context, v models.Violation) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.violations[v.ID] = v
	return nil
}

// GetViolation retrieves a violation by ID
func (s *MemoryStore) GetViolation(ctx context.Context, id string) (*models.Violation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	v, ok := s.violations[id]
	if !ok {
		return nil, fmt.Errorf("violation not found: %s", id)
	}

	return &v, nil
}

// QueryViolations returns all violations (filtered)
func (s *MemoryStore) QueryViolations(ctx context.Context, ruleID, severity string, limit int) ([]models.Violation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := []models.Violation{}
	for _, v := range s.violations {
		// Apply filters
		if ruleID != "" && v.RuleID != ruleID {
			continue
		}
		if severity != "" && v.Severity != severity {
			continue
		}

		result = append(result, v)

		if limit > 0 && len(result) >= limit {
			break
		}
	}

	return result, nil
}

// HealthCheck always returns nil for in-memory store
func (s *MemoryStore) HealthCheck(ctx context.Context) error {
	return nil
}

// Close is a no-op for in-memory store
func (s *MemoryStore) Close() error {
	return nil
}
