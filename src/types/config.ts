export type CLIConfig = CoreConfig

export interface CoreConfig {
  corepath    : string
  cookiepath ?: string
  clipath     : string
  confpath   ?: string
  datapath   ?: string
  debug       : boolean
  isolated    : boolean
  network     : string
  rpcport     : number
  throws      : boolean
  timeout     : number
  verbose     : boolean
  params      : string[]
  core_params : string[]
  cli_params  : string[]
}

export interface AddressConfig {
  label ?: string
  type  ?: 'legacy' | 'p2sh-segwit' | 'bech32'
}
