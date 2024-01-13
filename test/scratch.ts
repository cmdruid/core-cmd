import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({
  datapath: `${process.env.HOME}/.bitcoin`,
  network : 'regtest',
  debug : true
})

await core.run(async (client) => { 
  console.log(await client.chain_info)
  const wallet = await client.load_wallet('regtest-desc')
  console.log('xprv:', await wallet.xpub)
})
