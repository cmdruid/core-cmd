# Core ORM

An ORM for Bitcoin Core

Example code:

```ts
import { Address }    from '@scrow/tapscript'
import { CoreDaemon } from '@cmdcode/core-orm'

const core = new CoreDaemon()

core.on('ready', async (client) => {
  
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
```
