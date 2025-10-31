package fsm

import (
	"math/rand"
	"os"
	"strconv"
	"sync"
	"testing"
)

// DeterministicRand provides seedable random number generation for reproducible testing
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
	return r.Intn(2) == 1
}

// getSeedFromEnv reads seed from environment variable
func getSeedFromEnv(t *testing.T, envVar string, defaultSeed int64) int64 {
	if seedStr := os.Getenv(envVar); seedStr != "" {
		seed, err := strconv.ParseInt(seedStr, 10, 64)
		if err == nil {
			return seed
		}
	}
	return defaultSeed
}
