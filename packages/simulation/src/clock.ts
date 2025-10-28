/**
 * VirtualClock provides deterministic time control for simulation testing
 *
 * Inspired by FoundationDB's simulation clock and TigerBeetle's VOPR.
 * All time progression is controlled by the test, enabling instant time advancement
 * and perfect reproducibility.
 *
 * @example
 * ```ts
 * const clock = new VirtualClock(new Date('2025-01-01'));
 *
 * // Schedule callbacks
 * clock.setTimeout(() => console.log('fired!'), 1000);
 *
 * // Advance time instantly
 * clock.advance(1000); // Fires callback immediately
 * ```
 */
export class VirtualClock {
  private current: Date;
  private timers: VirtualTimer[] = [];
  private nextTimerID = 0;
  private intervals: Map<number, { callback: () => void; intervalMs: number; nextFire: Date }> = new Map();

  constructor(startTime: Date = new Date('2025-01-01T00:00:00Z')) {
    this.current = new Date(startTime);
  }

  /**
   * Returns the current simulated time
   */
  now(): Date {
    return new Date(this.current);
  }

  /**
   * Advances time by the given milliseconds
   * Fires all timers and intervals that should trigger during this period
   *
   * @returns Array of timer IDs that fired
   */
  advance(ms: number): number[] {
    const targetTime = new Date(this.current.getTime() + ms);
    const firedIDs: number[] = [];

    // Fire timers
    const remainingTimers: VirtualTimer[] = [];
    for (const timer of this.timers) {
      if (timer.deadline <= targetTime) {
        firedIDs.push(timer.id);
        timer.callback();
      } else {
        remainingTimers.push(timer);
      }
    }
    this.timers = remainingTimers;

    // Fire intervals
    for (const [id, interval] of this.intervals) {
      while (interval.nextFire <= targetTime) {
        interval.callback();
        interval.nextFire = new Date(interval.nextFire.getTime() + interval.intervalMs);
        firedIDs.push(id);
      }
    }

    this.current = targetTime;
    return firedIDs;
  }

  /**
   * Schedules a callback to execute after the given delay
   * Compatible with standard setTimeout signature
   */
  setTimeout(callback: () => void, ms: number): VirtualTimer {
    const timer: VirtualTimer = {
      id: this.nextTimerID++,
      deadline: new Date(this.current.getTime() + ms),
      callback,
    };
    this.timers.push(timer);
    return timer;
  }

  /**
   * Schedules a callback to execute repeatedly at the given interval
   * Compatible with standard setInterval signature
   */
  setInterval(callback: () => void, ms: number): number {
    const id = this.nextTimerID++;
    this.intervals.set(id, {
      callback,
      intervalMs: ms,
      nextFire: new Date(this.current.getTime() + ms),
    });
    return id;
  }

  /**
   * Cancels a timeout created by setTimeout
   */
  clearTimeout(timer: VirtualTimer): void {
    this.timers = this.timers.filter(t => t.id !== timer.id);
  }

  /**
   * Cancels an interval created by setInterval
   */
  clearInterval(id: number): void {
    this.intervals.delete(id);
  }

  /**
   * Returns the number of pending timers
   */
  pendingTimers(): number {
    return this.timers.length + this.intervals.size;
  }

  /**
   * Clears all timers and intervals
   */
  reset(): void {
    this.timers = [];
    this.intervals.clear();
  }
}

export interface VirtualTimer {
  id: number;
  deadline: Date;
  callback: () => void;
}
