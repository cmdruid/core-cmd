import { CoreConfig } from './types/config.js'

export const DEFAULT_CONFIG : CoreConfig = {
  debug       : false,
  isolated    : false,
  network     : 'regtest',
  peer_port   : 18442,
  rpc_port    : 18443,
  throws      : false,
  timeout     : 5000,
  verbose     : true,
  params      : [],
  core_params : [],
  cli_params  : []
}

export function get_config (
  config : Partial<CoreConfig> = {}
) : CoreConfig {
  const { confpath, corepath, clipath, datapath } = config
  config.confpath = resolve_path(confpath)
  config.corepath = resolve_path(corepath)
  config.clipath  = resolve_path(clipath)
  config.datapath = resolve_path(datapath)
  return { ...DEFAULT_CONFIG, ...config }
}

function resolve_path (path ?: string) {
  return (typeof path === 'string' && !path.startsWith('/'))
    ? process.cwd() + '/' + path
    : path
}
