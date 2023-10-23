import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({
  datapath: `${process.env.HOME}/.bitcoin`,
  debug : true
})

await core.run(async (client) => { 
  const txdata1 = await client.get_tx('2c47eea8e2cea19baae3f33bd1c7ef6b760d871f6841ab88f10458ad35b9855d')
  console.dir(txdata1, { depth : null })
  const txdata2 = await client.get_prevout('2c47eea8e2cea19baae3f33bd1c7ef6b760d871f6841ab88f10458ad35b9855d', 1)
  console.dir(txdata2)
})
