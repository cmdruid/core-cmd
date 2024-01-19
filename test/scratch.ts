import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({
  network : 'signet',
  debug   : true,
  spawn   : false
})

await core.run(async (client) => { 
  console.log(await client.chain_info)
})
