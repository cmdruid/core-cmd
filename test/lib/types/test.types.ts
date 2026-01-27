/**
 * Test type definitions for core-cmd test framework
 */

import type { Test } from 'tape'
import type {
  CoreDaemon,
  CoreClient,
  CoreWallet,
  DaemonState,
  UTXO,
  TxResult
} from '../../../src/index.js'
import type { MockCoreClient } from '../mocks/client.mock.js'
import type { MockCoreWallet } from '../mocks/wallet.mock.js'
import type { MockCoreDaemon } from '../mocks/daemon.mock.js'

// ============================================================================
// Test Context Types
// ============================================================================

/**
 * Mock test context - used for unit tests without Bitcoin Core
 */
export interface MockTestContext {
  mode   : 'mock'
  client : MockCoreClient
  wallet : MockCoreWallet
  daemon : MockCoreDaemon
}

/**
 * Daemon test context - used for integration tests with real Bitcoin Core
 */
export interface DaemonTestContext {
  mode          : 'daemon'
  daemon        : CoreDaemon
  client        : CoreClient
  faucet        : CoreWallet
  create_wallet : (name: string) => Promise<CoreWallet>
  mine_and_wait : (count: number, address?: string) => Promise<string[]>
}

/**
 * Union type for all test contexts
 */
export type TestContext = MockTestContext | DaemonTestContext

// ============================================================================
// Test Function Types
// ============================================================================

/**
 * Test function signature - receives tape module and context
 */
export type TestFunction = (
  tape : typeof import('tape'),
  ctx  : TestContext
) => void | Promise<void>

/**
 * Test function that requires mock context
 */
export type MockTestFunction = (
  tape : typeof import('tape'),
  ctx  : MockTestContext
) => void | Promise<void>

/**
 * Test function that requires daemon context
 */
export type DaemonTestFunction = (
  tape : typeof import('tape'),
  ctx  : DaemonTestContext
) => void | Promise<void>

/**
 * Options for individual tests
 */
export interface TestOptions {
  /** Timeout in milliseconds */
  timeout?  : number
  /** Skip this test */
  skip?     : boolean
  /** Number of retries on failure */
  retries?  : number
  /** Run test only (skip others) */
  only?     : boolean
}

/**
 * Test module export structure
 */
export interface TestModule {
  default   : TestFunction
  /** Optional setup function */
  setup?    : (ctx: TestContext) => Promise<void>
  /** Optional teardown function */
  teardown? : (ctx: TestContext) => Promise<void>
}

// ============================================================================
// Test Result Types
// ============================================================================

/**
 * Individual test result
 */
export interface TestResult {
  name     : string
  passed   : boolean
  duration : number
  error?   : Error
  skipped? : boolean
}

/**
 * Aggregated test results
 */
export interface TestResults {
  total    : number
  passed   : number
  failed   : number
  skipped  : number
  duration : number
  results  : TestResult[]
  errors   : Error[]
}

/**
 * CI test results with additional metadata
 */
export interface CITestResults extends TestResults {
  environment : 'github' | 'gitlab' | 'local'
  suites      : {
    unit?        : TestResults
    integration? : TestResults
    e2e?         : TestResults
  }
}

// ============================================================================
// Fixture Data Types
// ============================================================================

// Note: TxFixtureData, WalletFixtureData, BlockFixtureData are defined in fixture.types.ts

// ============================================================================
// Runner Configuration Types
// ============================================================================

/**
 * Base runner configuration
 */
export interface BaseRunnerConfig {
  /** Timeout in milliseconds */
  timeout_ms?      : number
  /** Stop on first failure */
  bail_on_failure? : boolean
  /** Glob pattern for test files */
  glob_pattern?    : string
  /** Reporter type */
  reporter?        : 'tap' | 'junit' | 'json'
}

/**
 * Unit test runner configuration
 */
export interface UnitRunnerConfig extends BaseRunnerConfig {
  timeout_ms?   : number  // default: 5_000
  glob_pattern? : string  // default: 'test/unit/**/*.test.ts'
}

/**
 * Integration test runner configuration
 */
export interface IntegrationRunnerConfig extends BaseRunnerConfig {
  timeout_ms?          : number   // default: 60_000
  glob_pattern?        : string   // default: 'test/integration/**/*.test.ts'
  /** Reuse daemon between tests */
  reuse_daemon?        : boolean  // default: true
  /** Cleanup on failure */
  cleanup_on_failure?  : boolean  // default: true
  /** Core daemon configuration overrides */
  core_config?         : Record<string, unknown>
}

/**
 * E2E test runner configuration
 */
export interface E2ERunnerConfig extends BaseRunnerConfig {
  timeout_ms?   : number  // default: 120_000
  glob_pattern? : string  // default: 'test/e2e/**/*.test.ts'
}

/**
 * CI test runner configuration
 */
export interface CIRunnerConfig extends BaseRunnerConfig {
  /** Which suites to run */
  suites?            : ('unit' | 'integration' | 'e2e')[]
  /** Global timeout */
  global_timeout_ms? : number   // default: 300_000 (5 min)
  /** Fail fast mode */
  fail_fast?         : boolean  // default: true
  /** Retry failed tests */
  retry_failed?      : number   // default: 1
}

// ============================================================================
// E2E Scenario Types
// ============================================================================

/**
 * E2E test scenario definition
 */
export interface E2EScenario {
  name        : string
  description?: string
  setup       : (ctx: DaemonTestContext) => Promise<void>
  execute     : (ctx: DaemonTestContext) => Promise<void>
  teardown    : (ctx: DaemonTestContext) => Promise<void>
  timeout_ms? : number
}

/**
 * E2E context with additional scenario-specific data
 */
export interface E2EContext extends DaemonTestContext {
  scenario    : E2EScenario
  data        : Record<string, unknown>
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if context is a daemon context
 */
export function is_daemon_context(ctx: TestContext): ctx is DaemonTestContext {
  return ctx.mode === 'daemon'
}

/**
 * Check if context is a mock context
 */
export function is_mock_context(ctx: TestContext): ctx is MockTestContext {
  return ctx.mode === 'mock'
}
