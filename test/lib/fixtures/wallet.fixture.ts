/**
 * Wallet and UTXO fixtures for testing
 */

import type { UTXO, WalletInfo } from '../../../src/index.js'
import type { WalletFixtureData, UTXOFixtureData, FullWalletFixture } from '../types/fixture.types.js'


// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_TXID = 'a'.repeat(64)
const SAMPLE_ADDRESS = 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080'
const SAMPLE_SCRIPT_PUBKEY = `0014${'0'.repeat(40)}`

// ============================================================================
// UTXO Fixtures
// ============================================================================

/**
 * Create a single UTXO fixture
 */
export function create_utxo_fixture(overrides: Partial<UTXO> & { sats?: number } = {}): UTXO {
  const txid = overrides.txid ?? SAMPLE_TXID
  const vout = overrides.vout ?? 0
  const sats = overrides.sats ?? 100_000_000

  return {
    txid,
    vout,
    address       : overrides.address ?? SAMPLE_ADDRESS,
    label         : overrides.label ?? 'default',
    scriptPubKey  : overrides.scriptPubKey ?? SAMPLE_SCRIPT_PUBKEY,
    amount        : sats / 100_000_000,
    confirmations : overrides.confirmations ?? 6,
    spendable     : overrides.spendable ?? true,
    solvable      : overrides.solvable ?? true,
    desc          : overrides.desc ?? `wpkh([mock/84h/1h/0h]mock_pubkey)#checksum`,
    parent_descs  : overrides.parent_descs ?? [],
    safe          : overrides.safe ?? true,
    sats
  }
}

/**
 * Create a set of UTXOs with specified amounts
 */
export function create_utxo_set_fixture(amounts: number[]): UTXO[] {
  return amounts.map((sats, index) => {
    // Create unique txid for each UTXO
    const txid = index.toString(16).padStart(64, '0')
    return create_utxo_fixture({ txid, vout: 0, sats })
  })
}

/**
 * Create UTXOs for testing coin selection
 */
export function create_coin_selection_utxos(): UTXO[] {
  return create_utxo_set_fixture([
    10_000,      // Dust
    100_000,     // Small
    500_000,     // Medium
    1_000_000,   // 0.01 BTC
    5_000_000,   // 0.05 BTC
    10_000_000,  // 0.1 BTC
    50_000_000,  // 0.5 BTC
    100_000_000  // 1 BTC
  ])
}

/**
 * Create a confirmed UTXO
 */
export function create_confirmed_utxo_fixture(
  sats          : number,
  confirmations : number = 6
): UTXO {
  return create_utxo_fixture({ sats, confirmations })
}

/**
 * Create an unconfirmed (mempool) UTXO
 */
export function create_mempool_utxo_fixture(sats: number): UTXO {
  return create_utxo_fixture({ sats, confirmations: 0 })
}

// ============================================================================
// Wallet Info Fixtures
// ============================================================================

/**
 * Create a wallet info fixture
 */
export function create_wallet_info_fixture(
  overrides: Partial<WalletInfo> = {}
): WalletInfo {
  return {
    walletname             : overrides.walletname ?? 'test_wallet',
    walletversion          : 169900,
    format                 : 'sqlite',
    balance                : overrides.balance ?? 0,
    unconfirmed_balance    : overrides.unconfirmed_balance ?? 0,
    immature_balance       : overrides.immature_balance ?? 0,
    txcount                : overrides.txcount ?? 0,
    keypoololdest          : Math.floor(Date.now() / 1000),
    keypoolsize            : 1000,
    keypoolsize_hd_internal: 1000,
    hdseedid               : 'mock_seed_id',
    paytxfee               : 0,
    private_keys_enabled   : true,
    avoid_reuse            : false,
    scanning               : false,
    descriptors            : true,
    external_signer        : false,
    ...overrides
  }
}

// ============================================================================
// Wallet Data Fixtures
// ============================================================================

/**
 * Create a wallet fixture with name, balance, and UTXOs
 */
export function create_wallet_fixture(
  config: Partial<WalletFixtureData> = {}
): WalletFixtureData {
  const balance = config.balance ?? 0
  const utxos = config.utxos ?? (balance > 0
    ? [create_utxo_fixture({ sats: balance })]
    : []
  )

  return {
    name    : config.name ?? 'test_wallet',
    balance,
    utxos
  }
}

/**
 * Create a faucet wallet fixture with large balance
 */
export function create_faucet_fixture(
  balance: number = 100_000_000_000 // 1000 BTC
): WalletFixtureData {
  return create_wallet_fixture({
    name: 'faucet',
    balance,
    utxos: [create_utxo_fixture({ sats: balance, confirmations: 100 })]
  })
}

/**
 * Create an empty wallet fixture
 */
export function create_empty_wallet_fixture(name: string = 'empty'): WalletFixtureData {
  return create_wallet_fixture({
    name,
    balance: 0,
    utxos: []
  })
}

/**
 * Create a rich wallet fixture with multiple UTXOs
 */
export function create_rich_wallet_fixture(
  name    : string = 'rich',
  balance : number = 10_000_000_000 // 100 BTC
): WalletFixtureData {
  // Create multiple UTXOs of varying sizes
  const utxos = create_coin_selection_utxos()
  const totalSats = utxos.reduce((sum, u) => sum + u.sats, 0)

  // Add a large UTXO to reach target balance
  if (balance > totalSats) {
    utxos.push(create_utxo_fixture({ sats: balance - totalSats }))
  }

  return create_wallet_fixture({
    name,
    balance,
    utxos
  })
}

// ============================================================================
// Full Wallet Fixtures
// ============================================================================

/**
 * Create a complete wallet fixture with all data
 */
export function create_full_wallet_fixture(
  name    : string = 'full_wallet',
  balance : number = 1_000_000_000
): FullWalletFixture {
  const utxos = [create_utxo_fixture({ sats: balance })]
  const addresses = [
    SAMPLE_ADDRESS,
    `bcrt1qmock1${'a'.repeat(31)}`,
    `bcrt1qmock2${'b'.repeat(31)}`
  ]

  return {
    name,
    info: create_wallet_info_fixture({
      walletname : name,
      balance    : balance / 100_000_000
    }),
    descriptors: [
      {
        desc      : `wpkh([mock/84h/1h/0h]tpubmock/0/*)#checksum`,
        timestamp : Math.floor(Date.now() / 1000),
        active    : true,
        internal  : false,
        range     : [0, 999],
        next      : 1
      },
      {
        desc      : `wpkh([mock/84h/1h/0h]tpubmock/1/*)#checksum`,
        timestamp : Math.floor(Date.now() / 1000),
        active    : true,
        internal  : true,
        range     : [0, 999],
        next      : 0
      }
    ],
    utxos,
    addresses
  }
}

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Create wallet fixtures for multi-wallet testing
 */
export function create_multi_wallet_fixtures(count: number = 3): WalletFixtureData[] {
  return Array.from({ length: count }, (_, i) =>
    create_wallet_fixture({
      name    : `wallet_${i}`,
      balance : (i + 1) * 1_000_000_000 // 10, 20, 30 BTC
    })
  )
}

/**
 * Create fixtures for balance testing scenarios
 */
export function create_balance_test_fixtures(): {
  empty     : WalletFixtureData
  small     : WalletFixtureData
  medium    : WalletFixtureData
  large     : WalletFixtureData
  faucet    : WalletFixtureData
} {
  return {
    empty  : create_empty_wallet_fixture('empty'),
    small  : create_wallet_fixture({ name: 'small', balance: 100_000 }),
    medium : create_wallet_fixture({ name: 'medium', balance: 10_000_000 }),
    large  : create_wallet_fixture({ name: 'large', balance: 1_000_000_000 }),
    faucet : create_faucet_fixture()
  }
}

// ============================================================================
// Address Fixtures
// ============================================================================

/**
 * Generate test addresses
 */
export function create_address_fixtures(
  network : 'regtest' | 'testnet' | 'mainnet' = 'regtest',
  count   : number = 5
): string[] {
  const prefix = network === 'regtest' ? 'bcrt1q'
    : network === 'testnet' ? 'tb1q'
    : 'bc1q'

  return Array.from({ length: count }, (_, i) =>
    `${prefix}mock${i.toString().padStart(32, '0')}`
  )
}

// ============================================================================
// Export Types
// ============================================================================

export type { WalletFixtureData, UTXOFixtureData, FullWalletFixture }
