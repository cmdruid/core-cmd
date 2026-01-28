/**
 * Input validation module for security-critical operations
 *
 * This module provides validators for:
 * - Process names (command injection prevention)
 * - Bitcoin addresses (by network and type)
 * - Public keys (length and prefix validation)
 * - Amounts (satoshi bounds, overflow prevention)
 * - Paths (traversal prevention)
 * - Credentials (sanitization for logging)
 */

import { SATS_PER_BTC } from '@/const.js'

/**
 * Maximum satoshi value (21 million BTC)
 * 21_000_000 * 100_000_000 = 2.1e15, well within safe integer range
 */
export const MAX_SATS = 21_000_000 * SATS_PER_BTC

/**
 * Minimum satoshi value (must be positive)
 */
export const MIN_SATS = 0

/**
 * Allowlist of valid process names for check_process()
 * Only Bitcoin Core related processes are allowed
 */
export const ALLOWED_PROCESS_NAMES = [
  'bitcoind',
  'bitcoin-qt',
  'bitcoin-cli'
] as const

export type AllowedProcessName = typeof ALLOWED_PROCESS_NAMES[number]

/**
 * Validate a process name against the allowlist
 * Prevents command injection in check_process()
 *
 * @throws Error if process name is not in allowlist
 */
export function validate_process_name(name: string): AllowedProcessName {
  // Check against allowlist (case-sensitive)
  if (!ALLOWED_PROCESS_NAMES.includes(name as AllowedProcessName)) {
    throw new Error(
      `Invalid process name: "${name}". ` +
      `Allowed values: ${ALLOWED_PROCESS_NAMES.join(', ')}`
    )
  }
  return name as AllowedProcessName
}

/**
 * Bitcoin address patterns by network
 *
 * Mainnet:
 * - P2PKH: starts with 1, 25-34 chars
 * - P2SH: starts with 3, 34 chars
 * - Bech32 (P2WPKH/P2WSH): starts with bc1q, 42-62 chars
 * - Bech32m (P2TR): starts with bc1p, 62 chars
 *
 * Testnet/Signet:
 * - P2PKH: starts with m or n, 25-34 chars
 * - P2SH: starts with 2, 34 chars
 * - Bech32: starts with tb1q, 42-62 chars
 * - Bech32m: starts with tb1p, 62 chars
 *
 * Regtest:
 * - P2PKH: starts with m or n, 25-34 chars
 * - P2SH: starts with 2, 34 chars
 * - Bech32: starts with bcrt1q, 43-63 chars
 * - Bech32m: starts with bcrt1p, 62-63 chars
 */
const ADDRESS_PATTERNS: Record<string, RegExp> = {
  // Mainnet
  main_p2pkh: /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/,
  main_p2sh: /^3[a-km-zA-HJ-NP-Z1-9]{33}$/,
  main_bech32: /^bc1q[ac-hj-np-z02-9]{38,58}$/,
  main_bech32m: /^bc1p[ac-hj-np-z02-9]{58}$/,

  // Testnet/Signet
  test_p2pkh: /^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
  test_p2sh: /^2[a-km-zA-HJ-NP-Z1-9]{33,34}$/,
  test_bech32: /^tb1q[ac-hj-np-z02-9]{38,58}$/,
  test_bech32m: /^tb1p[ac-hj-np-z02-9]{58}$/,

  // Regtest
  regtest_p2pkh: /^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
  regtest_p2sh: /^2[a-km-zA-HJ-NP-Z1-9]{33,34}$/,
  regtest_bech32: /^bcrt1q[ac-hj-np-z02-9]{38,58}$/,
  regtest_bech32m: /^bcrt1p[ac-hj-np-z02-9]{58,59}$/
}

/**
 * Validate a Bitcoin address format
 *
 * @param address - The address string to validate
 * @param network - Network name ('main', 'test', 'signet', 'regtest')
 * @returns true if address format is valid for the network
 *
 * Note: This only validates the format/prefix, not the checksum.
 * Bitcoin Core will validate the full address on use.
 */
export function validate_address(
  address: string,
  network: string = 'regtest'
): boolean {
  if (typeof address !== 'string' || address.length === 0) {
    return false
  }

  // Normalize network name
  const net = network === 'signet' ? 'test' : network

  // Try all patterns for this network
  const patterns = [
    ADDRESS_PATTERNS[`${net}_p2pkh`],
    ADDRESS_PATTERNS[`${net}_p2sh`],
    ADDRESS_PATTERNS[`${net}_bech32`],
    ADDRESS_PATTERNS[`${net}_bech32m`]
  ].filter(Boolean)

  return patterns.some(p => p.test(address))
}

/**
 * Assert that an address is valid, throwing if not
 *
 * @throws Error if address is invalid
 */
export function assert_valid_address(
  address: string,
  network: string = 'regtest'
): void {
  if (!validate_address(address, network)) {
    throw new Error(
      `Invalid Bitcoin address for network "${network}": "${address}"`
    )
  }
}

/**
 * Validate a public key (hex string)
 *
 * @param pubkey - Hex-encoded public key
 * @returns Object with validation result and key type
 *
 * Valid formats:
 * - Compressed: 33 bytes (66 hex chars), prefix 02 or 03
 * - X-only (taproot): 32 bytes (64 hex chars), no prefix
 * - Uncompressed: 65 bytes (130 hex chars), prefix 04 (legacy, not recommended)
 */
export function validate_pubkey(pubkey: string): {
  valid: boolean
  type?: 'compressed' | 'x-only' | 'uncompressed'
  error?: string
} {
  if (typeof pubkey !== 'string') {
    return { valid: false, error: 'Public key must be a string' }
  }

  // Check hex format
  if (!/^[0-9a-fA-F]+$/.test(pubkey)) {
    return { valid: false, error: 'Public key must be hex-encoded' }
  }

  const len = pubkey.length

  // X-only (taproot): 32 bytes = 64 hex chars
  if (len === 64) {
    return { valid: true, type: 'x-only' }
  }

  // Compressed: 33 bytes = 66 hex chars, prefix 02 or 03
  if (len === 66) {
    const prefix = pubkey.slice(0, 2)
    if (prefix === '02' || prefix === '03') {
      return { valid: true, type: 'compressed' }
    }
    return { valid: false, error: 'Compressed pubkey must have prefix 02 or 03' }
  }

  // Uncompressed: 65 bytes = 130 hex chars, prefix 04
  if (len === 130) {
    if (pubkey.startsWith('04')) {
      return { valid: true, type: 'uncompressed' }
    }
    return { valid: false, error: 'Uncompressed pubkey must have prefix 04' }
  }

  return {
    valid: false,
    error: `Invalid pubkey length: ${len} hex chars (expected 64, 66, or 130)`
  }
}

/**
 * Assert that a public key is valid
 *
 * @throws Error if pubkey is invalid
 */
export function assert_valid_pubkey(pubkey: string): void {
  const result = validate_pubkey(pubkey)
  if (!result.valid) {
    throw new Error(`Invalid public key: ${result.error}`)
  }
}

/**
 * Validate a satoshi amount
 *
 * @param amount - Amount in satoshis
 * @returns Object with validation result
 *
 * Checks:
 * - Must be a finite number
 * - Must be a safe integer
 * - Must be non-negative
 * - Must not exceed max supply (21M BTC)
 */
export function validate_amount(amount: number): {
  valid: boolean
  error?: string
} {
  if (typeof amount !== 'number') {
    return { valid: false, error: 'Amount must be a number' }
  }

  if (!Number.isFinite(amount)) {
    return { valid: false, error: 'Amount must be finite' }
  }

  if (!Number.isSafeInteger(amount)) {
    return {
      valid: false,
      error: 'Amount must be a safe integer (no decimals for satoshis)'
    }
  }

  if (amount < MIN_SATS) {
    return { valid: false, error: 'Amount cannot be negative' }
  }

  if (amount > MAX_SATS) {
    return {
      valid: false,
      error: `Amount exceeds maximum supply (${MAX_SATS} sats)`
    }
  }

  return { valid: true }
}

/**
 * Assert that an amount is valid
 *
 * @throws Error if amount is invalid
 */
export function assert_valid_amount(amount: number): void {
  const result = validate_amount(amount)
  if (!result.valid) {
    throw new Error(`Invalid amount: ${result.error}`)
  }
}

/**
 * Characters that are dangerous in shell commands or paths
 */
const DANGEROUS_CHARS = /[;&|`$(){}[\]<>!\\'"*?\n\r\t]/

/**
 * Path traversal patterns
 */
const PATH_TRAVERSAL = /(?:^|[\\/])\.\.(?:[\\/]|$)/

/**
 * Validate a file path for security
 *
 * @param path - Path string to validate
 * @param options - Validation options
 * @returns Object with validation result
 *
 * Checks:
 * - No path traversal (../)
 * - No shell metacharacters
 * - Optional: must be within allowed base directories
 */
export function validate_path(
  path: string,
  options: {
    allowTraversal?: boolean
    allowedBases?: string[]
  } = {}
): {
  valid: boolean
  error?: string
} {
  if (typeof path !== 'string' || path.length === 0) {
    return { valid: false, error: 'Path must be a non-empty string' }
  }

  // Check for path traversal
  if (!options.allowTraversal && PATH_TRAVERSAL.test(path)) {
    return { valid: false, error: 'Path traversal (..) not allowed' }
  }

  // Check for dangerous characters
  if (DANGEROUS_CHARS.test(path)) {
    return { valid: false, error: 'Path contains invalid characters' }
  }

  // Check against allowed base directories if specified
  if (options.allowedBases && options.allowedBases.length > 0) {
    const normalized = path.replace(/\\/g, '/')
    const isAllowed = options.allowedBases.some(base => {
      const normalizedBase = base.replace(/\\/g, '/')
      return normalized.startsWith(normalizedBase)
    })
    if (!isAllowed) {
      return {
        valid: false,
        error: `Path must be within allowed directories: ${options.allowedBases.join(', ')}`
      }
    }
  }

  return { valid: true }
}

/**
 * Assert that a path is valid
 *
 * @throws Error if path is invalid
 */
export function assert_valid_path(
  path: string,
  options?: { allowTraversal?: boolean; allowedBases?: string[] }
): void {
  const result = validate_path(path, options)
  if (!result.valid) {
    throw new Error(`Invalid path: ${result.error}`)
  }
}

/**
 * Patterns for sensitive data that should be sanitized in logs
 */
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // RPC credentials in CLI args
  { pattern: /-rpcpassword=[^\s]+/g, replacement: '-rpcpassword=***' },
  { pattern: /-rpcuser=[^\s]+/g, replacement: '-rpcuser=***' },

  // Extended private keys (xprv, tprv)
  { pattern: /[xt]prv[1-9A-HJ-NP-Za-km-z]{107,108}/g, replacement: '[REDACTED_XPRV]' },

  // WIF private keys (starts with 5, K, L for mainnet; c for testnet)
  { pattern: /\b[5KLc][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, replacement: '[REDACTED_WIF]' },

  // 64-char hex strings that might be private keys
  // Only redact if in a sensitive context (after 'seckey', 'privatekey', etc.)
  { pattern: /(seckey|privatekey|private_key|secret)['":\s]+[0-9a-fA-F]{64}/gi, replacement: '$1: [REDACTED_KEY]' },

  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+/gi, replacement: 'Bearer [REDACTED]' },

  // Cookie values
  { pattern: /(__cookie__:)[^\s]+/g, replacement: '$1***' }
]

/**
 * Sanitize a string for safe logging
 *
 * Removes/masks:
 * - RPC credentials
 * - Private keys (xprv, WIF)
 * - Potential secret hex values
 * - Bearer tokens
 *
 * @param input - String to sanitize
 * @returns Sanitized string safe for logging
 */
export function sanitize_for_log(input: string): string {
  if (typeof input !== 'string') {
    return String(input)
  }

  let result = input
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

/**
 * Sanitize an array of strings (e.g., CLI params) for logging
 */
export function sanitize_params_for_log(params: string[]): string[] {
  return params.map(sanitize_for_log)
}

/**
 * Validate a block count for mine_blocks()
 *
 * @param count - Number of blocks to mine
 * @returns Object with validation result
 */
export function validate_block_count(count: number): {
  valid: boolean
  error?: string
} {
  if (typeof count !== 'number') {
    return { valid: false, error: 'Block count must be a number' }
  }

  if (!Number.isInteger(count)) {
    return { valid: false, error: 'Block count must be an integer' }
  }

  if (count < 1) {
    return { valid: false, error: 'Block count must be at least 1' }
  }

  if (count > 10000) {
    return { valid: false, error: 'Block count cannot exceed 10000' }
  }

  return { valid: true }
}

/**
 * Assert that a block count is valid
 *
 * @throws Error if block count is invalid
 */
export function assert_valid_block_count(count: number): void {
  const result = validate_block_count(count)
  if (!result.valid) {
    throw new Error(`Invalid block count: ${result.error}`)
  }
}

/**
 * Validate descriptor input to prevent injection
 *
 * Descriptors should only contain:
 * - Alphanumeric characters
 * - Brackets () [] {}
 * - Commas, colons, slashes, asterisks
 * - Hash symbol for checksum
 *
 * They should NOT contain:
 * - Semicolons, pipes, backticks (shell injection)
 * - Nested parentheses in unexpected places
 */
export function validate_descriptor_input(input: string): {
  valid: boolean
  error?: string
} {
  if (typeof input !== 'string' || input.length === 0) {
    return { valid: false, error: 'Descriptor input must be a non-empty string' }
  }

  // Check for shell injection characters
  if (/[;&|`$]/.test(input)) {
    return { valid: false, error: 'Descriptor contains invalid characters' }
  }

  // Check for balanced parentheses
  let depth = 0
  for (const char of input) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (depth < 0) {
      return { valid: false, error: 'Unbalanced parentheses in descriptor' }
    }
  }
  if (depth !== 0) {
    return { valid: false, error: 'Unbalanced parentheses in descriptor' }
  }

  return { valid: true }
}

/**
 * Assert that descriptor input is valid
 *
 * @throws Error if input is invalid
 */
export function assert_valid_descriptor_input(input: string): void {
  const result = validate_descriptor_input(input)
  if (!result.valid) {
    throw new Error(`Invalid descriptor input: ${result.error}`)
  }
}
