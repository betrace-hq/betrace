package services

import (
	"context"
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// P1 Security Tests - Signature Tampering & Edge Cases

func TestViolationStoreMemory_SignatureTampering(t *testing.T) {
	store := NewViolationStoreMemory("test-signature-key")
	ctx := context.Background()

	// Record violation with signature
	violation := models.Violation{
		RuleID:   "rule-tamper",
		RuleName: "Tampering Test",
		Severity: "HIGH",
		Message:  "Original message",
	}

	stored, err := store.Record(ctx, violation, nil)
	if err != nil {
		t.Fatalf("Failed to record violation: %v", err)
	}

	originalSignature := stored.Signature
	if originalSignature == "" {
		t.Fatal("Expected signature to be generated")
	}

	// Simulate tampering: Modify the stored violation's message
	// In real storage, attacker would modify database directly
	// For in-memory, we'll manually alter the stored violation
	tamperedViolation := stored
	tamperedViolation.Message = "Tampered message"

	// Manually verify signature with tampered data
	// This simulates what happens when GetByID verifies signature
	if store.verifySignature(tamperedViolation) {
		t.Error("Signature verification should FAIL for tampered violation")
	}

	// Original (untampered) should still verify
	if !store.verifySignature(stored) {
		t.Error("Signature verification should PASS for original violation")
	}
}

func TestViolationStoreMemory_SignatureWithDifferentKeys(t *testing.T) {
	ctx := context.Background()

	// Store violation with key-v1
	store1 := NewViolationStoreMemory("key-version-1")
	violation := models.Violation{
		ID:       "test-id",
		RuleID:   "rule-1",
		RuleName: "Key Test",
		Severity: "HIGH",
		Message:  "Test message",
	}

	stored, err := store1.Record(ctx, violation, nil)
	if err != nil {
		t.Fatalf("Failed to record violation: %v", err)
	}

	signatureV1 := stored.Signature

	// Create new store with different key
	store2 := NewViolationStoreMemory("key-version-2")

	// Try to verify signature with different key
	if store2.verifySignature(stored) {
		t.Error("Signature verification should FAIL with different key")
	}

	// Verify original store can still verify
	if !store1.verifySignature(stored) {
		t.Error("Original store should verify its own signature")
	}

	// Verify signatures are deterministic for same key
	signature2 := store1.signViolation(stored)
	if signature2 != signatureV1 {
		t.Error("Same violation + same key should produce same signature")
	}
}

func TestViolationStoreMemory_SignatureWithEmptyKey(t *testing.T) {
	ctx := context.Background()

	// Store with empty signature key (signing disabled)
	store := NewViolationStoreMemory("")

	violation := models.Violation{
		RuleID:   "rule-no-key",
		RuleName: "No Key Test",
		Severity: "HIGH",
		Message:  "Test message",
	}

	stored, err := store.Record(ctx, violation, nil)
	if err != nil {
		t.Fatalf("Failed to record violation: %v", err)
	}

	// Signature should be empty when signing disabled
	if stored.Signature != "" {
		t.Errorf("Expected empty signature when key is empty, got %s", stored.Signature)
	}

	// Retrieve should not fail even without signature
	retrieved, err := store.GetByID(ctx, stored.ID)
	if err != nil {
		t.Errorf("GetByID should succeed even without signature: %v", err)
	}

	if retrieved.ID != stored.ID {
		t.Error("Retrieved violation should match stored violation")
	}
}

func TestViolationStoreMemory_SignatureFieldTampering(t *testing.T) {
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	// Record violation
	violation := models.Violation{
		RuleID:   "rule-sig-tamper",
		RuleName: "Signature Field Tampering",
		Severity: "HIGH",
		Message:  "Original",
	}

	stored, err := store.Record(ctx, violation, nil)
	if err != nil {
		t.Fatalf("Failed to record: %v", err)
	}

	originalSig := stored.Signature

	// Tamper with signature field itself
	tamperedViolation := stored
	tamperedViolation.Signature = "00000000000000000000000000000000"

	if store.verifySignature(tamperedViolation) {
		t.Error("Verification should fail when signature field is tampered")
	}

	// Restore original signature - should verify again
	tamperedViolation.Signature = originalSig
	if !store.verifySignature(tamperedViolation) {
		t.Error("Verification should pass with original signature")
	}
}

func TestViolationStoreMemory_SignatureTimingAttack(t *testing.T) {
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	// Record violation
	violation := models.Violation{
		RuleID:   "rule-timing",
		RuleName: "Timing Attack Test",
		Severity: "HIGH",
		Message:  "Test",
	}

	stored, err := store.Record(ctx, violation, nil)
	if err != nil {
		t.Fatalf("Failed to record: %v", err)
	}

	originalSig := stored.Signature

	// Test multiple incorrect signatures
	// hmac.Equal (used in verifySignature) is constant-time
	incorrectSignatures := []string{
		"0000000000000000000000000000000000000000000000000000000000000000",
		"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
		"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		originalSig[:len(originalSig)-1] + "0", // Off by one character
	}

	for _, incorrectSig := range incorrectSignatures {
		// Create a copy and modify signature
		tamperedViolation := models.Violation{
			ID:        stored.ID,
			RuleID:    stored.RuleID,
			RuleName:  stored.RuleName,
			Severity:  stored.Severity,
			Message:   stored.Message,
			TraceIDs:  stored.TraceIDs,
			SpanRefs:  stored.SpanRefs,
			CreatedAt: stored.CreatedAt,
			Signature: incorrectSig, // Use incorrect signature
		}

		if store.verifySignature(tamperedViolation) {
			t.Errorf("Verification should fail for incorrect signature: %s", incorrectSig)
		}
	}

	// Correct signature should verify
	if !store.verifySignature(stored) {
		t.Error("Verification should pass for correct signature")
	}
}

func TestViolationStoreMemory_SignatureReplayAttack(t *testing.T) {
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	// Record violation
	violation1 := models.Violation{
		ID:       "violation-1",
		RuleID:   "rule-replay",
		RuleName: "Replay Attack Test",
		Severity: "HIGH",
		Message:  "Message 1",
	}

	stored1, err := store.Record(ctx, violation1, nil)
	if err != nil {
		t.Fatalf("Failed to record violation1: %v", err)
	}

	// Record different violation
	violation2 := models.Violation{
		ID:       "violation-2",
		RuleID:   "rule-replay",
		RuleName: "Replay Attack Test",
		Severity: "HIGH",
		Message:  "Message 2",
	}

	stored2, err := store.Record(ctx, violation2, nil)
	if err != nil {
		t.Fatalf("Failed to record violation2: %v", err)
	}

	// Try to use violation1's signature on violation2 (replay attack)
	replayedViolation := stored2
	replayedViolation.Signature = stored1.Signature

	if store.verifySignature(replayedViolation) {
		t.Error("Verification should fail when signature is replayed from different violation")
	}

	// Each violation should verify with its own signature
	if !store.verifySignature(stored1) {
		t.Error("Violation1 should verify with its own signature")
	}
	if !store.verifySignature(stored2) {
		t.Error("Violation2 should verify with its own signature")
	}
}

func TestViolationStoreMemory_SignatureDeterminism(t *testing.T) {
	store := NewViolationStoreMemory("deterministic-key")

	violation := models.Violation{
		ID:       "test-id",
		RuleID:   "rule-det",
		RuleName: "Determinism Test",
		Severity: "HIGH",
		Message:  "Deterministic test",
	}

	// Generate signature multiple times
	sig1 := store.signViolation(violation)
	sig2 := store.signViolation(violation)
	sig3 := store.signViolation(violation)

	// All signatures should be identical
	if sig1 != sig2 {
		t.Error("Signature generation should be deterministic (sig1 != sig2)")
	}
	if sig2 != sig3 {
		t.Error("Signature generation should be deterministic (sig2 != sig3)")
	}

	// Modify one field - signature should change
	violation.Message = "Modified message"
	sig4 := store.signViolation(violation)

	if sig1 == sig4 {
		t.Error("Signature should change when violation data changes")
	}
}

func TestViolationStoreMemory_SignatureLength(t *testing.T) {
	store := NewViolationStoreMemory("test-key")

	violation := models.Violation{
		ID:       "test-id",
		RuleID:   "rule-len",
		RuleName: "Length Test",
		Severity: "HIGH",
		Message:  "Test",
	}

	signature := store.signViolation(violation)

	// HMAC-SHA256 produces 32-byte hash, hex-encoded = 64 characters
	expectedLength := 64
	if len(signature) != expectedLength {
		t.Errorf("Expected signature length %d, got %d", expectedLength, len(signature))
	}

	// Verify signature is valid hex
	for _, c := range signature {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("Signature should be lowercase hex, found char: %c", c)
		}
	}
}

func TestViolationStoreMemory_SignatureNullByteHandling(t *testing.T) {
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	// Violation with null byte in message (edge case)
	violation := models.Violation{
		RuleID:   "rule-null",
		RuleName: "Null Byte Test",
		Severity: "HIGH",
		Message:  "Message with null\x00byte",
	}

	// Record with null byte
	stored, err := store.Record(ctx, violation, nil)
	if err != nil {
		t.Fatalf("Failed to record violation with null byte: %v", err)
	}

	if stored.Signature == "" {
		t.Error("Signature generation should handle null bytes")
	}

	// Retrieve and verify signature automatically checked
	retrieved, err := store.GetByID(ctx, stored.ID)
	if err != nil {
		t.Errorf("GetByID should succeed with null bytes: %v", err)
	}

	if retrieved.Message != violation.Message {
		t.Error("Message with null byte should be preserved")
	}
}

func TestViolationStoreMemory_SignatureEmptyFields(t *testing.T) {
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	// Violation with empty fields (ID will be auto-generated)
	violation := models.Violation{
		RuleID:   "",
		RuleName: "Empty Fields Test",
		Severity: "HIGH",
		Message:  "",
	}

	// Record should succeed with empty fields
	stored, err := store.Record(ctx, violation, nil)
	if err != nil {
		t.Fatalf("Failed to record violation with empty fields: %v", err)
	}

	if stored.Signature == "" {
		t.Error("Signature should be generated even for empty fields")
	}

	if stored.ID == "" {
		t.Error("ID should be auto-generated")
	}

	// Retrieve should succeed
	retrieved, err := store.GetByID(ctx, stored.ID)
	if err != nil {
		t.Errorf("GetByID should succeed with empty fields: %v", err)
	}

	if retrieved.RuleID != "" {
		t.Errorf("Empty RuleID should be preserved, got %s", retrieved.RuleID)
	}
}

// Benchmark signature operations

func BenchmarkViolationStore_SignViolation(b *testing.B) {
	store := NewViolationStoreMemory("benchmark-key")

	violation := models.Violation{
		ID:       "bench-id",
		RuleID:   "rule-bench",
		RuleName: "Benchmark Rule",
		Severity: "HIGH",
		Message:  "Benchmark message for signature generation",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		store.signViolation(violation)
	}
}

func BenchmarkViolationStore_VerifySignature(b *testing.B) {
	store := NewViolationStoreMemory("benchmark-key")

	violation := models.Violation{
		ID:       "bench-id",
		RuleID:   "rule-bench",
		RuleName: "Benchmark Rule",
		Severity: "HIGH",
		Message:  "Benchmark message",
	}

	violation.Signature = store.signViolation(violation)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		store.verifySignature(violation)
	}
}
