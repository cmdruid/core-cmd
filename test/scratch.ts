import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({
  datapath: `${process.env.HOME}/.bitcoin`,
  network : 'test',
  debug : true
})

await core.run(async (client) => { 
  console.log(await client.chain_info)
})
