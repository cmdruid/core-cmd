import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({
  daemon  : false,
  network : 'signet',
  debug   : true
})

await core.run(async (client) => { 
  console.log(await client.chain_info)
})
