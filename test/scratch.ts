import { CoreDaemon } from '../src/index.js'

const core = new CoreDaemon({
  datapath: `${process.env.HOME}/.bitcoin`,
  debug : true
})

await core.run(async (client) => { 
  const txdata1 = await client.get_tx('2c47eea8e2cea19baae3f33bd1c7ef6b760d871f6841ab88f10458ad35b9855d')
  console.log(txdata1)
  const txdata2 = await client.get_tx('46a32c829ad4f59dc68d0e7550ce2dc93bfd7141c0f41657f9418f6e320ee505')
  console.log(txdata2)
})
