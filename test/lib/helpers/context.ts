/**
 * Test context creation helpers
 */

import type { CoreDaemon, CoreClient, CoreWallet } from '../../../src/index.js'
import type {
  MockTestContext,
  DaemonTestContext,
  TestContext
} from '../types/test.types.js'
import {
  create_mock_client,
  create_mock_wallet,
  MockDaemonFactory,
  MockCoreDaemon,
  MockCoreClient,
  MockCoreWallet
} from '../mocks/index.js'

// ============================================================================
// Mock Context Creation
// ============================================================================

/**
 * Create a mock test context for unit testing
 *
 * @example
 * ```typescript
 * const ctx = create_mock_context()
 * const count = await ctx.client.get_block_count()
 * ```
 */
export function create_mock_context(): MockTestContext {
  const client = create_mock_client()
  const wallet = create_mock_wallet({ label: 'test_wallet', balance: 100_000_000 })
  const daemon = new MockCoreDaemon()

  // Wire up references
  wallet._set_client(client)
  daemon._set_ready()

  return {
    mode   : 'mock',
    client,
    wallet,
    daemon
  }
}

/**
 * Create a mock context with custom configuration
 */
export async function create_configured_mock_context(config: {
  balance?   : number
  utxos?     : Array<{ sats: number }>
  responses? : Record<string, unknown>
  walletName?: string
}): Promise<MockTestContext> {
  const client = create_mock_client({ responses: config.responses })
  const wallet = create_mock_wallet({
    label   : config.walletName ?? 'test_wallet',
    balance : config.balance ?? 0,
    utxos   : config.utxos?.map((u, i) => ({
      txid : i.toString(16).padStart(64, '0'),
      vout : 0,
      sats : u.sats
    }))
  })
  const daemon = await MockDaemonFactory.ready()

  wallet._set_client(client)

  return {
    mode   : 'mock',
    client,
    wallet,
    daemon
  }
}

// ============================================================================
// Daemon Context Creation
// ============================================================================

/**
 * Create a daemon test context from a real CoreDaemon
 *
 * @example
 * ```typescript
 * const daemon = await CoreDaemon.spawn(config)
 * const ctx = create_daemon_context(daemon)
 *
 * const wallet = await ctx.create_wallet('alice')
 * await ctx.mine_and_wait(10)
 * ```
 */
export function create_daemon_context(daemon: CoreDaemon): DaemonTestContext {
  const client = daemon.client
  const faucet = daemon.faucet

  return {
    mode   : 'daemon',
    daemon,
    client,
    faucet,

    /**
     * Create a new wallet
     */
    async create_wallet(name: string): Promise<CoreWallet> {
      return client.load_wallet(name)
    },

    /**
     * Mine blocks and wait for completion
     */
    async mine_and_wait(count: number, address?: string): Promise<string[]> {
      const addr = address ?? await faucet.get_address('mining')
      return client.mine_blocks(count, addr)
    }
  }
}

/**
 * Create a daemon context with additional helpers
 */
export function create_extended_daemon_context(daemon: CoreDaemon): DaemonTestContext & {
  fund_wallet: (wallet: CoreWallet, amount: number) => Promise<void>
  wait_for_confirmation: (txid: string, confirmations?: number) => Promise<void>
} {
  const base = create_daemon_context(daemon)

  return {
    ...base,

    /**
     * Fund a wallet from the faucet
     */
    async fund_wallet(wallet: CoreWallet, amount: number): Promise<void> {
      const address = await wallet.generate_address()
      await base.faucet.send_funds(amount, address, true)
    },

    /**
     * Wait for a transaction to be confirmed
     */
    async wait_for_confirmation(_txid: string, confirmations: number = 1): Promise<void> {
      if (confirmations > 0) {
        await base.client.mine_blocks(confirmations)
      }
      // Simple polling could be added here
    }
  }
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

// ============================================================================
// Context Utilities
// ============================================================================

/**
 * Get client from any context type
 */
export function get_client(ctx: TestContext): CoreClient | MockCoreClient {
  return ctx.client
}

/**
 * Get wallet from any context type
 */
export function get_wallet(ctx: TestContext): CoreWallet | MockCoreWallet {
  return is_daemon_context(ctx) ? ctx.faucet : ctx.wallet
}

/**
 * Get daemon from any context type
 */
export function get_daemon(ctx: TestContext): CoreDaemon | MockCoreDaemon {
  return ctx.daemon
}

/**
 * Run a function with a mock context
 */
export async function with_mock_context<T>(
  fn: (ctx: MockTestContext) => Promise<T>
): Promise<T> {
  const ctx = create_mock_context()
  return fn(ctx)
}

/**
 * Run a function with a daemon context
 */
export async function with_daemon_context<T>(
  daemon: CoreDaemon,
  fn: (ctx: DaemonTestContext) => Promise<T>
): Promise<T> {
  const ctx = create_daemon_context(daemon)
  return fn(ctx)
}

// ============================================================================
// Context Cleanup
// ============================================================================

/**
 * Cleanup a test context
 */
export async function cleanup_context(ctx: TestContext): Promise<void> {
  if (is_daemon_context(ctx)) {
    // Don't shutdown daemon here - let the test runner handle it
    return
  }

  if (is_mock_context(ctx)) {
    ctx.client._reset()
    ctx.wallet._reset()
    ctx.daemon._reset()
  }
}

/**
 * Create a context that auto-cleans up
 */
export function create_auto_cleanup_context(): {
  ctx: MockTestContext
  cleanup: () => Promise<void>
} {
  const ctx = create_mock_context()
  return {
    ctx,
    cleanup: () => cleanup_context(ctx)
  }
}
