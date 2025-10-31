/**
 * Effect Runtime Configuration
 *
 * Provides a configured runtime for executing Effects in React components.
 * Includes logging, retry policies, and service dependencies.
 */

import { Effect, Runtime, Layer, Logger, LogLevel, Schedule, Duration } from 'effect';
import { BeTraceLive, BeTraceService, BeTraceServiceConfig } from './BeTraceService';

// ============================================================================
// Logging Layer
// ============================================================================

const DEBUG_KEY = 'betrace.debug';

const isDebugEnabled = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(DEBUG_KEY) === 'true' || window.location.search.includes('debug=true');
  }
  return false;
};

/**
 * Custom logger that respects debug flag
 */
const BeTraceLogger = Logger.make(({ logLevel, message, cause }) => {
  if (!isDebugEnabled() && logLevel._tag !== 'Fatal' && logLevel._tag !== 'Error') {
    return;
  }

  const timestamp = new Date().toISOString();
  const level = logLevel._tag.toUpperCase();
  const prefix = `[BeTrace ${level}] ${timestamp}`;

  switch (logLevel._tag) {
    case 'Fatal':
    case 'Error':
      console.error(prefix, message, cause);
      break;
    case 'Warning':
      console.warn(prefix, message);
      break;
    case 'Info':
    case 'Debug':
    case 'Trace':
      console.log(prefix, message);
      break;
  }
});

const LoggerLive = Logger.replace(Logger.defaultLogger, BeTraceLogger);

// ============================================================================
// Retry Policies
// ============================================================================

/**
 * Standard retry policy for API requests:
 * - Retry up to 2 times
 * - Exponential backoff starting at 500ms
 * - Max delay of 5 seconds
 */
export const standardRetryPolicy = Schedule.exponential(Duration.millis(500)).pipe(
  Schedule.compose(Schedule.recurs(2)),
  Schedule.compose(Schedule.elapsed),
  Schedule.whileOutput(Duration.lessThanOrEqualTo(Duration.seconds(5)))
);

/**
 * Apply retry policy to an Effect
 */
export const withRetry = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.retry(standardRetryPolicy));

// ============================================================================
// Runtime
// ============================================================================

/**
 * Custom BeTrace config layer (can be overridden)
 */
export const makeBeTraceConfigLayer = (baseUrl?: string) =>
  Layer.succeed(BeTraceServiceConfig, {
    baseUrl: baseUrl || 'http://localhost:12011',
    timeout: 30000,
  });

/**
 * Run an Effect in the BeTrace runtime
 *
 * This is the main entry point for executing Effects from React components.
 *
 * @example
 * ```ts
 * const effect = BeTraceService.pipe(
 *   Effect.flatMap(service => service.listRules())
 * );
 *
 * runEffect(effect)
 *   .then(rules => setRules(rules))
 *   .catch(error => setError(error.message));
 * ```
 */
export const runEffect = <A, E>(
  effect: Effect.Effect<A, E, BeTraceService>
): Promise<A> => {
  const effectWithLogging = effect.pipe(
    Effect.tapError((error) =>
      Effect.logError(`Effect failed: ${JSON.stringify(error)}`)
    )
  );

  return Effect.runPromise(Effect.provide(effectWithLogging, BeTraceLive));
};

/**
 * Run an Effect with custom configuration
 */
export const runEffectWith = <A, E>(
  effect: Effect.Effect<A, E, BeTraceService>,
  config: { baseUrl?: string }
): Promise<A> => {
  const customLayer = BeTraceLive.pipe(
    Layer.provide(makeBeTraceConfigLayer(config.baseUrl))
  );

  const effectWithLogging = effect.pipe(
    Effect.tapError((error) =>
      Effect.logError(`Effect failed: ${JSON.stringify(error)}`)
    )
  );

  return Effect.runPromise(Effect.provide(effectWithLogging, customLayer));
};

// ============================================================================
// Debug Utilities
// ============================================================================

export const enableDebug = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DEBUG_KEY, 'true');
    console.log('[BeTrace] Debug logging enabled. Refresh to see debug output.');
  }
};

export const disableDebug = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DEBUG_KEY);
    console.log('[BeTrace] Debug logging disabled.');
  }
};

// Expose to window for easy debugging
if (typeof window !== 'undefined') {
  (window as any).enableBeTraceDebug = enableDebug;
  (window as any).disableBeTraceDebug = disableDebug;
}
