/**
 * Timeout utilities for async operations
 */

import { CoreError } from '../../../src/index.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Timeout configuration options
 */
export interface TimeoutOptions {
  /** Timeout in milliseconds */
  timeout_ms  : number
  /** Operation description for error message */
  operation?  : string
  /** Cleanup function to run on timeout */
  on_timeout? : () => void | Promise<void>
}

// ============================================================================
// Timeout Error
// ============================================================================

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends CoreError {
  /** Timeout duration in milliseconds */
  readonly timeout_ms : number
  /** Name of the operation that timed out */
  readonly operation  : string

  constructor(operation: string, timeout_ms: number) {
    super(`Operation "${operation}" timed out after ${timeout_ms}ms`)
    this.name = 'TimeoutError'
    this.timeout_ms = timeout_ms
    this.operation = operation
  }
}

// ============================================================================
// Timeout Functions
// ============================================================================

/**
 * Run an async function with a timeout
 *
 * @param fn - Async function to run
 * @param options - Timeout configuration
 * @returns Promise resolving to the function result
 * @throws TimeoutError if operation exceeds timeout
 *
 * @example
 * ```typescript
 * const result = await with_timeout(
 *   () => client.get_block_count(),
 *   { timeout_ms: 5000, operation: 'get_block_count' }
 * )
 * ```
 */
export async function with_timeout<T>(
  fn      : () => Promise<T>,
  options : TimeoutOptions
): Promise<T> {
  const { timeout_ms, operation = 'unknown', on_timeout } = options

  return new Promise<T>((resolve, reject) => {
    let settled = false

    // Set up timeout
    const timeoutId = setTimeout(async () => {
      if (settled) return
      settled = true

      // Run cleanup if provided
      if (on_timeout) {
        try {
          await on_timeout()
        } catch {
          // Ignore cleanup errors
        }
      }

      reject(new TimeoutError(operation, timeout_ms))
    }, timeout_ms)

    // Run the function
    fn()
      .then(result => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch(err => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        reject(err)
      })
  })
}

/**
 * Run an async function with a timeout and fallback value
 *
 * @param fn - Async function to run
 * @param fallback - Value to return on timeout
 * @param timeout_ms - Timeout in milliseconds
 * @returns Promise resolving to result or fallback
 */
export async function with_timeout_fallback<T>(
  fn         : () => Promise<T>,
  fallback   : T,
  timeout_ms : number
): Promise<T> {
  try {
    return await with_timeout(fn, { timeout_ms, operation: 'operation' })
  } catch (err) {
    if (err instanceof TimeoutError) {
      return fallback
    }
    throw err
  }
}

/**
 * Run an async function with a timeout, returning null on timeout
 *
 * @param fn - Async function to run
 * @param timeout_ms - Timeout in milliseconds
 * @returns Promise resolving to result or null
 */
export async function with_timeout_or_null<T>(
  fn         : () => Promise<T>,
  timeout_ms : number
): Promise<T | null> {
  return with_timeout_fallback(fn, null as T | null, timeout_ms)
}

/**
 * Create a timeout promise that rejects after specified time
 *
 * @param timeout_ms - Timeout in milliseconds
 * @param operation - Operation name for error message
 * @returns Promise that rejects with TimeoutError
 */
export function create_timeout(
  timeout_ms : number,
  operation  : string = 'operation'
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(operation, timeout_ms))
    }, timeout_ms)
  })
}

/**
 * Race a promise against a timeout
 *
 * @param promise - Promise to race
 * @param timeout_ms - Timeout in milliseconds
 * @param operation - Operation name for error message
 * @returns Promise resolving to result or rejecting with TimeoutError
 */
export function race_timeout<T>(
  promise    : Promise<T>,
  timeout_ms : number,
  operation  : string = 'operation'
): Promise<T> {
  return Promise.race([
    promise,
    create_timeout(timeout_ms, operation)
  ])
}

// ============================================================================
// Deadline Functions
// ============================================================================

/**
 * Create a deadline that expires at a specific time
 *
 * @param deadline - Deadline timestamp (Date or ms since epoch)
 * @param operation - Operation name for error message
 * @returns Timeout in milliseconds until deadline
 */
export function time_until_deadline(deadline: Date | number): number {
  const deadlineMs = deadline instanceof Date ? deadline.getTime() : deadline
  const remaining = deadlineMs - Date.now()
  return Math.max(0, remaining)
}

/**
 * Run an async function with a deadline
 *
 * @param fn - Async function to run
 * @param deadline - Deadline timestamp
 * @param operation - Operation name for error message
 * @returns Promise resolving to result
 */
export async function with_deadline<T>(
  fn        : () => Promise<T>,
  deadline  : Date | number,
  operation : string = 'operation'
): Promise<T> {
  const timeout_ms = time_until_deadline(deadline)
  if (timeout_ms <= 0) {
    throw new TimeoutError(operation, 0)
  }
  return with_timeout(fn, { timeout_ms, operation })
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an error is a TimeoutError
 */
export function is_timeout_error(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError
}

/**
 * Create a cancellable timeout wrapper
 *
 * @param fn - Async function to run
 * @param timeout_ms - Timeout in milliseconds
 * @returns Object with run method and cancel method
 */
export function create_cancellable_timeout<T>(
  fn         : () => Promise<T>,
  timeout_ms : number
): { run: () => Promise<T>; cancel: () => void } {
  let cancelled = false
  let timeoutId: NodeJS.Timeout | undefined

  return {
    run: () => {
      return new Promise<T>((resolve, reject) => {
        if (cancelled) {
          reject(new Error('Operation cancelled'))
          return
        }

        timeoutId = setTimeout(() => {
          if (!cancelled) {
            reject(new TimeoutError('operation', timeout_ms))
          }
        }, timeout_ms)

        fn()
          .then(result => {
            if (timeoutId) clearTimeout(timeoutId)
            if (!cancelled) resolve(result)
          })
          .catch(err => {
            if (timeoutId) clearTimeout(timeoutId)
            if (!cancelled) reject(err)
          })
      })
    },
    cancel: () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }
}
