/**
 * Polling-based Event Bus for Bitcoin Core notifications
 *
 * Fallback implementation when ZMQ is not available.
 * Polls Bitcoin Core RPC periodically for changes.
 */

// External dependencies
import { EventEmitter }      from '@vbyte/util'

// Internal modules
import { create_core_debug } from '@/util/debug.js'

// Type imports
import type { CoreClient }                   from '@/class/client.js'
import type { BlockEvent, TransactionEvent } from '@/class/zmq.js'

const debug = create_core_debug('poll')

/**
 * Events emitted by the polling event bus
 */
export interface PollEvents {
  'started': void
  'stopped': void
  'block': BlockEvent
  'transaction': TransactionEvent
  'error': Error
}

export interface PollConfig {
  /** Polling interval in milliseconds (default: 1000) */
  interval?: number
  /** Enable block polling (default: true) */
  poll_blocks?: boolean
  /** Enable mempool polling (default: true) */
  poll_mempool?: boolean
}

/**
 * Polling-based Event Bus
 *
 * Polls Bitcoin Core at regular intervals to detect:
 * - New blocks (via getbestblockhash)
 * - New mempool transactions (via getrawmempool)
 *
 * @example
 * ```typescript
 * const poll = new PollEventBus(client, { interval: 1000 })
 *
 * poll.on('block', (block) => {
 *   console.log('New block:', block.hash)
 * })
 *
 * poll.on('transaction', (tx) => {
 *   console.log('New mempool tx:', tx.txid)
 * })
 *
 * await poll.start()
 * // ... later
 * await poll.stop()
 * ```
 */
export class PollEventBus extends EventEmitter<PollEvents> {
  private _client: CoreClient
  private _interval: number
  private _poll_blocks: boolean
  private _poll_mempool: boolean
  private _timer: ReturnType<typeof setInterval> | null = null
  private _running: boolean = false
  private _last_block: string | null = null
  private _last_mempool: Set<string> = new Set()

  constructor(client: CoreClient, config: PollConfig = {}) {
    super()

    this._client = client
    this._interval = config.interval ?? 1000
    this._poll_blocks = config.poll_blocks ?? true
    this._poll_mempool = config.poll_mempool ?? true
  }

  /**
   * Check if the event bus is running
   */
  is_connected(): boolean {
    return this._running
  }

  /**
   * Get the polling interval in milliseconds
   */
  get interval(): number {
    return this._interval
  }

  /**
   * Start polling
   */
  async start(): Promise<void> {
    if (this._running) {
      debug('poll event bus already running')
      return
    }

    debug('starting poll event bus (interval: %dms)', this._interval)

    // Initialize state with current values
    try {
      if (this._poll_blocks) {
        this._last_block = await this._get_best_block_hash()
        debug('initial block hash: %s', this._last_block)
      }

      if (this._poll_mempool) {
        const mempool = await this._get_raw_mempool()
        this._last_mempool = new Set(mempool)
        debug('initial mempool size: %d', this._last_mempool.size)
      }
    } catch (err) {
      debug('failed to initialize poll state: %O', err)
      throw err
    }

    // Start polling
    this._running = true
    this._timer = setInterval(() => {
      this._poll().catch(err => {
        debug('poll error: %O', err)
        this.emit('error', err instanceof Error ? err : new Error(String(err)))
      })
    }, this._interval)

    this.emit('started', undefined)
    debug('poll event bus started')
  }

  /**
   * Stop polling
   */
  async stop(): Promise<void> {
    if (!this._running) {
      debug('poll event bus already stopped')
      return
    }

    debug('stopping poll event bus')

    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }

    this._running = false
    this._last_block = null
    this._last_mempool.clear()

    this.emit('stopped', undefined)
    debug('poll event bus stopped')
  }

  /**
   * Internal: Poll for changes
   */
  private async _poll(): Promise<void> {
    if (!this._running) return

    // Poll for new blocks
    if (this._poll_blocks) {
      await this._poll_blocks_impl()
    }

    // Poll for new mempool transactions
    if (this._poll_mempool) {
      await this._poll_mempool_impl()
    }
  }

  /**
   * Internal: Poll for new blocks
   */
  private async _poll_blocks_impl(): Promise<void> {
    try {
      const current_hash = await this._get_best_block_hash()

      if (current_hash !== this._last_block && this._last_block !== null) {
        debug('new block detected: %s', current_hash)

        // Emit block event
        this.emit('block', {
          hash: current_hash
        } as BlockEvent)

        this._last_block = current_hash
      } else if (this._last_block === null) {
        this._last_block = current_hash
      }
    } catch (err) {
      debug('block poll error: %O', err)
      throw err
    }
  }

  /**
   * Internal: Poll for new mempool transactions
   */
  private async _poll_mempool_impl(): Promise<void> {
    try {
      const current_mempool = await this._get_raw_mempool()
      const current_set = new Set(current_mempool)

      // Find new transactions (in current but not in last)
      for (const txid of current_set) {
        if (!this._last_mempool.has(txid)) {
          debug('new mempool tx: %s', txid)
          this.emit('transaction', {
            txid
          } as TransactionEvent)
        }
      }

      // Update last state
      this._last_mempool = current_set
    } catch (err) {
      debug('mempool poll error: %O', err)
      throw err
    }
  }

  /**
   * Internal: Get best block hash
   */
  private async _get_best_block_hash(): Promise<string> {
    return this._client.cmd<string>('getbestblockhash')
  }

  /**
   * Internal: Get raw mempool
   */
  private async _get_raw_mempool(): Promise<string[]> {
    return this._client.cmd<string[]>('getrawmempool')
  }
}

/**
 * Create a polling event bus
 */
export function create_poll_event_bus(
  client: CoreClient,
  interval?: number
): PollEventBus {
  return new PollEventBus(client, { interval })
}
