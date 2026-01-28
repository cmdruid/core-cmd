/**
 * Mock implementation of ZMQ event bus for unit testing
 */

import { EventEmitter } from 'node:events'
import type { MockZMQConfig, MockZMQEvent, RecordedCall } from '../types/mock.types.js'
import { create_call_recorder } from '../types/mock.types.js'

// ============================================================================
// ZMQ Event Types
// ============================================================================

export interface BlockEvent {
  hash    : string
  height? : number
  raw?    : Buffer
}

export interface TransactionEvent {
  txid : string
  raw? : Buffer
}

export interface SequenceEvent {
  hash              : string
  label             : 'mempool' | 'block_connect' | 'block_disconnect'
  mempool_sequence? : number
}

// ============================================================================
// MockZMQEventBus
// ============================================================================

/**
 * Mock implementation of ZMQ event bus for testing
 *
 * Simulates ZMQ pub/sub without actual network connections
 */
export class MockZMQEventBus extends EventEmitter {
  private _connected : boolean
  private _topics    : Set<string>
  private _events    : MockZMQEvent[] = []
  private _sequence  : number = 0
  private _recorder  : ReturnType<typeof create_call_recorder>

  constructor(config: MockZMQConfig = {}) {
    super()
    this._connected = config.connected ?? false
    this._topics = new Set(config.topics ?? ['hashblock', 'hashtx', 'sequence'])
    this._recorder = create_call_recorder()
  }

  // ============================================================================
  // Connection Methods
  // ============================================================================

  /**
   * Connect to ZMQ endpoint (mock)
   */
  async connect(_endpoint?: string): Promise<void> {
    this._record_call('connect', [_endpoint])

    if (this._connected) {
      throw new Error('Already connected')
    }

    this._connected = true
    this.emit('connected')
  }

  /**
   * Disconnect from ZMQ endpoint (mock)
   */
  async disconnect(): Promise<void> {
    this._record_call('disconnect', [])

    if (!this._connected) {
      return
    }

    this._connected = false
    this.emit('disconnected')
  }

  /**
   * Subscribe to a topic
   */
  subscribe(topic: string): void {
    this._record_call('subscribe', [topic])
    this._topics.add(topic)
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string): void {
    this._record_call('unsubscribe', [topic])
    this._topics.delete(topic)
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get isConnected(): boolean {
    return this._connected
  }

  get topics(): string[] {
    return Array.from(this._topics)
  }

  get events(): ReadonlyArray<MockZMQEvent> {
    return this._events
  }

  // ============================================================================
  // Test Helpers - Event Simulation
  // ============================================================================

  /**
   * Simulate a block event
   */
  _emit_block(block: BlockEvent): void {
    if (!this._connected) return
    if (!this._topics.has('hashblock')) return

    const event: MockZMQEvent = {
      topic    : 'hashblock',
      message  : block,
      sequence : this._sequence++
    }

    this._events.push(event)
    this.emit('block', block)
    this.emit('hashblock', block.hash)
  }

  /**
   * Simulate a transaction event
   */
  _emit_transaction(tx: TransactionEvent): void {
    if (!this._connected) return
    if (!this._topics.has('hashtx')) return

    const event: MockZMQEvent = {
      topic    : 'hashtx',
      message  : tx,
      sequence : this._sequence++
    }

    this._events.push(event)
    this.emit('transaction', tx)
    this.emit('hashtx', tx.txid)
  }

  /**
   * Simulate a sequence event
   */
  _emit_sequence(seq: SequenceEvent): void {
    if (!this._connected) return
    if (!this._topics.has('sequence')) return

    const event: MockZMQEvent = {
      topic    : 'sequence',
      message  : seq,
      sequence : this._sequence++
    }

    this._events.push(event)
    this.emit('sequence', seq)
  }

  /**
   * Simulate raw block data
   */
  _emit_raw_block(hash: string, data: Buffer): void {
    if (!this._connected) return
    if (!this._topics.has('rawblock')) return

    const event: MockZMQEvent = {
      topic    : 'rawblock',
      message  : { hash, data },
      sequence : this._sequence++
    }

    this._events.push(event)
    this.emit('rawblock', { hash, data })
  }

  /**
   * Simulate raw transaction data
   */
  _emit_raw_tx(txid: string, data: Buffer): void {
    if (!this._connected) return
    if (!this._topics.has('rawtx')) return

    const event: MockZMQEvent = {
      topic    : 'rawtx',
      message  : { txid, data },
      sequence : this._sequence++
    }

    this._events.push(event)
    this.emit('rawtx', { txid, data })
  }

  // ============================================================================
  // Test Helpers - State
  // ============================================================================

  /**
   * Get all recorded calls
   */
  get _calls(): RecordedCall[] {
    return this._recorder.calls
  }

  /**
   * Force connected state
   */
  _set_connected(connected: boolean): void {
    this._connected = connected
  }

  /**
   * Clear event history
   */
  _clear_events(): void {
    this._events = []
  }

  /**
   * Reset sequence counter
   */
  _reset_sequence(): void {
    this._sequence = 0
  }

  /**
   * Get events by topic
   */
  _get_events_by_topic(topic: string): MockZMQEvent[] {
    return this._events.filter(e => e.topic === topic)
  }

  /**
   * Simulate connection loss
   */
  _simulate_disconnect(): void {
    if (!this._connected) return
    this._connected = false
    this.emit('disconnected')
    this.emit('error', new Error('Connection lost'))
  }

  /**
   * Simulate reconnection
   */
  _simulate_reconnect(): void {
    if (this._connected) return
    this._connected = true
    this.emit('connected')
  }

  /**
   * Reset to initial state
   */
  _reset(): void {
    this._connected = false
    this._events = []
    this._sequence = 0
    this._topics = new Set(['hashblock', 'hashtx', 'sequence'])
    this._recorder.clear()
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private _record_call(method: string, args: unknown[]): void {
    this._recorder.calls.push({
      method,
      args,
      timestamp: new Date()
    })
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a mock ZMQ event bus
 */
export function create_mock_zmq(config: MockZMQConfig = {}): MockZMQEventBus {
  return new MockZMQEventBus(config)
}

/**
 * Create a connected mock ZMQ event bus
 */
export async function create_connected_zmq(
  config: MockZMQConfig = {}
): Promise<MockZMQEventBus> {
  const zmq = new MockZMQEventBus(config)
  await zmq.connect()
  return zmq
}

// ============================================================================
// Export Types
// ============================================================================

export type { MockZMQConfig, MockZMQEvent }
