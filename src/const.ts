/**
 * Bitcoin network and library constants
 */

/**
 * Bitcoin unit conversions
 */
export const SATS_PER_BTC = 100_000_000
export const SAT_MULTI = SATS_PER_BTC  // Alias for backward compatibility

/**
 * Transaction limits
 */
export const DUST_LIMIT = 1_000         // Minimum viable output in sats
export const DUST_LIMIT_SATS = 546      // Standard dust limit
export const MIN_TX_FEE = 1_000         // Minimum transaction fee in sats
export const MIN_RELAY_FEE_SATS = 1_000 // sat/kvB
export const FALLBACK_FEE = 5_000       // Default fallback fee rate

/**
 * Regtest-specific constants
 */
export const REGTEST_BLOCK_SUBSIDY_SATS = 50 * SATS_PER_BTC
export const REGTEST_INITIAL_BLOCKS = 125  // Ensures mature coinbase
export const FAUCET_MIN_BAL = REGTEST_BLOCK_SUBSIDY_SATS * 20  // 100 BTC minimum

// Aliases for backward compatibility
export const INIT_BLOCK_CT = REGTEST_INITIAL_BLOCKS

/**
 * Rate limiting
 */
export const RATE_LIMIT = 0

/**
 * Default timeout values (milliseconds)
 */
export const DEFAULT_TIMEOUT_MS = 30_000
export const DEFAULT_STARTUP_TIMEOUT_MS = 30_000
export const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 10_000
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000

/**
 * Port allocation for isolated mode
 */
export const PORT_RANGE_MIN = 25_000
export const PORT_RANGE_MAX = 50_000

/**
 * Generate a random port in the allowed range
 * Used for isolated mode to avoid port conflicts
 *
 * NOTE: The old implementation had a bug that always returned 25000:
 *   Math.floor((Math.random() * 10 ** 5 % 25_000) + 25_000)
 * This has been fixed.
 */
export function randomPort(): number {
  return Math.floor(Math.random() * (PORT_RANGE_MAX - PORT_RANGE_MIN)) + PORT_RANGE_MIN
}

// Backward compatibility alias - fixed implementation
export const RANDOM_PORT = randomPort

/**
 * Random sort comparator for shuffling arrays
 */
export const RANDOM_SORT = () => Math.random() > 0.5 ? 1 : -1

/**
 * Network names and their aliases
 */
export type NetworkName = 'main' | 'test' | 'signet' | 'regtest'

export const NETWORK_ALIASES: Record<string, NetworkName> = {
  'main': 'main',
  'mainnet': 'main',
  'bitcoin': 'main',
  'test': 'test',
  'testnet': 'test',
  'testnet3': 'test',
  'signet': 'signet',
  'regtest': 'regtest',
}

/**
 * Default Bitcoin Core paths by platform
 */
export const DEFAULT_PATHS = {
  darwin: {
    corepath: '/usr/local/bin/bitcoind',
    clipath: '/usr/local/bin/bitcoin-cli',
    datapath: '~/Library/Application Support/Bitcoin',
    confpath: '~/Library/Application Support/Bitcoin/bitcoin.conf',
  },
  linux: {
    corepath: '/usr/bin/bitcoind',
    clipath: '/usr/bin/bitcoin-cli',
    datapath: '~/.bitcoin',
    confpath: '~/.bitcoin/bitcoin.conf',
  },
  win32: {
    corepath: 'C:\\Program Files\\Bitcoin\\daemon\\bitcoind.exe',
    clipath: 'C:\\Program Files\\Bitcoin\\daemon\\bitcoin-cli.exe',
    datapath: '%APPDATA%\\Bitcoin',
    confpath: '%APPDATA%\\Bitcoin\\bitcoin.conf',
  },
} as const

/**
 * Transaction sizing constants (for fee estimation)
 */
/** Transaction input size: 32 txid + 4 vout + 4 sequence + 1 script length */
export const TXIN_SIZE = 41
/** Witness virtual size: ceil((66 sig + 34 pubkey + 1) / 4) */
export const WIT_VSIZE = 26
/** Transaction output size: 8 value + 1 script len + 1 version + 20 pubkeyhash */
export const TXO_SIZE = 30

/**
 * BIP32 and cryptographic constants
 */
/** BIP32 hardened derivation flag (2^31) */
export const BIP32_HARDENED_FLAG = 0x80000000
/** Replace-by-fee sequence number */
export const RBF_SEQUENCE = 0xfffffffd
/** Taproot script version */
export const TAPROOT_VERSION = 0xc0

/**
 * Extended key version bytes for different networks
 */
export const TESTNET_VERSIONS = { private: 0x04358394, public: 0x043587cf } as const
export const MAINNET_VERSIONS = { private: 0x0488ade4, public: 0x0488b21e } as const

/**
 * Process management constants
 */
/** Maximum lines to keep in process log buffer */
export const LOG_BUFFER_MAX_LINES = 1000
/** Default spawn timeout in milliseconds */
export const DEFAULT_SPAWN_TIMEOUT_MS = 10_000
/** Health check staleness threshold in milliseconds */
export const HEALTH_CHECK_STALE_MS = 30_000

/**
 * Error patterns that indicate actual errors (not just warnings)
 */
export const ERROR_PATTERNS: RegExp[] = [
  /Error:/i,
  /FATAL:/i,
  /Cannot /i,
  /Unable to /i,
  /Failed to /i,
  /error: /i,
  /Aborted/i,
  /Segmentation fault/i
]

/**
 * Warning patterns that should NOT be treated as errors
 */
export const WARNING_PATTERNS: RegExp[] = [
  /Warning:/i,
  /Deprecation warning/i,
  /Experimental feature/i,
  /zmq:/i,  // ZMQ messages often go to stderr
  /^$/      // Empty lines
]
