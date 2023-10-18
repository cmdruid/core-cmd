import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({ datapath: `${process.env.HOME}/.bitcoin` })

core.run(async (client) => { 
  const block = await client.get_block()
  console.log(block)
})
