import { DeterministicRandom } from './random.js';

/**
 * MockHTTP provides a deterministic HTTP client for simulation testing
 *
 * Supports:
 * - Request/response mocking
 * - Fault injection (network errors, timeouts, slow responses)
 * - Response recording for verification
 * - Deterministic delays
 *
 * @example
 * ```ts
 * const http = new MockHTTP(rng);
 *
 * // Mock responses
 * http.mockResponse('GET', '/api/rules', { status: 200, body: { rules: [] } });
 *
 * // Inject faults
 * http.networkError = true;
 * await http.fetch('/api/rules'); // Throws network error
 * ```
 */
export class MockHTTP {
  private mocks: Map<string, MockResponse> = new Map();
  private requests: RecordedRequest[] = [];

  // Fault injection flags
  public networkError = false;
  public timeoutError = false;
  public slowResponseMs = 0;
  public errorProbability = 0.0;

  // Statistics
  public requestCount = 0;

  constructor(private rng?: DeterministicRandom) {}

  /**
   * Mocks a response for a specific method and URL pattern
   */
  mockResponse(method: string, urlPattern: string | RegExp, response: Partial<MockResponse>): void {
    const key = `${method}:${urlPattern}`;
    this.mocks.set(key, {
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      headers: response.headers ?? {},
      body: response.body,
      delay: response.delay ?? 0,
    });
  }

  /**
   * Mocks multiple responses in sequence for the same endpoint
   */
  mockSequence(method: string, urlPattern: string | RegExp, responses: Partial<MockResponse>[]): void {
    let callCount = 0;
    const key = `${method}:${urlPattern}`;

    this.mocks.set(key, {
      status: 200,
      body: null,
      factory: () => {
        const response = responses[callCount] ?? responses[responses.length - 1];
        callCount++;
        return {
          status: response.status ?? 200,
          statusText: response.statusText ?? 'OK',
          headers: response.headers ?? {},
          body: response.body,
        };
      },
    });
  }

  /**
   * Fetch implementation (compatible with standard fetch API)
   */
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    this.requestCount++;

    const method = init?.method ?? 'GET';
    const headers = init?.headers ?? {};
    const body = init?.body;

    // Record request
    this.requests.push({
      method,
      url,
      headers: this.normalizeHeaders(headers),
      body: body ? String(body) : undefined,
      timestamp: Date.now(),
    });

    // Inject random errors
    if (this.rng && this.rng.chance(this.errorProbability)) {
      throw new Error('Simulated network error');
    }

    // Inject deterministic errors
    if (this.networkError) {
      throw new Error('Network error');
    }

    if (this.timeoutError) {
      throw new Error('Request timeout');
    }

    // Find matching mock
    const mock = this.findMock(method, url);
    if (!mock) {
      throw new Error(`No mock found for ${method} ${url}`);
    }

    // Apply delay (simulated slow network)
    if (mock.delay || this.slowResponseMs) {
      await this.sleep(mock.delay ?? this.slowResponseMs);
    }

    // Generate response (handle factory or static mock)
    const responseData = mock.factory ? mock.factory() : mock;

    return new Response(
      responseData.body ? JSON.stringify(responseData.body) : null,
      {
        status: responseData.status,
        statusText: responseData.statusText,
        headers: new Headers(responseData.headers),
      }
    );
  }

  /**
   * Returns all recorded requests
   */
  getRequests(): RecordedRequest[] {
    return [...this.requests];
  }

  /**
   * Returns requests matching the given method and URL pattern
   */
  getRequestsTo(method: string, urlPattern: string | RegExp): RecordedRequest[] {
    return this.requests.filter(req => {
      if (req.method !== method) return false;
      if (typeof urlPattern === 'string') {
        return req.url === urlPattern;
      }
      return urlPattern.test(req.url);
    });
  }

  /**
   * Clears all recorded requests
   */
  clearRequests(): void {
    this.requests = [];
  }

  /**
   * Clears all mocks
   */
  clearMocks(): void {
    this.mocks.clear();
  }

  /**
   * Resets all state (mocks, requests, fault flags)
   */
  reset(): void {
    this.mocks.clear();
    this.requests = [];
    this.networkError = false;
    this.timeoutError = false;
    this.slowResponseMs = 0;
    this.errorProbability = 0.0;
    this.requestCount = 0;
  }

  private findMock(method: string, url: string): MockResponse | undefined {
    // Try exact match first
    const exactKey = `${method}:${url}`;
    const exactMock = this.mocks.get(exactKey);
    if (exactMock) return exactMock;

    // Try regex patterns
    for (const [key, mock] of this.mocks) {
      const [mockMethod, pattern] = key.split(':', 2);
      if (mockMethod !== method) continue;

      try {
        const regex = new RegExp(pattern);
        if (regex.test(url)) return mock;
      } catch {
        // Not a valid regex, skip
      }
    }

    return undefined;
  }

  private normalizeHeaders(headers: HeadersInit): Record<string, string> {
    if (headers instanceof Headers) {
      const normalized: Record<string, string> = {};
      headers.forEach((value, key) => {
        normalized[key] = value;
      });
      return normalized;
    }

    if (Array.isArray(headers)) {
      const normalized: Record<string, string> = {};
      for (const [key, value] of headers) {
        normalized[key] = value;
      }
      return normalized;
    }

    return headers as Record<string, string>;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export interface MockResponse {
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any;
  delay?: number;
  factory?: () => Omit<MockResponse, 'factory' | 'delay'>;
}

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}
