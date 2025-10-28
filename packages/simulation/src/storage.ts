/**
 * MockStorage provides an in-memory implementation of Web Storage API (localStorage/sessionStorage)
 *
 * Supports fault injection for testing error handling:
 * - Quota exceeded errors
 * - Read/write failures
 * - Slow operations
 *
 * @example
 * ```ts
 * const storage = new MockStorage();
 * storage.setItem('key', 'value');
 * storage.quotaExceeded = true; // Inject quota error
 * storage.setItem('another', 'value'); // Throws QuotaExceededError
 * ```
 */
export class MockStorage implements Storage {
  private data: Map<string, string> = new Map();
  private _quotaBytes = 5 * 1024 * 1024; // 5MB default quota

  // Fault injection flags
  public quotaExceeded = false;
  public readError = false;
  public writeError = false;
  public slowOperationMs = 0;

  // Statistics
  public readCount = 0;
  public writeCount = 0;
  public removeCount = 0;

  get length(): number {
    return this.data.size;
  }

  /**
   * Returns the current storage size in bytes
   */
  get usedBytes(): number {
    let total = 0;
    for (const [key, value] of this.data) {
      total += key.length + value.length;
    }
    return total;
  }

  /**
   * Sets the storage quota in bytes
   */
  setQuota(bytes: number): void {
    this._quotaBytes = bytes;
  }

  getItem(key: string): string | null {
    this.readCount++;

    if (this.readError) {
      throw new Error('Storage read error');
    }

    if (this.slowOperationMs > 0) {
      // Simulate slow operation (in real simulation, clock.advance would handle this)
      const start = Date.now();
      while (Date.now() - start < this.slowOperationMs) {
        // Busy wait
      }
    }

    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writeCount++;

    if (this.writeError) {
      throw new Error('Storage write error');
    }

    if (this.slowOperationMs > 0) {
      const start = Date.now();
      while (Date.now() - start < this.slowOperationMs) {
        // Busy wait
      }
    }

    const newSize = this.usedBytes + key.length + value.length;
    if (this.quotaExceeded || newSize > this._quotaBytes) {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    }

    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.removeCount++;
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  /**
   * Returns all keys in storage
   */
  keys(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * Returns all values in storage
   */
  values(): string[] {
    return Array.from(this.data.values());
  }

  /**
   * Returns all key-value pairs
   */
  entries(): [string, string][] {
    return Array.from(this.data.entries());
  }

  /**
   * Resets all fault injection flags and statistics
   */
  reset(): void {
    this.quotaExceeded = false;
    this.readError = false;
    this.writeError = false;
    this.slowOperationMs = 0;
    this.readCount = 0;
    this.writeCount = 0;
    this.removeCount = 0;
  }

  /**
   * Creates a snapshot of current storage state (for crash recovery testing)
   */
  snapshot(): Map<string, string> {
    return new Map(this.data);
  }

  /**
   * Restores storage from a snapshot
   */
  restore(snapshot: Map<string, string>): void {
    this.data = new Map(snapshot);
  }
}

/**
 * MockIndexedDB provides a simplified in-memory IndexedDB implementation
 *
 * Note: This is a minimal implementation for simulation testing.
 * For comprehensive IndexedDB testing, use fake-indexeddb library.
 */
export class MockIndexedDB {
  private databases: Map<string, MockDatabase> = new Map();

  // Fault injection
  public openError = false;
  public transactionError = false;

  open(name: string, version?: number): MockDBRequest {
    if (this.openError) {
      return MockDBRequest.error(new Error('Failed to open database'));
    }

    let db = this.databases.get(name);
    if (!db) {
      db = new MockDatabase(name, version ?? 1);
      this.databases.put(name, db);
    }

    return MockDBRequest.success(db);
  }

  deleteDatabase(name: string): MockDBRequest {
    this.databases.delete(name);
    return MockDBRequest.success(undefined);
  }

  /**
   * Resets all databases and fault flags
   */
  reset(): void {
    this.databases.clear();
    this.openError = false;
    this.transactionError = false;
  }
}

export class MockDatabase {
  constructor(
    public name: string,
    public version: number,
    private stores: Map<string, MockObjectStore> = new Map()
  ) {}

  createObjectStore(name: string, options?: { keyPath?: string }): MockObjectStore {
    const store = new MockObjectStore(name, options?.keyPath);
    this.stores.set(name, store);
    return store;
  }

  transaction(storeNames: string | string[], mode: 'readonly' | 'readwrite' = 'readonly'): MockTransaction {
    return new MockTransaction(
      Array.isArray(storeNames) ? storeNames : [storeNames],
      mode,
      this.stores
    );
  }
}

export class MockObjectStore {
  private data: Map<string, any> = new Map();

  constructor(
    public name: string,
    public keyPath?: string
  ) {}

  add(value: any, key?: string): MockDBRequest {
    const id = key ?? (this.keyPath ? value[this.keyPath] : crypto.randomUUID());
    if (this.data.has(id)) {
      return MockDBRequest.error(new Error('Key already exists'));
    }
    this.data.set(id, value);
    return MockDBRequest.success(id);
  }

  put(value: any, key?: string): MockDBRequest {
    const id = key ?? (this.keyPath ? value[this.keyPath] : crypto.randomUUID());
    this.data.set(id, value);
    return MockDBRequest.success(id);
  }

  get(key: string): MockDBRequest {
    return MockDBRequest.success(this.data.get(key));
  }

  delete(key: string): MockDBRequest {
    this.data.delete(key);
    return MockDBRequest.success(undefined);
  }

  clear(): MockDBRequest {
    this.data.clear();
    return MockDBRequest.success(undefined);
  }

  getAll(): MockDBRequest {
    return MockDBRequest.success(Array.from(this.data.values()));
  }
}

export class MockTransaction {
  constructor(
    public storeNames: string[],
    public mode: 'readonly' | 'readwrite',
    private stores: Map<string, MockObjectStore>
  ) {}

  objectStore(name: string): MockObjectStore {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`Object store '${name}' not found`);
    }
    return store;
  }
}

export class MockDBRequest {
  constructor(
    public result: any,
    public error: Error | null = null
  ) {}

  static success(result: any): MockDBRequest {
    return new MockDBRequest(result, null);
  }

  static error(error: Error): MockDBRequest {
    return new MockDBRequest(null, error);
  }

  get onsuccess(): ((event: any) => void) | null {
    return null;
  }

  set onsuccess(handler: ((event: any) => void) | null) {
    if (handler && !this.error) {
      setTimeout(() => handler({ target: this }), 0);
    }
  }

  get onerror(): ((event: any) => void) | null {
    return null;
  }

  set onerror(handler: ((event: any) => void) | null) {
    if (handler && this.error) {
      setTimeout(() => handler({ target: this }), 0);
    }
  }
}
