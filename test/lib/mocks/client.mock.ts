/**
 * Mock implementation of CoreClient for unit testing
 */

import { EventEmitter } from 'node:events'
import type {
  MockClientConfig,
  RecordedCall,
  CallRecorder
} from '../types/mock.types.js'
import type {
  BlockData,
  BlockHeader,
  ScanResults,
  TxResult,
  TxStatus,
  TxOutpoint,
  CoreConfig
} from '../../../src/index.js'
import { create_call_recorder } from '../types/mock.types.js'
import { get_default_rpc_responses } from '../fixtures/rpc.fixture.js'

// ============================================================================
// MockCoreClient
// ============================================================================

/**
 * Mock implementation of CoreClient for unit testing
 *
 * Features:
 * - Configurable RPC responses
 * - Call recording for verification
 * - Error injection
 * - Response delay simulation
 *
 * @example
 * ```typescript
 * const client = create_mock_client({
 *   responses: { getblockcount: 150 },
 *   record_calls: true
 * })
 *
 * const count = await client.get_block_count()
 * assert(client._calls.some(c => c.method === 'getblockcount'))
 * ```
 */
export class MockCoreClient extends EventEmitter {
  private _responses      : Record<string, unknown>
  private _error_methods  : Record<string, Error>
  private _response_delay : number
  private _recorder       : CallRecorder
  private _network        : string
  private _config         : Partial<CoreConfig>

  constructor(config: MockClientConfig = {}) {
    super()
    this._responses = { ...get_default_rpc_responses(), ...config.responses }
    this._error_methods = config.error_methods ?? {}
    this._response_delay = config.response_delay ?? 0
    this._recorder = create_call_recorder()
    this._network = config.network ?? 'regtest'
    this._config = {}
  }

  // ============================================================================
  // Public Getters (matches CoreClient interface)
  // ============================================================================

  get opt(): CoreConfig {
    return {
      network   : this._network,
      isolated  : true,
      debug     : false,
      verbose   : false,
      timeout   : 30000,
      init_delay: 0,
      use_cache : false,
      safemode  : false,
      no_spawn  : true,
      params    : [],
      core_params : [],
      cli_params  : [],
      ...this._config
    } as CoreConfig
  }

  get network(): string {
    return this._network
  }

  get core(): unknown {
    return null // Mock doesn't have real daemon
  }

  // ============================================================================
  // RPC Command Execution
  // ============================================================================

  /**
   * Execute an RPC command (mock implementation)
   */
  async cmd<T = unknown>(
    method  : string,
    ...args : unknown[]
  ): Promise<T> {
    const call: RecordedCall = {
      method,
      args      : args,
      timestamp : new Date()
    }

    // Simulate delay if configured
    if (this._response_delay > 0) {
      await this._delay(this._response_delay)
    }

    // Check for error injection
    if (this._error_methods[method]) {
      const error = this._error_methods[method]
      call.error = error
      this._recorder.calls.push(call)
      throw error
    }

    // Get response
    const response = this._responses[method]
    if (response === undefined) {
      const error = new Error(`No mock response for method: ${method}`)
      call.error = error
      this._recorder.calls.push(call)
      throw error
    }

    // Handle function responses (for dynamic mocking)
    const result = typeof response === 'function'
      ? (response as (args: unknown[]) => T)(call.args)
      : response as T

    call.result = result
    this._recorder.calls.push(call)
    return result
  }

  // ============================================================================
  // Block Operations
  // ============================================================================

  async get_block_count(): Promise<number> {
    return this.cmd<number>('getblockcount')
  }

  async get_chain_info(): Promise<Record<string, unknown>> {
    return this.cmd<Record<string, unknown>>('getblockchaininfo')
  }

  async get_block(query: { height?: number; hash?: string }): Promise<BlockData> {
    if (query.hash) {
      return this.cmd<BlockData>('getblock', [query.hash])
    }
    const hash = await this.cmd<string>('getblockhash', [query.height ?? 0])
    return this.cmd<BlockData>('getblock', [hash])
  }

  async get_header(query: { height?: number; hash?: string }): Promise<BlockHeader> {
    if (query.hash) {
      return this.cmd<BlockHeader>('getblockheader', [query.hash])
    }
    const hash = await this.cmd<string>('getblockhash', [query.height ?? 0])
    return this.cmd<BlockHeader>('getblockheader', [hash])
  }

  // ============================================================================
  // Wallet Operations
  // ============================================================================

  async get_loaded_wallets(): Promise<string[]> {
    return this.cmd<string[]>('listwallets')
  }

  async get_created_wallets(): Promise<string[]> {
    const list = await this.cmd<{ wallets: Array<{ name: string }> }>('listwalletdir')
    return list.wallets.map(w => w.name)
  }

  async load_wallet(_name: string): Promise<unknown> {
    // Return a mock wallet object
    return { label: _name, client: this }
  }

  async load_wallets(..._labels: string[]): Promise<Record<string, unknown>> {
    const wallets: Record<string, unknown> = {}
    for (const label of _labels) {
      wallets[label] = await this.load_wallet(label)
    }
    return wallets
  }

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  async get_tx(txid: string): Promise<TxResult | null> {
    try {
      return await this.cmd<TxResult>('getrawtransaction', [txid, 2])
    } catch {
      return null
    }
  }

  async get_tx_status(txid: string): Promise<TxStatus | null> {
    const tx = await this.get_tx(txid)
    if (!tx) return null

    if (tx.confirmations && tx.confirmations > 0) {
      return {
        confirmed    : true,
        block_hash   : tx.blockhash ?? '',
        block_height : tx.confirmations, // Simplified
        block_time   : tx.blocktime ?? 0
      }
    }
    return { confirmed: false }
  }

  async get_txout(txid: string, vout: number): Promise<TxOutpoint | null> {
    try {
      return await this.cmd<TxOutpoint>('gettxout', [txid, vout])
    } catch {
      return null
    }
  }

  async get_utxos(opt: { address?: string; pubkey?: string; script?: string }): Promise<ScanResults['unspents']> {
    const res = await this.scan_txout('start', opt)
    return res.success ? res.unspents : []
  }

  async get_txout_status(_txid: string, _vout: number): Promise<{ spent: boolean } | null> {
    return { spent: false }
  }

  async get_tx_input(_txid: string, _vout: number): Promise<unknown | null> {
    return null
  }

  // ============================================================================
  // UTXO Scanning
  // ============================================================================

  async scan_txout(action: string, ...desc: unknown[]): Promise<ScanResults> {
    return this.cmd<ScanResults>('scantxoutset', [action, JSON.stringify(desc)])
  }

  // ============================================================================
  // Mining (regtest only)
  // ============================================================================

  async mine_blocks(count = 1, addr?: string): Promise<string[]> {
    if (this._network !== 'regtest') {
      throw new Error('You can only generate funds on regtest network!')
    }
    return this.cmd<string[]>('generatetoaddress', [count, addr ?? 'mock_address'])
  }

  // ============================================================================
  // Transaction Publishing
  // ============================================================================

  async publish_tx(txdata: string | unknown, confirm = false): Promise<string> {
    const txhex = typeof txdata === 'string' ? txdata : 'mock_tx_hex'
    const txid = await this.cmd<string>('sendrawtransaction', [txhex])
    if (confirm) {
      await this.mine_blocks(1)
    }
    return txid
  }

  // ============================================================================
  // Time Manipulation (regtest only)
  // ============================================================================

  async set_time(timestamp?: number): Promise<void> {
    if (this._network !== 'regtest') {
      throw new Error('You can only manipulate time on regtest network!')
    }
    await this.cmd('setmocktime', [timestamp ?? Date.now()])
  }

  // ============================================================================
  // Test Helpers
  // ============================================================================

  /**
   * Get all recorded calls
   */
  get _calls(): RecordedCall[] {
    return this._recorder.calls
  }

  /**
   * Get error methods map (for test verification)
   */
  get _errors(): Map<string, Error> {
    return new Map(Object.entries(this._error_methods))
  }

  /**
   * Get calls for a specific method
   */
  _get_calls(method: string): RecordedCall[] {
    return this._recorder.get_calls(method)
  }

  /**
   * Check if a method was called
   */
  _was_called(method: string): boolean {
    return this._recorder.was_called(method)
  }

  /**
   * Get call count for a method
   */
  _call_count(method: string): number {
    return this._recorder.call_count(method)
  }

  /**
   * Clear all recorded calls
   */
  _clear_calls(): void {
    this._recorder.clear()
  }

  /**
   * Set a mock response for a method
   */
  _set_response(method: string, response: unknown): void {
    this._responses[method] = response
  }

  /**
   * Set multiple mock responses
   */
  _set_responses(responses: Record<string, unknown>): void {
    Object.assign(this._responses, responses)
  }

  /**
   * Set an error to throw for a method
   */
  _set_error(method: string, error: Error): void {
    this._error_methods[method] = error
  }

  /**
   * Clear error for a method
   */
  _clear_error(method: string): void {
    delete this._error_methods[method]
  }

  /**
   * Clear all errors
   */
  _clear_errors(): void {
    this._error_methods = {}
  }

  /**
   * Set response delay
   */
  _set_delay(delay_ms: number): void {
    this._response_delay = delay_ms
  }

  /**
   * Set network
   */
  _set_network(network: string): void {
    this._network = network
  }

  /**
   * Get last call for a method
   */
  _last_call(method: string): RecordedCall | undefined {
    return this._recorder.last_call(method)
  }

  /**
   * Reset mock to initial state
   */
  _reset(): void {
    this._recorder.clear()
    this._error_methods = {}
    this._responses = get_default_rpc_responses()
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a mock CoreClient instance
 */
export function create_mock_client(config: MockClientConfig = {}): MockCoreClient {
  return new MockCoreClient(config)
}

// ============================================================================
// Export Types
// ============================================================================

export type { MockClientConfig, RecordedCall }
