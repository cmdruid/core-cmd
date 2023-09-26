import { Test }          from 'tape'
import { create_daemon } from './util.js'

const { DEBUG = false } = process.env

export default function (t : Test) {
  t.test('Base CI test', async t => {

    const core = create_daemon()
    
    t.plan(1)

    t.teardown(() => { core.shutdown() })

    try {
      const client = await core.startup()

      // Print information about the blockchain.
      if (DEBUG) console.log('chain info:', await client.chain_info)

      // Load a wallet for Alice.
      const alice_wallet = await client.get_wallet('alice_wallet')

      // Create a tx template that pays to Alice.
      const template = {
        vout : [
          await alice_wallet.create_vout(400_000),
          await alice_wallet.create_vout(400_000)
        ]
      }

      if (DEBUG) console.log('template:', template)

      // Load a wallet for Bob and ensure it has funds.
      const bob_wallet = await client.get_wallet('bob_wallet')
      await bob_wallet.ensure_funds(1_000_000)

      // Fund the tx from Alice using Bob's wallet
      const txdata = await bob_wallet.fund_tx(template)

      if (DEBUG) {
        console.log('txdata:')
        console.dir(txdata, { depth : null })
      }

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
