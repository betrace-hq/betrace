package services

import (
	"context"
	"fmt"
	"sync"

	"github.com/betracehq/betrace/backend/pkg/models"
	"github.com/google/uuid"
)

// RuleStore provides in-memory storage for BeTrace rules
type RuleStore struct {
	mu    sync.RWMutex
	rules map[string]models.Rule
}

// NewRuleStore creates a new in-memory rule store
func NewRuleStore() *RuleStore {
	return &RuleStore{
		rules: make(map[string]models.Rule),
	}
}

// Create adds a new rule
func (s *RuleStore) Create(ctx context.Context, rule models.Rule) (models.Rule, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Generate ID if not provided
	if rule.ID == "" {
		rule.ID = uuid.New().String()
	}

	// Check for duplicate ID
	if _, exists := s.rules[rule.ID]; exists {
		return models.Rule{}, fmt.Errorf("rule with ID %s already exists", rule.ID)
	}

	s.rules[rule.ID] = rule
	return rule, nil
}

// Get retrieves a rule by ID
func (s *RuleStore) Get(ctx context.Context, id string) (models.Rule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rule, exists := s.rules[id]
	if !exists {
		return models.Rule{}, fmt.Errorf("rule not found: %s", id)
	}

	return rule, nil
}

// List returns all rules
func (s *RuleStore) List(ctx context.Context) ([]models.Rule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rules := make([]models.Rule, 0, len(s.rules))
	for _, rule := range s.rules {
		rules = append(rules, rule)
	}

	return rules, nil
}

// Update modifies an existing rule
func (s *RuleStore) Update(ctx context.Context, id string, rule models.Rule) (models.Rule, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.rules[id]; !exists {
		return models.Rule{}, fmt.Errorf("rule not found: %s", id)
	}

	// Preserve original ID
	rule.ID = id
	s.rules[id] = rule
	return rule, nil
}

// Delete removes a rule
func (s *RuleStore) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.rules[id]; !exists {
		return fmt.Errorf("rule not found: %s", id)
	}

	delete(s.rules, id)
	return nil
}
