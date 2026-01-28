/**
 * Descriptor fixtures for testing parse_descriptor and related functions
 *
 * Note: These use real valid tpub/tprv keys for proper HDKey parsing
 */

// Real valid testnet keys for testing
// These are from a known test mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
const VALID_TPUB = 'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
// Note: The tprv matching the above tpub
const VALID_TPRV = 'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
const VALID_XPUB = 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8'

// ============================================================================
// Valid Descriptor Fixtures
// ============================================================================

/**
 * Valid descriptors for different key types
 */
export const VALID_DESCRIPTORS = {
  // Native SegWit (wpkh)
  wpkh: `wpkh([d34db33f/84'/1'/0']${VALID_TPUB}/0/0)#checksum`,

  // Taproot (tr)
  tr: `tr([d34db33f/86'/1'/0']${VALID_TPUB}/0/0)#checksum`,

  // P2PKH (pkh) - legacy
  pkh: `pkh([d34db33f/44'/1'/0']${VALID_TPUB}/0/0)#checksum`,

  // Nested P2WPKH in P2SH (sh-wpkh)
  sh_wpkh: `sh(wpkh([d34db33f/49'/1'/0']${VALID_TPUB}/0/0))#checksum`,

  // Wildcard descriptor (for range derivation)
  wpkh_wildcard: `wpkh([d34db33f/84'/1'/0']${VALID_TPUB}/0/*)#checksum`,

  // Private key descriptor (tprv)
  wpkh_private: `wpkh([d34db33f/84'/1'/0']${VALID_TPRV}/0/0)#checksum`
}

/**
 * Mainnet descriptors
 */
export const MAINNET_DESCRIPTORS = {
  wpkh: `wpkh([12345678/84'/0'/0']${VALID_XPUB}/0/0)#checksum`,
  tr: `tr([12345678/86'/0'/0']${VALID_XPUB}/0/0)#checksum`
}

// ============================================================================
// Invalid Descriptor Fixtures
// ============================================================================

/**
 * Invalid descriptors that should throw errors
 */
export const INVALID_DESCRIPTORS = [
  // Completely invalid format
  'invalid',
  'not_a_descriptor',
  '',

  // Missing checksum
  "wpkh([d34db33f/84'/1'/0']tpubDCxzhZzGfRLdJc6P4FUFKv3u8WKVYgBkdqxU4KMNRkNwPFnLqNTMF9jUjRPWYaWBiN7Jm3g2D6b4mPSQyCLwRk5jgsNXvLz7gZmhD9zBkNA/0/0)",

  // Missing key
  "wpkh()#checksum",

  // Missing closing paren
  "wpkh([d34db33f/84'/1'/0']tpubxxx/0/0#checksum",

  // Invalid path (too short)
  "wpkh([d34db33f/84']tpubxxx/0)#checksum"
]

/**
 * Descriptors with short/invalid paths
 */
export const SHORT_PATH_DESCRIPTORS = [
  // Only purpose (missing network, account, etc.)
  "wpkh([d34db33f/84']tpubxxx)#checksum",

  // Only purpose and network (missing account)
  "wpkh([d34db33f/84'/1']tpubxxx)#checksum",

  // Only 3 path components (need at least 4)
  "wpkh([d34db33f/84'/1'/0']tpubxxx)#checksum"
]

// ============================================================================
// Path Segment Fixtures
// ============================================================================

/**
 * Valid path segments
 */
export const VALID_SEGMENTS = [
  { input: '0',   expected: 0,    hardened: false },
  { input: '1',   expected: 1,    hardened: false },
  { input: '44',  expected: 44,   hardened: false },
  { input: '84',  expected: 84,   hardened: false },
  { input: "0'",  expected: -0,   hardened: true },
  { input: "44'", expected: -44,  hardened: true },
  { input: "84'", expected: -84,  hardened: true },
  { input: '0h',  expected: -0,   hardened: true },
  { input: '44h', expected: -44,  hardened: true },
  { input: '84h', expected: -84,  hardened: true }
]

/**
 * Invalid path segments that should throw
 * Note: Empty string and single char edge cases may pass depending on implementation
 */
export const INVALID_SEGMENTS = [
  'abc',       // Not a number
  '-1',        // Negative (becomes -1 after stripping h/')
  '1.5',       // Float
  'x',         // Invalid char
  '12x',       // Number with invalid suffix
]

// ============================================================================
// Descriptor Item Fixtures
// ============================================================================

/**
 * Create a descriptor item fixture (matches Bitcoin Core listdescriptors output)
 */
export function create_descriptor_item_fixture(
  type: 'wpkh' | 'tr' | 'pkh' = 'wpkh',
  overrides: Partial<{
    desc: string
    timestamp: number
    active: boolean
    internal: boolean
    range: [number, number]
    next: number
  }> = {}
): {
  desc: string
  timestamp: number
  active: boolean
  internal: boolean
  range: [number, number]
  next: number
} {
  const baseDesc = VALID_DESCRIPTORS[type] ?? VALID_DESCRIPTORS.wpkh

  return {
    desc      : overrides.desc ?? baseDesc,
    timestamp : overrides.timestamp ?? Math.floor(Date.now() / 1000),
    active    : overrides.active ?? true,
    internal  : overrides.internal ?? false,
    range     : overrides.range ?? [0, 999],
    next      : overrides.next ?? 0
  }
}

/**
 * Create a set of descriptor items (external + internal)
 */
export function create_descriptor_set_fixture(type: 'wpkh' | 'tr' | 'pkh' = 'wpkh'): {
  external: ReturnType<typeof create_descriptor_item_fixture>
  internal: ReturnType<typeof create_descriptor_item_fixture>
} {
  return {
    external: create_descriptor_item_fixture(type, { internal: false }),
    internal: create_descriptor_item_fixture(type, { internal: true })
  }
}

// ============================================================================
// Parsed Descriptor Expected Results
// ============================================================================

/**
 * Expected parse results for common descriptors
 */
export const EXPECTED_PARSE_RESULTS = {
  wpkh: {
    keytype     : 'wpkh',
    is_extended : true,
    is_private  : false,
    purpose     : -84,  // hardened
    network     : -1,   // testnet hardened
    account     : -0    // hardened
  },
  tr: {
    keytype     : 'tr',
    is_extended : true,
    is_private  : false,
    purpose     : -86,  // hardened
    network     : -1,   // testnet hardened
    account     : -0    // hardened
  },
  pkh: {
    keytype     : 'pkh',
    is_extended : true,
    is_private  : false,
    purpose     : -44,  // hardened
    network     : -1,   // testnet hardened
    account     : -0    // hardened
  },
  wpkh_private: {
    keytype     : 'wpkh',
    is_extended : true,
    is_private  : true,
    purpose     : -84,
    network     : -1,
    account     : -0
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a descriptor with custom path components
 */
export function create_descriptor_fixture(
  type: 'wpkh' | 'tr' | 'pkh' | 'sh-wpkh' = 'wpkh',
  options: {
    fingerprint?: string
    purpose?: number
    network?: number
    account?: number
    change?: number
    index?: number | '*'
    keystr?: string
    checksum?: string
  } = {}
): string {
  const {
    fingerprint = 'd34db33f',
    purpose     = type === 'wpkh' ? 84 : type === 'tr' ? 86 : type === 'pkh' ? 44 : 49,
    network     = 1,
    account     = 0,
    change      = 0,
    index       = 0,
    keystr      = VALID_TPUB,
    checksum    = 'abcd1234'
  } = options

  const path = `/${purpose}'/${network}'/${account}'`
  const derivation = `/${change}/${index}`

  if (type === 'sh-wpkh') {
    return `sh(wpkh([${fingerprint}${path}]${keystr}${derivation}))#${checksum}`
  }

  return `${type}([${fingerprint}${path}]${keystr}${derivation})#${checksum}`
}

/**
 * Create a raw pubkey descriptor (non-extended)
 */
export function create_raw_pubkey_descriptor_fixture(
  type: 'wpkh' | 'tr' | 'pkh' = 'wpkh',
  pubkey: string = `02${'a'.repeat(64)}`,  // compressed pubkey
  checksum: string = 'raw12345'
): string {
  // Raw pubkey descriptors don't have derivation paths
  return `${type}([d34db33f/84'/1'/0'/0/0]${pubkey})#${checksum}`
}
