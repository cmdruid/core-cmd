/**
 * Fluent RPC response builder for testing
 */

import { get_default_rpc_responses } from '../fixtures/rpc.fixture.js'
import { create_utxo_fixture } from '../fixtures/wallet.fixture.js'
import { generate_txid, generate_blockhash } from '../fixtures/index.js'

// ============================================================================
// Types
// ============================================================================

export interface ResponseBuilderState {
  responses: Record<string, unknown>
}

// ============================================================================
// ResponseBuilder
// ============================================================================

/**
 * Fluent builder for creating RPC response sets
 *
 * @example
 * ```typescript
 * const responses = create_response_builder()
 *   .with_block_count(150)
 *   .with_confirmed_transaction(6)
 *   .with_utxos([{ sats: 100_000 }, { sats: 50_000 }])
 *   .with_loaded_wallets(['alice', 'bob'])
 *   .build()
 * ```
 */
export class ResponseBuilder {
  private state: ResponseBuilderState

  constructor() {
    this.state = {
      responses: { ...get_default_rpc_responses() }
    }
  }

  // ============================================================================
  // Blockchain Methods
  // ============================================================================

  /**
   * Set the block count
   */
  with_block_count(count: number): this {
    this.state.responses.getblockcount = count

    // Update chain info to match
    const chainInfo = this.state.responses.getblockchaininfo as Record<string, unknown>
    if (chainInfo) {
      chainInfo.blocks = count
      chainInfo.headers = count
    }

    return this
  }

  /**
   * Set the chain info
   */
  with_chain_info(info: Record<string, unknown>): this {
    this.state.responses.getblockchaininfo = {
      ...this.state.responses.getblockchaininfo as Record<string, unknown>,
      ...info
    }
    return this
  }

  /**
   * Set the network type
   */
  with_network(network: string): this {
    const chainInfo = this.state.responses.getblockchaininfo as Record<string, unknown>
    if (chainInfo) {
      chainInfo.chain = network
    }
    return this
  }

  // ============================================================================
  // Block Methods
  // ============================================================================

  /**
   * Set block data for a specific hash
   */
  with_block(hash: string, data: Record<string, unknown>): this {
    // Store as a function that returns data based on args
    const currentGetblock = this.state.responses.getblock
    if (typeof currentGetblock === 'function') {
      const prevFn = currentGetblock as (args: unknown[]) => unknown
      this.state.responses.getblock = (args: unknown[]) => {
        if (args[0] === hash) return data
        return prevFn(args)
      }
    } else {
      this.state.responses.getblock = data
    }
    return this
  }

  /**
   * Set block hash for a specific height
   */
  with_block_hash(height: number, hash: string): this {
    const currentGetblockhash = this.state.responses.getblockhash
    if (typeof currentGetblockhash === 'function') {
      const prevFn = currentGetblockhash as (args: unknown[]) => unknown
      this.state.responses.getblockhash = (args: unknown[]) => {
        if (args[0] === height) return hash
        return prevFn(args)
      }
    } else {
      this.state.responses.getblockhash = hash
    }
    return this
  }

  /**
   * Set the best block hash
   */
  with_best_block(hash: string): this {
    const chainInfo = this.state.responses.getblockchaininfo as Record<string, unknown>
    if (chainInfo) {
      chainInfo.bestblockhash = hash
    }
    return this
  }

  // ============================================================================
  // Transaction Methods
  // ============================================================================

  /**
   * Set transaction data
   */
  with_transaction(txid: string, data: Record<string, unknown>): this {
    const currentGettx = this.state.responses.getrawtransaction
    if (typeof currentGettx === 'function') {
      const prevFn = currentGettx as (args: unknown[]) => unknown
      this.state.responses.getrawtransaction = (args: unknown[]) => {
        if (args[0] === txid) return { txid, ...data }
        return prevFn(args)
      }
    } else {
      this.state.responses.getrawtransaction = { txid, ...data }
    }
    return this
  }

  /**
   * Set a confirmed transaction
   */
  with_confirmed_transaction(confirmations: number = 6): this {
    const txid = generate_txid()
    const blockhash = generate_blockhash(150 - confirmations)

    this.state.responses.getrawtransaction = {
      ...(this.state.responses.getrawtransaction as Record<string, unknown>),
      txid,
      confirmations,
      blockhash,
      time: Math.floor(Date.now() / 1000),
      blocktime: Math.floor(Date.now() / 1000)
    }
    return this
  }

  /**
   * Set a mempool transaction
   */
  with_mempool_transaction(): this {
    const txid = generate_txid()
    const tx = this.state.responses.getrawtransaction as Record<string, unknown>

    // Remove confirmation-related fields
    const { blockhash, confirmations, time, blocktime, ...rest } = tx

    this.state.responses.getrawtransaction = {
      ...rest,
      txid,
      confirmations: 0
    }
    return this
  }

  // ============================================================================
  // Wallet Methods
  // ============================================================================

  /**
   * Set loaded wallets list
   */
  with_loaded_wallets(wallets: string[]): this {
    this.state.responses.listwallets = wallets
    return this
  }

  /**
   * Set created wallets list
   */
  with_created_wallets(wallets: string[]): this {
    this.state.responses.listwalletdir = {
      wallets: wallets.map(name => ({ name }))
    }
    return this
  }

  /**
   * Set wallet info
   */
  with_wallet_info(info: Record<string, unknown>): this {
    this.state.responses.getwalletinfo = {
      ...this.state.responses.getwalletinfo as Record<string, unknown>,
      ...info
    }
    return this
  }

  /**
   * Set wallet balance (in BTC)
   */
  with_wallet_balance(balance: number): this {
    const walletInfo = this.state.responses.getwalletinfo as Record<string, unknown>
    if (walletInfo) {
      walletInfo.balance = balance
    }
    return this
  }

  // ============================================================================
  // UTXO Methods
  // ============================================================================

  /**
   * Set UTXOs from simple amounts
   */
  with_utxos(amounts: Array<{ sats: number } | number>): this {
    const utxos = amounts.map((amount, index) => {
      const sats = typeof amount === 'number' ? amount : amount.sats
      return create_utxo_fixture({
        txid : index.toString(16).padStart(64, '0'),
        vout : 0,
        sats
      })
    })

    this.state.responses.listunspent = utxos
    return this
  }

  /**
   * Set UTXOs with full data
   */
  with_utxo_data(utxos: Array<Record<string, unknown>>): this {
    this.state.responses.listunspent = utxos
    return this
  }

  /**
   * Set scan txout result
   */
  with_scan_result(unspents: Array<Record<string, unknown>>): this {
    const totalAmount = unspents.reduce(
      (sum, u) => sum + ((u.amount as number) ?? 0),
      0
    )

    this.state.responses.scantxoutset = {
      success      : true,
      txouts       : unspents.length,
      height       : 150,
      bestblock    : generate_blockhash(150),
      unspents,
      total_amount : totalAmount
    }
    return this
  }

  // ============================================================================
  // Mining Methods
  // ============================================================================

  /**
   * Set mine blocks response
   */
  with_mine_blocks_result(hashes: string[]): this {
    this.state.responses.generatetoaddress = hashes
    return this
  }

  /**
   * Set generated addresses
   */
  with_generated_address(address: string): this {
    this.state.responses.getnewaddress = address
    return this
  }

  // ============================================================================
  // Fee Methods
  // ============================================================================

  /**
   * Set fee estimate
   */
  with_fee_estimate(feerate: number, blocks: number = 6): this {
    this.state.responses.estimatesmartfee = {
      feerate,
      blocks
    }
    return this
  }

  /**
   * Set mempool info
   */
  with_mempool_info(info: Record<string, unknown>): this {
    this.state.responses.getmempoolinfo = {
      ...this.state.responses.getmempoolinfo as Record<string, unknown>,
      ...info
    }
    return this
  }

  // ============================================================================
  // Error Methods
  // ============================================================================

  /**
   * Set a method to throw an error
   */
  with_error(method: string, error: Error): this {
    this.state.responses[method] = () => { throw error }
    return this
  }

  /**
   * Remove a method (will cause "unknown method" error)
   */
  without_method(method: string): this {
    delete this.state.responses[method]
    return this
  }

  // ============================================================================
  // Custom Methods
  // ============================================================================

  /**
   * Set a custom response
   */
  with_response(method: string, response: unknown): this {
    this.state.responses[method] = response
    return this
  }

  /**
   * Set a dynamic response function
   */
  with_dynamic_response(
    method: string,
    fn: (args: unknown[]) => unknown
  ): this {
    this.state.responses[method] = fn
    return this
  }

  /**
   * Merge additional responses
   */
  with_responses(responses: Record<string, unknown>): this {
    Object.assign(this.state.responses, responses)
    return this
  }

  // ============================================================================
  // Build
  // ============================================================================

  /**
   * Build and return the response set
   */
  build(): Record<string, unknown> {
    return { ...this.state.responses }
  }

  /**
   * Reset to defaults
   */
  reset(): this {
    this.state.responses = { ...get_default_rpc_responses() }
    return this
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new response builder
 */
export function create_response_builder(): ResponseBuilder {
  return new ResponseBuilder()
}

// ============================================================================
// Preset Builders
// ============================================================================

/**
 * Create responses for a fresh regtest node
 */
export function create_fresh_regtest_responses(): Record<string, unknown> {
  return create_response_builder()
    .with_block_count(0)
    .with_network('regtest')
    .with_loaded_wallets([])
    .with_utxos([])
    .build()
}

/**
 * Create responses for a funded test environment
 */
export function create_funded_test_responses(
  balance: number = 100_000_000_000
): Record<string, unknown> {
  return create_response_builder()
    .with_block_count(150)
    .with_loaded_wallets(['faucet'])
    .with_wallet_balance(balance / 100_000_000)
    .with_utxos([{ sats: balance }])
    .build()
}

/**
 * Create responses for error testing
 */
export function create_error_test_responses(
  errorMethod : string,
  error       : Error
): Record<string, unknown> {
  return create_response_builder()
    .with_error(errorMethod, error)
    .build()
}
