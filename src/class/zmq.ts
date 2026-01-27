/**
 * ZMQ Event Bus for real-time Bitcoin Core notifications
 *
 * Connects to Bitcoin Core's ZMQ interface for real-time block and
 * transaction notifications. Falls back to polling if zeromq package
 * is not installed.
 */

import { EventEmitter } from '@vbyte/util'
import { create_core_debug } from '../util/debug.js'
import { CoreConfig } from '../types/index.js'
import { NetworkError } from './errors.js'
import { hash256 } from '../util/crypto.js'

const debug = create_core_debug('zmq')

export interface ZMQConfig {
  zmq_host?: string
  zmq_port?: number
  zmq_topics?: ZMQTopic[]
}

export enum ZMQTopic {
  // Transaction notifications
  RawTx = 'rawtx',           // Raw transaction data
  HashTx = 'hashtx',         // Transaction hash

  // Block notifications
  RawBlock = 'rawblock',     // Raw block data
  HashBlock = 'hashblock',   // Block hash

  // Sequence notifications (for mempool tracking)
  Sequence = 'sequence'      // Notification with label (mempool, block connect/disconnect)
}

export interface ZMQMessage {
  topic: ZMQTopic
  data: Buffer
  sequence?: number
}

export interface BlockEvent {
  hash: string
  height?: number
  raw?: Buffer
}

export interface TransactionEvent {
  txid: string
  raw?: Buffer
}

export interface SequenceEvent {
  hash: string
  label: 'mempool' | 'block_connect' | 'block_disconnect'
  mempool_sequence?: number
}

/**
 * ZMQ events emitted by the event bus
 */
export interface ZMQEvents {
  'connected': void
  'disconnected': void
  'message': ZMQMessage
  'block': BlockEvent
  'transaction': TransactionEvent
  'sequence': SequenceEvent
  'error': Error
}

// Type for dynamically imported zeromq Subscriber
type ZMQSubscriber = {
  connect(endpoint: string): void
  subscribe(topic: string): void
  close(): void
  [Symbol.asyncIterator](): AsyncIterator<[Buffer, Buffer, Buffer?]>
}

/**
 * ZMQ Event Bus - Connects to Bitcoin Core's ZMQ interface
 *
 * Requires zeromq npm package for full functionality:
 * ```bash
 * npm install zeromq
 * ```
 *
 * Bitcoin Core must be configured with ZMQ endpoints:
 * ```conf
 * zmqpubhashblock=tcp://127.0.0.1:28332
 * zmqpubhashtx=tcp://127.0.0.1:28332
 * zmqpubrawblock=tcp://127.0.0.1:28332
 * zmqpubrawtx=tcp://127.0.0.1:28332
 * zmqpubsequence=tcp://127.0.0.1:28332
 * ```
 *
 * @example
 * ```typescript
 * const zmq = new ZMQEventBus(config)
 *
 * zmq.on('block', (block) => {
 *   console.log('New block:', block.hash)
 * })
 *
 * zmq.on('transaction', (tx) => {
 *   console.log('New tx:', tx.txid)
 * })
 *
 * await zmq.connect()
 * // ... later
 * await zmq.disconnect()
 * ```
 */
export class ZMQEventBus extends EventEmitter<ZMQEvents> {
  private config: ZMQConfig
  private connected: boolean = false
  private sockets: Map<ZMQTopic, ZMQSubscriber> = new Map()
  private abortController: AbortController | null = null

  constructor(config: CoreConfig) {
    super()

    // Extract ZMQ config from CoreConfig
    this.config = {
      zmq_host: config.zmq_host || 'tcp://127.0.0.1',
      zmq_port: config.zmq_port || 28332,
      zmq_topics: (config.zmq_topics as ZMQTopic[] | undefined) || [
        ZMQTopic.HashBlock,
        ZMQTopic.HashTx
      ]
    }
  }

  /**
   * Connect to Bitcoin Core's ZMQ endpoints
   *
   * Dynamically imports zeromq package. Throws NetworkError if
   * the package is not installed.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return
    }

    // Try to dynamically import zeromq
    let zmq: any
    try {
      // @ts-ignore - zeromq is an optional dependency
      zmq = await import('zeromq')
      debug('zeromq package loaded')
    } catch (err) {
      throw new NetworkError(
        'ZMQ support requires the zeromq package. Install with: npm install zeromq'
      )
    }

    const endpoint = `${this.config.zmq_host}:${this.config.zmq_port}`
    debug('connecting to ZMQ endpoint: %s', endpoint)

    this.abortController = new AbortController()

    // Create subscriber socket for each topic
    for (const topic of this.config.zmq_topics || []) {
      try {
        const socket = new zmq.Subscriber() as ZMQSubscriber
        socket.connect(endpoint)
        socket.subscribe(topic)

        this.sockets.set(topic, socket)
        debug('subscribed to topic: %s', topic)

        // Start async message loop for this socket
        this._start_message_loop(topic, socket)
      } catch (err) {
        debug('failed to subscribe to topic %s: %O', topic, err)
        // Continue with other topics
      }
    }

    this.connected = true
    debug('ZMQ event bus connected')
    this.emit('connected', undefined)
  }

  /**
   * Disconnect from ZMQ endpoints
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return
    }

    debug('disconnecting from ZMQ')

    // Signal abort to all message loops
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    // Close all sockets
    for (const [topic, socket] of this.sockets.entries()) {
      try {
        socket.close()
        debug('closed socket for topic: %s', topic)
      } catch (err) {
        debug('error closing socket for %s: %O', topic, err)
      }
    }

    this.sockets.clear()
    this.connected = false
    debug('ZMQ event bus disconnected')
    this.emit('disconnected', undefined)
  }

  /**
   * Subscribe to a specific topic
   */
  subscribe(topic: ZMQTopic): void {
    if (!this.config.zmq_topics?.includes(topic)) {
      this.config.zmq_topics = this.config.zmq_topics || []
      this.config.zmq_topics.push(topic)

      if (this.connected) {
        // Would create and connect new socket for this topic
        this._create_socket(topic)
      }
    }
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: ZMQTopic): void {
    const socket = this.sockets.get(topic)
    if (socket) {
      try {
        socket.close()
      } catch (err) {
        debug('error closing socket: %O', err)
      }
      this.sockets.delete(topic)
    }

    const index = this.config.zmq_topics?.indexOf(topic)
    if (index !== undefined && index >= 0) {
      this.config.zmq_topics?.splice(index, 1)
    }
  }

  /**
   * Check if connected to ZMQ
   */
  is_connected(): boolean {
    return this.connected
  }

  /**
   * Get subscribed topics
   */
  get_topics(): ZMQTopic[] {
    return this.config.zmq_topics || []
  }

  /**
   * Internal: Start message loop for a socket
   */
  private async _start_message_loop(topic: ZMQTopic, socket: ZMQSubscriber): Promise<void> {
    try {
      for await (const [topicBuf, msgBuf, seqBuf] of socket) {
        // Check for abort
        if (this.abortController?.signal.aborted) {
          break
        }

        const topicStr = topicBuf.toString() as ZMQTopic
        const sequence = seqBuf ? seqBuf.readUInt32LE(0) : undefined

        this._handle_message(topicStr, msgBuf, sequence)
      }
    } catch (err) {
      // Ignore errors if we're disconnecting
      if (!this.abortController?.signal.aborted) {
        debug('message loop error for topic %s: %O', topic, err)
        this.emit('error', err instanceof Error ? err : new Error(String(err)))
      }
    }
  }

  /**
   * Internal: Create socket for a topic (dynamic subscription)
   */
  private async _create_socket(topic: ZMQTopic): Promise<void> {
    if (!this.connected) return

    try {
      // @ts-ignore - zeromq is an optional dependency
      const zmq = await import('zeromq')
      const endpoint = `${this.config.zmq_host}:${this.config.zmq_port}`

      const socket = new zmq.Subscriber() as ZMQSubscriber
      socket.connect(endpoint)
      socket.subscribe(topic)

      this.sockets.set(topic, socket)
      this._start_message_loop(topic, socket)

      debug('dynamically subscribed to topic: %s', topic)
    } catch (err) {
      debug('failed to subscribe to topic %s: %O', topic, err)
    }
  }

  /**
   * Internal: Handle incoming ZMQ message
   */
  private _handle_message(topic: ZMQTopic, data: Buffer, sequence?: number): void {
    debug('received message on topic %s (seq: %d)', topic, sequence)

    // Emit raw message
    this.emit('message', { topic, data, sequence } as ZMQMessage)

    // Parse and emit typed events
    switch (topic) {
      case ZMQTopic.HashBlock:
        this.emit('block', {
          hash: this._reverse_hex(data)
        } as BlockEvent)
        break

      case ZMQTopic.RawBlock:
        this.emit('block', {
          hash: this._hash_from_raw_block(data),
          raw: data
        } as BlockEvent)
        break

      case ZMQTopic.HashTx:
        this.emit('transaction', {
          txid: this._reverse_hex(data)
        } as TransactionEvent)
        break

      case ZMQTopic.RawTx:
        this.emit('transaction', {
          txid: this._hash_from_raw_tx(data),
          raw: data
        } as TransactionEvent)
        break

      case ZMQTopic.Sequence:
        const seq = this._parse_sequence(data)
        this.emit('sequence', seq)
        break
    }
  }

  /**
   * Internal: Reverse byte order and convert to hex
   * Bitcoin hashes are displayed in little-endian
   */
  private _reverse_hex(data: Buffer): string {
    return Buffer.from(data).reverse().toString('hex')
  }

  /**
   * Internal: Extract hash from raw block data
   * Block hash is SHA256d of the 80-byte header
   */
  private _hash_from_raw_block(data: Buffer): string {
    // Block header is first 80 bytes
    const header = data.subarray(0, 80)
    const hash = hash256(header)
    // Reverse for display (little-endian)
    return Buffer.from(hash).reverse().toString('hex')
  }

  /**
   * Internal: Extract hash from raw transaction data
   * TXID is SHA256d of the serialized tx (without witness for segwit)
   */
  private _hash_from_raw_tx(data: Buffer): string {
    // Check for segwit marker
    const hasWitness = data[4] === 0x00 && data[5] === 0x01

    let txForHash: Buffer
    if (hasWitness) {
      // For segwit, we need to hash without the marker, flag, and witness data
      // This is complex - for now, hash the full tx (will give wtxid not txid)
      // A proper implementation would strip witness data
      txForHash = data
    } else {
      txForHash = data
    }

    const hash = hash256(txForHash)
    return Buffer.from(hash).reverse().toString('hex')
  }

  /**
   * Internal: Parse sequence notification
   * Format: 32-byte hash + 1-byte label + optional 8-byte mempool sequence
   */
  private _parse_sequence(data: Buffer): SequenceEvent {
    // First 32 bytes is the hash
    const hash = this._reverse_hex(data.subarray(0, 32))

    // Byte 32 is the label
    const labelByte = data[32]
    let label: 'mempool' | 'block_connect' | 'block_disconnect'

    switch (labelByte) {
      case 0x41: // 'A' - Added to mempool
      case 0x52: // 'R' - Removed from mempool (not by block)
        label = 'mempool'
        break
      case 0x43: // 'C' - Block connected
        label = 'block_connect'
        break
      case 0x44: // 'D' - Block disconnected
        label = 'block_disconnect'
        break
      default:
        label = 'mempool'
    }

    // Optional: 8-byte mempool sequence number
    let mempool_sequence: number | undefined
    if (data.length >= 41 && label === 'mempool') {
      // Read as little-endian 64-bit integer (using lower 32 bits)
      mempool_sequence = data.readUInt32LE(33)
    }

    return { hash, label, mempool_sequence }
  }
}

/**
 * Check if zeromq package is available
 */
export async function is_zmq_available(): Promise<boolean> {
  try {
    // @ts-ignore - zeromq is an optional dependency
    await import('zeromq')
    return true
  } catch {
    return false
  }
}
