export type ClientConfig = CoreConfig

export interface CoreConfig {
  corepath   ?: string
  cookiepath ?: string
  clipath    ?: string
  confpath   ?: string
  datapath   ?: string
  debug       : boolean
  isolated    : boolean
  network     : string
  peer_port  ?: number
  rpc_port   ?: number
  timeout     : number
  verbose     : boolean
  params      : string[]
  core_params : string[]
  cli_params  : string[]
}

export interface AddressConfig {
  label ?: string
  type  ?: 'legacy' | 'p2sh-segwit' | 'bech32' | string
}

export interface CmdConfig {
  cache  : boolean,
  params : string[]
}
