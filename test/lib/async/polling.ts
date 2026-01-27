/**
 * Polling utilities for async operations
 */

import { TimeoutError } from './timeout.js'
import type { CoreClient, TxStatus } from '../../../src/index.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Polling configuration options
 */
export interface PollOptions<T> {
  /** Interval between polls in milliseconds */
  interval_ms? : number
  /** Maximum time to poll in milliseconds */
  timeout_ms?  : number
  /** Predicate to determine when polling is complete */
  until?       : (result: T) => boolean
  /** Callback on each poll */
  on_poll?     : (result: T, attempt: number) => void
  /** Whether to return last result on timeout instead of throwing */
  return_on_timeout? : boolean
}

/**
 * Confirmation waiting options
 */
export interface ConfirmationOptions {
  /** Target number of confirmations */
  confirmations? : number
  /** Interval between checks in milliseconds */
  interval_ms?   : number
  /** Maximum time to wait in milliseconds */
  timeout_ms?    : number
  /** Callback on each check */
  on_check?      : (status: TxStatus | null, attempt: number) => void
}

/**
 * Poll result with metadata
 */
export interface PollResult<T> {
  /** The final result */
  value      : T
  /** Number of polls made */
  attempts   : number
  /** Total time spent in ms */
  duration   : number
  /** Whether timeout occurred */
  timed_out  : boolean
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_POLL_OPTIONS = {
  interval_ms : 1_000,
  timeout_ms  : 30_000
}

const DEFAULT_CONFIRMATION_OPTIONS: Required<Omit<ConfirmationOptions, 'on_check'>> = {
  confirmations : 1,
  interval_ms   : 1_000,
  timeout_ms    : 30_000
}

// ============================================================================
// Polling Functions
// ============================================================================

/**
 * Poll an async function until a condition is met
 *
 * @param fn - Async function to poll
 * @param options - Polling options
 * @returns Promise resolving to the final result
 *
 * @example
 * ```typescript
 * const result = await poll_until(
 *   () => client.get_tx_status(txid),
 *   { until: status => status?.confirmed === true }
 * )
 * ```
 */
export async function poll_until<T>(
  fn      : () => Promise<T>,
  options : PollOptions<T> = {}
): Promise<T> {
  const result = await poll_with_result(fn, options)
  return result.value
}

/**
 * Poll an async function and return detailed result
 *
 * @param fn - Async function to poll
 * @param options - Polling options
 * @returns Promise resolving to PollResult with metadata
 */
export async function poll_with_result<T>(
  fn      : () => Promise<T>,
  options : PollOptions<T> = {}
): Promise<PollResult<T>> {
  const {
    interval_ms = DEFAULT_POLL_OPTIONS.interval_ms,
    timeout_ms = DEFAULT_POLL_OPTIONS.timeout_ms,
    until,
    on_poll,
    return_on_timeout = false
  } = options

  const startTime = Date.now()
  let attempts = 0
  let lastResult: T | undefined

  while (true) {
    attempts++
    const elapsed = Date.now() - startTime

    // Check timeout
    if (elapsed >= timeout_ms) {
      if (return_on_timeout && lastResult !== undefined) {
        return {
          value     : lastResult,
          attempts,
          duration  : elapsed,
          timed_out : true
        }
      }
      throw new TimeoutError('poll_until', timeout_ms)
    }

    try {
      const result = await fn()
      lastResult = result

      // Call poll callback
      if (on_poll) {
        on_poll(result, attempts)
      }

      // Check predicate
      if (!until || until(result)) {
        return {
          value     : result,
          attempts,
          duration  : Date.now() - startTime,
          timed_out : false
        }
      }
    } catch (err) {
      // Ignore errors and continue polling
      // The caller can use the until predicate to handle errors
    }

    // Wait before next poll
    await sleep(interval_ms)
  }
}

/**
 * Poll until a value becomes truthy
 *
 * @param fn - Async function that returns value to check
 * @param options - Polling options (without until predicate)
 * @returns Promise resolving to the truthy value
 */
export async function poll_truthy<T>(
  fn      : () => Promise<T>,
  options : Omit<PollOptions<T>, 'until'> = {}
): Promise<NonNullable<T>> {
  const result = await poll_until(fn, {
    ...options,
    until: (value) => !!value
  })
  return result as NonNullable<T>
}

/**
 * Poll until a value equals expected
 *
 * @param fn - Async function that returns value to check
 * @param expected - Expected value
 * @param options - Polling options
 * @returns Promise resolving to the expected value
 */
export async function poll_equals<T>(
  fn       : () => Promise<T>,
  expected : T,
  options  : Omit<PollOptions<T>, 'until'> = {}
): Promise<T> {
  return poll_until(fn, {
    ...options,
    until: (value) => value === expected
  })
}

// ============================================================================
// Bitcoin-Specific Polling Functions
// ============================================================================

/**
 * Wait for a transaction to reach a certain number of confirmations
 *
 * @param client - CoreClient instance
 * @param txid - Transaction ID to watch
 * @param options - Confirmation options
 * @returns Promise resolving to transaction status
 *
 * @example
 * ```typescript
 * const status = await wait_for_confirmation(client, txid, { confirmations: 6 })
 * ```
 */
export async function wait_for_confirmation(
  client  : CoreClient,
  txid    : string,
  options : ConfirmationOptions = {}
): Promise<TxStatus> {
  const {
    confirmations = DEFAULT_CONFIRMATION_OPTIONS.confirmations,
    interval_ms = DEFAULT_CONFIRMATION_OPTIONS.interval_ms,
    timeout_ms = DEFAULT_CONFIRMATION_OPTIONS.timeout_ms,
    on_check
  } = options

  const result = await poll_until<TxStatus | null>(
    async () => {
      try {
        return await client.get_tx_status(txid)
      } catch {
        return null
      }
    },
    {
      interval_ms,
      timeout_ms,
      until: (status) => {
        if (!status) return false
        if (!status.confirmed) return false
        // Calculate confirmations from block height
        return true // If confirmed, we have at least 1 confirmation
      },
      on_poll: on_check ? (status, attempt) => on_check(status, attempt) : undefined
    }
  )

  if (!result) {
    throw new Error(`Transaction ${txid} not found`)
  }

  return result
}

/**
 * Wait for block height to reach a target
 *
 * @param client - CoreClient instance
 * @param height - Target block height
 * @param timeout_ms - Timeout in milliseconds
 * @returns Promise resolving to actual block height
 */
export async function wait_for_block_height(
  client     : CoreClient,
  height     : number,
  timeout_ms : number = 30_000
): Promise<number> {
  return poll_until(
    () => client.get_block_count(),
    {
      interval_ms : 1_000,
      timeout_ms,
      until       : (count) => count >= height
    }
  )
}

/**
 * Wait for mempool to have a specific transaction
 *
 * @param client - CoreClient instance
 * @param txid - Transaction ID to find
 * @param timeout_ms - Timeout in milliseconds
 * @returns Promise resolving to true when found
 */
export async function wait_for_mempool_tx(
  client     : CoreClient,
  txid       : string,
  timeout_ms : number = 10_000
): Promise<boolean> {
  return poll_until(
    async () => {
      const status = await client.get_tx_status(txid)
      return status !== null && !status.confirmed
    },
    {
      interval_ms : 500,
      timeout_ms,
      until       : (inMempool) => inMempool
    }
  )
}

/**
 * Wait for wallet balance to reach a minimum
 *
 * @param client - CoreClient instance
 * @param wallet - Wallet name
 * @param min_balance - Minimum balance in satoshis
 * @param timeout_ms - Timeout in milliseconds
 * @returns Promise resolving to actual balance
 */
export async function wait_for_balance(
  client      : CoreClient,
  wallet      : string,
  min_balance : number,
  timeout_ms  : number = 30_000
): Promise<number> {
  const walletClient = await client.load_wallet(wallet)
  return poll_until(
    () => walletClient.get_balance(),
    {
      interval_ms : 1_000,
      timeout_ms,
      until       : (balance) => balance >= min_balance
    }
  )
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
 * Create a polling wrapper for a function
 *
 * @param fn - Function to wrap
 * @param options - Default polling options
 * @returns Function that polls until predicate is satisfied
 */
export function with_polling<T>(
  fn      : () => Promise<T>,
  options : PollOptions<T>
): () => Promise<T> {
  return () => poll_until(fn, options)
}
