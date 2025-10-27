package simulation

import (
	"sync"
	"time"
)

// VirtualClock provides deterministic time control for simulation testing
// Inspired by FoundationDB's simulation clock and TigerBeetle's VOPR
type VirtualClock struct {
	mu          sync.RWMutex
	current     time.Time
	timers      []*VirtualTimer
	nextTimerID int
}

// NewVirtualClock creates a clock starting at the given time
func NewVirtualClock(start time.Time) *VirtualClock {
	return &VirtualClock{
		current: start,
		timers:  make([]*VirtualTimer, 0, 100),
	}
}

// Now returns the current simulated time
func (c *VirtualClock) Now() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.current
}

// Advance moves time forward by the given duration
// Returns slice of timers that fired during this advance
func (c *VirtualClock) Advance(d time.Duration) []*VirtualTimer {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.current = c.current.Add(d)
	fired := make([]*VirtualTimer, 0)

	// Check which timers should fire
	remaining := make([]*VirtualTimer, 0, len(c.timers))
	for _, timer := range c.timers {
		if !timer.deadline.After(c.current) {
			// Timer fired
			fired = append(fired, timer)
			timer.Fire()
		} else {
			// Timer still pending
			remaining = append(remaining, timer)
		}
	}

	c.timers = remaining
	return fired
}

// After schedules a callback to execute after the given duration
// Returns a VirtualTimer that can be cancelled
func (c *VirtualClock) After(d time.Duration, callback func()) *VirtualTimer {
	c.mu.Lock()
	defer c.mu.Unlock()

	timer := &VirtualTimer{
		id:       c.nextTimerID,
		deadline: c.current.Add(d),
		callback: callback,
		clock:    c,
	}
	c.nextTimerID++

	c.timers = append(c.timers, timer)
	return timer
}

// AfterFunc schedules a callback (time.AfterFunc compatible)
func (c *VirtualClock) AfterFunc(d time.Duration, f func()) *VirtualTimer {
	return c.After(d, f)
}

// Sleep advances time (simulated sleep - instant in real time)
func (c *VirtualClock) Sleep(d time.Duration) {
	c.Advance(d)
}

// PendingTimers returns the number of scheduled timers
func (c *VirtualClock) PendingTimers() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.timers)
}

// Reset resets the clock to the given time and cancels all timers
func (c *VirtualClock) Reset(t time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.current = t
	c.timers = make([]*VirtualTimer, 0, 100)
}

// VirtualTimer represents a scheduled callback in simulated time
type VirtualTimer struct {
	id       int
	deadline time.Time
	callback func()
	clock    *VirtualClock
	fired    bool
	mu       sync.Mutex
}

// Fire executes the timer callback (called by clock)
func (t *VirtualTimer) Fire() {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.fired {
		return // Already fired
	}

	t.fired = true
	if t.callback != nil {
		go t.callback() // Execute in goroutine to simulate async
	}
}

// Cancel prevents the timer from firing
func (t *VirtualTimer) Cancel() bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.fired {
		return false
	}

	// Remove from clock's timer list
	t.clock.mu.Lock()
	defer t.clock.mu.Unlock()

	remaining := make([]*VirtualTimer, 0, len(t.clock.timers))
	for _, timer := range t.clock.timers {
		if timer.id != t.id {
			remaining = append(remaining, timer)
		}
	}
	t.clock.timers = remaining

	t.fired = true
	return true
}

// Stop is an alias for Cancel (time.Timer compatible)
func (t *VirtualTimer) Stop() bool {
	return t.Cancel()
}
