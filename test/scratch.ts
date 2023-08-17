import { Address }    from '@scrow/tapscript'
import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon()

core.on('ready', async (client) => {

  const info = await client.get_info

  console.log(info)

  throw 'kaboom'

  const wallet = await client.get_wallet('test_wallet')

  const addr   = await wallet.newaddress

  console.log('addr:', addr)

  const template = {
    vout : [{
      value : 800_000,
      scriptPubKey : Address.parse(addr).script
    }]
  }

  await wallet.ensure_funds(1_000_000)

  const txdata = await wallet.fund_tx(template)

  console.log(txdata)

  const txid = await wallet.publish_tx(txdata)

  console.log('txid:', txid)

  await core.shutdown()
})

await core.startup()
