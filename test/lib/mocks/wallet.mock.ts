/**
 * Mock implementation of CoreWallet for unit testing
 */

import { EventEmitter } from 'events'
import type { MockWalletConfig, MockUTXOData, RecordedCall } from '../types/mock.types.js'
import type { UTXO, WalletInfo } from '../../../src/index.js'
import { create_call_recorder } from '../types/mock.types.js'
import { create_utxo_fixture } from '../fixtures/wallet.fixture.js'

// ============================================================================
// MockCoreWallet
// ============================================================================

/**
 * Mock implementation of CoreWallet for unit testing
 *
 * Features:
 * - Configurable balance and UTXOs
 * - Address generation with counter
 * - UTXO selection simulation
 * - Call recording for verification
 *
 * @example
 * ```typescript
 * const wallet = create_mock_wallet({
 *   label: 'test_wallet',
 *   balance: 100_000_000,  // 1 BTC
 *   utxos: [{ txid: 'a'.repeat(64), vout: 0, sats: 100_000_000 }]
 * })
 *
 * const balance = await wallet.get_balance()
 * const address = await wallet.generate_address()
 * ```
 */
export class MockCoreWallet extends EventEmitter {
  private _label           : string
  private _balance         : number
  private _utxos           : UTXO[]
  private _network         : string
  private _address_counter : number = 0
  private _addresses       : Map<string, string> = new Map()
  private _recorder        : ReturnType<typeof create_call_recorder>
  private _client          : unknown

  constructor(config: MockWalletConfig) {
    super()
    this._label = config.label
    this._balance = config.balance ?? 0
    this._network = config.network ?? 'regtest'
    this._recorder = create_call_recorder()
    this._client = null

    // Convert MockUTXOData to UTXO
    this._utxos = (config.utxos ?? []).map(u => this._convert_utxo(u))
  }

  // ============================================================================
  // Public Getters (matches CoreWallet interface)
  // ============================================================================

  get client(): unknown {
    return this._client
  }

  get label(): string {
    return this._label
  }

  get network(): string {
    return this._network
  }

  // ============================================================================
  // Info Methods
  // ============================================================================

  async get_info(): Promise<WalletInfo> {
    this._record_call('get_info', [])
    return {
      walletname           : this._label,
      walletversion        : 169900,
      format               : 'sqlite',
      balance              : this._balance / 100_000_000,
      unconfirmed_balance  : 0,
      immature_balance     : 0,
      txcount              : this._utxos.length,
      keypoololdest        : Date.now() / 1000,
      keypoolsize          : 1000,
      keypoolsize_hd_internal: 1000,
      hdseedid             : 'mock_seed_id',
      paytxfee             : 0,
      private_keys_enabled : true,
      avoid_reuse          : false,
      scanning             : false,
      descriptors          : true,
      external_signer      : false
    }
  }

  async is_created_check(): Promise<boolean> {
    this._record_call('is_created_check', [])
    return true
  }

  async is_loaded_check(): Promise<boolean> {
    this._record_call('is_loaded_check', [])
    return true
  }

  async get_balance(): Promise<number> {
    this._record_call('get_balance', [])
    return this._balance
  }

  async list_utxos(): Promise<UTXO[]> {
    this._record_call('list_utxos', [])
    return [...this._utxos]
  }

  async list_descriptors(_includePrivate?: boolean): Promise<unknown[]> {
    this._record_call('list_descriptors', [_includePrivate])
    return []
  }

  async get_wpkh_xprv(): Promise<string> {
    this._record_call('get_wpkh_xprv', [])
    return 'tprv8ZgxMBicQKsPd...'
  }

  async get_wpkh_xpub(): Promise<string> {
    this._record_call('get_wpkh_xpub', [])
    return 'tpub8ZgxMBicQKsPd...'
  }

  // ============================================================================
  // Address Methods
  // ============================================================================

  async generate_address(_config?: unknown): Promise<string> {
    this._record_call('generate_address', [_config])
    this._address_counter++
    const prefix = this._network === 'regtest' ? 'bcrt1q' : 'tb1q'
    return `${prefix}mock_address_${this._address_counter}`
  }

  async generate_script_key(): Promise<string[]> {
    this._record_call('generate_script_key', [])
    return ['OP_DUP', 'OP_HASH160', 'mock_pubkey_hash', 'OP_EQUALVERIFY', 'OP_CHECKSIG']
  }

  async get_address(label: string, _type?: string): Promise<string> {
    this._record_call('get_address', [label, _type])

    // Return cached address if exists
    const cached = this._addresses.get(label)
    if (cached) return cached

    // Generate new address
    const address = await this.generate_address()
    this._addresses.set(label, address)
    return address
  }

  async parse_address(address: string): Promise<unknown> {
    this._record_call('parse_address', [address])
    return {
      address,
      scriptPubKey : 'mock_script_pubkey',
      ismine       : true,
      iswatchonly  : false,
      isscript     : false,
      iswitness    : true
    }
  }

  async get_pubkey(_address: string): Promise<string> {
    this._record_call('get_pubkey', [_address])
    return '02' + 'c'.repeat(64)
  }

  async generate_pubkey(_config?: unknown): Promise<string> {
    this._record_call('generate_pubkey', [_config])
    return '02' + 'c'.repeat(64)
  }

  async get_descriptor(_address: string): Promise<unknown> {
    this._record_call('get_descriptor', [_address])
    return {
      desc   : 'wpkh([fingerprint/84h/1h/0h]tpubkey/0/*)#checksum',
      mprint : 'mock_fingerprint',
      path   : "84'/1'/0'/0",
      pubkey : '02' + 'c'.repeat(64),
      seckey : 'd'.repeat(64),
      master : 'tprv...'
    }
  }

  async generate_descriptor(_config?: unknown): Promise<unknown> {
    this._record_call('generate_descriptor', [_config])
    return this.get_descriptor('mock')
  }

  // ============================================================================
  // Transaction Methods
  // ============================================================================

  async send_funds(amount: number, address: string, mine_block?: boolean): Promise<string> {
    this._record_call('send_funds', [amount, address, mine_block])

    if (amount > this._balance) {
      throw new Error(`Insufficient balance: ${this._balance} < ${amount}`)
    }

    this._balance -= amount
    return 'a'.repeat(64) // Mock txid
  }

  async ensure_funds(min_bal: number): Promise<void> {
    this._record_call('ensure_funds', [min_bal])

    if (this._balance < min_bal) {
      // Simulate receiving funds
      this._balance = min_bal
    }
  }

  async drain_faucet(amount: number, _address?: string): Promise<string> {
    this._record_call('drain_faucet', [amount, _address])
    this._balance += amount
    return 'a'.repeat(64)
  }

  async create_utxo(amount: number, _address?: string, _mine_block?: boolean): Promise<unknown> {
    this._record_call('create_utxo', [amount, _address, _mine_block])

    const utxo = create_utxo_fixture({ sats: amount })
    this._utxos.push(utxo)

    return {
      txid    : utxo.txid,
      vout    : utxo.vout,
      prevout : { value: BigInt(amount), scriptPubKey: utxo.scriptPubKey }
    }
  }

  async select_utxos(amount: number, _sorter?: unknown): Promise<UTXO[]> {
    this._record_call('select_utxos', [amount, _sorter])

    // Simple greedy selection
    const sorted = [...this._utxos].sort((a, b) => b.sats - a.sats)
    const selected: UTXO[] = []
    let total = 0

    for (const utxo of sorted) {
      if (total >= amount) break
      selected.push(utxo)
      total += utxo.sats
    }

    if (total < amount) {
      throw new Error(`Insufficient UTXOs: ${total} < ${amount}`)
    }

    return selected
  }

  async fund_tx(_template: unknown, _config?: unknown, _txfee?: number): Promise<unknown> {
    this._record_call('fund_tx', [_template, _config, _txfee])
    return { version: 2, locktime: 0, vin: [], vout: [] }
  }

  async fund_psbt(_psbt: string, _options?: unknown): Promise<string> {
    this._record_call('fund_psbt', [_psbt, _options])
    return 'mock_funded_psbt_base64'
  }

  async sign_psbt(_psbt: string): Promise<string> {
    this._record_call('sign_psbt', [_psbt])
    return 'mock_signed_psbt_base64'
  }

  async add_segwit_desc(_psbt: string, _pubkey: string, _index: number): Promise<string> {
    this._record_call('add_segwit_desc', [_psbt, _pubkey, _index])
    return 'mock_psbt_with_segwit_desc'
  }

  async add_taproot_desc(
    _psbt: string,
    _pubkey: string,
    _index: number,
    _scripts?: unknown,
    _version?: number
  ): Promise<string> {
    this._record_call('add_taproot_desc', [_psbt, _pubkey, _index, _scripts, _version])
    return 'mock_psbt_with_taproot_desc'
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
   * Clear all recorded calls
   */
  _clear_calls(): void {
    this._recorder.clear()
  }

  /**
   * Set balance
   */
  _set_balance(balance: number): void {
    this._balance = balance
  }

  /**
   * Add balance
   */
  _add_balance(amount: number): void {
    this._balance += amount
  }

  /**
   * Add a UTXO
   */
  _add_utxo(utxo: MockUTXOData): void {
    this._utxos.push(this._convert_utxo(utxo))
  }

  /**
   * Remove a UTXO
   */
  _remove_utxo(txid: string, vout: number): boolean {
    const index = this._utxos.findIndex(u => u.txid === txid && u.vout === vout)
    if (index >= 0) {
      this._utxos.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Clear all UTXOs
   */
  _clear_utxos(): void {
    this._utxos = []
  }

  /**
   * Set client reference
   */
  _set_client(client: unknown): void {
    this._client = client
  }

  /**
   * Reset wallet to initial state
   */
  _reset(): void {
    this._balance = 0
    this._utxos = []
    this._addresses.clear()
    this._address_counter = 0
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

  private _convert_utxo(data: MockUTXOData): UTXO {
    return create_utxo_fixture({
      txid          : data.txid,
      vout          : data.vout,
      sats          : data.sats,
      confirmations : data.confirmations ?? 6,
      address       : data.address ?? undefined,
      scriptPubKey  : data.scriptPubKey ?? undefined
    } as any)
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a mock CoreWallet instance
 */
export function create_mock_wallet(config: MockWalletConfig): MockCoreWallet {
  return new MockCoreWallet(config)
}

/**
 * Create a mock faucet wallet with large balance
 */
export function create_mock_faucet(balance: number = 100_000_000_000): MockCoreWallet {
  return create_mock_wallet({
    label   : 'faucet',
    balance,
    utxos   : [
      { txid: 'f'.repeat(64), vout: 0, sats: balance }
    ]
  })
}

// ============================================================================
// Export Types
// ============================================================================

export type { MockWalletConfig, MockUTXOData }
