import tape           from 'tape'
import { CoreDaemon } from '../src/index.js'

import base_test from './src/base.test.js'
import send_test from './src/send.test.js'

tape('Core Command test suite.', async t => {

  const core = new CoreDaemon({
    corepath : 'test/bin/bitcoind',
    clipath  : 'test/bin/bitcoin-cli',
    confpath : 'test/bitcoin.conf',
    datapath : 'test/data',
    debug    : false,
    isolated : true,
    network  : 'regtest',
    core_params : [ '-txindex' ]
  })

  const client = await core.startup()

  base_test(t, client)
  send_test(t, client)

  t.teardown(() => { core.shutdown() })
})
