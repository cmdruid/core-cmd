import { CoreConfig } from "./types/config.js";

export const DEFAULT_CONFIG = {
  corepath : 'bitcoind',
  clipath  : 'bitcoin-cli',
  datapath : `${process.cwd()}/coredata`,
  isolated : false,
  network  : 'regtest',
  params   : [],
  rpcport  : 18443
}

export function get_config (
  config ?: Partial<CoreConfig>
) : CoreConfig {
  return { ...DEFAULT_CONFIG, ...config }
}
