/**
 * Fluent transaction builder for testing
 */

import type { TxResult } from '../../../src/index.js'
import { generate_txid, generate_blockhash } from '../fixtures/index.js'

// ============================================================================
// Types
// ============================================================================

export interface TxInput {
  txid        : string
  vout        : number
  scriptSig?  : { asm: string; hex: string }
  txinwitness?: string[]
  sequence?   : number
}

export interface TxOutput {
  value        : number
  address?     : string
  scriptPubKey?: {
    asm     : string
    desc    : string
    hex     : string
    address?: string
    type    : string
  }
}

export interface TransactionBuilderState {
  txid?        : string
  version      : number
  locktime     : number
  inputs       : TxInput[]
  outputs      : TxOutput[]
  confirmations: number
  blockhash?   : string
  time?        : number
  blocktime?   : number
  fee?         : number
}

// ============================================================================
// TransactionBuilder
// ============================================================================

/**
 * Fluent builder for creating transaction fixtures
 *
 * @example
 * ```typescript
 * const tx = create_transaction_builder()
 *   .add_input('a'.repeat(64), 0)
 *   .add_output(100_000, 'bcrt1q...')
 *   .add_output(50_000, 'bcrt1q...')
 *   .with_confirmations(6)
 *   .build()
 * ```
 */
export class TransactionBuilder {
  private state: TransactionBuilderState

  constructor() {
    this.state = {
      version       : 2,
      locktime      : 0,
      inputs        : [],
      outputs       : [],
      confirmations : 0
    }
  }

  // ============================================================================
  // Input Methods
  // ============================================================================

  /**
   * Add an input to the transaction
   */
  add_input(txid: string, vout: number, options?: Partial<TxInput>): this {
    this.state.inputs.push({
      txid,
      vout,
      scriptSig   : options?.scriptSig ?? { asm: '', hex: '' },
      txinwitness : options?.txinwitness ?? [],
      sequence    : options?.sequence ?? 0xfffffffd
    })
    return this
  }

  /**
   * Add a coinbase input
   */
  add_coinbase_input(height: number = 1): this {
    const coinbase = Buffer.alloc(4)
    coinbase.writeUInt32LE(height)

    this.state.inputs.push({
      txid        : '0'.repeat(64),
      vout        : 0xffffffff,
      scriptSig   : { asm: '', hex: coinbase.toString('hex') },
      txinwitness : ['0'.repeat(64)],
      sequence    : 0xffffffff
    })
    return this
  }

  /**
   * Add multiple inputs
   */
  add_inputs(inputs: Array<{ txid: string; vout: number }>): this {
    for (const input of inputs) {
      this.add_input(input.txid, input.vout)
    }
    return this
  }

  /**
   * Clear all inputs
   */
  clear_inputs(): this {
    this.state.inputs = []
    return this
  }

  // ============================================================================
  // Output Methods
  // ============================================================================

  /**
   * Add an output to the transaction
   */
  add_output(
    value   : number,
    address?: string,
    type   : string = 'witness_v0_keyhash'
  ): this {
    const addr = address ?? 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080'

    this.state.outputs.push({
      value,
      address: addr,
      scriptPubKey: {
        asm     : `OP_0 ${addr}`,
        desc    : `addr(${addr})`,
        hex     : '0014' + '0'.repeat(40),
        address : addr,
        type
      }
    })
    return this
  }

  /**
   * Add an OP_RETURN output
   */
  add_op_return(data: string): this {
    const hex = Buffer.from(data).toString('hex')

    this.state.outputs.push({
      value: 0,
      scriptPubKey: {
        asm  : `OP_RETURN ${hex}`,
        desc : 'raw(6a' + hex.length.toString(16).padStart(2, '0') + hex + ')',
        hex  : '6a' + hex.length.toString(16).padStart(2, '0') + hex,
        type : 'nulldata'
      }
    })
    return this
  }

  /**
   * Add multiple outputs with same address
   */
  add_outputs(values: number[], address?: string): this {
    for (const value of values) {
      this.add_output(value, address)
    }
    return this
  }

  /**
   * Add a change output
   */
  add_change(
    inputTotal : number,
    outputTotal: number,
    fee        : number,
    address?   : string
  ): this {
    const change = inputTotal - outputTotal - fee
    if (change > 0) {
      this.add_output(change, address)
    }
    return this
  }

  /**
   * Clear all outputs
   */
  clear_outputs(): this {
    this.state.outputs = []
    return this
  }

  // ============================================================================
  // Transaction Properties
  // ============================================================================

  /**
   * Set the transaction ID
   */
  with_txid(txid: string): this {
    this.state.txid = txid
    return this
  }

  /**
   * Set the version
   */
  with_version(version: number): this {
    this.state.version = version
    return this
  }

  /**
   * Set the locktime
   */
  with_locktime(locktime: number): this {
    this.state.locktime = locktime
    return this
  }

  /**
   * Set locktime as block height
   */
  with_locktime_height(height: number): this {
    this.state.locktime = height
    return this
  }

  /**
   * Set locktime as timestamp
   */
  with_locktime_time(timestamp: number): this {
    // Locktimes >= 500000000 are interpreted as timestamps
    this.state.locktime = Math.max(timestamp, 500000000)
    return this
  }

  /**
   * Set the fee
   */
  with_fee(fee: number): this {
    this.state.fee = fee
    return this
  }

  // ============================================================================
  // Confirmation Methods
  // ============================================================================

  /**
   * Set the number of confirmations
   */
  with_confirmations(confirmations: number): this {
    this.state.confirmations = confirmations
    return this
  }

  /**
   * Make the transaction confirmed
   */
  confirmed(confirmations: number = 6): this {
    const now = Math.floor(Date.now() / 1000)
    this.state.confirmations = confirmations
    this.state.blockhash = this.state.blockhash ?? generate_blockhash(150 - confirmations)
    this.state.time = this.state.time ?? now
    this.state.blocktime = this.state.blocktime ?? now
    return this
  }

  /**
   * Make the transaction unconfirmed (mempool)
   */
  unconfirmed(): this {
    this.state.confirmations = 0
    delete this.state.blockhash
    delete this.state.time
    delete this.state.blocktime
    return this
  }

  /**
   * Set the block hash
   */
  with_blockhash(blockhash: string): this {
    this.state.blockhash = blockhash
    return this
  }

  /**
   * Set the block time
   */
  with_blocktime(timestamp: number): this {
    this.state.time = timestamp
    this.state.blocktime = timestamp
    return this
  }

  // ============================================================================
  // Build
  // ============================================================================

  /**
   * Build and return the transaction
   */
  build(): TxResult {
    const txid = this.state.txid ?? generate_txid()
    const inputCount = this.state.inputs.length
    const outputCount = this.state.outputs.length

    // Calculate sizes (rough estimates)
    const size = 10 + inputCount * 41 + outputCount * 34
    const vsize = 10 + inputCount * 26 + outputCount * 34
    const weight = vsize * 4

    const tx: TxResult = {
      txid,
      hash     : txid,
      version  : this.state.version,
      size,
      vsize,
      weight,
      locktime : this.state.locktime,
      vin      : this.state.inputs.map(input => ({
        txid        : input.txid,
        vout        : input.vout,
        scriptSig   : input.scriptSig ?? { asm: '', hex: '' },
        txinwitness : input.txinwitness ?? [],
        sequence    : input.sequence ?? 0xfffffffd
      })),
      vout: this.state.outputs.map((output, index) => ({
        n            : index,
        value        : output.value,
        scriptPubKey : output.scriptPubKey ?? {
          asm     : 'OP_0 mock',
          desc    : 'addr(mock)',
          hex     : '0014' + '0'.repeat(40),
          address : output.address,
          type    : 'witness_v0_keyhash'
        }
      })),
      hex: '0'.repeat(size * 2)
    }

    // Add confirmation data if confirmed
    if (this.state.confirmations > 0) {
      tx.confirmations = this.state.confirmations
      tx.blockhash = this.state.blockhash
      tx.time = this.state.time
      tx.blocktime = this.state.blocktime
    }

    // Add fee if set
    if (this.state.fee !== undefined) {
      tx.fee = this.state.fee
    }

    return tx
  }

  /**
   * Build as a mempool transaction
   */
  build_mempool(): TxResult {
    return this.unconfirmed().build()
  }

  /**
   * Build as a confirmed transaction
   */
  build_confirmed(confirmations: number = 6): TxResult {
    return this.confirmed(confirmations).build()
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.state = {
      version       : 2,
      locktime      : 0,
      inputs        : [],
      outputs       : [],
      confirmations : 0
    }
    return this
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new transaction builder
 */
export function create_transaction_builder(): TransactionBuilder {
  return new TransactionBuilder()
}

/**
 * Create a simple payment transaction
 */
export function create_payment_tx(
  inputTxid : string,
  inputVout : number,
  amount    : number,
  toAddress : string,
  change?   : number,
  changeAddress?: string
): TxResult {
  const builder = create_transaction_builder()
    .add_input(inputTxid, inputVout)
    .add_output(amount, toAddress)

  if (change !== undefined && change > 0) {
    builder.add_output(change, changeAddress)
  }

  return builder.build()
}

/**
 * Create a coinbase transaction
 */
export function create_coinbase_tx(
  height  : number = 1,
  reward  : number = 5_000_000_000,
  address?: string
): TxResult {
  return create_transaction_builder()
    .add_coinbase_input(height)
    .add_output(reward, address)
    .confirmed(100)
    .build()
}
