import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({
  existing : true,
  network  : 'signet',
  debug    : true
})

await core.run(async (client) => { 
  console.log(await client.chain_info)
})
