import { Test }       from 'tape'
import { CoreClient } from '../../src/index.js'
import { TxTemplate } from '@scrow/tapscript'
import { parse_addr } from '@scrow/tapscript/address'

const { DEBUG = false } = process.env

export default function (
  tape   : Test,
  client : CoreClient
) {
  tape.test('Base CI test', async t => {

    t.plan(1)

    try {
      // Print information about the blockchain.
      if (DEBUG) console.log('chain info:', await client.chain_info)

      // Load a wallet for Alice.
      const { alice_wallet, bob_wallet } = await client.load_wallets('alice_wallet', 'bob_wallet')

      // Create a receive address for Alice.
      const address = await alice_wallet.gen_address()

      // Create a tx template that pays to Alice.
      const template : TxTemplate = {
        vout : [
          {
            value        : 100_000,
            scriptPubKey : parse_addr(address).hex
          }
        ]
      }

      if (DEBUG) console.log('template:', template)

      // Load a wallet for Bob and ensure it has funds.
      await bob_wallet.ensure_funds(1_000_000)

      // Fund the tx from Alice using Bob's wallet
      const txdata = await bob_wallet.fund_tx(template)

      if (DEBUG) {
        console.log('txdata:')
        console.dir(txdata, { depth : null })
      }

      // Publish the tx.
      const txid = await client.publish_tx(txdata, true)

      t.pass('Tests completed with txid: ' + txid)
    } catch (err) {
      console.log(err)
      t.fail(err)
    }
  })
}
