/**
 * Test Fixtures - Traces
 *
 * Mock trace data for testing trace drilldown.
 */

export interface MockSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  duration: number;
  tags?: Record<string, any>;
  logs?: Array<{ timestamp: number; fields: Record<string, any> }>;
}

export interface MockTrace {
  traceId: string;
  spans: MockSpan[];
  processes: Record<string, { serviceName: string; tags?: Record<string, any> }>;
}

/**
 * Simple trace with single span
 */
export const singleSpanTrace: MockTrace = {
  traceId: 'trace-single-span',
  spans: [
    {
      spanId: 'span-1',
      traceId: 'trace-single-span',
      operationName: 'GET /api/users',
      startTime: Date.now() * 1000,
      duration: 150000,
      tags: {
        'http.method': 'GET',
        'http.url': '/api/users',
        'http.status_code': 200,
      },
    },
  ],
  processes: {
    p1: {
      serviceName: 'api-service',
      tags: {
        'service.version': '1.0.0',
      },
    },
  },
};

/**
 * Trace with multiple spans (parent-child)
 */
export const multiSpanTrace: MockTrace = {
  traceId: 'trace-multi-span',
  spans: [
    {
      spanId: 'span-1',
      traceId: 'trace-multi-span',
      operationName: 'GET /api/orders',
      startTime: Date.now() * 1000,
      duration: 500000,
      tags: {
        'http.method': 'GET',
        'http.url': '/api/orders',
      },
    },
    {
      spanId: 'span-2',
      traceId: 'trace-multi-span',
      parentSpanId: 'span-1',
      operationName: 'SELECT orders',
      startTime: Date.now() * 1000 + 10000,
      duration: 250000,
      tags: {
        'db.type': 'sql',
        'db.statement': 'SELECT * FROM orders',
      },
    },
    {
      spanId: 'span-3',
      traceId: 'trace-multi-span',
      parentSpanId: 'span-1',
      operationName: 'GET /api/users/{id}',
      startTime: Date.now() * 1000 + 270000,
      duration: 100000,
      tags: {
        'http.method': 'GET',
      },
    },
  ],
  processes: {
    p1: { serviceName: 'api-service' },
    p2: { serviceName: 'database' },
  },
};

/**
 * Trace with error span
 */
export const errorTrace: MockTrace = {
  traceId: 'trace-with-error',
  spans: [
    {
      spanId: 'span-error',
      traceId: 'trace-with-error',
      operationName: 'POST /api/payments',
      startTime: Date.now() * 1000,
      duration: 50000,
      tags: {
        'http.method': 'POST',
        'http.status_code': 500,
        error: true,
        'error.message': 'Payment gateway timeout',
      },
      logs: [
        {
          timestamp: Date.now() * 1000 + 40000,
          fields: {
            event: 'error',
            'error.kind': 'timeout',
            message: 'Payment gateway did not respond',
          },
        },
      ],
    },
  ],
  processes: {
    p1: { serviceName: 'payment-service' },
  },
};

/**
 * Slow trace (duration > 1 second)
 */
export const slowTrace: MockTrace = {
  traceId: 'trace-slow',
  spans: [
    {
      spanId: 'span-slow',
      traceId: 'trace-slow',
      operationName: 'GET /api/reports/generate',
      startTime: Date.now() * 1000,
      duration: 2500000000, // 2.5 seconds
      tags: {
        'http.method': 'GET',
        'http.url': '/api/reports/generate',
      },
    },
  ],
  processes: {
    p1: { serviceName: 'report-service' },
  },
};

/**
 * Test trace IDs
 */
export const testTraceIds = {
  valid: 'trace-valid-12345',
  invalid: 'invalid!@#$%',
  notFound: 'trace-not-found',
  error: 'trace-error',
  slow: 'trace-slow',
  multiSpan: 'trace-multi-span',
};

/**
 * Helper: Generate random trace ID
 */
export function randomTraceId(): string {
  return `trace-${Math.random().toString(36).substring(7)}-${Date.now()}`;
}

/**
 * Helper: Generate mock span
 */
export function createMockSpan(overrides?: Partial<MockSpan>): MockSpan {
  return {
    spanId: `span-${Math.random().toString(36).substring(7)}`,
    traceId: randomTraceId(),
    operationName: 'test-operation',
    startTime: Date.now() * 1000,
    duration: 100000,
    ...overrides,
  };
}

/**
 * Helper: Generate mock trace
 */
export function createMockTrace(spanCount = 1, traceId?: string): MockTrace {
  const id = traceId || randomTraceId();

  return {
    traceId: id,
    spans: Array.from({ length: spanCount }, (_, i) =>
      createMockSpan({
        traceId: id,
        spanId: `span-${i + 1}`,
        parentSpanId: i > 0 ? `span-${i}` : undefined,
        operationName: `operation-${i + 1}`,
      })
    ),
    processes: {
      p1: { serviceName: 'test-service' },
    },
  };
}
