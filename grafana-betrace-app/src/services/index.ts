/**
 * BeTrace Services - Effect-based API Layer
 *
 * Export all Effect services, schemas, and utilities.
 */

// Service definitions
export {
  BeTraceService,
  BeTraceServiceConfig,
  BeTraceServiceLive,
  BeTraceServiceConfigLive,
  BeTraceLive,
  BeTraceServiceError,
} from './BeTraceService';

// Schemas and types
export {
  RuleSchema,
  ListRulesResponseSchema,
  HealthResponseSchema,
} from './BeTraceService';

export type {
  Rule,
  ListRulesResponse,
  HealthResponse,
} from './BeTraceService';

// Runtime utilities
export {
  runEffect,
  runEffectWith,
  standardRetryPolicy,
  withRetry,
  enableDebug,
  disableDebug,
  makeBeTraceConfigLayer,
} from './runtime';
