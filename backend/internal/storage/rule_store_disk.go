package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// DiskRuleStore persists rules to disk for recovery after restart
type DiskRuleStore struct {
	mu       sync.RWMutex
	rules    map[string]models.Rule
	dataDir  string
	filePath string
	fs       FileSystem // Injected filesystem for testing
}

// NewDiskRuleStore creates a rule store backed by disk persistence
func NewDiskRuleStore(dataDir string) (*DiskRuleStore, error) {
	return NewDiskRuleStoreWithFS(dataDir, &RealFileSystem{})
}

// NewDiskRuleStoreWithFS creates a rule store with injectable filesystem (for testing)
func NewDiskRuleStoreWithFS(dataDir string, fs FileSystem) (*DiskRuleStore, error) {
	// Create data directory if it doesn't exist
	if err := fs.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	store := &DiskRuleStore{
		rules:    make(map[string]models.Rule),
		dataDir:  dataDir,
		filePath: filepath.Join(dataDir, "rules.json"),
		fs:       fs,
	}

	// Load existing rules from disk
	if err := store.load(); err != nil {
		// If file doesn't exist, that's OK (fresh start)
		if _, statErr := fs.Stat(store.filePath); os.IsNotExist(statErr) {
			return store, nil
		}
		return nil, fmt.Errorf("failed to load rules: %w", err)
	}

	return store, nil
}

// Create adds a new rule and persists to disk
func (s *DiskRuleStore) Create(rule models.Rule) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.rules[rule.ID]; exists {
		return fmt.Errorf("rule %s already exists", rule.ID)
	}

	s.rules[rule.ID] = rule
	return s.persist()
}

// Update modifies an existing rule and persists to disk
func (s *DiskRuleStore) Update(rule models.Rule) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.rules[rule.ID]; !exists {
		return fmt.Errorf("rule %s not found", rule.ID)
	}

	s.rules[rule.ID] = rule
	return s.persist()
}

// Delete removes a rule and persists to disk
func (s *DiskRuleStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.rules[id]; !exists {
		return fmt.Errorf("rule %s not found", id)
	}

	delete(s.rules, id)
	return s.persist()
}

// Get retrieves a single rule
func (s *DiskRuleStore) Get(id string) (models.Rule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rule, exists := s.rules[id]
	if !exists {
		return models.Rule{}, fmt.Errorf("rule %s not found", id)
	}

	return rule, nil
}

// List returns all rules
func (s *DiskRuleStore) List() ([]models.Rule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rules := make([]models.Rule, 0, len(s.rules))
	for _, rule := range s.rules {
		rules = append(rules, rule)
	}

	return rules, nil
}

// persist writes all rules to disk atomically
func (s *DiskRuleStore) persist() error {
	// Marshal rules to JSON
	data, err := json.MarshalIndent(s.rules, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal rules: %w", err)
	}

	// Write to temporary file first
	tmpPath := s.filePath + ".tmp"
	if err := s.fs.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write rules: %w", err)
	}

	// Atomic rename (crash-safe)
	if err := s.fs.Rename(tmpPath, s.filePath); err != nil {
		return fmt.Errorf("failed to rename rules file: %w", err)
	}

	return nil
}

// load reads rules from disk
func (s *DiskRuleStore) load() error {
	data, err := s.fs.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	rules := make(map[string]models.Rule)
	if err := json.Unmarshal(data, &rules); err != nil {
		return fmt.Errorf("failed to unmarshal rules: %w", err)
	}

	s.rules = rules
	return nil
}

// Count returns the number of rules
func (s *DiskRuleStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.rules)
}
