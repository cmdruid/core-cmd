export type ClientConfig = CoreConfig

export interface CoreConfig {
  corepath   ?: string
  cookiepath ?: string
  clipath    ?: string
  confpath   ?: string
  datapath   ?: string
  debug       : boolean
  init_delay  : number
  isolated    : boolean
  network     : string
  peer_port  ?: number
  rpc_port   ?: number
  rpc_user   ?: string
  rpc_pass   ?: string
  safemode    : boolean
  no_spawn    : boolean
  timeout     : number
  use_cache   : boolean
  verbose     : boolean
  params      : string[]
  core_params : string[]
  cli_params  : string[]
}

export interface AddressConfig {
  label ?: string
  address_type ?: 'legacy' | 'p2sh-segwit' | 'bech32' | 'bech32m' | string
}

export interface CmdConfig {
  cache  : boolean,
  params : string[]
}
