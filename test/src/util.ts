import { CoreDaemon } from '../../src/index.js'

export function create_daemon () {
  return new CoreDaemon({
    corepath : 'test/bin/bitcoind',
    clipath  : 'test/bin/bitcoin-cli',
    confpath : 'test/bitcoin.conf',
    datapath : 'test/data',
    debug    : false,
    isolated : true,
    network  : 'regtest',
    core_params : [ '-txindex' ]
  })
}
