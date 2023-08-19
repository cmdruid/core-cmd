import { Test }          from 'tape'
import { get_test_core } from './util.js'

export default function (t : Test) {
  t.test('Base CI test', async t => {

    const core = get_test_core()
    
    t.plan(1)

    t.teardown(() => { core.shutdown() })

    try {
      const client = await core.startup()
      // Load a wallet for Alice and generate an address.
      const alice_wallet = await client.get_wallet('alice_wallet')
      const alice_recv   = await alice_wallet.newaddress

      console.log('receive address:', alice_recv.address)

      // Create a tx template that pays to Alice.
      const template = {
        vout : [{
          value : 800_000,
          scriptPubKey : alice_recv.scriptPubKey
        }]
      }

      console.log('template:', template)

      // Load a wallet for Bob and ensure it has funds.
      const bob_wallet = await client.get_wallet('bob_wallet')
      await bob_wallet.ensure_funds(1_000_000)

      // Fund the tx from Alice using Bob's wallet
      const txdata = await bob_wallet.fund_tx(template)

      console.log('txdata:', txdata)

      // Publish the tx.
      const txid = await client.publish_tx(txdata)
      // Mine a few blocks to confirm the tx.
      await client.mine_blocks(1)

      t.pass('Tests completed with txid: ' + txid)
    } catch (err) {
      t.fail(err)
    }
  })
}
