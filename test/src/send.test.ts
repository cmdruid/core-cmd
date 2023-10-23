import { Test }       from 'tape'
import { CoreClient } from '../../src/index.js'

export default function (
  tape   : Test,
  client : CoreClient
) {
  tape.test('Send funds test', async t => {
    
    t.plan(1)

    try {
      // Load a wallet for Alice.
      const { alice_wallet, bob_wallet } = await client.load_wallets('alice_wallet', 'bob_wallet')

      const alice_addr = await alice_wallet.new_address

      // Load a wallet for Bob and ensure it has funds.
      await bob_wallet.ensure_funds(60_000)

      // Fund the tx from Alice using Bob's wallet
      const txid = await bob_wallet.send_funds(50_000, alice_addr, true)

      t.pass('Test completed with txid: ' + txid)
    } catch (err) {
      t.fail(err)
    }
  })
}
