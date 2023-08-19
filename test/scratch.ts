import { Address } from '@scrow/tapscript'

import {
  CoreClient,
  CoreDaemon
} from '../src/index.js'

const core = new CoreDaemon({ datapath: '/home/cscott/.bitcoin' })

await core.run(async (client : CoreClient) => {
  // Load a wallet for Alice and generate an address.
  const alice_wallet = await client.get_wallet('alice_wallet')
  const alice_recv   = await alice_wallet.newaddress
  console.log('receive address:', alice_recv)
  // Create a tx template that pays to Alice.
  const template = {
    vout : [{
      value : 800_000,
      scriptPubKey : Address.parse(alice_recv).script
    }]
  }
  // Load a wallet for Bob and ensure it has funds.
  const bob_wallet = await client.get_wallet('bob_wallet')
  await bob_wallet.ensure_funds(1_000_000)
  // Fund the tx from Alice using Bob's wallet
  const txdata = await bob_wallet.fund_tx(template)
  // Print the txdata to console.
  console.log('txdata:', txdata)
  // Publish the tx.
  const txid = await client.publish_tx(txdata)
  // Mine a few blocks to confirm the tx.
  await client.mine_blocks(1)
  // Print the txid to console.
  console.log('txid:', txid)
})
