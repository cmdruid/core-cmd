/**
 * Block fixtures for testing
 */

import type { BlockData, BlockHeader } from '../../../src/index.js'
import type { BlockFixtureData, BlockHeaderFixture, FullBlockFixture } from '../types/fixture.types.js'

import { generate_txid } from './transaction.fixture.js'

// ============================================================================
// Sample Data
// ============================================================================

const GENESIS_HASH = '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206'

// ============================================================================
// Block Header Fixtures
// ============================================================================

/**
 * Create a block header fixture
 */
export function create_header_fixture(
  overrides: Partial<BlockHeader> = {}
): BlockHeader {
  const height = overrides.height ?? 150
  const hash = overrides.hash ?? generate_blockhash(height)
  const time = overrides.time ?? Math.floor(Date.now() / 1000)

  return {
    hash,
    confirmations     : overrides.confirmations ?? 1,
    height,
    version           : 536870912,
    versionHex        : '20000000',
    merkleroot        : generate_merkle_root(),
    time,
    mediantime        : time - 300,
    nonce             : 0,
    bits              : '207fffff',
    difficulty        : 4.656542373906925e-10,
    chainwork         : '0'.repeat(64),
    nTx               : overrides.nTx ?? 1,
    previousblockhash : overrides.previousblockhash ?? generate_blockhash(height - 1),
    ...overrides
  }
}

/**
 * Create a genesis block header (regtest)
 */
export function create_genesis_header_fixture(): BlockHeader {
  return create_header_fixture({
    hash              : GENESIS_HASH,
    height            : 0,
    confirmations     : 150,
    previousblockhash : undefined as unknown as string,
    time              : 1296688602,
    mediantime        : 1296688602
  })
}

// ============================================================================
// Full Block Fixtures
// ============================================================================

/**
 * Create a full block data fixture
 */
export function create_block_fixture(
  overrides: Partial<BlockData> = {}
): BlockData {
  const header = create_header_fixture(overrides)
  const txids = overrides.tx ?? [generate_txid()]

  return {
    ...header,
    strippedsize : 250,
    size         : 286,
    weight       : 1036,
    tx           : txids,
    nTx          : txids.length,
    ...overrides
  }
}

/**
 * Create a block with multiple transactions
 */
export function create_block_with_txs_fixture(
  txCount : number = 5,
  height? : number
): BlockData {
  const txids = Array.from({ length: txCount }, () => generate_txid())

  return create_block_fixture({
    height,
    tx  : txids,
    nTx : txCount
  })
}

/**
 * Create a block fixture data (simplified)
 */
export function create_block_data_fixture(
  overrides: Partial<BlockFixtureData> = {}
): BlockFixtureData {
  const height = overrides.height ?? 150
  return {
    height,
    hash  : overrides.hash ?? generate_blockhash(height),
    txids : overrides.txids ?? [generate_txid()],
    time  : overrides.time ?? Math.floor(Date.now() / 1000)
  }
}

// ============================================================================
// Block Chain Fixtures
// ============================================================================

/**
 * Create a chain of block headers
 */
export function create_header_chain_fixture(
  length     : number = 10,
  startHeight: number = 0
): BlockHeader[] {
  const chain: BlockHeader[] = []
  let prevHash = startHeight === 0 ? undefined : generate_blockhash(startHeight - 1)

  for (let i = 0; i < length; i++) {
    const height = startHeight + i
    const hash = generate_blockhash(height)

    chain.push(create_header_fixture({
      height,
      hash,
      previousblockhash : prevHash as string,
      confirmations     : length - i
    }))

    prevHash = hash
  }

  return chain
}

/**
 * Create a chain of full blocks
 */
export function create_block_chain_fixture(
  length     : number = 10,
  startHeight: number = 0
): BlockData[] {
  const chain: BlockData[] = []
  let prevHash = startHeight === 0 ? undefined : generate_blockhash(startHeight - 1)

  for (let i = 0; i < length; i++) {
    const height = startHeight + i
    const hash = generate_blockhash(height)

    chain.push(create_block_fixture({
      height,
      hash,
      previousblockhash : prevHash as string,
      confirmations     : length - i
    }))

    prevHash = hash
  }

  return chain
}

// ============================================================================
// Full Block Fixtures (with transaction details)
// ============================================================================

/**
 * Create a full block fixture with header, txids, and optional full tx data
 */
export function create_full_block_fixture(
  height : number = 150,
  txCount: number = 1
): FullBlockFixture {
  const hash = generate_blockhash(height)
  const txids = Array.from({ length: txCount }, () => generate_txid())

  return {
    header : create_header_fixture({ height, hash, nTx: txCount }) as BlockHeaderFixture,
    txids
  }
}

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Create fixtures for reorg testing
 */
export function create_reorg_fixtures(): {
  main_chain : BlockData[]
  fork_chain : BlockData[]
  fork_point : number
} {
  const forkPoint = 5
  const mainChain = create_block_chain_fixture(10)

  // Create fork starting from forkPoint
  const forkChain = create_block_chain_fixture(5, forkPoint)
  // Update the fork chain to have different hashes
  forkChain.forEach((block, i) => {
    block.hash = 'f' + block.hash.slice(1)
    if (i > 0) {
      block.previousblockhash = forkChain[i - 1].hash
    }
  })

  return {
    main_chain : mainChain,
    fork_chain : forkChain,
    fork_point : forkPoint
  }
}

/**
 * Create fixtures for block synchronization testing
 */
export function create_sync_test_fixtures(
  behind  : number = 100,
  current : number = 150
): {
  behind  : BlockData
  current : BlockData
  gap     : number
} {
  return {
    behind  : create_block_fixture({ height: behind }),
    current : create_block_fixture({ height: current }),
    gap     : current - behind
  }
}

/**
 * Create fixtures for testing block at specific heights
 */
export function create_height_test_fixtures(): {
  genesis    : BlockData
  early      : BlockData
  middle     : BlockData
  recent     : BlockData
  tip        : BlockData
} {
  return {
    genesis : create_block_fixture({ height: 0, hash: GENESIS_HASH }),
    early   : create_block_fixture({ height: 10 }),
    middle  : create_block_fixture({ height: 75 }),
    recent  : create_block_fixture({ height: 140 }),
    tip     : create_block_fixture({ height: 150, confirmations: 1 })
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a block hash for a given height
 */
export function generate_blockhash(height: number): string {
  // Create a deterministic but unique hash based on height
  return height.toString(16).padStart(8, '0').repeat(8)
}

/**
 * Generate a random block hash
 */
export function generate_random_blockhash(): string {
  const chars = '0123456789abcdef'
  let hash = ''
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)]
  }
  return hash
}

/**
 * Generate a merkle root (mock)
 */
export function generate_merkle_root(): string {
  return '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'
}

/**
 * Calculate expected confirmations given current height and block height
 */
export function calculate_confirmations(
  current_height : number,
  block_height   : number
): number {
  return current_height - block_height + 1
}

// ============================================================================
// Export Types
// ============================================================================

export type { BlockFixtureData, BlockHeaderFixture, FullBlockFixture }
