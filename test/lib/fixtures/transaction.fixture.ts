/**
 * Transaction fixtures for testing
 */

import type { TxResult, TxStatus } from '../../../src/index.js'
import type { TxFixtureData, TransactionFixture } from '../types/fixture.types.js'


// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_BLOCKHASH = 'b'.repeat(64)
const SAMPLE_ADDRESS = 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080'

// ============================================================================
// Transaction Result Fixtures
// ============================================================================

/**
 * Create a transaction result fixture
 */
export function create_tx_fixture(overrides: Partial<TxResult> = {}): TxResult {
  const txid = overrides.txid ?? generate_txid()
  const confirmations = overrides.confirmations ?? 6

  return {
    txid,
    hash    : txid,
    version : 2,
    size    : 225,
    vsize   : 144,
    weight  : 573,
    locktime: 0,
    vin     : overrides.vin ?? [],
    vout    : overrides.vout ?? [
      {
        n     : 0,
        value : 50,
        scriptPubKey: {
          asm     : 'OP_0 mock_pubkey_hash',
          desc    : `addr(${SAMPLE_ADDRESS})`,
          hex     : `0014${'0'.repeat(40)}`,
          address : SAMPLE_ADDRESS,
          type    : 'witness_v0_keyhash'
        }
      }
    ],
    hex     : '0'.repeat(450),
    ...(confirmations > 0 ? {
      blockhash     : overrides.blockhash ?? SAMPLE_BLOCKHASH,
      confirmations,
      time          : overrides.time ?? Math.floor(Date.now() / 1000),
      blocktime     : overrides.blocktime ?? Math.floor(Date.now() / 1000)
    } : {}),
    ...overrides
  }
}

/**
 * Create a confirmed transaction fixture
 */
export function create_confirmed_tx_fixture(confirmations: number = 6): TxResult {
  return create_tx_fixture({
    confirmations,
    blockhash : SAMPLE_BLOCKHASH,
    time      : Math.floor(Date.now() / 1000),
    blocktime : Math.floor(Date.now() / 1000)
  })
}

/**
 * Create a mempool (unconfirmed) transaction fixture
 */
export function create_mempool_tx_fixture(): TxResult {
  const tx = create_tx_fixture({ confirmations: 0 })
  // Remove block-related fields
  delete tx.blockhash
  delete tx.time
  delete tx.blocktime
  tx.confirmations = 0
  return tx
}

/**
 * Create a coinbase transaction fixture
 */
export function create_coinbase_tx_fixture(height: number = 1): TxResult {
  const txid = generate_txid()

  return {
    txid,
    hash    : txid,
    version : 2,
    size    : 200,
    vsize   : 173,
    weight  : 692,
    locktime: 0,
    vin     : [
      {
        coinbase : '0'.repeat(100),
        txinwitness: ['0'.repeat(64)],
        sequence : 0xffffffff
      }
    ],
    vout: [
      {
        n     : 0,
        value : 50,  // Block reward
        scriptPubKey: {
          asm     : 'OP_0 mock_pubkey_hash',
          desc    : `addr(${SAMPLE_ADDRESS})`,
          hex     : `0014${'0'.repeat(40)}`,
          address : SAMPLE_ADDRESS,
          type    : 'witness_v0_keyhash'
        }
      }
    ],
    hex           : '0'.repeat(400),
    blockhash     : SAMPLE_BLOCKHASH,
    confirmations : 100 - height,
    time          : Math.floor(Date.now() / 1000),
    blocktime     : Math.floor(Date.now() / 1000)
  } as TxResult
}

// ============================================================================
// Transaction Status Fixtures
// ============================================================================

/**
 * Create a confirmed transaction status
 */
export function create_confirmed_status_fixture(
  block_height : number = 100,
  block_hash?  : string,
  block_time?  : number
): TxStatus {
  return {
    confirmed    : true,
    block_height,
    block_hash   : block_hash ?? SAMPLE_BLOCKHASH,
    block_time   : block_time ?? Math.floor(Date.now() / 1000)
  }
}

/**
 * Create an unconfirmed transaction status
 */
export function create_unconfirmed_status_fixture(): TxStatus {
  return {
    confirmed: false
  }
}

// ============================================================================
// Transaction Data Fixtures
// ============================================================================

/**
 * Create simplified transaction fixture data
 */
export function create_tx_data_fixture(
  overrides: Partial<TxFixtureData> = {}
): TxFixtureData {
  return {
    txid          : overrides.txid ?? generate_txid(),
    hex           : overrides.hex ?? '0'.repeat(450),
    confirmations : overrides.confirmations ?? 6,
    fee           : overrides.fee ?? 1000,
    blockhash     : overrides.blockhash ?? SAMPLE_BLOCKHASH
  }
}

// ============================================================================
// Full Transaction Fixtures
// ============================================================================

/**
 * Create a complete transaction fixture with inputs and outputs
 */
export function create_full_tx_fixture(
  inputs  : Array<{ txid: string; vout: number; value: number }>,
  outputs : Array<{ address: string; value: number }>
): TransactionFixture {
  const txid = generate_txid()
  const inputValue = inputs.reduce((sum, i) => sum + i.value, 0)
  const outputValue = outputs.reduce((sum, o) => sum + o.value, 0)
  const fee = inputValue - outputValue

  return {
    txid,
    hash    : txid,
    version : 2,
    size    : 200 + inputs.length * 41 + outputs.length * 30,
    vsize   : 144 + inputs.length * 26 + outputs.length * 30,
    weight  : 573,
    locktime: 0,
    vin: inputs.map((input, _index) => ({
      txid        : input.txid,
      vout        : input.vout,
      scriptSig   : { asm: '', hex: '' },
      txinwitness : ['0'.repeat(144), `02${'c'.repeat(64)}`],
      sequence    : 0xfffffffd
    })),
    vout: outputs.map((output, index) => ({
      value : output.value,
      n     : index,
      scriptPubKey: {
        asm     : 'OP_0 mock_hash',
        desc    : `addr(${output.address})`,
        hex     : `0014${'0'.repeat(40)}`,
        address : output.address,
        type    : 'witness_v0_keyhash'
      }
    })),
    hex           : '0'.repeat(400),
    blockhash     : SAMPLE_BLOCKHASH,
    confirmations : 6,
    time          : Math.floor(Date.now() / 1000),
    blocktime     : Math.floor(Date.now() / 1000),
    fee
  }
}

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Create fixtures for transaction confirmation testing
 */
export function create_confirmation_test_fixtures(): {
  unconfirmed : TxResult
  one_conf    : TxResult
  six_conf    : TxResult
  deep_conf   : TxResult
} {
  const _baseTxid = generate_txid()

  return {
    unconfirmed : create_mempool_tx_fixture(),
    one_conf    : create_confirmed_tx_fixture(1),
    six_conf    : create_confirmed_tx_fixture(6),
    deep_conf   : create_confirmed_tx_fixture(100)
  }
}

/**
 * Create a chain of transactions (each spending the previous)
 */
export function create_tx_chain_fixture(length: number = 3): TxResult[] {
  const chain: TxResult[] = []
  let prevTxid = generate_txid()

  for (let i = 0; i < length; i++) {
    const txid = generate_txid()
    const tx = create_tx_fixture({
      txid,
      vin: i === 0 ? [] : [
        {
          txid        : prevTxid,
          vout        : 0,
          scriptSig   : { asm: '', hex: '' },
          txinwitness : [],
          sequence    : 0xffffffff,
          coinbase    : undefined
        }
      ]
    })
    chain.push(tx)
    prevTxid = txid
  }

  return chain
}

/**
 * Create fixtures for RBF (replace-by-fee) testing
 */
export function create_rbf_fixtures(): {
  original    : TxResult
  replacement : TxResult
} {
  const _txid = generate_txid()

  return {
    original: create_mempool_tx_fixture(),
    replacement: {
      ...create_mempool_tx_fixture(),
      txid: generate_txid(),
      // Higher fee
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a random transaction ID
 */
export function generate_txid(): string {
  const chars = '0123456789abcdef'
  let txid = ''
  for (let i = 0; i < 64; i++) {
    txid += chars[Math.floor(Math.random() * chars.length)]
  }
  return txid
}

/**
 * Generate a sequential transaction ID (for testing)
 */
let txidCounter = 0
export function generate_sequential_txid(): string {
  return (txidCounter++).toString(16).padStart(64, '0')
}

/**
 * Reset the sequential txid counter
 */
export function reset_txid_counter(): void {
  txidCounter = 0
}

// ============================================================================
// Export Types
// ============================================================================

export type { TxFixtureData, TransactionFixture }
