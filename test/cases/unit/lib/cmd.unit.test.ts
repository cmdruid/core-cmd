/**
 * Unit tests for CoreClient mock and cmd functionality
 */

import type { TestFunction as TapeTest } from 'tape'
import type { MockTestContext } from '../../../lib/types/test.types.js'
import { create_mock_client } from '../../../lib/mocks/client.mock.js'

/**
 * CoreClient mock unit tests
 */
export default function cmd_unit_tests(
  tape: TapeTest,
  _ctx: MockTestContext
): void {
  tape('Mock client - basic RPC call', async (t) => {
    const client = create_mock_client()

    const count = await client.get_block_count()

    t.ok(typeof count === 'number', 'Returns a number')
    t.equal(count, 150, 'Returns default block count')

    t.end()
  })

  tape('Mock client - call recording', async (t) => {
    const client = create_mock_client()

    await client.get_block_count()
    await client.get_chain_info()

    t.ok(client._was_called('getblockcount'), 'getblockcount was called')

    t.end()
  })

  tape('Mock client - custom response', async (t) => {
    const client = create_mock_client({
      responses: {
        'getblockcount': 999
      }
    })

    const count = await client.get_block_count()
    t.equal(count, 999, 'Returns custom response')

    t.end()
  })

  tape('Mock client - error injection', async (t) => {
    const client = create_mock_client()

    const testError = new Error('Test error')
    client._set_error('getblockcount', testError)

    try {
      await client.get_block_count()
      t.fail('Should have thrown')
    } catch (err) {
      t.equal(err, testError, 'Throws injected error')
    }

    t.end()
  })

  tape('Mock client - clear error', async (t) => {
    const client = create_mock_client()

    client._set_error('getblockcount', new Error('Test'))
    client._clear_error('getblockcount')

    const count = await client.get_block_count()
    t.equal(count, 150, 'Returns default after clearing error')

    t.end()
  })

  tape('Mock client - call count', async (t) => {
    const client = create_mock_client()

    await client.get_block_count()
    await client.get_block_count()
    await client.get_chain_info()

    t.equal(client._get_calls('getblockcount').length, 2, 'getblockcount called twice')
    t.equal(client._get_calls('getblockchaininfo').length, 1, 'getblockchaininfo called once')

    t.end()
  })

  tape('Mock client - cmd with args', async (t) => {
    const client = create_mock_client()

    await client.cmd('getblock', 'blockhash123', 2)

    const calls = client._get_calls('getblock')
    t.equal(calls.length, 1, 'Call was recorded')
    t.deepEqual(calls[0].args, ['blockhash123', 2], 'Args were passed')

    t.end()
  })

  tape('Mock client - network restriction', async (t) => {
    const client = create_mock_client({ network: 'mainnet' })

    try {
      await client.mine_blocks(10, 'address')
      t.fail('Should have thrown')
    } catch (err) {
      t.ok((err as Error).message.includes('regtest'), 'Cannot mine on non-regtest network')
    }

    t.end()
  })

  tape('Mock client - regtest mining', async (t) => {
    const client = create_mock_client({ network: 'regtest' })

    const hashes = await client.mine_blocks(10, 'address')

    t.ok(Array.isArray(hashes), 'Returns array of block hashes')
    t.ok(client._was_called('generatetoaddress'), 'generatetoaddress was called')

    t.end()
  })

  tape('Mock client - reset', async (t) => {
    const client = create_mock_client()

    client._set_response('getblockcount', 999)
    await client.get_block_count()
    client._reset()

    t.equal(client._calls.length, 0, 'Calls cleared')
    const count = await client.get_block_count()
    t.equal(count, 150, 'Response reset to default')
    t.ok(!client._errors.has('getblockcount'), 'Error cleared')

    t.end()
  })

  tape('Mock client - dynamic response', async (t) => {
    const client = create_mock_client()

    let callCount = 0
    client._set_response('getblockcount', () => {
      callCount++
      return 100 + callCount
    })

    const first = await client.get_block_count()
    const second = await client.get_block_count()

    t.equal(first, 101, 'First call returns 101')
    t.equal(second, 102, 'Second call returns 102')

    t.end()
  })

  tape('Mock client - unknown method error', async (t) => {
    const client = create_mock_client()

    try {
      await client.cmd('unknownmethod')
      t.fail('Should have thrown')
    } catch (err) {
      t.ok((err as Error).message.includes('No mock response'), 'Throws on unknown method')
    }

    t.end()
  })

  tape('Mock client - transaction operations', async (t) => {
    const client = create_mock_client()
    const txid = 'a'.repeat(64)

    const tx = await client.get_tx(txid)
    t.ok(tx, 'Returns transaction')
    t.equal(tx.txid, txid, 'Returns transaction with matching txid')

    const status = await client.get_tx_status(txid)
    t.ok(status, 'Returns status')
    t.equal(status.confirmed, true, 'Transaction is confirmed')

    t.end()
  })

  tape('Mock client - response delay', async (t) => {
    // Use a longer delay to avoid timing flakiness
    const client = create_mock_client({ response_delay: 100 })

    const start = Date.now()
    await client.get_block_count()
    const duration = Date.now() - start

    // Allow 10% tolerance for timer resolution
    t.ok(duration >= 90, `Response delayed by ~100ms (actual: ${duration}ms)`)

    t.end()
  })

  tape('Mock client - wallet operations', async (t) => {
    const client = create_mock_client()

    const wallets = await client.get_loaded_wallets()
    t.ok(Array.isArray(wallets), 'Returns wallet list')
    t.ok(wallets.includes('faucet'), 'Contains faucet wallet')

    t.end()
  })
}
