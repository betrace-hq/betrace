/**
 * DeterministicRandom provides seedable random number generation for reproducible simulations
 *
 * Uses a Linear Congruential Generator (LCG) for predictable, reproducible randomness.
 * Same seed always produces the same sequence of numbers.
 *
 * @example
 * ```ts
 * const rng = new DeterministicRandom(12345);
 * rng.int(100);  // Always returns same value for seed 12345
 * rng.choice(['a', 'b', 'c']); // Always picks same element
 * ```
 */
export class DeterministicRandom {
  private state: number;
  private readonly initialSeed: number;

  // LCG constants (from Numerical Recipes)
  private readonly a = 1664525;
  private readonly c = 1013904223;
  private readonly m = 2 ** 32;

  constructor(seed: number) {
    this.initialSeed = seed;
    this.state = seed;
  }

  /**
   * Returns the initial seed value (for reproduction)
   */
  seed(): number {
    return this.initialSeed;
  }

  /**
   * Returns a random integer in [0, 2^32)
   */
  private next(): number {
    this.state = (this.a * this.state + this.c) % this.m;
    return this.state;
  }

  /**
   * Returns a random integer in [0, max)
   */
  int(max: number): number {
    if (max <= 0) {
      throw new Error('max must be positive');
    }
    return this.next() % max;
  }

  /**
   * Returns a random float in [0.0, 1.0)
   */
  float(): number {
    return this.next() / this.m;
  }

  /**
   * Returns a random boolean
   */
  bool(): boolean {
    return this.float() < 0.5;
  }

  /**
   * Returns true with the given probability (0.0 to 1.0)
   */
  chance(probability: number): boolean {
    if (probability <= 0.0) return false;
    if (probability >= 1.0) return true;
    return this.float() < probability;
  }

  /**
   * Returns a random element from the array
   */
  choice<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    return arr[this.int(arr.length)];
  }

  /**
   * Shuffles an array in place (Fisher-Yates shuffle)
   */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Returns a random integer in [min, max)
   */
  range(min: number, max: number): number {
    if (min >= max) {
      throw new Error('min must be less than max');
    }
    return min + this.int(max - min);
  }

  /**
   * Returns a random string of the given length
   */
  string(length: number, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[this.int(charset.length)];
    }
    return result;
  }

  /**
   * Returns a deterministic UUID (v4 format)
   */
  uuid(): string {
    const hex = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4'; // Version 4
      } else if (i === 19) {
        uuid += hex[this.int(4) + 8]; // Variant bits
      } else {
        uuid += hex[this.int(16)];
      }
    }
    return uuid;
  }

  /**
   * Returns a random date between start and end
   */
  date(start: Date, end: Date): Date {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const randomMs = startMs + this.float() * (endMs - startMs);
    return new Date(randomMs);
  }

  /**
   * Returns a sample of n elements from the array without replacement
   */
  sample<T>(arr: T[], n: number): T[] {
    if (n > arr.length) {
      throw new Error('Sample size cannot exceed array length');
    }
    const copy = [...arr];
    this.shuffle(copy);
    return copy.slice(0, n);
  }
}
