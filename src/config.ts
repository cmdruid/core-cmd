import { CoreConfig } from './types/config.js'

export const DEFAULT_CONFIG : CoreConfig = {
  corepath    : 'bitcoind',
  clipath     : 'bitcoin-cli',
  debug       : false,
  isolated    : false,
  network     : 'regtest',
  rpcport     : 18443,
  throws      : false,
  timeout     : 5000,
  verbose     : true,
  params      : [],
  core_params : [],
  cli_params  : []
}

export function get_config (
  config ?: Partial<CoreConfig>
) : CoreConfig {
  return { ...DEFAULT_CONFIG, ...config }
}
