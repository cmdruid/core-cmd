/**
 * Retry utilities for async operations
 */

import { ConnectionError, RPCError } from '../../../src/index.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  max_attempts?   : number
  /** Initial delay between retries in ms (default: 100) */
  initial_delay?  : number
  /** Maximum delay between retries in ms (default: 5000) */
  max_delay?      : number
  /** Backoff multiplier (default: 2) */
  backoff_factor? : number
  /** Random jitter factor 0-1 (default: 0.1) */
  jitter_factor?  : number
  /** Custom predicate to determine if error is retryable */
  should_retry?   : (err: Error, attempt: number) => boolean
  /** Callback on each retry */
  on_retry?       : (attempt: number, err: Error, delay: number) => void
}

/**
 * Result of retry operation with metadata
 */
export interface RetryResult<T> {
  /** The successful result */
  value     : T
  /** Number of attempts made */
  attempts  : number
  /** Total time spent in ms */
  duration  : number
  /** Errors encountered during retries */
  errors    : Error[]
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'should_retry' | 'on_retry'>> = {
  max_attempts   : 3,
  initial_delay  : 100,
  max_delay      : 5_000,
  backoff_factor : 2,
  jitter_factor  : 0.1
}

// ============================================================================
// Retry Functions
// ============================================================================

/**
 * Retry an async function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Promise resolving to the function result
 * @throws Last error if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   () => client.get_block_count(),
 *   { max_attempts: 5, initial_delay: 200 }
 * )
 * ```
 */
export async function retry<T>(
  fn      : () => Promise<T>,
  options : RetryOptions = {}
): Promise<T> {
  const result = await retry_with_result(fn, options)
  return result.value
}

/**
 * Retry an async function and return detailed result
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Promise resolving to RetryResult with metadata
 */
export async function retry_with_result<T>(
  fn      : () => Promise<T>,
  options : RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    max_attempts,
    initial_delay,
    max_delay,
    backoff_factor,
    jitter_factor
  } = { ...DEFAULT_OPTIONS, ...options }

  const { should_retry, on_retry } = options
  const errors: Error[] = []
  const startTime = Date.now()
  let delay = initial_delay

  for (let attempt = 1; attempt <= max_attempts; attempt++) {
    try {
      const value = await fn()
      return {
        value,
        attempts : attempt,
        duration : Date.now() - startTime,
        errors
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      errors.push(error)

      // Check if we should retry
      const canRetry = should_retry
        ? should_retry(error, attempt)
        : is_retryable_error(error)

      if (attempt === max_attempts || !canRetry) {
        throw error
      }

      // Calculate delay with jitter
      const jitter = jitter_factor > 0
        ? delay * jitter_factor * (Math.random() * 2 - 1)
        : 0
      const actualDelay = Math.min(delay + jitter, max_delay)

      // Call retry callback
      if (on_retry) {
        on_retry(attempt, error, actualDelay)
      }

      // Wait before next attempt
      await sleep(actualDelay)

      // Increase delay for next iteration
      delay = Math.min(delay * backoff_factor, max_delay)
    }
  }

  // Should never reach here, but TypeScript needs this
  throw errors[errors.length - 1]
}

/**
 * Retry with a predicate that determines success
 *
 * @param fn - Async function to retry
 * @param predicate - Function that returns true when result is acceptable
 * @param options - Retry configuration
 * @returns Promise resolving to the acceptable result
 */
export async function retry_until<T>(
  fn        : () => Promise<T>,
  predicate : (result: T) => boolean,
  options   : RetryOptions = {}
): Promise<T> {
  const {
    max_attempts = DEFAULT_OPTIONS.max_attempts,
    initial_delay = DEFAULT_OPTIONS.initial_delay,
    max_delay = DEFAULT_OPTIONS.max_delay,
    backoff_factor = DEFAULT_OPTIONS.backoff_factor,
    jitter_factor = DEFAULT_OPTIONS.jitter_factor,
    on_retry
  } = options

  let delay = initial_delay

  for (let attempt = 1; attempt <= max_attempts; attempt++) {
    const result = await fn()

    if (predicate(result)) {
      return result
    }

    if (attempt === max_attempts) {
      throw new Error(`Predicate not satisfied after ${max_attempts} attempts`)
    }

    // Calculate delay with jitter
    const jitter = jitter_factor > 0
      ? delay * jitter_factor * (Math.random() * 2 - 1)
      : 0
    const actualDelay = Math.min(delay + jitter, max_delay)

    if (on_retry) {
      on_retry(attempt, new Error('Predicate not satisfied'), actualDelay)
    }

    await sleep(actualDelay)
    delay = Math.min(delay * backoff_factor, max_delay)
  }

  throw new Error('Retry exhausted')
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Check if an error is retryable
 *
 * Retryable errors include:
 * - ConnectionError (temporary network issues)
 * - RPCError with certain codes (warming up, temporarily unavailable)
 * - Errors with messages indicating temporary issues
 */
export function is_retryable_error(err: Error): boolean {
  // Connection errors are retryable
  if (err instanceof ConnectionError) {
    return true
  }

  // Certain RPC errors are retryable
  if (err instanceof RPCError) {
    const retryableCodes = [-28, -10, -4] // warmup, loading, not ready
    if (err.rpc_code !== undefined && retryableCodes.includes(err.rpc_code)) {
      return true
    }
  }

  // Check error message for retryable patterns
  const retryablePatterns = [
    /connection refused/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ECONNRESET/i,
    /temporarily unavailable/i,
    /loading/i,
    /warming up/i,
    /not ready/i,
    /try again/i
  ]

  return retryablePatterns.some(pattern => pattern.test(err.message))
}

/**
 * Create a custom retry predicate
 */
export function create_retry_predicate(
  ...predicates: ((err: Error) => boolean)[]
): (err: Error) => boolean {
  return (err: Error) => predicates.some(p => p(err))
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a retry wrapper for a function
 *
 * @param fn - Function to wrap
 * @param options - Default retry options
 * @returns Wrapped function that retries on failure
 */
export function with_retry<T extends (...args: any[]) => Promise<any>>(
  fn      : T,
  options : RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => {
    return retry(() => fn(...args), options)
  }) as T
}
