import { Address }    from '@scrow/tapscript'
import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({ datapath: '/home/cscott/.bitcoin' })

core.on('ready', async (client) => {

  // Load a wallet for Alice and generate an address.
  const alice_wallet = await client.get_wallet('alice_wallet')
  const alice_recv   = await alice_wallet.newaddress

  console.log('Alice receive address:', alice_recv)

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

  console.log('txdata:', txdata)

  // Publish the tx.
  const txid = await client.publish_tx(txdata)

  console.log('txid:', txid)

  // Mine a few blocks to confirm the tx.
  await client.mine_blocks(6)

  // We can scan Alice's address for UTXOs.
  const utxos = await client.scan_addr(alice_recv)

  console.log('utxos:', utxos)

  // Once we are done, shutdown core.
  await core.shutdown()
})

await core.startup()
