/**
 * Test constants for core-cmd test framework
 */

import type { RetryOptions, PollOptions } from './async/index.js'

// ============================================================================
// Timeout Constants
// ============================================================================

/** Default timeout for unit tests (5 seconds) */
export const DEFAULT_UNIT_TIMEOUT_MS = 5_000

/** Default timeout for integration tests (60 seconds) */
export const DEFAULT_INTEGRATION_TIMEOUT_MS = 60_000

/** Default timeout for E2E tests (2 minutes) */
export const DEFAULT_E2E_TIMEOUT_MS = 120_000

/** Default timeout for CI tests (5 minutes) */
export const DEFAULT_CI_TIMEOUT_MS = 300_000

/** Default timeout for daemon startup */
export const DEFAULT_DAEMON_STARTUP_TIMEOUT_MS = 30_000

/** Default timeout for daemon shutdown */
export const DEFAULT_DAEMON_SHUTDOWN_TIMEOUT_MS = 10_000

/** Default timeout for RPC commands */
export const DEFAULT_RPC_TIMEOUT_MS = 5_000

/** Default timeout for block confirmation */
export const DEFAULT_CONFIRMATION_TIMEOUT_MS = 30_000

// ============================================================================
// Retry Configuration
// ============================================================================

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: RetryOptions = {
  max_attempts   : 3,
  initial_delay  : 100,
  max_delay      : 5_000,
  backoff_factor : 2,
  jitter_factor  : 0.1
}

/** Aggressive retry configuration for flaky operations */
export const AGGRESSIVE_RETRY_CONFIG: RetryOptions = {
  max_attempts   : 5,
  initial_delay  : 50,
  max_delay      : 10_000,
  backoff_factor : 2,
  jitter_factor  : 0.2
}

/** Minimal retry configuration for quick failures */
export const MINIMAL_RETRY_CONFIG: RetryOptions = {
  max_attempts   : 2,
  initial_delay  : 50,
  max_delay      : 1_000,
  backoff_factor : 2,
  jitter_factor  : 0
}

// ============================================================================
// Poll Configuration
// ============================================================================

/** Default poll configuration */
export const DEFAULT_POLL_CONFIG: PollOptions<unknown> = {
  interval_ms : 1_000,
  timeout_ms  : 30_000
}

/** Fast poll configuration for quick checks */
export const FAST_POLL_CONFIG: PollOptions<unknown> = {
  interval_ms : 100,
  timeout_ms  : 5_000
}

/** Slow poll configuration for long operations */
export const SLOW_POLL_CONFIG: PollOptions<unknown> = {
  interval_ms : 5_000,
  timeout_ms  : 120_000
}

// ============================================================================
// Test Data Constants
// ============================================================================

/** Standard test block count for regtest */
export const TEST_BLOCK_COUNT = 150

/** Minimum faucet balance in satoshis (10 BTC) */
export const MIN_FAUCET_BALANCE = 1_000_000_000

/** Default faucet balance in satoshis (1000 BTC) */
export const DEFAULT_FAUCET_BALANCE = 100_000_000_000

/** Satoshis per BTC */
export const SATS_PER_BTC = 100_000_000

/** Dust limit in satoshis */
export const DUST_LIMIT = 1_000

/** Minimum transaction fee in satoshis */
export const MIN_TX_FEE = 1_000

/** Default test amount in satoshis (0.01 BTC) */
export const DEFAULT_TEST_AMOUNT = 1_000_000

/** Small test amount in satoshis (0.001 BTC) */
export const SMALL_TEST_AMOUNT = 100_000

/** Large test amount in satoshis (1 BTC) */
export const LARGE_TEST_AMOUNT = 100_000_000

// ============================================================================
// Glob Patterns
// ============================================================================

/** Glob pattern for unit tests */
export const UNIT_TEST_PATTERN = 'test/cases/unit/**/*.test.ts'

/** Glob pattern for integration tests */
export const INTEGRATION_TEST_PATTERN = 'test/cases/integration/**/*.test.ts'

/** Glob pattern for E2E tests */
export const E2E_TEST_PATTERN = 'test/cases/e2e/**/*.test.ts'

/** Glob pattern for all tests */
export const ALL_TEST_PATTERN = 'test/**/*.test.ts'

// ============================================================================
// Test Wallet Names
// ============================================================================

/** Default faucet wallet name */
export const FAUCET_WALLET_NAME = 'faucet'

/** Test wallet name prefix */
export const TEST_WALLET_PREFIX = 'test_wallet_'

/** Generate a unique test wallet name */
export function generate_wallet_name(suffix?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return suffix
    ? `${TEST_WALLET_PREFIX}${suffix}_${timestamp}_${random}`
    : `${TEST_WALLET_PREFIX}${timestamp}_${random}`
}

// ============================================================================
// Mock Data Constants
// ============================================================================

/** Sample regtest address (P2WPKH) */
export const SAMPLE_REGTEST_ADDRESS = 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080'

/** Sample testnet address */
export const SAMPLE_TESTNET_ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'

/** Sample mainnet address */
export const SAMPLE_MAINNET_ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'

/** Sample transaction ID (64 hex chars) */
export const SAMPLE_TXID = 'a'.repeat(64)

/** Sample block hash (64 hex chars) */
export const SAMPLE_BLOCKHASH = 'b'.repeat(64)

/** Sample public key (66 hex chars compressed) */
export const SAMPLE_PUBKEY = '02' + 'c'.repeat(64)

/** Sample private key (64 hex chars) */
export const SAMPLE_PRIVKEY = 'd'.repeat(64)

// ============================================================================
// CI Environment Detection
// ============================================================================

/** Check if running in CI environment */
export function is_ci_environment(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL ||
    process.env.CIRCLECI
  )
}

/** Detect CI environment type */
export function detect_ci_environment(): 'github' | 'gitlab' | 'jenkins' | 'circle' | 'local' {
  if (process.env.GITHUB_ACTIONS) return 'github'
  if (process.env.GITLAB_CI) return 'gitlab'
  if (process.env.JENKINS_URL) return 'jenkins'
  if (process.env.CIRCLECI) return 'circle'
  return 'local'
}

// ============================================================================
// Default Test Configuration
// ============================================================================

/** Default test configuration */
export const DEFAULT_TEST_CONFIG = {
  corepath : 'test/bin/bitcoind',
  clipath  : 'test/bin/bitcoin-cli',
  confpath : 'test/bitcoin.conf',
  datapath : 'test/data',
  debug    : true,
  isolated : true,
  verbose  : true,
  network  : 'regtest' as const
}

/** CI-optimized test configuration */
export const CI_TEST_CONFIG = {
  ...DEFAULT_TEST_CONFIG,
  debug   : false,
  verbose : false,
  timeout : 60_000
}
