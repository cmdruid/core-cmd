import { CoreDaemon } from '../../src/index.js'
import { CoreConfig } from '../../src/types/config.js'

export function get_test_core () {
  const cwd = process.cwd()

  const config : Partial<CoreConfig> = {
    corepath : cwd + '/test/bin/bitcoind',
    clipath  : cwd + '/test/bin/bitcoin-cli',
    confpath : cwd + '/test/bitcoin.conf',
    datapath : cwd + '/test/data',
    isolated : true,
    network  : 'regtest'
  }

  return new CoreDaemon(config)
}