import { Test }       from 'tape'
import { CoreClient } from '../../src'

export default function (
  tape   : Test,
  client : CoreClient
) {
  tape.test('Send funds test', async t => {
    
    t.plan(1)

    try {
      // Load a wallet for Alice.
      const alice_wallet = await client.get_wallet('alice_wallet')
      const alice_addr   = await alice_wallet.newaddress

      // Load a wallet for Bob and ensure it has funds.
      const bob_wallet = await client.get_wallet('bob_wallet')
      await bob_wallet.ensure_funds(60_000)

      // Fund the tx from Alice using Bob's wallet
      const txid = await bob_wallet.send_funds(alice_addr, 50_000)

      await client.mine_blocks(1)

      t.pass('Test completed with txid: ' + txid)
    } catch (err) {
      t.fail(err)
    }
  })
}
