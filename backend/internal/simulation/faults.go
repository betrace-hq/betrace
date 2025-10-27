package simulation

import (
	"errors"
	"fmt"
	"os"
	"sync"

	"github.com/betracehq/betrace/backend/internal/storage"
)

// FaultInjector provides deterministic fault injection for simulation testing
type FaultInjector struct {
	mu   sync.RWMutex
	rand *DeterministicRand

	// Fault probabilities (0.0 to 1.0)
	DiskFullProbability    float64
	CorruptionProbability  float64
	SlowIOProbability      float64
	CrashProbability       float64
	PartialWriteProbability float64

	// Fault counters
	DiskFullCount    int
	CorruptionCount  int
	SlowIOCount      int
	CrashCount       int
	PartialWriteCount int

	// Fault modes
	Enabled bool
}

// NewFaultInjector creates a fault injector with the given random source
func NewFaultInjector(rand *DeterministicRand) *FaultInjector {
	return &FaultInjector{
		rand:    rand,
		Enabled: true,

		// Default probabilities (conservative)
		DiskFullProbability:     0.02,  // 2%
		CorruptionProbability:   0.01,  // 1%
		SlowIOProbability:       0.05,  // 5%
		CrashProbability:        0.10,  // 10%
		PartialWriteProbability: 0.03,  // 3%
	}
}

// SetAggressiveMode enables extreme fault injection (for stress testing)
func (f *FaultInjector) SetAggressiveMode() {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.DiskFullProbability = 0.10     // 10%
	f.CorruptionProbability = 0.05   // 5%
	f.SlowIOProbability = 0.15       // 15%
	f.CrashProbability = 0.20        // 20%
	f.PartialWriteProbability = 0.08 // 8%
}

// ShouldInjectDiskFull returns true if disk full error should be injected
func (f *FaultInjector) ShouldInjectDiskFull() bool {
	f.mu.Lock()
	defer f.mu.Unlock()

	if !f.Enabled {
		return false
	}

	if f.rand.Chance(f.DiskFullProbability) {
		f.DiskFullCount++
		return true
	}
	return false
}

// ShouldInjectCorruption returns true if data corruption should be injected
func (f *FaultInjector) ShouldInjectCorruption() bool {
	f.mu.Lock()
	defer f.mu.Unlock()

	if !f.Enabled {
		return false
	}

	if f.rand.Chance(f.CorruptionProbability) {
		f.CorruptionCount++
		return true
	}
	return false
}

// ShouldInjectSlowIO returns true if I/O delay should be injected
func (f *FaultInjector) ShouldInjectSlowIO() bool {
	f.mu.Lock()
	defer f.mu.Unlock()

	if !f.Enabled {
		return false
	}

	if f.rand.Chance(f.SlowIOProbability) {
		f.SlowIOCount++
		return true
	}
	return false
}

// ShouldInjectCrash returns true if crash should be injected
func (f *FaultInjector) ShouldInjectCrash() bool {
	f.mu.Lock()
	defer f.mu.Unlock()

	if !f.Enabled {
		return false
	}

	if f.rand.Chance(f.CrashProbability) {
		f.CrashCount++
		return true
	}
	return false
}

// ShouldInjectPartialWrite returns true if partial write should be injected
func (f *FaultInjector) ShouldInjectPartialWrite() bool {
	f.mu.Lock()
	defer f.mu.Unlock()

	if !f.Enabled {
		return false
	}

	if f.rand.Chance(f.PartialWriteProbability) {
		f.PartialWriteCount++
		return true
	}
	return false
}

// Stats returns fault injection statistics
func (f *FaultInjector) Stats() FaultStats {
	f.mu.RLock()
	defer f.mu.RUnlock()

	return FaultStats{
		DiskFullCount:     f.DiskFullCount,
		CorruptionCount:   f.CorruptionCount,
		SlowIOCount:       f.SlowIOCount,
		CrashCount:        f.CrashCount,
		PartialWriteCount: f.PartialWriteCount,
		TotalFaults:       f.DiskFullCount + f.CorruptionCount + f.SlowIOCount + f.CrashCount + f.PartialWriteCount,
	}
}

// FaultStats tracks fault injection counts
type FaultStats struct {
	DiskFullCount     int
	CorruptionCount   int
	SlowIOCount       int
	CrashCount        int
	PartialWriteCount int
	TotalFaults       int
}

// FaultyFileSystem wraps MockFileSystem with fault injection
type FaultyFileSystem struct {
	fs       *storage.MockFileSystem
	injector *FaultInjector
}

// NewFaultyFileSystem creates a filesystem with fault injection
func NewFaultyFileSystem(injector *FaultInjector) *FaultyFileSystem {
	return &FaultyFileSystem{
		fs:       storage.NewMockFileSystem(),
		injector: injector,
	}
}

// ReadFile implements FileSystem with fault injection
func (ffs *FaultyFileSystem) ReadFile(path string) ([]byte, error) {
	// Inject corruption
	if ffs.injector.ShouldInjectCorruption() {
		data, err := ffs.fs.ReadFile(path)
		if err != nil {
			return nil, err
		}
		// Corrupt random byte
		if len(data) > 0 {
			idx := ffs.injector.rand.Intn(len(data))
			data[idx] = ^data[idx] // Flip all bits
		}
		return data, nil
	}

	// Normal read
	return ffs.fs.ReadFile(path)
}

// WriteFile implements FileSystem with fault injection
func (ffs *FaultyFileSystem) WriteFile(path string, data []byte, perm os.FileMode) error {
	// Inject disk full
	if ffs.injector.ShouldInjectDiskFull() {
		return errors.New("no space left on device")
	}

	// Inject partial write (truncate data)
	if ffs.injector.ShouldInjectPartialWrite() {
		cutoff := ffs.injector.rand.Intn(len(data))
		data = data[:cutoff]
	}

	// Normal write
	return ffs.fs.WriteFile(path, data, perm)
}

// Rename implements FileSystem with fault injection
func (ffs *FaultyFileSystem) Rename(oldpath, newpath string) error {
	// Inject failure during rename (simulates crash)
	if ffs.injector.ShouldInjectCrash() {
		return errors.New("operation interrupted")
	}

	return ffs.fs.Rename(oldpath, newpath)
}

// MkdirAll implements FileSystem
func (ffs *FaultyFileSystem) MkdirAll(path string, perm os.FileMode) error {
	return ffs.fs.MkdirAll(path, perm)
}

// Remove implements FileSystem
func (ffs *FaultyFileSystem) Remove(path string) error {
	return ffs.fs.Remove(path)
}

// Stat implements FileSystem
func (ffs *FaultyFileSystem) Stat(path string) (os.FileInfo, error) {
	return ffs.fs.Stat(path)
}

// GetUnderlyingFS returns the underlying MockFileSystem (for test assertions)
func (ffs *FaultyFileSystem) GetUnderlyingFS() *storage.MockFileSystem {
	return ffs.fs
}

// CrashScenario defines a specific crash timing
type CrashScenario int

const (
	CrashBeforeWrite CrashScenario = iota
	CrashDuringWrite
	CrashAfterWrite
	CrashBeforeRename
	CrashDuringRename
	CrashAfterRename
	CrashDuringSync
	CrashRandomPoint
)

// String returns human-readable crash scenario name
func (cs CrashScenario) String() string {
	switch cs {
	case CrashBeforeWrite:
		return "crash_before_write"
	case CrashDuringWrite:
		return "crash_during_write"
	case CrashAfterWrite:
		return "crash_after_write"
	case CrashBeforeRename:
		return "crash_before_rename"
	case CrashDuringRename:
		return "crash_during_rename"
	case CrashAfterRename:
		return "crash_after_rename"
	case CrashDuringSync:
		return "crash_during_sync"
	case CrashRandomPoint:
		return "crash_random_point"
	default:
		return "unknown"
	}
}

// FaultProfile defines a named set of fault probabilities
type FaultProfile struct {
	Name        string
	Description string

	DiskFullProbability     float64
	CorruptionProbability   float64
	SlowIOProbability       float64
	CrashProbability        float64
	PartialWriteProbability float64
}

// ConservativeProfile returns a low-fault profile for basic testing
func ConservativeProfile() FaultProfile {
	return FaultProfile{
		Name:        "conservative",
		Description: "Low fault rates for basic resilience testing",

		DiskFullProbability:     0.01,
		CorruptionProbability:   0.005,
		SlowIOProbability:       0.02,
		CrashProbability:        0.05,
		PartialWriteProbability: 0.01,
	}
}

// AggressiveProfile returns a high-fault profile for stress testing
func AggressiveProfile() FaultProfile {
	return FaultProfile{
		Name:        "aggressive",
		Description: "High fault rates for extreme stress testing",

		DiskFullProbability:     0.10,
		CorruptionProbability:   0.05,
		SlowIOProbability:       0.15,
		CrashProbability:        0.20,
		PartialWriteProbability: 0.08,
	}
}

// ChaosProfile returns extreme fault rates (inspired by Netflix Chaos Monkey)
func ChaosProfile() FaultProfile {
	return FaultProfile{
		Name:        "chaos",
		Description: "Extreme fault rates to test absolute limits",

		DiskFullProbability:     0.20,
		CorruptionProbability:   0.10,
		SlowIOProbability:       0.25,
		CrashProbability:        0.30,
		PartialWriteProbability: 0.15,
	}
}

// ApplyProfile configures a FaultInjector with the given profile
func (f *FaultInjector) ApplyProfile(profile FaultProfile) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.DiskFullProbability = profile.DiskFullProbability
	f.CorruptionProbability = profile.CorruptionProbability
	f.SlowIOProbability = profile.SlowIOProbability
	f.CrashProbability = profile.CrashProbability
	f.PartialWriteProbability = profile.PartialWriteProbability
}

// Report prints fault injection statistics
func (f *FaultInjector) Report() {
	stats := f.Stats()
	fmt.Printf("\n=== Fault Injection Report ===\n")
	fmt.Printf("Total Faults: %d\n", stats.TotalFaults)
	fmt.Printf("  Disk Full: %d\n", stats.DiskFullCount)
	fmt.Printf("  Corruption: %d\n", stats.CorruptionCount)
	fmt.Printf("  Slow I/O: %d\n", stats.SlowIOCount)
	fmt.Printf("  Crashes: %d\n", stats.CrashCount)
	fmt.Printf("  Partial Writes: %d\n", stats.PartialWriteCount)
	fmt.Printf("\n")
}
