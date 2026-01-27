/**
 * Event waiting utilities for async operations
 */

import { EventEmitter } from 'events'
import { TimeoutError } from './timeout.js'
import type { CoreDaemon, DaemonState } from '../../../src/index.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for waiting on events
 */
export interface EventWaitOptions {
  /** Timeout in milliseconds */
  timeout_ms? : number
  /** Predicate to filter events */
  filter?     : (data: unknown) => boolean
}

/**
 * Options for collecting events
 */
export interface EventCollectOptions extends EventWaitOptions {
  /** Maximum number of events to collect */
  max_events? : number
}

// ============================================================================
// Event Wait Functions
// ============================================================================

/**
 * Wait for an event to be emitted
 *
 * @param emitter - Event emitter to listen on
 * @param event - Event name to wait for
 * @param options - Wait options
 * @returns Promise resolving to event data
 *
 * @example
 * ```typescript
 * const client = await wait_for_event(daemon, 'ready', { timeout_ms: 30000 })
 * ```
 */
export async function wait_for_event<T = unknown>(
  emitter : EventEmitter,
  event   : string,
  options : EventWaitOptions = {}
): Promise<T> {
  const { timeout_ms = 30_000, filter } = options

  return new Promise<T>((resolve, reject) => {
    let settled = false
    let timeoutId: NodeJS.Timeout | undefined

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      emitter.removeListener(event, handler)
      emitter.removeListener('error', errorHandler)
    }

    const handler = (data: T) => {
      if (settled) return
      if (filter && !filter(data)) return
      settled = true
      cleanup()
      resolve(data)
    }

    const errorHandler = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    // Set up timeout
    if (timeout_ms > 0) {
      timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        reject(new TimeoutError(`wait_for_event(${event})`, timeout_ms))
      }, timeout_ms)
    }

    emitter.on(event, handler)
    emitter.on('error', errorHandler)
  })
}

/**
 * Wait for one of multiple events to be emitted
 *
 * @param emitter - Event emitter to listen on
 * @param events - Event names to wait for
 * @param options - Wait options
 * @returns Promise resolving to { event, data }
 */
export async function wait_for_any_event<T = unknown>(
  emitter : EventEmitter,
  events  : string[],
  options : EventWaitOptions = {}
): Promise<{ event: string; data: T }> {
  const { timeout_ms = 30_000 } = options

  return new Promise((resolve, reject) => {
    let settled = false
    let timeoutId: NodeJS.Timeout | undefined
    const handlers: Array<[string, (data: T) => void]> = []

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      for (const [evt, handler] of handlers) {
        emitter.removeListener(evt, handler)
      }
      emitter.removeListener('error', errorHandler)
    }

    const createHandler = (eventName: string) => (data: T) => {
      if (settled) return
      settled = true
      cleanup()
      resolve({ event: eventName, data })
    }

    const errorHandler = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    // Set up timeout
    if (timeout_ms > 0) {
      timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        reject(new TimeoutError(`wait_for_any_event(${events.join(', ')})`, timeout_ms))
      }, timeout_ms)
    }

    // Set up handlers for each event
    for (const evt of events) {
      const handler = createHandler(evt)
      handlers.push([evt, handler])
      emitter.on(evt, handler)
    }
    emitter.on('error', errorHandler)
  })
}

/**
 * Collect multiple events
 *
 * @param emitter - Event emitter to listen on
 * @param event - Event name to collect
 * @param count - Number of events to collect
 * @param options - Collection options
 * @returns Promise resolving to array of event data
 */
export async function collect_events<T = unknown>(
  emitter : EventEmitter,
  event   : string,
  count   : number,
  options : EventWaitOptions = {}
): Promise<T[]> {
  const { timeout_ms = 30_000, filter } = options
  const collected: T[] = []

  return new Promise((resolve, reject) => {
    let settled = false
    let timeoutId: NodeJS.Timeout | undefined

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      emitter.removeListener(event, handler)
      emitter.removeListener('error', errorHandler)
    }

    const handler = (data: T) => {
      if (settled) return
      if (filter && !filter(data)) return
      collected.push(data)
      if (collected.length >= count) {
        settled = true
        cleanup()
        resolve(collected)
      }
    }

    const errorHandler = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    // Set up timeout
    if (timeout_ms > 0) {
      timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        // Return what we've collected so far instead of rejecting
        if (collected.length > 0) {
          resolve(collected)
        } else {
          reject(new TimeoutError(`collect_events(${event}, ${count})`, timeout_ms))
        }
      }, timeout_ms)
    }

    emitter.on(event, handler)
    emitter.on('error', errorHandler)
  })
}

// ============================================================================
// Daemon-Specific Event Functions
// ============================================================================

/**
 * Wait for daemon to reach ready state
 *
 * @param daemon - CoreDaemon instance
 * @param timeout_ms - Timeout in milliseconds
 * @returns Promise that resolves when daemon is ready
 */
export async function wait_for_ready(
  daemon     : CoreDaemon,
  timeout_ms : number = 30_000
): Promise<void> {
  // If already ready, return immediately
  if (daemon.isReady) {
    return
  }

  await wait_for_event(daemon, 'ready', { timeout_ms })
}

/**
 * Wait for daemon to reach a specific state
 *
 * @param daemon - CoreDaemon instance
 * @param state - Target state to wait for
 * @param timeout_ms - Timeout in milliseconds
 * @returns Promise that resolves when state is reached
 */
export async function wait_for_state(
  daemon     : CoreDaemon,
  state      : DaemonState,
  timeout_ms : number = 30_000
): Promise<void> {
  // If already in target state, return immediately
  if (daemon.daemonState === state) {
    return
  }

  await wait_for_event(daemon, 'state:change', {
    timeout_ms,
    filter: (data: unknown) => {
      const event = data as { state: DaemonState }
      return event.state === state
    }
  })
}

/**
 * Wait for daemon shutdown to complete
 *
 * @param daemon - CoreDaemon instance
 * @param timeout_ms - Timeout in milliseconds
 * @returns Promise that resolves when daemon is stopped
 */
export async function wait_for_shutdown(
  daemon     : CoreDaemon,
  timeout_ms : number = 10_000
): Promise<void> {
  await wait_for_event(daemon, 'shutdown', { timeout_ms })
}

// ============================================================================
// Event Stream Functions
// ============================================================================

/**
 * Create an async iterator for events
 *
 * @param emitter - Event emitter to listen on
 * @param event - Event name to iterate
 * @returns AsyncIterable of event data
 */
export function event_stream<T = unknown>(
  emitter : EventEmitter,
  event   : string
): AsyncIterable<T> {
  const queue: T[] = []
  let resolve: ((value: T) => void) | null = null
  let done = false

  const handler = (data: T) => {
    if (resolve) {
      const r = resolve
      resolve = null
      r(data)
    } else {
      queue.push(data)
    }
  }

  emitter.on(event, handler)

  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (done) {
            return { done: true, value: undefined }
          }
          if (queue.length > 0) {
            return { done: false, value: queue.shift()! }
          }
          const value = await new Promise<T>(r => { resolve = r })
          return { done: false, value }
        },
        async return() {
          done = true
          emitter.removeListener(event, handler)
          return { done: true, value: undefined }
        }
      }
    }
  }
}

/**
 * Create a one-time event listener that returns a promise
 */
export function once<T = unknown>(
  emitter : EventEmitter,
  event   : string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (data: T) => {
      emitter.removeListener('error', errorHandler)
      resolve(data)
    }
    const errorHandler = (err: Error) => {
      emitter.removeListener(event, handler)
      reject(err)
    }
    emitter.once(event, handler)
    emitter.once('error', errorHandler)
  })
}
