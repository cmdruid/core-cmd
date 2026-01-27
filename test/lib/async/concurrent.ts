/**
 * Concurrency utilities for async operations
 */

import type { CoreClient, CoreWallet } from '../../../src/index.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Concurrent execution options
 */
export interface ConcurrentOptions {
  /** Maximum concurrent operations */
  concurrency? : number
  /** Stop on first error */
  fail_fast?   : boolean
  /** Callback for each completion */
  on_complete? : (index: number, result: unknown) => void
  /** Callback for each error */
  on_error?    : (index: number, error: Error) => void
}

/**
 * Result of concurrent execution
 */
export interface ConcurrentResult<T, R> {
  /** Successful results */
  results   : R[]
  /** Errors encountered */
  errors    : Array<{ index: number; item: T; error: Error }>
  /** Total duration in ms */
  duration  : number
  /** Number of successful operations */
  succeeded : number
  /** Number of failed operations */
  failed    : number
}

/**
 * Semaphore options
 */
export interface SemaphoreOptions {
  /** Maximum concurrent permits */
  permits  : number
  /** Timeout for acquiring permit in ms */
  timeout? : number
}

// ============================================================================
// Semaphore
// ============================================================================

/**
 * Semaphore for controlling concurrent access
 *
 * @example
 * ```typescript
 * const sem = new Semaphore(3)  // Allow 3 concurrent operations
 *
 * await sem.with_permit(async () => {
 *   await heavy_operation()
 * })
 * ```
 */
export class Semaphore {
  private permits   : number
  private max       : number
  private waiting   : Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
    this.max = permits
  }

  /**
   * Current number of available permits
   */
  get available(): number {
    return this.permits
  }

  /**
   * Number of waiters in queue
   */
  get queue_length(): number {
    return this.waiting.length
  }

  /**
   * Acquire a permit
   * @returns Promise that resolves when permit is acquired
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    await new Promise<void>(resolve => {
      this.waiting.push(resolve)
    })
    this.permits--
  }

  /**
   * Try to acquire a permit without blocking
   * @returns true if permit was acquired, false otherwise
   */
  try_acquire(): boolean {
    if (this.permits > 0) {
      this.permits--
      return true
    }
    return false
  }

  /**
   * Release a permit
   */
  release(): void {
    this.permits++
    if (this.waiting.length > 0 && this.permits > 0) {
      const next = this.waiting.shift()!
      next()
    }
  }

  /**
   * Run a function with a permit
   * @param fn - Function to run
   * @returns Promise resolving to function result
   */
  async with_permit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  /**
   * Reset semaphore to initial state
   */
  reset(): void {
    this.permits = this.max
    this.waiting = []
  }
}

// ============================================================================
// Concurrent Execution Functions
// ============================================================================

/**
 * Run operations concurrently with a limit
 *
 * @param items - Items to process
 * @param fn - Async function to run on each item
 * @param options - Concurrency options
 * @returns Promise resolving to ConcurrentResult
 *
 * @example
 * ```typescript
 * const result = await run_concurrent(
 *   txids,
 *   txid => client.get_tx(txid),
 *   { concurrency: 5 }
 * )
 * ```
 */
export async function run_concurrent<T, R>(
  items   : T[],
  fn      : (item: T, index: number) => Promise<R>,
  options : ConcurrentOptions = {}
): Promise<ConcurrentResult<T, R>> {
  const {
    concurrency = 10,
    fail_fast = false,
    on_complete,
    on_error
  } = options

  const startTime = Date.now()
  const results: R[] = []
  const errors: Array<{ index: number; item: T; error: Error }> = []
  const semaphore = new Semaphore(concurrency)
  let stopped = false

  const tasks = items.map((item, index) => async () => {
    if (stopped) return

    await semaphore.acquire()
    if (stopped) {
      semaphore.release()
      return
    }

    try {
      const result = await fn(item, index)
      results[index] = result
      if (on_complete) {
        on_complete(index, result)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      errors.push({ index, item, error })
      if (on_error) {
        on_error(index, error)
      }
      if (fail_fast) {
        stopped = true
      }
    } finally {
      semaphore.release()
    }
  })

  await Promise.all(tasks.map(task => task()))

  return {
    results   : results.filter(r => r !== undefined),
    errors,
    duration  : Date.now() - startTime,
    succeeded : items.length - errors.length,
    failed    : errors.length
  }
}

/**
 * Run operations in parallel and collect all results
 *
 * @param fns - Array of async functions to run
 * @returns Promise resolving to array of results
 */
export async function parallel<T>(
  fns: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(fns.map(fn => fn()))
}

/**
 * Run operations in parallel and return first successful result
 *
 * @param fns - Array of async functions to run
 * @returns Promise resolving to first successful result
 */
export async function race_success<T>(
  fns: Array<() => Promise<T>>
): Promise<T> {
  return new Promise((resolve, reject) => {
    let remaining = fns.length
    const errors: Error[] = []

    for (const fn of fns) {
      fn()
        .then(resolve)
        .catch(err => {
          errors.push(err instanceof Error ? err : new Error(String(err)))
          remaining--
          if (remaining === 0) {
            reject(new AggregateError(errors, 'All operations failed'))
          }
        })
    }
  })
}

/**
 * Map over items with controlled concurrency
 *
 * @param items - Items to process
 * @param fn - Async function to map
 * @param concurrency - Maximum concurrent operations
 * @returns Promise resolving to mapped results
 */
export async function map_concurrent<T, R>(
  items       : T[],
  fn          : (item: T, index: number) => Promise<R>,
  concurrency : number = 10
): Promise<R[]> {
  const result = await run_concurrent(items, fn, { concurrency })
  if (result.errors.length > 0) {
    throw result.errors[0].error
  }
  return result.results
}

/**
 * Filter items with controlled concurrency
 *
 * @param items - Items to filter
 * @param predicate - Async predicate function
 * @param concurrency - Maximum concurrent operations
 * @returns Promise resolving to filtered items
 */
export async function filter_concurrent<T>(
  items       : T[],
  predicate   : (item: T, index: number) => Promise<boolean>,
  concurrency : number = 10
): Promise<T[]> {
  const results = await map_concurrent(
    items,
    async (item, index) => ({ item, keep: await predicate(item, index) }),
    concurrency
  )
  return results.filter(r => r.keep).map(r => r.item)
}

// ============================================================================
// Bitcoin-Specific Concurrent Functions
// ============================================================================

/**
 * Create multiple wallets concurrently
 *
 * @param client - CoreClient instance
 * @param names - Wallet names to create
 * @returns Promise resolving to array of wallets
 */
export async function create_wallets(
  client : CoreClient,
  names  : string[]
): Promise<CoreWallet[]> {
  return map_concurrent(
    names,
    name => client.load_wallet(name),
    3 // Limit to 3 concurrent wallet operations
  )
}

/**
 * Run a function with multiple wallets
 *
 * @param client - CoreClient instance
 * @param count - Number of wallets to create
 * @param fn - Function to run with wallets
 * @returns Promise resolving to function result
 */
export async function with_wallets<T>(
  client : CoreClient,
  count  : number,
  fn     : (wallets: CoreWallet[]) => Promise<T>
): Promise<T> {
  const names = Array.from({ length: count }, (_, i) => `test_wallet_${Date.now()}_${i}`)
  const wallets = await create_wallets(client, names)
  return fn(wallets)
}

/**
 * Batch RPC calls with controlled concurrency
 *
 * @param calls - Array of [method, args] tuples
 * @param executor - Function to execute each call
 * @param concurrency - Maximum concurrent calls
 * @returns Promise resolving to results
 */
export async function batch_rpc<T>(
  calls       : Array<[string, unknown[]]>,
  executor    : (method: string, args: unknown[]) => Promise<T>,
  concurrency : number = 5
): Promise<T[]> {
  return map_concurrent(
    calls,
    ([method, args]) => executor(method, args),
    concurrency
  )
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a pool of workers for concurrent operations
 *
 * @param worker - Worker function
 * @param size - Pool size
 * @returns Object with execute method
 */
export function create_worker_pool<T, R>(
  worker : (item: T) => Promise<R>,
  size   : number
): { execute: (items: T[]) => Promise<R[]> } {
  const semaphore = new Semaphore(size)

  return {
    execute: async (items: T[]) => {
      return Promise.all(
        items.map(item => semaphore.with_permit(() => worker(item)))
      )
    }
  }
}

/**
 * Debounce an async function
 *
 * @param fn - Function to debounce
 * @param delay_ms - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  fn       : T,
  delay_ms : number
): T {
  let timeoutId: NodeJS.Timeout | undefined
  let pending: Promise<ReturnType<T>> | undefined

  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (!pending) {
      pending = new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args)
            resolve(result)
          } catch (err) {
            reject(err)
          } finally {
            pending = undefined
            timeoutId = undefined
          }
        }, delay_ms)
      })
    }

    return pending
  }) as T
}

/**
 * Throttle an async function
 *
 * @param fn - Function to throttle
 * @param limit_ms - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => Promise<any>>(
  fn       : T,
  limit_ms : number
): T {
  let lastCall = 0
  let pending: Promise<ReturnType<T>> | undefined

  return (async (...args: Parameters<T>) => {
    const now = Date.now()
    const elapsed = now - lastCall

    if (elapsed >= limit_ms) {
      lastCall = now
      return fn(...args)
    }

    if (!pending) {
      pending = new Promise(resolve => {
        setTimeout(async () => {
          lastCall = Date.now()
          pending = undefined
          resolve(await fn(...args))
        }, limit_ms - elapsed)
      })
    }

    return pending
  }) as T
}
