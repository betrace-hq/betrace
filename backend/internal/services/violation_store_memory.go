package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/betracehq/betrace/backend/internal/storage"
	"github.com/betracehq/betrace/backend/pkg/models"
	"github.com/google/uuid"
)

// ViolationStoreMemory uses in-memory storage (for development)
type ViolationStoreMemory struct {
	store          *storage.MemoryStore
	signatureKey   []byte
	signingEnabled bool
}

// NewViolationStoreMemory creates a violation store with in-memory storage
func NewViolationStoreMemory(signatureKey string) *ViolationStoreMemory {
	return &ViolationStoreMemory{
		store:          storage.NewMemoryStore(),
		signatureKey:   []byte(signatureKey),
		signingEnabled: len(signatureKey) > 0,
	}
}

// Record stores a violation with cryptographic signature and returns the stored violation with generated ID
func (s *ViolationStoreMemory) Record(ctx context.Context, violation models.Violation, traceRefs []models.SpanRef) (models.Violation, error) {
	// Generate ID if not provided
	if violation.ID == "" {
		violation.ID = uuid.New().String()
	}

	// Set timestamp
	if violation.CreatedAt.IsZero() {
		violation.CreatedAt = time.Now()
	}

	// Sign violation for provenance
	if s.signingEnabled {
		violation.Signature = s.signViolation(violation)
	}

	// Store references
	violation.SpanRefs = traceRefs
	traceIDs := make([]string, len(traceRefs))
	for i, ref := range traceRefs {
		traceIDs[i] = ref.TraceID
	}
	violation.TraceIDs = traceIDs

	err := s.store.StoreViolation(ctx, violation)
	return violation, err
}

// Query retrieves violations with optional filters
func (s *ViolationStoreMemory) Query(ctx context.Context, filters QueryFilters) ([]models.Violation, error) {
	return s.store.QueryViolations(ctx, filters.RuleID, filters.Severity, filters.Limit)
}

// GetByID retrieves a single violation by ID
func (s *ViolationStoreMemory) GetByID(ctx context.Context, id string) (*models.Violation, error) {
	v, err := s.store.GetViolation(ctx, id)
	if err != nil {
		return nil, err
	}

	// Verify signature
	if s.signingEnabled && !s.verifySignature(*v) {
		return nil, fmt.Errorf("violation signature verification failed")
	}

	return v, nil
}

// signViolation generates HMAC-SHA256 signature
func (s *ViolationStoreMemory) signViolation(v models.Violation) string {
	h := hmac.New(sha256.New, s.signatureKey)
	h.Write([]byte(v.ID))
	h.Write([]byte(v.RuleID))
	h.Write([]byte(v.Message))
	return hex.EncodeToString(h.Sum(nil))
}

// verifySignature checks violation signature integrity
func (s *ViolationStoreMemory) verifySignature(v models.Violation) bool {
	expected := s.signViolation(v)
	return hmac.Equal([]byte(expected), []byte(v.Signature))
}

// QueryFilters defines violation query parameters
type QueryFilters struct {
	RuleID   string
	Severity string
	Since    time.Time
	Limit    int
}
