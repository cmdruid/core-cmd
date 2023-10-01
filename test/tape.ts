import tape           from 'tape'
import { CoreDaemon } from '../src/index.js'

import base_test from './src/base.test.js'
import send_test from './src/send.test.js'

export const core = new CoreDaemon({
  corepath : 'test/bin/bitcoind',
  clipath  : 'test/bin/bitcoin-cli',
  confpath : 'test/bitcoin.conf',
  datapath : 'test/data',
  debug    : true,
  isolated : true,
  network  : 'regtest'
})

core.tasks.push(async (client) => {
  console.log('startup task:')
  console.log(await client.chain_info)
})

tape('Core Command test suite.', async t => {

  const client = await core.startup()

  base_test(t, client)
  send_test(t, client)

  t.teardown(() => { core.shutdown() })
})
