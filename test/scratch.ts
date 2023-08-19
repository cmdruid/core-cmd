import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({ datapath: `${process.env.HOME}/.bitcoin` })

core.run(async (client) => { 
  const wallet  = await client.get_wallet('alice')
  const address = await wallet.newaddress

  console.log(address)
})
