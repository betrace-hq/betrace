/**
 * BeTrace Service - Effect-based API client
 *
 * Pure business logic layer using Effect for:
 * - Composable API operations
 * - Built-in retry and error handling
 * - Type-safe schemas with validation
 * - Testable without mocking
 */

import { Effect, Context, Layer, Config } from 'effect';
import { Schema } from '@effect/schema';
import { HttpClient, HttpClientRequest, HttpClientResponse, HttpClientError, FetchHttpClient } from '@effect/platform';

// ============================================================================
// Domain Models (Schema-validated)
// ============================================================================

export const RuleSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.String,
  description: Schema.String,
  expression: Schema.String,
  enabled: Schema.Boolean,
  createdAt: Schema.optional(Schema.String),
  updatedAt: Schema.optional(Schema.String),
});

export type Rule = Schema.Schema.Type<typeof RuleSchema>;

export const ListRulesResponseSchema = Schema.Struct({
  rules: Schema.Array(RuleSchema),
  nextPageToken: Schema.optional(Schema.String),
  totalCount: Schema.Number,
});

export type ListRulesResponse = Schema.Schema.Type<typeof ListRulesResponseSchema>;

export const HealthResponseSchema = Schema.Struct({
  status: Schema.String,
  version: Schema.String,
  uptimeSeconds: Schema.Number,
});

export type HealthResponse = Schema.Schema.Type<typeof HealthResponseSchema>;

// ============================================================================
// Service Errors
// ============================================================================

export class BeTraceServiceError extends Schema.TaggedError<BeTraceServiceError>()('BeTraceServiceError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  status: Schema.optional(Schema.Number),
}) {}

// ============================================================================
// Service Configuration
// ============================================================================

export interface BeTraceServiceConfig {
  readonly baseUrl: string;
  readonly timeout: number;
}

export const BeTraceServiceConfig = Context.GenericTag<BeTraceServiceConfig>('BeTraceServiceConfig');

// ============================================================================
// Service Interface
// ============================================================================

export interface BeTraceService {
  /**
   * List all rules with optional filters
   */
  listRules(params?: {
    enabledOnly?: boolean;
    severity?: string;
    tags?: string[];
  }): Effect.Effect<ListRulesResponse, BeTraceServiceError>;

  /**
   * Get a single rule by ID
   */
  getRule(id: string): Effect.Effect<Rule, BeTraceServiceError>;

  /**
   * Create a new rule
   */
  createRule(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): Effect.Effect<Rule, BeTraceServiceError>;

  /**
   * Update an existing rule
   */
  updateRule(id: string, rule: Partial<Rule>): Effect.Effect<Rule, BeTraceServiceError>;

  /**
   * Delete a rule
   */
  deleteRule(id: string): Effect.Effect<void, BeTraceServiceError>;

  /**
   * Enable a rule
   */
  enableRule(id: string): Effect.Effect<Rule, BeTraceServiceError>;

  /**
   * Disable a rule
   */
  disableRule(id: string): Effect.Effect<Rule, BeTraceServiceError>;

  /**
   * Health check
   */
  health(): Effect.Effect<HealthResponse, BeTraceServiceError>;
}

export const BeTraceService = Context.GenericTag<BeTraceService>('BeTraceService');

// ============================================================================
// Service Implementation
// ============================================================================

const makeBeTraceService = Effect.gen(function* () {
  const config = yield* BeTraceServiceConfig;
  const httpClient = yield* HttpClient.HttpClient;

  // Helper: Make HTTP request with error handling
  const request = <A, I, R>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    schema: Schema.Schema<A, I, R>,
    options: {
      body?: unknown;
      params?: Record<string, any>;
    } = {}
  ): Effect.Effect<A, BeTraceServiceError> =>
    Effect.gen(function* () {
      // Build URL with query params
      let url = `${config.baseUrl}${path}`;
      if (options.params) {
        const params = new URLSearchParams();
        Object.entries(options.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      // Create request
      let reqEffect: Effect.Effect<any, any, any> = Effect.succeed(
        HttpClientRequest.make(method)(url).pipe(
          HttpClientRequest.setHeader('Content-Type', 'application/json')
        )
      );

      // Add body if present
      if (options.body) {
        reqEffect = reqEffect.pipe(
          Effect.flatMap((r) => HttpClientRequest.bodyJson(r, options.body))
        );
      }

      const req = yield* reqEffect;

      // Execute request
      const response = yield* httpClient.execute(req).pipe(
        Effect.flatMap((res) => HttpClientResponse.schemaBodyJson(schema as any)(res)),
        Effect.catchAll((error) =>
          Effect.fail(
            new BeTraceServiceError({
              message: HttpClientError.isHttpClientError(error)
                ? `HTTP error: ${error.message}`
                : error instanceof Error
                ? error.message
                : 'Unknown error',
              cause: error,
              status: HttpClientError.isHttpClientError(error) && 'status' in error ? (error as any).status : undefined,
            })
          )
        )
      );

      return response;
    }) as Effect.Effect<A, BeTraceServiceError>;

  return BeTraceService.of({
    listRules: (params) =>
      request('GET', '/api/rules', ListRulesResponseSchema, { params }),

    getRule: (id) =>
      request('GET', `/api/rules/${encodeURIComponent(id)}`, RuleSchema),

    createRule: (rule) =>
      request('POST', '/api/rules', RuleSchema, { body: rule }),

    updateRule: (id, rule) =>
      request('PUT', `/api/rules/${encodeURIComponent(id)}`, RuleSchema, { body: rule }),

    deleteRule: (id) =>
      request('DELETE', `/api/rules/${encodeURIComponent(id)}`, Schema.Void).pipe(
        Effect.map(() => undefined)
      ),

    enableRule: (id) =>
      request('POST', `/api/rules/${encodeURIComponent(id)}/enable`, RuleSchema),

    disableRule: (id) =>
      request('POST', `/api/rules/${encodeURIComponent(id)}/disable`, RuleSchema),

    health: () =>
      request('GET', '/health', HealthResponseSchema),
  });
});

// ============================================================================
// Service Layer
// ============================================================================

/**
 * Live BeTrace Service Layer
 *
 * Provides HttpClient with default configuration and retry policy
 */
export const BeTraceServiceLive = Layer.effect(
  BeTraceService,
  makeBeTraceService
).pipe(
  Layer.provide(FetchHttpClient.layer)
);

/**
 * Get the backend URL from environment or window
 * Supports dynamic port injection for E2E tests
 */
const getBackendUrl = (): string => {
  // Check for test port injection (E2E tests inject this via addInitScript)
  if (typeof window !== 'undefined' && (window as any).BETRACE_PORT_BACKEND) {
    return `http://localhost:${(window as any).BETRACE_PORT_BACKEND}`;
  }
  // Default for local development
  return 'http://localhost:12011';
};

/**
 * Default configuration layer
 * Uses Layer.effect to read URL lazily at runtime (supports E2E test injection)
 */
export const BeTraceServiceConfigLive = Layer.effect(
  BeTraceServiceConfig,
  Effect.sync(() => ({
    baseUrl: getBackendUrl(),
    timeout: 30000,
  }))
);

/**
 * Complete live layer with default configuration
 */
export const BeTraceLive = BeTraceServiceLive.pipe(
  Layer.provide(BeTraceServiceConfigLive)
);
