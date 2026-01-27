/**
 * Integration tests for CoreDaemon lifecycle
 */

import type { DaemonTestContext } from '../../../lib/types/test.types.js'
import { DaemonState } from '../../../../src/index.js'

/**
 * Daemon lifecycle integration tests
 */
export default async function lifecycle_int_tests(
  tape : typeof import('tape'),
  ctx  : DaemonTestContext
): Promise<void> {
  const { daemon, client } = ctx

  tape('Daemon is ready', (t) => {
    t.ok(daemon.isReady, 'Daemon is ready')
    t.equal(daemon.daemonState, DaemonState.Ready, 'State is Ready')
    t.end()
  })

  tape('Client is functional', async (t) => {
    const count = await client.get_block_count()
    t.ok(typeof count === 'number', 'Block count is a number')
    t.ok(count >= 0, 'Block count is non-negative')
    t.end()
  })

  tape('Faucet wallet is loaded', async (t) => {
    const { faucet } = ctx
    t.ok(faucet, 'Faucet exists')
    t.equal(faucet.label, 'faucet', 'Faucet label is correct')

    const balance = await faucet.get_balance()
    t.ok(balance >= 0, 'Faucet has balance')
    t.end()
  })

  tape('Can create new wallets', async (t) => {
    const walletName = `test_wallet_${Date.now()}`
    const wallet = await ctx.create_wallet(walletName)
    t.ok(wallet, 'Wallet created')
    t.equal(wallet.label, walletName, 'Wallet label is correct')
    t.end()
  })

  tape('Can mine blocks', async (t) => {
    const initialCount = await client.get_block_count()
    const hashes = await ctx.mine_and_wait(5)

    t.equal(hashes.length, 5, 'Mined 5 blocks')

    const newCount = await client.get_block_count()
    t.equal(newCount, initialCount + 5, 'Block count increased by 5')
    t.end()
  })

  tape('Chain info is accessible', async (t) => {
    const info = await client.get_chain_info()

    t.ok(info, 'Chain info returned')
    t.equal(info.chain, 'regtest', 'Chain is regtest')
    t.ok(info.blocks >= 0, 'Has blocks')
    t.end()
  })

  tape('Can get block data', async (t) => {
    const block = await client.get_block({ height: 1 })

    t.ok(block, 'Block returned')
    t.ok(block.hash, 'Block has hash')
    t.equal(block.height, 1, 'Block height is 1')
    t.ok(Array.isArray(block.tx), 'Block has transactions array')
    t.end()
  })

  tape('Can get header data', async (t) => {
    const header = await client.get_header({ height: 1 })

    t.ok(header, 'Header returned')
    t.ok(header.hash, 'Header has hash')
    t.equal(header.height, 1, 'Header height is 1')
    t.end()
  })

  tape('Network is regtest', (t) => {
    t.equal(client.network, 'regtest', 'Network is regtest')
    t.equal(daemon.opt.network, 'regtest', 'Daemon network is regtest')
    t.end()
  })

  tape('Time manipulation works on regtest', async (t) => {
    const mockTime = Math.floor(Date.now() / 1000) + 3600 // 1 hour in future

    await client.set_time(mockTime)
    // Mining should use the mock time
    await ctx.mine_and_wait(1)

    const block = await client.get_block({})
    t.ok(block.time >= mockTime - 10, 'Block time reflects mock time')
    t.end()
  })
}
