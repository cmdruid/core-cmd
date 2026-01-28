/**
 * Event Bus Factory
 *
 * Creates the appropriate event bus based on configuration and availability:
 * - ZMQ (real-time) if zeromq package is available and zmq_enabled
 * - Polling (fallback) if polling_enabled
 * - null if events are disabled
 */

// Internal modules
import { create_core_debug }             from '@/util/debug.js'
import { ZMQEventBus, is_zmq_available } from '@/class/zmq.js'
import { PollEventBus }                  from '@/class/poll.js'

// Type imports
import type { CoreClient }       from '@/class/client.js'
import type { CoreConfig }       from '@/types/index.js'
import type { PollEvents }       from '@/class/poll.js'
import type { BlockEvent, TransactionEvent, SequenceEvent, ZMQEvents } from '@/class/zmq.js'

const debug = create_core_debug('events')

/**
 * Common event bus interface
 */
export interface EventBus {
  /** Start the event bus */
  start?(): Promise<void>
  connect?(): Promise<void>

  /** Stop the event bus */
  stop?(): Promise<void>
  disconnect?(): Promise<void>

  /** Check if running/connected */
  is_connected(): boolean

  /** Subscribe to block events */
  on(event: 'block', listener: (block: BlockEvent) => void): this

  /** Subscribe to transaction events */
  on(event: 'transaction', listener: (tx: TransactionEvent) => void): this

  /** Subscribe to sequence events (ZMQ only) */
  on(event: 'sequence', listener: (seq: SequenceEvent) => void): this

  /** Subscribe to error events */
  on(event: 'error', listener: (err: Error) => void): this

  /** Generic on */
  on(event: string, listener: (...args: any[]) => void): this
}

/**
 * Event bus type identifier
 */
export type EventBusType = 'zmq' | 'poll' | 'none'

/**
 * Result from createEventBus
 */
export interface EventBusResult {
  type: EventBusType
  bus: EventBus | null
}

/**
 * Create an event bus based on configuration and availability
 *
 * Selection logic:
 * 1. If events_enabled === false, return null
 * 2. If zmq_enabled and zeromq is available, return ZMQEventBus
 * 3. If polling_enabled !== false, return PollEventBus
 * 4. Otherwise, return null
 *
 * @example
 * ```typescript
 * const result = await createEventBus(client, config)
 *
 * if (result.bus) {
 *   result.bus.on('block', (block) => console.log('New block:', block.hash))
 *   await result.bus.start?.() || await result.bus.connect?.()
 * }
 * ```
 */
export async function createEventBus(
  client: CoreClient,
  config: CoreConfig
): Promise<EventBusResult> {
  // Check if events are disabled
  if (config.events_enabled === false) {
    debug('event bus disabled by configuration')
    return { type: 'none', bus: null }
  }

  // Try ZMQ first if enabled
  if (config.zmq_enabled) {
    debug('ZMQ enabled, checking availability...')

    if (await is_zmq_available()) {
      debug('zeromq package available, using ZMQ event bus')
      const zmq = new ZMQEventBus(config)
      return { type: 'zmq', bus: zmq as unknown as EventBus }
    } else {
      debug('zeromq package not available')
    }
  }

  // Fall back to polling if enabled (default: true)
  if (config.polling_enabled !== false) {
    debug('using polling event bus (interval: %dms)', config.events_poll_interval ?? 1000)
    const poll = new PollEventBus(client, {
      interval: config.events_poll_interval ?? 1000
    })
    return { type: 'poll', bus: poll as unknown as EventBus }
  }

  // No event bus available
  debug('no event bus available (polling disabled, zmq unavailable)')
  return { type: 'none', bus: null }
}

/**
 * Start an event bus (handles both ZMQ and Poll)
 */
export async function startEventBus(bus: EventBus | null): Promise<void> {
  if (!bus) return

  // ZMQEventBus uses connect()
  if ('connect' in bus && typeof bus.connect === 'function') {
    await bus.connect()
  }
  // PollEventBus uses start()
  else if ('start' in bus && typeof bus.start === 'function') {
    await bus.start()
  }
}

/**
 * Stop an event bus (handles both ZMQ and Poll)
 */
export async function stopEventBus(bus: EventBus | null): Promise<void> {
  if (!bus) return

  // ZMQEventBus uses disconnect()
  if ('disconnect' in bus && typeof bus.disconnect === 'function') {
    await bus.disconnect()
  }
  // PollEventBus uses stop()
  else if ('stop' in bus && typeof bus.stop === 'function') {
    await bus.stop()
  }
}

// Re-export event types for convenience
export type { BlockEvent, TransactionEvent, SequenceEvent, ZMQEvents, PollEvents }
