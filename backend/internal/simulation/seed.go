package simulation

import (
	"math/rand"
	"sync"
)

// DeterministicRand provides seedable random number generation for reproducible simulation
type DeterministicRand struct {
	mu   sync.Mutex
	rand *rand.Rand
	seed int64
}

// NewDeterministicRand creates a new seeded random source
func NewDeterministicRand(seed int64) *DeterministicRand {
	return &DeterministicRand{
		rand: rand.New(rand.NewSource(seed)),
		seed: seed,
	}
}

// Seed returns the initial seed value (for reproduction)
func (r *DeterministicRand) Seed() int64 {
	return r.seed
}

// Int63 returns a random 63-bit positive integer
func (r *DeterministicRand) Int63() int64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rand.Int63()
}

// Int returns a random int
func (r *DeterministicRand) Int() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rand.Int()
}

// Intn returns a random integer in [0, n)
func (r *DeterministicRand) Intn(n int) int {
	if n <= 0 {
		panic("invalid argument to Intn")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rand.Intn(n)
}

// Float64 returns a random float in [0.0, 1.0)
func (r *DeterministicRand) Float64() float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rand.Float64()
}

// Bool returns a random boolean
func (r *DeterministicRand) Bool() bool {
	return r.Float64() < 0.5
}

// Chance returns true with the given probability (0.0 to 1.0)
func (r *DeterministicRand) Chance(probability float64) bool {
	if probability <= 0.0 {
		return false
	}
	if probability >= 1.0 {
		return true
	}
	return r.Float64() < probability
}

// Choice returns a random element from the slice
func (r *DeterministicRand) Choice(slice []string) string {
	if len(slice) == 0 {
		return ""
	}
	return slice[r.Intn(len(slice))]
}

// Shuffle randomizes the order of elements in a slice
func (r *DeterministicRand) Shuffle(n int, swap func(i, j int)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rand.Shuffle(n, swap)
}

// Duration returns a random duration between min and max
func (r *DeterministicRand) Duration(min, max int64) int64 {
	if min >= max {
		return min
	}
	return min + r.Int63()%(max-min)
}

// String generates a random string of the given length
func (r *DeterministicRand) String(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[r.Intn(len(charset))]
	}
	return string(b)
}

// UUID generates a deterministic UUID (for span/trace IDs)
func (r *DeterministicRand) UUID() string {
	// Simple hex-based UUID: 8-4-4-4-12 format
	return r.hex(8) + "-" + r.hex(4) + "-" + r.hex(4) + "-" + r.hex(4) + "-" + r.hex(12)
}

func (r *DeterministicRand) hex(length int) string {
	const hexchars = "0123456789abcdef"
	b := make([]byte, length)
	for i := range b {
		b[i] = hexchars[r.Intn(16)]
	}
	return string(b)
}
