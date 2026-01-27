import tape           from 'tape'
import { CoreDaemon } from '../../src/index.js'

import base_test from '../cases/legacy/base.test.js'
import send_test from '../cases/legacy/send.test.js'

const config = {
  corepath : 'test/bin/bitcoind',
  clipath  : 'test/bin/bitcoin-cli',
  confpath : 'test/bitcoin.conf',
  datapath : 'test/data',
  debug    : true,
  isolated : true,
  verbose  : true,
  network  : 'regtest' as const
}

export let core: CoreDaemon

tape('Core Command test suite.', async t => {

  core = await CoreDaemon.spawn(config)
  const client = core.client

  console.log('startup task:')
  console.log(await client.get_chain_info())

  base_test(t, client)
  send_test(t, client)

  t.teardown(() => { core.shutdown() })
})
